import { router } from 'expo-router';

import { es } from '@/i18n';
import { Screen } from '@/ui/screen';
import { ScreenHeader } from '@/ui/screen-header';
import { SectionScaffold } from '@/ui/section-scaffold';

/**
 * Inicio. KMO-15 replaces the body with the greeting, the shift card, the clock
 * and the week summary — and the header with the design's date-and-`Hola`
 * variant, which needs a session to read a name from.
 */
export default function InicioTab() {
  return (
    <Screen>
      <ScreenHeader
        title={es.headers.inicio}
        avatarLabel={es.profile.open}
        onPressAvatar={() => router.push('/perfil')}
      />
      <SectionScaffold section={es.tabs.inicio} />
    </Screen>
  );
}
