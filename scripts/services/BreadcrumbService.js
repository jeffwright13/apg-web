/**
 * Breadcrumb Service
 * Records the last-reached stage of a generation run to localStorage so that
 * if the browser silently kills and reloads the tab mid-generation (observed
 * on mobile with large background-audio mixes), the next page load can report
 * exactly where it died — without needing a live console attached.
 */

export class BreadcrumbService {
  constructor(storageKey = 'apg-generation-breadcrumb') {
    this.storageKey = storageKey;
  }

  /**
   * Record the current stage. Best-effort: a full localStorage or a
   * disabled-storage browser should never break generation.
   * @param {string} stage - Short identifier for the stage reached
   * @param {Object} meta - Optional extra context (e.g. phrase index)
   */
  mark(stage, meta = {}) {
    try {
      localStorage.setItem(
        this.storageKey,
        JSON.stringify({ stage, meta, timestamp: Date.now() })
      );
    } catch {
      // Storage unavailable or full — breadcrumbs are diagnostic only
    }
  }

  /**
   * Remove the breadcrumb. Called whenever a generation run reaches a point
   * where JS is still running (success, handled error, or user cancel) —
   * only a tab kill leaves a breadcrumb behind for the next load to find.
   */
  clear() {
    try {
      localStorage.removeItem(this.storageKey);
    } catch {
      // ignore
    }
  }

  /**
   * Read back a breadcrumb left by a run that never reached a clear() call.
   * @returns {Object|null} { stage, meta, timestamp } or null if none/invalid
   */
  getLastIncomplete() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
}
