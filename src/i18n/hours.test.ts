import { formatDecimalHours, formatHoursAsClock, HoursFormatError } from './hours';

describe('decimal hours, for the week summary', () => {
  // #6 — the numbers in `32,5 / 44 hrs esta semana`. A comma, because that is the
  // es-CL decimal mark and what the design's own leave wizard writes for `0,5` days.
  it('writes the decimal mark as a comma', () => {
    expect(formatDecimalHours(32.5)).toBe('32,5');
  });

  it('leaves a whole number bare, with no trailing comma-zero', () => {
    expect(formatDecimalHours(44)).toBe('44');
    expect(formatDecimalHours(0)).toBe('0');
  });

  it('rounds to a single decimal place', () => {
    expect(formatDecimalHours(7.633)).toBe('7,6');
    expect(formatDecimalHours(7.65)).toBe('7,7');
    expect(formatDecimalHours(43.96)).toBe('44');
  });
});

describe('decimal hours as a duration on the clock, for the KPI tiles', () => {
  // #6 — the design writes Trabajado / Extra / Faltante as `08:00`, `00:03`,
  // `00:22`: the same decimal hours, on the same clock as the punch times beside them.
  it.each([
    [8, '08:00'],
    [7.633, '07:38'],
    [0.05, '00:03'],
    [0.3667, '00:22'],
    [0, '00:00'],
  ])('writes %s hours as %s', (hours, expected) => {
    expect(formatHoursAsClock(hours)).toBe(expected);
  });

  // Rounding the hours and the minutes separately gives `07:60` here, which is not a
  // reading — the total has to be rounded to the minute first.
  it('never produces a sixtieth minute', () => {
    expect(formatHoursAsClock(7.9999)).toBe('08:00');
    expect(formatHoursAsClock(0.99999)).toBe('01:00');
  });

  // A length of time, not a time of day. A month of accumulated overtime reads as
  // itself rather than folding back around the 24-hour mark.
  it('does not wrap at 24 hours', () => {
    expect(formatHoursAsClock(24)).toBe('24:00');
    expect(formatHoursAsClock(176.5)).toBe('176:30');
  });

  it('pads a single-digit hour, so the tiles line up in a column', () => {
    expect(formatHoursAsClock(1.5)).toBe('01:30');
  });
});

describe('values that are not a duration', () => {
  // Negative worked time is a server-side arithmetic bug. Rendering `-01:30` on a
  // KPI tile would make it look like a feature.
  it.each([[-1], [-0.01], [Number.NaN], [Number.POSITIVE_INFINITY]])(
    'refuses %s rather than rendering it',
    (hours) => {
      expect(() => formatHoursAsClock(hours)).toThrow(HoursFormatError);
      expect(() => formatDecimalHours(hours)).toThrow(HoursFormatError);
    },
  );

  it('survives instanceof through the Hermes class transform', () => {
    try {
      formatDecimalHours(-1);
    } catch (error) {
      expect(error).toBeInstanceOf(HoursFormatError);
      expect(error).toBeInstanceOf(Error);
    }

    expect.assertions(2);
  });
});
