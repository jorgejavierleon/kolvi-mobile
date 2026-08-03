import { router } from 'expo-router';

import { SignOut } from '@/features/auth/sign-out';
import { UnlockSetting } from '@/features/auth/unlock-setting';
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
 *
 * `UnlockSetting` and `SignOut` sit above the scaffold rather than inside the menu
 * KMO-25 has not built yet: KMO-10 #5 needs the biometric switch reachable from the
 * profile and KMO-12 needs Cerrar sesión, and building KMO-25's four-row card early
 * to hold them would put that task's design decisions in these ones' commits.
 *
 * `SignOut` takes the count of punches this phone has not synced, which is zero
 * because there is no queue yet — KMO-22 and KMO-23 build the one this reads from,
 * and passing it here is what keeps `features/auth` from importing `features/marcaje`.
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
      <UnlockSetting />
      <SignOut />
      <SectionScaffold section={es.profile.title} />
    </Screen>
  );
}
