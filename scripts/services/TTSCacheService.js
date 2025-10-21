/**
 * TTS Cache Service
 * Caches generated TTS audio to avoid redundant API calls
 * Uses IndexedDB for persistent storage across sessions
 */

export class TTSCacheService {
  constructor() {
    this.dbName = 'tts-cache';
    this.storeName = 'audio-snippets';
    this.db = null;
    this.maxCacheSizeMB = 100; // Limit cache to 100MB
  }

  /**
   * Initialize IndexedDB
   */
  async init() {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  /**
   * Generate cache key from TTS parameters
   * @param {string} text - Text to speak
   * @param {string} engine - TTS engine name
   * @param {Object} options - TTS options (voice, speed, etc.)
   * @returns {string} Cache key
   */
  generateKey(text, engine, options) {
    // Create a stable string representation of the options
    const optionsStr = JSON.stringify(options, Object.keys(options).sort());
    const combined = `${engine}:${text}:${optionsStr}`;
    
    // Simple hash function (good enough for cache keys)
    let hash = 0;
    for (let i = 0; i < combined.length; i++) {
      const char = combined.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return `tts_${Math.abs(hash).toString(36)}`;
  }

  /**
   * Get cached audio blob
   * @param {string} text - Text to speak
   * @param {string} engine - TTS engine name
   * @param {Object} options - TTS options
   * @returns {Promise<Blob|null>} Cached audio blob or null
   */
  async get(text, engine, options) {
    await this.init();
    
    if (!text) {
      return null; // Can't cache empty text
    }
    
    const key = this.generateKey(text, engine, options);
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
          // eslint-disable-next-line no-console
          console.log(`✅ Cache HIT for: "${preview}"`);
          resolve(result.blob);
        } else {
          const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
          // eslint-disable-next-line no-console
          console.log(`❌ Cache MISS for: "${preview}"`);
          resolve(null);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Store audio blob in cache
   * @param {string} text - Text to speak
   * @param {string} engine - TTS engine name
   * @param {Object} options - TTS options
   * @param {Blob} blob - Audio blob to cache
   */
  async set(text, engine, options, blob) {
    await this.init();
    
    if (!text) {
      return; // Can't cache empty text
    }
    
    const key = this.generateKey(text, engine, options);
    const textPreview = text.length > 100 ? text.substring(0, 100) : text;
    const entry = {
      key,
      text: textPreview, // Store preview for debugging
      engine,
      options,
      blob,
      timestamp: Date.now(),
      size: blob.size
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(entry);

      request.onsuccess = () => {
        const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
        // eslint-disable-next-line no-console
        console.log(`💾 Cached: "${preview}" (${(blob.size / 1024).toFixed(1)} KB)`);
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get cache statistics
   * @returns {Promise<Object>} Cache stats
   */
  async getStats() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const entries = request.result;
        const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
        const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
        
        resolve({
          count: entries.length,
          totalSize,
          totalSizeMB,
          entries: entries.map(e => ({
            text: e.text,
            engine: e.engine,
            size: (e.size / 1024).toFixed(1) + ' KB',
            timestamp: new Date(e.timestamp).toLocaleString()
          }))
        });
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear old cache entries if size exceeds limit
   */
  async pruneCache() {
    await this.init();

    const stats = await this.getStats();
    if (stats.totalSize < this.maxCacheSizeMB * 1024 * 1024) {
      return; // Under limit
    }

    // eslint-disable-next-line no-console
    console.log(`🧹 Cache size (${stats.totalSizeMB} MB) exceeds limit (${this.maxCacheSizeMB} MB), pruning...`);

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor();

      const toDelete = [];
      let currentSize = stats.totalSize;
      const targetSize = this.maxCacheSizeMB * 0.8 * 1024 * 1024; // Prune to 80% of limit

      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && currentSize > targetSize) {
          toDelete.push(cursor.value.key);
          currentSize -= cursor.value.size;
          cursor.continue();
        } else {
          // Delete oldest entries
          toDelete.forEach(key => store.delete(key));
          // eslint-disable-next-line no-console
          console.log(`🧹 Pruned ${toDelete.length} old cache entries`);
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Clear all cache
   */
  async clear() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        // eslint-disable-next-line no-console
        console.log('🗑️ Cache cleared');
        resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }
}
