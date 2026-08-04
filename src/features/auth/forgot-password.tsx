import { useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, passwordResetSent, tooManyAttempts } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { TextField } from '@/ui/text-field';

import type { AuthFailure } from './auth-api';
import {
  createForgotPasswordApi,
  resetRequestFailureFrom,
  type ForgotPasswordApi,
} from './forgot-password-api';
import { throttleDeadline, useThrottleCountdown } from './throttle-countdown';

export type ForgotPasswordProps = {
  /** Called when the employee is finished here, so the route can go back to login. */
  onDone: () => void;
  /** Injected in tests; the app uses the default over its own client. */
  api?: ForgotPasswordApi;
};

/**
 * Recuperar contraseña — the way back in for a mobile-only employee (KMO-14).
 *
 * The screen is built around a server that deliberately tells it nothing. `ams`
 * answers 204 whether or not the address has an account, so success here means
 * "the request was taken", never "a mail was sent" — and the confirmation is
 * worded conditionally because that is the only claim the app can honestly make
 * (#2). Nothing on this screen branches on whether the employee exists, because
 * nothing on this screen knows.
 *
 * Success replaces the form for the reason `ChangePassword` does, plus one that
 * is sharper here: the only thing a second submit can achieve is a 429, since the
 * limiter is what caps repetition (#5). An employee waiting for a mail that is
 * still in the queue should not be looking at the button that will refuse them.
 */
export function ForgotPassword({ onDone, api }: ForgotPasswordProps) {
  const forgotPasswordApi = useMemo(() => api ?? createForgotPasswordApi(), [api]);

  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>(undefined);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Same guard as the login screen: `submitting` lands a render later, so two
  // taps inside one frame would both pass it. The ref is true at the tap.
  const inFlight = useRef(false);

  // KMO-50's machinery, unchanged. This endpoint's limiter is the only thing an
  // employee tapping repeatedly hears back from, so the wait has to be counted
  // out loud rather than leaving the button looking broken (#5).
  const [throttledUntil, setThrottledUntil] = useState<number | null>(null);
  const waiting = useThrottleCountdown(throttledUntil);
  const throttled = waiting !== null && waiting > 0;

  const submit = async (): Promise<void> => {
    if (inFlight.current || throttled) {
      return;
    }

    const trimmed = email.trim();

    if (trimmed === '') {
      setEmailError(es.auth.emailRequired);
      setFailure(null);

      return;
    }

    setEmailError(undefined);
    setFailure(null);
    inFlight.current = true;
    setSubmitting(true);

    try {
      await forgotPasswordApi.requestReset(trimmed);
      setSentTo(trimmed);
    } catch (error) {
      const refusal = resetRequestFailureFrom(error);

      setFailure(refusal);
      setThrottledUntil(
        refusal.kind === 'throttled' ? throttleDeadline(refusal.retryAfterSeconds) : null,
      );
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  };

  const onSubmit = () => {
    void submit();
  };

  if (sentTo !== null) {
    return (
      <Card testID="forgot-password-success">
        <View accessibilityLiveRegion="polite" style={styles.success}>
          <Text style={styles.successTitle}>{es.auth.forgotPassword.successTitle}</Text>
          <Text style={styles.successBody}>{passwordResetSent(sentTo)}</Text>
          <Text style={styles.successHint}>{es.auth.forgotPassword.retryHint}</Text>
        </View>

        <Button
          label={es.auth.forgotPassword.done}
          onPress={onDone}
          testID="forgot-password-done"
        />
      </Card>
    );
  }

  return (
    <Card testID="forgot-password">
      <Text style={styles.intro}>{es.auth.forgotPassword.intro}</Text>

      <View style={styles.fields}>
        <TextField
          autoComplete="email"
          error={emailError}
          keyboardType="email-address"
          label={es.auth.email}
          onChangeText={setEmail}
          onSubmitEditing={onSubmit}
          placeholder={es.auth.emailPlaceholder}
          returnKeyType="go"
          testID="forgot-password-email"
          textContentType="emailAddress"
          value={email}
        />
      </View>

      {failure === null ? null : (
        <View
          accessibilityLiveRegion="polite"
          style={styles.failure}
          testID="forgot-password-error"
        >
          {/* Rebuilt each tick so the number on screen is the number still to
              wait, and drops the interval once it reaches zero — the same shape
              the login screen uses. */}
          <Text style={styles.failureMessage}>
            {waiting === null ? failure.message : tooManyAttempts(waiting)}
          </Text>

          {/* Offered only for a lost connection, where nothing was decided.
              Inside a throttle window pressing again is another refusal, and on
              this endpoint it feeds the limiter rather than testing it. */}
          {failure.kind === 'connectivity' ? (
            <Button
              label={es.actions.retry}
              onPress={onSubmit}
              size="sm"
              testID="forgot-password-retry"
              variant="secondary"
            />
          ) : null}
        </View>
      )}

      <Button
        disabled={throttled}
        label={es.auth.forgotPassword.submit}
        loading={submitting}
        onPress={onSubmit}
        testID="forgot-password-submit"
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
    gap: spacing[3],
    alignItems: 'flex-start',
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
  successHint: {
    ...typography.body,
    color: colors.textMuted,
  },
});
