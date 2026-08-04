/**
 * How long a throttled screen still has to wait (KMO-50 #4).
 *
 * A timer has to exist regardless — something has to re-enable the submit
 * control when the interval elapses — so counting down out loud costs almost
 * nothing and buys the thing a disabled button cannot give. Five wrong password
 * attempts at the start of a shift is exactly when an employee needs to know
 * the app is waiting rather than broken.
 *
 * The countdown is advisory. The server's limiter is the authority on when the
 * next attempt is accepted, and a phone clock that drifts or a screen that
 * sleeps can put this out of step with it — so reaching zero re-enables the
 * button rather than promising the next press will succeed. A press that is
 * still too early comes back as another 429 and starts a fresh countdown.
 */

import { useEffect, useState } from 'react';

/** One tick, in milliseconds. */
const TICK_MS = 1000;

/**
 * When the wait ends, as a timestamp, or `null` when nothing is being waited on.
 *
 * A deadline rather than a duration, and that is the whole design. Two
 * consecutive refusals can name the *same* `Retry-After`, so a duration cannot
 * tell the second from the first and the countdown would sit at zero with the
 * submit control live — letting the employee hammer the limiter that had just
 * refused them. Two deadlines computed a minute apart are different numbers, so
 * the restart falls out for free.
 *
 * `undefined` seconds means the server refused without saying for how long, which
 * is not a zero-length wait: there is nothing to count, and the caller should not
 * block a control for a duration nobody named.
 */
export function throttleDeadline(retryAfterSeconds?: number): number | null {
  return retryAfterSeconds === undefined || retryAfterSeconds <= 0
    ? null
    : Date.now() + retryAfterSeconds * TICK_MS;
}

/**
 * Seconds left until `deadline`, re-read once a second.
 *
 * Derived from the clock on every render rather than held in state, so there is
 * no reset to get wrong and no way for a caller to drive it into a render loop.
 * The interval exists only to make the component look again.
 */
export function useThrottleCountdown(deadline: number | null): number | null {
  const [, retick] = useState(0);

  useEffect(() => {
    if (deadline === null) {
      return;
    }

    const interval = setInterval(() => {
      retick((n) => n + 1);

      // Nothing left to count. The last tick has already been scheduled, so this
      // stops the timer rather than leaving it running behind a settled screen.
      if (Date.now() >= deadline) {
        clearInterval(interval);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [deadline]);

  return deadline === null ? null : secondsUntil(deadline);
}

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / TICK_MS));
}
