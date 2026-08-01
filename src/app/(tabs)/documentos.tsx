import { router } from 'expo-router';

import { es } from '@/i18n';
import { Screen } from '@/ui/screen';
import { ScreenHeader } from '@/ui/screen-header';
import { SectionScaffold } from '@/ui/section-scaffold';

/**
 * Documentos. KMO-42 adds the list and the pending-signature count this tab's
 * badge reads from; KMO-43 to KMO-46 the reader, signing and rejection.
 */
export default function DocumentosTab() {
  return (
    <Screen>
      <ScreenHeader
        title={es.headers.documentos}
        avatarLabel={es.profile.open}
        onPressAvatar={() => router.push('/perfil')}
      />
      <SectionScaffold section={es.tabs.documentos} />
    </Screen>
  );
}
