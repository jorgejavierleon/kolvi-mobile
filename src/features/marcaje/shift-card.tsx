import { StyleSheet, Text, View } from 'react-native';

import { es, formatClockTime, timeRange } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

import type { TodayShift } from './today-api';

export type ShiftCardProps = {
  /** `null` when nothing is scheduled today — the card says so rather than zeroing. */
  shift: TodayShift | null;
  testID?: string;
};

/**
 * Turno de hoy — the scheduled window, the premise, and the colación the employee
 * does not punch (KMO-15 #2).
 *
 * The colación row is read-only by decision, not by omission. D-F1-a dropped
 * break marks as a punch type for v1, so `(informativo)` is part of the label
 * rather than a footnote under it: an employee who reads `Colación 13:00 – 14:00`
 * on a card full of punchable things will look for the button that starts it.
 */
export function ShiftCard({ shift, testID }: ShiftCardProps) {
  if (shift === null) {
    return <ShiftCardEmpty testID={testID} />;
  }

  const window = timeRange(formatClockTime(shift.startTime), formatClockTime(shift.endTime));

  return (
    <Card testID={testID}>
      <View style={styles.eyebrowRow}>
        <Text style={styles.eyebrow}>{es.marcaje.shift.eyebrow}</Text>
        {/* The premise is server vocabulary and is shown verbatim. It can be a
            long branch name, so it wraps rather than pushing the eyebrow off. */}
        <Text style={styles.premise}>{shift.premise}</Text>
      </View>

      <Text style={styles.window}>{window}</Text>

      {shift.lunch === null ? null : (
        <View style={styles.lunchRow}>
          <Text style={styles.lunchLabel}>{es.marcaje.shift.lunch}</Text>
          <Text style={styles.lunchWindow}>
            {timeRange(
              formatClockTime(shift.lunch.startTime),
              formatClockTime(shift.lunch.endTime),
            )}
          </Text>
        </View>
      )}
    </Card>
  );
}

/**
 * A day with nothing scheduled (#7).
 *
 * It keeps the eyebrow, so the card is recognisably the same card in the same
 * place rather than something new the employee has to work out — the answer to
 * "what is my turno today" is right where the answer always is, and today it is
 * "there isn't one".
 */
function ShiftCardEmpty({ testID }: { testID?: string }) {
  return (
    <Card testID={testID}>
      <Text style={styles.eyebrow}>{es.marcaje.shift.eyebrow}</Text>
      <Text style={styles.emptyTitle}>{es.marcaje.shift.emptyTitle}</Text>
      <Text style={styles.emptyBody}>{es.marcaje.shift.emptyBody}</Text>
    </Card>
  );
}

/** The card's shape while the request is in flight (#9). */
export function ShiftCardSkeleton({ testID }: { testID?: string }) {
  return (
    <Card testID={testID}>
      <Skeleton width="40%" />
      <Skeleton height={spacing[6]} width="55%" style={styles.skeletonWindow} />
      <View style={styles.lunchRow}>
        <Skeleton width="45%" />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
    textTransform: 'uppercase',
    // The design's `letter-spacing:.06em` at 11px.
    letterSpacing: 0.66,
  },
  premise: {
    ...typography.caption,
    color: colors.primary,
    // Yields to the eyebrow, which is a fixed two words, and wraps rather than
    // running off the card once a branch name is long or the font scale grows.
    flexShrink: 1,
    textAlign: 'right',
  },
  window: {
    ...typography.h2,
    color: colors.textHeading,
    marginTop: spacing[1],
  },
  lunchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
    marginTop: spacing[3],
    paddingTop: spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  lunchLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 1,
  },
  lunchWindow: {
    ...typography.caption,
    color: colors.slate,
  },
  emptyTitle: {
    ...typography.h3,
    color: colors.textHeading,
    marginTop: spacing[1],
  },
  emptyBody: {
    ...typography.body,
    color: colors.textBody,
    marginTop: spacing[1],
  },
  skeletonWindow: {
    marginTop: spacing[2],
  },
});
