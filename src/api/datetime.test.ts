import {
  compareNaiveDateTime,
  dateOf,
  formatNaiveDate,
  formatNaiveDateTime,
  formatNaiveTime,
  isNaiveDateTime,
  naiveDate,
  naiveDateTime,
  naiveTime,
  NaiveDateTimeError,
  parseNaiveDate,
  parseNaiveDateTime,
  parseNaiveTime,
  timeOf,
  type NaiveDateTime,
} from './datetime';

describe('naive Santiago wall-clock datetimes', () => {
  // #2 — the round trip. Every one of these is a wall-clock reading the backend
  // can send, and the last two are the ones that would break if a `Date` were
  // ever involved: on 2026-09-06 Chile's clock jumps 00:00 → 01:00, so
  // `00:30:00` is a reading no instant maps to, and on 2026-04-05 the hour
  // repeats, so `00:30:00` maps to two.
  it.each([
    '2026-08-01 08:00:00',
    '2026-08-01 00:00:00',
    '2026-08-01 23:59:59',
    '2026-12-31 23:59:59',
    '2028-02-29 12:00:00',
    '2026-09-06 00:30:00',
    '2026-04-05 00:30:00',
  ])('survives parse and format unchanged: %s', (value) => {
    expect(formatNaiveDateTime(parseNaiveDateTime(value))).toBe(value);
  });

  it('takes a datetime apart into the integers that were written, nothing derived', () => {
    expect(parseNaiveDateTime('2026-08-01 08:05:09')).toEqual({
      year: 2026,
      month: 8,
      day: 1,
      hour: 8,
      minute: 5,
      second: 9,
    });
  });

  // #2 — `MarkResource` currently emits `toIso8601String()`, which stamps an
  // offset onto a naive value. Accepting one of these would mean a legally
  // binding timestamp silently off by an hour, so they fail loudly instead.
  it.each([
    '2026-08-01T08:00:00',
    '2026-08-01T08:00:00Z',
    '2026-08-01T08:00:00-04:00',
    '2026-08-01 08:00:00-04:00',
    '2026-08-01 08:00:00.000',
    '2026-08-01 08:00',
    '01-08-2026 08:00:00',
    '',
  ])('refuses %s rather than coercing it', (value) => {
    expect(() => parseNaiveDateTime(value)).toThrow(NaiveDateTimeError);
    expect(isNaiveDateTime(value)).toBe(false);
  });

  it.each([null, undefined, 42, {}, new Date('2026-08-01')])(
    'refuses the non-string %p',
    (value) => {
      expect(() => parseNaiveDateTime(value)).toThrow(NaiveDateTimeError);
    },
  );

  it.each(['2026-02-30 08:00:00', '2026-02-29 08:00:00', '2026-13-01 08:00:00'])(
    'refuses the impossible date %s',
    (value) => {
      expect(() => parseNaiveDateTime(value)).toThrow(NaiveDateTimeError);
    },
  );

  it.each(['2026-08-01 24:00:00', '2026-08-01 08:60:00', '2026-08-01 08:00:60'])(
    'refuses the impossible time %s',
    (value) => {
      expect(() => parseNaiveDateTime(value)).toThrow(NaiveDateTimeError);
    },
  );

  it('accepts 29 February in a leap year', () => {
    expect(isNaiveDateTime('2028-02-29 08:00:00')).toBe(true);
  });

  it('brands a wire value so an unchecked string cannot stand in for one', () => {
    expect(naiveDateTime('2026-08-01 08:00:00')).toBe('2026-08-01 08:00:00');
    expect(naiveDate('2026-08-01')).toBe('2026-08-01');
    expect(naiveTime('08:00:00')).toBe('08:00:00');
    expect(() => naiveDateTime('2026-08-01T08:00:00Z')).toThrow(NaiveDateTimeError);
  });

  it('names what it expected, so a wire-contract break is readable in a log', () => {
    expect(() => naiveDateTime('2026-08-01T08:00:00Z')).toThrow(
      /Expected a naive datetime.*2026-08-01T08:00:00Z/,
    );
  });

  it('splits a datetime for the receipt by cutting the string, not recomputing it', () => {
    const value = '2026-09-06 00:30:00' as NaiveDateTime;

    expect(dateOf(value)).toBe('2026-09-06');
    expect(timeOf(value)).toBe('00:30:00');
  });

  it('pads the parts back to the wire widths', () => {
    expect(formatNaiveDate({ year: 2026, month: 1, day: 2 })).toBe('2026-01-02');
    expect(formatNaiveTime({ hour: 8, minute: 5, second: 9 })).toBe('08:05:09');
  });

  it('refuses to format parts that are not a real reading', () => {
    expect(() => formatNaiveTime({ hour: 24, minute: 0, second: 0 })).toThrow(NaiveDateTimeError);
    expect(() => formatNaiveDate({ year: 2026, month: 2, day: 30 })).toThrow(NaiveDateTimeError);
    expect(() => formatNaiveTime({ hour: 1.5, minute: 0, second: 0 })).toThrow(NaiveDateTimeError);
  });

  it('parses the date-only and time-only wire forms the shift schedule uses', () => {
    expect(parseNaiveDate('2026-08-01')).toEqual({ year: 2026, month: 8, day: 1 });
    expect(parseNaiveTime('13:00:00')).toEqual({ hour: 13, minute: 0, second: 0 });
    expect(() => parseNaiveDate('2026-08-01 08:00:00')).toThrow(NaiveDateTimeError);
    expect(() => parseNaiveTime('13:00')).toThrow(NaiveDateTimeError);
  });

  it('orders punches lexicographically, so the offline queue needs no arithmetic', () => {
    const earlier = '2026-08-01 08:00:00' as NaiveDateTime;
    const later = '2026-08-01 17:30:00' as NaiveDateTime;
    const nextDay = '2026-08-02 07:00:00' as NaiveDateTime;

    expect(compareNaiveDateTime(earlier, later)).toBe(-1);
    expect(compareNaiveDateTime(later, earlier)).toBe(1);
    expect(compareNaiveDateTime(earlier, earlier)).toBe(0);
    expect([later, nextDay, earlier].sort(compareNaiveDateTime)).toEqual([earlier, later, nextDay]);
  });
});

// #2's other half — "no timezone conversion occurs anywhere in the client" — is
// enforced by ESLint rather than from here: `eslint.config.js` bans `Date`,
// `Intl` and the locale/ISO formatters inside `src/api`, the same way it bans raw
// hex outside `src/theme`. A lint rule fails every commit; a test only fails when
// somebody runs it, and it cannot see a conversion added to a file it forgot to
// scan.
