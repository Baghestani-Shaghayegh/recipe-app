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

// "30 minutes", "1.5 hours", "5-7 min", "5 to 7 minutes". Bare "m", "s" and "h" are ignored.
const DURATION =
  /(\d+(?:\.\d+)?)(?:\s*(?:-|–|—|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?|seconds?|secs?)\b/gi;

const trim = (n: number) => String(Math.round(n * 100) / 100);

/** Times mentioned in a recipe step, in the order they appear, without repeats. */
export function findTimers(step: string): StepTimer[] {
  const found: StepTimer[] = [];
  for (const m of step.matchAll(DURATION)) {
    const [, from, to, unitWord] = m;
    const [, perUnit, unit] = UNIT_SECONDS.find(([re]) => re.test(unitWord))!;
    const seconds = Math.round(Number(from) * perUnit);
    if (seconds <= 0) continue;
    const label = `${trim(Number(from))}${to ? `–${trim(Number(to))}` : ''} ${unit}`;
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
