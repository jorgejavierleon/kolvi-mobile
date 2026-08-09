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
 * The three outlines differ only in intent: `secondary` is the neutral companion
 * to a filled button, `warning` is the one that proceeds *despite* something
 * (`Marcar de todas formas (queda pendiente de revisión)`), and `danger` is the
 * destructive one (`Rechazar`).
 *
 * `warningSolid` is the fifth treatment and the design's own: the `Sincronizar`
 * pill sitting **on** the warning-tinted pending-sync banner (KMO-22). It is
 * filled rather than outlined because an outline in `tones.warning.foreground`
 * on a `tones.warning.background` card is a border against its own tint —
 * legible only if you already know it is there.
 */
export type ButtonVariant =
  'primary' | 'accent' | 'secondary' | 'warning' | 'warningSolid' | 'danger';

/**
 * The corner. `rounded` is `radius.md`, which is every button the design draws
 * inside a form or a footer; `pill` is the fully-rounded action that sits inline
 * on a status strip, which is how the design draws `Sincronizar`.
 */
export type ButtonShape = 'rounded' | 'pill';

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
  shape?: ButtonShape;
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
  // Its own tone rather than a dimmed `danger`: an override is not a
  // destructive action, and drawing it in the red the app uses for `Rechazar`
  // would read as a refusal to an employee who is being offered a way forward.
  warning: {
    background: 'transparent',
    foreground: tones.warning.foreground,
    border: tones.warning.foreground,
  },
  // The tone's own foreground, filled. On the banner it draws the action out of
  // the tint it is sitting on, which the outline above cannot do.
  warningSolid: { background: tones.warning.foreground, foreground: colors.white },
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
  shape = 'rounded',
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
          borderRadius: shape === 'pill' ? radius.pill : radius.md,
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
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
  },
  labelBox: {
    flexShrink: 1,
    alignItems: 'center',
  },
});
