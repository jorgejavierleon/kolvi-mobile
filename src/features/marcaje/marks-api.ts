/**
 * `GET /api/v1/marks` — the punches already in the register.
 *
 * Res. 38 Art. 22.1 gives the worker permanent and unrestricted access to their
 * own history, and this endpoint is Phase 1's answer to it: the ten most recent
 * marks, newest first (PRD §8, `permission:ViewOwn:Mark`). The full five-year
 * workday history is Phase 2's, behind the Jornada epic — what this file covers
 * is the narrower promise that a receipt is retrievable *after* the moment it
 * was shown.
 *
 * **A stored mark and a just-made one are the same thing.** Every row here is
 * read by `parsePunchReceipt`, the punch response's own parser, so what this
 * module hands back is a `PunchReceipt` — the exact type KMO-19's sheet was
 * built to draw. That is not code reuse for its own sake: it is what makes a
 * retrieved receipt carry the same folio and the same hash as the one the
 * employee saw at punch time (#3), because there is no second reading of the
 * register that could disagree with the first.
 *
 * **The contract this depends on.** `ams` KOL-35 completed `MarkResource` to
 * Art. 13 — hash, folio, `employee_name`, `employee_rut`, `geo_status` — for the
 * 201. This file is the authoritative reading that the *list* answers with the
 * same resource. The PRD sketches this endpoint as "the user's 10 most recent
 * marks" without saying what a mark is; a thin row here would mean a receipt
 * that loses its folio the moment it stops being the newest one, which is
 * exactly the retrieval Art. 22.1 is about.
 */

import { api, compareNaiveDateTime, type ApiClient } from '@/api';

import { parsePunchReceipt, type PunchReceipt } from './punch-api';

/** Relative to `/api/v1`, like every path in the app. */
const MARKS_PATH = '/marks';

export type MarksApi = {
  fetchMarks(options?: { signal?: AbortSignal }): Promise<readonly PunchReceipt[]>;
};

export function createMarksApi(client: ApiClient = api): MarksApi {
  return {
    async fetchMarks(options = {}): Promise<readonly PunchReceipt[]> {
      return parseMarks(await client.get<unknown>(MARKS_PATH, options));
    },
  };
}

/**
 * Thrown when the body is not a list of marks. The sheet shows it as a failed
 * load with a retry.
 *
 * Only the *envelope* raises this. A row that does not parse still fails as a
 * `PunchResponseError`, from `parsePunchReceipt`, and the distinction is worth
 * keeping: one says the endpoint answered with something other than a list, the
 * other says the register sent a mark this app cannot read. Both take the whole
 * list down rather than dropping the offending row — a history with a punch
 * silently missing from it is the one failure mode Art. 22.1 cannot tolerate,
 * and it would look identical to a list that is simply short.
 */
export class MarksResponseError extends Error {
  constructor(detail: string) {
    super(`GET ${MARKS_PATH} did not answer with a list of marks: ${detail}`);
    this.name = 'MarksResponseError';
    // Hermes and the Babel class transform both need this for `instanceof` to
    // survive extending a built-in.
    Object.setPrototypeOf(this, MarksResponseError.prototype);
  }
}

/**
 * The marks, newest first (#1).
 *
 * Two shapes are accepted — a bare array, and Laravel's `{data: […]}` envelope
 * that `MarkResource::collection()` serialises to — for the same reason
 * `parsePermissions` accepts two: the endpoint is written against this file, and
 * the app should not need a release the day after whichever way it lands.
 */
export function parseMarks(payload: unknown): readonly PunchReceipt[] {
  const rows = rowsOf(payload);

  if (rows === undefined) {
    throw new MarksResponseError('the body is neither an array nor a `data` envelope around one');
  }

  return rows.map((row) => parsePunchReceipt(row)).sort(newestFirst);
}

/**
 * Newest first, sorted here rather than trusted from the server.
 *
 * The endpoint is documented as answering in that order, and the criterion is
 * still about what the employee sees. Ordering asserted against a live backend
 * is a criterion that passes because the backend happened to agree that day;
 * sorted at the boundary it is a fact about this app, provable in Jest, and it
 * survives an `ams` query that grows an index or a join and quietly loses its
 * `ORDER BY`.
 *
 * `compareNaiveDateTime` and not `Date`: these are naive Santiago wall-clock
 * strings, and re-reading one through the device's timezone to sort a list is
 * the same mistake as re-reading one to display it.
 */
function newestFirst(a: PunchReceipt, b: PunchReceipt): number {
  const byTime = compareNaiveDateTime(b.datetime, a.datetime);

  // Two marks at the same recorded second is not a state the register produces —
  // one `in` and one `out` per day (D-F1-b) — but a stable tiebreak costs a line
  // and keeps the list from reshuffling under the employee across reloads.
  return byTime === 0 ? b.markId - a.markId : byTime;
}

function rowsOf(payload: unknown): readonly unknown[] | undefined {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (typeof payload === 'object' && payload !== null && 'data' in payload) {
    const { data } = payload as { data: unknown };

    return Array.isArray(data) ? data : undefined;
  }

  return undefined;
}
