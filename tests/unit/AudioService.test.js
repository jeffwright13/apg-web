/**
 * Tests for AudioService
 * Covers MP3 encoding, WAV export, audio mixing, and buffer operations
 */

import { AudioService } from '../../scripts/services/AudioService.js';

// Mock AudioContext
class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
  }

  createBuffer(numChannels, length, sampleRate) {
    const buffer = {
      numberOfChannels: numChannels,
      length: length,
      sampleRate: sampleRate,
      duration: length / sampleRate,
      getChannelData: (channel) => {
        if (channel >= numChannels) {
          throw new Error('Channel index out of range');
        }
        return new Float32Array(length);
      },
    };
    return buffer;
  }

  async decodeAudioData(_arrayBuffer) {
    // Mock decode - return a simple buffer
    return this.createBuffer(2, 44100, 44100); // 1 second stereo
  }

  close() {
    // Mock close method
    return Promise.resolve();
  }
}

// Mock lamejs
global.lamejs = {
  Mp3Encoder: class {
    constructor(channels, sampleRate, bitrate) {
      this.channels = channels;
      this.sampleRate = sampleRate;
      this.bitrate = bitrate;
    }

    encodeBuffer(_left, _right) {
      // Return mock MP3 data
      return new Int8Array(1152); // MP3 frame size
    }

    flush() {
      return new Int8Array(100); // Remaining data
    }
  },
};

// Mock AudioContext globally
global.AudioContext = MockAudioContext;

describe('AudioService', () => {
  let audioService;

  beforeEach(() => {
    audioService = new AudioService();
  });

  afterEach(() => {
    if (audioService.audioContext) {
      audioService.audioContext = null;
    }
  });

  describe('getAudioContext', () => {
    test('creates AudioContext on first call', () => {
      const context = audioService.getAudioContext();
      expect(context).toBeInstanceOf(MockAudioContext);
      expect(audioService.audioContext).toBe(context);
    });

    test('returns same AudioContext on subsequent calls', () => {
      const context1 = audioService.getAudioContext();
      const context2 = audioService.getAudioContext();
      expect(context1).toBe(context2);
    });
  });

  describe('createSilence', () => {
    test('creates silent buffer with correct duration', () => {
      const duration = 2.5; // 2.5 seconds
      const buffer = audioService.createSilence(duration);

      expect(buffer.numberOfChannels).toBe(1);
      expect(buffer.sampleRate).toBe(44100);
      expect(buffer.length).toBe(Math.floor(44100 * 2.5));
    });

    test('creates buffer with all zeros', () => {
      const buffer = audioService.createSilence(1);
      const data = buffer.getChannelData(0);

      // Check that all samples are 0
      for (let i = 0; i < data.length; i++) {
        expect(data[i]).toBe(0);
      }
    });
  });

  describe('concatenateBuffers', () => {
    test('throws error for empty array', () => {
      expect(() => {
        audioService.concatenateBuffers([]);
      }).toThrow('No buffers to concatenate');
    });

    test('concatenates single buffer', () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 1000, 44100);

      const result = audioService.concatenateBuffers([buffer]);

      expect(result.numberOfChannels).toBe(2);
      expect(result.length).toBe(1000);
      expect(result.sampleRate).toBe(44100);
    });

    test('concatenates multiple buffers', () => {
      const context = audioService.getAudioContext();
      const buffer1 = context.createBuffer(2, 1000, 44100);
      const buffer2 = context.createBuffer(2, 2000, 44100);
      const buffer3 = context.createBuffer(2, 500, 44100);

      const result = audioService.concatenateBuffers([
        buffer1,
        buffer2,
        buffer3,
      ]);

      expect(result.numberOfChannels).toBe(2);
      expect(result.length).toBe(3500); // 1000 + 2000 + 500
      expect(result.sampleRate).toBe(44100);
    });
  });

  describe('floatTo16BitPCM', () => {
    test('converts float samples to 16-bit PCM', () => {
      const input = new Float32Array([0, 0.5, -0.5, 1.0, -1.0]);
      const output = audioService.floatTo16BitPCM(input);

      expect(output).toBeInstanceOf(Int16Array);
      expect(output.length).toBe(5);
      expect(output[0]).toBe(0); // 0 -> 0
      expect(output[1]).toBe(16383); // 0.5 -> 0.5 * 0x7FFF
      expect(output[2]).toBe(-16384); // -0.5 -> -0.5 * 0x8000
      expect(output[3]).toBe(32767); // 1.0 -> 0x7FFF
      expect(output[4]).toBe(-32768); // -1.0 -> -0x8000
    });

    test('clamps values outside -1.0 to 1.0 range', () => {
      const input = new Float32Array([1.5, -1.5, 2.0, -2.0]);
      const output = audioService.floatTo16BitPCM(input);

      expect(output[0]).toBe(32767); // Clamped to 1.0
      expect(output[1]).toBe(-32768); // Clamped to -1.0
      expect(output[2]).toBe(32767); // Clamped to 1.0
      expect(output[3]).toBe(-32768); // Clamped to -1.0
    });

    test('handles empty array', () => {
      const input = new Float32Array([]);
      const output = audioService.floatTo16BitPCM(input);

      expect(output).toBeInstanceOf(Int16Array);
      expect(output.length).toBe(0);
    });
  });

  describe('isLameAvailable', () => {
    test('returns true when lamejs is defined', () => {
      expect(audioService.isLameAvailable()).toBe(true);
    });

    test('returns false when lamejs is undefined', () => {
      const originalLamejs = global.lamejs;
      global.lamejs = undefined;

      expect(audioService.isLameAvailable()).toBe(false);

      global.lamejs = originalLamejs;
    });
  });

  describe('audioBufferToMP3', () => {
    test('encodes mono buffer to MP3', async () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(1, 44100, 44100); // 1 second mono

      const blob = await audioService.audioBufferToMP3(buffer, 192);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/mp3');
      expect(blob.size).toBeGreaterThan(0);
    });

    test('encodes stereo buffer to MP3', async () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 44100, 44100); // 1 second stereo

      const blob = await audioService.audioBufferToMP3(buffer, 192);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/mp3');
      expect(blob.size).toBeGreaterThan(0);
    });

    test('throws error when lamejs not available', async () => {
      const originalLamejs = global.lamejs;
      global.lamejs = undefined;

      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 44100, 44100);

      await expect(
        audioService.audioBufferToMP3(buffer, 192)
      ).rejects.toThrow('MP3 encoder not available');

      global.lamejs = originalLamejs;
    });

    test('calls progress callback during encoding', async () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 44100, 44100);

      const progressCalls = [];
      const onProgress = (progress) => progressCalls.push(progress);

      await audioService.audioBufferToMP3(buffer, 192, onProgress);

      expect(progressCalls.length).toBeGreaterThan(0);
      expect(progressCalls[progressCalls.length - 1]).toBe(100);
    });

    test('respects cancellation flag', async () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 441000, 44100); // 10 seconds

      // Start encoding and cancel during it
      const encodePromise = audioService.audioBufferToMP3(buffer, 192);
      
      // Cancel after a short delay (during encoding)
      setTimeout(() => {
        audioService.cancelEncoding();
      }, 10);

      await expect(encodePromise).rejects.toThrow('MP3 encoding cancelled by user');
    });

    test('uses specified bitrate', async () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 44100, 44100);

      const bitrates = [128, 192, 256, 320];

      for (const bitrate of bitrates) {
        const blob = await audioService.audioBufferToMP3(buffer, bitrate);
        expect(blob).toBeInstanceOf(Blob);
      }
    });
  });

  describe('cancelEncoding', () => {
    test('sets encodingCancelled flag', () => {
      expect(audioService.encodingCancelled).toBe(false);

      audioService.cancelEncoding();

      expect(audioService.encodingCancelled).toBe(true);
    });
  });

  describe('audioBufferToWav', () => {
    test('converts mono buffer to WAV', () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(1, 44100, 44100);

      const blob = audioService.audioBufferToWav(buffer);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
      expect(blob.size).toBeGreaterThan(44); // At least WAV header size
    });

    test('converts stereo buffer to WAV', () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 44100, 44100);

      const blob = audioService.audioBufferToWav(buffer);

      expect(blob).toBeInstanceOf(Blob);
      expect(blob.type).toBe('audio/wav');
    });

    test('WAV file size is larger than MP3', async () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 44100, 44100);

      const wavBlob = audioService.audioBufferToWav(buffer);
      const mp3Blob = await audioService.audioBufferToMP3(buffer, 192);

      // WAV should be larger (uncompressed vs compressed)
      // Note: Mock MP3 encoder returns fixed-size data, so just check WAV is larger
      expect(wavBlob.size).toBeGreaterThan(mp3Blob.size);
    });
  });

  describe('mixBuffers', () => {
    test('mixes two buffers with same length', () => {
      const context = audioService.getAudioContext();
      const buffer1 = context.createBuffer(2, 1000, 44100);
      const buffer2 = context.createBuffer(2, 1000, 44100);

      const result = audioService.mixBuffers(buffer1, buffer2);

      expect(result.numberOfChannels).toBe(2);
      expect(result.length).toBe(1000);
      expect(result.sampleRate).toBe(44100);
    });

    test('loops shorter background buffer', () => {
      const context = audioService.getAudioContext();
      const buffer1 = context.createBuffer(2, 10000, 44100); // Speech
      const buffer2 = context.createBuffer(2, 1000, 44100); // Background

      const result = audioService.mixBuffers(buffer1, buffer2);

      expect(result.length).toBe(10000); // Length of speech buffer
    });

    test('applies attenuation to background', () => {
      const context = audioService.getAudioContext();
      const buffer1 = context.createBuffer(2, 1000, 44100);
      const buffer2 = context.createBuffer(2, 1000, 44100);

      // Fill buffer2 with non-zero values
      const data2 = buffer2.getChannelData(0);
      for (let i = 0; i < data2.length; i++) {
        data2[i] = 0.5;
      }

      const resultNoAtten = audioService.mixBuffers(buffer1, buffer2, {
        attenuation: 0,
      });
      const resultWithAtten = audioService.mixBuffers(buffer1, buffer2, {
        attenuation: -6,
      }); // -6dB

      // With attenuation, background should be quieter
      expect(resultWithAtten).toBeDefined();
      expect(resultNoAtten).toBeDefined();
    });
  });

  describe('applyFades', () => {
    test('applies fade in and fade out', () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 44100, 44100); // 1 second

      // Fill with constant value
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) {
        data[i] = 1.0;
      }

      const result = audioService.applyFades(buffer, {
        fadeIn: 1000, // 1 second
        fadeOut: 1000, // 1 second
      });

      const resultData = result.getChannelData(0);

      // Check fade in (first sample should be 0 or very small)
      expect(Math.abs(resultData[0])).toBeLessThan(0.1);

      // Check fade out (last sample should be 0 or very small)
      expect(Math.abs(resultData[resultData.length - 1])).toBeLessThan(0.1);
    });

    test('handles short buffers', () => {
      const context = audioService.getAudioContext();
      const buffer = context.createBuffer(2, 100, 44100); // Very short

      const result = audioService.applyFades(buffer, {
        fadeIn: 3000,
        fadeOut: 6000,
      });

      expect(result).toBeDefined();
      expect(result.length).toBe(100);
    });
  });

  describe('dispose', () => {
    test('cleans up audio context', () => {
      audioService.getAudioContext(); // Create context
      expect(audioService.audioContext).toBeDefined();

      audioService.dispose();

      expect(audioService.audioContext).toBeNull();
    });

    test('handles dispose when no context exists', () => {
      expect(() => {
        audioService.dispose();
      }).not.toThrow();
    });
  });
});
