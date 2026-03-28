/**
 * Tests for AppController — handleTestOpenAIApiKey and handlePreviewOpenAIVoice
 */

import { AppController } from '../../scripts/controllers/AppController.js';

// ── Fetch mock ────────────────────────────────────────────────────────────────

const mockFetchCalls = [];
global.fetch = (...args) => {
  mockFetchCalls.push(args);
  return fetch.mockImplementation(...args);
};
fetch.mockImplementation = null;
fetch.mockClear = () => {
  mockFetchCalls.length = 0;
  fetch.mockImplementation = null;
};
fetch.mockResolvedValueOnce = (value) => {
  const prev = fetch.mockImplementation;
  fetch.mockImplementation = () => {
    fetch.mockImplementation = prev;
    return Promise.resolve(value);
  };
};
fetch.mockRejectedValueOnce = (error) => {
  const prev = fetch.mockImplementation;
  fetch.mockImplementation = () => {
    fetch.mockImplementation = prev;
    return Promise.reject(error);
  };
};
fetch.mock = { get calls() { return mockFetchCalls; } };

// ── Audio mock ────────────────────────────────────────────────────────────────

let mockAudioInstance;
class MockAudio {
  constructor() {
    this.onended = null;
    this.onerror = null;
    mockAudioInstance = this;
  }
  play() { return Promise.resolve(); }
}
global.Audio = MockAudio;

// ── URL mock ──────────────────────────────────────────────────────────────────

const urlMock = {
  createCalls: [],
  revokeCalls: [],
  clear() { this.createCalls = []; this.revokeCalls = []; },
};
global.URL.createObjectURL = (blob) => { urlMock.createCalls.push(blob); return 'blob:mock-url'; };
global.URL.revokeObjectURL = (url) => { urlMock.revokeCalls.push(url); };

// ── setTimeout mock ───────────────────────────────────────────────────────────
// Captures callbacks so tests can trigger resets immediately without real delays

const pendingTimeouts = [];
global.setTimeout = (fn) => { pendingTimeouts.push(fn); };

function flushTimeouts() {
  while (pendingTimeouts.length) pendingTimeouts.shift()();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setupDOM() {
  document.body.innerHTML = `
    <button id="test-openai-key-btn" class="secondary">Test</button>
    <input id="openai-api-key" type="password" value="" />
    <button id="preview-openai-voice-btn" class="secondary">Test</button>
    <select id="openai-voice">
      <option value="nova" selected>Nova</option>
      <option value="echo">Echo</option>
    </select>
    <select id="openai-model">
      <option value="tts-1" selected>TTS-1</option>
      <option value="gpt-4o-mini-tts">GPT-4o</option>
    </select>
  `;
}

function mockOkResponse(body = new ArrayBuffer(8)) {
  return {
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(body),
  };
}

function mockErrorResponse(status = 401) {
  return { ok: false, status };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AppController', () => {
  let controller;

  beforeEach(() => {
    setupDOM();
    fetch.mockClear();
    localStorage.clear();
    urlMock.clear();
    pendingTimeouts.length = 0;
    mockAudioInstance = undefined;
    controller = new AppController();
  });

  afterEach(() => {
    pendingTimeouts.length = 0;
  });

  // ── handleTestOpenAIApiKey ────────────────────────────────────────────────

  describe('handleTestOpenAIApiKey', () => {
    test('shows error and no fetch when input is empty', async () => {
      await controller.handleTestOpenAIApiKey();

      const btn = document.getElementById('test-openai-key-btn');
      expect(btn.textContent).toBe('❌ No key entered');
      expect(btn.disabled).toBe(true);
      expect(fetch.mock.calls).toHaveLength(0);
    });

    test('resets button after timeout when key is empty', async () => {
      await controller.handleTestOpenAIApiKey();
      flushTimeouts();

      const btn = document.getElementById('test-openai-key-btn');
      expect(btn.textContent).toBe('Test');
      expect(btn.disabled).toBe(false);
    });

    test('calls /v1/models with Authorization header', async () => {
      document.getElementById('openai-api-key').value = 'sk-testkey123';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handleTestOpenAIApiKey();

      expect(fetch.mock.calls).toHaveLength(1);
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/models');
      expect(opts.headers.Authorization).toBe('Bearer sk-testkey123');
    });

    test('shows Valid and adds contrast class on success', async () => {
      document.getElementById('openai-api-key').value = 'sk-testkey123';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handleTestOpenAIApiKey();

      const btn = document.getElementById('test-openai-key-btn');
      expect(btn.textContent).toBe('✅ Valid');
      expect(btn.classList.contains('contrast')).toBe(true);
      expect(btn.classList.contains('secondary')).toBe(false);
    });

    test('resets to Test after timeout on success', async () => {
      document.getElementById('openai-api-key').value = 'sk-testkey123';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handleTestOpenAIApiKey();
      flushTimeouts();

      const btn = document.getElementById('test-openai-key-btn');
      expect(btn.textContent).toBe('Test');
      expect(btn.disabled).toBe(false);
      expect(btn.classList.contains('secondary')).toBe(true);
      expect(btn.classList.contains('contrast')).toBe(false);
    });

    test('shows Invalid key on non-ok response', async () => {
      document.getElementById('openai-api-key').value = 'sk-badkey';
      fetch.mockResolvedValueOnce(mockErrorResponse(401));

      await controller.handleTestOpenAIApiKey();

      expect(document.getElementById('test-openai-key-btn').textContent).toBe('❌ Invalid key');
    });

    test('resets button after timeout on invalid key', async () => {
      document.getElementById('openai-api-key').value = 'sk-badkey';
      fetch.mockResolvedValueOnce(mockErrorResponse(401));

      await controller.handleTestOpenAIApiKey();
      flushTimeouts();

      const btn = document.getElementById('test-openai-key-btn');
      expect(btn.textContent).toBe('Test');
      expect(btn.disabled).toBe(false);
    });

    test('shows Network error on fetch exception', async () => {
      document.getElementById('openai-api-key').value = 'sk-testkey123';
      fetch.mockRejectedValueOnce(new Error('Network failure'));

      await controller.handleTestOpenAIApiKey();

      expect(document.getElementById('test-openai-key-btn').textContent).toBe('❌ Network error');
    });
  });

  // ── handlePreviewOpenAIVoice ──────────────────────────────────────────────

  describe('handlePreviewOpenAIVoice', () => {
    test('shows error and no fetch when no API key is saved', async () => {
      await controller.handlePreviewOpenAIVoice();

      const btn = document.getElementById('preview-openai-voice-btn');
      expect(btn.textContent).toBe('❌ No API key saved');
      expect(fetch.mock.calls).toHaveLength(0);
    });

    test('resets button after timeout when no key saved', async () => {
      await controller.handlePreviewOpenAIVoice();
      flushTimeouts();

      expect(document.getElementById('preview-openai-voice-btn').textContent).toBe('Test');
    });

    test('calls /v1/audio/speech with correct params', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      expect(fetch.mock.calls).toHaveLength(1);
      const [url, opts] = fetch.mock.calls[0];
      expect(url).toBe('https://api.openai.com/v1/audio/speech');
      expect(opts.headers.Authorization).toBe('Bearer sk-savedkey');

      const body = JSON.parse(opts.body);
      expect(body.voice).toBe('nova');
      expect(body.model).toBe('tts-1');
      expect(body.response_format).toBe('mp3');
      expect(body.input).toContain('Nova');
    });

    test('uses selected voice and model from dropdowns', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('openai-voice').value = 'echo';
      document.getElementById('openai-model').value = 'gpt-4o-mini-tts';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.voice).toBe('echo');
      expect(body.model).toBe('gpt-4o-mini-tts');
      expect(body.input).toContain('Echo');
    });

    test('shows Playing state and creates audio object on success', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      const btn = document.getElementById('preview-openai-voice-btn');
      expect(btn.textContent).toBe('🔊 Playing...');
      expect(btn.disabled).toBe(true);
      expect(urlMock.createCalls).toHaveLength(1);
      expect(mockAudioInstance).toBeDefined();
    });

    test('resets button and revokes URL when audio ends', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();
      mockAudioInstance.onended();

      const btn = document.getElementById('preview-openai-voice-btn');
      expect(btn.textContent).toBe('Test');
      expect(btn.disabled).toBe(false);
      expect(urlMock.revokeCalls).toContain('blob:mock-url');
    });

    test('shows Playback error and revokes URL on audio error', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();
      mockAudioInstance.onerror();

      const btn = document.getElementById('preview-openai-voice-btn');
      expect(btn.textContent).toBe('❌ Playback error');
      expect(urlMock.revokeCalls).toContain('blob:mock-url');
    });

    test('resets button after timeout on playback error', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();
      mockAudioInstance.onerror();
      flushTimeouts();

      const btn = document.getElementById('preview-openai-voice-btn');
      expect(btn.textContent).toBe('Test');
      expect(btn.disabled).toBe(false);
    });

    test('shows API error on non-ok response', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockResolvedValueOnce(mockErrorResponse(500));

      await controller.handlePreviewOpenAIVoice();

      expect(document.getElementById('preview-openai-voice-btn').textContent).toBe('❌ API error');
    });

    test('shows Network error on fetch exception', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockRejectedValueOnce(new Error('Network failure'));

      await controller.handlePreviewOpenAIVoice();

      expect(document.getElementById('preview-openai-voice-btn').textContent).toBe('❌ Network error');
    });
  });
});
