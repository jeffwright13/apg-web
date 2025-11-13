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

    // Match pattern: text; number (duration optional, defaults to 0)
    // Supports: "text;5", "text;", "text"
    const match = trimmed.match(/^(.+?)(?:;\s*(\d+(?:\.\d+)?)?)?\s*$/);

    if (!match) {
      throw new Error(`Invalid line format: "${trimmed}"`);
    }

    const [, phraseRaw, duration] = match;
    
    // Remove trailing semicolon from phrase if present
    const phrase = phraseRaw.replace(/;\s*$/, '').trim();
    
    phrases.push({
      phrase: phrase,
      duration: duration ? parseFloat(duration) : 0,
    });
  }

  if (phrases.length === 0) {
    throw new Error('No valid phrases found in file');
  }

  return phrases;
}
