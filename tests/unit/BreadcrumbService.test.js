/**
 * Tests for BreadcrumbService
 * Verifies stage markers persist across a simulated "crash" (i.e. survive
 * without an explicit clear()) and are readable/clearable on the next load.
 */

import { BreadcrumbService } from '../../scripts/services/BreadcrumbService.js';

describe('BreadcrumbService', () => {
  let service;

  beforeEach(() => {
    localStorage.clear();
    service = new BreadcrumbService();
  });

  describe('getLastIncomplete', () => {
    test('returns null when nothing has been marked', () => {
      expect(service.getLastIncomplete()).toBeNull();
    });

    test('returns the marked stage and meta', () => {
      service.mark('mix-start', { phrase: 3 });

      const result = service.getLastIncomplete();
      expect(result.stage).toBe('mix-start');
      expect(result.meta).toEqual({ phrase: 3 });
      expect(typeof result.timestamp).toBe('number');
    });

    test('returns only the most recent mark', () => {
      service.mark('stage-one');
      service.mark('stage-two');

      expect(service.getLastIncomplete().stage).toBe('stage-two');
    });

    test('returns null for corrupted storage instead of throwing', () => {
      localStorage.setItem('apg-generation-breadcrumb', '{not valid json');
      expect(() => service.getLastIncomplete()).not.toThrow();
      expect(service.getLastIncomplete()).toBeNull();
    });
  });

  describe('clear', () => {
    test('removes a previously marked breadcrumb', () => {
      service.mark('wav-encode-start');
      service.clear();

      expect(service.getLastIncomplete()).toBeNull();
    });

    test('is a no-op when nothing was marked', () => {
      expect(() => service.clear()).not.toThrow();
    });
  });

  describe('mark', () => {
    test('does not throw when localStorage.setItem fails', () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => { throw new Error('QuotaExceededError'); };

      expect(() => service.mark('mix-start')).not.toThrow();

      Storage.prototype.setItem = original;
    });
  });

  describe('storage key isolation', () => {
    test('two instances with different keys do not collide', () => {
      const other = new BreadcrumbService('other-key');
      service.mark('stage-a');
      other.mark('stage-b');

      expect(service.getLastIncomplete().stage).toBe('stage-a');
      expect(other.getLastIncomplete().stage).toBe('stage-b');
    });
  });
});
