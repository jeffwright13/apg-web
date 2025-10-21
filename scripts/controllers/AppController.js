/**
 * Main application controller
 * Orchestrates the audio generation workflow
 */

import { FileService } from '../services/FileService.js';
import { TTSService } from '../services/TTSService.js';
import { AudioService } from '../services/AudioService.js';
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

    // State
    this.currentAudioBlob = null;
    this.currentPhrases = null;
    this.currentOptions = null;
    this.isPlaying = false;
  }

  initialize() {
    this.form = document.getElementById('apg-form');
    this.generateBtn = document.getElementById('generate-btn');
    this.outputSection = document.getElementById('output-section');
    this.progressContainer = document.getElementById('progress-container');
    this.audioPlayer = document.getElementById('audio-player');
    this.downloadBtn = document.getElementById('download-btn');
    this.playBtn = document.getElementById('play-btn');
    this.stopBtn = document.getElementById('stop-btn');

    this.attachEventListeners();
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

    // Show/hide browser warning and settings based on TTS engine selection
    const ttsEngineSelect = document.getElementById('tts-engine');
    if (ttsEngineSelect) {
      ttsEngineSelect.addEventListener('change', (e) => {
        this.updateEngineUI(e.target.value);
      });
      // Set initial state
      this.updateEngineUI(ttsEngineSelect.value);
    }

    // Save API key button
    const saveApiKeyBtn = document.getElementById('save-api-key-btn');
    if (saveApiKeyBtn) {
      saveApiKeyBtn.addEventListener('click', () => this.handleSaveApiKey());
    }

    // Load saved API key
    this.loadSavedApiKey();

    // Update slider value displays
    this.setupSliderValueDisplays();

    // Setup theme switcher
    this.setupThemeSwitcher();
  }

  setupSliderValueDisplays() {
    const sliders = [
      { id: 'speaking-rate', valueId: 'speaking-rate-value' },
      { id: 'pitch', valueId: 'pitch-value' },
      { id: 'volume-gain', valueId: 'volume-gain-value' },
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

  updateEngineUI(engine) {
    const warning = document.getElementById('browser-warning');
    const gttsSettings = document.getElementById('gtts-settings');
    const googleSettings = document.getElementById('google-cloud-settings');

    if (warning) {
      warning.style.display = engine === 'web-speech' ? 'block' : 'none';
    }

    if (gttsSettings) {
      gttsSettings.style.display = engine === 'gtts' ? 'block' : 'none';
    }

    if (googleSettings) {
      googleSettings.style.display =
        engine === 'google-cloud' ? 'block' : 'none';
    }
  }

  async handleSaveApiKey() {
    const apiKeyInput = document.getElementById('google-api-key');
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      alert('Please enter an API key');
      return;
    }

    // Validate API key
    this.updateProgress(0, 'Validating API key...');
    const isValid = await this.ttsService.validateApiKey(apiKey);

    if (!isValid) {
      alert('Invalid API key. Please check and try again.');
      this.updateProgress(0, '');
      return;
    }

    // Save API key
    this.ttsService.saveApiKey(apiKey);
    alert('API key saved successfully!');
    this.updateProgress(0, '');

    // Load voices dynamically
    await this.loadVoices();
  }

  loadSavedApiKey() {
    try {
      const apiKey = localStorage.getItem('google-cloud-tts-api-key');
      const apiKeyInput = document.getElementById('google-api-key');
      if (apiKey && apiKeyInput) {
        apiKeyInput.value = apiKey;
        // Load voices if we have a key
        this.loadVoices();
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
      const slowSpeech = formData.get('slow-speech') === 'on';

      // Validate phrase file exists
      if (!phraseFile || phraseFile.size === 0) {
        this.showError('Please select a phrase file');
        return;
      }

      // Validate files
      this.updateProgress(5, 'Validating files...');
      this.fileService.validateFileSize(phraseFile, 10);

      // Read phrase file
      this.updateProgress(10, 'Reading phrase file...');
      const phraseContent = await this.fileService.readTextFile(phraseFile);
      const phrases = parseTextFile(phraseContent);

      // Set TTS engine
      this.ttsService.setEngine(ttsEngine);

      // Check if mixing/export is requested with Web Speech API
      if (ttsEngine === 'web-speech' && soundFile && soundFile.size > 0) {
        this.showError(
          'Background mixing is not supported with Web Speech API. Please use a premium TTS engine (ElevenLabs or Google Cloud) for mixing and export features.'
        );
        return;
      }

      // Handle Web Speech API (playback only)
      if (ttsEngine === 'web-speech') {
        this.updateProgress(100, 'Ready to play!');

        // Store phrases and options for playback
        this.currentPhrases = phrases;
        this.currentOptions = { slow: slowSpeech };

        this.showWebSpeechControls();
        return;
      }

      // Handle gTTS (Google Translate TTS)
      if (ttsEngine === 'gtts') {
        const tld = formData.get('gtts-accent') || 'com';

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

          // Generate speech
          const speechBlob = await this.ttsService.generatePhrase(
            phrase,
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

        // Convert to WAV blob
        this.updateProgress(95, 'Finalizing...');
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

          // Generate speech
          const speechBlob = await this.ttsService.generatePhrase(
            phrase,
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

        // Convert to WAV blob
        this.updateProgress(95, 'Finalizing...');
        this.currentAudioBlob = this.audioService.audioBufferToWav(finalBuffer);

        // Show output
        this.updateProgress(100, 'Complete!');
        this.showOutput();
        return;
      }

      // Other premium TTS engines
      this.showError(
        `${ttsEngine} is not yet implemented. Please use Google Cloud TTS or Web Speech API.`
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

  handleDownload() {
    if (!this.currentAudioBlob) return;

    const url = URL.createObjectURL(this.currentAudioBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'audio-program.wav';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
