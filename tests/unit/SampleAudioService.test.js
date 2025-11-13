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

  beforeEach(() => {
    service = new SampleAudioService();
    mockFetch.mockClear();
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
      });
    });

    test('sample paths should point to samples directory', () => {
      const samples = service.getSamples();
      samples.forEach(sample => {
        expect(sample.path).toMatch(/^\.\/samples\/sample\d+\.mp3$/);
      });
    });

    test('should have 5 samples', () => {
      const samples = service.getSamples();
      expect(samples).toHaveLength(5);
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
      const sample = service.getSampleById('sample1');
      expect(sample).toBeDefined();
      expect(sample.id).toBe('sample1');
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
      const mockArrayBuffer = new ArrayBuffer(1024);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const arrayBuffer = await service.loadSample('sample1');
      
      expect(mockFetch.calls.length).toBeGreaterThan(0);
      expect(mockFetch.calls[0][0]).toBe('./samples/sample1.mp3');
      expect(arrayBuffer).toBeDefined();
      expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
      expect(arrayBuffer.byteLength).toBe(1024);
    });

    test('should throw error for invalid sample ID', async () => {
      await expect(service.loadSample('invalid')).rejects.toThrow('Sample not found');
    });

    test('should throw error when fetch fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      });

      await expect(service.loadSample('sample1')).rejects.toThrow('Could not load sample audio file');
    });

    test('should throw error when network error occurs', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(service.loadSample('sample1')).rejects.toThrow('Could not load sample audio file');
    });

    test('should return ArrayBuffer with correct size', async () => {
      const mockArrayBuffer = new ArrayBuffer(2048);
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockArrayBuffer)
      });

      const arrayBuffer = await service.loadSample('sample2');
      
      expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
      expect(arrayBuffer.byteLength).toBe(2048);
    });
  });

  describe('Check Sample Availability', () => {
    test('should check all samples availability', async () => {
      // Mock all samples as available
      mockFetch.mockImplementation(() => 
        Promise.resolve({ ok: true })
      );

      const availability = await service.checkSampleAvailability();
      
      expect(availability).toBeDefined();
      expect(Object.keys(availability)).toHaveLength(5);
      expect(availability.sample1).toBe(true);
      expect(availability.sample2).toBe(true);
      expect(availability.sample3).toBe(true);
      expect(availability.sample4).toBe(true);
      expect(availability.sample5).toBe(true);
    });

    test('should mark unavailable samples as false', async () => {
      // Mock some samples as unavailable
      mockFetch.mockImplementation((url) => {
        if (url.includes('sample1') || url.includes('sample3')) {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true });
      });

      const availability = await service.checkSampleAvailability();
      
      expect(availability.sample1).toBe(false);
      expect(availability.sample2).toBe(true);
      expect(availability.sample3).toBe(false);
      expect(availability.sample4).toBe(true);
      expect(availability.sample5).toBe(true);
    });

    test('should handle network errors gracefully', async () => {
      // Mock network error for some samples
      mockFetch.mockImplementation((url) => {
        if (url.includes('sample2')) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({ ok: true });
      });

      const availability = await service.checkSampleAvailability();
      
      expect(availability.sample1).toBe(true);
      expect(availability.sample2).toBe(false);
      expect(availability.sample3).toBe(true);
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
