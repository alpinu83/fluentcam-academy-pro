/**
 * Smart Voice-Band Noise Gate & 16kHz PCM Capture AudioWorkletProcessor
 *
 * Filters out non-speech background noises (room hum, desk thumps, keyboard taps,
 * faint breathing, and tutor speaker echo) so Gemini Live only reacts to genuine
 * spoken English from the child.
 */
class Pcm16kCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.targetRate = 16000;
    this.ratio = sampleRate / this.targetRate;
    this.chunkSamples = 1600; // 100ms at 16kHz
    this.outBuffer = new Int16Array(this.chunkSamples);
    this.outIndex = 0;
    this.resamplePhase = 0;
    this.prevSample = 0;

    // 1st-order high-pass filter (~120 Hz cutoff) to remove AC hum & desk thumps
    const dt = 1 / sampleRate;
    const rc = 1 / (2 * Math.PI * 120);
    this.hpAlpha = rc / (rc + dt);
    this.hpPrevX = 0;
    this.hpPrevY = 0;

    // Controls
    this.muted = false;
    this.pttMode = false;
    this.pttPressed = false;
    this.tutorSpeaking = false;
    this.sensitivity = 'medium'; // 'low' | 'medium' | 'high'

    // Voice activity gate state (per 100ms chunk)
    this.noiseFloor = 0.008;
    this.consecutiveSpeechChunks = 0;
    this.gateOpen = false;
    this.hangoverChunks = 0;
    this.preSpeechRing = []; // keeps last 3 chunks (300ms) so first syllable isn't clipped
    this.wasPttTransmitting = false;

    this.port.onmessage = (event) => {
      const d = event.data;
      if (!d) return;
      if (typeof d.muted === 'boolean') this.muted = d.muted;
      if (typeof d.pttMode === 'boolean') {
        this.pttMode = d.pttMode;
        this.gateOpen = false;
        this.hangoverChunks = 0;
        this.consecutiveSpeechChunks = 0;
      }
      if (typeof d.pttPressed === 'boolean') {
        const was = this.pttPressed;
        this.pttPressed = d.pttPressed;
        if (was && !this.pttPressed && this.pttMode) {
          this.port.postMessage({ type: 'speechEnd' });
        }
      }
      if (typeof d.tutorSpeaking === 'boolean') {
        this.tutorSpeaking = d.tutorSpeaking;
      }
      if (typeof d.sensitivity === 'string') {
        this.sensitivity = d.sensitivity;
      }
    };
  }

  _getGateParams() {
    if (this.sensitivity === 'low') {
      // Quiet room: gentle filter
      return {
        minRms: 0.015,
        floorMult: 2.2,
        onsetChunks: 1,
        hangoverMax: 9, // 900ms
        echoMult: 1.8,
        blockWhileTutorSpeaks: false,
      };
    }
    if (this.sensitivity === 'high') {
      // Noisy living room: strict noise rejection + strong echo guard
      return {
        minRms: 0.036,
        floorMult: 3.4,
        onsetChunks: 2, // requires >= 200ms sustained speech (blocks clicks/taps/coughs)
        hangoverMax: 8,
        echoMult: 3.2,
        blockWhileTutorSpeaks: true,
      };
    }
    // 'medium' (recommended home default)
    return {
      minRms: 0.024,
      floorMult: 2.7,
      onsetChunks: 2, // filters brief transient clicks/keyboard taps
      hangoverMax: 9,
      echoMult: 2.6,
      blockWhileTutorSpeaks: false,
    };
  }

  _emitChunk(int16Chunk) {
    // Analyze filtered 16kHz speech chunk (RMS + Zero-Crossing Rate)
    let sumSq = 0;
    let zeroCrossings = 0;
    let prevSign = int16Chunk[0] >= 0;
    for (let i = 0; i < int16Chunk.length; i++) {
      const f = int16Chunk[i] / 32768;
      sumSq += f * f;
      const sign = int16Chunk[i] >= 0;
      if (sign !== prevSign) {
        zeroCrossings++;
        prevSign = sign;
      }
    }
    const rms = Math.sqrt(sumSq / int16Chunk.length);
    const zcr = zeroCrossings / int16Chunk.length; // human speech typically 0.02 .. 0.38

    if (this.muted) {
      this.gateOpen = false;
      this.hangoverChunks = 0;
      this.consecutiveSpeechChunks = 0;
      this.port.postMessage({ type: 'level', rms: 0, gateOpen: false });
      return;
    }

    // Mode 1: Push-to-Talk (100% immune to ambient room noise)
    if (this.pttMode) {
      if (this.pttPressed) {
        this.wasPttTransmitting = true;
        const copy = int16Chunk.slice(0);
        this.port.postMessage(
          { type: 'pcm', buffer: copy.buffer, rms, gateOpen: true },
          [copy.buffer]
        );
      } else {
        if (this.wasPttTransmitting) {
          this.wasPttTransmitting = false;
          this.port.postMessage({ type: 'speechEnd' });
        }
        this.port.postMessage({ type: 'level', rms, gateOpen: false });
      }
      return;
    }

    // Mode 2: Smart Adaptive Voice-Band Noise Gate
    const params = this._getGateParams();

    // If strict echo guard is on and AI tutor is actively speaking, hold mic cleanly
    if (this.tutorSpeaking && params.blockWhileTutorSpeaks) {
      this.consecutiveSpeechChunks = 0;
      if (this.gateOpen) {
        this.gateOpen = false;
        this.hangoverChunks = 0;
        this.port.postMessage({ type: 'speechEnd' });
      }
      this.port.postMessage({ type: 'level', rms: 0, gateOpen: false });
      return;
    }

    const baseThreshold = Math.max(params.minRms, this.noiseFloor * params.floorMult);
    const activeThreshold = this.tutorSpeaking ? baseThreshold * params.echoMult : baseThreshold;
    const isVoiceLikeZcr = zcr >= 0.015 && zcr <= 0.42;
    const looksLikeSpeech = rms >= activeThreshold && isVoiceLikeZcr;

    if (looksLikeSpeech) {
      this.consecutiveSpeechChunks++;
      this.hangoverChunks = params.hangoverMax;
    } else {
      this.consecutiveSpeechChunks = 0;
      // Gently adapt ambient noise floor when room is quiet and tutor isn't talking
      if (!this.gateOpen && !this.tutorSpeaking) {
        const clampedFloor = Math.min(0.032, rms);
        this.noiseFloor = this.noiseFloor * 0.94 + clampedFloor * 0.06;
      }
    }

    if (!this.gateOpen) {
      // Store rolling 300ms pre-speech audio so onset syllable is preserved
      this.preSpeechRing.push(int16Chunk.slice(0));
      if (this.preSpeechRing.length > 3) this.preSpeechRing.shift();

      if (this.consecutiveSpeechChunks >= params.onsetChunks) {
        this.gateOpen = true;
        // Flush pre-speech ring buffer immediately
        for (const pre of this.preSpeechRing) {
          this.port.postMessage(
            { type: 'pcm', buffer: pre.buffer, rms, gateOpen: true },
            [pre.buffer]
          );
        }
        this.preSpeechRing = [];
      } else {
        // Gate closed: do NOT send ambient room noise to Gemini!
        this.port.postMessage({ type: 'level', rms, gateOpen: false });
      }
      return;
    }

    // Gate is currently open: stream speech + hangover tail
    const copy = int16Chunk.slice(0);
    this.port.postMessage(
      { type: 'pcm', buffer: copy.buffer, rms, gateOpen: true },
      [copy.buffer]
    );

    if (!looksLikeSpeech) {
      this.hangoverChunks--;
      if (this.hangoverChunks <= 0) {
        this.gateOpen = false;
        this.consecutiveSpeechChunks = 0;
        this.port.postMessage({ type: 'speechEnd' });
      }
    }
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const raw = input[0];
    // Apply 120Hz high-pass filter to remove low-frequency hum & desk bumps
    const filtered = new Float32Array(raw.length);
    let prevX = this.hpPrevX;
    let prevY = this.hpPrevY;
    const a = this.hpAlpha;
    for (let i = 0; i < raw.length; i++) {
      const x = raw[i];
      const y = a * (prevY + x - prevX);
      filtered[i] = y;
      prevX = x;
      prevY = y;
    }
    this.hpPrevX = prevX;
    this.hpPrevY = prevY;

    // Resample native rate -> 16000 Hz Int16 PCM
    let pos = this.resamplePhase;
    while (pos < filtered.length) {
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const s0 = idx === 0 && pos < 1 ? this.prevSample : filtered[idx];
      const s1 = idx + 1 < filtered.length ? filtered[idx + 1] : filtered[idx];
      const interpolated = s0 + (s1 - s0) * frac;

      const clamped = Math.max(-1, Math.min(1, interpolated));
      this.outBuffer[this.outIndex++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this.outIndex >= this.chunkSamples) {
        this._emitChunk(this.outBuffer);
        this.outIndex = 0;
      }

      pos += this.ratio;
    }

    this.prevSample = filtered[filtered.length - 1];
    this.resamplePhase = pos - filtered.length;

    return true;
  }
}

registerProcessor('pcm16k-capture-processor', Pcm16kCaptureProcessor);
