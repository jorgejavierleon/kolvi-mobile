/**
 * The 'Asistencia del día' strip's axis (KMO-34 #3, #4): pure minute
 * arithmetic, kept apart from `attendance-strip.tsx` because this is the one
 * calculation that has to be provably right rather than merely rendered —
 * docs/design-decisions.md §6 requires the axis to span the day's own
 * scheduled shift, not the mockup's fixed 08:00-18:00, and to still read
 * correctly for a night shift or one crossing midnight.
 *
 * The trick is the same in both places it is needed: a clock reading earlier
 * than the shift's own start is on the far side of midnight, so it (and the
 * shift's own end, by the same test) gets 24h added before any position or
 * span is computed. A shift that does not cross midnight adds nothing to
 * either side and behaves exactly as it did before this existed.
 */

import { parseNaiveTime, type NaiveTime } from '@/api';

const MINUTES_PER_DAY = 24 * 60;
/** Six points across the axis — the design's own 08:00..18:00 mockup has six. */
const TICK_COUNT = 6;

export type AttendanceAxisTick = {
  readonly label: string;
  readonly percent: number;
};

export type AttendanceAxis = {
  readonly ticks: readonly AttendanceAxisTick[];
  /** `null` exactly when the corresponding punch is missing (#6). */
  readonly markInPercent: number | null;
  readonly markOutPercent: number | null;
};

export function buildAttendanceAxis(
  shiftStart: NaiveTime,
  shiftEnd: NaiveTime,
  markIn: NaiveTime | null,
  markOut: NaiveTime | null,
): AttendanceAxis {
  const start = minutesOf(shiftStart);
  const rawEnd = minutesOf(shiftEnd);
  const end = rawEnd <= start ? rawEnd + MINUTES_PER_DAY : rawEnd;

  return {
    ticks: buildTicks(start, end),
    markInPercent: markIn === null ? null : percentOf(minutesOf(markIn), start, end),
    markOutPercent: markOut === null ? null : percentOf(minutesOf(markOut), start, end),
  };
}

function buildTicks(start: number, end: number): readonly AttendanceAxisTick[] {
  return Array.from({ length: TICK_COUNT }, (_, index) => {
    const percent = (100 * index) / (TICK_COUNT - 1);
    const minutes = start + Math.round(((end - start) * index) / (TICK_COUNT - 1));

    return { label: labelOf(minutes), percent };
  });
}

/**
 * Where a punch's own clock reading lands on `[start, end]`, as a 0-100
 * percent, clamped rather than left to run past either edge — an early
 * arrival or a late departure still has to land somewhere on the strip.
 *
 * A reading before `start` only gets the +24h wrap when doing so actually
 * lands it inside `[start, end]` — i.e. only when the axis itself crosses
 * midnight (`end` is already past 24:00) and the reading is the shift's own
 * post-midnight half. On an ordinary same-day shift a reading before `start`
 * is simply an early arrival, and wrapping it would send it to the *end* of
 * the strip instead of clamping it to the beginning.
 */
function percentOf(minutes: number, start: number, end: number): number {
  const span = end - start;

  if (span <= 0) {
    return 0;
  }

  const wrapped =
    minutes < start && minutes + MINUTES_PER_DAY <= end ? minutes + MINUTES_PER_DAY : minutes;
  const clamped = Math.min(Math.max(wrapped, start), end);

  return ((clamped - start) / span) * 100;
}

function minutesOf(time: NaiveTime): number {
  const { hour, minute } = parseNaiveTime(time);

  return hour * 60 + minute;
}

/** `HH:mm`, wrapping a past-midnight minute count back into a day. */
function labelOf(minutes: number): string {
  const wrapped = ((minutes % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  const hour = Math.floor(wrapped / 60);
  const minute = wrapped % 60;

  return `${pad(hour)}:${pad(minute)}`;
}

function pad(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}
