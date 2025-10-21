/**
 * File handling service
 * Manages file uploads and validation
 */

export class FileService {
  /**
   * Read text file content
   * @param {File} file - File object from input
   * @returns {Promise<string>} File content as text
   */
  async readTextFile(file) {
    if (!file) {
      throw new Error('No file provided');
    }

    if (!file.name.endsWith('.txt')) {
      throw new Error('File must be a .txt file');
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        resolve(e.target.result);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Read audio file as ArrayBuffer
   * @param {File} file - File object from input
   * @returns {Promise<ArrayBuffer>} File content as ArrayBuffer
   */
  async readAudioFile(file) {
    if (!file) {
      return null; // Audio file is optional
    }

    // Supported audio formats (Web Audio API can decode these)
    const supportedExtensions = ['.wav', '.mp3', '.ogg', '.m4a', '.aac', '.flac', '.aiff', '.aif', '.webm'];
    const fileExtension = file.name.toLowerCase().match(/\.[^.]+$/)?.[0];
    
    if (!fileExtension || !supportedExtensions.includes(fileExtension)) {
      throw new Error(`Unsupported audio format. Supported formats: ${supportedExtensions.join(', ')}`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        resolve(e.target.result);
      };

      reader.onerror = () => {
        reject(new Error('Failed to read audio file'));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Validate file size
   * @param {File} file - File to validate
   * @param {number} maxSizeMB - Maximum size in megabytes
   * @returns {boolean} True if valid
   */
  validateFileSize(file, maxSizeMB = 10) {
    if (!file) return true;

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new Error(`File size exceeds ${maxSizeMB}MB limit`);
    }

    return true;
  }
}
