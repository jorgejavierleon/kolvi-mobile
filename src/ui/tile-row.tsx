import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, spacing, typography } from '@/theme';

export type Tile = {
  /** The eyebrow above the figure — `Trabajado`, `Extra`, `Faltante`. */
  label: string;
  /** Already formatted for display: this renders a string, it computes nothing. */
  value: string;
};

export type TileRowProps = {
  tiles: readonly Tile[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The label-over-value figures on a workday row: `Trabajado 08:00`,
 * `Extra 00:03`, `Faltante 00:00`.
 *
 * The pairing is read as a unit, so each tile is one accessibility element
 * ("Trabajado 08:00") rather than two adjacent strings a screen reader would
 * announce as unrelated.
 */
export function TileRow({ tiles, style, testID }: TileRowProps) {
  return (
    <View style={[styles.row, style]} testID={testID}>
      {tiles.map(({ label, value }) => (
        <View key={label} accessible accessibilityLabel={`${label} ${value}`} style={styles.tile}>
          <Text style={styles.label}>{label}</Text>
          <Text style={styles.value}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    // Three figures at the largest OS font scale no longer fit across a 412dp
    // frame; wrapping is what keeps them legible instead of clipped.
    flexWrap: 'wrap',
    gap: spacing[4],
  },
  tile: {
    flexShrink: 1,
  },
  label: {
    ...typography.eyebrow,
    color: colors.textMuted,
  },
  value: {
    ...typography.h3,
    color: colors.textHeading,
  },
});
