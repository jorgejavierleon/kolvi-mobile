import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hitTargetMin, spacing, typography } from '@/theme';

import { ChevronLeftIcon } from './icons';

export type OverlayHeaderProps = {
  /** The surface's title — `Mi perfil`. */
  title: string;
  onBack: () => void;
  /** What a screen reader calls the chevron, e.g. `Volver`. */
  backLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The bar at the top of a surface that opened over something else: the profile,
 * later the document reader and the request wizard.
 *
 * Pinned rather than scrolling — the opposite of `ScreenHeader`, and for the
 * same reason the design does it: this bar carries the only way back, so it
 * cannot be allowed to scroll out of reach.
 */
export function OverlayHeader({ title, onBack, backLabel, style, testID }: OverlayHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.header, { paddingTop: paddingTop + insets.top }, style]} testID={testID}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={styles.back}
        testID="overlay-back"
      >
        <ChevronLeftIcon color={colors.ink} />
      </Pressable>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

/** The design's `1px solid` bottom edge. */
const borderWidth = 1;

/**
 * The design's 18px, rounded onto the grid, plus the status-bar inset at render
 * time. The bar takes that inset itself rather than leaving it to the screen:
 * it is the topmost thing on the surface, so its white has to run all the way to
 * the top edge instead of leaving a strip of page tint above it.
 */
const paddingTop = spacing[4];

const styles = StyleSheet.create({
  header: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    backgroundColor: colors.surfaceCard,
    borderBottomWidth: borderWidth,
    borderBottomColor: colors.border,
    paddingBottom: spacing[4],
    paddingHorizontal: spacing[5],
  },
  back: {
    // The design draws a bare 22dp chevron with no padding around it. It is a
    // control, so it gets the minimum target; the row absorbs the extra width.
    width: hitTargetMin,
    height: hitTargetMin,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    // Pulled back so the enlarged target does not visibly indent the chevron
    // past the design's 20dp gutter.
    marginLeft: -spacing[3],
  },
  title: {
    ...typography.h3,
    color: colors.textHeading,
    flexShrink: 1,
  },
});
