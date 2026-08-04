/**
 * Where the employee is in their day: `before → working → done`.
 *
 * Three states and no more. Per docs/design-decisions.md §2 colación was dropped
 * as a punch type (D-F1-a) and the one-`in`-one-`out`-per-day guard was kept
 * (D-F1-b), so the PRD's five-state table — which had `break` and `afterbreak` in
 * it — is superseded. A fourth state arriving on the wire is therefore not a state
 * this app has not implemented yet; it is a backend that has started recording
 * something the design record says it would not.
 *
 * KMO-15 owns the type and the status line under the clock. KMO-17 hangs the
 * primary button's label and the transitions off these same three values rather
 * than restating the union, so the state machine has one spelling.
 */

import { es } from '@/i18n';

export const punchStates = ['before', 'working', 'done'] as const;

export type PunchState = (typeof punchStates)[number];

const known: ReadonlySet<string> = new Set<string>(punchStates);

/**
 * Read a punch state off the wire, or `null` when there is not one.
 *
 * `null` is a real answer and not a failure. `GET /me/today` is one aggregate
 * covering a screen that also has to work for someone who does not punch at all
 * (#8), so a response with no punch block is legitimate — and a value that is
 * present but unrecognised is a disagreement about the domain, which is worse
 * than an absence and must not be rounded down to `before`.
 *
 * The caller shows no status line for `null`. That is the point: `Aún no marcas
 * entrada` in front of an employee who *has* marked entrada is the one wrong
 * answer on this screen that costs them a day's attendance.
 */
export function parsePunchState(value: unknown): PunchState | null {
  return typeof value === 'string' && known.has(value) ? (value as PunchState) : null;
}

/** The line under the clock (#4). Verbatim from the design's `punchStatusLabels`. */
export function punchStatusLine(state: PunchState): string {
  return es.marcaje.status[state];
}
