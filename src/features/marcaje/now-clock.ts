/**
 * What time the phone thinks it is, for the clock and the date on the home screen.
 *
 * **This is a display clock and never a legal timestamp.** Res. 38 Art. 11 puts
 * the assignment of a punch's time on the system, not the device: the server
 * stamps an online punch and the app sends none (decision §5 F1), and an offline
 * punch carries the device reading as a separate `device_datetime` that is stored
 * apart from the authoritative one (§4). So nothing here ever reaches a mark. It
 * exists so an employee can see the time they are about to punch at.
 *
 * It is also the one place in the app that reads `Date`, which the rest of the
 * codebase refuses on purpose — `@/api/datetime` cannot hold a timezone-aware
 * value at all. The refusal is about values that arrived over the wire: those are
 * Santiago wall-clock readings and converting one silently rewrites a legal fact.
 * The device clock is the opposite direction. There is no wire value to preserve;
 * the phone's local reading *is* what the employee's watch says, and a phone in
 * Chile is in Santiago. So the local getters are read once, immediately, into the
 * naive parts the rest of the app speaks, and the `Date` does not escape this
 * module.
 */

import { formatNaiveDate, formatNaiveTime, type NaiveDate, type NaiveTime } from '@/api';
import { useEffect, useState } from 'react';

/**
 * How often the clock re-reads the phone (#3 asks for at least every 30 seconds).
 *
 * Not once a minute, which is the interval the `hh:mm` display would suggest: an
 * unaligned minute timer shows a time that is up to 59 seconds stale, and an
 * employee comparing the app against the clock on the wall at a shift change is
 * exactly who notices. Twice a minute halves that for one extra wake-up.
 */
export const CLOCK_TICK_MS = 30_000;

export type NowReading = {
  /** `2026-08-04` — the date over the greeting. */
  readonly date: NaiveDate;
  /** `14:07:22` — formatted down to `hh:mm` for display by `formatClockTime`. */
  readonly time: NaiveTime;
};

/** Read the phone's local wall clock, right now. */
export function readNow(clock: () => Date = () => new Date()): NowReading {
  const now = clock();

  return {
    date: formatNaiveDate({
      year: now.getFullYear(),
      // `Date` counts months from zero; every other date in this app counts from
      // one, and `formatNaiveDate` rejects a zero outright.
      month: now.getMonth() + 1,
      day: now.getDate(),
    }),
    time: formatNaiveTime({
      hour: now.getHours(),
      minute: now.getMinutes(),
      second: now.getSeconds(),
    }),
  };
}

/**
 * The current reading, refreshed on the tick.
 *
 * **Held in state rather than read during render**, and that is not a style
 * choice. This app builds with React Compiler (`reactCompiler: true` in
 * `app.config.ts`), which memoises render-time computation against its tracked
 * inputs — and the system clock is not one of them. A `return readNow()` in a
 * component body is computed once, cached, and never recomputed: the clock
 * freezes on the minute the screen opened and stays there all shift. It
 * reproduces only on a device, because Jest does not run the compiler. KMO-50 hit
 * exactly this with its countdown; see `throttle-countdown.ts`.
 *
 * State is the fix because a state read cannot be memoised away, and the interval
 * writing it is ordinary event-time code the compiler leaves alone.
 */
export function useNow(clock?: () => Date): NowReading {
  const [now, setNow] = useState<NowReading>(() => readNow(clock));

  useEffect(() => {
    const interval = setInterval(() => {
      setNow(readNow(clock));
    }, CLOCK_TICK_MS);

    return () => clearInterval(interval);
  }, [clock]);

  return now;
}
