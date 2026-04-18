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
    this.volume = 1;
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
    <button id="preview-openai-voice-btn" class="secondary">Preview</button>
    <select id="openai-voice">
      <option value="nova" selected>Nova</option>
      <option value="echo">Echo</option>
    </select>
    <select id="openai-model">
      <option value="tts-1" selected>TTS-1</option>
      <option value="gpt-4o-mini-tts">GPT-4o</option>
    </select>
    <div id="openai-instructions-section" style="display: none;">
      <textarea id="openai-voice-instructions"></textarea>
    </div>
    <input id="preview-volume" type="range" min="0" max="1" step="0.05" value="0.8" />
    <span id="preview-volume-value">80%</span>
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

// ── Cache mock ────────────────────────────────────────────────────────────────

function makeCacheMock({ hit = false } = {}) {
  const setCalls = [];
  return {
    setCalls,
    get: async () => hit ? new Blob([new ArrayBuffer(8)], { type: 'audio/mpeg' }) : null,
    set: async (...args) => { setCalls.push(args); },
  };
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
    // Replace real cache service with a controllable mock
    controller.cacheService = makeCacheMock();
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

      expect(document.getElementById('preview-openai-voice-btn').textContent).toBe('Preview');
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
      expect(btn.textContent).toBe('Preview');
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
      expect(btn.textContent).toBe('Preview');
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

    test('stores result in cache after successful API call', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      expect(controller.cacheService.setCalls).toHaveLength(1);
      const [text, engine, options, blob] = controller.cacheService.setCalls[0];
      expect(text).toContain('Nova');
      expect(engine).toBe('openai');
      expect(options.voice).toBe('nova');
      expect(options.model).toBe('tts-1');
      expect(options.format).toBe('mp3');
      expect(blob).toBeInstanceOf(Blob);
    });

    test('uses cached blob and skips fetch on cache hit', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      controller.cacheService = makeCacheMock({ hit: true });

      await controller.handlePreviewOpenAIVoice();

      expect(fetch.mock.calls).toHaveLength(0);
      expect(document.getElementById('preview-openai-voice-btn').textContent).toBe('🔊 Playing...');
      expect(urlMock.createCalls).toHaveLength(1);
    });

    test('does not store to cache on cache hit', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      controller.cacheService = makeCacheMock({ hit: true });

      await controller.handlePreviewOpenAIVoice();

      expect(controller.cacheService.setCalls).toHaveLength(0);
    });

    test('includes instructions in request body when model is gpt-4o-mini-tts', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('openai-model').value = 'gpt-4o-mini-tts';
      document.getElementById('openai-voice-instructions').value = 'Speak slowly and calmly.';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.instructions).toBe('Speak slowly and calmly.');
    });

    test('omits instructions from request body for non-gpt-4o-mini-tts models', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('openai-model').value = 'tts-1';
      document.getElementById('openai-voice-instructions').value = 'Speak slowly and calmly.';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.instructions).toBeUndefined();
    });

    test('omits instructions when textarea is empty', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('openai-model').value = 'gpt-4o-mini-tts';
      document.getElementById('openai-voice-instructions').value = '';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      const body = JSON.parse(fetch.mock.calls[0][1].body);
      expect(body.instructions).toBeUndefined();
    });

    test('includes instructions in cache options when present', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('openai-model').value = 'gpt-4o-mini-tts';
      document.getElementById('openai-voice-instructions').value = 'Calm tone.';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      const [, , options] = controller.cacheService.setCalls[0];
      expect(options.instructions).toBe('Calm tone.');
    });

    test('excludes instructions from cache options when model is not gpt-4o-mini-tts', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('openai-model').value = 'tts-1';
      document.getElementById('openai-voice-instructions').value = 'Calm tone.';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      const [, , options] = controller.cacheService.setCalls[0];
      expect(options.instructions).toBeUndefined();
    });

    test('applies preview-volume slider value to audio volume', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('preview-volume').value = '0.5';
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      expect(mockAudioInstance.volume).toBe(0.5);
    });

    test('defaults audio volume to 0.8 when slider is absent', async () => {
      localStorage.setItem('openai-tts-api-key', 'sk-savedkey');
      document.getElementById('preview-volume').remove();
      fetch.mockResolvedValueOnce(mockOkResponse());

      await controller.handlePreviewOpenAIVoice();

      expect(mockAudioInstance.volume).toBe(0.8);
    });
  });

  // ── restoreProject ────────────────────────────────────────────────────────

  function setupRestoreDOM() {
      // Append only elements not already created by setupDOM()
      document.body.innerHTML += `
        <input id="program-description" type="text" value="" />
        <textarea id="apg-editor"></textarea>
        <select id="input-mode">
          <option value="file" selected>File</option>
          <option value="editor">Editor</option>
        </select>
        <div id="file-upload-mode"></div>
        <div id="text-editor-mode" style="display:none;"></div>
        <input id="sound-file" type="file" />
        <select id="tts-engine">
          <option value="openai" selected>OpenAI</option>
          <option value="google-cloud">Google</option>
        </select>
        <select id="audio-source">
          <option value="none" selected>None</option>
          <option value="sample">Sample</option>
          <option value="file">File</option>
        </select>
        <select id="sample-audio-select">
          <option value="" selected>-- Select --</option>
          <option value="meditation_yoga_relaxing_music">Meditation</option>
        </select>
        <input id="openai-speed" type="range" value="1.0" />
        <select id="voice-name"><option value="en-US-Neural2-F" selected>F</option></select>
        <input id="speaking-rate" type="range" value="1.0" />
        <input id="pitch" type="range" value="0" />
        <select id="export-format"><option value="mp3" selected>MP3</option></select>
        <select id="mp3-bitrate"><option value="192" selected>192</option></select>
        <div id="output-section" style="display:none;"></div>
        <div id="progress-container" style="display:none;"></div>
        <div id="progress-bar"></div>
        <div id="progress-message"></div>
        <div id="stat-lines"></div>
        <div id="stat-chars"></div>
        <div id="stat-words"></div>
        <div id="auto-save-status"></div>
        <div id="editor-validation" style="display:none;"></div>
      `;
      // Add onyx to the existing openai-voice select (created by setupDOM)
      const voiceSelect = document.getElementById('openai-voice');
      if (voiceSelect && !voiceSelect.querySelector('[value="onyx"]')) {
        voiceSelect.innerHTML += '<option value="onyx">Onyx</option>';
      }
  }

  function makeProject(overrides = {}) {
    return {
      id: 'proj-1',
      name: 'test-program.txt',
      programDescription: 'morning qi gong',
      phraseFileContent: 'Hello;2\nGoodbye;1',
      ttsEngine: 'openai',
      ttsOptions: { voice: 'onyx', model: 'tts-1', speed: 1.2 },
      exportSettings: { format: 'mp3', bitrate: 192 },
      backgroundMusic: null,
      ...overrides,
    };
  }

  describe('restoreProject', () => {
    beforeEach(() => {
      setupRestoreDOM();
      controller.progressContainer = document.getElementById('progress-container');
    });

    test('restores phraseFileContent into the editor textarea', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await controller.restoreProject('proj-1');
      expect(document.getElementById('apg-editor').value).toBe('Hello;2\nGoodbye;1');
    });

    test('switches input mode to editor', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await controller.restoreProject('proj-1');
      expect(document.getElementById('input-mode').value).toBe('editor');
      expect(controller.inputMode).toBe('editor');
    });

    test('shows text-editor-mode panel and hides file-upload-mode', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await controller.restoreProject('proj-1');
      expect(document.getElementById('text-editor-mode').style.display).toBe('block');
      expect(document.getElementById('file-upload-mode').style.display).toBe('none');
    });

    test('saves phrase content to localStorage', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await controller.restoreProject('proj-1');
      expect(localStorage.getItem('apg_editor_content')).toBe('Hello;2\nGoodbye;1');
    });

    test('restores OpenAI voice and model', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await controller.restoreProject('proj-1');
      expect(document.getElementById('openai-voice').value).toBe('onyx');
      expect(document.getElementById('openai-model').value).toBe('tts-1');
    });

    test('restores export format and bitrate', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await controller.restoreProject('proj-1');
      expect(document.getElementById('export-format').value).toBe('mp3');
      expect(document.getElementById('mp3-bitrate').value).toBe('192');
    });

    test('restores background music with fallback type', async () => {
      const blob = new Blob(['audio'], { type: '' }); // no type
      controller.projectCache = {
        getProject: async () => makeProject({ backgroundMusic: blob, backgroundMusicName: 'bg.mp3' }),
      };
      // Patch DataTransfer to capture the file added
      let capturedFile = null;
      global.DataTransfer = class {
        constructor() { this.files = { length: 1 }; }
        get items() { return { add: (f) => { capturedFile = f; } }; }
      };
      // Patch sound-file.files setter
      const soundInput = document.getElementById('sound-file');
      Object.defineProperty(soundInput, 'files', { set() {}, get() { return { length: 1, 0: capturedFile }; }, configurable: true });

      await controller.restoreProject('proj-1');

      expect(capturedFile).not.toBeNull();
      expect(capturedFile.name).toBe('bg.mp3');
      expect(capturedFile.type).toBe('audio/mpeg');
    });

    test('flashes Restore button green then reverts', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      const btn = document.createElement('button');
      btn.textContent = 'Restore';
      await controller.restoreProject('proj-1', btn);
      expect(btn.textContent).toBe('✓ Restored');
      expect(btn.style.color).toBe('white');
      flushTimeouts();
      expect(btn.textContent).toBe('Restore');
      expect(btn.style.color).toBe('');
    });

    test('restores without error when no button is passed', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await expect(controller.restoreProject('proj-1')).resolves.toBeUndefined();
    });

    test('handles project not found gracefully', async () => {
      controller.projectCache = { getProject: async () => null };
      const alertCalls = [];
      global.alert = (msg) => alertCalls.push(msg);
      await controller.restoreProject('missing-id');
      expect(alertCalls).toContain('Project not found');
      expect(document.getElementById('apg-editor').value).toBe('');
    });

    test('restores program description field', async () => {
      controller.projectCache = { getProject: async () => makeProject() };
      await controller.restoreProject('proj-1');
      expect(document.getElementById('program-description').value).toBe('morning qi gong');
    });

    test('clears program description field when project has none', async () => {
      document.getElementById('program-description').value = 'old value';
      controller.projectCache = {
        getProject: async () => makeProject({ programDescription: '' }),
      };
      await controller.restoreProject('proj-1');
      expect(document.getElementById('program-description').value).toBe('');
    });
  });

  // ── createProjectCard ────────────────────────────────────────────────────

  describe('createProjectCard', () => {
    function makeFullProject(overrides = {}) {
      return {
        id: 'proj-1',
        name: 'editor-program.txt',
        programDescription: 'Morning Qi Gong',
        ttsEngine: 'openai',
        ttsOptions: { voice: 'nova', model: 'tts-1', speed: 1.0 },
        backgroundSettings: { source: 'none', sampleName: '', attenuation: -6, fadeIn: 3000, fadeOut: 6000 },
        backgroundMusic: null,
        backgroundMusicName: null,
        timestamp: Date.now(),
        hasBackgroundMusic: false,
        ...overrides,
      };
    }

    beforeEach(() => {
      // projectCache needs formatTimestamp
      controller.projectCache = {
        formatTimestamp: () => '2 days ago',
      };
    });

    test('uses programDescription as title', () => {
      const card = controller.createProjectCard(makeFullProject());
      expect(card.querySelector('strong').textContent).toBe('Morning Qi Gong');
    });

    test('falls back to filename when description is blank and name is not generic', () => {
      const card = controller.createProjectCard(
        makeFullProject({ programDescription: '', name: 'sun-salutation.txt' })
      );
      expect(card.querySelector('strong').textContent).toBe('sun-salutation.txt');
    });

    test('falls back to "Untitled Program" when description blank and name is editor-program.txt', () => {
      const card = controller.createProjectCard(
        makeFullProject({ programDescription: '', name: 'editor-program.txt' })
      );
      expect(card.querySelector('strong').textContent).toBe('Untitled Program');
    });

    test('shows voice name capitalized in meta line', () => {
      const card = controller.createProjectCard(makeFullProject());
      expect(card.textContent).toContain('Voice: Nova');
    });

    test('shows Background: None when source is none', () => {
      const card = controller.createProjectCard(makeFullProject());
      expect(card.textContent).toContain('Background: None');
    });

    test('shows sample name in title case when source is sample', () => {
      const card = controller.createProjectCard(
        makeFullProject({
          backgroundSettings: { source: 'sample', sampleName: 'lunar_new_year', attenuation: -6 },
        })
      );
      expect(card.textContent).toContain('Background: Lunar New Year');
    });

    test('shows background music filename when source is file', () => {
      const card = controller.createProjectCard(
        makeFullProject({
          backgroundSettings: { source: 'file', attenuation: -6 },
          backgroundMusicName: 'my-track.mp3',
        })
      );
      expect(card.textContent).toContain('Background: my-track.mp3');
    });

    test('shows timestamp in meta line', () => {
      const card = controller.createProjectCard(makeFullProject());
      expect(card.textContent).toContain('2 days ago');
    });

    test('shows speed when non-default', () => {
      const card = controller.createProjectCard(
        makeFullProject({ ttsOptions: { voice: 'nova', speed: 0.8 } })
      );
      expect(card.textContent).toContain('Speed: 0.8x');
    });

    test('does not show speed when default (1.0)', () => {
      const card = controller.createProjectCard(makeFullProject());
      expect(card.textContent).not.toContain('Speed:');
    });

    test('shows has-instructions flag when instructions present', () => {
      const card = controller.createProjectCard(
        makeFullProject({ ttsOptions: { voice: 'nova', speed: 1.0, instructions: 'Speak calmly.' } })
      );
      expect(card.textContent).toContain('Has instructions');
    });

    test('does not show has-instructions flag when no instructions', () => {
      const card = controller.createProjectCard(makeFullProject());
      expect(card.textContent).not.toContain('Has instructions');
    });

    test('Restore button triggers restoreProject with button reference', () => {
      let capturedId = null;
      let capturedBtn = null;
      controller.restoreProject = (id, btn) => { capturedId = id; capturedBtn = btn; };
      const card = controller.createProjectCard(makeFullProject());
      card.querySelector('button').click();
      expect(capturedId).toBe('proj-1');
      expect(capturedBtn).toBeInstanceOf(HTMLButtonElement);
    });
  });

  // ── buildDownloadFilename ─────────────────────────────────────────────────

  describe('buildDownloadFilename', () => {
    beforeEach(() => {
      setupRestoreDOM();
      controller.currentPhraseFileName = 'test-program.txt';
    });

    test('uses program description field value in filename', () => {
      document.getElementById('program-description').value = 'morning qi gong';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toMatch(/^audio-program_[\d]{8}-[\d]{6}_morning-qi-gong_nova_nobg\.mp3$/);
    });

    test('falls back to phrase filename stem when description is blank', () => {
      document.getElementById('program-description').value = '';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toContain('_test-program_');
    });

    test('falls back to "program" when description and filename are both blank', () => {
      controller.currentPhraseFileName = null;
      document.getElementById('program-description').value = '';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toContain('_program_');
    });

    test('sanitizes description to kebab-case', () => {
      document.getElementById('program-description').value = '  Sun  Salutation! 2025  ';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toContain('_sun-salutation-2025_');
    });

    test('uses voice name for openai engine', () => {
      document.getElementById('program-description').value = 'test';
      document.getElementById('tts-engine').value = 'openai';
      document.getElementById('openai-voice').value = 'onyx';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toContain('_onyx_');
    });

    test('includes sample name when audio source is sample', () => {
      document.getElementById('program-description').value = 'test';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'sample';
      document.getElementById('sample-audio-select').value = 'meditation_yoga_relaxing_music';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toContain('_meditation-yoga-relaxing-music.');
    });

    test('uses nobg when audio source is none', () => {
      document.getElementById('program-description').value = 'test';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toContain('_nobg.');
    });

    test('uses wav extension for wav format', () => {
      document.getElementById('program-description').value = 'test';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('wav');
      expect(name).toMatch(/\.wav$/);
    });

    test('uses mp3 extension for mp3 format', () => {
      document.getElementById('program-description').value = 'test';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toMatch(/\.mp3$/);
    });

    test('filename starts with sortable timestamp', () => {
      document.getElementById('program-description').value = 'test';
      document.getElementById('openai-voice').value = 'nova';
      document.getElementById('audio-source').value = 'none';
      const name = controller.buildDownloadFilename('mp3');
      expect(name).toMatch(/^audio-program_\d{8}-\d{6}_/);
    });
  });

  // ── setupSliderValueDisplays ──────────────────────────────────────────────

  describe('setupSliderValueDisplays', () => {
    test('formats preview-volume as percentage', () => {
      const slider = document.getElementById('preview-volume');
      const display = document.getElementById('preview-volume-value');

      controller.setupSliderValueDisplays();
      slider.value = '0.6';
      slider.dispatchEvent(new Event('input'));

      expect(display.textContent).toBe('60%');
    });

    test('rounds preview-volume percentage to nearest integer', () => {
      const slider = document.getElementById('preview-volume');
      const display = document.getElementById('preview-volume-value');

      controller.setupSliderValueDisplays();
      slider.value = '0.75';
      slider.dispatchEvent(new Event('input'));

      expect(display.textContent).toBe('75%');
    });
  });
});
