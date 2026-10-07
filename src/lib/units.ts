export type UnitSystem = 'original' | 'metric' | 'us';

export const UNIT_SYSTEMS: { id: UnitSystem; label: string }[] = [
  { id: 'original', label: 'As written' },
  { id: 'metric', label: 'Metric' },
  { id: 'us', label: 'US cups' },
];

const ML: Record<string, number> = { tsp: 4.93, tbsp: 14.79, cup: 236.6, ml: 1, l: 1000 };
const GRAMS: Record<string, number> = { g: 1, kg: 1000, oz: 28.35, lb: 453.6 };

/** Rounds to a sensible kitchen number: 4.93 -> 5, 236.6 -> 235, 12.4 -> 12. */
function roundNice(n: number): number {
  if (n >= 100) return Math.round(n / 5) * 5;
  if (n >= 10) return Math.round(n);
  return Math.round(n * 2) / 2;
}

const KITCHEN_FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1];

/** Snaps to the nearest quarter or third, the way measuring cups and spoons come: 1.057 -> 1, 1.3 -> 1⅓. */
function snapToMeasure(n: number): number {
  const whole = Math.floor(n);
  const frac = n - whole;
  const nearest = KITCHEN_FRACTIONS.reduce((a, b) =>
    Math.abs(b - frac) < Math.abs(a - frac) ? b : a,
  );
  return whole + nearest;
}

/** Converts an amount to the other system; units that aren't weights or volumes are left alone. */
export function convertAmount(
  amount: number,
  unit: string | undefined,
  system: UnitSystem,
): { amount: number; unit: string | undefined } {
  if (system === 'original' || !unit) return { amount, unit };
  if (ML[unit]) {
    const ml = amount * ML[unit];
    if (system === 'metric') {
      return ml >= 1000
        ? { amount: roundNice(ml / 10) / 100, unit: 'l' }
        : { amount: roundNice(ml), unit: 'ml' };
    }
    if (ml >= 59) return { amount: snapToMeasure(ml / ML.cup), unit: 'cup' };
    if (ml >= 14) return { amount: snapToMeasure(ml / ML.tbsp), unit: 'tbsp' };
    return { amount: snapToMeasure(ml / ML.tsp), unit: 'tsp' };
  }
  if (GRAMS[unit]) {
    const g = amount * GRAMS[unit];
    if (system === 'metric') {
      return g >= 1000
        ? { amount: roundNice(g / 10) / 100, unit: 'kg' }
        : { amount: roundNice(g), unit: 'g' };
    }
    return g >= GRAMS.lb
      ? { amount: g / GRAMS.lb, unit: 'lb' }
      : { amount: g / GRAMS.oz, unit: 'oz' };
  }
  return { amount, unit };
}

/** "Bake at 350°F" -> "Bake at 175°C" (metric), and the other way round for US. Rounds to 5 degrees. */
export function convertTemperatures(text: string, system: UnitSystem): string {
  if (system === 'original') return text;
  return text.replace(
    /(\d{2,3})\s*(?:°|º|degrees?)\s*([CF])\b/gi,
    (whole, n: string, scale: string) => {
      const from = scale.toUpperCase();
      const value = Number(n);
      if (system === 'metric' && from === 'F')
        return `${Math.round(((value - 32) * 5) / 9 / 5) * 5}°C`;
      if (system === 'us' && from === 'C')
        return `${Math.round((value * 9) / 5 / 5 + 32 / 5) * 5}°F`;
      return whole;
    },
  );
}
