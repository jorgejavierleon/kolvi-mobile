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
 * **The contract below is provisional**, like `today-api.ts` was for KOL-31.
 * `ams` KOL-34 is the ticket that makes the endpoint serve it — today it still
 * requires a client `datetime`, accepts no accuracy or geo status, enforces no
 * one-per-day guard and answers with an offset-stamped ISO 8601 datetime this
 * parser rejects on purpose. This file is the authoritative reading that ticket
 * is graded against.
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
  /** The SHA-256 checksum the employee can verify the mark against (Art. 13). */
  readonly hash: string;
  /** The server's geofence verdict, not the one this app sent. */
  readonly geoStatus: GeoStatus;
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
