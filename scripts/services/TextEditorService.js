/**
 * Text Editor Service
 * Manages the built-in text editor for APG programs
 * Features: line numbers, syntax highlighting, localStorage, templates
 */

export class TextEditorService {
  constructor() {
    this.STORAGE_KEY = 'apg_editor_content';
    this.templates = {
      simple: `Hello, welcome to the Audio Program Generator!;2
This is a simple example program.;1.5
You can create your own programs using this editor.;2`,
      
      loop: `Starting countdown;1
Three;1
Two;1
One;1
Blast off!;2`,
      
      conversation: `Hi there! How are you today?;1.5
I'm doing great, thanks for asking!;1.5
That's wonderful to hear.;1
How about you?;1.5
I'm fantastic! Thanks for asking.;2`,
      
      meditation: `Welcome to this brief meditation session.;3
Take a deep breath in.;4
And slowly breathe out.;4
Feel your body relax with each breath.;3
Continue breathing naturally.;2`,
      
      announcement: `Attention please.;2
The event will begin in five minutes.;2
Please take your seats.;1.5
Thank you for your cooperation.;2`
    };
  }

  /**
   * Get all available templates
   * @returns {Object} Template names and content
   */
  getTemplates() {
    return this.templates;
  }

  /**
   * Get template names for dropdown
   * @returns {Array<{value: string, label: string}>}
   */
  getTemplateOptions() {
    return [
      { value: '', label: '-- Select a template --' },
      { value: 'simple', label: 'Simple Example' },
      { value: 'loop', label: 'Countdown Loop' },
      { value: 'conversation', label: 'Two-Voice Conversation' },
      { value: 'meditation', label: 'Meditation Guide' },
      { value: 'announcement', label: 'Public Announcement' }
    ];
  }

  /**
   * Load template content
   * @param {string} templateName - Name of template
   * @returns {string} Template content
   */
  loadTemplate(templateName) {
    return this.templates[templateName] || '';
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
      return { lines: 0, characters: 0, words: 0 };
    }
    
    const lines = text.split('\n').length;
    const characters = text.length;
    const words = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    
    return { lines, characters, words };
  }

  /**
   * Validate APG syntax
   * Format: text;seconds
   * @param {string} text - Text to validate
   * @returns {{valid: boolean, errors: Array<string>}}
   */
  validateSyntax(text) {
    const errors = [];
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
        } else if (durationNum > 60) {
          errors.push(`Line ${lineNum}: Duration seems unusually long (${durationNum}s). Consider breaking into smaller segments.`);
        }
      }
    });
    
    return {
      valid: errors.length === 0,
      errors
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
