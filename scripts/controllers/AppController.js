/**
 * Main application controller
 * Orchestrates the audio generation workflow
 */

export class AppController {
  constructor() {
    this.form = null;
    this.generateBtn = null;
    this.progressSection = null;
    this.outputSection = null;
  }

  initialize() {
    this.form = document.getElementById('apg-form');
    this.generateBtn = document.getElementById('generate-btn');
    this.progressSection = document.getElementById('progress-section');
    this.outputSection = document.getElementById('output-section');

    this.attachEventListeners();
  }

  attachEventListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleSubmit(event) {
    event.preventDefault();

    // Show progress section
    this.progressSection.style.display = 'block';
    this.outputSection.style.display = 'none';

    // TODO: Implement audio generation workflow
    this.updateProgress(0, 'Starting...');

    // Placeholder for now
    setTimeout(() => {
      this.updateProgress(100, 'Complete!');
      this.showOutput();
    }, 1000);
  }

  updateProgress(value, text) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    progressBar.value = value;
    progressText.textContent = text;
  }

  showOutput() {
    this.outputSection.style.display = 'block';
  }
}
