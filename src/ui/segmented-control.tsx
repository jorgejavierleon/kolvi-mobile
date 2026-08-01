import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitTargetMin, radius, spacing, typography } from '@/theme';

export type Segment<T extends string> = {
  /** The value reported to `onChange`; also the React key. */
  value: T;
  /** The visible text — `Próximos` / `Historial`, `Mis solicitudes` / `Calendario`. */
  label: string;
};

export type SegmentedControlProps<T extends string> = {
  segments: readonly [Segment<T>, Segment<T>];
  value: T;
  onChange: (value: T) => void;
  /** Names the group for a screen reader, e.g. "Vista de jornada". */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The two-option control at the top of Jornada and Permisos.
 *
 * Deliberately a pair and not a list: the design only ever draws two segments,
 * and the tuple type means a third one is a compile error rather than a
 * silently cramped control.
 */
export function SegmentedControl<T extends string>({
  segments,
  value,
  onChange,
  accessibilityLabel,
  style,
  testID,
}: SegmentedControlProps<T>) {
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.track, style]}
      testID={testID}
    >
      {segments.map((segment) => {
        const selected = segment.value === value;

        return (
          <Pressable
            key={segment.value}
            accessibilityRole="tab"
            accessibilityLabel={segment.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(segment.value)}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{segment.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: radius.md,
    padding: spacing[1],
  },
  segment: {
    flex: 1,
    // The design draws a 36dp segment inside a 44dp track. A segment is a
    // control, so the hit-target minimum wins and the track ends up 52dp;
    // KMO-3 #7 is the criterion, and 8dp of chrome is the cost.
    minHeight: hitTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    // The track's radius less its inset — the inner corner the design draws.
    borderRadius: radius.md - spacing[1],
  },
  segmentSelected: {
    backgroundColor: colors.surfaceCard,
  },
  label: {
    ...typography.label,
    // The design puts `--text-muted` here, which lands at 3.1:1 against the
    // track — below the 4.5:1 WCAG AA asks of 13px text, and unreadable enough
    // in practice that the inactive tab reads as absent. `textBody` is 6.0:1
    // and still recedes behind the selected segment, which is what carries the
    // selection anyway: the raised white surface, not the text colour.
    color: colors.textBody,
    textAlign: 'center',
  },
  labelSelected: {
    color: colors.primary,
  },
});
