/**
 * Main application controller
 * Orchestrates the audio generation workflow
 */

import { FileService } from '../services/FileService.js';
import { TTSService } from '../services/TTSService.js';
import { AudioService } from '../services/AudioService.js';
import { TTSCacheService } from '../services/TTSCacheService.js';
import { parseTextFile } from '../utils/parser.js';

export class AppController {
  constructor() {
    this.form = null;
    this.generateBtn = null;
    this.outputSection = null;
    this.progressContainer = null;
    this.audioPlayer = null;
    this.downloadBtn = null;
    this.playBtn = null;
    this.stopBtn = null;

    // Services
    this.fileService = new FileService();
    this.ttsService = new TTSService();
    this.audioService = new AudioService();
    this.cacheService = new TTSCacheService();

    // State
    this.currentAudioBlob = null;
    this.currentAudioBuffer = null;
    this.currentPhrases = null;
    this.currentOptions = null;
    this.isPlaying = false;
  }

  async initialize() {
    this.form = document.getElementById('apg-form');
    this.generateBtn = document.getElementById('generate-btn');
    this.outputSection = document.getElementById('output-section');
    this.progressContainer = document.getElementById('progress-container');
    this.audioPlayer = document.getElementById('audio-player');
    this.downloadBtn = document.getElementById('download-btn');
    this.playBtn = document.getElementById('play-btn');
    this.stopBtn = document.getElementById('stop-btn');

    this.attachEventListeners();
    
    // Initialize cache in background (don't block app startup)
    this.initializeCache();
  }

  async initializeCache() {
    try {
      await this.cacheService.init();
      await this.cacheService.pruneCache();
      
      // Log cache stats
      const stats = await this.cacheService.getStats();
      // eslint-disable-next-line no-console
      console.log(`📦 TTS Cache: ${stats.count} snippets, ${stats.totalSizeMB} MB`);
    } catch (error) {
      console.warn('Cache initialization failed (caching disabled):', error);
    }
  }

  /**
   * Handle clear cache button click
   */
  async handleClearCache() {
    if (!confirm('Clear all cached TTS audio? This will force regeneration of all phrases on next use.')) {
      return;
    }

    try {
      await this.cacheService.clear();
      const stats = await this.cacheService.getStats();
      // eslint-disable-next-line no-console
      console.log(`✅ Cache cleared! Now: ${stats.count} snippets, ${stats.totalSizeMB} MB`);
      alert('Cache cleared successfully!');
    } catch (error) {
      console.error('Failed to clear cache:', error);
      alert('Failed to clear cache. Check console for details.');
    }
  }

  attachEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.downloadBtn.addEventListener('click', () => this.handleDownload());

    if (this.playBtn) {
      this.playBtn.addEventListener('click', () => this.handlePlay());
    }

    if (this.stopBtn) {
      this.stopBtn.addEventListener('click', () => this.handleStop());
    }

    // Clear individual file inputs
    const clearPhraseBtn = document.getElementById('clear-phrase-btn');
    if (clearPhraseBtn) {
      clearPhraseBtn.addEventListener('click', () => {
        const phraseInput = document.getElementById('phrase-file');
        phraseInput.value = '';
      });
    }

    const clearSoundBtn = document.getElementById('clear-sound-btn');
    if (clearSoundBtn) {
      clearSoundBtn.addEventListener('click', () => {
        const soundInput = document.getElementById('sound-file');
        soundInput.value = '';
      });
    }

    // Clear TTS cache
    const clearCacheBtn = document.getElementById('clear-cache-btn');
    if (clearCacheBtn) {
      clearCacheBtn.addEventListener('click', () => this.handleClearCache());
    }

    // Show/hide browser warning and settings based on TTS engine selection
    const ttsEngineSelect = document.getElementById('tts-engine');
    if (ttsEngineSelect) {
      ttsEngineSelect.addEventListener('change', (e) => {
        this.updateEngineUI(e.target.value);
      });
      // Set initial state
      this.updateEngineUI(ttsEngineSelect.value);
    }

    // Save API key buttons
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    if (saveApiKeyBtn) {
      saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey('google-cloud'));
    }

    const saveOpenAIKeyBtn = document.getElementById('save-openai-key-btn');
    if (saveOpenAIKeyBtn) {
      saveOpenAIKeyBtn.addEventListener('click', () => this.handleSaveApiKey('openai'));
    }

    // Load saved API keys
    this.loadSavedApiKey();

    // Update slider value displays
    this.setupSliderValueDisplays();

    // Setup theme switcher
    this.setupThemeSwitcher();

    // Setup export format selector
    this.setupExportFormatSelector();
  }

  setupSliderValueDisplays() {
    const sliders = [
      { id: 'speaking-rate', valueId: 'speaking-rate-value' },
      { id: 'pitch', valueId: 'pitch-value' },
      { id: 'volume-gain', valueId: 'volume-gain-value' },
      { id: 'openai-speed', valueId: 'openai-speed-value' },
      { id: 'web-speech-rate', valueId: 'web-speech-rate-value' },
      { id: 'web-speech-pitch', valueId: 'web-speech-pitch-value' },
      { id: 'web-speech-volume', valueId: 'web-speech-volume-value' },
    ];

    sliders.forEach(({ id, valueId }) => {
      const slider = document.getElementById(id);
      const valueDisplay = document.getElementById(valueId);
      if (slider && valueDisplay) {
        slider.addEventListener('input', (e) => {
          valueDisplay.textContent = e.target.value;
        });
      }
    });
  }

  setupThemeSwitcher() {
    const themeSelect = document.getElementById('theme-select');
    if (!themeSelect) return;

    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'auto';
    themeSelect.value = savedTheme;
    this.applyTheme(savedTheme);

    // Listen for theme changes
    themeSelect.addEventListener('change', (e) => {
      const theme = e.target.value;
      localStorage.setItem('theme', theme);
      this.applyTheme(theme);
    });

    // Listen for system theme changes when in auto mode
    if (window.matchMedia) {
      window
        .matchMedia('(prefers-color-scheme: dark)')
        .addEventListener('change', () => {
          if (themeSelect.value === 'auto') {
            this.applyTheme('auto');
          }
        });
    }
  }

  applyTheme(theme) {
    const html = document.documentElement;

    if (theme === 'auto') {
      // Remove explicit theme, let system preference decide
      html.removeAttribute('data-theme');
    } else if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
    } else if (theme === 'dark') {
      html.setAttribute('data-theme', 'dark');
    }
  }

  setupExportFormatSelector() {
    const formatSelect = document.getElementById('export-format');
    const bitrateContainer = document.getElementById('mp3-bitrate-container');
    
    if (!formatSelect || !bitrateContainer) return;

    // Show/hide bitrate selector based on format
    const updateBitrateVisibility = () => {
      const format = formatSelect.value;
      bitrateContainer.style.display = format === 'mp3' ? 'block' : 'none';
    };

    // Set initial state
    updateBitrateVisibility();

    // Listen for format changes
    formatSelect.addEventListener('change', updateBitrateVisibility);
  }

  updateEngineUI(engine) {
    const warning = document.getElementById('browser-warning');
    const gttsSettings = document.getElementById('gtts-settings');
    const googleSettings = document.getElementById('google-cloud-settings');
    const openaiSettings = document.getElementById('openai-settings');
    const webSpeechSettings = document.getElementById('web-speech-settings');
    const soundFileInput = document.getElementById('sound-file');
    const clearSoundBtn = document.getElementById('clear-sound-btn');
    const soundFileHelp = document.getElementById('sound-file-help');
    const audioMixingSettings = document.getElementById('audio-mixing-settings');

    // Show/hide browser warning
    if (warning) {
      warning.style.display = engine === 'web-speech' ? 'block' : 'none';
    }

    // Show/hide engine-specific settings
    if (gttsSettings) {
      gttsSettings.style.display = engine === 'gtts' ? 'block' : 'none';
    }

    if (googleSettings) {
      googleSettings.style.display =
        engine === 'google-cloud' ? 'block' : 'none';
    }

    if (openaiSettings) {
      openaiSettings.style.display = engine === 'openai' ? 'block' : 'none';
    }

    if (webSpeechSettings) {
      webSpeechSettings.style.display = engine === 'web-speech' ? 'block' : 'none';
      // Load voices when Web Speech API is selected
      if (engine === 'web-speech') {
        this.loadWebSpeechVoices();
      }
    }

    // Disable background sound and audio mixing for Web Speech API (no export support)
    const isWebSpeech = engine === 'web-speech';
    
    if (soundFileInput) {
      soundFileInput.disabled = isWebSpeech;
      if (isWebSpeech) {
        soundFileInput.value = ''; // Clear any selected file
      }
    }

    if (clearSoundBtn) {
      clearSoundBtn.disabled = isWebSpeech;
    }

    if (soundFileHelp) {
      soundFileHelp.textContent = isWebSpeech
        ? 'Not available (Web Speech API does not support mixing)'
        : 'Optional audio file (MP3, WAV, OGG, M4A, etc.)';
    }

    // Hide audio mixing settings for Web Speech API (no export/mixing support)
    if (audioMixingSettings) {
      audioMixingSettings.style.display = isWebSpeech ? 'none' : 'block';
    }
  }

  async handleSaveApiKey(engine) {
    let apiKeyInput;
    
    if (engine === 'google-cloud') {
      apiKeyInput = document.getElementById('google-api-key');
    } else if (engine === 'openai') {
      apiKeyInput = document.getElementById('openai-api-key');
    }
    
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }

    // Temporarily set engine to validate
    const currentEngine = this.ttsService.engine;
    this.ttsService.setEngine(engine);

    // Validate API key
    this.updateProgress(0, 'Validating API key...');
    const isValid = await this.ttsService.validateApiKey(apiKey);

    if (!isValid) {
      alert('Invalid API key. Please check and try again.');
      this.updateProgress(0, '');
      this.ttsService.setEngine(currentEngine);
      return;
    }

    // Save API key
    this.ttsService.saveApiKey(apiKey, engine);
    alert('API key saved successfully!');
    this.updateProgress(0, '');

    // Restore original engine
    this.ttsService.setEngine(currentEngine);

    // Load voices dynamically (for Google Cloud)
    if (engine === 'google-cloud') {
      await this.loadVoices();
    }
  }

  loadSavedApiKey() {
    try {
      // Load Google Cloud API key
      const googleApiKey = localStorage.getItem('google-cloud-tts-api-key');
      const googleApiKeyInput = document.getElementById('google-api-key');
      if (googleApiKey && googleApiKeyInput) {
        googleApiKeyInput.value = googleApiKey;
        // Load voices if we have a key
        this.loadVoices();
      }

      // Load OpenAI API key
      const openaiApiKey = localStorage.getItem('openai-tts-api-key');
      const openaiApiKeyInput = document.getElementById('openai-api-key');
      if (openaiApiKey && openaiApiKeyInput) {
        openaiApiKeyInput.value = openaiApiKey;
      }
    } catch (e) {
      console.warn('Failed to load saved API key', e);
    }
  }

  async loadVoices() {
    try {
      const capabilities = await this.ttsService.getCapabilities();
      if (!capabilities || !capabilities.voices) {
        return;
      }

      const voiceSelect = document.getElementById('google-voice');
      if (!voiceSelect) return;

      // Clear existing options
      voiceSelect.innerHTML = '';

      // Add voices (filter for English)
      const englishVoices = capabilities.voices.filter((v) =>
        v.languageCodes.some((lang) => lang.startsWith('en-'))
      );

      englishVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} (${voice.ssmlGender})`;
        voiceSelect.appendChild(option);
      });
    } catch (error) {
      console.error('Failed to load voices:', error);
    }
  }

  async loadWebSpeechVoices() {
    if (!('speechSynthesis' in window)) {
      return;
    }

    const voiceSelect = document.getElementById('web-speech-voice');
    if (!voiceSelect) return;

    // Wait for voices to load
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      if (voices.length === 0) return;

      // Clear existing options
      voiceSelect.innerHTML = '';

      // Filter for English voices and sort by local/remote
      const englishVoices = voices.filter(v => v.lang.startsWith('en'));
      
      // Sort: local voices first, then by name
      englishVoices.sort((a, b) => {
        if (a.localService !== b.localService) {
          return a.localService ? -1 : 1; // Local first
        }
        return a.name.localeCompare(b.name);
      });

      // Add voices to dropdown
      englishVoices.forEach((voice) => {
        const option = document.createElement('option');
        option.value = voice.name;
        const localBadge = voice.localService ? '🖥️ ' : '☁️ ';
        option.textContent = `${localBadge}${voice.name} (${voice.lang})`;
        voiceSelect.appendChild(option);
      });

      // Select first local voice by default (better quality)
      const firstLocal = englishVoices.find(v => v.localService);
      if (firstLocal) {
        voiceSelect.value = firstLocal.name;
      }
    };

    // Try to load voices immediately
    loadVoices();

    // Also listen for voiceschanged event (some browsers need this)
    if (speechSynthesis.onvoiceschanged !== undefined) {
      speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Generate or retrieve cached speech for a phrase
   * @param {Object} phrase - Phrase object with text
   * @param {string} engine - TTS engine name
   * @param {Object} ttsOptions - TTS options
   * @returns {Promise<Blob>} Speech audio blob
   */
  async generateOrGetCachedSpeech(phrase, engine, ttsOptions) {
    // Get the text from the phrase object
    const text = phrase.phrase || phrase.text || '';
    
    try {
      // Try to get from cache first
      const cached = await this.cacheService.get(text, engine, ttsOptions);
      if (cached) {
        return cached;
      }
    } catch (error) {
      console.warn('Cache lookup failed, generating fresh:', error);
    }

    // Not in cache, generate new speech
    const speechBlob = await this.ttsService.generatePhrase(phrase, ttsOptions);
    
    // Store in cache for future use (don't fail if caching fails)
    try {
      await this.cacheService.set(text, engine, ttsOptions, speechBlob);
    } catch (error) {
      console.warn('Failed to cache speech:', error);
    }
    
    return speechBlob;
  }

  async handleSubmit(event) {
    event.preventDefault();

    try {
      // Show output section with progress
      this.outputSection.style.display = 'block';
      this.progressContainer.style.display = 'block';
      document.getElementById('playback-controls').style.display = 'none';
      document.getElementById('download-controls').style.display = 'none';
      this.generateBtn.disabled = true;

      // Get form data
      const formData = new FormData(this.form);
      const phraseFile = formData.get('phrase-file');
      const soundFile = formData.get('sound-file');
      const ttsEngine = formData.get('tts-engine');

      // Validate phrase file exists
      if (!phraseFile || phraseFile.size === 0) {
        this.showError('Please select a phrase file');
        return;
      }

      // Validate files BEFORE generating any TTS (to avoid wasting API calls)
      this.updateProgress(5, 'Validating files...');
      this.fileService.validateFileSize(phraseFile, 10);
      
      // Validate background audio file format early (before TTS generation)
      if (soundFile && soundFile.size > 0) {
        try {
          await this.fileService.readAudioFile(soundFile);
        } catch (error) {
          this.showError(error.message);
          return;
        }
      }

      // Read phrase file
      this.updateProgress(10, 'Reading phrase file...');
      const phraseContent = await this.fileService.readTextFile(phraseFile);
      const phrases = parseTextFile(phraseContent);

      // Set TTS engine
      this.ttsService.setEngine(ttsEngine);

      // Check if mixing/export is requested with Web Speech API (safety check)
      if (ttsEngine === 'web-speech' && soundFile && soundFile.size > 0) {
        this.showError(
          'Background mixing is not supported with Web Speech API. Please use a premium TTS engine (e.g. OpenAI or Google Cloud) for mixing and export features.'
        );
        return;
      }

      // Handle Web Speech API (playback only)
      if (ttsEngine === 'web-speech') {
        this.updateProgress(100, 'Ready to play!');

        // Get Web Speech API settings
        const voiceName = formData.get('web-speech-voice') || '';
        const rate = parseFloat(formData.get('web-speech-rate')) || 1.0;
        const pitch = parseFloat(formData.get('web-speech-pitch')) || 1.0;
        const volume = parseFloat(formData.get('web-speech-volume')) || 1.0;

        // Store phrases and options for playback
        this.currentPhrases = phrases;
        this.currentOptions = {
          voiceName,
          rate,
          pitch,
          volume
        };

        this.showWebSpeechControls();
        return;
      }

      // Handle gTTS (Google Translate TTS)
      if (ttsEngine === 'gtts') {
        const tld = formData.get('gtts-accent') || 'com';
        const slowSpeech = formData.get('gtts-slow-speech') === 'on';

        const ttsOptions = {
          tld,
          lang: 'en',
          slow: slowSpeech,
        };

        // Generate speech for each phrase
        this.updateProgress(20, 'Generating speech...');
        const audioBuffers = [];

        for (let i = 0; i < phrases.length; i++) {
          const phrase = phrases[i];
          const progress = 20 + (60 * (i + 1)) / phrases.length;
          this.updateProgress(
            progress,
            `Generating phrase ${i + 1}/${phrases.length}...`
          );

          // Generate speech (with caching)
          const speechBlob = await this.generateOrGetCachedSpeech(
            phrase,
            ttsEngine,
            ttsOptions
          );

          // Convert to AudioBuffer
          const arrayBuffer = await speechBlob.arrayBuffer();
          const audioBuffer =
            await this.audioService.decodeAudioData(arrayBuffer);
          audioBuffers.push(audioBuffer);

          // Add silence after phrase
          if (phrase.duration > 0) {
            const silence = this.audioService.createSilence(phrase.duration);
            audioBuffers.push(silence);
          }
        }

        // Concatenate all audio
        this.updateProgress(85, 'Combining audio...');
        let finalBuffer = this.audioService.concatenateBuffers(audioBuffers);

        // Mix with background sound if provided
        if (soundFile && soundFile.size > 0) {
          this.updateProgress(90, 'Mixing with background sound...');
          const soundArrayBuffer =
            await this.fileService.readAudioFile(soundFile);
          const backgroundBuffer =
            await this.audioService.decodeAudioData(soundArrayBuffer);

          const attenuation = parseInt(formData.get('attenuation')) || 0;
          const fadeIn = parseInt(formData.get('fade-in')) || 3000;
          const fadeOut = parseInt(formData.get('fade-out')) || 6000;

          finalBuffer = this.audioService.mixBuffers(
            finalBuffer,
            backgroundBuffer,
            { attenuation }
          );

          // Apply fades to mixed audio
          finalBuffer = this.audioService.applyFades(finalBuffer, {
            fadeIn,
            fadeOut,
          });
        }

        // Store audio buffer and convert to WAV blob
        this.updateProgress(95, 'Finalizing...');
        this.currentAudioBuffer = finalBuffer;
        this.currentAudioBlob = this.audioService.audioBufferToWav(finalBuffer);

        // Show output
        this.updateProgress(100, 'Complete!');
        this.showOutput();
        return;
      }

      // Handle Google Cloud TTS (with mixing/export support)
      if (ttsEngine === 'google-cloud') {
        // Get Google Cloud TTS options
        const voiceName = formData.get('google-voice') || 'en-US-Neural2-C';
        const speakingRate =
          parseFloat(formData.get('speaking-rate')) || 1.0;
        const pitch = parseFloat(formData.get('pitch')) || 0.0;
        const volumeGainDb = parseFloat(formData.get('volume-gain')) || 0.0;

        const ttsOptions = {
          voiceName,
          languageCode: 'en-US',
          speakingRate,
          pitch,
          volumeGainDb,
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000,
        };

        // Generate speech for each phrase
        this.updateProgress(20, 'Generating speech...');
        const audioBuffers = [];

        for (let i = 0; i < phrases.length; i++) {
          const phrase = phrases[i];
          const progress = 20 + (60 * (i + 1)) / phrases.length;
          this.updateProgress(
            progress,
            `Generating phrase ${i + 1}/${phrases.length}...`
          );

          // Generate speech (with caching)
          const speechBlob = await this.generateOrGetCachedSpeech(
            phrase,
            ttsEngine,
            ttsOptions
          );

          // Convert to AudioBuffer
          const arrayBuffer = await speechBlob.arrayBuffer();
          const audioBuffer =
            await this.audioService.decodeAudioData(arrayBuffer);
          audioBuffers.push(audioBuffer);

          // Add silence after phrase
          if (phrase.duration > 0) {
            const silence = this.audioService.createSilence(phrase.duration);
            audioBuffers.push(silence);
          }
        }

        // Concatenate all audio
        this.updateProgress(85, 'Combining audio...');
        let finalBuffer = this.audioService.concatenateBuffers(audioBuffers);

        // Mix with background sound if provided
        if (soundFile && soundFile.size > 0) {
          this.updateProgress(90, 'Mixing with background sound...');
          const soundArrayBuffer =
            await this.fileService.readAudioFile(soundFile);
          const backgroundBuffer =
            await this.audioService.decodeAudioData(soundArrayBuffer);

          const attenuation = parseInt(formData.get('attenuation')) || 0;
          const fadeIn = parseInt(formData.get('fade-in')) || 3000;
          const fadeOut = parseInt(formData.get('fade-out')) || 6000;

          finalBuffer = this.audioService.mixBuffers(
            finalBuffer,
            backgroundBuffer,
            { attenuation }
          );

          // Apply fades to mixed audio
          finalBuffer = this.audioService.applyFades(finalBuffer, {
            fadeIn,
            fadeOut,
          });
        }

        // Store audio buffer and convert to WAV blob
        this.updateProgress(95, 'Finalizing...');
        this.currentAudioBuffer = finalBuffer;
        this.currentAudioBlob = this.audioService.audioBufferToWav(finalBuffer);

        // Show output
        this.updateProgress(100, 'Complete!');
        this.showOutput();
        return;
      }

      // Handle OpenAI TTS (with mixing/export support)
      if (ttsEngine === 'openai') {
        // Get OpenAI TTS options
        const voice = formData.get('openai-voice') || 'nova';
        const model = formData.get('openai-model') || 'tts-1';
        const speed = parseFloat(formData.get('openai-speed')) || 1.0;

        const ttsOptions = {
          voice,
          model,
          speed,
          format: 'wav',
        };

        // Generate speech for each phrase
        this.updateProgress(20, 'Generating speech...');
        const audioBuffers = [];

        for (let i = 0; i < phrases.length; i++) {
          const phrase = phrases[i];
          const progress = 20 + (60 * (i + 1)) / phrases.length;
          this.updateProgress(
            progress,
            `Generating phrase ${i + 1}/${phrases.length}...`
          );

          // Generate speech (with caching)
          const speechBlob = await this.generateOrGetCachedSpeech(
            phrase,
            ttsEngine,
            ttsOptions
          );

          // Convert to AudioBuffer
          const arrayBuffer = await speechBlob.arrayBuffer();
          const audioBuffer =
            await this.audioService.decodeAudioData(arrayBuffer);
          audioBuffers.push(audioBuffer);

          // Add silence after phrase
          if (phrase.duration > 0) {
            const silence = this.audioService.createSilence(phrase.duration);
            audioBuffers.push(silence);
          }
        }

        // Concatenate all audio
        this.updateProgress(85, 'Combining audio...');
        let finalBuffer = this.audioService.concatenateBuffers(audioBuffers);

        // Mix with background sound if provided
        if (soundFile && soundFile.size > 0) {
          this.updateProgress(90, 'Mixing with background sound...');
          const soundArrayBuffer =
            await this.fileService.readAudioFile(soundFile);
          const backgroundBuffer =
            await this.audioService.decodeAudioData(soundArrayBuffer);

          const attenuation = parseInt(formData.get('attenuation')) || 0;
          const fadeIn = parseInt(formData.get('fade-in')) || 3000;
          const fadeOut = parseInt(formData.get('fade-out')) || 6000;

          finalBuffer = this.audioService.mixBuffers(
            finalBuffer,
            backgroundBuffer,
            { attenuation }
          );

          // Apply fades to mixed audio
          finalBuffer = this.audioService.applyFades(finalBuffer, {
            fadeIn,
            fadeOut,
          });
        }

        // Store audio buffer and convert to WAV blob
        this.updateProgress(95, 'Finalizing...');
        this.currentAudioBuffer = finalBuffer;
        this.currentAudioBlob = this.audioService.audioBufferToWav(finalBuffer);

        // Show output
        this.updateProgress(100, 'Complete!');
        this.showOutput();
        return;
      }

      // Other premium TTS engines
      this.showError(
        `${ttsEngine} is not yet implemented. Please use OpenAI TTS, Google Cloud TTS, or Web Speech API.`
      );
    } catch (error) {
      this.showError(error.message);
    } finally {
      this.generateBtn.disabled = false;
    }
  }

  showOutput() {
    const audioUrl = URL.createObjectURL(this.currentAudioBlob);
    this.audioPlayer.src = audioUrl;

    this.progressContainer.style.display = 'none';
    document.getElementById('playback-controls').style.display = 'none';
    document.getElementById('download-controls').style.display = 'block';
  }

  showWebSpeechControls() {
    const playbackControls = document.getElementById('playback-controls');
    const downloadControls = document.getElementById('download-controls');

    this.progressContainer.style.display = 'block';
    playbackControls.style.display = 'block';
    downloadControls.style.display = 'none';

    this.playBtn.disabled = false;
    this.stopBtn.disabled = true;
  }

  async handlePlay() {
    if (!this.currentPhrases || this.isPlaying) return;

    try {
      this.isPlaying = true;
      this.playBtn.disabled = true;
      this.stopBtn.disabled = false;
      this.generateBtn.disabled = true;

      await this.ttsService.playPhrasesWebAPI(
        this.currentPhrases,
        this.currentOptions,
        (current, total) => {
          this.updateProgress(
            (100 * current) / total,
            `Playing phrase ${current}/${total}`
          );
        }
      );

      this.updateProgress(100, 'Playback complete!');
    } catch (error) {
      if (error.message !== 'Playback stopped by user') {
        this.showError(error.message);
      }
    } finally {
      this.isPlaying = false;
      this.playBtn.disabled = false;
      this.stopBtn.disabled = true;
      this.generateBtn.disabled = false;
    }
  }

  handleStop() {
    this.ttsService.stopSpeech();
    this.isPlaying = false;
    this.playBtn.disabled = false;
    this.stopBtn.disabled = true;
    this.generateBtn.disabled = false;
    this.updateProgress(0, 'Playback stopped');
  }

  async handleDownload() {
    if (!this.currentAudioBuffer) {
      this.showError('No audio available to download');
      return;
    }

    const format = document.getElementById('export-format').value;
    const bitrate = parseInt(document.getElementById('mp3-bitrate').value);

    try {
      let blob;
      let filename;

      if (format === 'mp3') {
        // Check if lamejs is available
        if (!this.audioService.isLameAvailable()) {
          this.showError(
            'MP3 encoder not available. This may be due to:\n\n' +
            '1. No internet connection (library not cached yet)\n' +
            '2. Browser blocking the script\n' +
            '3. Network error\n\n' +
            'Please check your connection and reload the page, or use WAV format instead.'
          );
          return;
        }

        // Show progress container for MP3 encoding
        this.progressContainer.style.display = 'block';
        this.updateProgress(0, 'Encoding MP3...');
        this.downloadBtn.disabled = true;

        blob = await this.audioService.audioBufferToMP3(
          this.currentAudioBuffer,
          bitrate,
          (progress) => {
            this.updateProgress(progress, `Encoding MP3... ${progress}%`);
          }
        );

        filename = `audio-program-${bitrate}kbps.mp3`;
        this.updateProgress(100, 'MP3 encoding complete!');
      } else {
        // Export as WAV (instant, no progress needed)
        blob = this.audioService.audioBufferToWav(this.currentAudioBuffer);
        filename = 'audio-program.wav';
      }

      // Download the file
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Hide progress and reset after a delay
      setTimeout(() => {
        this.progressContainer.style.display = 'none';
      }, 1000);

    } catch (error) {
      if (error.message.includes('cancelled')) {
        this.updateProgress(0, 'Encoding cancelled');
      } else {
        this.showError(error.message);
      }
      // Hide progress on error
      setTimeout(() => {
        this.progressContainer.style.display = 'none';
      }, 2000);
    } finally {
      this.downloadBtn.disabled = false;
    }
  }

  showError(message) {
    this.updateProgress(0, `Error: ${message}`);
    alert(`Error: ${message}`);
  }

  updateProgress(value, text) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    progressBar.value = value;
    progressText.textContent = text;
  }
}
