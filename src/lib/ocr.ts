/**
 * Tidies text read from a photo of a printed or handwritten recipe, before it goes through the
 * same recipe reader as captions (parseRecipeText).
 *
 * Text recognition returns the page as lines or blocks, so long sentences arrive cut into
 * pieces ("Bake for 25 minutes until the" / "top is golden."), and words can be split
 * with a hyphen at the end of a line ("toma-" / "toes").
 */

// A line at least this long that doesn't end a sentence was probably wrapped on the page.
const WRAPPED_MIN_LENGTH = 28;

function joinsNext(line: string, next: string): boolean {
  if (!next || line.length < WRAPPED_MIN_LENGTH) return false;
  if (/[.!?:;)]$/.test(line)) return false;
  // Continues with a lowercase word (not a new list item or heading).
  return /^[a-z(]/.test(next);
}

export function cleanOcrText(blocks: string[]): string {
  const lines = blocks
    .join('\n')
    .replace(/\r\n?/g, '\n')
    // Curly quotes and odd dashes from print.
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    // Page numbers and stray single characters.
    .filter((l) => l && !/^(\d{1,3}|[^\p{L}\p{N}])$/u.test(l))
    // List bullets often come out as other symbols, and "2." as "2,".
    .map((l) => l.replace(/^[+*»·•◦▪●■]\s+/, '- ').replace(/^(\d{1,2}),\s/, '$1. '));

  const out: string[] = [];
  for (const line of lines) {
    const prev = out[out.length - 1];
    if (prev !== undefined && /[a-z]-$/.test(prev) && /^[a-z]/.test(line)) {
      out[out.length - 1] = prev.slice(0, -1) + line; // "toma-" + "toes"
    } else if (prev !== undefined && joinsNext(prev, line)) {
      out[out.length - 1] = `${prev} ${line}`;
    } else {
      out.push(line);
    }
  }
  return out.join('\n');
}
