/**
 * Base TTS Engine Adapter
 * Defines interface for all TTS engines
 */

export class TTSEngineAdapter {
  constructor() {
    this.capabilities = null;
    this.capabilitiesCache = null;
  }

  /**
   * Get engine capabilities (voices, parameters, etc.)
   * @returns {Promise<Object>} Engine capabilities
   */
  async getCapabilities() {
    throw new Error('getCapabilities must be implemented by subclass');
  }

  /**
   * Generate speech from text
   * @param {string} _text - Text to speak
   * @param {Object} _options - Generation options
   * @returns {Promise<Blob>} Audio blob
   */
  async generateSpeech(_text, _options) {
    throw new Error('generateSpeech must be implemented by subclass');
  }

  /**
   * Get engine name
   * @returns {string} Engine name
   */
  getName() {
    throw new Error('getName must be implemented by subclass');
  }

  /**
   * Check if engine requires API key
   * @returns {boolean} True if API key required
   */
  requiresApiKey() {
    return false;
  }

  /**
   * Validate API key
   * @param {string} _apiKey - API key to validate
   * @returns {Promise<boolean>} True if valid
   */
  async validateApiKey(_apiKey) {
    return true;
  }
}
