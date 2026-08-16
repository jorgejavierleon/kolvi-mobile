/**
 * `GET /api/v1/marks/{mark}` — a single punch, by the `mark_id` the day-detail
 * screen's attendance strip carries for it (KMO-34 #5).
 *
 * A feature never imports another feature (README), so this does not reach
 * into `features/marcaje/punch-api.ts` for `PunchReceipt` or its parser — the
 * same self-contained reasoning `workdays-api.ts` (KMO-33) already gives for
 * not reusing `features/marcaje/*-api.ts`. What is duplicated here is
 * deliberately the *confirmed* half only: a mark reachable from a computed
 * workday has, by definition, already synced, so there is no `OfflineReceipt`
 * branch to carry.
 */

import { api, naiveDateTime, type ApiClient, type NaiveDateTime } from '@/api';

/** Relative to `/api/v1`, like every path in the app. */
const MARKS_PATH = '/marks';

const punchTypes = ['in', 'out'] as const;
export type PunchType = (typeof punchTypes)[number];

const geoStatuses = ['inside', 'outside', 'unknown'] as const;
export type PunchGeoStatus = (typeof geoStatuses)[number];

/** A retrieved comprobante — the same Art. 13 fields the punch success sheet shows. */
export type PunchReceipt = {
  readonly markId: number;
  readonly type: PunchType;
  readonly datetime: NaiveDateTime;
  readonly hash: string;
  readonly geoStatus: PunchGeoStatus;
  readonly folio: string | null;
  readonly employeeName: string | null;
  readonly employeeRut: string | null;
  readonly capturedOffline: boolean;
};

export type PunchReceiptApi = {
  fetchPunchReceipt(markId: number, options?: { signal?: AbortSignal }): Promise<PunchReceipt>;
};

export function createPunchReceiptApi(client: ApiClient = api): PunchReceiptApi {
  return {
    async fetchPunchReceipt(markId, options = {}): Promise<PunchReceipt> {
      return parsePunchReceipt(await client.get<unknown>(`${MARKS_PATH}/${markId}`, options));
    },
  };
}

/**
 * Thrown when the response is not a mark. The sheet shows this as a failed
 * load rather than drawing a comprobante built from the half that parsed.
 */
export class PunchReceiptResponseError extends Error {
  constructor(detail: string) {
    super(`GET ${MARKS_PATH}/{mark} did not answer with a mark: ${detail}`);
    this.name = 'PunchReceiptResponseError';
    Object.setPrototypeOf(this, PunchReceiptResponseError.prototype);
  }
}

export function parsePunchReceipt(payload: unknown): PunchReceipt {
  const root = recordOf(payload);
  if (root === undefined) {
    throw new PunchReceiptResponseError('the body is not an object');
  }

  return {
    markId: parseMarkId(root.mark_id),
    type: parseType(root.type),
    datetime: parseDateTime(root.datetime),
    hash: parseHash(root.hash),
    geoStatus: parseGeoStatus(root.geo_status),
    folio: parseOptionalText(root.folio, 'folio'),
    employeeName: parseOptionalText(root.employee_name, 'employee_name'),
    employeeRut: parseOptionalText(root.employee_rut, 'employee_rut'),
    capturedOffline: parseCapturedOffline(root.captured_offline),
  };
}

function parseMarkId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new PunchReceiptResponseError(
      `\`mark_id\` is not the id of a stored mark, received ${JSON.stringify(value)}`,
    );
  }

  return value;
}

function parseType(value: unknown): PunchType {
  if (!punchTypes.includes(value as PunchType)) {
    throw new PunchReceiptResponseError(
      `\`type\` is not one of ${punchTypes.join(' | ')}, received ${JSON.stringify(value)}`,
    );
  }

  return value as PunchType;
}

/** Never re-read in a zone — see `@/api`'s own header comment on why. */
function parseDateTime(value: unknown): NaiveDateTime {
  try {
    return naiveDateTime(value);
  } catch {
    throw new PunchReceiptResponseError(
      `\`datetime\` is not a naive Santiago wall-clock datetime, received ${JSON.stringify(value)}`,
    );
  }
}

function parseHash(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PunchReceiptResponseError(
      `\`hash\` is not a checksum, received ${JSON.stringify(value)}`,
    );
  }

  return value;
}

function parseGeoStatus(value: unknown): PunchGeoStatus {
  if (value === null || value === undefined) {
    return 'unknown';
  }

  if (!geoStatuses.includes(value as PunchGeoStatus)) {
    throw new PunchReceiptResponseError(
      `\`geo_status\` is not one of ${geoStatuses.join(' | ')}, received ${JSON.stringify(value)}`,
    );
  }

  return value as PunchGeoStatus;
}

function parseOptionalText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new PunchReceiptResponseError(
      `\`${field}\` is not a string, received ${JSON.stringify(value)}`,
    );
  }

  return value;
}

function parseCapturedOffline(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value !== 'boolean') {
    throw new PunchReceiptResponseError(
      `\`captured_offline\` is not a boolean, received ${JSON.stringify(value)}`,
    );
  }

  return value;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
