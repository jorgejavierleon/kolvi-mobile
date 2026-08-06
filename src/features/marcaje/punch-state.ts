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

/**
 * The two punch types, as `ams` spells them on `Mark.type`.
 *
 * There is no third. Colación was dropped as a punch type (D-F1-a), so a break
 * is a window drawn on the shift card and never a row in the attendance book.
 */
export const punchTypes = ['in', 'out'] as const;

export type PunchType = (typeof punchTypes)[number];

/**
 * What pressing the button would record, or `null` when there is nothing left to
 * record today (KMO-17 #2).
 *
 * The `done` case is what makes this return a nullable rather than a type: a day
 * with both marks on it has no next punch, and the caller draws the success
 * panel instead of a button. Deriving that here rather than in the component is
 * what keeps the one-`in`-one-`out` rule (D-F1-b) in the same file as the states
 * it is a rule about.
 */
export function punchTypeFor(state: PunchState): PunchType | null {
  switch (state) {
    case 'before':
      return 'in';
    case 'working':
      return 'out';
    case 'done':
      return null;
  }
}

/** The primary button's label (#2). Verbatim from the design's `primaryLabel`. */
export function punchActionLabel(type: PunchType): string {
  return es.marcaje.punch[type];
}

/**
 * What the comprobante's `Tipo` row says the mark was (KMO-19 #3).
 *
 * A noun where `punchActionLabel` is a verb: the button offers to *marcar
 * entrada*, and the receipt afterwards states that the mark's type was
 * `Entrada`. Both hang off the same two wire values, here, rather than each
 * screen mapping `in`/`out` to Spanish on its own.
 */
export function punchTypeName(type: PunchType): string {
  return es.marcaje.receipt.types[type];
}

/**
 * Where the employee is once that punch is recorded (#2).
 *
 * Applied only to a punch the **server** accepted. The screen advances off the
 * receipt and never off the tap: a state that moved because someone pressed a
 * button would be an app claiming an attendance record that may not exist.
 */
export function stateAfterPunch(type: PunchType): PunchState {
  return type === 'in' ? 'working' : 'done';
}
