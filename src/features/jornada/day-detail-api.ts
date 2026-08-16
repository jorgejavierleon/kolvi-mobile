/**
 * `GET /api/v1/me/workdays/{date}` — the day-detail screen behind a Historial
 * row (KMO-34): the shift window the attendance strip's axis is drawn from
 * (§6 — not the mockup's fixed 08:00-18:00), the day's three figures, and
 * each punch's own `mark_id` so its comprobante can be retrieved through
 * `punch-receipt-api.ts`.
 *
 * `ams` KOL-68 names the endpoint this reads; where it lands on a different
 * shape, this parser is the only place that changes. `shift_start`/`shift_end`
 * and each mark's `time` arrive as `HH:mm:ss` — full `NaiveTime`, not the
 * `HH:mm` `workdays-api.ts` reads for the list, because `attendance-axis.ts`
 * does real minute arithmetic on these rather than only displaying them.
 */

import { api, naiveTime, type ApiClient, type NaiveDate, type NaiveTime } from '@/api';
import type { Tone } from '@/theme';

const WORKDAYS_PATH = '/me/workdays';

const badgeTones: Readonly<Record<string, Tone>> = {
  success: 'success',
  warning: 'warning',
  destructive: 'danger',
};

/** One of the day's two punches, as far as the day-detail screen needs it. */
export type DayDetailMark = {
  readonly time: NaiveTime;
  readonly markId: number;
};

/** One workday's detail: the shift window, the figures, and the punches. */
export type DayDetail = {
  readonly date: NaiveDate;
  readonly statusLabel: string | null;
  readonly statusTone: Tone | null;
  readonly shiftStart: NaiveTime | null;
  readonly shiftEnd: NaiveTime | null;
  readonly workedTime: string | null;
  readonly extraTime: string | null;
  readonly missingTime: string | null;
  readonly leaveTypeLabel: string | null;
  readonly markIn: DayDetailMark | null;
  readonly markOut: DayDetailMark | null;
};

export type DayDetailApi = {
  fetchDayDetail(date: NaiveDate, options?: { signal?: AbortSignal }): Promise<DayDetail>;
};

export function createDayDetailApi(client: ApiClient = api): DayDetailApi {
  return {
    async fetchDayDetail(date, options = {}): Promise<DayDetail> {
      return parseDayDetail(date, await client.get<unknown>(`${WORKDAYS_PATH}/${date}`, options));
    },
  };
}

/**
 * Thrown when the response is not a workday detail. The screen turns it into
 * the failed state with a retry, the same reasoning `WorkdaysResponseError`
 * documents.
 */
export class DayDetailResponseError extends Error {
  constructor(detail: string) {
    super(`GET ${WORKDAYS_PATH}/{date} did not answer with a workday detail: ${detail}`);
    this.name = 'DayDetailResponseError';
    Object.setPrototypeOf(this, DayDetailResponseError.prototype);
  }
}

export function parseDayDetail(date: NaiveDate, payload: unknown): DayDetail {
  const row = recordOf(payload);
  if (row === undefined) {
    throw new DayDetailResponseError('the body is not an object');
  }

  const onLeave = typeof row.leave_type_label === 'string';

  return {
    date,
    statusLabel: typeof row.status_label === 'string' ? row.status_label : null,
    statusTone:
      typeof row.status_badge === 'string' ? (badgeTones[row.status_badge] ?? null) : null,
    shiftStart: parseOptionalTime(row.shift_start, 'shift_start'),
    shiftEnd: parseOptionalTime(row.shift_end, 'shift_end'),
    workedTime: onLeave ? null : stringOrNull(row.worked_time),
    extraTime: onLeave ? null : stringOrNull(row.extra_time),
    missingTime: onLeave ? null : stringOrNull(row.missing_time),
    leaveTypeLabel: onLeave ? (row.leave_type_label as string) : null,
    markIn: parseOptionalMark(row.mark_in, 'mark_in'),
    markOut: parseOptionalMark(row.mark_out, 'mark_out'),
  };
}

function parseOptionalMark(value: unknown, field: string): DayDetailMark | null {
  if (value === null || value === undefined) {
    return null;
  }

  const row = recordOf(value);
  if (row === undefined) {
    throw new DayDetailResponseError(`\`${field}\` is not an object`);
  }

  const markId = row.mark_id;
  if (typeof markId !== 'number' || !Number.isSafeInteger(markId) || markId <= 0) {
    throw new DayDetailResponseError(
      `\`${field}.mark_id\` is not the id of a stored mark, received ${JSON.stringify(markId)}`,
    );
  }

  return {
    time: parseTime(row.time, `${field}.time`),
    markId,
  };
}

function parseOptionalTime(value: unknown, field: string): NaiveTime | null {
  return value === null || value === undefined ? null : parseTime(value, field);
}

function parseTime(value: unknown, field: string): NaiveTime {
  try {
    return naiveTime(value);
  } catch {
    throw new DayDetailResponseError(
      `\`${field}\` is not a naive time, received ${JSON.stringify(value)}`,
    );
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
