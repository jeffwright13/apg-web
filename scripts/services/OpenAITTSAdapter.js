/**
 * OpenAI Text-to-Speech Adapter
 * Implements TTS-1 and TTS-1-HD models with 6 preset voices
 */

import { TTSEngineAdapter } from './TTSEngineAdapter.js';

export class OpenAITTSAdapter extends TTSEngineAdapter {
  constructor() {
    super();
    this.apiKey = null;
    this.baseUrl = 'https://api.openai.com/v1';

    // OpenAI TTS capabilities
    this.defaultCapabilities = {
      voices: [
        {
          id: 'alloy',
          name: 'Alloy',
          description: 'Neutral and balanced',
          gender: 'neutral',
        },
        {
          id: 'echo',
          name: 'Echo',
          description: 'Male voice',
          gender: 'male',
        },
        {
          id: 'fable',
          name: 'Fable',
          description: 'British male voice',
          gender: 'male',
        },
        {
          id: 'onyx',
          name: 'Onyx',
          description: 'Deep male voice',
          gender: 'male',
        },
        {
          id: 'nova',
          name: 'Nova',
          description: 'Female voice, warm and friendly',
          gender: 'female',
        },
        {
          id: 'shimmer',
          name: 'Shimmer',
          description: 'Female voice, soft and gentle',
          gender: 'female',
        },
      ],
      models: [
        {
          id: 'tts-1',
          name: 'TTS-1',
          description: 'Standard quality, optimized for speed',
          pricing: '$15.00 per 1M characters',
        },
        {
          id: 'tts-1-hd',
          name: 'TTS-1-HD',
          description: 'High definition quality',
          pricing: '$30.00 per 1M characters',
        },
      ],
      audioFormats: ['mp3', 'opus', 'aac', 'flac', 'wav', 'pcm'],
      parameters: {
        speed: { min: 0.25, max: 4.0, default: 1.0 },
      },
    };
  }

  getName() {
    return 'OpenAI TTS';
  }

  requiresApiKey() {
    return true;
  }

  setApiKey(apiKey) {
    this.apiKey = apiKey;
  }

  /**
   * Get capabilities
   * @returns {Promise<Object>} Engine capabilities
   */
  async getCapabilities() {
    return this.defaultCapabilities;
  }

  /**
   * Validate API key by making a test request
   * @param {string} apiKey - API key to validate
   * @returns {Promise<boolean>} True if valid
   */
  async validateApiKey(apiKey) {
    try {
      // Make a minimal test request
      const response = await fetch(`${this.baseUrl}/audio/speech`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: 'test',
          voice: 'alloy',
        }),
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  /**
   * Generate speech using OpenAI TTS API
   * @param {string} text - Text to speak
   * @param {Object} options - Generation options
   * @returns {Promise<Blob>} Audio blob
   */
  async generateSpeech(text, options = {}) {
    if (!this.apiKey) {
      throw new Error('API key required for OpenAI TTS');
    }

    if (!text || text === '*') {
      // Return silence
      return this.generateSilence(options.duration || 1);
    }

    // Build request body
    const requestBody = {
      model: options.model || 'tts-1', // tts-1 or tts-1-hd
      input: text,
      voice: options.voice || 'nova', // alloy, echo, fable, onyx, nova, shimmer
      response_format: options.format || 'wav', // mp3, opus, aac, flac, wav, pcm
      speed: options.speed || 1.0, // 0.25 to 4.0
    };

    const response = await fetch(`${this.baseUrl}/audio/speech`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = response.statusText;

      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error?.message || errorMessage;
      } catch {
        // If not JSON, use the text as-is
        errorMessage = errorText || errorMessage;
      }

      throw new Error(`OpenAI TTS API error: ${errorMessage}`);
    }

    // Response is already an audio blob
    const audioBlob = await response.blob();

    // Ensure correct MIME type
    const mimeType = this.getMimeType(requestBody.response_format);
    return new Blob([audioBlob], { type: mimeType });
  }

  /**
   * Get MIME type for audio format
   * @param {string} format - Audio format
   * @returns {string} MIME type
   */
  getMimeType(format) {
    const mimeTypes = {
      mp3: 'audio/mpeg',
      opus: 'audio/opus',
      aac: 'audio/aac',
      flac: 'audio/flac',
      wav: 'audio/wav',
      pcm: 'audio/pcm',
    };
    return mimeTypes[format] || 'audio/wav';
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
