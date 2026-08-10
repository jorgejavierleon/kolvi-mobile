/**
 * What time the phone thinks it is, for the clock and the date on the home screen
 * — and, since KMO-23, the one reading a queued punch carries as its own.
 *
 * **The display clock is never a legal timestamp**; that half is unchanged. Res.
 * 38 Art. 11 puts the assignment of a punch's time on the system, and the server
 * stamps an online punch while the app sends nothing (§5 F1). What KMO-21 §4.2
 * settled is narrower than "nothing here ever reaches a mark" used to claim: a
 * *queued* punch does carry a device reading, as `device_datetime`, because Art.
 * 11 is written to serve exactly the offline case and the legal time it names is
 * the hour the marcación **is made**, not the hour the register hears about it.
 * The server still assigns `date_time` — it adjudicates it from `device_datetime`
 * rather than trusting it blind — so this module still never produces the legal
 * timestamp itself, only the raw reading the server adjudicates against.
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

import {
  formatNaiveDate,
  formatNaiveDateTime,
  formatNaiveTime,
  type NaiveDate,
  type NaiveDateTime,
  type NaiveTime,
} from '@/api';
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
 * The device's own reading, as a single naive datetime — `device_datetime` on a
 * queued punch (§4.3).
 *
 * **Read once, at the moment of the punch, and never again.** The caller decides
 * when that moment is by deciding when to call this; there is no hook here that
 * would let a queue row quietly re-read the clock on flush and record the flush
 * instead of the punch. A separate function from `readNow` rather than one more
 * field on it, because the two are read at different moments for different
 * reasons — `readNow` on a timer, for display; this once, for a value that is
 * about to travel to the server and be stored immutably beside the mark.
 */
export function readDeviceDateTime(clock: () => Date = () => new Date()): NaiveDateTime {
  const now = clock();

  return formatNaiveDateTime({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  });
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
