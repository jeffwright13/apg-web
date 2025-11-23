/**
 * Tests for SampleAudioService
 * Covers sample metadata, file loading, and availability checking
 */

import { SampleAudioService } from '../../scripts/services/SampleAudioService.js';

// Mock fetch with tracking
class MockFetch {
  constructor() {
    this.calls = [];
    this._mockImplementation = null;
    this._mockResolvedValue = null;
    this._mockRejectedValue = null;
  }

  mockClear() {
    this.calls = [];
    this._mockImplementation = null;
    this._mockResolvedValue = null;
    this._mockRejectedValue = null;
  }

  mockImplementation(fn) {
    this._mockImplementation = fn;
  }

  mockResolvedValueOnce(value) {
    this._mockResolvedValue = value;
  }

  mockResolvedValue(value) {
    this._mockResolvedValue = value;
  }

  mockRejectedValueOnce(value) {
    this._mockRejectedValue = value;
  }

  async call(...args) {
    this.calls.push(args);
    
    if (this._mockRejectedValue) {
      const error = this._mockRejectedValue;
      this._mockRejectedValue = null;
      throw error;
    }
    
    if (this._mockImplementation) {
      return this._mockImplementation(...args);
    }
    
    if (this._mockResolvedValue) {
      return this._mockResolvedValue;
    }
    
    return { ok: true };
  }

  get mock() {
    return { calls: this.calls };
  }
}

const mockFetch = new MockFetch();
global.fetch = (...args) => mockFetch.call(...args);

// Mock File and Blob
global.File = class MockFile {
  constructor(parts, filename, options = {}) {
    this.parts = parts;
    this.name = filename;
    this.type = options.type || 'audio/mpeg';
    this.size = parts.reduce((acc, part) => acc + part.length, 0);
  }
};

global.Blob = class MockBlob {
  constructor(parts, options = {}) {
    this.parts = parts;
    this.type = options.type || '';
    this.size = parts.reduce((acc, part) => acc + part.length, 0);
  }
};

describe('SampleAudioService', () => {
  let service;

  beforeEach(async () => {
    service = new SampleAudioService();
    mockFetch.mockClear();
    
    // Mock successful HEAD requests for all expected samples
    mockFetch.mockImplementation((url, options) => {
      if (options?.method === 'HEAD') {
        return Promise.resolve({ ok: true });
      }
      return Promise.resolve({ ok: false });
    });
    
    await service.loadAvailableSamples();
  });

  describe('Sample Metadata', () => {
    test('should return all samples', () => {
      const samples = service.getSamples();
      expect(samples).toBeDefined();
      expect(Array.isArray(samples)).toBe(true);
      expect(samples.length).toBeGreaterThan(0);
    });

    test('each sample should have required properties', () => {
      const samples = service.getSamples();
      samples.forEach(sample => {
        expect(sample).toHaveProperty('id');
        expect(sample).toHaveProperty('name');
        expect(sample).toHaveProperty('description');
        expect(sample).toHaveProperty('path');
        expect(sample).toHaveProperty('filename');
      });
    });

    test('sample paths should point to samples directory', () => {
      const samples = service.getSamples();
      samples.forEach(sample => {
        expect(sample.path).toMatch(/^\.\/samples\/.+\.mp3$/);
      });
    });

    test('should have 4 samples', () => {
      const samples = service.getSamples();
      expect(samples).toHaveLength(4);
    });

    test('sample IDs should be unique', () => {
      const samples = service.getSamples();
      const ids = samples.map(s => s.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(samples.length);
    });
  });

  describe('Get Sample by ID', () => {
    test('should return sample by valid ID', () => {
      const samples = service.getSamples();
      const firstSampleId = samples[0].id;
      const sample = service.getSampleById(firstSampleId);
      expect(sample).toBeDefined();
      expect(sample.id).toBe(firstSampleId);
    });

    test('should return null for invalid ID', () => {
      const sample = service.getSampleById('invalid');
      expect(sample).toBeNull();
    });

    test('should return null for empty ID', () => {
      const sample = service.getSampleById('');
      expect(sample).toBeNull();
    });

    test('should return null for null ID', () => {
      const sample = service.getSampleById(null);
      expect(sample).toBeNull();
    });
  });

  describe('Load Sample Audio', () => {
    test('should load sample successfully', async () => {
      const samples = service.getSamples();
      const firstSampleId = samples[0].id;
      const mockArrayBuffer = new ArrayBuffer(1024);
      
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const arrayBuffer = await service.loadSample(firstSampleId);
      
      expect(mockFetch.calls.length).toBeGreaterThan(0);
      expect(mockFetch.calls[0][0]).toBe(samples[0].path);
      expect(arrayBuffer).toBeDefined();
      expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
      expect(arrayBuffer.byteLength).toBe(1024);
    });

    test('should throw error for invalid sample ID', async () => {
      await expect(service.loadSample('invalid')).rejects.toThrow('Sample not found');
    });

    test('should throw error when fetch fails', async () => {
      const samples = service.getSamples();
      const firstSampleId = samples[0].id;
      
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(service.loadSample(firstSampleId)).rejects.toThrow('Could not load sample audio file');
    });

    test('should throw error when network error occurs', async () => {
      const samples = service.getSamples();
      const firstSampleId = samples[0].id;
      
      mockFetch.mockClear();
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.loadSample(firstSampleId)).rejects.toThrow('Could not load sample audio file');
    });

    test('should return ArrayBuffer with correct size', async () => {
      const samples = service.getSamples();
      const secondSampleId = samples[1].id;
      const mockArrayBuffer = new ArrayBuffer(2048);
      
      mockFetch.mockClear();
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const arrayBuffer = await service.loadSample(secondSampleId);
      
      expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
      expect(arrayBuffer.byteLength).toBe(2048);
    });
  });

  describe('Check Sample Availability', () => {
    test('should check all samples availability', async () => {
      const samples = service.getSamples();
      
      // Mock all samples as available
      mockFetch.mockClear();
      mockFetch.mockImplementation(() => 
        Promise.resolve({ ok: true })
      );

      const availability = await service.checkSampleAvailability();
      
      expect(availability).toBeDefined();
      expect(Object.keys(availability)).toHaveLength(4);
      samples.forEach(sample => {
        expect(availability[sample.id]).toBe(true);
      });
    });

    test('should mark unavailable samples as false', async () => {
      const samples = service.getSamples();
      const firstSampleFilename = samples[0].filename;
      const thirdSampleFilename = samples[2].filename;
      
      // Mock some samples as unavailable
      mockFetch.mockClear();
      mockFetch.mockImplementation((url) => {
        if (url.includes(firstSampleFilename) || url.includes(thirdSampleFilename)) {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true });
      });

      const availability = await service.checkSampleAvailability();
      
      expect(availability[samples[0].id]).toBe(false);
      expect(availability[samples[1].id]).toBe(true);
      expect(availability[samples[2].id]).toBe(false);
      expect(availability[samples[3].id]).toBe(true);
    });

    test('should handle network errors gracefully', async () => {
      const samples = service.getSamples();
      const secondSampleFilename = samples[1].filename;
      
      // Mock network error for some samples
      mockFetch.mockClear();
      mockFetch.mockImplementation((url) => {
        if (url.includes(secondSampleFilename)) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true });
      });

      const availability = await service.checkSampleAvailability();
      
      expect(availability[samples[0].id]).toBe(true);
      expect(availability[samples[1].id]).toBe(false);
      expect(availability[samples[2].id]).toBe(true);
    });

    test('should use HEAD request for availability check', async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await service.checkSampleAvailability();
      
      // Verify HEAD method is used
      const calls = mockFetch.calls;
      calls.forEach(call => {
        expect(call[1]).toEqual({ method: 'HEAD' });
      });
    });
  });

  describe('Sample Descriptions', () => {
    test('all samples should have meaningful descriptions', () => {
      const samples = service.getSamples();
      samples.forEach(sample => {
        expect(sample.description).toBeDefined();
        expect(sample.description.length).toBeGreaterThan(0);
        expect(typeof sample.description).toBe('string');
      });
    });

    test('all samples should have meaningful names', () => {
      const samples = service.getSamples();
      samples.forEach(sample => {
        expect(sample.name).toBeDefined();
        expect(sample.name.length).toBeGreaterThan(0);
        expect(typeof sample.name).toBe('string');
      });
    });
  });
});
