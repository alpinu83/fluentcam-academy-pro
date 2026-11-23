const WS_BASE =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function base64ToInt16Array(base64) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Int16Array(bytes.buffer);
}

/**
 * Smooth, interruptible 24kHz PCM player with AnalyserNode.
 * Can either own its own AudioContext OR route directly into TalkingHead's
 * AudioContext + audioSpeechGainNode for zero-latency 3D real-time lip-sync!
 */
export class PcmAudioPlayer {
  constructor(onSpeakingChange) {
    this.ctx = null;
    this.ownsCtx = true;
    this.gainNode = null;
    this.analyser = null;
    this.freqData = null;
    this.nextStartTime = 0;
    this.activeSources = new Set();
    this.onSpeakingChange = onSpeakingChange;
    this.isSpeaking = false;
    this.totalSpeakingMs = 0;
  }

  async init(externalTarget = null) {
    await this.close();

    if (externalTarget && externalTarget.audioCtx && externalTarget.destinationNode) {
      this.ctx = externalTarget.audioCtx;
      this.ownsCtx = false;
      this.gainNode = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.72;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      this.gainNode.connect(this.analyser);
      this.analyser.connect(externalTarget.destinationNode);
    } else {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx({ sampleRate: 24000 });
      this.ownsCtx = true;
      this.gainNode = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.72;
      this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume().catch(() => {});
    }
    this.nextStartTime = this.ctx.currentTime;
  }

  enqueueBase64Pcm(base64Data, sampleRate = 24000) {
    if (!this.ctx || this.ctx.state === 'closed') return;
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    const int16 = base64ToInt16Array(base64Data);
    if (int16.length === 0) return;

    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = this.ctx.createBuffer(1, float32.length, sampleRate);
    audioBuffer.copyToChannel(float32, 0);

    const source = this.ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const now = this.ctx.currentTime;
    const startTime = Math.max(now + 0.015, this.nextStartTime);
    this.nextStartTime = startTime + audioBuffer.duration;
    this.totalSpeakingMs += audioBuffer.duration * 1000;

    this.activeSources.add(source);
    if (!this.isSpeaking) {
      this.isSpeaking = true;
      this.onSpeakingChange?.(true);
    }

    source.onended = () => {
      this.activeSources.delete(source);
      if (this.activeSources.size === 0 && this.ctx && this.ctx.currentTime >= this.nextStartTime - 0.04) {
        this.isSpeaking = false;
        this.onSpeakingChange?.(false);
      }
    };

    source.start(startTime);
  }

  interrupt() {
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Ignore already stopped nodes
      }
    }
    this.activeSources.clear();
    if (this.ctx) {
      this.nextStartTime = this.ctx.currentTime;
    }
    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.onSpeakingChange?.(false);
    }
  }

  getVisualizerLevels(barCount = 24) {
    if (!this.analyser || !this.freqData || !this.isSpeaking) {
      return new Array(barCount).fill(0);
    }
    this.analyser.getByteFrequencyData(this.freqData);
    const result = [];
    const usableBins = Math.min(this.freqData.length, 36);
    for (let i = 0; i < barCount; i++) {
      const binIndex = Math.floor((i / barCount) * usableBins);
      result.push(this.freqData[binIndex] / 255);
    }
    return result;
  }

  async close() {
    this.interrupt();
    try {
      this.gainNode?.disconnect();
      this.analyser?.disconnect();
    } catch {
      // ignore
    }
    if (this.ownsCtx && this.ctx && this.ctx.state !== 'closed') {
      await this.ctx.close().catch(() => {});
    }
    this.ctx = null;
    this.analyser = null;
    this.gainNode = null;
  }
}

/**
 * WebSocket client for Google Gemini Live API (BidiGenerateContent)
 * with Audio/Video streaming, Input/Output Transcription, and Native Tool Calling.
 */
export class GeminiLiveClient {
  constructor(callbacks = {}) {
    this.ws = null;
    this.callbacks = callbacks;
    this.isSetupComplete = false;
    this.closedByUser = false;
  }

  connect({ apiKey, model, voiceName, systemInstruction, tools = [] }) {
    return new Promise((resolve, reject) => {
      this.closedByUser = false;
      this.isSetupComplete = false;

      const cleanKey = apiKey.trim();
      const modelPath = model.startsWith('models/') ? model : `models/${model}`;
      const url = `${WS_BASE}?key=${encodeURIComponent(cleanKey)}`;

      let settled = false;
      const ws = new WebSocket(url);
      this.ws = ws;

      const setupTimeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.close();
          reject(new Error('Gemini Live 세션 응답 시간이 초과되었습니다. API 키와 모델 이름을 확인해 주세요.'));
        }
      }, 15000);

      ws.onopen = () => {
        const setupObj = {
          model: modelPath,
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: voiceName || 'Aoede',
                },
              },
            },
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        };

        if (Array.isArray(tools) && tools.length > 0) {
          setupObj.tools = tools;
        }

        ws.send(JSON.stringify({ setup: setupObj }));
      };

      ws.onmessage = async (event) => {
        try {
          let rawText = '';
          if (typeof event.data === 'string') {
            rawText = event.data;
          } else if (event.data instanceof Blob) {
            rawText = await event.data.text();
          } else if (event.data instanceof ArrayBuffer) {
            rawText = new TextDecoder().decode(event.data);
          } else {
            return;
          }

          const msg = JSON.parse(rawText);

          if (msg.setupComplete !== undefined || msg.setup_complete !== undefined) {
            this.isSetupComplete = true;
            if (!settled) {
              settled = true;
              clearTimeout(setupTimeout);
              resolve();
            }
            this.callbacks.onSetupComplete?.();
            return;
          }

          // Handle Gemini Live Native Tool Calls
          const tc = msg.toolCall || msg.tool_call;
          if (tc) {
            const calls = tc.functionCalls || tc.function_calls || [];
            if (calls.length > 0) {
              const responses = [];
              for (const fnCall of calls) {
                let result = { ok: true };
                try {
                  if (this.callbacks.onToolCall) {
                    const out = await this.callbacks.onToolCall(fnCall);
                    if (out && typeof out === 'object') result = out;
                  }
                } catch (toolErr) {
                  result = { ok: false, error: toolErr.message };
                }
                responses.push({
                  id: fnCall.id,
                  name: fnCall.name,
                  response: result,
                });
              }
              this.sendToolResponses(responses);
            }
            return;
          }

          const sc = msg.serverContent || msg.server_content;
          if (!sc) return;

          if (sc.interrupted) {
            this.callbacks.onInterrupted?.();
          }

          const inTrans = sc.inputTranscription || sc.input_transcription;
          if (inTrans && typeof inTrans.text === 'string' && inTrans.text.length > 0) {
            this.callbacks.onInputTranscription?.(inTrans.text);
          }

          const outTrans = sc.outputTranscription || sc.output_transcription;
          if (outTrans && typeof outTrans.text === 'string' && outTrans.text.length > 0) {
            this.callbacks.onOutputTranscription?.(outTrans.text);
          }

          const modelTurn = sc.modelTurn || sc.model_turn;
          if (modelTurn && Array.isArray(modelTurn.parts)) {
            for (const part of modelTurn.parts) {
              const inline = part.inlineData || part.inline_data;
              if (inline && inline.data) {
                const mime = inline.mimeType || inline.mime_type || 'audio/pcm;rate=24000';
                if (mime.startsWith('audio/pcm')) {
                  const rateMatch = mime.match(/rate=(\d+)/i);
                  const sampleRate = rateMatch ? Number(rateMatch[1]) : 24000;
                  this.callbacks.onAudioChunk?.(inline.data, sampleRate);
                }
              }
            }
          }

          if (sc.turnComplete || sc.turn_complete) {
            this.callbacks.onTurnComplete?.();
          }
        } catch (err) {
          console.error('Failed to parse Gemini Live message:', err);
        }
      };

      ws.onerror = () => {
        if (!settled) {
          settled = true;
          clearTimeout(setupTimeout);
          reject(new Error('Gemini Live WebSocket 연결에 실패했습니다. 네트워크 또는 API 키를 확인해 주세요.'));
        } else {
          this.callbacks.onError?.(new Error('실시간 연결 중 네트워크 오류가 발생했습니다.'));
        }
      };

      ws.onclose = (ev) => {
        clearTimeout(setupTimeout);
        const reasonText = ev.reason ? ` (${ev.reason})` : '';
        if (!settled) {
          settled = true;
          reject(
            new Error(
              `연결이 종료되었습니다 [코드 ${ev.code}]${reasonText}. 선택한 Live 모델이 API 키에서 지원되는지 확인해 주세요.`
            )
          );
          return;
        }
        this.callbacks.onClose?.({
          code: ev.code,
          reason: ev.reason,
          closedByUser: this.closedByUser,
        });
      };
    });
  }

  sendToolResponses(functionResponses) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        toolResponse: {
          functionResponses,
        },
      })
    );
  }

  sendAudioPcmBuffer(arrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) return;
    const base64 = arrayBufferToBase64(arrayBuffer);
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audio: {
            mimeType: 'audio/pcm;rate=16000',
            data: base64,
          },
        },
      })
    );
  }

  sendVideoFrameBase64(jpegBase64) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) return;
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          video: {
            mimeType: 'image/jpeg',
            data: jpegBase64,
          },
        },
      })
    );
  }

  sendTextTurn(text) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN || !this.isSetupComplete) return;
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turns: [
            {
              role: 'user',
              parts: [{ text }],
            },
          ],
          turnComplete: true,
        },
      })
    );
  }

  disconnect() {
    this.closedByUser = true;
    this.isSetupComplete = false;
    if (this.ws) {
      try {
        this.ws.close(1000, 'User ended call');
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }
}
