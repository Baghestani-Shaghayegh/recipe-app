export type Ingredient = {
  /** The line exactly as the user wrote it, e.g. "1 1/2 cups flour". */
  text: string;
  amount?: number;
  unit?: string;
  /** The ingredient itself, e.g. "flour". Used for search and (later) pantry matching. */
  name: string;
};

const UNICODE_FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
  '⅛': 0.125,
};

// Canonical unit name -> spellings people use.
const UNITS: Record<string, string[]> = {
  tsp: ['tsp', 'teaspoon', 'teaspoons', 't'],
  tbsp: ['tbsp', 'tablespoon', 'tablespoons', 'tbs', 'T'],
  cup: ['cup', 'cups', 'c'],
  ml: ['ml', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  l: ['l', 'liter', 'liters', 'litre', 'litres'],
  g: ['g', 'gram', 'grams', 'gr'],
  kg: ['kg', 'kilogram', 'kilograms'],
  oz: ['oz', 'ounce', 'ounces'],
  lb: ['lb', 'lbs', 'pound', 'pounds'],
  pinch: ['pinch', 'pinches'],
  clove: ['clove', 'cloves'],
  can: ['can', 'cans'],
  slice: ['slice', 'slices'],
  bunch: ['bunch', 'bunches'],
  piece: ['piece', 'pieces', 'pc', 'pcs'],
};

const UNIT_LOOKUP = new Map<string, string>();
for (const [canonical, spellings] of Object.entries(UNITS)) {
  for (const s of spellings) {
    // Single-letter "t"/"T" are case sensitive (teaspoon vs tablespoon); the rest are not.
    UNIT_LOOKUP.set(s.length === 1 ? s : s.toLowerCase(), canonical);
  }
}

function lookupUnit(word: string): string | undefined {
  const cleaned = word.replace(/\.$/, '');
  if (cleaned.length === 1) return UNIT_LOOKUP.get(cleaned);
  return UNIT_LOOKUP.get(cleaned.toLowerCase());
}

/** Parses "2", "1.5", "1/2", "1 1/2", "½", "1½". Returns undefined if it isn't a number. */
function parseAmountToken(token: string): number | undefined {
  if (/^\d+(\.\d+)?$/.test(token)) return Number(token);
  const frac = token.match(/^(\d+)\/(\d+)$/);
  if (frac && Number(frac[2]) !== 0) return Number(frac[1]) / Number(frac[2]);
  const mixedUnicode = token.match(/^(\d*)([¼½¾⅓⅔⅛])$/);
  if (mixedUnicode) return Number(mixedUnicode[1] || 0) + UNICODE_FRACTIONS[mixedUnicode[2]];
  return undefined;
}

/**
 * Turns one ingredient line into amount + unit + name.
 * Anything it can't understand just becomes the name, so no text is ever lost.
 */
export function parseIngredientLine(line: string): Ingredient {
  const text = line.trim().replace(/^[-•*]\s*/, '');
  const tokens = text.split(/\s+/).filter(Boolean);
  let i = 0;
  let amount: number | undefined;

  const first = tokens[i] !== undefined ? parseAmountToken(tokens[i]) : undefined;
  if (first !== undefined) {
    amount = first;
    i++;
    // Mixed number like "1 1/2".
    const next = tokens[i] !== undefined ? parseAmountToken(tokens[i]) : undefined;
    if (next !== undefined && next < 1 && Number.isInteger(first)) {
      amount += next;
      i++;
    }
  }

  let unit: string | undefined;
  if (amount !== undefined && tokens[i] !== undefined) {
    unit = lookupUnit(tokens[i]);
    if (unit) {
      i++;
      if (tokens[i]?.toLowerCase() === 'of') i++;
    }
  }

  const name = tokens.slice(i).join(' ').trim() || text;
  return { text, amount, unit, name };
}

/** One ingredient per line; blank lines are skipped. */
export function parseIngredientList(text: string): Ingredient[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map(parseIngredientLine);
}
