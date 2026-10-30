/**
 * Generates lowercased search tokens from text and phone inputs for fast prefix search.
 * Splits on whitespace, dashes, dots, and common separators.
 */
export function generateSearchTokens(inputs: (string | number | undefined | null)[]): string[] {
  const tokenSet = new Set<string>();

  for (const input of inputs) {
    if (input === undefined || input === null) continue;
    const str = String(input).toLowerCase().trim();
    if (!str) continue;

    // Split words on whitespace and punctuation
    const words = str.split(/[\s,._\-+/()]+/);
    for (const word of words) {
      if (word.length >= 1) {
        tokenSet.add(word);
      }
    }

    // For numbers/phones, also include pure digits
    const digitsOnly = str.replace(/\D/g, '');
    if (digitsOnly.length >= 4) {
      tokenSet.add(digitsOnly);
    }
  }

  return Array.from(tokenSet);
}

