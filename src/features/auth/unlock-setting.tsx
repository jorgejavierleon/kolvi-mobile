import { useRef, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { es } from '@/i18n';
import { colors, spacing, tones, typography } from '@/theme';
import { Card } from '@/ui/card';

import { useLock } from './lock';

/**
 * The Seguridad row on Mi perfil: the switch that turns biometric unlock off
 * again (#5).
 *
 * Turning it off writes the preference and does nothing else. It does not clear the
 * token, does not touch the session and does not return the employee to the login
 * screen — the lock is a gate in front of a session, and removing a gate is not the
 * same as ending what is behind it.
 *
 * A phone with no enrolled biometric renders the explanation and no switch: #4 asks
 * that the option not be offered, and a disabled control that cannot be explained is
 * still an offer. It says why rather than hiding the section, so an employee who
 * heard about the feature from a colleague finds out what is missing.
 *
 * This is a self-contained card because Mi perfil is still `SectionScaffold` —
 * KMO-25 builds the real four-row menu, and folds this row into it.
 */
export function UnlockSetting() {
  const { available, preference, enable, disable } = useLock();

  const [notice, setNotice] = useState<string | null>(null);
  const inFlight = useRef(false);

  const onToggle = (next: boolean) => {
    void (async () => {
      if (inFlight.current) {
        return;
      }

      inFlight.current = true;
      setNotice(null);

      if (!next) {
        await disable();
        inFlight.current = false;

        return;
      }

      // Turning it on has to pass the prompt once. The switch snaps back on
      // anything else, because `preference` is what it renders from and only a
      // success writes it.
      const outcome = await enable();
      inFlight.current = false;

      if (outcome !== 'success') {
        setNotice(
          outcome === 'unavailable'
            ? es.permissions.biometrics.unavailable
            : es.security.lock.failed,
        );
      }
    })();
  };

  return (
    <Card testID="unlock-setting">
      <Text style={styles.section}>{es.security.unlock.section}</Text>

      <View style={styles.row}>
        <View style={styles.text}>
          <Text style={styles.label}>{es.security.unlock.label}</Text>
          <Text style={styles.description}>
            {available ? es.security.unlock.description : es.permissions.biometrics.unavailable}
          </Text>
        </View>

        {available ? (
          <Switch
            accessibilityLabel={es.security.unlock.label}
            onValueChange={onToggle}
            testID="unlock-setting-switch"
            thumbColor={colors.surfaceCard}
            trackColor={{ false: colors.border, true: colors.primary }}
            value={preference === 'enabled'}
          />
        ) : null}
      </View>

      {notice === null ? null : (
        <View accessibilityLiveRegion="polite" style={styles.notice} testID="unlock-setting-notice">
          <Text style={styles.noticeMessage}>{notice}</Text>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  section: {
    ...typography.eyebrow,
    color: colors.textMuted,
    marginBottom: spacing[3],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
    // The design's 44dp floor, which a switch on its own does not reach.
    minHeight: 44,
  },
  text: {
    flex: 1,
    gap: spacing[1],
  },
  label: {
    ...typography.h3,
    color: colors.textHeading,
  },
  description: {
    ...typography.body,
    color: colors.textBody,
  },
  notice: {
    marginTop: spacing[3],
    backgroundColor: tones.warning.background,
    padding: spacing[3],
  },
  noticeMessage: {
    ...typography.body,
    color: tones.warning.foreground,
  },
});
