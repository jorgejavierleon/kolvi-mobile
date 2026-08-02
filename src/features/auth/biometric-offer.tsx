import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';
import { Button } from '@/ui/button';

import { useLock } from './lock';

/**
 * The offer, made once, after the employee's first login on this phone (#1).
 *
 * Asked once rather than at every launch: `Ahora no` is recorded as an answer, not
 * as a postponement, so the third launch does not nag someone who already said no.
 * The way back is the Seguridad row on Mi perfil, which is where a setting belongs
 * anyway.
 *
 * A phone with no enrolled fingerprint or face never renders this at all —
 * `offerPending` is false without `available` — which is the first half of #4.
 *
 * The copy is the part that matters. This is a lock on the app, and the body says
 * so; it does not say the fingerprint identifies the employee, because it does not.
 * Nothing about a punch changes when this is on.
 */
export function BiometricOffer() {
  const { offerPending, enable, declineOffer } = useLock();

  const [notice, setNotice] = useState<string | null>(null);
  const [prompting, setPrompting] = useState(false);
  const inFlight = useRef(false);

  const onEnable = () => {
    void (async () => {
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      setPrompting(true);
      setNotice(null);

      const outcome = await enable();

      inFlight.current = false;
      setPrompting(false);

      // On success the preference flips and `offerPending` closes the sheet. On
      // anything else it stays open with a reason: the employee reached for this
      // deliberately, and dropping them back to the tabs with nothing said would
      // look like the button did nothing.
      if (outcome !== 'success') {
        setNotice(
          outcome === 'unavailable'
            ? es.permissions.biometrics.unavailable
            : es.security.lock.failed,
        );
      }
    })();
  };

  const onDecline = () => {
    void declineOffer();
  };

  // Nothing at all, rather than a `BottomSheet visible={false}`. The sheet is a
  // `Modal` and this renders as a sibling of the root navigator, so leaving it
  // mounted-but-hidden keeps a second Fabric surface alongside the one the whole
  // app lives in, for the entire life of a session. The offer is a
  // once-per-install event; there is no reason to carry it after it is answered.
  if (!offerPending) {
    return null;
  }

  return (
    <BottomSheet
      dismissAccessibilityLabel={es.security.offer.close}
      // The backdrop and the Android back button mean the same thing as `Ahora no`.
      // Both are recorded, so a sheet that is dismissed rather than answered still
      // counts as answered — the alternative is re-raising it at the next launch,
      // which is the nagging this is trying to avoid.
      onDismiss={onDecline}
      testID="biometric-offer"
      visible={offerPending}
      footer={
        <View style={styles.footer}>
          <Button
            label={es.security.offer.enable}
            loading={prompting}
            onPress={onEnable}
            testID="biometric-offer-enable"
          />
          <Button
            label={es.security.offer.dismiss}
            onPress={onDecline}
            testID="biometric-offer-dismiss"
            variant="secondary"
          />
        </View>
      }
    >
      <View style={styles.body}>
        <Text style={styles.title}>{es.security.offer.title}</Text>
        <Text style={styles.explanation}>{es.security.offer.body}</Text>

        {notice === null ? null : (
          <View
            accessibilityLiveRegion="polite"
            style={styles.notice}
            testID="biometric-offer-notice"
          >
            <Text style={styles.noticeMessage}>{notice}</Text>
          </View>
        )}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: {
    gap: spacing[3],
  },
  title: {
    ...typography.h2,
    color: colors.textHeading,
  },
  explanation: {
    ...typography.bodyLg,
    color: colors.textBody,
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
  footer: {
    gap: spacing[3],
  },
});
