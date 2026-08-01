import { router } from 'expo-router';

import { es } from '@/i18n';
import { Screen } from '@/ui/screen';
import { ScreenHeader } from '@/ui/screen-header';
import { SectionScaffold } from '@/ui/section-scaffold';

/**
 * Permisos. KMO-39 and KMO-40 add the Mis solicitudes / Calendario sub-tabs and
 * KMO-41 the request wizard.
 */
export default function PermisosTab() {
  return (
    <Screen>
      <ScreenHeader
        title={es.headers.permisos}
        avatarLabel={es.profile.open}
        onPressAvatar={() => router.push('/perfil')}
      />
      <SectionScaffold section={es.tabs.permisos} />
    </Screen>
  );
}
