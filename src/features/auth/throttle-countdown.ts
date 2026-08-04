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
 * A deadline rather than a duration, and that is deliberate. Two consecutive
 * refusals can name the *same* `Retry-After`, so a duration cannot tell the
 * second from the first and the countdown would sit at zero with the submit
 * control live — letting the employee hammer the limiter that had just refused
 * them. Two deadlines computed a minute apart are different numbers, so the
 * restart falls out for free, and a number cannot drive a render loop the way
 * keying on a freshly-built object would.
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

type Countdown = {
  /** The deadline this count belongs to, so a new one is recognised on sight. */
  readonly deadline: number | null;
  readonly remaining: number | null;
};

/**
 * Seconds left until `deadline`, re-read once a second.
 *
 * **The count is held in state, not derived from the clock during render**, and
 * that is not a style choice. This app builds with React Compiler
 * (`reactCompiler: true` in app.config.ts), which memoises render-time
 * computation on its tracked inputs — and `Date.now()` is not one of them. A
 * `return secondsUntil(deadline)` in the render body is computed once, cached
 * against `deadline`, and never recomputed: the screen freezes on the first
 * number and the submit control never comes back. It reproduces only on a
 * device, because Jest does not run the compiler.
 *
 * State is the fix because a state read cannot be memoised away, and the interval
 * writing it is ordinary event-time code the compiler does not touch.
 */
export function useThrottleCountdown(deadline: number | null): number | null {
  const [countdown, setCountdown] = useState<Countdown>(() => startOf(deadline));

  // Adjusted during render rather than in an effect. React re-runs the component
  // before committing, so the reset is part of the same paint — an effect would
  // show the stale count for a frame first, and setState in an effect body is the
  // cascade `react-hooks/set-state-in-effect` exists to stop.
  if (countdown.deadline !== deadline) {
    setCountdown(startOf(deadline));
  }

  useEffect(() => {
    if (deadline === null) {
      return;
    }

    const interval = setInterval(() => {
      setCountdown({ deadline, remaining: secondsUntil(deadline) });

      // Nothing left to count, so the timer stops rather than running on behind
      // a screen that has already settled.
      if (Date.now() >= deadline) {
        clearInterval(interval);
      }
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [deadline]);

  return countdown.deadline === deadline ? countdown.remaining : startOf(deadline).remaining;
}

function startOf(deadline: number | null): Countdown {
  return { deadline, remaining: deadline === null ? null : secondsUntil(deadline) };
}

function secondsUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / TICK_MS));
}
