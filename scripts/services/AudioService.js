/**
 * Audio processing service
 * Handles audio mixing, effects, and export
 */

export class AudioService {
  constructor() {
    this.audioContext = null;
  }

  /**
   * Initialize audio context
   */
  getAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext ||
        window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  /**
   * Decode audio data to AudioBuffer
   * @param {ArrayBuffer} arrayBuffer - Audio data
   * @returns {Promise<AudioBuffer>} Decoded audio buffer
   */
  async decodeAudioData(arrayBuffer) {
    const context = this.getAudioContext();
    return context.decodeAudioData(arrayBuffer);
  }

  /**
   * Concatenate multiple audio buffers
   * @param {AudioBuffer[]} buffers - Array of audio buffers
   * @returns {AudioBuffer} Combined audio buffer
   */
  concatenateBuffers(buffers) {
    if (buffers.length === 0) {
      throw new Error('No buffers to concatenate');
    }

    const context = this.getAudioContext();
    const sampleRate = buffers[0].sampleRate;
    const numChannels = buffers[0].numberOfChannels;

    // Calculate total length
    const totalLength = buffers.reduce(
      (sum, buffer) => sum + buffer.length,
      0
    );

    // Create combined buffer
    const combined = context.createBuffer(
      numChannels,
      totalLength,
      sampleRate
    );

    // Copy data from each buffer
    let offset = 0;
    for (const buffer of buffers) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sourceData = buffer.getChannelData(channel);
        const destData = combined.getChannelData(channel);
        destData.set(sourceData, offset);
      }
      offset += buffer.length;
    }

    return combined;
  }

  /**
   * Mix two audio buffers
   * @param {AudioBuffer} buffer1 - First buffer (speech)
   * @param {AudioBuffer} buffer2 - Second buffer (background)
   * @param {Object} options - Mix options
   * @returns {AudioBuffer} Mixed audio buffer
   */
  mixBuffers(buffer1, buffer2, options = {}) {
    const context = this.getAudioContext();
    const sampleRate = buffer1.sampleRate;
    const numChannels = Math.max(
      buffer1.numberOfChannels,
      buffer2.numberOfChannels
    );
    const length = buffer1.length;

    const attenuation = options.attenuation || 0;
    const attenuationFactor = Math.pow(10, attenuation / 20);

    // Loop or truncate buffer2 to match buffer1 length
    const buffer2Data = [];
    for (let channel = 0; channel < buffer2.numberOfChannels; channel++) {
      const sourceData = buffer2.getChannelData(channel);
      const loopedData = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        loopedData[i] = sourceData[i % sourceData.length];
      }

      buffer2Data.push(loopedData);
    }

    // Create mixed buffer
    const mixed = context.createBuffer(numChannels, length, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
      const data1 = buffer1.getChannelData(
        Math.min(channel, buffer1.numberOfChannels - 1)
      );
      const data2 =
        buffer2Data[Math.min(channel, buffer2Data.length - 1)] ||
        new Float32Array(length);
      const mixedData = mixed.getChannelData(channel);

      for (let i = 0; i < length; i++) {
        mixedData[i] = data1[i] + data2[i] * attenuationFactor;
      }
    }

    return mixed;
  }

  /**
   * Apply fade in/out to audio buffer
   * @param {AudioBuffer} buffer - Audio buffer
   * @param {Object} options - Fade options
   * @returns {AudioBuffer} Buffer with fades applied
   */
  applyFades(buffer, options = {}) {
    const fadeInMs = options.fadeIn || 3000;
    const fadeOutMs = options.fadeOut || 6000;

    const sampleRate = buffer.sampleRate;
    const fadeInSamples = (fadeInMs / 1000) * sampleRate;
    const fadeOutSamples = (fadeOutMs / 1000) * sampleRate;

    const numChannels = buffer.numberOfChannels;

    for (let channel = 0; channel < numChannels; channel++) {
      const data = buffer.getChannelData(channel);

      // Fade in
      for (let i = 0; i < Math.min(fadeInSamples, data.length); i++) {
        data[i] *= i / fadeInSamples;
      }

      // Fade out
      const fadeOutStart = Math.max(0, data.length - fadeOutSamples);
      for (let i = fadeOutStart; i < data.length; i++) {
        const fadeProgress = (i - fadeOutStart) / fadeOutSamples;
        data[i] *= 1 - fadeProgress;
      }
    }

    return buffer;
  }

  /**
   * Convert AudioBuffer to WAV blob
   * @param {AudioBuffer} buffer - Audio buffer
   * @returns {Blob} WAV blob
   */
  audioBufferToWav(buffer) {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;

    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const data = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      data.push(buffer.getChannelData(i));
    }

    const dataLength = data[0].length * numChannels * bytesPerSample;
    const bufferLength = 44 + dataLength;
    const arrayBuffer = new ArrayBuffer(bufferLength);
    const view = new DataView(arrayBuffer);

    // WAV header
    this.writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    this.writeString(view, 8, 'WAVE');
    this.writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    this.writeString(view, 36, 'data');
    view.setUint32(40, dataLength, true);

    // Write audio data
    let offset = 44;
    for (let i = 0; i < data[0].length; i++) {
      for (let channel = 0; channel < numChannels; channel++) {
        const sample = Math.max(-1, Math.min(1, data[channel][i]));
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Write string to DataView
   * @param {DataView} view - DataView
   * @param {number} offset - Offset
   * @param {string} string - String to write
   */
  writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  }

  /**
   * Create audio buffer with silence
   * @param {number} duration - Duration in seconds
   * @returns {AudioBuffer} Silent audio buffer
   */
  createSilence(duration) {
    const context = this.getAudioContext();
    const sampleRate = context.sampleRate;
    const numSamples = Math.floor(sampleRate * duration);

    return context.createBuffer(1, numSamples, sampleRate);
  }

  /**
   * Clean up resources
   */
  dispose() {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
