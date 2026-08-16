import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { NaiveTime } from '@/api';
import { es, formatClockTime } from '@/i18n';
import { colors, radius, spacing, tones, typography, type Tone } from '@/theme';
import { Card } from '@/ui/card';

import { buildAttendanceAxis } from './attendance-axis';
import type { DayDetailMark } from './day-detail-api';

export type AttendanceStripProps = {
  /** `null` on either exactly when the day has no assigned shift — the strip has no axis to draw and renders nothing. */
  shiftStart: NaiveTime | null;
  shiftEnd: NaiveTime | null;
  markIn: DayDetailMark | null;
  markOut: DayDetailMark | null;
  /** The entrada marker's tone — the day's own status badge tone, matching the design. */
  statusTone: Tone | null;
  onPressMarkIn: () => void;
  onPressMarkOut: () => void;
};

const markerSize = 20;

/**
 * 'Asistencia del día' (KMO-34 #3, #4, #5): the track, its two punch markers
 * and the axis' own tick labels — all positioned off `attendance-axis.ts`,
 * which is what actually derives the axis from the shift rather than the
 * mockup's fixed 08:00-18:00.
 *
 * A `null` mark draws no marker (#6): there is nothing dishonest to plot at
 * 0%, and `KpiTiles`' own Entrada / Salida tile already says the punch is
 * missing in words.
 */
export function AttendanceStrip({
  shiftStart,
  shiftEnd,
  markIn,
  markOut,
  statusTone,
  onPressMarkIn,
  onPressMarkOut,
}: AttendanceStripProps) {
  if (shiftStart === null || shiftEnd === null) {
    return null;
  }

  const axis = buildAttendanceAxis(
    shiftStart,
    shiftEnd,
    markIn?.time ?? null,
    markOut?.time ?? null,
  );

  const entradaColor = statusTone === null ? tones.neutral : tones[statusTone];

  return (
    <Card style={styles.card} testID="attendance-strip">
      <Text style={styles.title}>{es.jornada.dayDetail.attendanceTitle}</Text>

      <View style={styles.track}>
        {markIn === null || axis.markInPercent === null ? null : (
          <Marker
            percent={axis.markInPercent}
            background={entradaColor.background}
            border={entradaColor.foreground}
            accessibilityLabel={`${es.marcaje.receipt.types.in} ${formatClockTime(markIn.time)}`}
            onPress={onPressMarkIn}
            testID="attendance-strip-mark-in"
          />
        )}

        {markOut === null || axis.markOutPercent === null ? null : (
          <Marker
            percent={axis.markOutPercent}
            background={tones.success.background}
            border={tones.success.foreground}
            accessibilityLabel={`${es.marcaje.receipt.types.out} ${formatClockTime(markOut.time)}`}
            onPress={onPressMarkOut}
            testID="attendance-strip-mark-out"
          />
        )}
      </View>

      <View style={styles.ticks}>
        {axis.ticks.map((tick) => (
          <Text key={`${tick.label}-${tick.percent}`} style={styles.tickLabel}>
            {tick.label}
          </Text>
        ))}
      </View>
    </Card>
  );
}

function Marker({
  percent,
  background,
  border,
  accessibilityLabel,
  onPress,
  testID,
}: {
  percent: number;
  background: string;
  border: string;
  accessibilityLabel: string;
  onPress: () => void;
  testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={spacing[3]}
      onPress={onPress}
      style={[
        styles.marker,
        { left: `${percent}%`, backgroundColor: background, borderColor: border },
      ]}
      testID={testID}
    />
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing[3],
  },
  title: {
    ...typography.label,
    color: colors.textHeading,
    marginBottom: spacing[5],
  },
  track: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    marginHorizontal: spacing[1] + 2,
  },
  marker: {
    position: 'absolute',
    top: -7,
    width: markerSize,
    height: markerSize,
    marginLeft: -(markerSize / 2),
    borderRadius: markerSize / 2,
    borderWidth: 3,
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[6] + 2,
  },
  tickLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
