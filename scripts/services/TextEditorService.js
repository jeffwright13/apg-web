/**
 * Text Editor Service
 * Manages the built-in text editor for APG programs
 * Features: syntax highlighting, localStorage auto-save
 */

export class TextEditorService {
  constructor() {
    this.STORAGE_KEY = 'apg_editor_content';
  }

  /**
   * Save content to localStorage
   * @param {string} content - Editor content
   */
  saveToLocalStorage(content) {
    try {
      localStorage.setItem(this.STORAGE_KEY, content);
      return true;
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
      return false;
    }
  }

  /**
   * Load content from localStorage
   * @returns {string} Saved content or empty string
   */
  loadFromLocalStorage() {
    try {
      return localStorage.getItem(this.STORAGE_KEY) || '';
    } catch (error) {
      console.error('Failed to load from localStorage:', error);
      return '';
    }
  }

  /**
   * Clear localStorage
   */
  clearLocalStorage() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      return true;
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      return false;
    }
  }

  /**
   * Apply syntax highlighting to text
   * Highlights text and duration in format: text;seconds
   * @param {string} text - Raw text
   * @returns {string} HTML with syntax highlighting
   */
  applySyntaxHighlighting(text) {
    if (!text) return '';
    
    // Escape HTML
    const escaped = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    
    // Highlight lines in format: text;duration
    const highlighted = escaped.replace(
      /^(.+?)(;\s*)(\d+(?:\.\d+)?)\s*$/gm,
      '<span class="syntax-text">$1</span><span class="syntax-separator">$2</span><span class="syntax-duration">$3</span>'
    );
    
    return highlighted;
  }

  /**
   * Count lines and characters
   * @param {string} text - Text content
   * @returns {{lines: number, characters: number, words: number}}
   */
  getStats(text) {
    if (!text) {
      return { lines: 1, characters: 0, words: 0 };
    }
    
    // Trim trailing empty lines for accurate line count
    // but keep at least 1 line for the current cursor position
    const trimmedText = text.replace(/\n+$/, '');
    const lines = trimmedText ? trimmedText.split('\n').length : 1;
    const characters = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    return { lines, characters, words };
  }

  /**
   * Validate APG syntax
   * Format: text;seconds
   * @param {string} text - Text to validate
   * @returns {{valid: boolean, errors: Array<string>, warnings: Array<string>}}
   */
  validateSyntax(text, maxPauseDuration = 120) {
    const errors = [];
    const warnings = [];
    const lines = text.split('\n');
    
    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return; // Skip empty lines
      
      const lineNum = index + 1;
      
      // Check for correct format: text;duration
      const match = trimmed.match(/^(.+?);\s*(\d+(?:\.\d+)?)\s*$/);
      
      if (!match) {
        errors.push(`Line ${lineNum}: Invalid format. Expected: text;seconds (e.g., "Hello world;2")`);
      } else {
        const [, phrase, duration] = match;
        
        // Validate phrase is not empty
        if (!phrase || phrase.trim().length === 0) {
          errors.push(`Line ${lineNum}: Text cannot be empty`);
        }
        
        // Validate duration is reasonable
        const durationNum = parseFloat(duration);
        if (durationNum < 0) {
          errors.push(`Line ${lineNum}: Duration cannot be negative`);
        } else if (durationNum > maxPauseDuration) {
          // Long durations are warnings, not errors - they're valid syntax
          warnings.push(`Line ${lineNum}: Duration is quite long (${durationNum}s > ${maxPauseDuration}s). This is valid but consider if it's intentional.`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Generate line numbers HTML
   * @param {number} lineCount - Number of lines
   * @returns {string} HTML for line numbers
   */
  generateLineNumbers(lineCount) {
    const numbers = [];
    for (let i = 1; i <= lineCount; i++) {
      numbers.push(`<div class="line-number">${i}</div>`);
    }
    return numbers.join('');
  }
}
