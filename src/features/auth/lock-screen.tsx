import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Screen } from '@/ui/screen';

import type { BiometricOutcome } from './biometrics';
import { useLock } from './lock';
import { useSession } from './session';

/**
 * What stands between a backgrounded app and the employee's data.
 *
 * There are exactly two ways off this screen and both cost something: a biometric
 * the OS accepted, or the Kolvi password typed into the login screen. There is no
 * third — no timeout, no dismiss, no back gesture — because #3's "never silently
 * grants access" is a property of what this screen does *not* have.
 *
 * The password route clears local session state and drops to `/login`, which is a
 * full re-authentication against the server rather than a second password check
 * invented here. That reuses KMO-8 whole, and it means the app never holds anything
 * it could compare a typed password against. It is not sign-out: KMO-12's Cerrar
 * sesión revokes the token server-side, and this deliberately does not, because the
 * employee is not leaving — they are coming back in the other way.
 */
export function LockScreen() {
  const { available, unlock } = useLock();
  const { signOut } = useSession();

  const [notice, setNotice] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);

  // One prompt at a time. Two overlapping `authenticateAsync` calls cancel each
  // other on Android, which would read to the employee as a sensor that refuses
  // them — and the two triggers below can otherwise fire together on a cold start.
  const inFlight = useRef(false);

  const attempt = useCallback(async () => {
    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setPrompting(true);
    setNotice(null);

    const outcome = await unlock();

    inFlight.current = false;
    setPrompting(false);
    setNotice(noticeFor(outcome));

    // Nothing on success: `unlock` cleared the lock and the navigator takes this
    // screen out of the stack on its own.
  }, [unlock]);

  const onUnlock = () => {
    void attempt();
  };

  useEffect(() => {
    if (!available) {
      return;
    }

    // Tied to the app becoming active rather than to this screen mounting. The
    // lock latches when the app is sent to the background, so a prompt raised at
    // mount would be raised at a phone the employee is no longer looking at — and
    // on Android it would be gone, cancelled by the OS, before they came back.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        void attempt();
      }
    });

    // The cold-start case, where the app is already foregrounded and no transition
    // is coming. Written as "not backgrounded" rather than "active" on purpose:
    // `currentState` is `inactive` on iOS during the launch animation and is not
    // reported at all under Jest, and the cost of being wrong here is one prompt
    // the employee was about to ask for anyway.
    if (AppState.currentState !== 'background') {
      void attempt();
    }

    return () => subscription.remove();
  }, [attempt, available]);

  return (
    <Screen testID="lock-screen">
      <View style={styles.intro}>
        <Text style={styles.heading}>{es.security.lock.title}</Text>
        <Text style={styles.body}>
          {available ? es.security.lock.body : es.permissions.biometrics.unavailable}
        </Text>
      </View>

      <View style={styles.actions}>
        {notice === null ? null : (
          <View accessibilityLiveRegion="polite" style={styles.notice} testID="lock-notice">
            <Text style={styles.noticeMessage}>{notice}</Text>
          </View>
        )}

        {/* Hidden when the phone has no enrolled biometric left — an employee who
            removed their fingerprint after enabling this would otherwise be offered
            a button that cannot succeed. The password route below is still open. */}
        {available ? (
          <Button
            label={es.security.lock.unlock}
            loading={prompting}
            onPress={onUnlock}
            testID="lock-unlock"
          />
        ) : null}

        <Button
          label={es.security.lock.usePassword}
          onPress={() => {
            void signOut();
          }}
          testID="lock-password"
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

/**
 * A dismissed prompt is not a rejection, so it does not get the sentence that
 * starts with "No pudimos reconocerte" — an employee who tapped Cancelar knows
 * why nothing happened and telling them they were not recognised is both wrong
 * and alarming.
 */
function noticeFor(outcome: BiometricOutcome): string | null {
  switch (outcome) {
    case 'success':
      return null;
    case 'cancelled':
      return es.security.lock.cancelled;
    case 'unavailable':
      return es.permissions.biometrics.unavailable;
    case 'failed':
      return es.security.lock.failed;
  }
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
  body: {
    ...typography.bodyLg,
    color: colors.textBody,
  },
  actions: {
    gap: spacing[4],
  },
  notice: {
    borderRadius: radius.md,
    backgroundColor: tones.warning.background,
    padding: spacing[4],
  },
  noticeMessage: {
    ...typography.body,
    color: tones.warning.foreground,
  },
});
