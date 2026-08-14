/**
 * `GET /api/v1/me/shifts/upcoming` — the Jornada tab's Próximos screen: today's
 * shift and punch status, then the schedule for the days after it.
 *
 * A feature never imports another feature (README), so this is deliberately
 * self-contained rather than reusing `features/marcaje/today-api.ts` — even
 * though both read a shift off the wire, they are two different endpoints with
 * two different screens' worth of reasons to change.
 *
 * `ams` KOL-64 names the endpoint this reads; where it lands on a different
 * shape, this parser is the only place that changes.
 */

import { api, naiveDate, naiveTime, type ApiClient, type NaiveDate, type NaiveTime } from '@/api';

const UPCOMING_SHIFTS_PATH = '/me/shifts/upcoming';

/** Where the employee is in today's day. Absent on the wire for one who does not hold `ClockOwn:Mark`. */
export type PunchState = 'before' | 'working' | 'done';

const knownPunchStates: ReadonlySet<string> = new Set<string>(['before', 'working', 'done']);

/**
 * One calendar date's schedule: a shift to work, or why there isn't one to
 * show as an ordinary shift. `leaveTypeLabel`/`holidayName` and the schedule
 * fields are mutually exclusive on the wire — a day carrying either has
 * `startTime`/`endTime`/`lunch` all null.
 */
export type ScheduledDay = {
  readonly date: NaiveDate;
  readonly premise: string | null;
  readonly startTime: NaiveTime | null;
  readonly endTime: NaiveTime | null;
  readonly lunch: { readonly startTime: NaiveTime; readonly endTime: NaiveTime } | null;
  readonly leaveTypeLabel: string | null;
  readonly holidayName: string | null;
};

export type TodayShift = ScheduledDay & {
  /** Null for an employee who does not punch at all — no fabricated state. */
  readonly punchState: PunchState | null;
};

export type UpcomingShifts = {
  /**
   * The employee's own day, present even when `today` below is null — a free
   * day still has a date, and it's what decides which row in `days` is
   * literally tomorrow.
   */
  readonly date: NaiveDate;
  /** Null when nothing is scheduled today — a free day, or no active assignment. */
  readonly today: TodayShift | null;
  /** The schedule for the requested horizon, starting the day after today. */
  readonly days: readonly ScheduledDay[];
};

export type UpcomingShiftsApi = {
  fetchUpcomingShifts(options?: {
    /** Relative to `ams`'s own default (14) and cap (30) — omit to use the server's. */
    days?: number;
    signal?: AbortSignal;
  }): Promise<UpcomingShifts>;
};

export function createUpcomingShiftsApi(client: ApiClient = api): UpcomingShiftsApi {
  return {
    async fetchUpcomingShifts(options = {}): Promise<UpcomingShifts> {
      const { days, signal } = options;

      return parseUpcomingShifts(
        await client.get<unknown>(UPCOMING_SHIFTS_PATH, { query: { days }, signal }),
      );
    },
  };
}

/**
 * Thrown when the response is not an `UpcomingShifts`. The screen turns it
 * into the failed state with a retry, the same reasoning `TodayResponseError`
 * documents: dropping the fields that did not parse would draw a plausible
 * empty week from a broken payload rather than asking again.
 */
export class UpcomingShiftsResponseError extends Error {
  constructor(detail: string) {
    super(`GET ${UPCOMING_SHIFTS_PATH} did not answer with the upcoming schedule: ${detail}`);
    this.name = 'UpcomingShiftsResponseError';
    Object.setPrototypeOf(this, UpcomingShiftsResponseError.prototype);
  }
}

export function parseUpcomingShifts(payload: unknown): UpcomingShifts {
  const root = recordOf(payload);
  if (root === undefined) {
    throw new UpcomingShiftsResponseError('the body is not an object');
  }

  return {
    date: parseDate(root.date, 'date'),
    today: parseTodayShift(root.today),
    days: parseDays(root.days),
  };
}

function parseTodayShift(value: unknown): TodayShift | null {
  if (value === null || value === undefined) {
    return null;
  }

  return {
    ...parseScheduledDay(value, 'today'),
    punchState: parsePunchState(recordOf(value)?.punch_state),
  };
}

function parseDays(value: unknown): readonly ScheduledDay[] {
  if (!Array.isArray(value)) {
    throw new UpcomingShiftsResponseError('`days` is not an array');
  }

  return value.map((entry, index) => parseScheduledDay(entry, `days[${index}]`));
}

function parseScheduledDay(value: unknown, context: string): ScheduledDay {
  const day = recordOf(value);
  if (day === undefined) {
    throw new UpcomingShiftsResponseError(`\`${context}\` is not an object`);
  }

  const premise = typeof day.premise === 'string' ? day.premise : null;
  // Both ends or neither, the same rule `today-api.ts`'s own colación reading
  // uses: an annotated date (leave or holiday) has both time fields null, and
  // treating one-without-the-other as a rendering bug rather than a partial
  // schedule is the honest reading of a field this app cannot invent.
  const hasSchedule = !nothing(day.start_time) && !nothing(day.end_time);

  return {
    date: parseDate(day.date, `${context}.date`),
    premise,
    startTime: hasSchedule ? parseTime(day.start_time, `${context}.start_time`) : null,
    endTime: hasSchedule ? parseTime(day.end_time, `${context}.end_time`) : null,
    lunch: parseLunch(day, context),
    leaveTypeLabel: typeof day.leave_type_label === 'string' ? day.leave_type_label : null,
    holidayName: typeof day.holiday_name === 'string' ? day.holiday_name : null,
  };
}

function parseLunch(day: Record<string, unknown>, context: string): ScheduledDay['lunch'] {
  const start = day.lunch_start_time;
  const end = day.lunch_end_time;

  if (nothing(start) || nothing(end)) {
    return null;
  }

  return {
    startTime: parseTime(start, `${context}.lunch_start_time`),
    endTime: parseTime(end, `${context}.lunch_end_time`),
  };
}

function parseDate(value: unknown, field: string): NaiveDate {
  try {
    return naiveDate(value);
  } catch {
    throw new UpcomingShiftsResponseError(
      `\`${field}\` is not a naive date, received ${JSON.stringify(value)}`,
    );
  }
}

function parseTime(value: unknown, field: string): NaiveTime {
  try {
    return naiveTime(value);
  } catch {
    throw new UpcomingShiftsResponseError(
      `\`${field}\` is not a naive time, received ${JSON.stringify(value)}`,
    );
  }
}

function parsePunchState(value: unknown): PunchState | null {
  return typeof value === 'string' && knownPunchStates.has(value) ? (value as PunchState) : null;
}

function nothing(value: unknown): boolean {
  return value === null || value === undefined;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
