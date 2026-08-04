/**
 * Everything the app says, and every way it writes a number or a date.
 *
 * Components import from `@/i18n` and nowhere below it. Two things follow from
 * that: the copy an employee sees is auditable in one place, which is what Res. 38
 * Art. 5 asks for, and a formatter cannot be quietly reimplemented per screen —
 * there is one spelling of `Miércoles`, one dotted RUT, one `dd/mm/aa` receipt date.
 *
 * - `strings.ts` — the es-CL catalogue and the phrases assembled from server values
 * - `dates.ts` — naive wall-clock values, written the way the design writes them
 * - `rut.ts` — the dotted RUT with its verifier digit
 * - `hours.ts` — decimal hours, as a decimal and as a duration on the clock
 */
export {
  es,
  greeting,
  passwordResetSent,
  pendingSyncSummary,
  sectionEnd,
  tabWithPendingCount,
  timeRange,
  tooManyAttempts,
  unsyncedPunchesWarning,
  weekSummary,
} from './strings';

export {
  formatClockTime,
  formatLongDate,
  formatLongDateWithYear,
  formatMonthYear,
  formatReceiptDate,
  formatReceiptTime,
  formatShortDate,
  monthNames,
  weekdayIndex,
  weekdayInitials,
  weekdayNames,
} from './dates';
export type { DateLike, TimeLike } from './dates';

export { formatRut, isRut, RutFormatError } from './rut';

export { formatDecimalHours, formatHoursAsClock, HoursFormatError } from './hours';
