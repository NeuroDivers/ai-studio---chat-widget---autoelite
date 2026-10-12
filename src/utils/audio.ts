/**
 * Audio capture and playback utilities for Gemini Live
 * Input: 16kHz 16-bit mono PCM little-endian
 * Output: 24kHz 16-bit mono PCM little-endian
 */

export class AudioCaptureController {
  private audioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private muteGain: GainNode | null = null;
  private isCapturing = false;
  private onChunkCallback: ((base64: string) => void) | null = null;
  private onVolumeCallback: ((volume: number) => void) | null = null;
  public chunksCount = 0;
  public lastRms = 0;

  async start(
    onAudioChunk: (base64: string) => void,
    onVolume?: (volume: number) => void
  ): Promise<void> {
    this.onChunkCallback = onAudioChunk;
    this.onVolumeCallback = onVolume || null;
    this.isCapturing = true;
    this.chunksCount = 0;

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone access is not supported in this browser environment');
    }

    // Reuse existing mediaStream if tracks are still active
    const hasActiveTracks =
      this.mediaStream &&
      this.mediaStream.getTracks().some((t) => t.readyState === 'live');

    if (!hasActiveTracks) {
      try {
        this.mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (err: any) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
          throw new Error('Permission refusée : Veuillez autoriser le microphone dans votre navigateur');
        }
        throw err;
      }
    }

    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    // Use default hardware sample rate (e.g. 48000 or 44100).
    // Avoid passing { sampleRate: 16000 } because Chromium has a known bug where
    // MediaStreamSource resampled to 16000 produces zeroed/silent audio!
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      this.audioCtx = new AudioContextClass();
    }

    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    const actualSampleRate = this.audioCtx.sampleRate;

    if (!this.mediaStream) {
      throw new Error('Microphone stream is unavailable');
    }

    this.cleanupNodes();

    this.sourceNode = this.audioCtx.createMediaStreamSource(this.mediaStream);
    // Buffer size 4096 gives ~85ms at 48kHz, ~93ms at 44.1kHz
    this.processor = this.audioCtx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (e) => {
      if (!this.isCapturing || !this.onChunkCallback) return;

      const inputChannel = e.inputBuffer.getChannelData(0);

      // Compute RMS volume for visualizer / debugging
      let sumSquares = 0;
      for (let i = 0; i < inputChannel.length; i++) {
        sumSquares += inputChannel[i] * inputChannel[i];
      }
      const rms = Math.sqrt(sumSquares / inputChannel.length);
      this.lastRms = rms;
      if (this.onVolumeCallback) {
        this.onVolumeCallback(rms);
      }

      // Downsample input from hardware rate to 16kHz
      const pcm16 = this.downsampleTo16k(inputChannel, actualSampleRate);

      // Convert Int16Array to base64 string
      const bytes = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      this.chunksCount++;
      this.onChunkCallback(base64);
    };

    // Keep onaudioprocess alive in Chromium by connecting to a mute gain connected to destination
    this.muteGain = this.audioCtx.createGain();
    this.muteGain.gain.value = 0;
    this.sourceNode.connect(this.processor);
    this.processor.connect(this.muteGain);
    this.muteGain.connect(this.audioCtx.destination);
  }

  private downsampleTo16k(input: Float32Array, inputRate: number): Int16Array {
    if (inputRate === 16000) {
      const pcm16 = new Int16Array(input.length);
      for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }
      return pcm16;
    }

    const ratio = inputRate / 16000;
    const outputLength = Math.round(input.length / ratio);
    const pcm16 = new Int16Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = Math.min(Math.round(i * ratio), input.length - 1);
      const sample = Math.max(-1, Math.min(1, input[srcIndex]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
    }

    return pcm16;
  }

  private cleanupNodes(): void {
    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor = null;
    }

    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // ignore
      }
      this.sourceNode = null;
    }

    if (this.muteGain) {
      try {
        this.muteGain.disconnect();
      } catch {
        // ignore
      }
      this.muteGain = null;
    }
  }

  stop(): void {
    this.isCapturing = false;
    this.onChunkCallback = null;
    this.onVolumeCallback = null;
    this.cleanupNodes();
  }

  destroy(): void {
    this.stop();
    if (this.mediaStream) {
      try {
        this.mediaStream.getTracks().forEach((track) => track.stop());
      } catch {
        // ignore
      }
      this.mediaStream = null;
    }

    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }

  isActive(): boolean {
    return this.isCapturing;
  }
}

// Helper to ensure raw PCM or WAV data has a valid RIFF container for decodeAudioData
function ensureWavContainer(bytes: Uint8Array, sampleRate = 24000, numChannels = 1): ArrayBuffer {
  // If already has RIFF header, return its buffer slice directly
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // 'R'
    bytes[1] === 0x49 && // 'I'
    bytes[2] === 0x46 && // 'F'
    bytes[3] === 0x46    // 'F'
  ) {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
  }

  // Prepend 44-byte standard RIFF header for linear 16-bit PCM
  const pcmLength = bytes.length;
  const wavBuffer = new ArrayBuffer(44 + pcmLength);
  const view = new DataView(wavBuffer);

  // "RIFF"
  view.setUint32(0, 0x52494646, false);
  view.setUint32(4, 36 + pcmLength, true);
  // "WAVE"
  view.setUint32(8, 0x57415645, false);
  // "fmt "
  view.setUint32(12, 0x666d7420, false);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * numChannels * 2, true);
  view.setUint16(32, numChannels * 2, true);
  view.setUint16(34, 16, true);
  // "data"
  view.setUint32(36, 0x64617461, false);
  view.setUint32(40, pcmLength, true);

  new Uint8Array(wavBuffer, 44).set(bytes);
  return wavBuffer;
}

export class AudioPlaybackController {
  private audioCtx: AudioContext | null = null;
  private nextStartTime = 0;
  private activeSources: AudioBufferSourceNode[] = [];
  private currentAudioElement: HTMLAudioElement | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();
      this.nextStartTime = this.audioCtx.currentTime;
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  async resume(): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }

  playChunk(pcm24Base64: string): void {
    try {
      const ctx = this.getAudioContext();
      const binaryString = atob(pcm24Base64);
      const len = binaryString.length;
      const samplesCount = Math.floor(len / 2);
      if (samplesCount === 0) return;

      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert 16-bit signed PCM to float32 (-1.0 to 1.0)
      const float32 = new Float32Array(samplesCount);
      const dataView = new DataView(bytes.buffer, bytes.byteOffset, samplesCount * 2);
      for (let i = 0; i < samplesCount; i++) {
        const val = dataView.getInt16(i * 2, true); // little-endian
        float32[i] = val < 0 ? val / 32768 : val / 32767;
      }

      // Bit-perfect 24kHz buffer resampled by browser's native hardware AudioContext
      const audioBuffer = ctx.createBuffer(1, samplesCount, 24000);
      audioBuffer.getChannelData(0).set(float32);

      const sourceNode = ctx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.connect(ctx.destination);

      const now = ctx.currentTime;
      // Tight scheduling: if next scheduled time has lapsed, schedule with only 5ms lookahead to eliminate gaps
      if (this.nextStartTime < now) {
        this.nextStartTime = now + 0.005;
      }

      sourceNode.start(this.nextStartTime);
      this.nextStartTime += audioBuffer.duration;

      this.activeSources.push(sourceNode);
      sourceNode.onended = () => {
        const idx = this.activeSources.indexOf(sourceNode);
        if (idx !== -1) this.activeSources.splice(idx, 1);
      };
    } catch (err) {
      console.warn('Error playing audio chunk:', err);
    }
  }

  async playAudioUrl(url: string): Promise<void> {
    this.interrupt();

    return new Promise<void>((resolve) => {
      // 1. Primary: HTML5 Audio element - rock-solid streaming media pipeline that never gets garbage-collected or cut off
      try {
        const audio = new Audio();
        this.currentAudioElement = audio;
        audio.src = url;
        audio.preload = 'auto';

        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', onError);
          if (this.currentAudioElement === audio) {
            this.currentAudioElement = null;
          }
          resolve();
        };

        const onError = async (e: any) => {
          console.warn('HTMLAudioElement load/play error, attempting WebAudio fallback:', e);
          if (settled) return;
          settled = true;
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', onError);
          if (this.currentAudioElement === audio) {
            this.currentAudioElement = null;
          }
          await this.playWebAudioFallback(url);
          resolve();
        };

        audio.addEventListener('ended', done);
        audio.addEventListener('error', onError);

        audio.play().catch(async (playErr) => {
          console.warn('HTMLAudioElement play() rejected, falling back to WebAudio:', playErr);
          if (settled) return;
          settled = true;
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', onError);
          if (this.currentAudioElement === audio) {
            this.currentAudioElement = null;
          }
          await this.playWebAudioFallback(url);
          resolve();
        });
      } catch (err) {
        console.warn('HTMLAudio init error:', err);
        this.playWebAudioFallback(url).then(resolve).catch(resolve);
      }
    });
  }

  private async playWebAudioFallback(url: string): Promise<void> {
    try {
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      let audioBuffer = this.bufferCache.get(url);
      if (!audioBuffer) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching audio`);
        const arrayBuf = await res.arrayBuffer();
        audioBuffer = await ctx.decodeAudioData(arrayBuf);
        this.bufferCache.set(url, audioBuffer);
      }

      return new Promise<void>((resolve) => {
        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(ctx.destination);

        let finished = false;
        const onEnd = () => {
          if (finished) return;
          finished = true;
          const idx = this.activeSources.indexOf(sourceNode);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          resolve();
        };

        sourceNode.onended = onEnd;
        sourceNode.start(0);
        this.activeSources.push(sourceNode);
      });
    } catch (webAudioErr) {
      console.warn('WebAudio decode fallback failed:', webAudioErr);
    }
  }

  async playWavBase64(wavOrPcmBase64: string): Promise<void> {
    try {
      this.interrupt();
      const ctx = this.getAudioContext();
      if (ctx.state === 'suspended') {
        await ctx.resume().catch(() => {});
      }
      const binaryString = atob(wavOrPcmBase64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Automatically wrap raw PCM in RIFF WAV header if missing
      const containerBuffer = ensureWavContainer(bytes, 24000, 1);
      const audioBuffer = await ctx.decodeAudioData(containerBuffer);

      return new Promise<void>((resolve) => {
        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(ctx.destination);

        sourceNode.onended = () => {
          const idx = this.activeSources.indexOf(sourceNode);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          resolve();
        };

        sourceNode.start(0);
        this.activeSources.push(sourceNode);
      });
    } catch (err) {
      console.warn('Could not decode or play WAV audio:', err);
    }
  }

  interrupt(): void {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {
        // ignore
      }
      this.currentAudioElement = null;
    }
    for (const source of this.activeSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // ignore
      }
    }
    this.activeSources = [];
    if (this.audioCtx) {
      this.nextStartTime = this.audioCtx.currentTime;
    }
  }

  close(): void {
    this.interrupt();
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {
        // ignore
      }
      this.audioCtx = null;
    }
  }
}
