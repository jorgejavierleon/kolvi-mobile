import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

export type CardProps = {
  children: ViewProps['children'];
  /**
   * Drops the inner padding for a card that lays out its own edge-to-edge
   * content — a list row with a full-bleed divider, an attendance strip.
   */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
} & Pick<ViewProps, 'accessible' | 'accessibilityLabel' | 'accessibilityRole'>;

/**
 * The white surface the design repeats for every raised block: the shift card,
 * a workday row in Historial, a request in Mis solicitudes, a document row.
 *
 * Only the shape lives here. A card that is tappable wraps this in a Pressable
 * at the call site rather than growing an `onPress` — that keeps the row's
 * accessibility role and hit target the caller's decision, since a card is a
 * container and not, in itself, a control.
 */
export function Card({ children, padded = true, style, testID, ...accessibility }: CardProps) {
  return (
    <View {...accessibility} testID={testID} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceCard,
    borderRadius: radius.lg,
    ...shadows.level1,
  },
  padded: {
    padding: spacing[4],
  },
});
