export type StepTimer = {
  /** Shown on the button, e.g. "5–7 min". */
  label: string;
  /** What the timer counts down from. For a range like "5-7 minutes" this is the shorter time. */
  seconds: number;
};

const UNIT_SECONDS: [RegExp, number, string][] = [
  [/^(?:hours?|hrs?)$/i, 3600, 'h'],
  [/^(?:minutes?|mins?)$/i, 60, 'min'],
  [/^(?:seconds?|secs?)$/i, 1, 'sec'],
];

const FRACTIONS: Record<string, number> = {
  '¼': 0.25,
  '½': 0.5,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};

// "30", "1.5", "1½", "1 1/2", "½", "1/2".
const NUMBER = String.raw`\d+(?:\.\d+)?(?:\s*[¼½¾⅓⅔]|\s+\d\/\d)?|\d\/\d|[¼½¾⅓⅔]`;

// "30 minutes", "1.5 hours", "5-7 min", "5 to 7 minutes". Bare "m", "s" and "h" are ignored.
const DURATION = new RegExp(
  String.raw`(${NUMBER})(?:\s*(?:-|–|—|to)\s*(${NUMBER}))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b`,
  'gi',
);

/** "1 1/2" -> 1.5, "½" -> 0.5, "1½" -> 1.5, "1.5" -> 1.5. */
function parseNumber(text: string): number {
  const slash = text.match(/^(?:(\d+)\s+)?(\d)\/(\d)$/);
  if (slash) return Number(slash[1] ?? 0) + Number(slash[2]) / Number(slash[3]);
  const glyph = text.match(/^(\d+(?:\.\d+)?)?\s*([¼½¾⅓⅔])$/);
  if (glyph) return Number(glyph[1] ?? 0) + FRACTIONS[glyph[2]];
  return Number(text);
}

// Words for times: "half an hour", "an hour and a half", "a minute".
const WORD_TIMES: [RegExp, string][] = [
  [/\b(?:an|one) hour and a half\b/gi, '1.5 hours'],
  [/\bhalf an hour\b/gi, '30 minutes'],
  [/\b(?:an|one) hour\b/gi, '1 hour'],
  [/\b(?:a|one) minute\b/gi, '1 minute'],
];

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** Times mentioned in a recipe step, in the order they appear, without repeats. */
export function findTimers(step: string): StepTimer[] {
  const text = WORD_TIMES.reduce((t, [re, to]) => t.replace(re, to), step);
  const parts = [...text.matchAll(DURATION)].map((m) => {
    const [, from, to, unitWord] = m;
    const [, perUnit, unit] = UNIT_SECONDS.find(([re]) => re.test(unitWord))!;
    return {
      from: parseNumber(from),
      to: to === undefined ? undefined : parseNumber(to),
      perUnit,
      unit,
      start: m.index,
      end: m.index + m[0].length,
    };
  });

  const found: StepTimer[] = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    let seconds = Math.round(p.from * p.perUnit);
    let label = `${trim(p.from)}${p.to !== undefined ? `–${trim(p.to)}` : ''} ${p.unit}`;
    // "1 hour 30 minutes", "1 hr and 15 min": one timer, not two.
    const next = parts[i + 1];
    if (
      next &&
      p.to === undefined &&
      next.to === undefined &&
      p.perUnit > next.perUnit &&
      /^\s*(?:,|and)?\s*$/i.test(text.slice(p.end, next.start))
    ) {
      seconds += Math.round(next.from * next.perUnit);
      label += ` ${trim(next.from)} ${next.unit}`;
      i++;
    }
    if (seconds <= 0) continue;
    if (!found.some((t) => t.label === label)) found.push({ label, seconds });
  }
  return found;
}

/** 90 -> "1:30", 3725 -> "1:02:05". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
