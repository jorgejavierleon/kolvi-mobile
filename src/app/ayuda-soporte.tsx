import { router } from 'expo-router';

import { HelpSupport } from '@/features/profile/help-support';
import { es } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';

/** Ayuda y soporte, reached from Mi perfil's menu (KMO-25 #4). */
export default function AyudaSoporteScreen() {
  return (
    <Screen
      bottomInset
      header={
        <OverlayHeader
          title={es.profile.menu.helpSupport.action}
          backLabel={es.profile.menu.helpSupport.back}
          onBack={() => router.back()}
        />
      }
    >
      <HelpSupport />
    </Screen>
  );
}
