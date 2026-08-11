import { router } from 'expo-router';

import { es } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';
import { SectionScaffold } from '@/ui/section-scaffold';

/**
 * Mis datos, reached from Mi perfil's menu (KMO-25 #4). KMO-26 builds the
 * read-only profile detail and its editable subset; until then the row still
 * has to go somewhere, so it opens the same temporary body the tabs carried
 * before KMO-15/32/39/42 built theirs.
 */
export default function MisDatosScreen() {
  return (
    <Screen
      bottomInset
      header={
        <OverlayHeader
          title={es.profile.menu.myData.action}
          backLabel={es.profile.menu.myData.back}
          onBack={() => router.back()}
        />
      }
    >
      <SectionScaffold section={es.profile.menu.myData.action} />
    </Screen>
  );
}
