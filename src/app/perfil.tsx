import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { SignOut } from '@/features/auth/sign-out';
import { UnlockSetting } from '@/features/auth/unlock-setting';
import { es } from '@/i18n';
import { spacing } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
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
 * Cambiar contraseña sits with them for the same reason, and is a plain Card for
 * now: KMO-13 #5 needs it reachable from here, and Mi perfil has no menu to put a
 * row into yet.
 *
 * `SignOut` takes the count of punches this phone has not synced, which is zero
 * because there is no queue yet — KMO-22 and KMO-23 build the one this reads from,
 * and passing it here is what keeps `features/auth` from importing `features/marcaje`.
 */
export default function ProfileScreen() {
  return (
    <Screen
      bottomInset
      // The cards here are siblings in the scroll area rather than one composed
      // block, so nothing was separating them and they read as a single seam.
      // Set on this screen and not as a `Screen` default: every tab puts a
      // `ScreenHeader` first, which carries its own bottom margin, and a gap on
      // the container would double it there.
      contentContainerStyle={styles.stack}
      header={
        <OverlayHeader
          title={es.profile.title}
          backLabel={es.profile.back}
          onBack={() => router.back()}
        />
      }
    >
      <UnlockSetting />

      {/* KMO-13 #5. Composed here rather than in `features/auth` because it is
          navigation and nothing else — no feature in this app imports the router,
          and the screen it opens owns the whole of the change. */}
      <Card testID="change-password-link">
        <Button
          label={es.auth.changePassword.action}
          onPress={() => router.push('/cambiar-contrasena')}
          testID="change-password-open"
          variant="secondary"
        />
      </Card>

      <SignOut />
      <SectionScaffold section={es.profile.title} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing[4],
  },
});
