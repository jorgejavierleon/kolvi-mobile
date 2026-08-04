/**
 * `GET /api/v1/me/today` — everything the home screen draws, in one request.
 *
 * One call rather than five is the whole point of the endpoint (#6, PRD §F1): the
 * goal is time-to-punch under ten seconds from app open at p90, and a screen that
 * fans out to the shift, the marks, the week and the geofence pays four round
 * trips on a warehouse connection before the button is live.
 *
 * **The contract below is provisional.** The endpoint does not exist in `ams` yet
 * — it is the external prerequisite the task names — so this module is currently
 * the specification rather than a reader of one, and it was written from the
 * shape the PRD asks for. Where `ams` lands on different field names, this parser
 * is the only place that changes.
 *
 * It uses the `@/api` singleton rather than building its own client, which is the
 * opposite of what `auth-api.ts` and `forgot-password-api.ts` do. Their reason
 * does not apply here: a 401 on this endpoint genuinely *is* the session ending,
 * and it should end it, because an employee whose token died must not be left
 * looking at a home screen that will refuse their punch.
 */

import { api, naiveDate, naiveTime, type ApiClient, type NaiveDate, type NaiveTime } from '@/api';

import { parsePunchState, type PunchState } from './punch-state';

/** Relative to `/api/v1`, like every path in the app. */
const TODAY_PATH = '/me/today';

/**
 * Today's scheduled shift. `null` on the whole `TodaySummary` when nothing is
 * scheduled — a day off, or an employee between assignments.
 */
export type TodayShift = {
  /** The premise the shift is worked at, e.g. `Sucursal Ñuñoa`. */
  readonly premise: string;
  readonly startTime: NaiveTime;
  readonly endTime: NaiveTime;
  /**
   * The scheduled colación, read-only (decision D-F1-a). Both ends or neither:
   * a shift with no lunch window draws no colación row rather than a row with
   * half a range in it.
   */
  readonly lunch: { readonly startTime: NaiveTime; readonly endTime: NaiveTime } | null;
};

/**
 * Week to date against the contracted total. The denominator is the shift's
 * contracted weekly hours and **not** the statutory maximum under Ley 21.561
 * (decision D-F1-d) — the two differ during the 44 → 40 transition, and the app
 * computes neither.
 */
export type TodayWeek = {
  readonly workedHours: number;
  readonly contractedHours: number;
};

export type TodaySummary = {
  /** The server's own idea of what day this is, for the record it answered for. */
  readonly date: NaiveDate;
  readonly shift: TodayShift | null;
  readonly punchState: PunchState | null;
  readonly week: TodayWeek | null;
};

export type TodayApi = {
  fetchToday(options?: { signal?: AbortSignal }): Promise<TodaySummary>;
};

export function createTodayApi(client: ApiClient = api): TodayApi {
  return {
    async fetchToday(options = {}): Promise<TodaySummary> {
      return parseTodaySummary(await client.get<unknown>(TODAY_PATH, options));
    },
  };
}

/**
 * Thrown when the response is not a `TodaySummary`. The screen turns it into the
 * failed state with a retry (#9).
 *
 * Failing loudly is the right trade here even though the failed state costs the
 * employee a tap. The alternative — dropping the fields that did not parse and
 * rendering what is left — produces a screen that looks like a normal day off, or
 * like an employee who has not punched, from a response that said neither. A
 * retry is a nuisance; a plausible screen built from a broken payload is what
 * sends someone home without marking salida.
 */
export class TodayResponseError extends Error {
  constructor(detail: string) {
    super(`GET ${TODAY_PATH} did not answer with today's summary: ${detail}`);
    this.name = 'TodayResponseError';
    // Hermes and the Babel class transform both need this for `instanceof` to
    // survive extending a built-in.
    Object.setPrototypeOf(this, TodayResponseError.prototype);
  }
}

export function parseTodaySummary(payload: unknown): TodaySummary {
  const root = recordOf(payload);
  if (root === undefined) {
    throw new TodayResponseError('the body is not an object');
  }

  return {
    date: parseDate(root.date),
    shift: parseShift(root.shift),
    // Absent is legitimate — see `parsePunchState`. An employee without
    // `ClockOwn:Mark` has no punch state to report and still gets this screen.
    punchState: parsePunchState(recordOf(root.punch)?.state),
    week: parseWeek(root.week),
  };
}

function parseDate(value: unknown): NaiveDate {
  try {
    // Through `naiveDate` rather than a cast, so an ISO instant with an offset on
    // it is rejected at the boundary instead of being re-read in the device's
    // timezone somewhere downstream. See `@/api/datetime`.
    return naiveDate(value);
  } catch {
    throw new TodayResponseError(`\`date\` is not a naive date, received ${JSON.stringify(value)}`);
  }
}

function parseShift(value: unknown): TodayShift | null {
  // Both spellings of "nothing scheduled". `ams` resources omit a null relation
  // as often as they emit it, and the empty state is the same either way (#7).
  if (value === null || value === undefined) {
    return null;
  }

  const shift = recordOf(value);
  if (shift === undefined) {
    throw new TodayResponseError('`shift` is neither an object nor null');
  }

  const premise = shift.premise;
  if (typeof premise !== 'string' || premise.length === 0) {
    throw new TodayResponseError('`shift.premise` is missing');
  }

  return {
    premise,
    startTime: shiftTime(shift.start_time, 'start_time'),
    endTime: shiftTime(shift.end_time, 'end_time'),
    lunch: parseLunch(shift),
  };
}

/**
 * The colación window, or `null` when the shift has none.
 *
 * Only a complete pair draws the row. Half a window is not a range an employee
 * can act on, and `13:00 – ` on a card reads as a rendering bug rather than as
 * the missing data it is.
 */
function parseLunch(shift: Record<string, unknown>): TodayShift['lunch'] {
  const start = shift.lunch_start_time;
  const end = shift.lunch_end_time;

  if (nothing(start) || nothing(end)) {
    return null;
  }

  return {
    startTime: shiftTime(start, 'lunch_start_time'),
    endTime: shiftTime(end, 'lunch_end_time'),
  };
}

function shiftTime(value: unknown, field: string): NaiveTime {
  try {
    return naiveTime(value);
  } catch {
    throw new TodayResponseError(
      `\`shift.${field}\` is not a naive time, received ${JSON.stringify(value)}`,
    );
  }
}

/**
 * The week summary, or `null` when the server did not send one.
 *
 * Absent is legitimate — an employee with no shift assignment has no contracted
 * total to measure against — and the screen omits the line rather than printing
 * `0 / 0 hrs esta semana`, which reads as a week nobody worked.
 *
 * A denominator of zero is treated the same way for the same reason: it is a
 * shift with no contracted hours on it, not a week's progress to render.
 */
function parseWeek(value: unknown): TodayWeek | null {
  if (value === null || value === undefined) {
    return null;
  }

  const week = recordOf(value);
  if (week === undefined) {
    throw new TodayResponseError('`week` is neither an object nor null');
  }

  const workedHours = hours(week.worked_hours, 'worked_hours');
  const contractedHours = hours(week.contracted_hours, 'contracted_hours');

  return contractedHours === 0 ? null : { workedHours, contractedHours };
}

function hours(value: unknown, field: string): number {
  // Negative worked time is a server-side arithmetic bug that `formatDecimalHours`
  // would throw on mid-render; caught here it is a retry instead of a blank tab.
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new TodayResponseError(
      `\`week.${field}\` is not a duration in hours, received ${JSON.stringify(value)}`,
    );
  }

  return value;
}

function nothing(value: unknown): boolean {
  return value === null || value === undefined;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
