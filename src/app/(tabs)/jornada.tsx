import { router } from 'expo-router';

import { es } from '@/i18n';
import { Screen } from '@/ui/screen';
import { ScreenHeader } from '@/ui/screen-header';
import { SectionScaffold } from '@/ui/section-scaffold';

/**
 * Jornada. KMO-32 and KMO-33 add the Próximos / Historial sub-tabs and KMO-35
 * the pending-correction card that puts the count on this tab's badge.
 */
export default function JornadaTab() {
  return (
    <Screen>
      <ScreenHeader
        title={es.headers.jornada}
        avatarLabel={es.profile.open}
        onPressAvatar={() => router.push('/perfil')}
      />
      <SectionScaffold section={es.tabs.jornada} />
    </Screen>
  );
}
