import { StyleSheet, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme';
import { Card } from '@/ui/card';

export type UpcomingShiftRowProps = {
  /** Already composed by the caller — `daysBetween` decides "Mañana", not this row. */
  dateLabel: string;
  premise: string | null;
  /** The time window, or the leave/holiday label standing in for it. */
  trailing: string;
};

/**
 * One row of the upcoming-shifts list (KMO-32 #3–#5): a date on the left,
 * the schedule — or what replaced it — on the right.
 *
 * Not `ListRow`: these rows are not tappable (the design draws no `onClick` on
 * them, unlike Historial's own rows), and `ListRow.onPress` is required, not
 * optional. A plain presentational row inside its own `Card` is what the
 * design actually draws instead of forcing a control where there is none.
 */
export function UpcomingShiftRow({ dateLabel, premise, trailing }: UpcomingShiftRowProps) {
  return (
    <Card
      style={styles.card}
      accessible
      accessibilityLabel={`${dateLabel}${premise === null ? '' : `, ${premise}`}, ${trailing}`}
    >
      <View style={styles.text}>
        <Text style={styles.date}>{dateLabel}</Text>
        {premise === null ? null : <Text style={styles.premise}>{premise}</Text>}
      </View>
      <Text style={styles.trailing}>{trailing}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
  },
  text: {
    flexShrink: 1,
  },
  date: {
    ...typography.label,
    color: colors.textHeading,
  },
  premise: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[1] / 2,
  },
  trailing: {
    ...typography.label,
    color: colors.primary,
    flexShrink: 0,
  },
});
