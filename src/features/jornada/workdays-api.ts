/**
 * `GET /api/v1/me/workdays` — the Jornada tab's Historial screen: the
 * employee's own computed workdays over a date range (Res. 38 Art. 22.1 — 5
 * years of access, so this is range-queryable rather than a fixed window).
 *
 * A feature never imports another feature (README), so this is deliberately
 * self-contained rather than reusing `features/marcaje/*-api.ts`.
 *
 * `ams` KOL-65 names the endpoint this reads; where it lands on a different
 * shape, this parser is the only place that changes.
 *
 * Only `date`, `status_label`, `status_badge` and the three time figures /
 * `leave_type_label` are read. The server also sends `date_label` and
 * `weekday`, mirroring the web self-service list — this app ignores both, the
 * way `shifts-api.ts` already ignores any server-formatted date, because
 * `@/i18n`'s own dates.ts formats every date on the wire without `Intl`. The
 * status text passes through verbatim rather than being re-translated:
 * `strings.ts` documents domain vocabulary — leave types, workday statuses —
 * as arriving from the server as `{value, label}` pairs precisely so it never
 * reads one way on web and another on mobile.
 */

import { api, naiveDate, type ApiClient, type NaiveDate } from '@/api';
import type { Tone } from '@/theme';

const WORKDAYS_PATH = '/me/workdays';

const badgeTones: Readonly<Record<string, Tone>> = {
  success: 'success',
  warning: 'warning',
  destructive: 'danger',
};

/** One day of the employee's own attendance history. */
export type Workday = {
  readonly date: NaiveDate;
  /** Absent when the server sent no recognised status — no badge to show. */
  readonly statusLabel: string | null;
  readonly statusTone: Tone | null;
  /** Already `HH:mm`, formatted server-side; this reads it, not computes it. */
  readonly workedTime: string | null;
  readonly extraTime: string | null;
  readonly missingTime: string | null;
  /** Present only on a day covered by an approved leave, in place of the three figures above. */
  readonly leaveTypeLabel: string | null;
};

export type WorkdaysApi = {
  fetchWorkdays(options: {
    from: NaiveDate;
    to: NaiveDate;
    signal?: AbortSignal;
  }): Promise<readonly Workday[]>;
};

export function createWorkdaysApi(client: ApiClient = api): WorkdaysApi {
  return {
    async fetchWorkdays({ from, to, signal }): Promise<readonly Workday[]> {
      return parseWorkdays(
        await client.get<unknown>(WORKDAYS_PATH, { query: { from, to }, signal }),
      );
    },
  };
}

/**
 * Thrown when the response is not a `Workday[]`. The screen turns it into the
 * failed state with a retry, the same reasoning `UpcomingShiftsResponseError`
 * documents: dropping the rows that did not parse would draw a plausible but
 * incomplete history from a broken payload rather than asking again.
 */
export class WorkdaysResponseError extends Error {
  constructor(detail: string) {
    super(`GET ${WORKDAYS_PATH} did not answer with a workday history: ${detail}`);
    this.name = 'WorkdaysResponseError';
    Object.setPrototypeOf(this, WorkdaysResponseError.prototype);
  }
}

export function parseWorkdays(payload: unknown): readonly Workday[] {
  if (!Array.isArray(payload)) {
    throw new WorkdaysResponseError('the body is not an array');
  }

  return payload.map((entry, index) => parseWorkday(entry, `[${index}]`));
}

function parseWorkday(value: unknown, context: string): Workday {
  const row = recordOf(value);
  if (row === undefined) {
    throw new WorkdaysResponseError(`\`${context}\` is not an object`);
  }

  const onLeave = typeof row.leave_type_label === 'string';

  return {
    date: parseDate(row.date, `${context}.date`),
    statusLabel: typeof row.status_label === 'string' ? row.status_label : null,
    statusTone:
      typeof row.status_badge === 'string' ? (badgeTones[row.status_badge] ?? null) : null,
    workedTime: onLeave ? null : stringOrNull(row.worked_time),
    extraTime: onLeave ? null : stringOrNull(row.extra_time),
    missingTime: onLeave ? null : stringOrNull(row.missing_time),
    leaveTypeLabel: onLeave ? (row.leave_type_label as string) : null,
  };
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function parseDate(value: unknown, field: string): NaiveDate {
  try {
    return naiveDate(value);
  } catch {
    throw new WorkdaysResponseError(
      `\`${field}\` is not a naive date, received ${JSON.stringify(value)}`,
    );
  }
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
