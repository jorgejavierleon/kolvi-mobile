import { es } from '@/i18n';

import { parsePunchState, punchStates, punchStatusLine } from './punch-state';

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
