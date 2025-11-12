/**
 * Project Cache Service
 * Stores complete audio projects (phrase files + background music + settings)
 * for quick restoration when returning to the app
 */

export class ProjectCacheService {
  constructor() {
    this.dbName = 'apg-projects';
    this.storeName = 'projects';
    this.db = null;
    this.maxProjects = 10; // Keep last 10 projects
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
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
          store.createIndex('name', 'name', { unique: false });
        }
      };
    });
  }

  /**
   * Generate a unique project ID
   */
  generateId() {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Save a project
   * @param {Object} project - Project data
   * @param {string} project.name - Project name (from phrase file name)
   * @param {string} project.phraseFileContent - Content of phrase file
   * @param {Blob} project.backgroundMusic - Background music blob (optional)
   * @param {string} project.ttsEngine - TTS engine used
   * @param {Object} project.ttsOptions - TTS options (voice, speed, etc.)
   * @param {Object} project.exportSettings - Export format and quality
   * @returns {Promise<string>} Project ID
   */
  async saveProject(project) {
    await this.init();

    const projectData = {
      id: this.generateId(),
      name: project.name || 'Untitled Project',
      phraseFileContent: project.phraseFileContent,
      backgroundMusic: project.backgroundMusic || null,
      backgroundMusicName: project.backgroundMusicName || null,
      ttsEngine: project.ttsEngine,
      ttsOptions: project.ttsOptions,
      exportSettings: project.exportSettings || { format: 'mp3', bitrate: 192 },
      timestamp: Date.now(),
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(projectData);

      request.onsuccess = async () => {
        // eslint-disable-next-line no-console
        console.log(`💾 Saved project: "${projectData.name}"`);
        
        // Prune old projects if we exceed the limit
        await this.pruneOldProjects();
        
        resolve(projectData.id);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get a project by ID
   * @param {string} id - Project ID
   * @returns {Promise<Object|null>} Project data or null
   */
  async getProject(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);

      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * List all projects (most recent first)
   * @returns {Promise<Array>} Array of project metadata (without large blobs)
   */
  async listProjects() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('timestamp');
      const request = index.openCursor(null, 'prev'); // Descending order

      const projects = [];
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
          const project = cursor.value;
          // Return metadata only (exclude large blobs for listing)
          projects.push({
            id: project.id,
            name: project.name,
            timestamp: project.timestamp,
            ttsEngine: project.ttsEngine,
            hasBackgroundMusic: !!project.backgroundMusic,
            backgroundMusicName: project.backgroundMusicName,
          });
          cursor.continue();
        } else {
          resolve(projects);
        }
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Delete a project
   * @param {string} id - Project ID
   */
  async deleteProject(id) {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => {
        // eslint-disable-next-line no-console
        console.log(`🗑️ Deleted project: ${id}`);
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Prune old projects if we exceed the limit
   */
  async pruneOldProjects() {
    const projects = await this.listProjects();
    
    if (projects.length > this.maxProjects) {
      const toDelete = projects.slice(this.maxProjects);
      // eslint-disable-next-line no-console
      console.log(`🧹 Pruning ${toDelete.length} old project(s)...`);
      
      for (const project of toDelete) {
        await this.deleteProject(project.id);
      }
    }
  }

  /**
   * Clear all projects
   */
  async clearAll() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();

      request.onsuccess = () => {
        // eslint-disable-next-line no-console
        console.log('🗑️ Cleared all projects');
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Get storage statistics
   * @returns {Promise<Object>} Stats object
   */
  async getStats() {
    await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        const projects = request.result;
        let totalSize = 0;

        projects.forEach((project) => {
          // Estimate size
          totalSize += new Blob([project.phraseFileContent]).size;
          if (project.backgroundMusic) {
            totalSize += project.backgroundMusic.size;
          }
        });

        resolve({
          count: projects.length,
          totalSizeMB: (totalSize / (1024 * 1024)).toFixed(2),
        });
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Format timestamp for display
   * @param {number} timestamp - Unix timestamp
   * @returns {string} Formatted date/time
   */
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  }
}
