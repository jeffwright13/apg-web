/**
 * gTTS (Google Translate TTS) Adapter
 * Uses the free Google Translate TTS endpoint (same as Python gTTS library)
 * No API key required
 */

import { TTSEngineAdapter } from './TTSEngineAdapter.js';

export class GTTSAdapter extends TTSEngineAdapter {
  constructor() {
    super();
    this.baseUrl = 'https://translate.google.com/translate_tts';
    
    // Available accents/regions (same as Python gTTS)
    this.accents = {
      AU: { tld: 'com.au', name: 'Australia' },
      CA: { tld: 'ca', name: 'Canada' },
      IE: { tld: 'ie', name: 'Ireland' },
      IN: { tld: 'co.in', name: 'India' },
      UK: { tld: 'co.uk', name: 'United Kingdom' },
      US: { tld: 'com', name: 'United States' },
      ZA: { tld: 'co.za', name: 'South Africa' },
    };
  }

  getName() {
    return 'Google Translate TTS (gTTS)';
  }

  requiresApiKey() {
    return false;
  }

  /**
   * Get capabilities - returns available accents
   * @returns {Promise<Object>} Engine capabilities
   */
  async getCapabilities() {
    return {
      accents: this.accents,
      languages: ['en'], // Currently only English
      parameters: {
        slow: { type: 'boolean', default: false },
      },
    };
  }

  /**
   * Generate speech using Google Translate TTS
   * @param {string} text - Text to speak
   * @param {Object} options - Generation options
   * @returns {Promise<Blob>} Audio blob
   */
  async generateSpeech(text, options = {}) {
    if (!text || text === '*') {
      // Return silence
      return this.generateSilence(options.duration || 1);
    }

    const tld = options.tld || 'com';
    const lang = options.lang || 'en';
    const slow = options.slow || false;

    // Build URL with parameters
    const params = new URLSearchParams({
      ie: 'UTF-8',
      q: text,
      tl: lang,
      ttsspeed: slow ? '0.24' : '1',
      client: 'tw-ob',
      tld: tld,
    });

    const url = `${this.baseUrl}?${params.toString()}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`gTTS request failed: ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      return audioBlob;
    } catch (error) {
      throw new Error(`Failed to generate speech with gTTS: ${error.message}`);
    }
  }

  /**
   * Generate silence audio
   * @param {number} duration - Duration in seconds
   * @returns {Promise<Blob>} Silent audio blob
   */
  async generateSilence(duration) {
    const sampleRate = 24000;
    const numChannels = 1;
    const numSamples = Math.floor(sampleRate * duration);

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const audioBuffer = audioContext.createBuffer(
      numChannels,
      numSamples,
      sampleRate
    );

    // Convert to WAV
    const wavBlob = this.audioBufferToWav(audioBuffer);
    audioContext.close();

    return wavBlob;
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
}
