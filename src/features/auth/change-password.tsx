import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { TextField } from '@/ui/text-field';

import {
  createPasswordApi,
  passwordChangeFailureFrom,
  type PasswordApi,
  type PasswordChangeFailure,
} from './password-api';

type FieldErrors = {
  current?: string;
  next?: string;
  confirm?: string;
};

export type ChangePasswordProps = {
  /** Called once the change has succeeded, so the route can leave the screen. */
  onDone: () => void;
  /** Injected in tests; the app uses the singleton-backed default. */
  api?: PasswordApi;
};

/**
 * Cambiar contraseña — the Art. 7f screen (KMO-13).
 *
 * The form decides two things and defers the rest. It decides that an empty field
 * and a mismatched confirmation are not worth a round trip, and it decides which
 * input a refusal belongs under. It does not decide *why* the server said no: the
 * wrong-current-password and policy sentences come from `ams` already in Spanish
 * and are rendered as handed over, the same rule the login screen follows.
 *
 * Success replaces the form rather than sitting above it. Leaving three filled
 * password fields on screen after the change has happened invites a second submit
 * that would now fail — the current password it holds is the old one.
 */
export function ChangePassword({ onDone, api }: ChangePasswordProps) {
  const passwordApi = useMemo(() => api ?? createPasswordApi(), [api]);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<PasswordChangeFailure | null>(null);
  const [changed, setChanged] = useState(false);

  // Same guard as the login screen: `submitting` lands a render later, so two
  // taps inside one frame would both pass it. The ref is true at the tap.
  const inFlight = useRef(false);

  const submit = async (): Promise<void> => {
    if (inFlight.current) {
      return;
    }

    const missing: FieldErrors = {
      ...(current === '' ? { current: es.auth.changePassword.currentRequired } : {}),
      ...(next === '' ? { next: es.auth.changePassword.newRequired } : {}),
      ...(confirm === '' ? { confirm: es.auth.changePassword.confirmRequired } : {}),
    };

    // Only worth saying once both are filled — telling someone their empty
    // confirmation does not match is noise on top of the message that matters.
    if (missing.next === undefined && missing.confirm === undefined && next !== confirm) {
      missing.confirm = es.auth.changePassword.mismatch;
    }

    setFieldErrors(missing);
    setFailure(null);

    if (Object.keys(missing).length > 0) {
      return;
    }

    inFlight.current = true;
    setSubmitting(true);

    try {
      await passwordApi.changePassword({ currentPassword: current, newPassword: next });
      setChanged(true);
    } catch (error) {
      const refusal = passwordChangeFailureFrom(error);

      setFieldErrors({
        ...(refusal.currentPassword === undefined ? {} : { current: refusal.currentPassword }),
        ...(refusal.newPassword === undefined ? {} : { next: refusal.newPassword }),
      });
      setFailure(refusal.message === undefined ? null : refusal);
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  if (changed) {
    return (
      <Card testID="change-password-success">
        <View accessibilityLiveRegion="polite" style={styles.success}>
          <Text style={styles.successTitle}>{es.auth.changePassword.successTitle}</Text>
          <Text style={styles.successBody}>{es.auth.changePassword.successBody}</Text>
        </View>

        <Button
          label={es.auth.changePassword.done}
          onPress={onDone}
          testID="change-password-done"
        />
      </Card>
    );
  }

  return (
    <Card testID="change-password">
      <Text style={styles.intro}>{es.auth.changePassword.intro}</Text>

      <View style={styles.fields}>
        <TextField
          autoComplete="current-password"
          error={fieldErrors.current}
          hideLabel={es.auth.hidePassword}
          label={es.auth.changePassword.current}
          onChangeText={setCurrent}
          revealLabel={es.auth.showPassword}
          secureTextEntry
          testID="change-password-current"
          textContentType="password"
          value={current}
        />

        <TextField
          autoComplete="new-password"
          error={fieldErrors.next}
          hideLabel={es.auth.hidePassword}
          label={es.auth.changePassword.new}
          onChangeText={setNext}
          revealLabel={es.auth.showPassword}
          secureTextEntry
          testID="change-password-new"
          textContentType="newPassword"
          value={next}
        />

        <TextField
          autoComplete="new-password"
          error={fieldErrors.confirm}
          hideLabel={es.auth.hidePassword}
          label={es.auth.changePassword.confirm}
          onChangeText={setConfirm}
          returnKeyType="done"
          revealLabel={es.auth.showPassword}
          secureTextEntry
          testID="change-password-confirm"
          textContentType="newPassword"
          value={confirm}
          onSubmitEditing={() => void submit()}
        />
      </View>

      {failure === null ? null : (
        <View
          accessibilityLiveRegion="polite"
          style={styles.failure}
          testID="change-password-error"
        >
          <Text style={styles.failureMessage}>{failure.message}</Text>
        </View>
      )}

      <Button
        label={es.auth.changePassword.action}
        loading={submitting}
        onPress={() => void submit()}
        testID="change-password-submit"
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: {
    ...typography.body,
    color: colors.textBody,
    marginBottom: spacing[4],
  },
  fields: {
    gap: spacing[4],
    marginBottom: spacing[4],
  },
  failure: {
    borderRadius: radius.md,
    backgroundColor: tones.danger.background,
    padding: spacing[4],
    marginBottom: spacing[4],
  },
  failureMessage: {
    ...typography.body,
    color: tones.danger.foreground,
  },
  success: {
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  successTitle: {
    ...typography.h2,
    color: colors.textHeading,
  },
  successBody: {
    ...typography.bodyLg,
    color: colors.textBody,
  },
});
