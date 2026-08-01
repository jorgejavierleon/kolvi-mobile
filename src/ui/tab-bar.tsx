import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, hitTargetMin, radius, spacing, typography } from '@/theme';

import type { IconProps } from './icons';

export type TabBarItem = {
  /** Identifies the item to `onSelect`; also the React key. */
  key: string;
  /** The visible text — `Inicio`, `Jornada`, `Permisos`, `Documentos`. */
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  /**
   * What a screen reader calls this tab. Separate from `label` because a tab
   * carrying a badge must speak its count as part of its own name; see the
   * badge comment below. Required rather than optional so a new tab cannot
   * quietly ship without one.
   */
  accessibilityLabel: string;
  /**
   * Pending mark corrections on Jornada, pending signatures on Documentos. Zero
   * — not `undefined` — is the ordinary state, and draws nothing.
   */
  badgeCount?: number;
};

export type TabBarProps = {
  items: readonly TabBarItem[];
  activeKey: string;
  onSelect: (key: string) => void;
  /** Names the bar as a whole, e.g. `Secciones de la app`. */
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The persistent bottom bar. Purely presentational: it is handed its items and
 * which one is active, and reports presses back. The navigator wiring — which
 * route each item is, what order they come in — lives in `src/app/(tabs)`.
 *
 * The bar owns the bottom safe-area inset because it is the last thing above
 * the system navigation bar; the screens above it do not, or the gesture area
 * would be padded twice.
 */
/** The design's `1px solid` top edge. */
const borderWidth = 1;

/**
 * The design's 10px bottom padding, rounded onto the 8px grid. The device's own
 * bottom inset is added on top of it, never substituted for it: a phone with no
 * gesture bar still needs the bar to stand off the screen edge.
 */
const paddingBottom = spacing[3];

export function TabBar({
  items,
  activeKey,
  onSelect,
  accessibilityLabel,
  style,
  testID,
}: TabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={[styles.bar, { paddingBottom: paddingBottom + insets.bottom }, style]}
      testID={testID}
    >
      {items.map(({ key, label, icon: Icon, accessibilityLabel: name, badgeCount = 0 }) => {
        const selected = key === activeKey;
        // The design's own pair, and what KMO-4 #1 asks for. `textMuted` on
        // white is 3.83:1 — under the 4.5:1 WCAG AA wants at this size, though
        // well clear of the 3.1:1 the same token reached on the segmented
        // control's tinted track in KMO-3. It is left as drawn here rather than
        // substituted per component: `--text-muted` is used 63 times across the
        // design and is a design-system-level decision, which KMO-28 takes.
        const color = selected ? colors.primary : colors.textMuted;

        return (
          <Pressable
            key={key}
            accessibilityRole="tab"
            accessibilityLabel={name}
            accessibilityState={{ selected }}
            onPress={() => onSelect(key)}
            style={styles.item}
            testID={`tab-${key}`}
          >
            <Icon color={color} />
            <Text style={[styles.label, { color }]}>{label}</Text>
            {badgeCount > 0 ? (
              // Hidden from the accessibility tree on purpose. The pill holds a
              // bare number with nothing to attach it to, so it is spoken as
              // part of the tab's name instead — "Jornada, 2 pendientes" —
              // which is also what makes the count available to an employee who
              // cannot see the coral at all.
              <View
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                style={styles.badge}
                testID={`tab-${key}-badge`}
              >
                <Text style={styles.badgeText}>{badgeCount}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexShrink: 0,
    flexDirection: 'row',
    backgroundColor: colors.surfaceCard,
    // The design's `border-top:1px solid var(--color-border)` — the only line
    // separating the bar from the page behind it, since the bar casts no shadow.
    borderTopWidth: borderWidth,
    borderTopColor: colors.border,
    paddingTop: spacing[2],
    paddingHorizontal: spacing[2],
  },
  item: {
    flex: 1,
    // A tab is a control, so it gets the 44dp minimum even though icon plus
    // label already comes to about 40 — the same rule that sizes the segmented
    // control in KMO-3.
    minHeight: hitTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
  },
  label: {
    // The design sets 10px here. The smallest token is `eyebrow` at 11px, and a
    // preset is spread whole rather than picked apart, so the label runs one
    // pixel large — which at this size is the safer direction anyway.
    ...typography.eyebrow,
    textAlign: 'center',
  },
  badge: {
    position: 'absolute',
    top: 0,
    // The design's `right:26%`: a proportion, so the pill stays tucked against
    // the icon's top-right corner at every tab width.
    right: '26%',
    minWidth: spacing[5],
    borderRadius: radius.pill,
    backgroundColor: colors.accentCoral,
    paddingHorizontal: spacing[1],
    alignItems: 'center',
  },
  badgeText: {
    ...typography.eyebrow,
    color: colors.white,
    textAlign: 'center',
  },
});
