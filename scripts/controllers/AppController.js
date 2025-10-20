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
    this.progressSection = null;
    this.outputSection = null;
    this.audioPlayer = null;
    this.downloadBtn = null;

    // Services
    this.fileService = new FileService();
    this.ttsService = new TTSService();
    this.audioService = new AudioService();

    // State
    this.currentAudioBlob = null;
  }

  initialize() {
    this.form = document.getElementById('apg-form');
    this.generateBtn = document.getElementById('generate-btn');
    this.progressSection = document.getElementById('progress-section');
    this.outputSection = document.getElementById('output-section');
    this.audioPlayer = document.getElementById('audio-player');
    this.downloadBtn = document.getElementById('download-btn');

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    this.downloadBtn.addEventListener('click', () => this.handleDownload());

    const resetBtn = document.getElementById('reset-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.handleReset());
    }
  }

  handleReset() {
    // Reset form
    this.form.reset();

    // Hide output sections
    this.progressSection.style.display = 'none';
    this.outputSection.style.display = 'none';

    // Stop any ongoing speech
    this.ttsService.stopSpeech();

    // Clear audio blob
    this.currentAudioBlob = null;

    // Reset audio player
    if (this.audioPlayer.src) {
      URL.revokeObjectURL(this.audioPlayer.src);
      this.audioPlayer.src = '';
    }
  }

  async handleSubmit(event) {
    event.preventDefault();

    try {
      // Show progress section
      this.progressSection.style.display = 'block';
      this.outputSection.style.display = 'none';
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
        this.updateProgress(20, 'Starting playback...');

        await this.ttsService.playPhrasesWebAPI(
          phrases,
          { slow: slowSpeech },
          (current, total) => {
            const progress = 20 + (70 * current) / total;
            this.updateProgress(progress, `Playing phrase ${current}/${total}`);
          }
        );

        this.updateProgress(100, 'Playback complete!');
        this.showWebSpeechMessage();
        return;
      }

      // Premium TTS engines (with mixing/export support)
      // TODO: Implement ElevenLabs and Google Cloud TTS
      this.showError(
        `${ttsEngine} is not yet implemented. Please use Web Speech API for now, or wait for premium TTS integration.`
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
    this.outputSection.style.display = 'block';
  }

  showWebSpeechMessage() {
    this.outputSection.style.display = 'block';
    this.audioPlayer.style.display = 'none';
    this.downloadBtn.style.display = 'none';

    const message = document.createElement('p');
    message.innerHTML = `
      <strong>Playback complete!</strong><br><br>
      <em>Note: Web Speech API plays directly through your speakers and doesn't support audio export or background mixing.</em><br><br>
      For export and mixing features, use a premium TTS engine (ElevenLabs or Google Cloud TTS).
    `;
    message.style.textAlign = 'center';
    message.style.color = 'var(--muted-color)';

    // Clear previous messages
    const existingMessage = this.outputSection.querySelector('p');
    if (existingMessage) {
      existingMessage.remove();
    }

    this.outputSection.querySelector('article').appendChild(message);
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
