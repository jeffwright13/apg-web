/**
 * Audio processing service
 * Handles audio mixing, effects, and export
 */

export class AudioService {
  constructor() {
    this.audioContext = null;
    this.encodingCancelled = false;
    
    // EQ state
    this.eqEnabled = false;
    this.eqFilters = null;
    this.sourceNode = null;
    this.gainNode = null;
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
    
    // Validate input
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error('Cannot decode empty audio buffer');
    }
    
    // Log buffer info for debugging
    // eslint-disable-next-line no-console
    console.log('🎵 Decoding audio buffer:', {
      size: arrayBuffer.byteLength,
      type: arrayBuffer.constructor.name
    });
    
    try {
      return await context.decodeAudioData(arrayBuffer);
    } catch (error) {
      // Log the first few bytes to help diagnose the issue
      const bytes = new Uint8Array(arrayBuffer.slice(0, 16));
      const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join(' ');
      console.error('❌ Failed to decode audio buffer');
      console.error('Buffer size:', arrayBuffer.byteLength, 'bytes');
      console.error('First 16 bytes (hex):', hex);
      console.error('Decode error:', error.message);
      throw new Error(`Audio decode failed: ${error.message}. Buffer may be corrupted or invalid format.`);
    }
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
   * Check if lamejs library is available
   * @returns {boolean} True if lamejs is loaded
   */
  isLameAvailable() {
    return typeof lamejs !== 'undefined';
  }

  /**
   * Convert AudioBuffer to MP3 blob
   * @param {AudioBuffer} buffer - Audio buffer
   * @param {number} bitrate - MP3 bitrate (128, 192, 256, 320)
   * @param {Function} onProgress - Progress callback (percent)
   * @returns {Promise<Blob>} MP3 blob
   */
  async audioBufferToMP3(buffer, bitrate = 192, onProgress = null) {
    // Check if lamejs is available
    if (!this.isLameAvailable()) {
      throw new Error('MP3 encoder not available. Please check your internet connection and reload the page.');
    }

    // Reset cancellation flag
    this.encodingCancelled = false;

    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const samples = buffer.length;

    // Create MP3 encoder
    const mp3encoder = new lamejs.Mp3Encoder(numChannels, sampleRate, bitrate);

    // Convert float samples to 16-bit PCM
    const left = this.floatTo16BitPCM(buffer.getChannelData(0));
    const right = numChannels > 1 ? this.floatTo16BitPCM(buffer.getChannelData(1)) : null;

    // Encode in chunks
    const mp3Data = [];
    const blockSize = 1152; // MP3 frame size
    const totalBlocks = Math.ceil(samples / blockSize);

    for (let i = 0; i < samples; i += blockSize) {
      // Check for cancellation
      if (this.encodingCancelled) {
        throw new Error('MP3 encoding cancelled by user');
      }

      const leftChunk = left.subarray(i, i + blockSize);
      const rightChunk = right ? right.subarray(i, i + blockSize) : null;

      // Encode chunk
      let mp3buf;
      if (numChannels === 1) {
        mp3buf = mp3encoder.encodeBuffer(leftChunk);
      } else {
        mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
      }

      if (mp3buf.length > 0) {
        mp3Data.push(new Int8Array(mp3buf));
      }

      // Report progress
      if (onProgress) {
        const currentBlock = Math.floor(i / blockSize) + 1;
        const progress = Math.floor((currentBlock / totalBlocks) * 100);
        onProgress(progress);
      }

      // Yield to UI thread periodically
      if (i % (blockSize * 10) === 0) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    // Check for cancellation before flush
    if (this.encodingCancelled) {
      throw new Error('MP3 encoding cancelled by user');
    }

    // Flush encoder
    const mp3buf = mp3encoder.flush();
    if (mp3buf.length > 0) {
      mp3Data.push(new Int8Array(mp3buf));
    }

    // Report completion
    if (onProgress) {
      onProgress(100);
    }

    return new Blob(mp3Data, { type: 'audio/mp3' });
  }

  /**
   * Convert Float32Array to Int16Array (PCM)
   * @param {Float32Array} input - Float samples (-1.0 to 1.0)
   * @returns {Int16Array} 16-bit PCM samples
   */
  floatTo16BitPCM(input) {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    return output;
  }

  /**
   * Cancel ongoing MP3 encoding
   */
  cancelEncoding() {
    this.encodingCancelled = true;
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
   * Initialize 3-band parametric EQ for audio player
   * @param {HTMLAudioElement} audioElement - Audio element to apply EQ to
   * @returns {Object} EQ filters object with low, mid, high bands
   */
  initializeEQ(audioElement) {
    const context = this.getAudioContext();
    
    // Disconnect existing nodes if any
    this.disconnectEQ();
    
    // Create source from audio element
    this.sourceNode = context.createMediaElementSource(audioElement);
    
    // Create 3-band EQ using BiquadFilter nodes
    const lowShelf = context.createBiquadFilter();
    lowShelf.type = 'lowshelf';
    lowShelf.frequency.value = 100; // Hz
    lowShelf.gain.value = 0; // dB
    
    const midPeak = context.createBiquadFilter();
    midPeak.type = 'peaking';
    midPeak.frequency.value = 1000; // Hz
    midPeak.Q.value = 1.0; // Bandwidth
    midPeak.gain.value = 0; // dB
    
    const highShelf = context.createBiquadFilter();
    highShelf.type = 'highshelf';
    highShelf.frequency.value = 3000; // Hz
    highShelf.gain.value = 0; // dB
    
    // Create gain node for overall volume control
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 1.0;
    
    // Connect the chain: source -> low -> mid -> high -> gain -> destination
    this.sourceNode.connect(lowShelf);
    lowShelf.connect(midPeak);
    midPeak.connect(highShelf);
    highShelf.connect(this.gainNode);
    this.gainNode.connect(context.destination);
    
    this.eqFilters = {
      low: lowShelf,
      mid: midPeak,
      high: highShelf
    };
    
    this.eqEnabled = true;
    
    return this.eqFilters;
  }
  
  /**
   * Update EQ band gain
   * @param {string} band - 'low', 'mid', or 'high'
   * @param {number} gainDb - Gain in decibels (-12 to +12)
   */
  setEQGain(band, gainDb) {
    if (!this.eqFilters || !this.eqFilters[band]) {
      console.warn('EQ not initialized');
      return;
    }
    
    this.eqFilters[band].gain.value = gainDb;
  }
  
  /**
   * Reset all EQ bands to 0 dB (flat response)
   */
  resetEQ() {
    if (!this.eqFilters) return;
    
    this.eqFilters.low.gain.value = 0;
    this.eqFilters.mid.gain.value = 0;
    this.eqFilters.high.gain.value = 0;
  }
  
  /**
   * Disconnect EQ nodes
   */
  disconnectEQ() {
    if (this.sourceNode) {
      try {
        this.sourceNode.disconnect();
      } catch {
        // Already disconnected
      }
      this.sourceNode = null;
    }
    
    if (this.eqFilters) {
      try {
        this.eqFilters.low.disconnect();
        this.eqFilters.mid.disconnect();
        this.eqFilters.high.disconnect();
      } catch {
        // Already disconnected
      }
      this.eqFilters = null;
    }
    
    if (this.gainNode) {
      try {
        this.gainNode.disconnect();
      } catch {
        // Already disconnected
      }
      this.gainNode = null;
    }
    
    this.eqEnabled = false;
  }

  /**
   * Clean up resources
   */
  dispose() {
    this.disconnectEQ();
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
