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

  test('throws error for invalid format', () => {
    const content = 'Invalid line without semicolon';

    expect(() => parseTextFile(content)).toThrow('Invalid line format');
  });

  test('throws error for missing duration', () => {
    const content = 'Hello world;';

    expect(() => parseTextFile(content)).toThrow('Invalid line format');
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
