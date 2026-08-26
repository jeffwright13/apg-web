/**
 * Tests for AppController — crash-recovery breadcrumbs
 *
 * On mobile, background-mixed generations were observed to silently reload
 * the tab with no JS error ever firing (the OS kills the renderer process).
 * These breadcrumbs record the last-reached pipeline stage to localStorage
 * so the NEXT page load can report exactly where a run died, without a live
 * console attached to the device.
 */

import { AppController } from '../../scripts/controllers/AppController.js';

function setupDOM() {
  document.body.innerHTML = `
    <div id="crash-breadcrumb-banner" style="display: none;"></div>
    <div id="progress-container" style="display: none;"></div>
    <progress id="progress-bar"></progress>
    <span id="progress-text"></span>
    <div id="playback-controls" style="display: none;"></div>
    <div id="download-controls" style="display: none;"></div>
    <button id="generate-btn"></button>
    <button id="stop-generation-btn" style="display: none;"></button>
    <button id="download-btn">Download</button>
    <audio id="audio-player"></audio>
  `;
}

function makeController() {
  const controller = new AppController();
  controller.crashBanner = document.getElementById('crash-breadcrumb-banner');
  controller.progressContainer = document.getElementById('progress-container');
  controller.downloadBtn = document.getElementById('download-btn');
  controller.audioPlayer = document.getElementById('audio-player');
  return controller;
}

// Records marks in order without touching real localStorage timing, so
// tests can assert the exact stage sequence a run produces.
function makeSpyBreadcrumbs() {
  return {
    marks: [],
    cleared: false,
    mark(stage, meta = {}) { this.marks.push({ stage, meta }); },
    clear() { this.cleared = true; },
    getLastIncomplete() { return null; },
  };
}

global.URL.createObjectURL = () => 'blob:mock-url';
global.URL.revokeObjectURL = () => {};

describe('AppController — crash breadcrumbs', () => {
  let controller;

  beforeEach(() => {
    setupDOM();
    localStorage.clear();
    controller = makeController();
  });

  // ── checkForCrashBreadcrumb ─────────────────────────────────────────────

  describe('checkForCrashBreadcrumb', () => {
    test('does nothing when no breadcrumb exists', () => {
      controller.checkForCrashBreadcrumb();

      expect(controller.crashBanner.style.display).toBe('none');
      expect(controller.crashBanner.textContent).toBe('');
    });

    test('shows the last stage reached and clears the breadcrumb', () => {
      controller.breadcrumbs.mark('mix-start', { attenuation: -6 });

      controller.checkForCrashBreadcrumb();

      expect(controller.crashBanner.style.display).toBe('block');
      expect(controller.crashBanner.textContent).toContain('mix-start');
      expect(controller.breadcrumbs.getLastIncomplete()).toBeNull();
    });

    test('does not throw when crashBanner element is missing', () => {
      controller.crashBanner = null;
      controller.breadcrumbs.mark('wav-encode-start');

      expect(() => controller.checkForCrashBreadcrumb()).not.toThrow();
      // Still clears the stale breadcrumb even without a place to show it
      expect(controller.breadcrumbs.getLastIncomplete()).toBeNull();
    });
  });

  // ── generateAndFinalize stage marking ────────────────────────────────────

  describe('generateAndFinalize breadcrumb marking', () => {
    let mockBuffer;

    beforeEach(() => {
      mockBuffer = { duration: 2, sampleRate: 24000, numberOfChannels: 1 };

      controller.updateProgress = () => {};
      controller.generationCancelled = false;
      controller.breadcrumbs = makeSpyBreadcrumbs();
      controller.generateOrGetCachedSpeech = async () => ({ arrayBuffer: async () => new ArrayBuffer(8) });
      controller.audioService = {
        decodeAudioData: async () => mockBuffer,
        createSilence: (ms) => ({ silence: ms }),
        concatenateBuffers: (bufs) => ({ concatenated: bufs }),
        mixBuffers: () => mockBuffer,
        applyFades: () => mockBuffer,
        audioBufferToWav: () => new Blob([new ArrayBuffer(4)], { type: 'audio/wav' }),
      };
      controller.fileService = { readAudioFile: async () => new ArrayBuffer(8) };
      controller.saveCurrentProject = async () => {};
      controller.showOutput = () => {};
    });

    test('marks each stage of a run with no background file, ending in complete', async () => {
      const phrases = [{ phrase: 'Hello', duration: 0 }];
      const fd = { get: () => null };

      await controller.generateAndFinalize(phrases, 'openai', {}, null, fd);

      const stages = controller.breadcrumbs.marks.map((m) => m.stage);
      expect(stages).toEqual([
        'speech-loop-start',
        'phrase-generated',
        'concatenate-start',
        'concatenate-done',
        'wav-encode-start',
        'wav-encode-done',
        'complete',
      ]);
    });

    test('includes background mix stages when a sound file is provided', async () => {
      const phrases = [{ phrase: 'Hello', duration: 0 }];
      const soundFile = { size: 1024 };
      const fd = { get: (k) => ({ attenuation: '-6', 'fade-in': '3000', 'fade-out': '6000' }[k] ?? null) };

      await controller.generateAndFinalize(phrases, 'openai', {}, soundFile, fd);

      const stages = controller.breadcrumbs.marks.map((m) => m.stage);
      expect(stages).toEqual([
        'speech-loop-start',
        'phrase-generated',
        'concatenate-start',
        'concatenate-done',
        'background-decode-start',
        'background-decode-done',
        'mix-start',
        'mix-done',
        'wav-encode-start',
        'wav-encode-done',
        'complete',
      ]);
    });

    test('does not mark complete when generation is cancelled', async () => {
      controller.generationCancelled = true;
      const phrases = [{ phrase: 'Hello', duration: 0 }];
      const fd = { get: () => null };

      await expect(
        controller.generateAndFinalize(phrases, 'openai', {}, null, fd)
      ).rejects.toThrow('Generation cancelled by user');

      expect(controller.breadcrumbs.marks.map((m) => m.stage)).not.toContain('complete');
    });

    test('phrase-generated marks include index and total in meta', async () => {
      const phrases = [
        { phrase: 'One', duration: 0 },
        { phrase: 'Two', duration: 0 },
      ];
      const fd = { get: () => null };

      await controller.generateAndFinalize(phrases, 'openai', {}, null, fd);

      const phraseMarks = controller.breadcrumbs.marks.filter((m) => m.stage === 'phrase-generated');
      expect(phraseMarks).toEqual([
        { stage: 'phrase-generated', meta: { index: 1, total: 2 } },
        { stage: 'phrase-generated', meta: { index: 2, total: 2 } },
      ]);
    });
  });

  // ── handleSubmit clears breadcrumbs once JS is confirmed still running ──

  describe('handleSubmit breadcrumb lifecycle', () => {
    test('clears the breadcrumb in finally after a successful run', async () => {
      controller.form = document.createElement('form');
      controller.stopGenerationBtn = document.getElementById('stop-generation-btn');
      controller.generateBtn = document.getElementById('generate-btn');
      controller.outputSection = document.createElement('div');
      controller.keepAwakeSection = null;
      controller.inputMode = 'editor';
      document.body.innerHTML += '<textarea id="apg-editor">Hello world</textarea>';

      controller.ttsService = { setEngine: () => {} };
      controller.buildTtsOptions = () => ({});
      controller.generateAndFinalize = async () => {
        controller.breadcrumbs.mark('speech-loop-start', { totalPhrases: 1 });
      };

      const fakeEvent = { preventDefault: () => {} };
      await controller.handleSubmit(fakeEvent);

      expect(controller.breadcrumbs.getLastIncomplete()).toBeNull();
    });
  });
});
