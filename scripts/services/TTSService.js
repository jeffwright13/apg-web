/**
 * Text-to-Speech service
 * Supports multiple TTS engines with adapter pattern
 */

import { GoogleCloudTTSAdapter } from './GoogleCloudTTSAdapter.js';
import { GTTSAdapter } from './GTTSAdapter.js';
import { OpenAITTSAdapter } from './OpenAITTSAdapter.js';

export class TTSService {
  constructor() {
    this.engine = 'google-cloud';
    this.cancelRequested = false;
    this.isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    
    // Initialize adapters
    this.adapters = {
      'gtts': new GTTSAdapter(),
      'google-cloud': new GoogleCloudTTSAdapter(),
      'openai': new OpenAITTSAdapter(),
    };
    
    // Load API key from localStorage
    this.loadApiKey();
  }

  /**
   * Load API key from localStorage
   */
  loadApiKey() {
    try {
      // Load Google Cloud API key
      const googleApiKey = localStorage.getItem('google-cloud-tts-api-key');
      if (googleApiKey && this.adapters['google-cloud']) {
        this.adapters['google-cloud'].setApiKey(googleApiKey);
      }
      
      // Load OpenAI API key
      const openaiApiKey = localStorage.getItem('openai-tts-api-key');
      if (openaiApiKey && this.adapters['openai']) {
        this.adapters['openai'].setApiKey(openaiApiKey);
      }
    } catch (e) {
      console.warn('Failed to load API key from localStorage', e);
    }
  }

  /**
   * Save API key to localStorage
   * @param {string} apiKey - API key
   * @param {string} engine - Engine name (optional, defaults to current engine)
   */
  saveApiKey(apiKey, engine = null) {
    const targetEngine = engine || this.engine;
    
    try {
      if (targetEngine === 'google-cloud') {
        localStorage.setItem('google-cloud-tts-api-key', apiKey);
        if (this.adapters['google-cloud']) {
          this.adapters['google-cloud'].setApiKey(apiKey);
        }
      } else if (targetEngine === 'openai') {
        localStorage.setItem('openai-tts-api-key', apiKey);
        if (this.adapters['openai']) {
          this.adapters['openai'].setApiKey(apiKey);
        }
      }
    } catch (e) {
      console.warn('Failed to save API key to localStorage', e);
    }
  }

  /**
   * Get current adapter
   * @returns {TTSEngineAdapter} Current adapter
   */
  getCurrentAdapter() {
    return this.adapters[this.engine];
  }

  /**
   * Set TTS engine
   * @param {string} engine - Engine name ('web-speech', 'elevenlabs', 'google-cloud')
   */
  setEngine(engine) {
    this.engine = engine;
  }

  /**
   * Generate speech for a phrase using current engine
   * @param {Object} phrase - Phrase object {phrase, duration}
   * @param {Object} options - Generation options
   * @returns {Promise<Blob>} Audio blob
   */
  async generatePhrase(phrase, options = {}) {
    if (this.engine === 'web-speech') {
      // Web Speech API handled separately (playback only)
      return this.generateSpeechWebAPI(phrase.phrase, options);
    }

    // Use adapter for other engines
    const adapter = this.getCurrentAdapter();
    if (!adapter) {
      throw new Error(`No adapter found for engine: ${this.engine}`);
    }

    return adapter.generateSpeech(phrase.phrase, options);
  }

  /**
   * Get capabilities for current engine
   * @returns {Promise<Object>} Engine capabilities
   */
  async getCapabilities() {
    const adapter = this.getCurrentAdapter();
    if (!adapter) {
      return null;
    }
    return adapter.getCapabilities();
  }

  /**
   * Validate API key for current engine
   * @param {string} apiKey - API key to validate
   * @returns {Promise<boolean>} True if valid
   */
  async validateApiKey(apiKey) {
    const adapter = this.getCurrentAdapter();
    if (!adapter || !adapter.requiresApiKey()) {
      return true;
    }
    return adapter.validateApiKey(apiKey);
  }

  /**
   * Generate speech from text using Web Speech API
   * Note: Web Speech API plays directly through speakers, doesn't return audio data
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   * @returns {Promise<SpeechSynthesisUtterance>} Utterance object (for playback only)
   */
  async generateSpeechWebAPI(text, options = {}) {
    if (!text || text === '*') {
      // Return null for silence - will be handled separately
      return null;
    }

    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API not supported in this browser');
    }

    const utterance = new SpeechSynthesisUtterance(text);

    // Configure speech parameters
    utterance.rate = options.slow ? 0.5 : 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Get available voices - prefer local/native voices over remote
    const voices = speechSynthesis.getVoices();
    if (voices.length > 0) {
      let selectedVoice;

      if (this.isFirefox) {
        // Firefox-specific: ONLY use local voices, avoid remote at all costs
        selectedVoice =
          voices.find((v) => v.lang === 'en-US' && v.localService) ||
          voices.find((v) => v.lang.startsWith('en-') && v.localService) ||
          // If no local voice found, use first available (fallback)
          voices[0];
      } else {
        // Chrome/Safari: Any voice works fine
        selectedVoice =
          voices.find((v) => v.lang === 'en-US') ||
          voices.find((v) => v.lang.startsWith('en-')) ||
          voices[0];
      }

      utterance.voice = selectedVoice;
    }

    return utterance;
  }

  /**
   * Play phrases sequentially using Web Speech API
   * @param {Array} phrases - Array of phrase objects
   * @param {Object} options - Playback options
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<void>}
   */
  async playPhrasesWebAPI(phrases, options = {}, onProgress = null) {
    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API not supported in this browser');
    }

    // Reset cancellation flag
    this.cancelRequested = false;

    // Cancel any ongoing speech
    speechSynthesis.cancel();

    // Wait for voices to load (Firefox fix)
    await this.ensureVoicesLoaded();

    for (let i = 0; i < phrases.length; i++) {
      // Check for cancellation
      if (this.cancelRequested) {
        throw new Error('Playback stopped by user');
      }

      const phrase = phrases[i];

      if (onProgress) {
        onProgress(i + 1, phrases.length);
      }

      // Handle silence
      if (phrase.phrase === '*' || !phrase.phrase) {
        await this.sleepCancellable(phrase.duration * 1000);
        continue;
      }

      // Generate and speak utterance
      const utterance = await this.generateSpeechWebAPI(phrase.phrase, options);

      await new Promise((resolve, reject) => {
        // Check for cancellation before speaking
        if (this.cancelRequested) {
          reject(new Error('Playback stopped by user'));
          return;
        }

        let hasEnded = false;

        utterance.onend = () => {
          if (!hasEnded) {
            hasEnded = true;
            // Firefox needs even longer delays to prevent audio artifacts
            const delay = this.isFirefox ? 500 : 100;
            setTimeout(resolve, delay);
          }
        };

        utterance.onerror = (event) => {
          if (!hasEnded) {
            hasEnded = true;
            reject(new Error(`Speech synthesis failed: ${event.error}`));
          }
        };

        // Clear the queue before speaking to prevent stacking
        speechSynthesis.cancel();

        // Firefox needs longer delay before speaking to ensure clean start
        const startDelay = this.isFirefox ? 200 : 50;
        setTimeout(() => {
          if (this.cancelRequested) {
            reject(new Error('Playback stopped by user'));
            return;
          }
          speechSynthesis.speak(utterance);
        }, startDelay);

        // Firefox workaround: resume if paused
        const resumeInterval = setInterval(() => {
          // Check for cancellation in interval
          if (this.cancelRequested) {
            clearInterval(resumeInterval);
            speechSynthesis.cancel();
            if (!hasEnded) {
              hasEnded = true;
              reject(new Error('Playback stopped by user'));
            }
            return;
          }

          if (speechSynthesis.paused) {
            speechSynthesis.resume();
          }
          if (!speechSynthesis.speaking) {
            clearInterval(resumeInterval);
          }
        }, 100);
      });

      // Add pause after phrase
      if (phrase.duration > 0) {
        await this.sleepCancellable(phrase.duration * 1000);
      }
    }
  }

  /**
   * Ensure voices are loaded before use
   * @returns {Promise<void>}
   */
  async ensureVoicesLoaded() {
    return new Promise((resolve) => {
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve();
        return;
      }

      // Wait for voices to load
      speechSynthesis.onvoiceschanged = () => {
        resolve();
      };

      // Timeout fallback
      setTimeout(resolve, 1000);
    });
  }

  /**
   * Stop any ongoing speech
   */
  stopSpeech() {
    this.cancelRequested = true;
    if ('speechSynthesis' in window) {
      speechSynthesis.cancel();
    }
  }

  /**
   * Sleep utility
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Sleep with cancellation support
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleepCancellable(ms) {
    return new Promise((resolve, reject) => {
      const checkInterval = 100;
      let elapsed = 0;

      const intervalId = setInterval(() => {
        if (this.cancelRequested) {
          clearInterval(intervalId);
          reject(new Error('Playback stopped by user'));
          return;
        }

        elapsed += checkInterval;
        if (elapsed >= ms) {
          clearInterval(intervalId);
          resolve();
        }
      }, checkInterval);
    });
  }

  /**
   * Generate silence audio
   * @param {number} duration - Duration in seconds
   * @returns {Promise<Blob>} Silent audio blob
   */
  async generateSilence(duration) {
    // Create silent audio using Web Audio API
    const sampleRate = 44100;
    const numChannels = 1;
    const numSamples = sampleRate * duration;

    const audioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
    const audioBuffer = audioContext.createBuffer(
      numChannels,
      numSamples,
      sampleRate
    );

    // Buffer is already silent (zeros)

    // Convert to WAV blob
    const wavBlob = await this.audioBufferToWav(audioBuffer);
    audioContext.close();

    return wavBlob;
  }

  /**
   * Convert AudioBuffer to WAV blob
   * @param {AudioBuffer} buffer - Audio buffer
   * @returns {Promise<Blob>} WAV blob
   */
  async audioBufferToWav(buffer) {
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
    view.setUint32(16, 16, true); // fmt chunk size
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
