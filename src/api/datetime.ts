/**
 * Naive Santiago wall-clock values, and the only place the app is allowed to take
 * one apart.
 *
 * The `ams` database stores attendance timestamps as wall-clock time with no
 * offset, and the wire format is `YYYY-MM-DD HH:mm:ss` read as Santiago local
 * time. Res. 38 Art. 8 and 14a are about a legal record that cannot be adulterated,
 * and a timezone conversion adulterates it silently — a punch at `08:00:00`
 * redisplayed as `07:00:00` or `12:00:00` is a different legal fact, with nothing
 * on screen to say it changed.
 *
 * So this module handles the values as **strings and integers only**. `Date`,
 * `toISOString`, `getTimezoneOffset` and `Intl` do not appear anywhere in
 * `src/api`: a value cannot be converted, because the code that would convert it
 * does not exist. Round-tripping is then not a property that has to be tested for
 * every field — it is the only thing the module can do.
 *
 * Chile's own DST transitions are why this matters more than usual. On the first
 * Sunday of September the clock jumps 00:00 → 01:00, so `2026-09-06 00:30:00` is a
 * wall-clock reading that *no* instant maps to; on the first Sunday of April the
 * hour repeats, so `2026-04-05 00:30:00` maps to two. Anything routed through
 * `Date` shifts the first and picks arbitrarily between the second. Here both are
 * just twelve digits that come back out in the order they went in.
 */

declare const naiveBrand: unique symbol;

type Naive<TKind extends string> = { readonly [naiveBrand]: TKind };

/** `YYYY-MM-DD HH:mm:ss`, Santiago wall clock, no offset. */
export type NaiveDateTime = string & Naive<'datetime'>;

/** `YYYY-MM-DD`. Shift days, leave ranges, workday keys. */
export type NaiveDate = string & Naive<'date'>;

/** `HH:mm:ss`. Shift start/end and the receipt's `Hora` row. */
export type NaiveTime = string & Naive<'time'>;

/** A datetime taken apart into integers. No instant, no zone — just the reading. */
export type NaiveDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

export type NaiveDateParts = Pick<NaiveDateTimeParts, 'year' | 'month' | 'day'>;

export type NaiveTimeParts = Pick<NaiveDateTimeParts, 'hour' | 'minute' | 'second'>;

/**
 * Thrown when a value on the wire is not a naive wall-clock string.
 *
 * This is deliberately loud. `MarkResource` in `ams` currently emits
 * `toIso8601String()`, which stamps an offset onto a naive value (PRD §3.2), and
 * the failure mode of accepting it is a legally-binding timestamp that is quietly
 * an hour off. A thrown error during development is the cheap version of that bug.
 */
export class NaiveDateTimeError extends Error {
  constructor(value: unknown, expected: string) {
    super(`Expected a naive ${expected} (Santiago wall clock), received ${JSON.stringify(value)}`);
    this.name = 'NaiveDateTimeError';
    // Hermes and the Babel class transform both need this for `instanceof` to
    // survive extending a built-in.
    Object.setPrototypeOf(this, NaiveDateTimeError.prototype);
  }
}

const DATETIME_PATTERN = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2}):(\d{2})$/;

export function isNaiveDateTime(value: unknown): value is NaiveDateTime {
  return typeof value === 'string' && matchDateTime(value) !== undefined;
}

export function isNaiveDate(value: unknown): value is NaiveDate {
  return typeof value === 'string' && matchDate(value) !== undefined;
}

export function isNaiveTime(value: unknown): value is NaiveTime {
  return typeof value === 'string' && matchTime(value) !== undefined;
}

/**
 * Assert a string off the wire is a naive datetime and brand it as one.
 *
 * The brand is what stops an arbitrary `string` being passed where a wall-clock
 * value is expected, so an ISO instant cannot enter the app by way of a type that
 * did not notice.
 */
export function naiveDateTime(value: unknown): NaiveDateTime {
  const parts = typeof value === 'string' ? matchDateTime(value) : undefined;
  if (parts === undefined) {
    throw new NaiveDateTimeError(value, 'datetime `YYYY-MM-DD HH:mm:ss`');
  }

  return value as NaiveDateTime;
}

export function naiveDate(value: unknown): NaiveDate {
  if (typeof value !== 'string' || matchDate(value) === undefined) {
    throw new NaiveDateTimeError(value, 'date `YYYY-MM-DD`');
  }

  return value as NaiveDate;
}

export function naiveTime(value: unknown): NaiveTime {
  if (typeof value !== 'string' || matchTime(value) === undefined) {
    throw new NaiveDateTimeError(value, 'time `HH:mm:ss`');
  }

  return value as NaiveTime;
}

/** Take a wall-clock datetime apart. Never consults a zone, because there isn't one. */
export function parseNaiveDateTime(value: unknown): NaiveDateTimeParts {
  const parts = typeof value === 'string' ? matchDateTime(value) : undefined;
  if (parts === undefined) {
    throw new NaiveDateTimeError(value, 'datetime `YYYY-MM-DD HH:mm:ss`');
  }

  return parts;
}

export function parseNaiveDate(value: unknown): NaiveDateParts {
  const parts = typeof value === 'string' ? matchDate(value) : undefined;
  if (parts === undefined) {
    throw new NaiveDateTimeError(value, 'date `YYYY-MM-DD`');
  }

  return parts;
}

export function parseNaiveTime(value: unknown): NaiveTimeParts {
  const parts = typeof value === 'string' ? matchTime(value) : undefined;
  if (parts === undefined) {
    throw new NaiveDateTimeError(value, 'time `HH:mm:ss`');
  }

  return parts;
}

/** Put a datetime back together. `format(parse(v))` is `v`, for every valid `v`. */
export function formatNaiveDateTime(parts: NaiveDateTimeParts): NaiveDateTime {
  return `${formatNaiveDate(parts)} ${formatNaiveTime(parts)}` as NaiveDateTime;
}

export function formatNaiveDate(parts: NaiveDateParts): NaiveDate {
  assertInRange(parts.year, 0, 9999, 'year');
  assertInRange(parts.month, 1, 12, 'month');
  assertInRange(parts.day, 1, daysInMonth(parts.year, parts.month), 'day');

  return `${pad(parts.year, 4)}-${pad(parts.month, 2)}-${pad(parts.day, 2)}` as NaiveDate;
}

export function formatNaiveTime(parts: NaiveTimeParts): NaiveTime {
  assertInRange(parts.hour, 0, 23, 'hour');
  assertInRange(parts.minute, 0, 59, 'minute');
  assertInRange(parts.second, 0, 59, 'second');

  return `${pad(parts.hour, 2)}:${pad(parts.minute, 2)}:${pad(parts.second, 2)}` as NaiveTime;
}

/**
 * The date half of a datetime, by splitting the string — the receipt shows `Fecha`
 * and `Hora` on separate rows and neither is recomputed from an instant.
 */
export function dateOf(value: NaiveDateTime): NaiveDate {
  return formatNaiveDate(parseNaiveDateTime(value));
}

/** The time half, likewise. */
export function timeOf(value: NaiveDateTime): NaiveTime {
  return formatNaiveTime(parseNaiveDateTime(value));
}

/**
 * Order two wall-clock datetimes. The format sorts lexicographically — fixed-width
 * fields, most significant first — so ordering the offline queue by punch time
 * needs no arithmetic and no `Date`.
 */
export function compareNaiveDateTime(a: NaiveDateTime, b: NaiveDateTime): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function matchDateTime(value: string): NaiveDateTimeParts | undefined {
  const match = DATETIME_PATTERN.exec(value);
  if (match === null) {
    return undefined;
  }

  const [, year, month, day, hour, minute, second] = match;
  const parts = {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(hour),
    minute: Number(minute),
    second: Number(second),
  };

  return isRealDate(parts) && isRealTime(parts) ? parts : undefined;
}

function matchDate(value: string): NaiveDateParts | undefined {
  const match = DATE_PATTERN.exec(value);
  if (match === null) {
    return undefined;
  }

  const [, year, month, day] = match;
  const parts = { year: Number(year), month: Number(month), day: Number(day) };

  return isRealDate(parts) ? parts : undefined;
}

function matchTime(value: string): NaiveTimeParts | undefined {
  const match = TIME_PATTERN.exec(value);
  if (match === null) {
    return undefined;
  }

  const [, hour, minute, second] = match;
  const parts = { hour: Number(hour), minute: Number(minute), second: Number(second) };

  return isRealTime(parts) ? parts : undefined;
}

function isRealDate({ year, month, day }: NaiveDateParts): boolean {
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function isRealTime({ hour, minute, second }: NaiveTimeParts): boolean {
  // No leap seconds and no 24:00 — the backend emits neither, and accepting them
  // would mean two spellings of the same wall-clock reading.
  return hour <= 23 && minute <= 59 && second <= 59;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function assertInRange(value: number, min: number, max: number, field: string): void {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new NaiveDateTimeError(value, `${field} between ${min} and ${max}`);
  }
}

function pad(value: number, width: number): string {
  return String(value).padStart(width, '0');
}
