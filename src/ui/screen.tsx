import {
  ScrollView,
  StyleSheet,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, spacing } from '@/theme';

export type ScreenProps = {
  /**
   * Scrolls with everything else. A tab's `ScreenHeader` goes here, because the
   * design draws it inside the scroll area.
   */
  children: ViewProps['children'];
  /**
   * Pinned above the scroll area — an `OverlayHeader`, which carries the only
   * way back and so must not scroll away.
   */
  header?: ViewProps['children'];
  /**
   * Pads the bottom system inset. A tab screen leaves this off: the tab bar
   * sits below it and owns that inset. A surface with no tab bar under it —
   * the profile — turns it on.
   */
  bottomInset?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The page shape every screen starts from: the system insets, the page tint,
 * and a scroll area with the design's 20dp gutters.
 *
 * Scrolling is the default rather than an opt-in because at the largest OS font
 * scale a screen that fits at 1.0 no longer does, and a fixed screen clips
 * where a scrolling one merely gets longer.
 */
export function Screen({
  children,
  header,
  bottomInset = false,
  contentContainerStyle,
  testID,
}: ScreenProps) {
  // A pinned header is the topmost thing on the screen and takes the status-bar
  // inset itself, so its own surface runs to the top edge instead of sitting
  // below a strip of page tint. Taking it here as well would double it.
  const edges = pickEdges(header !== undefined, bottomInset);

  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      {header}
      <ScrollView contentContainerStyle={[styles.content, contentContainerStyle]} testID={testID}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const sides: readonly Edge[] = ['left', 'right'];
const withTop: readonly Edge[] = ['top', ...sides];
const withBottom: readonly Edge[] = [...sides, 'bottom'];
const withTopAndBottom: readonly Edge[] = ['top', ...sides, 'bottom'];

function pickEdges(hasHeader: boolean, bottomInset: boolean): readonly Edge[] {
  if (hasHeader) {
    return bottomInset ? withBottom : sides;
  }

  return bottomInset ? withTopAndBottom : withTop;
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  content: {
    // The design's `padding:20px 20px 28px`, with the bottom rounded onto the
    // grid so the last card clears the tab bar.
    paddingTop: spacing[5],
    paddingHorizontal: spacing[5],
    paddingBottom: spacing[8],
  },
});
