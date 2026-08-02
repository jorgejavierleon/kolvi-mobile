import { naiveDate, naiveDateTime, naiveTime, NaiveDateTimeError } from '@/api/datetime';

import {
  formatClockTime,
  formatLongDate,
  formatLongDateWithYear,
  formatMonthYear,
  formatReceiptDate,
  formatReceiptTime,
  formatShortDate,
  monthNames,
  weekdayIndex,
  weekdayInitials,
  weekdayNames,
} from './dates';

describe('the Spanish day and month names', () => {
  // #4 — the exact forms the design's own WEEKDAYS and MONTHS tables hold. The
  // accents are the point: `Miércoles` and `Sábado` are misspelled without them,
  // and a screen that drops them fails Res. 38 Art. 5 as surely as English would.
  it('names the weekdays as the design writes them, accents included', () => {
    expect(weekdayNames).toEqual([
      'Domingo',
      'Lunes',
      'Martes',
      'Miércoles',
      'Jueves',
      'Viernes',
      'Sábado',
    ]);
  });

  it('names the months in lowercase, as Spanish and the design both write them', () => {
    expect(monthNames).toEqual([
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ]);
  });

  it('starts the month grid on Sunday, so the two M columns are Monday and Wednesday', () => {
    expect(weekdayInitials).toEqual(['D', 'L', 'M', 'M', 'J', 'V', 'S']);
    expect(weekdayInitials).toHaveLength(weekdayNames.length);
  });
});

describe('the day of the week, without a Date', () => {
  // Anchors spread across the century, each one checked against a calendar rather
  // than against another implementation of the same arithmetic.
  it.each([
    ['2026-08-01', 'Sábado'],
    ['2026-08-05', 'Miércoles'],
    ['2026-07-24', 'Viernes'],
    ['2000-02-29', 'Martes'],
    ['2100-03-01', 'Lunes'],
    ['1999-12-31', 'Viernes'],
  ])('reads %s as a %s', (value, expected) => {
    expect(weekdayNames[weekdayIndex(naiveDate(value))]).toBe(expected);
  });

  it('agrees with itself whether it is handed a date or a full datetime', () => {
    expect(weekdayIndex(naiveDateTime('2026-08-01 23:59:59'))).toBe(
      weekdayIndex(naiveDate('2026-08-01')),
    );
  });

  // 2100 is not a leap year — divisible by 100, not by 400 — and an implementation
  // that only tests `year % 4` drifts a day from 2100-03-01 onwards.
  it('handles the century rule that 2100 is not a leap year', () => {
    expect(weekdayNames[weekdayIndex(naiveDate('2100-02-28'))]).toBe('Domingo');
    expect(weekdayNames[weekdayIndex(naiveDate('2100-03-01'))]).toBe('Lunes');
  });
});

describe('date formats', () => {
  it('writes the home header as a capitalised weekday and a lowercase month', () => {
    expect(formatLongDate(naiveDate('2026-08-05'))).toBe('Miércoles 5 de agosto');
  });

  it('adds the year when the date is not today', () => {
    expect(formatLongDateWithYear(naiveDate('2026-08-05'))).toBe('5 de agosto 2026');
  });

  it('abbreviates to three letters for a history row, keeping the accent', () => {
    expect(formatShortDate(naiveDate('2026-07-24'))).toBe('Vie 24 jul');
    expect(formatShortDate(naiveDate('2026-07-22'))).toBe('Mié 22 jul');
    expect(formatShortDate(naiveDate('2026-09-01'))).toBe('Mar 1 sep');
  });

  it('heads a month grid with the lowercase month and the year', () => {
    expect(formatMonthYear(naiveDate('2026-08-15'))).toBe('agosto 2026');
  });

  // #3 — Res. 38 Art. 13 names dd/mm/aa as minimum receipt content. Two digits for
  // the year, and both the day and the month zero-padded.
  it('writes the receipt date as dd/mm/aa', () => {
    expect(formatReceiptDate(naiveDateTime('2026-08-01 08:00:00'))).toBe('01/08/26');
    expect(formatReceiptDate(naiveDateTime('2026-12-31 23:59:59'))).toBe('31/12/26');
    expect(formatReceiptDate(naiveDate('2007-03-09'))).toBe('09/03/07');
  });

  it('takes the date half of a datetime without reinterpreting it', () => {
    expect(formatLongDate(naiveDateTime('2026-08-05 14:30:00'))).toBe('Miércoles 5 de agosto');
  });
});

describe('time formats', () => {
  // #3 — the receipt keeps its seconds. Two punches inside the same minute are two
  // separate entries in the attendance book, and hh:mm alone cannot tell them apart.
  it('writes the receipt time with seconds', () => {
    expect(formatReceiptTime(naiveTime('08:00:00'))).toBe('08:00:00');
    expect(formatReceiptTime(naiveDateTime('2026-08-01 17:03:41'))).toBe('17:03:41');
  });

  it('drops the seconds for the clock and the shift window', () => {
    expect(formatClockTime(naiveTime('08:00:00'))).toBe('08:00');
    expect(formatClockTime(naiveDateTime('2026-08-01 17:03:41'))).toBe('17:03');
  });
});

// #8 — the midnight crossing. A night shift punches out after the date has rolled
// over, and these are the readings where anything routed through `Date` goes wrong:
// `new Date('2026-08-01 00:00:00')` is parsed in the device's zone, so on a phone
// set west of Santiago it is still 31 July and the receipt names the wrong day.
describe('midnight, which is where a Date would go wrong', () => {
  it('keeps the first second of a day on that day', () => {
    const midnight = naiveDateTime('2026-08-01 00:00:00');

    expect(formatLongDate(midnight)).toBe('Sábado 1 de agosto');
    expect(formatReceiptDate(midnight)).toBe('01/08/26');
    expect(formatReceiptTime(midnight)).toBe('00:00:00');
    expect(formatClockTime(midnight)).toBe('00:00');
  });

  it('keeps the last second of a day on that day', () => {
    const beforeMidnight = naiveDateTime('2026-07-31 23:59:59');

    expect(formatLongDate(beforeMidnight)).toBe('Viernes 31 de julio');
    expect(formatReceiptDate(beforeMidnight)).toBe('31/07/26');
    expect(formatReceiptTime(beforeMidnight)).toBe('23:59:59');
  });

  it('keeps a shift that crosses midnight on two different days', () => {
    const punchIn = naiveDateTime('2026-07-31 22:00:00');
    const punchOut = naiveDateTime('2026-08-01 06:00:00');

    expect(formatShortDate(punchIn)).toBe('Vie 31 jul');
    expect(formatShortDate(punchOut)).toBe('Sáb 1 ago');
    expect(formatReceiptTime(punchIn)).toBe('22:00:00');
    expect(formatReceiptTime(punchOut)).toBe('06:00:00');
  });

  // Chile's DST transitions, the same two readings `@/api/datetime` pins: on
  // 2026-09-06 the clock jumps 00:00 → 01:00, so `00:30:00` is a wall-clock reading
  // no instant maps to, and on 2026-04-05 the hour repeats so it maps to two.
  it('formats the wall-clock readings a DST transition makes impossible or ambiguous', () => {
    expect(formatReceiptTime(naiveDateTime('2026-09-06 00:30:00'))).toBe('00:30:00');
    expect(formatLongDate(naiveDateTime('2026-09-06 00:30:00'))).toBe('Domingo 6 de septiembre');
    expect(formatReceiptTime(naiveDateTime('2026-04-05 00:30:00'))).toBe('00:30:00');
    expect(formatLongDate(naiveDateTime('2026-04-05 00:30:00'))).toBe('Domingo 5 de abril');
  });
});

describe('values that are not wall-clock readings', () => {
  it('refuses them rather than printing something plausible', () => {
    expect(() => formatLongDate('01/08/2026' as never)).toThrow(NaiveDateTimeError);
    expect(() => formatReceiptTime('8:00' as never)).toThrow(NaiveDateTimeError);
    expect(() => formatReceiptDate('2026-08-01T08:00:00-04:00' as never)).toThrow(
      NaiveDateTimeError,
    );
  });
});
