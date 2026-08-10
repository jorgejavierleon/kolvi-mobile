import { act, renderHook } from '@testing-library/react-native';

import { formatClockTime, formatLongDate } from '@/i18n';

import { CLOCK_TICK_MS, readDeviceDateTime, readNow, useNow } from './now-clock';

/** A phone whose clock the test moves by hand. */
function fixedClock(iso: string) {
  let current = new Date(iso);

  return {
    read: () => current,
    advanceTo: (next: string) => {
      current = new Date(next);
    },
  };
}

describe('readNow', () => {
  it('reads the phone’s local wall clock into the naive parts the app speaks', () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    expect(readNow(clock.read)).toEqual({ date: '2026-08-04', time: '14:07:22' });
  });

  it('counts months from one, as every other date in the app does', () => {
    // `Date.getMonth()` is zero-based and `formatNaiveDate` rejects a zero, so an
    // off-by-one here is a January that throws rather than a January that renders
    // as December.
    expect(readNow(fixedClock('2026-01-31T00:00:00').read).date).toBe('2026-01-31');
    expect(readNow(fixedClock('2026-12-01T23:59:59').read).date).toBe('2026-12-01');
  });

  it('pads every field, so the value round-trips through the formatters', () => {
    const reading = readNow(fixedClock('2026-03-05T09:04:07').read);

    expect(reading).toEqual({ date: '2026-03-05', time: '09:04:07' });
    expect(formatClockTime(reading.time)).toBe('09:04');
    expect(formatLongDate(reading.date)).toBe('Jueves 5 de marzo');
  });

  it('holds the seconds, even though the clock displays hh:mm', () => {
    // The display drops them; the reading keeps them so a caller that needs a
    // full wall-clock value — the offline queue's `device_datetime` — is not
    // re-reading the phone a second time to get them.
    expect(readNow(fixedClock('2026-08-04T14:07:22').read).time).toBe('14:07:22');
  });
});

describe('readDeviceDateTime (KMO-23 §4.3)', () => {
  it('reads the phone into a single naive datetime, one call and nothing more', () => {
    const clock = jest.fn(fixedClock('2026-08-04T14:07:22').read);

    expect(readDeviceDateTime(clock)).toBe('2026-08-04 14:07:22');
    expect(clock).toHaveBeenCalledTimes(1);
  });

  it('pads and counts months from one, like every other naive value', () => {
    expect(readDeviceDateTime(fixedClock('2026-01-05T09:04:07').read)).toBe('2026-01-05 09:04:07');
  });
});

describe('useNow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('starts at whatever the phone says', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    const { result } = await renderHook(() => useNow(clock.read));

    expect(result.current).toEqual({ date: '2026-08-04', time: '14:07:22' });
  });

  it('re-reads at least every 30 seconds (#3)', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    const { result } = await renderHook(() => useNow(clock.read));

    clock.advanceTo('2026-08-04T14:07:52');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS);
    });

    expect(result.current.time).toBe('14:07:52');
    expect(CLOCK_TICK_MS).toBeLessThanOrEqual(30_000);
  });

  it('keeps ticking rather than settling on its second reading', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    const { result } = await renderHook(() => useNow(clock.read));

    for (const at of ['14:07:52', '14:08:22', '14:08:52']) {
      clock.advanceTo(`2026-08-04T${at}`);
      await act(async () => {
        await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS);
      });

      expect(result.current.time).toBe(at);
    }
  });

  it('crosses midnight into the next day', async () => {
    // The date over the greeting comes from the same reading, so a night shift
    // must not be left looking at yesterday.
    const clock = fixedClock('2026-08-04T23:59:45');

    const { result } = await renderHook(() => useNow(clock.read));
    expect(result.current.date).toBe('2026-08-04');

    clock.advanceTo('2026-08-05T00:00:15');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS);
    });

    expect(result.current).toEqual({ date: '2026-08-05', time: '00:00:15' });
  });

  it('stops reading the clock once the screen has gone', async () => {
    // A tab the employee has left should not be waking the phone twice a minute
    // for a clock nobody is looking at.
    const clock = fixedClock('2026-08-04T14:07:22');
    const read = jest.fn(clock.read);

    const { unmount } = await renderHook(() => useNow(read));
    await act(async () => {
      unmount();
    });

    const readsBefore = read.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS * 4);
    });

    expect(read).toHaveBeenCalledTimes(readsBefore);
  });
});
