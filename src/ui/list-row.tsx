import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitTargetMin, spacing, typography } from '@/theme';

export type ListRowProps = {
  /** The row's primary text — what the row *is*. */
  title: string;
  /** Under the title, in the muted caption: when, where, which. */
  subtitle?: string;
  /** The value at the right edge — a time, an amount, a count. */
  trailing?: string;
  onPress: () => void;
  /**
   * What a screen reader announces for the whole row. Required, not optional:
   * the three texts sit in two columns, and read separately they lose the one
   * thing the layout was saying — that they are about the same record.
   */
  accessibilityLabel: string;
  /**
   * The hairline under the row. Pass `false` on the last row of a list, where
   * the line would sit inside the container's own padding and read as a stray
   * rule rather than as a separator.
   */
  divider?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A tappable row in a list of records: a punch in the history, a workday, a
 * document awaiting signature.
 *
 * `Button` is the wrong primitive for this and deliberately so — its five
 * variants are all *weighted*, because they carry the action a screen exists
 * for. A list of twelve of them would be twelve competing calls to action for
 * what is really one surface to browse. A row reads as content and is pressable
 * because everything in the list is.
 *
 * It still takes the full 44dp target and it still announces as one element.
 * Those are the two things that make a row a control rather than a paragraph
 * somebody discovered they could tap.
 */
export function ListRow({
  title,
  subtitle,
  trailing,
  onPress,
  accessibilityLabel,
  divider = true,
  style,
  testID,
}: ListRowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        divider ? styles.divided : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <View style={styles.text}>
        <Text style={styles.title}>{title}</Text>
        {subtitle === undefined ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {trailing === undefined ? null : <Text style={styles.trailing}>{trailing}</Text>}
    </Pressable>
  );
}

/** Matches `Button`'s own press feedback, so controls do not react differently. */
const pressedOpacity = 0.85;

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
    minHeight: hitTargetMin,
    paddingVertical: spacing[3],
  },
  divided: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  pressed: {
    opacity: pressedOpacity,
  },
  text: {
    // Takes the width the trailing value does not, and wraps into it, so a long
    // title pushes the row taller instead of pushing the value off the edge.
    flexShrink: 1,
  },
  title: {
    ...typography.label,
    color: colors.textHeading,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
  },
  trailing: {
    ...typography.h3,
    color: colors.textHeading,
    flexShrink: 0,
  },
});
