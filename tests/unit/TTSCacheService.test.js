/**
 * Tests for TTSCacheService
 * Covers cache operations, IndexedDB interactions, and pruning logic
 */

import { TTSCacheService } from '../../scripts/services/TTSCacheService.js';

// Mock IndexedDB
class MockIDBRequest {
  constructor() {
    this.result = null;
    this.error = null;
    this.onsuccess = null;
    this.onerror = null;
  }

  succeed(result) {
    this.result = result;
    setTimeout(() => this.onsuccess?.(), 0);
  }

  fail(error) {
    this.error = error;
    setTimeout(() => this.onerror?.(), 0);
  }
}

class MockIDBObjectStore {
  constructor(data) {
    this.data = data;
    this.indices = {
      timestamp: {
        openCursor: () => {
          const request = new MockIDBRequest();
          const entries = Object.values(this.data).sort(
            (a, b) => a.timestamp - b.timestamp
          );
          let index = 0;

          setTimeout(() => {
            const cursor = {
              value: entries[index],
              continue: () => {
                index++;
                setTimeout(() => {
                  if (index < entries.length) {
                    request.onsuccess?.({
                      target: {
                        result: {
                          value: entries[index],
                          continue: cursor.continue,
                        },
                      },
                    });
                  } else {
                    request.onsuccess?.({ target: { result: null } });
                  }
                }, 0);
              },
            };
            request.onsuccess?.({ target: { result: cursor } });
          }, 0);

          return request;
        },
      },
    };
  }

  get(key) {
    const request = new MockIDBRequest();
    setTimeout(() => request.succeed(this.data[key] || null), 0);
    return request;
  }

  put(entry) {
    const request = new MockIDBRequest();
    this.data[entry.key] = entry;
    setTimeout(() => request.succeed(), 0);
    return request;
  }

  getAll() {
    const request = new MockIDBRequest();
    setTimeout(() => request.succeed(Object.values(this.data)), 0);
    return request;
  }

  delete(key) {
    delete this.data[key];
    const request = new MockIDBRequest();
    setTimeout(() => request.succeed(), 0);
    return request;
  }

  clear() {
    Object.keys(this.data).forEach((key) => delete this.data[key]);
    const request = new MockIDBRequest();
    setTimeout(() => request.succeed(), 0);
    return request;
  }

  index(name) {
    return this.indices[name];
  }

  createIndex() {
    // Mock implementation
  }
}

class MockIDBTransaction {
  constructor(data) {
    this.data = data;
  }

  objectStore(_name) {
    return new MockIDBObjectStore(this.data);
  }
}

class MockIDBDatabase {
  constructor() {
    this.data = {};
    this.objectStoreNames = {
      contains: (name) => name === 'audio-snippets',
    };
  }

  transaction(_storeNames, _mode) {
    return new MockIDBTransaction(this.data);
  }

  createObjectStore(_name, _options) {
    return new MockIDBObjectStore(this.data);
  }
}

// Mock indexedDB
const mockDB = new MockIDBDatabase();
global.indexedDB = {
  open: (_name, _version) => {
    const request = new MockIDBRequest();
    setTimeout(() => {
      request.result = mockDB;
      request.onsuccess?.();
    }, 0);
    return request;
  },
};

// Mock console methods to avoid noise
global.console = {
  ...console,
  log: (..._args) => {}, // Silent mock
};

describe('TTSCacheService', () => {
  let cacheService;

  beforeEach(async () => {
    cacheService = new TTSCacheService();
    mockDB.data = {}; // Clear data between tests
    await cacheService.init();
  });

  describe('init', () => {
    test('initializes IndexedDB', async () => {
      const service = new TTSCacheService();
      await service.init();

      expect(service.db).toBeDefined();
      expect(service.db).toBe(mockDB);
    });

    test('does not reinitialize if already initialized', async () => {
      const service = new TTSCacheService();
      await service.init();
      const db1 = service.db;

      await service.init();
      const db2 = service.db;

      expect(db1).toBe(db2);
    });
  });

  describe('generateKey', () => {
    test('generates consistent key for same inputs', () => {
      const key1 = cacheService.generateKey('Hello', 'openai', {
        voice: 'nova',
      });
      const key2 = cacheService.generateKey('Hello', 'openai', {
        voice: 'nova',
      });

      expect(key1).toBe(key2);
      expect(key1).toMatch(/^tts_[a-z0-9]+$/);
    });

    test('generates different keys for different text', () => {
      const key1 = cacheService.generateKey('Hello', 'openai', {});
      const key2 = cacheService.generateKey('World', 'openai', {});

      expect(key1).not.toBe(key2);
    });

    test('generates different keys for different engines', () => {
      const key1 = cacheService.generateKey('Hello', 'openai', {});
      const key2 = cacheService.generateKey('Hello', 'google', {});

      expect(key1).not.toBe(key2);
    });

    test('generates different keys for different options', () => {
      const key1 = cacheService.generateKey('Hello', 'openai', {
        voice: 'nova',
      });
      const key2 = cacheService.generateKey('Hello', 'openai', {
        voice: 'shimmer',
      });

      expect(key1).not.toBe(key2);
    });

    test('generates same key regardless of option order', () => {
      const key1 = cacheService.generateKey('Hello', 'openai', {
        voice: 'nova',
        speed: 1.0,
      });
      const key2 = cacheService.generateKey('Hello', 'openai', {
        speed: 1.0,
        voice: 'nova',
      });

      expect(key1).toBe(key2);
    });

    test('handles empty options', () => {
      const key = cacheService.generateKey('Hello', 'openai', {});

      expect(key).toMatch(/^tts_[a-z0-9]+$/);
    });

    test('handles complex options', () => {
      const key = cacheService.generateKey('Hello', 'openai', {
        voice: 'nova',
        speed: 1.5,
        pitch: 0,
        volume: 1.0,
      });

      expect(key).toMatch(/^tts_[a-z0-9]+$/);
    });
  });

  describe('get', () => {
    test('returns null for cache miss', async () => {
      const result = await cacheService.get('Hello', 'openai', {});

      expect(result).toBeNull();
    });

    test('returns null for empty text', async () => {
      const result = await cacheService.get('', 'openai', {});

      expect(result).toBeNull();
    });

    test('returns cached blob for cache hit', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      await cacheService.set('Hello', 'openai', {}, blob);

      const result = await cacheService.get('Hello', 'openai', {});

      expect(result).toBe(blob);
    });

    test('returns correct blob for different cache entries', async () => {
      const blob1 = new Blob(['audio 1'], { type: 'audio/mpeg' });
      const blob2 = new Blob(['audio 2'], { type: 'audio/mpeg' });

      await cacheService.set('Hello', 'openai', {}, blob1);
      await cacheService.set('World', 'openai', {}, blob2);

      const result1 = await cacheService.get('Hello', 'openai', {});
      const result2 = await cacheService.get('World', 'openai', {});

      expect(result1).toBe(blob1);
      expect(result2).toBe(blob2);
    });

    test('retrieves cached entry successfully', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      await cacheService.set('Hello world', 'openai', {}, blob);

      const result = await cacheService.get('Hello world', 'openai', {});

      expect(result).toBe(blob);
    });

    test('handles cache miss gracefully', async () => {
      const result = await cacheService.get('Not cached', 'openai', {});

      expect(result).toBeNull();
    });

    test('handles long text correctly', async () => {
      const longText = 'a'.repeat(100);
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      await cacheService.set(longText, 'openai', {}, blob);

      const result = await cacheService.get(longText, 'openai', {});
      expect(result).toBe(blob);
    });
  });

  describe('set', () => {
    test('stores blob in cache', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      await cacheService.set('Hello', 'openai', {}, blob);

      const result = await cacheService.get('Hello', 'openai', {});
      expect(result).toBe(blob);
    });

    test('does not store empty text', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      await cacheService.set('', 'openai', {}, blob);

      const result = await cacheService.get('', 'openai', {});
      expect(result).toBeNull();
    });

    test('stores metadata with blob', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      const options = { voice: 'nova' };

      await cacheService.set('Hello', 'openai', options, blob);

      const key = cacheService.generateKey('Hello', 'openai', options);
      const entry = mockDB.data[key];

      expect(entry).toBeDefined();
      expect(entry.engine).toBe('openai');
      expect(entry.options).toEqual(options);
      expect(entry.blob).toBe(blob);
      expect(entry.timestamp).toBeGreaterThan(0);
      expect(entry.size).toBe(blob.size);
    });

    test('truncates long text in stored preview', async () => {
      const longText = 'a'.repeat(200);
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });

      await cacheService.set(longText, 'openai', {}, blob);

      const key = cacheService.generateKey(longText, 'openai', {});
      const entry = mockDB.data[key];

      expect(entry.text.length).toBe(100);
    });

    test('stores blob successfully', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });

      await cacheService.set('Hello', 'openai', {}, blob);

      const result = await cacheService.get('Hello', 'openai', {});
      expect(result).toBe(blob);
    });

    test('overwrites existing cache entry', async () => {
      const blob1 = new Blob(['audio 1'], { type: 'audio/mpeg' });
      const blob2 = new Blob(['audio 2'], { type: 'audio/mpeg' });

      await cacheService.set('Hello', 'openai', {}, blob1);
      await cacheService.set('Hello', 'openai', {}, blob2);

      const result = await cacheService.get('Hello', 'openai', {});
      expect(result).toBe(blob2);
    });
  });

  describe('getStats', () => {
    test('returns empty stats for empty cache', async () => {
      const stats = await cacheService.getStats();

      expect(stats.count).toBe(0);
      expect(stats.totalSize).toBe(0);
      expect(stats.totalSizeMB).toBe('0.00');
      expect(stats.entries).toEqual([]);
    });

    test('returns correct stats for single entry', async () => {
      const blob = new Blob(['a'.repeat(1024)], { type: 'audio/mpeg' }); // 1KB
      await cacheService.set('Hello', 'openai', {}, blob);

      const stats = await cacheService.getStats();

      expect(stats.count).toBe(1);
      expect(stats.totalSize).toBe(1024);
      expect(stats.entries).toHaveLength(1);
      expect(stats.entries[0].text).toBe('Hello');
      expect(stats.entries[0].engine).toBe('openai');
    });

    test('returns correct stats for multiple entries', async () => {
      const blob1 = new Blob(['a'.repeat(1024)], { type: 'audio/mpeg' });
      const blob2 = new Blob(['b'.repeat(2048)], { type: 'audio/mpeg' });

      await cacheService.set('Hello', 'openai', {}, blob1);
      await cacheService.set('World', 'google', {}, blob2);

      const stats = await cacheService.getStats();

      expect(stats.count).toBe(2);
      expect(stats.totalSize).toBe(3072);
      expect(stats.entries).toHaveLength(2);
    });

    test('formats size in KB', async () => {
      const blob = new Blob(['a'.repeat(1536)], { type: 'audio/mpeg' }); // 1.5KB
      await cacheService.set('Hello', 'openai', {}, blob);

      const stats = await cacheService.getStats();

      expect(stats.entries[0].size).toBe('1.5 KB');
    });

    test('formats total size in MB', async () => {
      const blob = new Blob(['a'.repeat(1024 * 1024)], {
        type: 'audio/mpeg',
      }); // 1MB
      await cacheService.set('Hello', 'openai', {}, blob);

      const stats = await cacheService.getStats();

      expect(stats.totalSizeMB).toBe('1.00');
    });
  });

  describe('pruneCache', () => {
    test('does not prune if under limit', async () => {
      const blob = new Blob(['a'.repeat(1024)], { type: 'audio/mpeg' }); // 1KB
      await cacheService.set('Hello', 'openai', {}, blob);

      await cacheService.pruneCache();

      const stats = await cacheService.getStats();
      expect(stats.count).toBe(1);
    });

    test('prunes oldest entries when over limit', async () => {
      // Set a small limit for testing
      cacheService.maxCacheSizeMB = 0.001; // 1KB limit

      // Add entries that exceed limit
      const blob1 = new Blob(['a'.repeat(500)], { type: 'audio/mpeg' });
      const blob2 = new Blob(['b'.repeat(500)], { type: 'audio/mpeg' });
      const blob3 = new Blob(['c'.repeat(500)], { type: 'audio/mpeg' });

      await cacheService.set('First', 'openai', {}, blob1);
      await new Promise((resolve) => setTimeout(resolve, 10)); // Ensure different timestamps
      await cacheService.set('Second', 'openai', {}, blob2);
      await new Promise((resolve) => setTimeout(resolve, 10));
      await cacheService.set('Third', 'openai', {}, blob3);

      await cacheService.pruneCache();

      const stats = await cacheService.getStats();
      expect(stats.count).toBeLessThan(3);
    });

    test('reduces cache size when pruning', async () => {
      cacheService.maxCacheSizeMB = 0.001;

      const blob = new Blob(['a'.repeat(2000)], { type: 'audio/mpeg' });
      await cacheService.set('Hello', 'openai', {}, blob);

      const statsBefore = await cacheService.getStats();
      await cacheService.pruneCache();
      const statsAfter = await cacheService.getStats();

      expect(statsAfter.totalSize).toBeLessThan(statsBefore.totalSize);
    });
  });

  describe('clear', () => {
    test('clears all cache entries', async () => {
      const blob1 = new Blob(['audio 1'], { type: 'audio/mpeg' });
      const blob2 = new Blob(['audio 2'], { type: 'audio/mpeg' });

      await cacheService.set('Hello', 'openai', {}, blob1);
      await cacheService.set('World', 'google', {}, blob2);

      await cacheService.clear();

      const stats = await cacheService.getStats();
      expect(stats.count).toBe(0);
    });

    test('clears cache successfully', async () => {
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      await cacheService.set('Hello', 'openai', {}, blob);

      await cacheService.clear();

      const stats = await cacheService.getStats();
      expect(stats.count).toBe(0);
    });

    test('cache works after clear', async () => {
      const blob1 = new Blob(['audio 1'], { type: 'audio/mpeg' });
      const blob2 = new Blob(['audio 2'], { type: 'audio/mpeg' });

      await cacheService.set('Hello', 'openai', {}, blob1);
      await cacheService.clear();
      await cacheService.set('World', 'google', {}, blob2);

      const result = await cacheService.get('World', 'google', {});
      expect(result).toBe(blob2);
    });
  });

  describe('integration scenarios', () => {
    test('full cache lifecycle', async () => {
      // Store
      const blob = new Blob(['audio data'], { type: 'audio/mpeg' });
      await cacheService.set('Hello', 'openai', { voice: 'nova' }, blob);

      // Retrieve
      const result = await cacheService.get('Hello', 'openai', {
        voice: 'nova',
      });
      expect(result).toBe(blob);

      // Stats
      const stats = await cacheService.getStats();
      expect(stats.count).toBe(1);

      // Clear
      await cacheService.clear();
      const afterClear = await cacheService.get('Hello', 'openai', {
        voice: 'nova',
      });
      expect(afterClear).toBeNull();
    });

    test('handles multiple engines and options', async () => {
      const blob1 = new Blob(['openai nova'], { type: 'audio/mpeg' });
      const blob2 = new Blob(['openai shimmer'], { type: 'audio/mpeg' });
      const blob3 = new Blob(['google'], { type: 'audio/mpeg' });

      await cacheService.set('Hello', 'openai', { voice: 'nova' }, blob1);
      await cacheService.set('Hello', 'openai', { voice: 'shimmer' }, blob2);
      await cacheService.set('Hello', 'google', {}, blob3);

      const result1 = await cacheService.get('Hello', 'openai', {
        voice: 'nova',
      });
      const result2 = await cacheService.get('Hello', 'openai', {
        voice: 'shimmer',
      });
      const result3 = await cacheService.get('Hello', 'google', {});

      expect(result1).toBe(blob1);
      expect(result2).toBe(blob2);
      expect(result3).toBe(blob3);
    });
  });
});
