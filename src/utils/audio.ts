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

// Helper to apply smooth fade-in (15ms), fade-out (100ms), and silent zero-tail (60ms) to 16-bit PCM samples
function applyFadeToPcmBytes(
  bytes: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  fadeInMs = 15,
  fadeOutMs = 100,
  silenceTailMs = 60
): Uint8Array {
  const bytesPerSample = 2; // 16-bit signed PCM
  const blockAlign = numChannels * bytesPerSample;
  const numFrames = Math.floor(bytes.length / blockAlign);
  if (numFrames <= 0) return bytes;

  const fadeInFrames = Math.floor(sampleRate * (fadeInMs / 1000));
  const fadeOutFrames = Math.floor(sampleRate * (fadeOutMs / 1000));
  const silenceFrames = Math.floor(sampleRate * (silenceTailMs / 1000));

  const totalFrames = numFrames + silenceFrames;
  const outputBytes = new Uint8Array(totalFrames * blockAlign);
  outputBytes.set(bytes.subarray(0, numFrames * blockAlign));

  const view = new DataView(outputBytes.buffer, outputBytes.byteOffset, outputBytes.byteLength);

  // 1. Smooth Fade-In at the start to eliminate opening transient
  const inLimit = Math.min(fadeInFrames, numFrames);
  for (let f = 0; f < inLimit; f++) {
    const gain = 0.5 * (1 - Math.cos((Math.PI * f) / fadeInFrames));
    for (let ch = 0; ch < numChannels; ch++) {
      const byteOffset = (f * numChannels + ch) * 2;
      const val = view.getInt16(byteOffset, true);
      view.setInt16(byteOffset, Math.round(val * gain), true);
    }
  }

  // 2. Smooth Cosine Fade-Out at the end (100ms) to ensure clean, silent termination without static pop
  if (numFrames > fadeOutFrames) {
    const startFrame = numFrames - fadeOutFrames;
    for (let f = 0; f < fadeOutFrames; f++) {
      const frameIdx = startFrame + f;
      const gain = 0.5 * (1 + Math.cos((Math.PI * f) / fadeOutFrames));
      for (let ch = 0; ch < numChannels; ch++) {
        const byteOffset = (frameIdx * numChannels + ch) * 2;
        const val = view.getInt16(byteOffset, true);
        view.setInt16(byteOffset, Math.round(val * gain), true);
      }
    }
  }

  // 3. The remaining silenceFrames are already 0 in new Uint8Array, guaranteeing zero DC offset
  return outputBytes;
}

// Helper to ensure raw PCM or WAV data has a valid RIFF container with smooth fade-out
function ensureWavContainer(bytes: Uint8Array, sampleRate = 24000, numChannels = 1): ArrayBuffer {
  // If already has RIFF header, return buffer
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

  // Process raw PCM with smooth fade-in, 100ms fade-out, and 60ms silent tail
  const smoothPcm = applyFadeToPcmBytes(bytes, sampleRate, numChannels, 15, 100, 60);
  const pcmLength = smoothPcm.length;
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

  new Uint8Array(wavBuffer, 44).set(smoothPcm);
  return wavBuffer;
}

export class AudioPlaybackController {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private silentKeepAlive: ConstantSourceNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private currentAudioElement: HTMLAudioElement | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();

  // Continuous PCM Streaming state for Gemini Live voice responses
  private streamProcessor: ScriptProcessorNode | null = null;
  private streamQueue: Float32Array[] = [];
  private queueReadOffset = 0;
  private totalQueuedSamples = 0;
  private isStreamBuffering = true;
  private isStreaming = false;
  private leftoverByte: number | null = null;
  private resamplerPhase = 0;
  private resamplerLastSample = 0;
  private streamFadeLevel = 0;

  private getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioContextClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioContextClass();

      // Master Gain for smooth volume control
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);

      // Silent keep-alive node: feeds constant 0V DC to destination.
      // This keeps the browser and OS audio hardware driver (WASAPI/CoreAudio) active,
      // permanently preventing the DAC power-down "walkie-talkie release" static click/pop!
      try {
        if (typeof this.audioCtx.createConstantSource === 'function') {
          this.silentKeepAlive = this.audioCtx.createConstantSource();
          this.silentKeepAlive.offset.value = 0;
          this.silentKeepAlive.connect(this.audioCtx.destination);
          this.silentKeepAlive.start();
        }
      } catch {
        // Ignore if createConstantSource not supported in environment
      }
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  private getMasterNode(): GainNode {
    this.getAudioContext();
    return this.masterGain!;
  }

  async resume(): Promise<void> {
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }
  }

  // Ensure continuous streaming processor is attached to the audio graph
  private ensureStreamProcessor(): void {
    const ctx = this.getAudioContext();
    if (this.streamProcessor) return;

    // Buffer size 1024 (21.3ms at 48kHz) provides responsive, low-latency, click-free output
    this.streamProcessor = ctx.createScriptProcessor(1024, 0, 1);
    this.streamProcessor.onaudioprocess = (e) => {
      const output = e.outputBuffer.getChannelData(0);
      const len = output.length;
      const hwRate = ctx.sampleRate;
      const fadeStep = 1 / (hwRate * 0.004); // ~4ms micro-fade for onset/offset transitions

      // On new speech start, buffer ~60ms before initial output to absorb packet jitter
      if (this.isStreamBuffering) {
        const minBufferSamples = Math.floor(hwRate * 0.06);
        if (this.totalQueuedSamples >= minBufferSamples || !this.isStreaming) {
          this.isStreamBuffering = false;
        } else {
          output.fill(0);
          return;
        }
      }

      for (let i = 0; i < len; i++) {
        if (this.totalQueuedSamples > 0) {
          let s = this.readStreamSample();
          if (this.streamFadeLevel < 1) {
            this.streamFadeLevel = Math.min(1, this.streamFadeLevel + fadeStep);
            s *= this.streamFadeLevel;
          }
          output[i] = s;
        } else {
          // If queue is empty, smoothly fade down to zero over 4ms to prevent pop
          if (this.streamFadeLevel > 0) {
            this.streamFadeLevel = Math.max(0, this.streamFadeLevel - fadeStep);
            output[i] = 0;
          } else {
            output[i] = 0;
          }
        }
      }
    };

    this.streamProcessor.connect(this.getMasterNode());
  }

  private readStreamSample(): number {
    if (this.streamQueue.length === 0) return 0;
    const currentChunk = this.streamQueue[0];
    const s = currentChunk[this.queueReadOffset++];
    this.totalQueuedSamples--;
    if (this.queueReadOffset >= currentChunk.length) {
      this.streamQueue.shift();
      this.queueReadOffset = 0;
    }
    return s;
  }

  // Play real-time 24kHz PCM audio chunks streamed from Gemini Live with continuous phase resampling
  // and ZERO per-chunk windowing, eliminating high-pitch static and edge clicks completely.
  playChunk(pcm24Base64: string): void {
    try {
      const ctx = this.getAudioContext();
      this.ensureStreamProcessor();
      this.isStreaming = true;

      const binaryString = atob(pcm24Base64);
      const byteLen = binaryString.length;
      if (byteLen === 0) return;

      // Handle carryover byte from previous chunk to maintain 16-bit word alignment
      const hasLeftover = this.leftoverByte !== null;
      let totalBytes = byteLen + (hasLeftover ? 1 : 0);
      const bytes = new Uint8Array(totalBytes);
      let offset = 0;
      if (hasLeftover) {
        bytes[0] = this.leftoverByte!;
        offset = 1;
        this.leftoverByte = null;
      }
      for (let i = 0; i < byteLen; i++) {
        bytes[offset + i] = binaryString.charCodeAt(i);
      }

      // If odd byte count, preserve last byte for next chunk
      if (totalBytes % 2 !== 0) {
        this.leftoverByte = bytes[totalBytes - 1];
        totalBytes -= 1;
      }

      const sampleCount24k = totalBytes / 2;
      if (sampleCount24k === 0) return;

      // Convert 16-bit signed PCM little-endian to Float32 (-1.0 to 1.0)
      const float24k = new Float32Array(sampleCount24k);
      const view = new DataView(bytes.buffer, bytes.byteOffset, totalBytes);
      for (let i = 0; i < sampleCount24k; i++) {
        const val = view.getInt16(i * 2, true);
        float24k[i] = val < 0 ? val / 32768 : val / 32767;
      }

      // Continuous fractional linear resampler from 24kHz to hardware sample rate
      const hwRate = ctx.sampleRate;
      let resampledChunk: Float32Array;

      if (hwRate === 24000) {
        resampledChunk = float24k;
      } else {
        const ratio = 24000 / hwRate;
        const approxOutLen = Math.ceil(sampleCount24k / ratio) + 2;
        const tempOut = new Float32Array(approxOutLen);
        let outCount = 0;
        let p = this.resamplerPhase;

        while (p < sampleCount24k) {
          const idx = Math.floor(p);
          const frac = p - idx;
          const s0 = idx === 0 ? this.resamplerLastSample : float24k[idx - 1];
          const s1 = float24k[idx];
          tempOut[outCount++] = s0 + frac * (s1 - s0);
          p += ratio;
        }

        this.resamplerPhase = p - sampleCount24k;
        this.resamplerLastSample = float24k[sampleCount24k - 1];
        resampledChunk = tempOut.subarray(0, outCount);
      }

      // Enqueue resampled chunk into continuous FIFO queue
      this.streamQueue.push(resampledChunk);
      this.totalQueuedSamples += resampledChunk.length;
    } catch (err) {
      console.warn('Error in playChunk:', err);
    }
  }

  endStream(): void {
    // Model turn completed: allow queued samples to play out smoothly into silence
    this.isStreaming = false;
  }

  // Play static greeting WAV file with persistent AudioContext, pristine 100ms fade-out,
  // 60ms trailing zeros, and zero-pop termination.
  async playAudioUrl(url: string): Promise<void> {
    this.interrupt();
    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => {});
    }

    try {
      let audioBuffer = this.bufferCache.get(url);
      if (!audioBuffer) {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} fetching audio`);
        const arrayBuf = await res.arrayBuffer();
        const decoded = await ctx.decodeAudioData(arrayBuf);

        // Ensure decoded buffer has a pristine cosine fade-out (100ms) and 60ms of trailing silence
        // to guarantee ZERO soundcard click/pop on all browsers and operating systems
        const fadeMs = 100;
        const silenceMs = 60;
        const sr = decoded.sampleRate;
        const channels = decoded.numberOfChannels;
        const fadeFrames = Math.floor(sr * (fadeMs / 1000));
        const silenceFrames = Math.floor(sr * (silenceMs / 1000));

        const totalFrames = decoded.length + silenceFrames;
        audioBuffer = ctx.createBuffer(channels, totalFrames, sr);

        for (let ch = 0; ch < channels; ch++) {
          const inData = decoded.getChannelData(ch);
          const outData = audioBuffer.getChannelData(ch);
          outData.set(inData);

          // Find last audible sample index
          let lastAudible = inData.length - 1;
          while (lastAudible > 0 && Math.abs(inData[lastAudible]) < 0.001) {
            lastAudible--;
          }

          // Apply cosine fade-out over fadeFrames ending at lastAudible
          const fadeStart = Math.max(0, lastAudible - fadeFrames);
          const actualFadeLen = lastAudible - fadeStart;
          if (actualFadeLen > 0) {
            for (let f = 0; f < actualFadeLen; f++) {
              const gain = 0.5 * (1 + Math.cos((Math.PI * f) / actualFadeLen));
              outData[fadeStart + f] *= gain;
            }
          }

          // Guarantee absolute zero for all trailing samples
          for (let f = lastAudible; f < totalFrames; f++) {
            outData[f] = 0;
          }
        }

        this.bufferCache.set(url, audioBuffer);
      }

      return new Promise<void>((resolve) => {
        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(this.getMasterNode());

        let finished = false;
        const onEnd = () => {
          if (finished) return;
          finished = true;
          const idx = this.activeSources.indexOf(sourceNode);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          resolve();
        };

        sourceNode.onended = onEnd;
        sourceNode.start(ctx.currentTime);
        this.activeSources.push(sourceNode);
      });
    } catch (webAudioErr) {
      console.warn('WebAudio play failed, falling back to HTMLAudioElement:', webAudioErr);
      return this.playHtmlAudioFallback(url);
    }
  }

  private playHtmlAudioFallback(url: string): Promise<void> {
    return new Promise((resolve) => {
      try {
        const audio = new Audio();
        this.currentAudioElement = audio;
        audio.src = url;

        let settled = false;
        const done = () => {
          if (settled) return;
          settled = true;
          audio.removeEventListener('ended', done);
          audio.removeEventListener('error', done);
          if (this.currentAudioElement === audio) {
            this.currentAudioElement = null;
          }
          resolve();
        };

        audio.addEventListener('ended', done);
        audio.addEventListener('error', done);
        audio.play().catch(done);
      } catch {
        resolve();
      }
    });
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

      // Automatically wrap raw PCM in RIFF WAV header with fade smoothing
      const containerBuffer = ensureWavContainer(bytes, 24000, 1);
      const audioBuffer = await ctx.decodeAudioData(containerBuffer);

      return new Promise<void>((resolve) => {
        const sourceNode = ctx.createBufferSource();
        sourceNode.buffer = audioBuffer;
        sourceNode.connect(this.getMasterNode());

        let finished = false;
        const onEnd = () => {
          if (finished) return;
          finished = true;
          const idx = this.activeSources.indexOf(sourceNode);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          resolve();
        };

        sourceNode.onended = onEnd;
        sourceNode.start(ctx.currentTime);
        this.activeSources.push(sourceNode);
      });
    } catch (err) {
      console.warn('Could not decode or play WAV audio:', err);
    }
  }

  interrupt(): void {
    if (this.currentAudioElement) {
      try {
        this.currentAudioElement.volume = 0;
        this.currentAudioElement.pause();
        this.currentAudioElement.currentTime = 0;
      } catch {}
      this.currentAudioElement = null;
    }

    // Reset stream state
    this.streamQueue = [];
    this.queueReadOffset = 0;
    this.totalQueuedSamples = 0;
    this.isStreaming = false;
    this.isStreamBuffering = true;
    this.leftoverByte = null;
    this.resamplerPhase = 0;
    this.resamplerLastSample = 0;
    this.streamFadeLevel = 0;

    // Stop active buffer sources cleanly
    const sourcesToStop = [...this.activeSources];
    this.activeSources = [];
    for (const source of sourcesToStop) {
      try {
        source.stop();
      } catch {}
    }
  }

  close(): void {
    this.interrupt();
    if (this.silentKeepAlive) {
      try {
        this.silentKeepAlive.stop();
        this.silentKeepAlive.disconnect();
      } catch {}
      this.silentKeepAlive = null;
    }
    if (this.streamProcessor) {
      try {
        this.streamProcessor.disconnect();
      } catch {}
      this.streamProcessor = null;
    }
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
      try {
        this.audioCtx.close().catch(() => {});
      } catch {}
      this.audioCtx = null;
    }
  }
}
