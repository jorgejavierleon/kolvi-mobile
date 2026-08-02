/**
 * Worked time, in the two shapes the design draws it.
 *
 * `Workday.worked_time` arrives as decimal hours — `7.633`, not `7:38` — and the
 * design shows the same underlying number two different ways depending on what the
 * screen is for. The week summary is a progress reading against a contracted total,
 * so it stays decimal (`32,5 / 44 hrs esta semana`). The Trabajado / Extra /
 * Faltante tiles sit next to punch times like `08:00 – 17:03`, so they are written
 * as durations on the same clock (`07:38`, `00:03`) and read at a glance against
 * them.
 *
 * The decimal mark is a comma. The design's week summary writes `32.5` with a dot,
 * but its own leave wizard writes `0,5` days with a comma, and the comma is the
 * es-CL form — so the dot is read as a slip in the mockup rather than a house style.
 */

/**
 * Thrown when a duration is not a duration. Negative worked time is a server-side
 * arithmetic bug, and rendering it as `-01:30` on a KPI tile would hide it.
 */
export class HoursFormatError extends Error {
  constructor(value: unknown) {
    super(`Expected a finite, non-negative number of hours, received ${JSON.stringify(value)}`);
    this.name = 'HoursFormatError';
    // Hermes and the Babel class transform both need this for `instanceof` to
    // survive extending a built-in.
    Object.setPrototypeOf(this, HoursFormatError.prototype);
  }
}

/**
 * `formatDecimalHours(32.5)` → `32,5`, `formatDecimalHours(44)` → `44`.
 *
 * One decimal place, and a whole number keeps no trailing `,0` — the design writes
 * the week's denominator as a bare `44`.
 */
export function formatDecimalHours(hours: number): string {
  assertDuration(hours);

  const rounded = Math.round(hours * 10) / 10;

  return rounded.toFixed(Number.isInteger(rounded) ? 0 : 1).replace('.', ',');
}

/**
 * `formatHoursAsClock(7.633)` → `07:38` — decimal hours as a duration on the clock,
 * for the history rows and the day-detail KPI tiles.
 *
 * This is a length of time, not a time of day: it is not wrapped at 24 hours, so a
 * month's worth of overtime formats as `176:30` rather than folding back to `08:30`.
 */
export function formatHoursAsClock(hours: number): string {
  assertDuration(hours);

  // Round to the minute first. Rounding the hours and the minutes separately can
  // produce `07:60` — 7.9999 hours would floor to 7 and round to 60.
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${pad(wholeHours)}:${pad(minutes)}`;
}

function assertDuration(hours: number): void {
  if (typeof hours !== 'number' || !Number.isFinite(hours) || hours < 0) {
    throw new HoursFormatError(hours);
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
