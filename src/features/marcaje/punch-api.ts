/**
 * `POST /api/v1/marks` — registering a punch, and reading back the receipt.
 *
 * Two things about this request are legal positions rather than design choices,
 * and both are visible in `punchBody` below.
 *
 * **It carries no timestamp.** The server assigns the legal time
 * (docs/design-decisions.md §2, "§5 F1 — Timestamps"): Res. 38 Art. 11 makes the
 * register the record, and a time the phone chooses is a time the phone can
 * falsify. So `datetime` is not merely omitted when unknown — it is never sent,
 * and the receipt's own `datetime` is the only time this app will show for a
 * punch (#4).
 *
 * **Absence is sent, not omitted** (#5). Every location key is present on every
 * request, with an explicit `null` where there is nothing to report. `{lat:
 * null}` is the app saying it had no fix; a missing `lat` is a client that might
 * have had one and dropped it, and the two must not look alike to a server that
 * is deciding whether a mark is evidence of anything.
 *
 * **The contract below was provisional and no longer is.** `ams` KOL-34 made the
 * endpoint server-authoritative — no client `datetime`, its own geofence, the
 * one-per-day guard, a naive wall-clock answer — and KOL-35 completed the
 * receipt with the folio and the worker identity Res. 38 Art. 13 asks for. Both
 * have shipped, and this file was the authoritative reading they were graded
 * against.
 */

import {
  api,
  isApiError,
  naiveDateTime,
  type ApiClient,
  type ApiError,
  type NaiveDateTime,
} from '@/api';

import { geoStatuses, type GeoStatus, type LocationFix } from './geofence';
import { punchTypes, type PunchType } from './punch-state';

/** Relative to `/api/v1`, like every path in the app. */
const MARKS_PATH = '/marks';

/**
 * Everything the app knows about a punch as it is made. Which is deliberately
 * little: the type, where the phone thought it was, and how sure it was.
 */
export type PunchRequest = {
  readonly type: PunchType;
  /** The reading from the phone, or `null` when there was none to take. */
  readonly fix: LocationFix | null;
  /**
   * The client's own reading of the geofence — **advisory** (§2). The server
   * evaluates it again and its answer is the one that goes on the record; this
   * travels so a mark made with no fix at all is explicitly `unknown` rather
   * than a mark whose location the server has to infer from silence (#11).
   */
  readonly geoStatus: GeoStatus;
};

/**
 * What the server recorded. Every value on it is the server's, which is the
 * point: KMO-19 builds the comprobante from this and from nothing else, because
 * a receipt assembled from client state is a receipt about a punch the register
 * may not contain (#4).
 */
export type PunchReceipt = {
  readonly markId: number;
  readonly type: PunchType;
  /** The legal timestamp, naive Santiago wall-clock. Never re-read in a zone. */
  readonly datetime: NaiveDateTime;
  /** The SHA-256 checksum the mark is recorded under (Art. 13). */
  readonly hash: string;
  /** The server's geofence verdict, not the one this app sent. */
  readonly geoStatus: GeoStatus;
  /**
   * `N° comprobante`, the receipt number an employee reads back to HR —
   * `YYYYMMDD-NNNN`, allocated per organization per day (D-F2-a, `ams` KOL-35).
   * Never derived from `markId`, which is a database key and not a folio.
   */
  readonly folio: string | null;
  /**
   * The worker named on the receipt (Art. 13), from the immutable snapshot
   * `MarkObserver` stamps onto the mark rather than from the live user — so a
   * receipt reprinted years later names who the employee was at the punch.
   */
  readonly employeeName: string | null;
  /** Their RUT, undotted as `ams` holds it. `formatRut` punctuates it. */
  readonly employeeRut: string | null;
};

export type PunchApi = {
  punch(request: PunchRequest, options?: { signal?: AbortSignal }): Promise<PunchReceipt>;
};

export function createPunchApi(client: ApiClient = api): PunchApi {
  return {
    async punch(request, options = {}): Promise<PunchReceipt> {
      try {
        return parsePunchReceipt(
          await client.post<unknown>(MARKS_PATH, punchBody(request), options),
        );
      } catch (error) {
        // Re-thrown as its own type so the screen answers it as a state rather
        // than as a failure. Everything else keeps travelling as an `ApiError`,
        // whose `userMessage` is already the server's own Spanish.
        throw isDuplicate(error) ? new DuplicateMarkError(error) : error;
      }
    },
  };
}

/**
 * The request body, in `ams`' own spelling.
 *
 * Written as one object literal with no conditional keys on purpose — this is
 * the file where a forgotten `datetime` or a dropped `lat` would be a
 * compliance bug, and both are visible here in one read.
 */
function punchBody({ type, fix, geoStatus }: PunchRequest): Record<string, unknown> {
  return {
    type,
    lat: fix?.latitude ?? null,
    lng: fix?.longitude ?? null,
    accuracy_m: fix?.accuracyMeters ?? null,
    geo_status: geoStatus,
  };
}

/**
 * The punch already exists for today (#7).
 *
 * Its own type because it is not a failure the employee needs apologised to
 * about: one `in` and one `out` per day is the rule (D-F1-b), and an employee
 * who lands here has usually tapped on a phone that sent the punch and lost the
 * answer. The screen reconciles with the server and says so in one calm line —
 * never a dialog.
 */
export class DuplicateMarkError extends Error {
  /** The refusal it was built from, so the server's own sentence survives. */
  override readonly cause: ApiError;

  constructor(cause: ApiError) {
    super(`POST ${MARKS_PATH} refused: the mark already exists for today`);
    this.name = 'DuplicateMarkError';
    this.cause = cause;
    // Hermes and the Babel class transform both need this for `instanceof` to
    // survive extending a built-in.
    Object.setPrototypeOf(this, DuplicateMarkError.prototype);
  }
}

export function isDuplicateMarkError(error: unknown): error is DuplicateMarkError {
  return error instanceof DuplicateMarkError;
}

/**
 * `409 Conflict`, and only that.
 *
 * One status rather than a body sniff: `ApiError` deliberately keeps only
 * `message` and Laravel's `errors` bag, so a `code` field would not survive the
 * transport layer, and matching on the Spanish sentence would make a compliance
 * behaviour depend on wording somebody may improve. KOL-34 is written to
 * this — a second `in`, or a second `out`, on the same day answers 409.
 */
function isDuplicate(error: unknown): error is ApiError {
  return isApiError(error) && error.status === HTTP_CONFLICT;
}

const HTTP_CONFLICT = 409;

/**
 * Thrown when the 201 is not a receipt. The screen shows it as a failed punch
 * with a retry (#8).
 *
 * Loud, for the same reason `today-api.ts` is loud, and more so: the alternative
 * is a comprobante built from the half of the response that parsed. A receipt is
 * the employee's evidence that their attendance was recorded (Art. 13), and one
 * with a plausible-looking time on it that came from nowhere is worse than no
 * receipt at all.
 */
export class PunchResponseError extends Error {
  constructor(detail: string) {
    super(`POST ${MARKS_PATH} did not answer with a receipt: ${detail}`);
    this.name = 'PunchResponseError';
    Object.setPrototypeOf(this, PunchResponseError.prototype);
  }
}

export function parsePunchReceipt(payload: unknown): PunchReceipt {
  const root = recordOf(payload);
  if (root === undefined) {
    throw new PunchResponseError('the body is not an object');
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
  };
}

function parseMarkId(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value <= 0) {
    throw new PunchResponseError(
      `\`mark_id\` is not the id of a stored mark, received ${JSON.stringify(value)}`,
    );
  }

  return value;
}

function parseType(value: unknown): PunchType {
  if (!punchTypes.includes(value as PunchType)) {
    throw new PunchResponseError(
      `\`type\` is not one of ${punchTypes.join(' | ')}, received ${JSON.stringify(value)}`,
    );
  }

  return value as PunchType;
}

/**
 * The legal timestamp, through `naiveDateTime` rather than a cast.
 *
 * This is the boundary the whole naive-datetime convention exists for. `ams`
 * currently answers `2026-08-05T08:03:11-04:00`, and an offset accepted here
 * would be re-read against whatever the phone believes its zone is — which is
 * how a legally-binding punch moves by an hour twice a year, on the screen the
 * employee is shown as proof. It fails instead, and KOL-34 is what fixes it.
 */
function parseDateTime(value: unknown): NaiveDateTime {
  try {
    return naiveDateTime(value);
  } catch {
    throw new PunchResponseError(
      `\`datetime\` is not a naive Santiago wall-clock datetime, received ${JSON.stringify(value)}`,
    );
  }
}

function parseHash(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new PunchResponseError(`\`hash\` is not a checksum, received ${JSON.stringify(value)}`);
  }

  return value;
}

/**
 * One of the three Art. 13 identity fields, or `null` when the register has
 * none.
 *
 * Nullable rather than required, and that is the register's shape rather than a
 * hedge against a backend that has not caught up: `ams` stamps `employee_name`
 * and `employee_rut` from `$user?->rut` onto the mark, and `users.rut` is itself
 * nullable, so a mark with no RUT on it is a fact about the record. The sheet
 * omits the row rather than drawing an empty one — see `receipt-sheet.tsx`.
 *
 * A value that is *present and not a string* still fails, like every other field
 * on this receipt. The alternative is a comprobante that prints `[object
 * Object]` where a worker's name belongs.
 */
function parseOptionalText(value: unknown, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new PunchResponseError(`\`${field}\` is not text, received ${JSON.stringify(value)}`);
  }

  // An empty string is the same absence as a null, written differently. A row
  // whose value is `''` would render as a label with nothing after it.
  return value.trim().length === 0 ? null : value;
}

/**
 * The server's verdict, or `unknown` when it did not give one.
 *
 * Absent and unreadable are treated differently, as in `today-api.ts`. An absent
 * verdict is a server that did not evaluate the geofence — which is every server
 * until KOL-34 ships — and `unknown` is exactly what that means, so reading it
 * that way states the truth rather than guessing at one. A value that is
 * *present and unrecognised* is a disagreement about the domain and fails,
 * because the one thing this field decides is whether the receipt carries
 * `Marca fuera de rango — pendiente de revisión` (KMO-19 #7), and silently
 * rounding an unknown word down to `inside` would drop that line off a mark that
 * needed it.
 */
function parseGeoStatus(value: unknown): GeoStatus {
  if (value === null || value === undefined) {
    return 'unknown';
  }

  if (!geoStatuses.includes(value as GeoStatus)) {
    throw new PunchResponseError(
      `\`geo_status\` is not one of ${geoStatuses.join(' | ')}, received ${JSON.stringify(value)}`,
    );
  }

  return value as GeoStatus;
}

function recordOf(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}
