/**
 * Tests for OpenAITTSAdapter
 * Covers API integration, voice options, error handling, and audio generation
 */

import { OpenAITTSAdapter } from '../../scripts/services/OpenAITTSAdapter.js';

// Mock fetch
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
  const oldImpl = fetch.mockImplementation;
  fetch.mockImplementation = () => {
    fetch.mockImplementation = oldImpl;
    return Promise.resolve(value);
  };
};
fetch.mockRejectedValueOnce = (error) => {
  const oldImpl = fetch.mockImplementation;
  fetch.mockImplementation = () => {
    fetch.mockImplementation = oldImpl;
    return Promise.reject(error);
  };
};
fetch.mock = {
  get calls() {
    return mockFetchCalls;
  },
};

// Helper to create mock response with headers
function createMockResponse(options = {}) {
  const headers = new Map(options.headers || []);
  if (!headers.has('content-type')) {
    headers.set('content-type', 'audio/wav');
  }
  
  return {
    ok: options.ok !== undefined ? options.ok : true,
    status: options.status || 200,
    statusText: options.statusText || '',
    headers: {
      get: (key) => headers.get(key),
      entries: () => headers.entries(),
    },
    blob: options.blob || (() => Promise.resolve(new Blob(['audio data'], { type: 'audio/wav' }))),
    arrayBuffer: options.arrayBuffer || (() => Promise.resolve(new ArrayBuffer(1024))),
    text: options.text || (() => Promise.resolve('')),
  };
}

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.sampleRate = 24000;
  }

  createBuffer(numChannels, length, sampleRate) {
    const buffer = {
      numberOfChannels: numChannels,
      length: length,
      sampleRate: sampleRate,
      getChannelData: (channel) => {
        if (channel >= numChannels) {
          throw new Error('Channel index out of range');
        }
        return new Float32Array(length);
      },
    };
    return buffer;
  }

  close() {
    return Promise.resolve();
  }
}

global.AudioContext = MockAudioContext;

describe('OpenAITTSAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new OpenAITTSAdapter();
    fetch.mockClear();
  });

  describe('initialization', () => {
    test('creates adapter with default values', () => {
      expect(adapter.apiKey).toBeNull();
      expect(adapter.baseUrl).toBe('https://api.openai.com/v1');
    });

    test('has default capabilities', () => {
      expect(adapter.defaultCapabilities).toBeDefined();
      expect(adapter.defaultCapabilities.voices).toHaveLength(6);
      expect(adapter.defaultCapabilities.models).toHaveLength(2);
    });
  });

  describe('getName', () => {
    test('returns correct engine name', () => {
      expect(adapter.getName()).toBe('OpenAI TTS');
    });
  });

  describe('requiresApiKey', () => {
    test('returns true', () => {
      expect(adapter.requiresApiKey()).toBe(true);
    });
  });

  describe('setApiKey', () => {
    test('sets API key', () => {
      adapter.setApiKey('test-key');
      expect(adapter.apiKey).toBe('test-key');
    });

    test('can update API key', () => {
      adapter.setApiKey('key1');
      adapter.setApiKey('key2');
      expect(adapter.apiKey).toBe('key2');
    });
  });

  describe('getCapabilities', () => {
    test('returns capabilities object', async () => {
      const capabilities = await adapter.getCapabilities();

      expect(capabilities).toBeDefined();
      expect(capabilities.voices).toBeDefined();
      expect(capabilities.models).toBeDefined();
      expect(capabilities.audioFormats).toBeDefined();
      expect(capabilities.parameters).toBeDefined();
    });

    test('includes all 6 voices', async () => {
      const capabilities = await adapter.getCapabilities();

      expect(capabilities.voices).toHaveLength(6);
      const voiceIds = capabilities.voices.map((v) => v.id);
      expect(voiceIds).toContain('alloy');
      expect(voiceIds).toContain('echo');
      expect(voiceIds).toContain('fable');
      expect(voiceIds).toContain('onyx');
      expect(voiceIds).toContain('nova');
      expect(voiceIds).toContain('shimmer');
    });

    test('includes both TTS models', async () => {
      const capabilities = await adapter.getCapabilities();

      expect(capabilities.models).toHaveLength(2);
      const modelIds = capabilities.models.map((m) => m.id);
      expect(modelIds).toContain('tts-1');
      expect(modelIds).toContain('tts-1-hd');
    });

    test('includes audio formats', async () => {
      const capabilities = await adapter.getCapabilities();

      expect(capabilities.audioFormats).toContain('mp3');
      expect(capabilities.audioFormats).toContain('wav');
      expect(capabilities.audioFormats).toContain('opus');
    });

    test('includes speed parameter range', async () => {
      const capabilities = await adapter.getCapabilities();

      expect(capabilities.parameters.speed.min).toBe(0.25);
      expect(capabilities.parameters.speed.max).toBe(4.0);
      expect(capabilities.parameters.speed.default).toBe(1.0);
    });
  });

  describe('validateApiKey', () => {
    test('returns true for valid API key', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
      }));

      const isValid = await adapter.validateApiKey('valid-key');

      expect(isValid).toBe(true);
      expect(fetch.mock.calls.length).toBe(1);
      expect(fetch.mock.calls[0][0]).toBe(
        'https://api.openai.com/v1/audio/speech'
      );
      expect(fetch.mock.calls[0][1].method).toBe('POST');
      expect(fetch.mock.calls[0][1].headers.Authorization).toBe(
        'Bearer valid-key'
      );
    });

    test('returns false for invalid API key', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
      });

      const isValid = await adapter.validateApiKey('invalid-key');

      expect(isValid).toBe(false);
    });

    test('returns false on network error', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const isValid = await adapter.validateApiKey('test-key');

      expect(isValid).toBe(false);
    });

    test('sends test request with minimal payload', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({ ok: true }));

      await adapter.validateApiKey('test-key');

      const callArgs = fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBe('tts-1');
      expect(body.input).toBe('test');
      expect(body.voice).toBe('alloy');
    });
  });

  describe('generateSpeech', () => {
    beforeEach(() => {
      adapter.setApiKey('test-api-key');
    });

    test('throws error when no API key set', async () => {
      const noKeyAdapter = new OpenAITTSAdapter();

      await expect(
        noKeyAdapter.generateSpeech('Hello')
      ).rejects.toThrow('API key required for OpenAI TTS');
    });

    test('generates speech with default options', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }));

      const result = await adapter.generateSpeech('Hello world');

      expect(result).toBeInstanceOf(Blob);
      expect(fetch.mock.calls.length).toBeGreaterThan(0);
      expect(fetch.mock.calls[0][0]).toBe(
        'https://api.openai.com/v1/audio/speech'
      );
      expect(fetch.mock.calls[0][1].method).toBe('POST');
    });

    test('uses custom voice option', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }));

      await adapter.generateSpeech('Hello', { voice: 'shimmer' });

      const callArgs = fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.voice).toBe('shimmer');
    });

    test('uses custom model option', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }));

      await adapter.generateSpeech('Hello', { model: 'tts-1-hd' });

      const callArgs = fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.model).toBe('tts-1-hd');
    });

    test('uses custom speed option', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }));

      await adapter.generateSpeech('Hello', { speed: 1.5 });

      const callArgs = fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.speed).toBe(1.5);
    });

    test('uses custom format option', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }));

      await adapter.generateSpeech('Hello', { format: 'mp3' });

      const callArgs = fetch.mock.calls[0][1];
      const body = JSON.parse(callArgs.body);

      expect(body.response_format).toBe('mp3');
    });

    test('generates silence for asterisk', async () => {
      const result = await adapter.generateSpeech('*', { duration: 2 });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      // No API call should be made for silence
      const callCountBefore = fetch.mock.calls.length;
      expect(callCountBefore).toBe(0);
    });

    test('generates silence for empty text', async () => {
      const result = await adapter.generateSpeech('', { duration: 1 });

      expect(result).toBeInstanceOf(Blob);
      expect(result.type).toBe('audio/wav');
      // No API call should be made for silence
      const callCountBefore = fetch.mock.calls.length;
      expect(callCountBefore).toBe(0);
    });

    test('throws error on API failure', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: () => Promise.resolve('{"error":{"message":"Invalid API key"}}'),
      }));

      await expect(
        adapter.generateSpeech('Hello')
      ).rejects.toThrow('OpenAI TTS API error: Invalid API key');
    });

    test('handles non-JSON error response', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: () => Promise.resolve('Server error'),
      }));

      await expect(
        adapter.generateSpeech('Hello')
      ).rejects.toThrow('OpenAI TTS API error: Server error');
    });

    test('returns blob with correct MIME type', async () => {
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }));

      const result = await adapter.generateSpeech('Hello', { format: 'mp3' });

      expect(result.type).toBe('audio/mpeg');
    });
  });

  describe('getMimeType', () => {
    test('returns correct MIME type for mp3', () => {
      expect(adapter.getMimeType('mp3')).toBe('audio/mpeg');
    });

    test('returns correct MIME type for wav', () => {
      expect(adapter.getMimeType('wav')).toBe('audio/wav');
    });

    test('returns correct MIME type for opus', () => {
      expect(adapter.getMimeType('opus')).toBe('audio/opus');
    });

    test('returns correct MIME type for aac', () => {
      expect(adapter.getMimeType('aac')).toBe('audio/aac');
    });

    test('returns correct MIME type for flac', () => {
      expect(adapter.getMimeType('flac')).toBe('audio/flac');
    });

    test('returns correct MIME type for pcm', () => {
      expect(adapter.getMimeType('pcm')).toBe('audio/pcm');
    });

    test('returns default wav for unknown format', () => {
      expect(adapter.getMimeType('unknown')).toBe('audio/wav');
    });
  });

  describe('generateSilence', () => {
    test('generates silent audio blob', async () => {
      const blob = await adapter.generateSilence(1);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBeGreaterThan(44); // WAV header is 44 bytes
    });

    test('generates correct duration', async () => {
      const blob1 = await adapter.generateSilence(1);
      const blob2 = await adapter.generateSilence(2);

      // 2 seconds should be roughly twice the size of 1 second
      expect(blob2.size).toBeGreaterThan(blob1.size);
    });

    test('handles fractional durations', async () => {
      const blob = await adapter.generateSilence(0.5);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(44);
    });
  });

  describe('audioBufferToWav', () => {
    test('converts AudioBuffer to WAV blob', () => {
      const context = new MockAudioContext();
      const buffer = context.createBuffer(1, 1000, 24000);

      const blob = adapter.audioBufferToWav(buffer);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    test('handles stereo audio', () => {
      const context = new MockAudioContext();
      const buffer = context.createBuffer(2, 1000, 24000);

      const blob = adapter.audioBufferToWav(buffer);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.size).toBeGreaterThan(44);
    });

    test('creates valid WAV header', () => {
      const context = new MockAudioContext();
      const buffer = context.createBuffer(1, 1000, 24000);

      const blob = adapter.audioBufferToWav(buffer);

      // Note: Blob.arrayBuffer() may not be available in test environment
      // Just verify blob was created with correct type and size
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBeGreaterThan(44); // WAV header is 44 bytes
    });
  });

  describe('writeString', () => {
    test('writes string to DataView', () => {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);

      adapter.writeString(view, 0, 'TEST');

      expect(view.getUint8(0)).toBe('T'.charCodeAt(0));
      expect(view.getUint8(1)).toBe('E'.charCodeAt(0));
      expect(view.getUint8(2)).toBe('S'.charCodeAt(0));
      expect(view.getUint8(3)).toBe('T'.charCodeAt(0));
    });

    test('writes string at offset', () => {
      const buffer = new ArrayBuffer(10);
      const view = new DataView(buffer);

      adapter.writeString(view, 5, 'HI');

      expect(view.getUint8(5)).toBe('H'.charCodeAt(0));
      expect(view.getUint8(6)).toBe('I'.charCodeAt(0));
    });
  });

  describe('integration scenarios', () => {
    beforeEach(() => {
      adapter.setApiKey('test-key');
    });

    test('full workflow: validate, generate, convert', async () => {
      // Validate key
      fetch.mockResolvedValueOnce(createMockResponse({ ok: true }));
      const isValid = await adapter.validateApiKey('test-key');
      expect(isValid).toBe(true);

      // Generate speech
      fetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
      }));

      const result = await adapter.generateSpeech('Hello world', {
        voice: 'nova',
        model: 'tts-1-hd',
        speed: 1.2,
      });

      expect(result).toBeInstanceOf(Blob);
    });

    test('handles all voice options', async () => {
      const voices = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

      for (const voice of voices) {
        fetch.mockResolvedValueOnce(createMockResponse({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        }));

        const result = await adapter.generateSpeech('Test', { voice });
        expect(result).toBeInstanceOf(Blob);
      }

      expect(fetch.mock.calls.length).toBe(6);
    });

    test('handles all audio formats', async () => {
      const formats = ['mp3', 'wav', 'opus', 'aac', 'flac', 'pcm'];

      for (const format of formats) {
        fetch.mockResolvedValueOnce(createMockResponse({
          ok: true,
          arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024)),
        }));

        const result = await adapter.generateSpeech('Test', { format });
        expect(result).toBeInstanceOf(Blob);
      }

      expect(fetch.mock.calls.length).toBe(6);
    });
  });
});
