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
      const attenuation = parseInt(formData.get('attenuation')) || 0;
      const fadeIn = parseInt(formData.get('fade-in')) || 3000;
      const fadeOut = parseInt(formData.get('fade-out')) || 6000;

      // Validate files
      this.updateProgress(5, 'Validating files...');
      this.fileService.validateFileSize(phraseFile, 10);
      if (soundFile) {
        this.fileService.validateFileSize(soundFile, 50);
      }

      // Read phrase file
      this.updateProgress(10, 'Reading phrase file...');
      const phraseContent = await this.fileService.readTextFile(phraseFile);
      const phrases = parseTextFile(phraseContent);

      // Set TTS engine
      this.ttsService.setEngine(ttsEngine);

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
        const speechBlob = await this.ttsService.generatePhrase(phrase, {
          slow: slowSpeech,
        });

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
      if (soundFile) {
        this.updateProgress(90, 'Mixing with background sound...');
        const soundArrayBuffer =
          await this.fileService.readAudioFile(soundFile);
        const backgroundBuffer =
          await this.audioService.decodeAudioData(soundArrayBuffer);

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
