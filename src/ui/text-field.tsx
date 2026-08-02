import { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { colors, hitTargetMin, radius, spacing, tones, typography } from '@/theme';

import { EyeIcon, EyeOffIcon } from './icons';

export type TextFieldProps = {
  /** Sits above the field and doubles as its spoken name. */
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  /**
   * The Spanish sentence under the field. Present means invalid: the outline
   * turns, the message is announced, and the field reports itself as invalid.
   */
  error?: string;
  /** Masks the value and adds the reveal toggle. */
  secureTextEntry?: boolean;
  /** What the toggle is called while the value is masked. */
  revealLabel?: string;
  /** What it is called while the value is showing. */
  hideLabel?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCorrect?: boolean;
  editable?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  onSubmitEditing?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * The labelled input the forms are built from — login here, and the leave request
 * (KMO-41) and mark correction (KMO-44) after it.
 *
 * Three things it refuses to do. It does not use the placeholder as the label: a
 * placeholder disappears the moment there is text in the field, and a form the
 * employee cannot re-read is a form they mis-fill. It does not signal the error
 * with colour alone — the outline turns *and* the sentence appears. And the reveal
 * toggle is a real 44dp control rather than a glyph tucked inside the text, because
 * it is pressed with a thumb.
 */
export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  revealLabel,
  hideLabel,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  textContentType,
  autoCorrect = false,
  editable = true,
  returnKeyType,
  onSubmitEditing,
  style,
  testID,
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const invalid = error !== undefined;

  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label}>{label}</Text>

      <View
        testID={testID === undefined ? undefined : `${testID}-outline`}
        style={[
          styles.inputRow,
          focused ? styles.focused : null,
          invalid ? styles.invalid : null,
          editable ? null : styles.readOnly,
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          aria-invalid={invalid}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          autoCorrect={autoCorrect}
          editable={editable}
          keyboardType={keyboardType}
          onBlur={() => setFocused(false)}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry && !revealed}
          style={styles.input}
          testID={testID}
          textContentType={textContentType}
          value={value}
        />

        {secureTextEntry ? (
          <Pressable
            accessibilityLabel={revealed ? hideLabel : revealLabel}
            accessibilityRole="button"
            // The pressed state is the field's own contents, not the button's, so
            // the toggle announces what it will do rather than what it did.
            onPress={() => setRevealed((showing) => !showing)}
            style={styles.reveal}
            testID={testID === undefined ? undefined : `${testID}-reveal`}
          >
            {revealed ? (
              <EyeOffIcon color={colors.textBody} size={glyphSize} />
            ) : (
              <EyeIcon color={colors.textBody} size={glyphSize} />
            )}
          </Pressable>
        ) : null}
      </View>

      {invalid ? (
        // Announced when it appears, so a screen-reader user learns why the form
        // did not submit without hunting for the field it belongs to.
        <Text accessibilityLiveRegion="polite" style={styles.error}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Matches the icon size the design uses inside a control rather than a tab. */
const glyphSize = spacing[5];

/** The design's `1px solid`, thickened to 2 while focused so the ring is visible. */
const borderWidth = 1;
const focusedBorderWidth = 2;

const styles = StyleSheet.create({
  field: {
    gap: spacing[2],
  },
  label: {
    ...typography.label,
    color: colors.textHeading,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    // A minimum, not a height: the value has to stay readable at the largest OS
    // font scale rather than being clipped by the outline.
    minHeight: 52,
    borderRadius: radius.md,
    borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.surfaceCard,
    paddingLeft: spacing[4],
    // The reveal toggle brings its own 44dp of width, so the right gutter belongs
    // to it and not to the row.
    paddingRight: spacing[1],
  },
  focused: {
    borderWidth: focusedBorderWidth,
    borderColor: colors.primary,
  },
  invalid: {
    borderWidth: focusedBorderWidth,
    borderColor: tones.danger.foreground,
  },
  readOnly: {
    backgroundColor: colors.surfacePage,
  },
  input: {
    ...typography.body,
    flex: 1,
    color: colors.textBody,
    paddingVertical: spacing[3],
    paddingRight: spacing[3],
  },
  reveal: {
    width: hitTargetMin,
    height: hitTargetMin,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  error: {
    ...typography.caption,
    color: tones.danger.foreground,
  },
});
