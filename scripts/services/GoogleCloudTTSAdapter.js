/**
 * Google Cloud Text-to-Speech Adapter
 * Implements dynamic voice discovery and full parameter support
 */

import { TTSEngineAdapter } from './TTSEngineAdapter.js';

export class GoogleCloudTTSAdapter extends TTSEngineAdapter {
  constructor() {
    super();
    this.apiKey = null;
    this.baseUrl = 'https://texttospeech.googleapis.com/v1';
    
    // Hardcoded defaults for immediate use (Phase 1)
    this.defaultCapabilities = {
      voices: [
        {
          name: 'en-US-Neural2-A',
          languageCodes: ['en-US'],
          ssmlGender: 'MALE',
          naturalSampleRateHertz: 24000,
        },
        {
          name: 'en-US-Neural2-C',
          languageCodes: ['en-US'],
          ssmlGender: 'FEMALE',
          naturalSampleRateHertz: 24000,
        },
        {
          name: 'en-US-Neural2-D',
          languageCodes: ['en-US'],
          ssmlGender: 'MALE',
          naturalSampleRateHertz: 24000,
        },
        {
          name: 'en-US-Neural2-E',
          languageCodes: ['en-US'],
          ssmlGender: 'FEMALE',
          naturalSampleRateHertz: 24000,
        },
      ],
      audioFormats: ['LINEAR16', 'MP3', 'OGG_OPUS'],
      parameters: {
        speakingRate: { min: 0.25, max: 4.0, default: 1.0 },
        pitch: { min: -20.0, max: 20.0, default: 0.0 },
        volumeGainDb: { min: -96.0, max: 16.0, default: 0.0 },
      },
    };
  }

  getName() {
    return 'Google Cloud TTS';
  }

  requiresApiKey() {
    return true;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
    // Clear cache when API key changes
    this.capabilitiesCache = null;
  }

  /**
   * Get capabilities - Phase 1: defaults, Phase 2: dynamic discovery
   * @returns {Promise<Object>} Engine capabilities
   */
  async getCapabilities() {
    // Phase 1: Return defaults if no API key
    if (!this.apiKey) {
      return this.defaultCapabilities;
    }

    // Phase 2: Fetch from API if we have a key (with caching)
    if (this.capabilitiesCache) {
      return this.capabilitiesCache;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/voices?key=${this.apiKey}`
      );

      if (!response.ok) {
        console.warn('Failed to fetch voices, using defaults');
        return this.defaultCapabilities;
      }

      const data = await response.json();

      this.capabilitiesCache = {
        voices: data.voices || [],
        audioFormats: ['LINEAR16', 'MP3', 'OGG_OPUS'],
        parameters: this.defaultCapabilities.parameters,
      };

      // Cache in localStorage for offline use
      try {
        localStorage.setItem(
          'google-tts-capabilities',
          JSON.stringify(this.capabilitiesCache)
        );
      } catch {
        console.warn('Failed to cache capabilities');
      }

      return this.capabilitiesCache;
    } catch {
      console.error('Error fetching capabilities');

      // Try to load from localStorage cache
      try {
        const cached = localStorage.getItem('google-tts-capabilities');
        if (cached) {
          this.capabilitiesCache = JSON.parse(cached);
          return this.capabilitiesCache;
        }
      } catch {
        // Ignore cache errors
      }

      return this.defaultCapabilities;
    }
  }

  /**
   * Validate API key by making a test request
   * @param {string} apiKey - API key to validate
   * @returns {Promise<boolean>} True if valid
   */
  async validateApiKey(apiKey) {
    try {
      const response = await fetch(`${this.baseUrl}/voices?key=${apiKey}`);
      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate speech using Google Cloud TTS API
   * @param {string} text - Text to speak
   * @param {Object} options - Generation options
   * @returns {Promise<Blob>} Audio blob
   */
  async generateSpeech(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('API key required for Google Cloud TTS');
    }

    if (!text || text === '*') {
      // Return silence
      return this.generateSilence(options.duration || 1);
    }

    // Build request body with Phase 3 parameters
    const requestBody = {
      input: { text },
      voice: {
        languageCode: options.languageCode || 'en-US',
        name: options.voiceName || 'en-US-Neural2-C',
        ssmlGender: options.ssmlGender || 'FEMALE',
      },
      audioConfig: {
        audioEncoding: options.audioEncoding || 'LINEAR16',
        speakingRate: options.speakingRate || 1.0,
        pitch: options.pitch || 0.0,
        volumeGainDb: options.volumeGainDb || 0.0,
        sampleRateHertz: options.sampleRateHertz || 24000,
      },
    };

    const response = await fetch(`${this.baseUrl}/text:synthesize?key=${this.apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(
        `Google Cloud TTS API error: ${error.error?.message || response.statusText}`
      );
    }

    const data = await response.json();

    // Convert base64 audio to blob
    const audioContent = data.audioContent;
    const binaryString = atob(audioContent);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    return new Blob([bytes], { type: 'audio/wav' });
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
