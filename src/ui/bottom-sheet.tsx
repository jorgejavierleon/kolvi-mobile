import { useEffect, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing, withAlpha } from '@/theme';

export type BottomSheetProps = {
  visible: boolean;
  /** Backdrop press and the Android back button both land here. */
  onDismiss: () => void;
  /** Scrolls. Everything the sheet says goes here. */
  children: ViewProps['children'];
  /**
   * Pinned below the scroll area, so the sheet's action stays reachable however
   * long the body gets. Omit for a sheet with no action.
   */
  footer?: ViewProps['children'];
  /**
   * What a screen reader calls the backdrop, e.g. `Cerrar comprobante`. Required
   * because the backdrop is a real control with nothing visible to name it.
   */
  dismissAccessibilityLabel: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** The design's `.kv-slideup`: `translateY(24px) → 0` plus a fade, over 280ms. */
const slideDistance = spacing[6];
const duration = 280;
/** `cubic-bezier(.2,.8,.3,1.1)` — the overshoot past 1 is deliberate. */
const easing = Easing.bezier(0.2, 0.8, 0.3, 1.1);

/**
 * The sheet the design uses for the comprobante, the leave-request wizard and
 * the document signing code: it rises from the bottom edge over a dimmed
 * screen, its body scrolls, and its action stays pinned to the bottom.
 *
 * The sheet is capped at 86% of the screen rather than sized to its content, so
 * a long body scrolls behind a visible strip of scrim — the affordance that
 * says the screen underneath is still there and a tap outside returns to it.
 */
export function BottomSheet({
  visible,
  onDismiss,
  children,
  footer,
  dismissAccessibilityLabel,
  style,
  testID,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  // useState rather than useRef: the value is read during render to build the
  // style, which a ref is not allowed to be.
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) {
      // Reset rather than animate out: the Modal unmounts its children on the
      // way down, so an exit animation would have nothing left to run on.
      progress.setValue(0);
      return;
    }

    Animated.timing(progress, {
      toValue: 1,
      duration,
      easing,
      useNativeDriver: true,
    }).start();
  }, [progress, visible]);

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [slideDistance, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      // The slide-up is ours; Modal's own animation would fight it.
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
      testID={testID}
    >
      {/* The modal boundary is the whole overlay, backdrop included — put it on
          the sheet alone and the backdrop drops out of the accessibility tree,
          leaving a screen-reader user no labelled way to close. */}
      <View accessibilityViewIsModal style={styles.root}>
        <Animated.View
          style={[styles.scrim, { opacity: progress }]}
          pointerEvents="none"
          testID="bottom-sheet-scrim"
        />
        {/* A sibling of the sheet, not its parent: as a parent it would become
            the touch responder for every press that lands on the sheet but not
            on a control inside it, and dismiss when the employee meant to
            scroll. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={dismissAccessibilityLabel}
          onPress={onDismiss}
          style={StyleSheet.absoluteFill}
          testID="bottom-sheet-backdrop"
        />
        <Animated.View
          testID="bottom-sheet-surface"
          style={[styles.sheet, { opacity: progress, transform: [{ translateY }] }, style]}
        >
          <ScrollView
            contentContainerStyle={styles.body}
            // The pinned footer is the sheet's own edge; the scroll area must not
            // add the system inset on top of it a second time.
            contentInsetAdjustmentBehavior="never"
          >
            {children}
          </ScrollView>
          {footer === undefined ? null : (
            <View style={[styles.footer, { paddingBottom: spacing[6] + insets.bottom }]}>
              {footer}
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: withAlpha(colors.ink, 0.5),
  },
  sheet: {
    width: '100%',
    maxHeight: '86%',
    backgroundColor: colors.surfaceCard,
    // The design draws a 24dp corner here — larger than a card's, which is what
    // reads as "this rose over the screen" rather than "this is another card".
    borderTopLeftRadius: radius.lg + spacing[2],
    borderTopRightRadius: radius.lg + spacing[2],
    overflow: 'hidden',
  },
  body: {
    paddingHorizontal: spacing[6],
    paddingTop: spacing[6],
    paddingBottom: spacing[2],
  },
  footer: {
    flexShrink: 0,
    paddingHorizontal: spacing[6],
    paddingTop: spacing[3],
  },
});
