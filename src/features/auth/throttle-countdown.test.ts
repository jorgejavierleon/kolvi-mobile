import { act, renderHook } from '@testing-library/react-native';

import { throttleDeadline, useThrottleCountdown } from './throttle-countdown';

/**
 * Advance the fake clock by whole seconds, inside `act` so state settles.
 *
 * `advanceTimersByTimeAsync` rather than the synchronous form, and awaited
 * inside the act. RNTL's `act` here is the async one, so a scope left unawaited
 * stays open and every render after it lands in the wrong scope — the symptom is
 * later tests reading state that belongs to no render at all. Awaiting the timer
 * advance keeps each interval callback's setState inside this scope.
 */
async function tick(seconds: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(seconds * 1000);
  });
}

beforeEach(() => {
  // Modern fake timers move `Date.now()` too, which is what the countdown reads.
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('throttleDeadline', () => {
  it('turns the seconds the server named into a moment to wait until', () => {
    expect(throttleDeadline(59)).toBe(Date.now() + 59_000);
  });

  // Not a zero-length wait. There is nothing to count, and a screen must not
  // block a control for a duration nobody named.
  it.each([undefined, 0, -5])('has no deadline for %p', (seconds) => {
    expect(throttleDeadline(seconds)).toBeNull();
  });

  // The reason this is a deadline and not a duration: `ams` can answer two
  // attempts with the same Retry-After, and a duration cannot tell them apart.
  it('gives two refusals a minute apart different deadlines for the same interval', async () => {
    const first = throttleDeadline(30);

    await tick(60);

    expect(throttleDeadline(30)).not.toBe(first);
  });
});

describe('useThrottleCountdown', () => {
  it('waits on nothing when there is no deadline', async () => {
    const { result } = await renderHook(() => useThrottleCountdown(null));

    expect(result.current).toBeNull();
  });

  it('starts at the interval the server named', async () => {
    const deadline = throttleDeadline(59);
    const { result } = await renderHook(() => useThrottleCountdown(deadline));

    expect(result.current).toBe(59);
  });

  it('counts down once a second', async () => {
    const deadline = throttleDeadline(59);
    const { result } = await renderHook(() => useThrottleCountdown(deadline));

    await tick(1);
    expect(result.current).toBe(58);

    await tick(9);
    expect(result.current).toBe(49);
  });

  it('stops at zero rather than going negative', async () => {
    const deadline = throttleDeadline(3);
    const { result } = await renderHook(() => useThrottleCountdown(deadline));

    await tick(10);

    expect(result.current).toBe(0);
  });

  // `null` and `0` are different answers. Null means nothing is being waited on;
  // zero means a wait finished and the control can come back.
  it('tells "no wait" apart from "the wait is over"', async () => {
    // Hoisted, not inline: a deadline recomputed on every render is always two
    // seconds away and never elapses.
    const deadline = throttleDeadline(2);

    const { result: absent } = await renderHook(() => useThrottleCountdown(null));
    const { result: elapsed } = await renderHook(() => useThrottleCountdown(deadline));

    await tick(5);

    expect(absent.current).toBeNull();
    expect(elapsed.current).toBe(0);
  });

  it('restarts when the server refuses again', async () => {
    const { result, rerender } = await renderHook(
      ({ deadline }: { deadline: number | null }) => useThrottleCountdown(deadline),
      { initialProps: { deadline: throttleDeadline(30) } },
    );

    await tick(25);
    expect(result.current).toBe(5);

    await rerender({ deadline: throttleDeadline(60) });

    expect(result.current).toBe(60);
  });

  // The bug the deadline design exists to prevent: keyed on the interval alone,
  // a second refusal naming the same 30 seconds would leave the count at zero
  // and the submit control live.
  it('restarts even when the new refusal names the same interval', async () => {
    const { result, rerender } = await renderHook(
      ({ deadline }: { deadline: number | null }) => useThrottleCountdown(deadline),
      { initialProps: { deadline: throttleDeadline(30) } },
    );

    await tick(30);
    expect(result.current).toBe(0);

    await rerender({ deadline: throttleDeadline(30) });

    expect(result.current).toBe(30);
  });

  // A hook that reset on prop identity would loop forever here. This one derives
  // the value from the clock, so a caller cannot drive it into a render loop.
  it('survives a caller that recomputes on every render', async () => {
    const { result } = await renderHook(() => useThrottleCountdown(throttleDeadline(30)));

    expect(result.current).toBe(30);
  });

  it('clears the wait when the failure goes away', async () => {
    const { result, rerender } = await renderHook(
      ({ deadline }: { deadline: number | null }) => useThrottleCountdown(deadline),
      { initialProps: { deadline: throttleDeadline(30) } },
    );

    expect(result.current).toBe(30);

    await rerender({ deadline: null });

    expect(result.current).toBeNull();
  });

  it('stops ticking once unmounted, so nothing sets state on a dead screen', async () => {
    const { unmount } = await renderHook(() => useThrottleCountdown(throttleDeadline(30)));

    await unmount();

    // Would warn about an update on an unmounted component if the interval
    // outlived the hook.
    await expect(tick(10)).resolves.not.toThrow();
  });
});
