import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { es } from '@/i18n';
import { colors, typography } from '@/theme';
import { Card } from '@/ui/card';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';

/**
 * Notificaciones, reached from Mi perfil's menu (KMO-25 #4, #5).
 *
 * A specific placeholder rather than `SectionScaffold`'s generic one: the
 * criterion asks for a sentence naming *why* there is nothing here yet — push
 * notifications have to exist before a preference toggle means anything — and
 * KMO-38 replaces this with the real per-category switches once KMO-37 lands
 * the notification handling underneath them.
 */
export default function NotificacionesScreen() {
  return (
    <Screen
      bottomInset
      header={
        <OverlayHeader
          title={es.profile.menu.notifications.action}
          backLabel={es.profile.menu.notifications.back}
          onBack={() => router.back()}
        />
      }
    >
      <Card>
        <Text style={styles.placeholder}>{es.profile.menu.notifications.placeholder}</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    ...typography.body,
    color: colors.textBody,
  },
});
