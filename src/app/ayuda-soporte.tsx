import { router } from 'expo-router';

import { es } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';
import { SectionScaffold } from '@/ui/section-scaffold';

/**
 * Ayuda y soporte, reached from Mi perfil's menu (KMO-25 #4). KMO-27 builds
 * the Spanish help content Res. 38 Art. 5 requires; until then the row still
 * has to go somewhere, so it opens the same temporary body the tabs carried
 * before KMO-15/32/39/42 built theirs.
 */
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
      <SectionScaffold section={es.profile.menu.helpSupport.action} />
    </Screen>
  );
}
