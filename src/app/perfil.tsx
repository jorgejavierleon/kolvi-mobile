import { router } from 'expo-router';

import { es } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';
import { SectionScaffold } from '@/ui/section-scaffold';

/**
 * Mi perfil. On the root stack rather than inside the tabs, which is what makes
 * it cover the tab bar: the design draws it as `inset:0` over whichever tab the
 * employee was on, and it opens from all four.
 *
 * KMO-25 fills in the avatar, the name and the menu — Mis datos, Notificaciones,
 * Ayuda y soporte, Cerrar sesión — each of which is its own task.
 */
export default function ProfileScreen() {
  return (
    <Screen
      bottomInset
      header={
        <OverlayHeader
          title={es.profile.title}
          backLabel={es.profile.back}
          onBack={() => router.back()}
        />
      }
    >
      <SectionScaffold section={es.profile.title} />
    </Screen>
  );
}
