import { es } from '@/i18n';

import {
  parsePunchState,
  punchActionLabel,
  punchStates,
  punchStatusLine,
  punchTypeFor,
  punchTypes,
  stateAfterPunch,
} from './punch-state';

describe('parsePunchState', () => {
  it('reads the three states the decision record settled on', () => {
    expect(parsePunchState('before')).toBe('before');
    expect(parsePunchState('working')).toBe('working');
    expect(parsePunchState('done')).toBe('done');
  });

  it('has exactly those three, so colación never comes back as a punch state', () => {
    // docs/design-decisions.md D-F1-a dropped break marks. The PRD's older
    // five-state table is superseded, and these two are what it had extra.
    expect(punchStates).toEqual(['before', 'working', 'done']);
    expect(parsePunchState('break')).toBeNull();
    expect(parsePunchState('afterbreak')).toBeNull();
  });

  it('answers null for an absent state rather than assuming the day has not started', () => {
    // The one wrong answer that costs an employee a workday: telling someone who
    // punched in at 08:00 that they have not marked entrada.
    expect(parsePunchState(undefined)).toBeNull();
    expect(parsePunchState(null)).toBeNull();
  });

  it('answers null for a value that is not one of the three', () => {
    expect(parsePunchState('BEFORE')).toBeNull();
    expect(parsePunchState('en_jornada')).toBeNull();
    expect(parsePunchState(0)).toBeNull();
    expect(parsePunchState({ state: 'before' })).toBeNull();
  });
});

describe('punchStatusLine', () => {
  it('is the design’s own wording for each state', () => {
    expect(punchStatusLine('before')).toBe('Aún no marcas entrada');
    expect(punchStatusLine('working')).toBe('En jornada');
    expect(punchStatusLine('done')).toBe('Jornada finalizada');
  });

  it('comes from the catalogue, so the wording is auditable in one place', () => {
    for (const state of punchStates) {
      expect(punchStatusLine(state)).toBe(es.marcaje.status[state]);
    }
  });
});

// KMO-17 #2. The button and the status line read from the same three values, so
// the pair on screen cannot say `En jornada` over `Marcar entrada`.
describe('punchTypeFor', () => {
  it('marks entrada before the day has started and salida during it', () => {
    expect(punchTypeFor('before')).toBe('in');
    expect(punchTypeFor('working')).toBe('out');
  });

  it('has nothing left to record on a day that is already closed', () => {
    // D-F1-b: one `in` and one `out` per day. `null` is what puts the success
    // panel where the button was (#3), rather than a third label.
    expect(punchTypeFor('done')).toBeNull();
  });

  it('knows only the two types ams records, so colación is not one', () => {
    expect(punchTypes).toEqual(['in', 'out']);
  });
});

describe('punchActionLabel', () => {
  it('is the design’s own wording for each type', () => {
    expect(punchActionLabel('in')).toBe('Marcar entrada');
    expect(punchActionLabel('out')).toBe('Marcar salida');
  });

  it('comes from the catalogue, like the status line above it', () => {
    for (const type of punchTypes) {
      expect(punchActionLabel(type)).toBe(es.marcaje.punch[type]);
    }
  });
});

describe('stateAfterPunch', () => {
  it('walks the machine forward one step per recorded punch', () => {
    expect(stateAfterPunch('in')).toBe('working');
    expect(stateAfterPunch('out')).toBe('done');
  });

  // The whole machine, in the order an employee walks it. `done` is terminal:
  // there is no punch that leaves it, which is the same rule `punchTypeFor`
  // states from the other end.
  it('ends the day at done, with no punch that leaves it', () => {
    let state: (typeof punchStates)[number] = 'before';

    for (const expected of ['working', 'done'] as const) {
      const type = punchTypeFor(state);
      expect(type).not.toBeNull();
      state = stateAfterPunch(type!);
      expect(state).toBe(expected);
    }

    expect(punchTypeFor(state)).toBeNull();
  });
});
