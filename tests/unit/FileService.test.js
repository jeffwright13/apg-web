/**
 * Tests for FileService
 * Covers file reading, validation, and error handling
 */

import { FileService } from '../../scripts/services/FileService.js';

// Mock File class
class MockFile {
  constructor(content, name, options = {}) {
    this.content = content;
    this.name = name;
    this.size = options.size || content.length;
    this.type = options.type || 'text/plain';
  }
}

// Mock FileReader
class MockFileReader {
  readAsText(file) {
    setTimeout(() => {
      if (file.name === 'error.txt') {
        this.onerror();
      } else {
        this.onload({ target: { result: file.content } });
      }
    }, 0);
  }

  readAsArrayBuffer(file) {
    setTimeout(() => {
      if (file.name === 'error.mp3') {
        this.onerror();
      } else {
        // Create a simple ArrayBuffer for mock
        const buffer = new ArrayBuffer(file.content.length);
        const view = new Uint8Array(buffer);
        for (let i = 0; i < file.content.length; i++) {
          view[i] = file.content.charCodeAt(i);
        }
        this.onload({ target: { result: buffer } });
      }
    }, 0);
  }
}

// Set up global FileReader mock
global.FileReader = MockFileReader;

describe('FileService', () => {
  let fileService;

  beforeEach(() => {
    fileService = new FileService();
  });

  describe('readTextFile', () => {
    test('reads valid text file', async () => {
      const file = new MockFile('Hello, world!', 'test.txt');
      const content = await fileService.readTextFile(file);

      expect(content).toBe('Hello, world!');
    });

    test('reads multi-line text file', async () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const file = new MockFile(content, 'phrases.txt');
      const result = await fileService.readTextFile(file);

      expect(result).toBe(content);
    });

    test('reads empty text file', async () => {
      const file = new MockFile('', 'empty.txt');
      const content = await fileService.readTextFile(file);

      expect(content).toBe('');
    });

    test('throws error when no file provided', async () => {
      await expect(fileService.readTextFile(null)).rejects.toThrow(
        'No file provided'
      );
    });

    test('throws error when file is undefined', async () => {
      await expect(fileService.readTextFile(undefined)).rejects.toThrow(
        'No file provided'
      );
    });

    test('throws error for non-.txt file', async () => {
      const file = new MockFile('content', 'test.pdf');

      await expect(fileService.readTextFile(file)).rejects.toThrow(
        'File must be a .txt file'
      );
    });

    test('rejects files with .TXT extension (case sensitive)', async () => {
      const file = new MockFile('content', 'test.TXT');

      await expect(fileService.readTextFile(file)).rejects.toThrow(
        'File must be a .txt file'
      );
    });

    test('throws error when FileReader fails', async () => {
      const file = new MockFile('content', 'error.txt');

      await expect(fileService.readTextFile(file)).rejects.toThrow(
        'Failed to read file'
      );
    });

    test('handles special characters in content', async () => {
      const content = 'Special chars: é, ñ, 中文, 🎵';
      const file = new MockFile(content, 'special.txt');
      const result = await fileService.readTextFile(file);

      expect(result).toBe(content);
    });

    test('handles very long content', async () => {
      const content = 'a'.repeat(10000);
      const file = new MockFile(content, 'long.txt');
      const result = await fileService.readTextFile(file);

      expect(result).toBe(content);
      expect(result.length).toBe(10000);
    });
  });

  describe('readAudioFile', () => {
    test('returns null when no file provided', async () => {
      const result = await fileService.readAudioFile(null);
      expect(result).toBeNull();
    });

    test('returns null when undefined file provided', async () => {
      const result = await fileService.readAudioFile(undefined);
      expect(result).toBeNull();
    });

    test('reads .wav file', async () => {
      const file = new MockFile('audio data', 'music.wav');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .mp3 file', async () => {
      const file = new MockFile('audio data', 'music.mp3');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .ogg file', async () => {
      const file = new MockFile('audio data', 'music.ogg');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .m4a file', async () => {
      const file = new MockFile('audio data', 'music.m4a');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .aac file', async () => {
      const file = new MockFile('audio data', 'music.aac');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .flac file', async () => {
      const file = new MockFile('audio data', 'music.flac');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .aiff file', async () => {
      const file = new MockFile('audio data', 'music.aiff');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .aif file', async () => {
      const file = new MockFile('audio data', 'music.aif');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('reads .webm file', async () => {
      const file = new MockFile('audio data', 'music.webm');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('handles uppercase extensions', async () => {
      const file = new MockFile('audio data', 'music.MP3');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('handles mixed case extensions', async () => {
      const file = new MockFile('audio data', 'music.WaV');
      const result = await fileService.readAudioFile(file);

      expect(result).toBeInstanceOf(ArrayBuffer);
    });

    test('throws error for unsupported format', async () => {
      const file = new MockFile('audio data', 'music.avi');

      await expect(fileService.readAudioFile(file)).rejects.toThrow(
        'Unsupported audio format'
      );
    });

    test('throws error for .txt file', async () => {
      const file = new MockFile('audio data', 'music.txt');

      await expect(fileService.readAudioFile(file)).rejects.toThrow(
        'Unsupported audio format'
      );
    });

    test('throws error for file without extension', async () => {
      const file = new MockFile('audio data', 'music');

      await expect(fileService.readAudioFile(file)).rejects.toThrow(
        'Unsupported audio format'
      );
    });

    test('throws error when FileReader fails', async () => {
      const file = new MockFile('audio data', 'error.mp3');

      await expect(fileService.readAudioFile(file)).rejects.toThrow(
        'Failed to read audio file'
      );
    });

    test('error message lists supported formats', async () => {
      const file = new MockFile('audio data', 'music.xyz');

      await expect(fileService.readAudioFile(file)).rejects.toThrow(
        '.wav, .mp3, .ogg, .m4a, .aac, .flac, .aiff, .aif, .webm'
      );
    });
  });

  describe('validateFileSize', () => {
    test('returns true for null file', () => {
      const result = fileService.validateFileSize(null);
      expect(result).toBe(true);
    });

    test('returns true for undefined file', () => {
      const result = fileService.validateFileSize(undefined);
      expect(result).toBe(true);
    });

    test('returns true for file within default limit (10MB)', () => {
      const file = new MockFile('content', 'test.txt', {
        size: 5 * 1024 * 1024, // 5MB
      });

      const result = fileService.validateFileSize(file);
      expect(result).toBe(true);
    });

    test('returns true for file exactly at default limit', () => {
      const file = new MockFile('content', 'test.txt', {
        size: 10 * 1024 * 1024, // 10MB
      });

      const result = fileService.validateFileSize(file);
      expect(result).toBe(true);
    });

    test('throws error for file exceeding default limit', () => {
      const file = new MockFile('content', 'test.txt', {
        size: 11 * 1024 * 1024, // 11MB
      });

      expect(() => fileService.validateFileSize(file)).toThrow(
        'File size exceeds 10MB limit'
      );
    });

    test('returns true for file within custom limit', () => {
      const file = new MockFile('content', 'test.txt', {
        size: 3 * 1024 * 1024, // 3MB
      });

      const result = fileService.validateFileSize(file, 5);
      expect(result).toBe(true);
    });

    test('throws error for file exceeding custom limit', () => {
      const file = new MockFile('content', 'test.txt', {
        size: 6 * 1024 * 1024, // 6MB
      });

      expect(() => fileService.validateFileSize(file, 5)).toThrow(
        'File size exceeds 5MB limit'
      );
    });

    test('handles very small files', () => {
      const file = new MockFile('a', 'test.txt', { size: 1 }); // 1 byte

      const result = fileService.validateFileSize(file);
      expect(result).toBe(true);
    });

    test('handles zero-byte files', () => {
      const file = new MockFile('', 'test.txt', { size: 0 });

      const result = fileService.validateFileSize(file);
      expect(result).toBe(true);
    });

    test('handles 1MB limit', () => {
      const file = new MockFile('content', 'test.txt', {
        size: 1024 * 1024, // 1MB
      });

      const result = fileService.validateFileSize(file, 1);
      expect(result).toBe(true);
    });

    test('throws error with correct limit in message', () => {
      const file = new MockFile('content', 'test.txt', {
        size: 21 * 1024 * 1024, // 21MB
      });

      expect(() => fileService.validateFileSize(file, 20)).toThrow(
        'File size exceeds 20MB limit'
      );
    });
  });

  describe('integration scenarios', () => {
    test('reads and validates text file in sequence', async () => {
      const file = new MockFile('Test content', 'test.txt', {
        size: 1024,
      });

      // Validate first
      const isValid = fileService.validateFileSize(file);
      expect(isValid).toBe(true);

      // Then read
      const content = await fileService.readTextFile(file);
      expect(content).toBe('Test content');
    });

    test('reads and validates audio file in sequence', async () => {
      const file = new MockFile('Audio data', 'music.mp3', {
        size: 2 * 1024 * 1024, // 2MB
      });

      // Validate first
      const isValid = fileService.validateFileSize(file);
      expect(isValid).toBe(true);

      // Then read
      const arrayBuffer = await fileService.readAudioFile(file);
      expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
    });

    test('validates before reading oversized file', () => {
      const file = new MockFile('Large content', 'large.txt', {
        size: 50 * 1024 * 1024, // 50MB
      });

      // Validation should fail before attempting to read
      expect(() => fileService.validateFileSize(file)).toThrow(
        'File size exceeds 10MB limit'
      );
    });
  });
});
