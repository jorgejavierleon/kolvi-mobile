import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { colors, hitTargetMin, spacing, typography } from '@/theme';

export type TextLinkProps = {
  /** Visible text. Doubles as the accessibility label. */
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * A secondary action that reads as text rather than as a button.
 *
 * `Button`'s four variants are all *weighted* — two fills and two outlines — and
 * that weight is the point: they carry the action a screen exists for. An
 * escape hatch under a form (`¿Olvidaste tu contraseña?`) is the opposite, and
 * drawing it as an outlined button would give it the same visual claim on the
 * eye as `Ingresar` directly above it.
 *
 * It is still a control, so it still takes the full 44dp target — the underline
 * and the primary colour are what make it findable, and the padding around them
 * is what makes it pressable. Underlined rather than coloured alone: colour is
 * never the only carrier of meaning in this app, and an employee with low
 * contrast vision outdoors has to be able to tell this is a link.
 */
export function TextLink({ label, onPress, style, testID }: TextLinkProps) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [styles.link, pressed ? styles.pressed : null, style]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

/** Matches `Button`'s own press feedback, so controls do not react differently. */
const pressedOpacity = 0.85;

const styles = StyleSheet.create({
  link: {
    minHeight: hitTargetMin,
    minWidth: hitTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  pressed: {
    opacity: pressedOpacity,
  },
  label: {
    ...typography.label,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
});
