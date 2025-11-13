/**
 * Tests for phrase file parser
 */

import { parseTextFile } from '../../scripts/utils/parser.js';

describe('parseTextFile', () => {
  test('parses simple phrase with duration', () => {
    const content = 'Hello world; 2';
    const result = parseTextFile(content);

    expect(result).toEqual([{ phrase: 'Hello world', duration: 2 }]);
  });

  test('parses multiple phrases', () => {
    const content = `
      First phrase; 1
      Second phrase; 2.5
      Third phrase; 0
    `;
    const result = parseTextFile(content);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ phrase: 'First phrase', duration: 1 });
    expect(result[1]).toEqual({ phrase: 'Second phrase', duration: 2.5 });
    expect(result[2]).toEqual({ phrase: 'Third phrase', duration: 0 });
  });

  test('parses silence marker', () => {
    const content = '*; 3';
    const result = parseTextFile(content);

    expect(result).toEqual([{ phrase: '*', duration: 3 }]);
  });

  test('handles extra whitespace', () => {
    const content = '  Hello world  ;  2  ';
    const result = parseTextFile(content);

    expect(result).toEqual([{ phrase: 'Hello world', duration: 2 }]);
  });

  test('skips empty lines', () => {
    const content = `
      First phrase; 1

      Second phrase; 2

    `;
    const result = parseTextFile(content);

    expect(result).toHaveLength(2);
  });

  test('handles missing duration (defaults to 0)', () => {
    const content = 'Hello world;';
    const result = parseTextFile(content);

    expect(result).toEqual([{ phrase: 'Hello world', duration: 0 }]);
  });

  test('handles no semicolon (defaults to 0)', () => {
    const content = 'Hello world';
    const result = parseTextFile(content);

    expect(result).toEqual([{ phrase: 'Hello world', duration: 0 }]);
  });

  test('handles mixed formats', () => {
    const content = `
      With duration; 2
      No duration;
      No semicolon at all
    `;
    const result = parseTextFile(content);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ phrase: 'With duration', duration: 2 });
    expect(result[1]).toEqual({ phrase: 'No duration', duration: 0 });
    expect(result[2]).toEqual({ phrase: 'No semicolon at all', duration: 0 });
  });

  test('throws error for empty content', () => {
    expect(() => parseTextFile('')).toThrow(
      'Content must be a non-empty string'
    );
  });

  test('throws error for non-string content', () => {
    expect(() => parseTextFile(null)).toThrow(
      'Content must be a non-empty string'
    );
  });

  test('throws error for file with no valid phrases', () => {
    const content = '\n\n\n';

    expect(() => parseTextFile(content)).toThrow(
      'No valid phrases found in file'
    );
  });

  test('handles decimal durations', () => {
    const content = 'Test phrase; 1.5';
    const result = parseTextFile(content);

    expect(result[0].duration).toBe(1.5);
  });
});
