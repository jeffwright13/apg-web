/**
 * Parse phrase file content
 * Format: "phrase text; duration_in_seconds"
 * Example: "Hello world; 2" or "*; 3" for silence
 */

export function parseTextFile(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Content must be a non-empty string');
  }

  const lines = content.trim().split('\n');
  const phrases = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match pattern: text; number
    const match = trimmed.match(/^(.+?);\s*(\d+(?:\.\d+)?)\s*$/);

    if (!match) {
      throw new Error(`Invalid line format: "${trimmed}"`);
    }

    const [, phrase, duration] = match;
    phrases.push({
      phrase: phrase.trim(),
      duration: parseFloat(duration),
    });
  }

  if (phrases.length === 0) {
    throw new Error('No valid phrases found in file');
  }

  return phrases;
}
