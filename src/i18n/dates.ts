/**
 * Rendering naive Santiago wall-clock values as the design writes them.
 *
 * Two rules shape everything here.
 *
 * **No `Date`.** `@/api/datetime` refuses to hold a timezone-aware value at all,
 * and display is where that discipline is usually lost — a formatter that reaches
 * for `new Date('2026-08-01 00:00:00')` re-reads a wall-clock string as an instant
 * in the device's zone and can print the previous day. So these functions take the
 * integers `@/api/datetime` already parsed out and do arithmetic on them. The day
 * of the week comes from Sakamoto's algorithm rather than `getDay()`.
 *
 * **No `Intl`.** Hermes ships without full ICU on Android, so
 * `Intl.DateTimeFormat('es-CL')` answers one way in Jest on Node and another on the
 * phone — and Res. 38 Art. 5 makes the Spanish forms a compliance artefact, not a
 * best-effort localisation. The weekday and month names are tables, copied from the
 * design, and they read the same everywhere.
 *
 * Imports come from `@/api/datetime` rather than the `@/api` barrel on purpose: the
 * barrel re-exports `errors.ts`, which imports `@/i18n`, and routing through it
 * would close a runtime import cycle back onto this module.
 */
import {
  isNaiveDateTime,
  parseNaiveDate,
  parseNaiveDateTime,
  parseNaiveTime,
  type NaiveDate,
  type NaiveDateParts,
  type NaiveDateTime,
  type NaiveTime,
  type NaiveTimeParts,
} from '@/api/datetime';

/** Anything carrying a date: a bare `YYYY-MM-DD` or a full datetime. */
export type DateLike = NaiveDate | NaiveDateTime;

/** Anything carrying a time of day: a bare `HH:mm:ss` or a full datetime. */
export type TimeLike = NaiveTime | NaiveDateTime;

/**
 * Sunday first, matching the index Sakamoto's algorithm returns and the order the
 * design's own `WEEKDAYS` table uses. Capitalised — the design writes
 * `Miércoles 5 de agosto`, and the accent is part of the word, not decoration.
 */
export const weekdayNames = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** The single letters over a month grid. Sunday first, so `M` appears twice. */
export const weekdayInitials = ['D', 'L', 'M', 'M', 'J', 'V', 'S'] as const;

/**
 * Lowercase, which is the Spanish convention and what the design's `MONTHS` table
 * holds. The mockup's home header adds a CSS `text-transform:capitalize` over the
 * whole line, which would render `5 De Agosto`; KMO-6 #4 treats that as an artefact
 * of the prototype and keeps the months lowercase everywhere.
 */
export const monthNames = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
] as const;

/** Sakamoto's per-month correction, indexed January to December. */
const monthOffsets = [0, 3, 2, 5, 0, 3, 5, 1, 4, 6, 2, 4] as const;

/**
 * `0` for Sunday through `6` for Saturday, by Sakamoto's algorithm.
 *
 * This exists so that no caller needs a `Date` to know which day of the week a
 * wall-clock date fell on. It is pure integer arithmetic on the year, month and
 * day that were written on the wire, so it cannot be moved by a device timezone or
 * by a DST transition.
 */
export function weekdayIndex(value: DateLike): number {
  const { year, month, day } = datePartsOf(value);
  // January and February are counted as months 13 and 14 of the previous year, so
  // a leap day lands at the end and the correction table stays constant.
  const shiftedYear = month < 3 ? year - 1 : year;

  const sum =
    shiftedYear +
    Math.floor(shiftedYear / 4) -
    Math.floor(shiftedYear / 100) +
    Math.floor(shiftedYear / 400) +
    at(monthOffsets, month - 1) +
    day;

  return sum % 7;
}

/**
 * `Miércoles 5 de agosto` — the header over the home screen, above `Hola, {nombre}`.
 * No year: it names today, and a year on it would only add noise.
 */
export function formatLongDate(value: DateLike): string {
  const { month, day } = datePartsOf(value);

  return `${at(weekdayNames, weekdayIndex(value))} ${day} de ${at(monthNames, month - 1)}`;
}

/**
 * `5 de agosto 2026` — a date far enough from today that the year matters: the
 * ends of a leave range, the dates in the request wizard.
 */
export function formatLongDateWithYear(value: DateLike): string {
  const { year, month, day } = datePartsOf(value);

  return `${day} de ${at(monthNames, month - 1)} ${year}`;
}

/**
 * `Vie 24 jul` — the label on a history row or an upcoming shift, where the list
 * gives the context and only the day needs naming.
 */
export function formatShortDate(value: DateLike): string {
  const { month, day } = datePartsOf(value);
  const weekday = at(weekdayNames, weekdayIndex(value)).slice(0, 3);

  return `${weekday} ${day} ${at(monthNames, month - 1).slice(0, 3)}`;
}

/** `agosto 2026` — the heading over a month grid or a date picker. */
export function formatMonthYear(value: DateLike): string {
  const { year, month } = datePartsOf(value);

  return `${at(monthNames, month - 1)} ${year}`;
}

/**
 * `01/08/26` — the `Fecha` row of the comprobante.
 *
 * Res. 38 Art. 13 names `dd/mm/aa` as minimum receipt content, which is why the
 * receipt gets its own formatter instead of reusing the long form the rest of the
 * app reads better with. The design's mockup renders this row as `5 de agosto 2026`;
 * the regulation is the source of truth for the receipt.
 */
export function formatReceiptDate(value: DateLike): string {
  const { year, month, day } = datePartsOf(value);

  return `${pad(day)}/${pad(month)}/${pad(year % 100)}`;
}

/**
 * `08:00:00` — the `Hora` row of the comprobante.
 *
 * The seconds are not cosmetic. Art. 13 requires `hh:mm:ss`, and the second is what
 * distinguishes two punches inside the same minute in the attendance book.
 */
export function formatReceiptTime(value: TimeLike): string {
  const { hour, minute, second } = timePartsOf(value);

  return `${pad(hour)}:${pad(minute)}:${pad(second)}`;
}

/**
 * `08:00` — the big clock on the home screen and the shift window on the shift
 * card. Seconds belong on the receipt, not on a clock a worker glances at.
 */
export function formatClockTime(value: TimeLike): string {
  const { hour, minute } = timePartsOf(value);

  return `${pad(hour)}:${pad(minute)}`;
}

function datePartsOf(value: DateLike): NaiveDateParts {
  return isNaiveDateTime(value) ? parseNaiveDateTime(value) : parseNaiveDate(value);
}

function timePartsOf(value: TimeLike): NaiveTimeParts {
  return isNaiveDateTime(value) ? parseNaiveDateTime(value) : parseNaiveTime(value);
}

/**
 * Index one of the fixed tables above.
 *
 * The fallback is unreachable: `@/api/datetime` has already rejected a month
 * outside 1–12, and `weekdayIndex` is a value mod 7. It exists because
 * `noUncheckedIndexedAccess` is on, and because the alternative — a silent
 * `undefined` reaching a comprobante as `undefined 5 de agosto` — is the failure
 * this module is here to prevent.
 */
function at<T>(table: readonly T[], index: number): T {
  const value = table[index];
  if (value === undefined) {
    throw new RangeError(`No entry at index ${index} of a ${table.length}-entry table`);
  }

  return value;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
