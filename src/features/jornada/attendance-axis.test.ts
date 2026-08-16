import { naiveTime } from '@/api';

import { buildAttendanceAxis } from './attendance-axis';

const time = (value: string) => naiveTime(`${value}:00`);

describe('buildAttendanceAxis', () => {
  it('spans the shift window with six evenly spaced ticks', () => {
    const axis = buildAttendanceAxis(time('08:00'), time('18:00'), null, null);

    expect(axis.ticks).toHaveLength(6);
    expect(axis.ticks[0]).toEqual({ label: '08:00', percent: 0 });
    expect(axis.ticks[5]).toEqual({ label: '18:00', percent: 100 });
    expect(axis.ticks.map((tick) => tick.label)).toEqual([
      '08:00',
      '10:00',
      '12:00',
      '14:00',
      '16:00',
      '18:00',
    ]);
  });

  it('places an ordinary day’s punches proportionally along the axis', () => {
    const axis = buildAttendanceAxis(time('08:00'), time('18:00'), time('08:24'), time('17:00'));

    // 24 minutes into a 600-minute window.
    expect(axis.markInPercent).toBeCloseTo(4, 5);
    // 540 minutes into a 600-minute window.
    expect(axis.markOutPercent).toBeCloseTo(90, 5);
  });

  it('nulls a percent exactly when the punch itself is missing (#6)', () => {
    const axis = buildAttendanceAxis(time('08:00'), time('17:00'), time('08:00'), null);

    expect(axis.markInPercent).not.toBeNull();
    expect(axis.markOutPercent).toBeNull();
  });

  it('clamps a punch outside the shift window to the nearest edge rather than overflowing it', () => {
    const axis = buildAttendanceAxis(time('08:00'), time('17:00'), time('07:30'), time('17:30'));

    expect(axis.markInPercent).toBe(0);
    expect(axis.markOutPercent).toBe(100);
  });

  it('wraps a shift crossing midnight so the axis runs forward rather than reversing', () => {
    // 22:00 to 06:00 the next day is an 8-hour (480 minute) span.
    const axis = buildAttendanceAxis(time('22:00'), time('06:00'), time('22:10'), time('05:45'));

    // 10 minutes into 480.
    expect(axis.markInPercent).toBeCloseTo((10 / 480) * 100, 5);
    // Without the midnight wrap this would read as before markIn (or clamp to
    // 0) instead of landing near the end of the strip, which is exactly the
    // bug this axis exists to prevent.
    expect(axis.markOutPercent).toBeCloseTo((465 / 480) * 100, 5);
    expect(axis.markOutPercent as number).toBeGreaterThan(axis.markInPercent as number);
  });

  it('wraps tick labels crossing midnight back into 00:00 rather than 24:00', () => {
    const axis = buildAttendanceAxis(time('22:00'), time('06:00'), null, null);

    expect(axis.ticks.map((tick) => tick.label)).toEqual([
      '22:00',
      '23:36',
      '01:12',
      '02:48',
      '04:24',
      '06:00',
    ]);
  });

  it('reads a night shift that never crosses midnight the same as any other window', () => {
    const axis = buildAttendanceAxis(time('20:00'), time('23:00'), time('20:05'), time('22:58'));

    expect(axis.ticks[0]?.label).toBe('20:00');
    expect(axis.ticks[5]?.label).toBe('23:00');
    expect(axis.markInPercent).toBeCloseTo((5 / 180) * 100, 5);
    expect(axis.markOutPercent).toBeCloseTo((178 / 180) * 100, 5);
  });
});
