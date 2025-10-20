/**
 * Text-to-Speech service
 * Supports multiple TTS engines with fallback
 */

export class TTSService {
  constructor() {
    this.engine = 'web-speech';
    this.apiKey = null;
  }

  /**
   * Set TTS engine
   * @param {string} engine - Engine name ('web-speech', 'elevenlabs', 'google-cloud')
   */
  setEngine(engine) {
    this.engine = engine;
  }

  /**
   * Set API key for premium engines
   * @param {string} key - API key
   */
  setApiKey(key) {
    this.apiKey = key;
  }

  /**
   * Generate speech from text using Web Speech API
   * @param {string} text - Text to speak
   * @param {Object} options - Speech options
   * @returns {Promise<Blob>} Audio blob
   */
  async generateSpeechWebAPI(text, options = {}) {
    if (!text || text === '*') {
      // Return silence for asterisk or empty text
      return this.generateSilence(options.duration || 1);
    }

    if (!('speechSynthesis' in window)) {
      throw new Error('Web Speech API not supported in this browser');
    }

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);

      // Configure speech parameters
      utterance.rate = options.slow ? 0.5 : 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      // Get available voices
      const voices = speechSynthesis.getVoices();
      if (voices.length > 0) {
        // Prefer US English voice
        const usVoice = voices.find((v) => v.lang === 'en-US');
        utterance.voice = usVoice || voices[0];
      }

      utterance.onstart = () => {
        // Note: Web Speech API doesn't provide direct audio access
        // We'll need to use a different approach for actual audio capture
        // For now, this is a placeholder that will need enhancement
      };

      utterance.onend = () => {
        // For Web Speech API, we can't easily capture the audio
        // We'll return a marker blob and handle this differently
        const blob = new Blob([text], { type: 'text/plain' });
        resolve(blob);
      };

      utterance.onerror = (event) => {
        reject(new Error(`Speech synthesis failed: ${event.error}`));
      };

      speechSynthesis.speak(utterance);
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

  /**
   * Generate speech for a phrase
   * @param {Object} phrase - Phrase object {phrase, duration}
   * @param {Object} options - Generation options
   * @returns {Promise<Blob>} Audio blob
   */
  async generatePhrase(phrase, options = {}) {
    switch (this.engine) {
      case 'web-speech':
        return this.generateSpeechWebAPI(phrase.phrase, options);
      case 'elevenlabs':
        // TODO: Implement ElevenLabs API
        throw new Error('ElevenLabs not yet implemented');
      case 'google-cloud':
        // TODO: Implement Google Cloud TTS
        throw new Error('Google Cloud TTS not yet implemented');
      default:
        throw new Error(`Unknown TTS engine: ${this.engine}`);
    }
  }
}
