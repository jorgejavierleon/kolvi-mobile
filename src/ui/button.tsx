import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type PressableStateCallbackType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import {
  colors,
  hitTargetMin,
  radius,
  spacing,
  tones,
  typography,
  type TypographyStyle,
} from '@/theme';

/**
 * The four button treatments the design repeats.
 *
 * The design draws two *filled* buttons, not one: `--color-ink` carries the
 * confirming action at the end of a flow (`Listo`, `Continuar`, `Firmar`), and
 * `--color-accent-coral` carries the one action a screen exists for (`Marcar
 * entrada`, `+ Nueva solicitud`). Collapsing them into a single "primary" would
 * lose that distinction on exactly the screens where it matters most, so both
 * are variants.
 *
 * The two outlines differ only in intent: `secondary` is the neutral companion
 * to a filled button, `danger` is the destructive one (`Rechazar`).
 */
export type ButtonVariant = 'primary' | 'accent' | 'secondary' | 'danger';

/**
 * Heights, from the design. `md` is the default because it is what every sheet
 * and wizard footer uses; `sm` is the inline action stacked under a card; `lg`
 * is the punch button, the largest touch target in the app because it is
 * pressed outdoors, in a hurry, often with gloves on.
 */
export type ButtonSize = 'sm' | 'md' | 'lg';

export type ButtonProps = {
  /** Visible text. Doubles as the accessibility label unless one is given. */
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Dims and blocks the press; the button stays on screen and readable. */
  disabled?: boolean;
  /** Swaps in the spinner, keeps the label, and blocks the press. */
  loading?: boolean;
  /**
   * Overrides the label as the spoken name — for a button whose visible text
   * only makes sense next to something else on screen.
   */
  accessibilityLabel?: string;
  /** Longer spoken explanation, e.g. why the button is currently disabled. */
  accessibilityHint?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

type VariantStyle = {
  readonly background: string;
  readonly foreground: string;
  readonly border?: string;
};

const variants: Record<ButtonVariant, VariantStyle> = {
  primary: { background: colors.ink, foreground: colors.white },
  accent: { background: colors.accentCoral, foreground: colors.white },
  secondary: {
    background: colors.surfaceCard,
    foreground: colors.slate,
    border: colors.border,
  },
  danger: {
    background: 'transparent',
    foreground: tones.danger.foreground,
    border: tones.danger.foreground,
  },
};

/**
 * `minHeight`, never `height`: at the largest OS font scale the label needs the
 * room, and a fixed height would clip it.
 */
const sizes = {
  sm: { minHeight: hitTargetMin, text: typography.label },
  md: { minHeight: 52, text: typography.h3 },
  lg: { minHeight: 64, text: typography.h3 },
} as const satisfies Record<ButtonSize, { minHeight: number; text: TypographyStyle }>;

/** The design's `1px solid` outline. */
const borderWidth = 1;

/** The design's `opacity:.6` for a disabled action. Dimmed, never hidden. */
const disabledOpacity = 0.6;
const pressedOpacity = 0.85;

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  accessibilityLabel,
  accessibilityHint,
  style,
  testID,
}: ButtonProps) {
  const { background, foreground, border } = variants[variant];
  const { minHeight, text } = sizes[size];

  // A button mid-flight is not pressable, but it is not *disabled* either — the
  // employee did press it. `accessibilityState.busy` is what says so, which is
  // why `loading` is not handed to Pressable's own `disabled` prop: that prop
  // overwrites `accessibilityState.disabled`, and a screen reader would then
  // announce "dimmed" the moment a punch is submitted. The press is blocked in
  // the handler instead.
  const inert = disabled || loading;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ busy: loading }}
      disabled={disabled}
      onPress={() => {
        if (!inert) {
          onPress();
        }
      }}
      testID={testID}
      style={({ pressed }: PressableStateCallbackType) => [
        styles.base,
        {
          minHeight,
          backgroundColor: background,
          borderColor: border ?? 'transparent',
          borderWidth: border === undefined ? 0 : borderWidth,
          opacity: disabled ? disabledOpacity : pressed && !loading ? pressedOpacity : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          accessibilityElementsHidden
          importantForAccessibility="no"
          color={foreground}
          size="small"
          testID="button-spinner"
        />
      ) : null}
      {/* Wrapped so the label can wrap and shrink rather than push the spinner
          off the button once the OS font scale grows. */}
      <View style={styles.labelBox}>
        <Text style={[text, { color: foreground }]}>{label}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    minWidth: hitTargetMin,
    borderRadius: radius.md,
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  labelBox: {
    flexShrink: 1,
    alignItems: 'center',
  },
});
