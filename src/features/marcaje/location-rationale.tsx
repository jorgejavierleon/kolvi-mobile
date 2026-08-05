import { StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';
import { Button } from '@/ui/button';

export type LocationRationaleProps = {
  visible: boolean;
  /** `Continuar` — the OS prompt is raised immediately after. */
  onAccept: () => void;
  /** `Ahora no`, the backdrop and the Android back button all land here. */
  onDismiss: () => void;
  testID?: string;
};

/**
 * Why Kolvi is about to ask for the employee's location, in Spanish, before the
 * OS asks it in its own words (KMO-16 #1).
 *
 * The order is the whole point and it is not a courtesy. Android shows the
 * system prompt once and, after a second refusal, stops showing it forever —
 * from there the only way back is a trip into system settings that most people
 * never make. A prompt that arrives with no explanation is a permission an
 * employee can lose on a reflex, and losing it means every mark they make for
 * the rest of their employment carries no location.
 *
 * So the body answers the three things worth knowing before deciding: what it is
 * read for, that it is read only while they are looking at Marcaje, and that
 * refusing does not stop them punching. The last one is true — #7 — and saying
 * it costs nothing: an employee who feels cornered into a permission is the one
 * who denies it permanently.
 */
export function LocationRationale({
  visible,
  onAccept,
  onDismiss,
  testID,
}: LocationRationaleProps) {
  // Nothing at all rather than a hidden sheet, for the reason `BiometricOffer`
  // gives: this is a `Modal`, and leaving it mounted keeps a second surface
  // alongside the one the app lives in for the whole session.
  if (!visible) {
    return null;
  }

  return (
    <BottomSheet
      dismissAccessibilityLabel={es.permissions.location.rationale.close}
      onDismiss={onDismiss}
      testID={testID}
      visible
      footer={
        <View style={styles.actions}>
          <Button
            label={es.permissions.location.rationale.allow}
            onPress={onAccept}
            testID="location-rationale-accept"
          />
          <Button
            label={es.permissions.location.rationale.dismiss}
            onPress={onDismiss}
            testID="location-rationale-dismiss"
            variant="secondary"
          />
        </View>
      }
    >
      <Text style={styles.title}>{es.permissions.location.rationale.title}</Text>
      <Text style={styles.body}>{es.permissions.location.rationale.body}</Text>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.h3,
    color: colors.textHeading,
  },
  body: {
    ...typography.bodyLg,
    color: colors.textBody,
    marginTop: spacing[3],
  },
  actions: {
    gap: spacing[2],
  },
});
