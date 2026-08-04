import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { formatClockTime } from '@/i18n';
import { colors, spacing, typography } from '@/theme';

import { useNow } from './now-clock';
import { punchStatusLine, type PunchState } from './punch-state';

export type ClockProps = {
  /**
   * The status line under the time (#4). `null` while the screen has not been
   * told the state — nothing is shown rather than a state being guessed.
   */
  punchState: PunchState | null;
  /** Injected in tests; the app reads the phone. */
  clock?: () => Date;
  testID?: string;
};

/**
 * The big clock on the home screen and the status line under it (KMO-15 #3, #4).
 *
 * **The tick is deliberately contained here.** #3 asks that the time update
 * without re-rendering the whole screen, and the way that is achieved is
 * structural rather than clever: this component holds the only state that moves
 * twice a minute, so a tick re-renders these two lines and nothing above or below
 * them. Putting `useNow` in the screen would re-render the shift card, the week
 * summary and — once KMO-17 lands — the punch button every thirty seconds, which
 * on a mid-range Android is a visible stutter under the thumb that is reaching
 * for it.
 *
 * `memo` is what keeps that true in the other direction: the screen re-rendering
 * for its own reasons must not reset the clock's subtree.
 */
export const Clock = memo(function Clock({ punchState, clock, testID }: ClockProps) {
  const now = useNow(clock);

  return (
    <View style={styles.clock} testID={testID}>
      {/* `accessibilityLiveRegion` is deliberately absent: a time that announced
          itself twice a minute would talk over everything else on the screen. */}
      <Text style={styles.time} testID="clock-time">
        {formatClockTime(now.time)}
      </Text>

      {punchState === null ? null : (
        <Text style={styles.status} testID="clock-status">
          {punchStatusLine(punchState)}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  clock: {
    alignItems: 'center',
  },
  time: {
    // `--text-display`, which the token file reserves for exactly this.
    ...typography.display,
    color: colors.textHeading,
    // The design's `letter-spacing:-1px` on the 44px cut.
    letterSpacing: -1,
  },
  status: {
    ...typography.label,
    color: colors.textMuted,
    marginTop: spacing[1],
    textAlign: 'center',
  },
});
