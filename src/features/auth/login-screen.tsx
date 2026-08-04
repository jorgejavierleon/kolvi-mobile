import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, tooManyAttempts } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';
import { TextField } from '@/ui/text-field';

import type { AuthFailure } from './auth-api';
import { useSession } from './session';
import { throttleDeadline, useThrottleCountdown } from './throttle-countdown';

type FieldErrors = {
  email?: string;
  password?: string;
};

/**
 * The first screen an employee sees, and the only one they can reach signed out.
 *
 * It decides nothing about *why* a login failed. The two rejections that matter —
 * wrong credentials and a deactivated account — are the server's to word, so the
 * screen renders the sentence it was handed. What it does decide is the shape of
 * the failure: a request that never reached the server gets a retry next to it,
 * because pressing the same button again is the right thing to do only when
 * nothing was decided (KMO-8 #5).
 *
 * Since KMO-11 it also answers a question it is asked before anything is typed:
 * an employee who was signed in a moment ago and is suddenly here again is told
 * why, above the form.
 */
export function LoginScreen() {
  const { ended, signIn } = useSession();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<AuthFailure | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // AC#6. `submitting` dims the button and blocks its own press, but state lands a
  // render later — two taps inside one frame would both get through it. The ref is
  // what makes the guard true at the moment of the tap.
  const inFlight = useRef(false);

  // KMO-50 #4. Set when a refusal names an interval, and the gate on the submit
  // control until it runs out.
  const [throttledUntil, setThrottledUntil] = useState<number | null>(null);
  const waiting = useThrottleCountdown(throttledUntil);
  const throttled = waiting !== null && waiting > 0;

  const submit = async (): Promise<void> => {
    if (inFlight.current || throttled) {
      return;
    }

    const trimmed = email.trim();
    const missing: FieldErrors = {
      ...(trimmed === '' ? { email: es.auth.emailRequired } : {}),
      ...(password === '' ? { password: es.auth.passwordRequired } : {}),
    };

    setFieldErrors(missing);

    // An empty field is not worth a round trip, and the answer would come back as
    // a validation error the employee has to read to learn what they already know.
    if (missing.email !== undefined || missing.password !== undefined) {
      setFailure(null);

      return;
    }

    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);

    const outcome = await signIn({ email: trimmed, password });

    inFlight.current = false;
    setSubmitting(false);

    if (!outcome.ok) {
      setFailure(outcome.failure);
      setThrottledUntil(
        outcome.failure.kind === 'throttled'
          ? throttleDeadline(outcome.failure.retryAfterSeconds)
          : null,
      );
    }

    // Nothing on success: the token is in the session, and the navigator moves to
    // the tabs on its own.
  };

  const onSubmit = () => {
    void submit();
  };

  return (
    <Screen testID="login-screen">
      <View style={styles.intro}>
        <Text style={styles.heading}>{es.auth.heading}</Text>
        <Text style={styles.subheading}>{es.auth.intro}</Text>
      </View>

      {/* KMO-11 #1. Above the form rather than inside it, because it explains the
          screen rather than the last thing typed into it — and in the warning
          tone, since nothing the employee did went wrong. It gives way to a
          sign-in failure so there is never more than one message to read. */}
      {ended === null || failure !== null ? null : (
        <View
          accessibilityLiveRegion="polite"
          style={styles.sessionEnded}
          testID="login-session-ended"
        >
          <Text style={styles.sessionEndedMessage}>{ended.message}</Text>
        </View>
      )}

      <View style={styles.form}>
        <TextField
          autoComplete="email"
          error={fieldErrors.email}
          keyboardType="email-address"
          label={es.auth.email}
          onChangeText={setEmail}
          placeholder={es.auth.emailPlaceholder}
          returnKeyType="next"
          testID="login-email"
          textContentType="emailAddress"
          value={email}
        />

        <TextField
          autoComplete="current-password"
          error={fieldErrors.password}
          hideLabel={es.auth.hidePassword}
          label={es.auth.password}
          onChangeText={setPassword}
          onSubmitEditing={onSubmit}
          returnKeyType="go"
          revealLabel={es.auth.showPassword}
          secureTextEntry
          testID="login-password"
          textContentType="password"
          value={password}
        />

        {failure === null ? null : (
          <View accessibilityLiveRegion="polite" style={styles.failure} testID="login-error">
            {/* Rebuilt each tick, so the number on screen is the number still to
                wait — and once it reaches zero `tooManyAttempts` drops the
                interval rather than leaving a stale "espera 45 segundos" over a
                button that has already come back. */}
            <Text style={styles.failureMessage}>
              {waiting === null ? failure.message : tooManyAttempts(waiting)}
            </Text>

            {/* Never offered for a throttle: pressing again inside the window is
                another refusal, and on the token endpoint it feeds `ams`'s
                limiter rather than testing it. */}
            {failure.kind === 'connectivity' ? (
              <Button
                label={es.actions.retry}
                onPress={onSubmit}
                size="sm"
                testID="login-retry"
                variant="secondary"
              />
            ) : null}
          </View>
        )}

        <Button
          disabled={throttled}
          label={es.auth.submit}
          loading={submitting}
          onPress={onSubmit}
          testID="login-submit"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: {
    gap: spacing[2],
    marginTop: spacing[8],
    marginBottom: spacing[8],
  },
  heading: {
    ...typography.h1,
    color: colors.textHeading,
  },
  subheading: {
    ...typography.bodyLg,
    color: colors.textBody,
  },
  form: {
    gap: spacing[5],
  },
  sessionEnded: {
    borderRadius: radius.md,
    backgroundColor: tones.warning.background,
    marginBottom: spacing[5],
    padding: spacing[4],
  },
  sessionEndedMessage: {
    ...typography.body,
    color: tones.warning.foreground,
  },
  failure: {
    gap: spacing[3],
    alignItems: 'flex-start',
    borderRadius: radius.md,
    backgroundColor: tones.danger.background,
    padding: spacing[4],
  },
  failureMessage: {
    ...typography.body,
    color: tones.danger.foreground,
  },
});
