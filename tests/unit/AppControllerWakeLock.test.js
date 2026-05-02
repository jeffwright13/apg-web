/**
 * Tests for AppController — wake lock (keep-screen-awake) feature
 */

import { jest } from '@jest/globals';
import { AppController } from '../../scripts/controllers/AppController.js';

// ── Wake lock mock ────────────────────────────────────────────────────────────

let mockSentinel;
let mockWakeLock;

function setupWakeLockMock() {
  mockSentinel = { release: jest.fn().mockResolvedValue(undefined) };
  mockWakeLock = { request: jest.fn().mockResolvedValue(mockSentinel) };
  Object.defineProperty(navigator, 'wakeLock', {
    value: mockWakeLock,
    configurable: true,
    writable: true,
  });
}

function removeWakeLockMock() {
  delete navigator.wakeLock;
}

// ── DOM helpers ───────────────────────────────────────────────────────────────

function setupDOM() {
  document.body.innerHTML = `
    <div id="keep-awake-section" style="display: none;"></div>
    <input type="checkbox" id="keep-awake-toggle" />
    <div id="playback-controls" style="display: none;"></div>
    <div id="download-controls" style="display: none;"></div>
    <div id="progress-container" style="display: none;"></div>
    <button id="play-btn"></button>
    <button id="stop-btn"></button>
    <audio id="audio-player"></audio>
    <button id="download-btn">Download</button>
  `;
}

global.URL.createObjectURL = () => 'blob:mock-url';
global.URL.revokeObjectURL = () => {};

function makeController() {
  const controller = new AppController();
  // Wire DOM refs normally set by initialize()
  controller.keepAwakeSection = document.getElementById('keep-awake-section');
  controller.keepAwakeToggle = document.getElementById('keep-awake-toggle');
  controller.progressContainer = document.getElementById('progress-container');
  controller.playBtn = document.getElementById('play-btn');
  controller.stopBtn = document.getElementById('stop-btn');
  controller.audioPlayer = document.getElementById('audio-player');
  controller.downloadBtn = document.getElementById('download-btn');
  return controller;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AppController — wake lock', () => {
  let controller;

  beforeEach(() => {
    setupDOM();
    localStorage.clear();
    setupWakeLockMock();
    controller = makeController();
  });

  afterEach(() => {
    removeWakeLockMock();
  });

  // ── acquireWakeLock ─────────────────────────────────────────────────────────

  describe('acquireWakeLock', () => {
    test('requests screen wake lock when enabled', async () => {
      controller.keepAwakeEnabled = true;
      await controller.acquireWakeLock();
      expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
      expect(controller._wakeLockSentinel).toBe(mockSentinel);
    });

    test('skips request when disabled', async () => {
      controller.keepAwakeEnabled = false;
      await controller.acquireWakeLock();
      expect(navigator.wakeLock.request).not.toHaveBeenCalled();
      expect(controller._wakeLockSentinel).toBeNull();
    });

    test('does not throw when navigator.wakeLock is unavailable', async () => {
      removeWakeLockMock();
      controller.keepAwakeEnabled = true;
      await expect(controller.acquireWakeLock()).resolves.toBeUndefined();
    });

    test('does not throw when wake lock request is denied', async () => {
      navigator.wakeLock.request = jest.fn().mockRejectedValue(new DOMException('NotAllowedError'));
      controller.keepAwakeEnabled = true;
      await expect(controller.acquireWakeLock()).resolves.toBeUndefined();
      expect(controller._wakeLockSentinel).toBeNull();
    });
  });

  // ── releaseWakeLock ─────────────────────────────────────────────────────────

  describe('releaseWakeLock', () => {
    test('releases sentinel and nulls it', async () => {
      controller._wakeLockSentinel = mockSentinel;
      await controller.releaseWakeLock();
      expect(mockSentinel.release).toHaveBeenCalled();
      expect(controller._wakeLockSentinel).toBeNull();
    });

    test('is a no-op when sentinel is already null', async () => {
      controller._wakeLockSentinel = null;
      await expect(controller.releaseWakeLock()).resolves.toBeUndefined();
    });

    test('nulls sentinel even when release throws', async () => {
      const failSentinel = { release: jest.fn().mockRejectedValue(new Error('already released')) };
      controller._wakeLockSentinel = failSentinel;
      await controller.releaseWakeLock();
      expect(controller._wakeLockSentinel).toBeNull();
    });

    test('prevents double-release: second call is a no-op', async () => {
      controller._wakeLockSentinel = mockSentinel;
      await controller.releaseWakeLock();
      await controller.releaseWakeLock();
      expect(mockSentinel.release).toHaveBeenCalledTimes(1);
    });
  });

  // ── handleKeepAwakeToggle ───────────────────────────────────────────────────

  describe('handleKeepAwakeToggle', () => {
    test('saves true and sets keepAwakeEnabled when checked', () => {
      controller.keepAwakeToggle.checked = true;
      controller.handleKeepAwakeToggle();
      expect(controller.keepAwakeEnabled).toBe(true);
      expect(localStorage.getItem('keepAwakeEnabled')).toBe('true');
    });

    test('saves false and sets keepAwakeEnabled when unchecked', () => {
      controller.keepAwakeToggle.checked = false;
      controller.handleKeepAwakeToggle();
      expect(controller.keepAwakeEnabled).toBe(false);
      expect(localStorage.getItem('keepAwakeEnabled')).toBe('false');
    });

    test('releases wake lock when unchecked', async () => {
      controller._wakeLockSentinel = mockSentinel;
      controller.keepAwakeToggle.checked = false;
      controller.handleKeepAwakeToggle();
      await Promise.resolve(); // flush microtasks
      expect(mockSentinel.release).toHaveBeenCalled();
    });

    test('does not release wake lock when checked', async () => {
      controller._wakeLockSentinel = mockSentinel;
      controller.keepAwakeToggle.checked = true;
      controller.handleKeepAwakeToggle();
      await Promise.resolve();
      expect(mockSentinel.release).not.toHaveBeenCalled();
    });
  });

  // ── handleVisibilityChange ──────────────────────────────────────────────────

  describe('handleVisibilityChange', () => {
    afterEach(() => {
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    });

    test('re-acquires wake lock when page becomes visible while playing with toggle on', async () => {
      controller.keepAwakeEnabled = true;
      controller.isPlaying = true;
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      await controller.handleVisibilityChange();
      expect(navigator.wakeLock.request).toHaveBeenCalledWith('screen');
    });

    test('does not acquire when page is still hidden', async () => {
      controller.keepAwakeEnabled = true;
      controller.isPlaying = true;
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      await controller.handleVisibilityChange();
      expect(navigator.wakeLock.request).not.toHaveBeenCalled();
    });

    test('does not acquire when not playing', async () => {
      controller.keepAwakeEnabled = true;
      controller.isPlaying = false;
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      await controller.handleVisibilityChange();
      expect(navigator.wakeLock.request).not.toHaveBeenCalled();
    });

    test('does not acquire when toggle is off', async () => {
      controller.keepAwakeEnabled = false;
      controller.isPlaying = true;
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      await controller.handleVisibilityChange();
      expect(navigator.wakeLock.request).not.toHaveBeenCalled();
    });
  });

  // ── showWebSpeechControls ───────────────────────────────────────────────────

  describe('showWebSpeechControls', () => {
    test('shows keep-awake section', () => {
      controller.showWebSpeechControls();
      expect(document.getElementById('keep-awake-section').style.display).toBe('block');
    });
  });

  // ── showOutput ──────────────────────────────────────────────────────────────

  describe('showOutput', () => {
    test('shows keep-awake section', () => {
      controller.currentAudioBlob = new Blob([], { type: 'audio/mp3' });
      controller.showOutput();
      expect(document.getElementById('keep-awake-section').style.display).toBe('block');
    });
  });
});
