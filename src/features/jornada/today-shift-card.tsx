import { StyleSheet, Text, View } from 'react-native';

import { es, formatClockTime, timeRange } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';

import type { PunchState, TodayShift } from './shifts-api';

export type TodayShiftCardProps = {
  /** Null when nothing is scheduled today — a free day, or no active assignment. */
  shift: TodayShift | null;
};

/**
 * The primary-tinted "Hoy" card at the top of Próximos (KMO-32 #2), the
 * design's own highlighted treatment for today over the plain white rows the
 * upcoming list draws everything else in.
 *
 * A day with nothing scheduled draws Marcaje's own empty-shift sentence
 * (`es.marcaje.shift.emptyTitle`) rather than a Jornada-specific one — both
 * screens are reading the same fact about the same day, and one wording for it
 * is what keeps them from disagreeing.
 */
export function TodayShiftCard({ shift }: TodayShiftCardProps) {
  if (shift === null) {
    return (
      <View style={styles.card} testID="today-shift-card-empty">
        <Text style={styles.eyebrow}>{es.jornada.todayEyebrow}</Text>
        <Text style={styles.line}>{es.marcaje.shift.emptyTitle}</Text>
      </View>
    );
  }

  const window =
    shift.startTime === null || shift.endTime === null
      ? null
      : timeRange(formatClockTime(shift.startTime), formatClockTime(shift.endTime));

  const scheduleLine = [shift.leaveTypeLabel ?? shift.holidayName ?? window, shift.premise]
    .filter((part): part is string => part !== null)
    .join(' · ');

  return (
    <View style={styles.card} testID="today-shift-card">
      <Text style={styles.eyebrow}>{es.jornada.todayEyebrow}</Text>
      {scheduleLine.length === 0 ? null : <Text style={styles.line}>{scheduleLine}</Text>}
      {shift.punchState === null ? null : (
        <Text style={styles.status}>{punchStatusLine(shift.punchState)}</Text>
      )}
    </View>
  );
}

/** The status line's own three-way lookup, off the copy Marcaje's clock already stands under. */
function punchStatusLine(state: PunchState): string {
  return es.marcaje.status[state];
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    padding: spacing[4],
    gap: spacing[1],
  },
  eyebrow: {
    ...typography.eyebrow,
    color: colors.muted,
    textTransform: 'uppercase',
  },
  line: {
    ...typography.h3,
    color: colors.white,
  },
  status: {
    ...typography.label,
    color: colors.muted,
  },
});
