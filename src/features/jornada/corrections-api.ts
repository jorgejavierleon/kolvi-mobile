/**
 * `GET /api/v1/me/mark-modifications` and the approve/decline actions on one:
 * the Jornada tab's pending-correction card (KMO-35), visible from either
 * sub-tab, and the coral count badge on the tab-bar item.
 *
 * A feature never imports another feature (README), so this is deliberately
 * self-contained rather than reusing `features/jornada/workdays-api.ts`, even
 * though both read a workday id off the wire.
 *
 * `ams` KOL-69 names the endpoints this reads and writes; where they land on
 * a different shape, this file is the only place that changes.
 *
 * `original_time`/`proposed_time` arrive already `HH:mm`, formatted
 * server-side like `workdays-api.ts`'s own display times — this reads them,
 * not computes them, so they are plain strings rather than a `NaiveTime`.
 * `expires_at` is the one field this screen does arithmetic on (the
 * countdown label), so it stays a `NaiveDateTime`.
 */

import { api, naiveDateTime, type ApiClient, type NaiveDateTime } from '@/api';

const CORRECTIONS_PATH = '/me/mark-modifications';
const WORKDAYS_PATH = '/me/workdays';

/** One admin-requested correction awaiting the employee's approve/decline. */
export type PendingCorrection = {
  readonly id: number;
  readonly workdayId: number;
  readonly markTypeLabel: string | null;
  /** `null` only for a correction that adds a punch with no prior mark to show. */
  readonly originalTime: string | null;
  readonly proposedTime: string;
  readonly reason: string | null;
  readonly requestedBy: string | null;
  /** When `isActionable()` closes on the server; the card computes its own countdown from this. */
  readonly expiresAt: NaiveDateTime;
};

export type PendingCorrectionsApi = {
  fetchPendingCorrections(options?: {
    signal?: AbortSignal;
  }): Promise<readonly PendingCorrection[]>;
  approve(
    workdayId: number,
    modificationId: number,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
  decline(
    workdayId: number,
    modificationId: number,
    options?: { signal?: AbortSignal },
  ): Promise<void>;
};

export function createPendingCorrectionsApi(client: ApiClient = api): PendingCorrectionsApi {
  return {
    async fetchPendingCorrections(options = {}): Promise<readonly PendingCorrection[]> {
      return parsePendingCorrections(await client.get<unknown>(CORRECTIONS_PATH, options));
    },

    async approve(workdayId, modificationId, options = {}): Promise<void> {
      await client.post<void>(
        `${WORKDAYS_PATH}/${workdayId}/modifications/${modificationId}/approve`,
        undefined,
        options,
      );
    },

    async decline(workdayId, modificationId, options = {}): Promise<void> {
      await client.post<void>(
        `${WORKDAYS_PATH}/${workdayId}/modifications/${modificationId}/decline`,
        undefined,
        options,
      );
    },
  };
}

/**
 * Thrown when the response is not a `PendingCorrection[]`. The screen turns
 * it into the failed state with a retry, the same reasoning
 * `WorkdaysResponseError` documents: dropping the rows that did not parse
 * would draw a plausible but incomplete list from a broken payload rather
 * than asking again.
 */
export class PendingCorrectionsResponseError extends Error {
  constructor(detail: string) {
    super(`GET ${CORRECTIONS_PATH} did not answer with a list of corrections: ${detail}`);
    this.name = 'PendingCorrectionsResponseError';
    Object.setPrototypeOf(this, PendingCorrectionsResponseError.prototype);
  }
}

export function parsePendingCorrections(payload: unknown): readonly PendingCorrection[] {
  if (!Array.isArray(payload)) {
    throw new PendingCorrectionsResponseError('the body is not an array');
  }

  return payload.map((entry, index) => parsePendingCorrection(entry, `[${index}]`));
}

function parsePendingCorrection(value: unknown, context: string): PendingCorrection {
  const row = recordOf(value);
  if (row === undefined) {
    throw new PendingCorrectionsResponseError(`\`${context}\` is not an object`);
  }

  const id = row.id;
  if (typeof id !== 'number' || !Number.isSafeInteger(id) || id <= 0) {
    throw new PendingCorrectionsResponseError(
      `\`${context}.id\` is not the id of a stored modification, received ${JSON.stringify(id)}`,
    );
  }

  const workdayId = row.workday_id;
  if (typeof workdayId !== 'number' || !Number.isSafeInteger(workdayId) || workdayId <= 0) {
    throw new PendingCorrectionsResponseError(
      `\`${context}.workday_id\` is not the id of a stored workday, received ${JSON.stringify(workdayId)}`,
    );
  }

  if (typeof row.proposed_time !== 'string') {
    throw new PendingCorrectionsResponseError(`\`${context}.proposed_time\` is not a string`);
  }

  return {
    id,
    workdayId,
    markTypeLabel: stringOrNull(row.mark_type_label),
    originalTime: stringOrNull(row.original_time),
    proposedTime: row.proposed_time,
    reason: stringOrNull(row.reason),
    requestedBy: stringOrNull(row.requested_by),
    expiresAt: parseExpiresAt(row.expires_at, `${context}.expires_at`),
  };
}

function parseExpiresAt(value: unknown, field: string): NaiveDateTime {
  try {
    return naiveDateTime(value);
  } catch {
    throw new PendingCorrectionsResponseError(
      `\`${field}\` is not a naive datetime, received ${JSON.stringify(value)}`,
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
