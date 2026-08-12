import { router } from 'expo-router';

import { useSession } from '@/features/auth/session';
import { ProfileDetail } from '@/features/profile/profile-detail';
import { es } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';

/**
 * Mis datos, reached from Mi perfil's menu (KMO-25 #4). Read-only (KMO-51) —
 * docs/design-decisions.md §9 reversed KMO-26's editable subset, so this is
 * the record and nothing else.
 */
export default function MisDatosScreen() {
  const { user } = useSession();

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
      {/* Always present in practice — this route only exists behind the
          signed-in guard — but `user` is nullable on the session type itself,
          same as perfil.tsx. */}
      {user === null ? null : <ProfileDetail user={user} />}
    </Screen>
  );
}
