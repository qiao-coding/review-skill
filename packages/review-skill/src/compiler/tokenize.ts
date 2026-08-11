/**
 * Rough token estimation: characters / 4.
 * This is a common heuristic that works well for English text.
 * For production, tiktoken or gpt-tokenizer would be more accurate.
 */
export function estimateTokens(charCount: number): number {
  return Math.round(charCount / 4);
}
