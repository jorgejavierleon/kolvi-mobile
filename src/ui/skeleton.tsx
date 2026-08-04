import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { colors, radius, spacing } from '@/theme';

export type SkeletonProps = {
  /** Height in dp. Defaults to a line of body text. */
  height?: number;
  /** Width as a fraction of the row, or a fixed dp value. Defaults to full width. */
  width?: number | `${number}%`;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A block standing in for content that has not arrived, for the first paint of a
 * screen that loads (KMO-15 #9).
 *
 * Blocks rather than a spinner because they carry information a spinner does not:
 * how much is coming and roughly where it will be, so the screen does not jump
 * when it lands. On the home screen that matters more than usual — the punch
 * button is the thing an employee is reaching for, and a layout that reflows
 * under a moving thumb is how the wrong control gets pressed.
 *
 * Deliberately still. An animated shimmer costs a frame loop on every load, and
 * the design has no shimmer in it; the border tint is enough to read as "not yet"
 * against the white card behind it.
 *
 * It is decorative: a skeleton is announced by the live region of whatever it is
 * standing in for, not by nine blocks each telling a screen reader about itself.
 */
export function Skeleton({ height = defaultHeight, width, style, testID }: SkeletonProps) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.block, { height }, width === undefined ? null : { width }, style]}
      testID={testID}
    />
  );
}

/** A line of `typography.body`, rounded onto the grid. */
const defaultHeight = spacing[4];

const styles = StyleSheet.create({
  block: {
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: radius.sm,
  },
});
