/**
 * Main application controller
 * Orchestrates the audio generation workflow
 */

import { FileService } from '../services/FileService.js';
import { TTSService } from '../services/TTSService.js';
import { AudioService } from '../services/AudioService.js';
import { TTSCacheService } from '../services/TTSCacheService.js';
import { ProjectCacheService } from '../services/ProjectCacheService.js';
import { TextEditorService } from '../services/TextEditorService.js';
import { SampleAudioService } from '../services/SampleAudioService.js';
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
    this.projectCache = new ProjectCacheService();
    this.editorService = new TextEditorService();
    this.sampleAudioService = new SampleAudioService();

    // State
    this.currentAudioBlob = null;
    this.currentAudioBuffer = null;
    this.currentPhrases = null;
    this.currentOptions = null;
    this.currentPhraseFileName = null;
    this.currentBackgroundMusicFile = null;
    this.isPlaying = false;
    this.isGenerating = false;
    this.generationCancelled = false;
    this.inputMode = 'file'; // 'file' or 'editor'
    this.autoSaveTimeout = null;
  }

  async initialize() {
    this.form = document.getElementById('apg-form');
    this.generateBtn = document.getElementById('generate-btn');
    this.stopGenerationBtn = document.getElementById('stop-generation-btn');
    this.outputSection = document.getElementById('generate-preview-section');
    this.progressContainer = document.getElementById('progress-container');
    this.audioPlayer = document.getElementById('audio-player');
    this.downloadBtn = document.getElementById('download-btn');
    this.playBtn = document.getElementById('play-btn');
    this.stopBtn = document.getElementById('stop-btn');

    this.attachEventListeners();
    
    // Initialize caches in background (don't block app startup)
    this.initializeCache();
    this.initializeProjectCache();
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

  async initializeProjectCache() {
    try {
      await this.projectCache.init();
      
      // Load and display recent projects
      await this.loadRecentProjects();
      
      // Log project stats
      const stats = await this.projectCache.getStats();
      // eslint-disable-next-line no-console
      console.log(`💼 Projects: ${stats.count} saved, ${stats.totalSizeMB} MB`);
    } catch (error) {
      console.warn('Project cache initialization failed:', error);
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

  /**
   * Handle clear all projects button click
   */
  async handleClearProjects() {
    if (!confirm('Clear all saved projects? This cannot be undone.')) {
      return;
    }

    try {
      await this.projectCache.clearAll();
      await this.loadRecentProjects();
      alert('All projects cleared successfully!');
    } catch (error) {
      console.error('Failed to clear projects:', error);
      alert('Failed to clear projects. Check console for details.');
    }
  }

  /**
   * Load and display recent projects
   */
  async loadRecentProjects() {
    try {
      const projects = await this.projectCache.listProjects();
      const projectsList = document.getElementById('projects-list');
      const projectsDetails = document.getElementById('recent-projects-details');
      const projectsCount = document.getElementById('projects-count');

      if (!projectsList || !projectsDetails) return;

      if (projects.length === 0) {
        projectsDetails.style.display = 'none';
        return;
      }

      projectsDetails.style.display = 'block';
      projectsList.innerHTML = '';
      
      // Update count badge
      if (projectsCount) {
        projectsCount.textContent = `(${projects.length})`;
      }

      projects.forEach((project) => {
        const projectCard = this.createProjectCard(project);
        projectsList.appendChild(projectCard);
      });
    } catch (error) {
      console.error('Failed to load projects:', error);
    }
  }

  /**
   * Create a project card element
   */
  createProjectCard(project) {
    const card = document.createElement('div');
    card.style.cssText = 'border: 1px solid var(--pico-muted-border-color); border-radius: 0.5rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; gap: 1rem;';

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1; min-width: 0;';
    
    const name = document.createElement('strong');
    name.textContent = project.name;
    name.style.cssText = 'display: block; margin-bottom: 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
    
    const meta = document.createElement('small');
    meta.style.opacity = '0.7';
    const musicInfo = project.hasBackgroundMusic ? ` • Music: ${project.backgroundMusicName || 'Yes'}` : '';
    meta.textContent = `${this.projectCache.formatTimestamp(project.timestamp)} • ${project.ttsEngine}${musicInfo}`;
    
    info.appendChild(name);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.style.cssText = 'display: flex; gap: 0.5rem;';

    const restoreBtn = document.createElement('button');
    restoreBtn.textContent = 'Restore';
    restoreBtn.className = 'secondary';
    restoreBtn.style.cssText = 'margin: 0; padding: 0.25rem 0.75rem; font-size: 0.875rem;';
    restoreBtn.onclick = () => this.restoreProject(project.id);

    const deleteBtn = document.createElement('button');
    deleteBtn.textContent = '×';
    deleteBtn.className = 'secondary';
    deleteBtn.style.cssText = 'margin: 0; padding: 0.25rem 0.5rem; font-size: 1.25rem; line-height: 1;';
    deleteBtn.title = 'Delete project';
    deleteBtn.onclick = () => this.deleteProject(project.id);

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);

    card.appendChild(info);
    card.appendChild(actions);

    return card;
  }

  /**
   * Restore a project
   */
  async restoreProject(projectId) {
    try {
      const project = await this.projectCache.getProject(projectId);
      if (!project) {
        alert('Project not found');
        return;
      }

      // eslint-disable-next-line no-console
      console.log(`🔄 Restoring project: "${project.name}"`);

      // Create a File object from the phrase content
      const phraseFile = new File([project.phraseFileContent], project.name, {
        type: 'text/plain',
      });

      // Set the phrase file
      const phraseInput = document.getElementById('phrase-file');
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(phraseFile);
      phraseInput.files = dataTransfer.files;

      // Set background music if available
      if (project.backgroundMusic) {
        const soundInput = document.getElementById('sound-file');
        const musicFile = new File([project.backgroundMusic], project.backgroundMusicName || 'background.mp3', {
          type: project.backgroundMusic.type,
        });
        const musicTransfer = new DataTransfer();
        musicTransfer.items.add(musicFile);
        soundInput.files = musicTransfer.files;
      }

      // Set TTS engine
      const engineSelect = document.getElementById('tts-engine');
      if (engineSelect) {
        engineSelect.value = project.ttsEngine;
        this.updateEngineUI(project.ttsEngine);
      }

      // Set TTS options based on engine
      if (project.ttsEngine === 'openai') {
        const voiceSelect = document.getElementById('openai-voice');
        const modelSelect = document.getElementById('openai-model');
        const speedSlider = document.getElementById('openai-speed');
        if (voiceSelect) voiceSelect.value = project.ttsOptions.voice || 'nova';
        if (modelSelect) modelSelect.value = project.ttsOptions.model || 'tts-1';
        if (speedSlider) speedSlider.value = project.ttsOptions.speed || 1.0;
      } else if (project.ttsEngine === 'google-cloud') {
        const voiceSelect = document.getElementById('voice-name');
        const rateSlider = document.getElementById('speaking-rate');
        const pitchSlider = document.getElementById('pitch');
        if (voiceSelect) voiceSelect.value = project.ttsOptions.voiceName || 'en-US-Neural2-F';
        if (rateSlider) rateSlider.value = project.ttsOptions.speakingRate || 1.0;
        if (pitchSlider) pitchSlider.value = project.ttsOptions.pitch || 0.0;
      }

      // Set export settings
      if (project.exportSettings) {
        const formatSelect = document.getElementById('export-format');
        const bitrateSelect = document.getElementById('mp3-bitrate');
        if (formatSelect) formatSelect.value = project.exportSettings.format || 'mp3';
        if (bitrateSelect) bitrateSelect.value = project.exportSettings.bitrate || 192;
      }

      alert(`Project "${project.name}" restored! Click "Generate Audio" to recreate it.`);
    } catch (error) {
      console.error('Failed to restore project:', error);
      alert('Failed to restore project. Check console for details.');
    }
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId) {
    try {
      await this.projectCache.deleteProject(projectId);
      await this.loadRecentProjects();
    } catch (error) {
      console.error('Failed to delete project:', error);
      alert('Failed to delete project. Check console for details.');
    }
  }

  /**
   * Handle stop generation button click
   */
  handleStopGeneration() {
    if (!this.isGenerating) return;
    
    this.generationCancelled = true;
    this.updateProgress(0, 'Stopping...');
    // eslint-disable-next-line no-console
    console.log('⏹️ Generation cancelled by user');
  }

  /**
   * Save current project after successful generation
   */
  async saveCurrentProject() {
    try {
      if (!this.currentPhraseFileName || !this.currentPhrases) {
        return; // Nothing to save
      }

      const formData = new FormData(this.form);
      const ttsEngine = formData.get('tts-engine');

      // Get TTS options based on engine
      let ttsOptions = {};
      if (ttsEngine === 'openai') {
        ttsOptions = {
          voice: formData.get('openai-voice') || 'nova',
          model: formData.get('openai-model') || 'tts-1',
          speed: parseFloat(formData.get('openai-speed')) || 1.0,
          format: 'wav',
        };
      } else if (ttsEngine === 'google-cloud') {
        ttsOptions = {
          voiceName: formData.get('voice-name') || 'en-US-Neural2-F',
          languageCode: 'en-US',
          speakingRate: parseFloat(formData.get('speaking-rate')) || 1.0,
          pitch: parseFloat(formData.get('pitch')) || 0.0,
          volumeGainDb: parseFloat(formData.get('volume-gain')) || 0.0,
          audioEncoding: 'LINEAR16',
          sampleRateHertz: 24000,
        };
      }

      // Get export settings
      const exportSettings = {
        format: formData.get('export-format') || 'mp3',
        bitrate: parseInt(formData.get('mp3-bitrate')) || 192,
      };

      // Reconstruct phrase file content
      const phraseFileContent = this.currentPhrases
        .map((p) => `${p.phrase || p.text}; ${p.duration}`)
        .join('\n');

      const projectData = {
        name: this.currentPhraseFileName,
        phraseFileContent,
        backgroundMusic: this.currentBackgroundMusicFile,
        backgroundMusicName: this.currentBackgroundMusicFile?.name,
        ttsEngine,
        ttsOptions,
        exportSettings,
      };

      await this.projectCache.saveProject(projectData);
      await this.loadRecentProjects();
    } catch (error) {
      console.error('Failed to save project:', error);
      // Don't show alert - this is a background operation
    }
  }

  attachEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.downloadBtn.addEventListener('click', () => this.handleDownload());

    if (this.stopGenerationBtn) {
      this.stopGenerationBtn.addEventListener('click', () => this.handleStopGeneration());
    }

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

    // Clear all projects
    const clearProjectsBtn = document.getElementById('clear-projects-btn');
    if (clearProjectsBtn) {
      clearProjectsBtn.addEventListener('click', () => this.handleClearProjects());
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

    // Setup text editor
    this.setupTextEditor();

    // Setup sample audio selector
    this.setupSampleAudioSelector();
    
    // Setup EQ controls
    this.setupEQControls();
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
      { id: 'eq-low', valueId: 'eq-low-value' },
      { id: 'eq-mid', valueId: 'eq-mid-value' },
      { id: 'eq-high', valueId: 'eq-high-value' },
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

    // Reset cancellation flag
    this.generationCancelled = false;
    this.isGenerating = true;

    try {
      // Show output section with progress
      this.outputSection.style.display = 'block';
      this.progressContainer.style.display = 'block';
      document.getElementById('playback-controls').style.display = 'none';
      document.getElementById('download-controls').style.display = 'none';
      this.generateBtn.disabled = true;
      this.stopGenerationBtn.style.display = 'block';

      // Get form data
      const formData = new FormData(this.form);
      const phraseFile = formData.get('phrase-file');
      const soundFile = formData.get('sound-file');
      const ttsEngine = formData.get('tts-engine');

      // Get phrase content based on input mode
      let phraseContent;
      let phraseFileName;

      if (this.inputMode === 'editor') {
        // Get content from editor
        const editor = document.getElementById('apg-editor');
        phraseContent = editor ? editor.value : '';
        
        if (!phraseContent || !phraseContent.trim()) {
          this.showError('Please enter program text in the editor');
          return;
        }
        
        phraseFileName = 'editor-program.txt';
      } else {
        // Get content from file upload
        if (!phraseFile || phraseFile.size === 0) {
          this.showError('Please select a phrase file');
          return;
        }

        // Validate files BEFORE generating any TTS (to avoid wasting API calls)
        this.updateProgress(5, 'Validating files...');
        this.fileService.validateFileSize(phraseFile, 10);
        
        // Read phrase file
        this.updateProgress(10, 'Reading phrase file...');
        phraseContent = await this.fileService.readTextFile(phraseFile);
        phraseFileName = phraseFile.name;
      }
      
      // Validate background audio file format early (before TTS generation)
      if (soundFile && soundFile.size > 0) {
        try {
          await this.fileService.readAudioFile(soundFile);
        } catch (error) {
          this.showError(error.message);
          return;
        }
      }

      // Parse phrase content
      this.updateProgress(10, 'Parsing program...');
      const phrases = parseTextFile(phraseContent);

      // Store file names for project saving
      this.currentPhraseFileName = phraseFileName;
      this.currentPhrases = phrases;
      this.currentBackgroundMusicFile = soundFile && soundFile.size > 0 ? soundFile : null;

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
          // Check for cancellation
          if (this.generationCancelled) {
            throw new Error('Generation cancelled by user');
          }

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
          const phraseText = phrase.phrase || phrase.text || '';
          // eslint-disable-next-line no-console
          console.log(`🎵 About to decode phrase: "${phraseText.substring(0, 50)}"`);
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
        
        // Save project for future restoration
        await this.saveCurrentProject();
        
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
          // Check for cancellation
          if (this.generationCancelled) {
            throw new Error('Generation cancelled by user');
          }

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
          const phraseText = phrase.phrase || phrase.text || '';
          // eslint-disable-next-line no-console
          console.log(`🎵 About to decode phrase: "${phraseText.substring(0, 50)}"`);
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
        
        // Save project for future restoration
        await this.saveCurrentProject();
        
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
          // Check for cancellation
          if (this.generationCancelled) {
            throw new Error('Generation cancelled by user');
          }

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
          const phraseText = phrase.phrase || phrase.text || '';
          // eslint-disable-next-line no-console
          console.log(`🎵 About to decode phrase: "${phraseText.substring(0, 50)}"`);
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
        
        // Save project for future restoration
        await this.saveCurrentProject();
        
        this.showOutput();
        return;
      }
    } catch (error) {
      if (error.message !== 'Generation cancelled by user') {
        this.showError(error.message);
      }
    } finally {
      this.isGenerating = false;
      this.generateBtn.disabled = false;
      this.stopGenerationBtn.style.display = 'none';
    }
  }

  showOutput() {
    const audioUrl = URL.createObjectURL(this.currentAudioBlob);
    this.audioPlayer.src = audioUrl;

    this.progressContainer.style.display = 'none';
    document.getElementById('playback-controls').style.display = 'none';
    document.getElementById('download-controls').style.display = 'block';
    
    // Initialize EQ when audio is loaded
    this.audioPlayer.addEventListener('loadedmetadata', () => {
      this.initializeAudioEQ();
    }, { once: true });
  }
  
  /**
   * Initialize EQ for the audio player
   */
  initializeAudioEQ() {
    try {
      this.audioService.initializeEQ(this.audioPlayer);
      // eslint-disable-next-line no-console
      console.log('🎚️ EQ initialized for audio player');
    } catch (error) {
      console.warn('Failed to initialize EQ:', error);
      // EQ is optional, don't show error to user
    }
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

    if (progressBar) {
      progressBar.value = value;
    }
    if (progressText) {
      progressText.textContent = text;
    }
  }

  /**
   * Setup text editor functionality
   */
  setupTextEditor() {
    const inputModeSelect = document.getElementById('input-mode');
    const fileUploadMode = document.getElementById('file-upload-mode');
    const textEditorMode = document.getElementById('text-editor-mode');
    const editor = document.getElementById('apg-editor');
    const lineNumbers = document.getElementById('line-numbers');
    const templateSelect = document.getElementById('template-select');
    const saveEditorBtn = document.getElementById('save-editor-btn');
    const loadEditorBtn = document.getElementById('load-editor-btn');
    const clearEditorBtn = document.getElementById('clear-editor-btn');

    if (!editor) return;

    // Mode selection
    if (inputModeSelect) {
      inputModeSelect.addEventListener('change', (e) => {
        this.inputMode = e.target.value;
        
        if (this.inputMode === 'file') {
          fileUploadMode.style.display = 'block';
          textEditorMode.style.display = 'none';
        } else {
          fileUploadMode.style.display = 'none';
          textEditorMode.style.display = 'block';
          
          // Load saved content if available
          const saved = this.editorService.loadFromLocalStorage();
          if (saved && !editor.value) {
            editor.value = saved;
            this.updateEditorUI();
          }
        }
      });
      
      // Initialize based on selected option
      const initialMode = inputModeSelect.value;
      this.inputMode = initialMode;
      if (initialMode === 'editor') {
        fileUploadMode.style.display = 'none';
        textEditorMode.style.display = 'block';
      } else {
        fileUploadMode.style.display = 'block';
        textEditorMode.style.display = 'none';
      }
    }

    // Editor input - update line numbers and stats
    editor.addEventListener('input', () => {
      this.updateEditorUI();
      this.scheduleAutoSave();
    });

    // Sync scroll between editor and line numbers
    editor.addEventListener('scroll', () => {
      if (lineNumbers) {
        lineNumbers.scrollTop = editor.scrollTop;
      }
    });

    // Template selection
    if (templateSelect) {
      templateSelect.addEventListener('change', (e) => {
        if (e.target.value) {
          const template = this.editorService.loadTemplate(e.target.value);
          editor.value = template;
          this.updateEditorUI();
          this.scheduleAutoSave();
          e.target.value = ''; // Reset dropdown
        }
      });
    }

    // Save button
    if (saveEditorBtn) {
      saveEditorBtn.addEventListener('click', () => {
        const success = this.editorService.saveToLocalStorage(editor.value);
        const statusSpan = document.getElementById('auto-save-status');
        if (statusSpan) {
          statusSpan.textContent = success ? '✓ Saved' : '✗ Save failed';
          setTimeout(() => {
            statusSpan.textContent = 'Auto-saved';
          }, 2000);
        }
      });
    }

    // Load button
    if (loadEditorBtn) {
      loadEditorBtn.addEventListener('click', () => {
        const saved = this.editorService.loadFromLocalStorage();
        if (saved) {
          editor.value = saved;
          this.updateEditorUI();
        } else {
          alert('No saved content found');
        }
      });
    }

    // Clear button
    if (clearEditorBtn) {
      clearEditorBtn.addEventListener('click', () => {
        if (confirm('Clear editor content?')) {
          editor.value = '';
          this.updateEditorUI();
          this.editorService.clearLocalStorage();
        }
      });
    }

    // Initial update
    this.updateEditorUI();
  }

  /**
   * Update editor UI (line numbers, stats, validation)
   */
  updateEditorUI() {
    const editor = document.getElementById('apg-editor');
    const lineNumbers = document.getElementById('line-numbers');
    const statLines = document.getElementById('stat-lines');
    const statChars = document.getElementById('stat-chars');
    const statWords = document.getElementById('stat-words');
    const validationDiv = document.getElementById('editor-validation');

    if (!editor) return;

    const text = editor.value;

    // Update stats
    const stats = this.editorService.getStats(text);
    if (statLines) statLines.textContent = stats.lines;
    if (statChars) statChars.textContent = stats.characters;
    if (statWords) statWords.textContent = stats.words;

    // Update line numbers
    if (lineNumbers) {
      lineNumbers.innerHTML = this.editorService.generateLineNumbers(stats.lines);
    }

    // Validate syntax
    if (validationDiv && text.trim()) {
      const validation = this.editorService.validateSyntax(text);
      if (validation.valid) {
        validationDiv.className = 'editor-validation valid';
        validationDiv.innerHTML = '✓ Syntax valid';
        validationDiv.style.display = 'block';
      } else {
        validationDiv.className = 'editor-validation invalid';
        const errorList = validation.errors.map(err => `<li>${err}</li>`).join('');
        validationDiv.innerHTML = `<strong>Syntax errors:</strong><ul>${errorList}</ul>`;
        validationDiv.style.display = 'block';
      }
    } else if (validationDiv) {
      validationDiv.style.display = 'none';
    }
  }

  /**
   * Schedule auto-save with debounce
   */
  scheduleAutoSave() {
    if (this.autoSaveTimeout) {
      clearTimeout(this.autoSaveTimeout);
    }

    this.autoSaveTimeout = setTimeout(() => {
      const editor = document.getElementById('apg-editor');
      if (editor && editor.value) {
        this.editorService.saveToLocalStorage(editor.value);
        const statusSpan = document.getElementById('auto-save-status');
        if (statusSpan) {
          statusSpan.textContent = 'Auto-saved';
        }
      }
    }, 2000); // Auto-save after 2 seconds of inactivity
  }

  /**
   * Load available samples and populate dropdown
   */
  async loadAndPopulateSamples() {
    const sampleSelect = document.getElementById('sample-audio-select');
    if (!sampleSelect) return;

    try {
      // Load available samples from the samples directory
      await this.sampleAudioService.loadAvailableSamples();
      const samples = this.sampleAudioService.getSamples();

      // Clear existing options
      sampleSelect.innerHTML = '';

      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = samples.length > 0 
        ? '-- Select a sample --' 
        : '-- No samples available --';
      sampleSelect.appendChild(defaultOption);

      // Add sample options
      samples.forEach(sample => {
        const option = document.createElement('option');
        option.value = sample.id;
        option.textContent = sample.name;
        sampleSelect.appendChild(option);
      });

      if (samples.length === 0) {
        sampleSelect.disabled = true;
      }
    } catch (error) {
      console.error('Failed to load samples:', error);
      sampleSelect.innerHTML = '<option value="">-- Error loading samples --</option>';
      sampleSelect.disabled = true;
    }
  }

  /**
   * Setup sample audio selector
   */
  async setupSampleAudioSelector() {
    const audioSourceSelect = document.getElementById('audio-source');
    const audioFileMode = document.getElementById('audio-file-mode');
    const audioSampleMode = document.getElementById('audio-sample-mode');
    const sampleSelect = document.getElementById('sample-audio-select');
    const soundFileInput = document.getElementById('sound-file');

    // Load available samples
    await this.loadAndPopulateSamples();

    // Audio source mode switcher
    if (audioSourceSelect) {
      audioSourceSelect.addEventListener('change', (e) => {
        const mode = e.target.value;
        
        if (mode === 'file') {
          audioFileMode.style.display = 'block';
          audioSampleMode.style.display = 'none';
        } else if (mode === 'sample') {
          audioFileMode.style.display = 'none';
          audioSampleMode.style.display = 'block';
        } else {
          // none
          audioFileMode.style.display = 'none';
          audioSampleMode.style.display = 'none';
          // Clear any selected file or sample
          if (soundFileInput) soundFileInput.value = '';
          if (sampleSelect) sampleSelect.value = '';
        }
      });
    }

    if (!sampleSelect) return;

    // Get preview elements
    const previewContainer = document.getElementById('sample-preview-container');
    const previewPlayer = document.getElementById('sample-preview-player');
    const previewName = document.getElementById('sample-preview-name');
    const previewClose = document.getElementById('sample-preview-close');

    sampleSelect.addEventListener('change', async (e) => {
      const sampleId = e.target.value;
      
      if (!sampleId) {
        // Clear selection and hide preview
        if (previewContainer) previewContainer.style.display = 'none';
        if (previewPlayer) previewPlayer.src = '';
        return;
      }

      try {
        // Load sample audio
        const arrayBuffer = await this.sampleAudioService.loadSample(sampleId);
        const sample = this.sampleAudioService.getSampleById(sampleId);
        
        // Create a File object from the array buffer
        const blob = new Blob([arrayBuffer], { type: 'audio/mpeg' });
        const file = new File([blob], sample.filename, { type: 'audio/mpeg' });
        
        // Set it as the sound file
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        soundFileInput.files = dataTransfer.files;
        
        // Show preview player
        if (previewContainer && previewPlayer && previewName) {
          const blobUrl = URL.createObjectURL(blob);
          previewPlayer.src = blobUrl;
          previewName.textContent = `${sample.name} - ${sample.description}`;
          previewContainer.style.display = 'block';
        }
        
        // eslint-disable-next-line no-console
        console.log(`✓ Loaded sample: ${sample.name}`);
      } catch (error) {
        console.error('Failed to load sample:', error);
        alert(`Failed to load sample audio: ${error.message}`);
        e.target.value = ''; // Reset selection
        if (previewContainer) previewContainer.style.display = 'none';
      }
    });

    // Close preview button
    if (previewClose) {
      previewClose.addEventListener('click', () => {
        if (previewContainer) previewContainer.style.display = 'none';
        if (previewPlayer) {
          previewPlayer.pause();
          previewPlayer.currentTime = 0;
        }
      });
    }

    // Clear sample selection when user uploads their own file
    if (soundFileInput) {
      soundFileInput.addEventListener('change', () => {
        if (soundFileInput.files.length > 0) {
          sampleSelect.value = '';
          if (previewContainer) previewContainer.style.display = 'none';
          if (previewPlayer) previewPlayer.src = '';
        }
      });
    }
  }

  /**
   * Setup EQ controls
   */
  setupEQControls() {
    const eqLow = document.getElementById('eq-low');
    const eqMid = document.getElementById('eq-mid');
    const eqHigh = document.getElementById('eq-high');
    const eqResetBtn = document.getElementById('eq-reset-btn');

    // EQ slider event listeners
    if (eqLow) {
      eqLow.addEventListener('input', (e) => {
        const gain = parseFloat(e.target.value);
        this.audioService.setEQGain('low', gain);
      });
    }

    if (eqMid) {
      eqMid.addEventListener('input', (e) => {
        const gain = parseFloat(e.target.value);
        this.audioService.setEQGain('mid', gain);
      });
    }

    if (eqHigh) {
      eqHigh.addEventListener('input', (e) => {
        const gain = parseFloat(e.target.value);
        this.audioService.setEQGain('high', gain);
      });
    }

    // Reset button
    if (eqResetBtn) {
      eqResetBtn.addEventListener('click', () => {
        this.audioService.resetEQ();
        
        // Reset UI sliders
        if (eqLow) {
          eqLow.value = 0;
          const valueDisplay = document.getElementById('eq-low-value');
          if (valueDisplay) valueDisplay.textContent = '0';
        }
        if (eqMid) {
          eqMid.value = 0;
          const valueDisplay = document.getElementById('eq-mid-value');
          if (valueDisplay) valueDisplay.textContent = '0';
        }
        if (eqHigh) {
          eqHigh.value = 0;
          const valueDisplay = document.getElementById('eq-high-value');
          if (valueDisplay) valueDisplay.textContent = '0';
        }
      });
    }
  }
}
