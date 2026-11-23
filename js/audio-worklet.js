/**
 * AudioWorkletProcessor that captures microphone Float32 audio at the
 * browser's native sampleRate, downsamples cleanly to 16kHz Int16 PCM,
 * and emits ~100ms chunks (1,600 samples) plus RMS energy for mic metering.
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
    this.muted = false;

    this.port.onmessage = (event) => {
      if (event.data && typeof event.data.muted === 'boolean') {
        this.muted = event.data.muted;
      }
    };
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0] || input[0].length === 0) {
      return true;
    }

    const channel = input[0];
    let sumSq = 0;
    for (let i = 0; i < channel.length; i++) {
      const s = channel[i];
      sumSq += s * s;
    }
    const rms = this.muted ? 0 : Math.sqrt(sumSq / channel.length);

    if (this.muted) {
      // Still report zero level periodically without flooding
      this.port.postMessage({ type: 'level', rms: 0 });
      return true;
    }

    // Linear interpolation resampling from native sampleRate -> 16000 Hz
    let pos = this.resamplePhase;
    while (pos < channel.length) {
      const idx = Math.floor(pos);
      const frac = pos - idx;
      const s0 = idx === 0 && pos < 1 ? this.prevSample : channel[idx];
      const s1 = idx + 1 < channel.length ? channel[idx + 1] : channel[idx];
      const interpolated = s0 + (s1 - s0) * frac;

      const clamped = Math.max(-1, Math.min(1, interpolated));
      this.outBuffer[this.outIndex++] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;

      if (this.outIndex >= this.chunkSamples) {
        const payload = this.outBuffer.slice(0, this.chunkSamples);
        this.port.postMessage(
          { type: 'pcm', buffer: payload.buffer, rms },
          [payload.buffer]
        );
        this.outIndex = 0;
      }

      pos += this.ratio;
    }

    this.prevSample = channel[channel.length - 1];
    this.resamplePhase = pos - channel.length;

    return true;
  }
}

registerProcessor('pcm16k-capture-processor', Pcm16kCaptureProcessor);
