import { Pressable, StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { colors, spacing, typography, type Tone } from '@/theme';
import { Card } from '@/ui/card';
import { StatusBadge } from '@/ui/status-badge';
import { TileRow, type Tile } from '@/ui/tile-row';

export type HistoryDayRowProps = {
  /** Already composed by the caller — `formatShortDate`, not this row. */
  dateLabel: string;
  statusLabel: string | null;
  statusTone: Tone | null;
  workedTime: string | null;
  extraTime: string | null;
  missingTime: string | null;
  /** Present only on a day covered by an approved leave, replacing the three figures. */
  leaveTypeLabel: string | null;
  onPress: () => void;
  testID?: string;
};

/**
 * One row of the Historial list (KMO-33 #1, #2, #4): the design's own tappable
 * card — a date and a status badge above the Trabajado / Extra / Faltante
 * figures, or the leave type in their place.
 *
 * `Card` wrapped in a `Pressable` at the call site, per `Card`'s own doc
 * comment naming this exact row as the reason that convention exists — not
 * `ListRow`, whose title/subtitle/trailing shape has no room for a badge line
 * over a row of figures.
 */
export function HistoryDayRow({
  dateLabel,
  statusLabel,
  statusTone,
  workedTime,
  extraTime,
  missingTime,
  leaveTypeLabel,
  onPress,
  testID,
}: HistoryDayRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabelFor({
        dateLabel,
        statusLabel,
        leaveTypeLabel,
        workedTime,
        extraTime,
        missingTime,
      })}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => (pressed ? styles.pressed : null)}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.date}>{dateLabel}</Text>
          {statusLabel === null || statusTone === null ? null : (
            <StatusBadge label={statusLabel} tone={statusTone} />
          )}
        </View>

        {leaveTypeLabel === null ? (
          <TileRow tiles={tilesFor(workedTime, extraTime, missingTime)} />
        ) : (
          <Text style={styles.leave}>{leaveTypeLabel}</Text>
        )}
      </Card>
    </Pressable>
  );
}

function tilesFor(
  workedTime: string | null,
  extraTime: string | null,
  missingTime: string | null,
): readonly Tile[] {
  return [
    { label: es.jornada.historial.worked, value: workedTime ?? placeholder },
    { label: es.jornada.historial.extra, value: extraTime ?? placeholder },
    { label: es.jornada.historial.missing, value: missingTime ?? placeholder },
  ];
}

/** What a figure reads as when the server sent none — never a blank tile. */
const placeholder = '—';

function accessibilityLabelFor({
  dateLabel,
  statusLabel,
  leaveTypeLabel,
  workedTime,
  extraTime,
  missingTime,
}: {
  dateLabel: string;
  statusLabel: string | null;
  leaveTypeLabel: string | null;
  workedTime: string | null;
  extraTime: string | null;
  missingTime: string | null;
}): string {
  const status = statusLabel === null ? '' : `, ${statusLabel}`;

  if (leaveTypeLabel !== null) {
    return `${dateLabel}${status}, ${leaveTypeLabel}`;
  }

  const figures = `${es.jornada.historial.worked} ${workedTime ?? placeholder}, ${es.jornada.historial.extra} ${extraTime ?? placeholder}, ${es.jornada.historial.missing} ${missingTime ?? placeholder}`;

  return `${dateLabel}${status}, ${figures}`;
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.85,
  },
  card: {
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  date: {
    ...typography.label,
    color: colors.textHeading,
  },
  leave: {
    ...typography.body,
    color: colors.textBody,
  },
});
