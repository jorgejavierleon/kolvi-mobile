import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { useSession } from '@/features/auth/session';
import { SignOut } from '@/features/auth/sign-out';
import { UnlockSetting } from '@/features/auth/unlock-setting';
import { punchQueue, usePunchQueue } from '@/features/marcaje/punch-queue';
import { IdentityHeader } from '@/features/profile/identity-header';
import { es } from '@/i18n';
import { spacing } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ListRow } from '@/ui/list-row';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';

/**
 * Mi perfil. On the root stack rather than inside the tabs, which is what makes
 * it cover the tab bar: the design draws it as `inset:0` over whichever tab the
 * employee was on, and it opens from all four.
 *
 * The four-row menu (KMO-25 #3, #4) is Mis datos, Notificaciones and Ayuda y
 * soporte — three bare `ListRow`s that push their own route, KMO-51/27/38's to
 * fill in — plus `SignOut` as the card's own last row, in the danger tone the
 * design draws it in.
 *
 * `UnlockSetting` and Cambiar contraseña stay outside that card, exactly where
 * KMO-10 and KMO-13 put them: the design's four-row menu is only the items
 * above, and folding the biometric switch or the password screen's link into it
 * would be a menu the design does not draw.
 */
export default function ProfileScreen() {
  const { user } = useSession();
  // §4.7 D5 — a shared device's leftover rows from a previous sign-in must
  // never count toward this employee's pending-punches warning.
  const { count: pendingPunches } = usePunchQueue(punchQueue, user?.id ?? -1);

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
      {/* Always present in practice — this route only exists behind the
          signed-in guard in `_layout.tsx` — but `user` is nullable on the
          session type itself, and a header with nobody to name is not a state
          worth drawing. */}
      {user === null ? null : <IdentityHeader user={user} />}

      <Card padded={false} testID="profile-menu">
        <ListRow
          accessibilityLabel={es.profile.menu.myData.action}
          onPress={() => router.push('/mis-datos')}
          style={styles.menuRow}
          testID="profile-menu-mis-datos"
          title={es.profile.menu.myData.action}
        />
        <ListRow
          accessibilityLabel={es.profile.menu.notifications.action}
          onPress={() => router.push('/notificaciones')}
          style={styles.menuRow}
          testID="profile-menu-notificaciones"
          title={es.profile.menu.notifications.action}
        />
        <ListRow
          accessibilityLabel={es.profile.menu.helpSupport.action}
          onPress={() => router.push('/ayuda-soporte')}
          style={styles.menuRow}
          testID="profile-menu-ayuda-soporte"
          title={es.profile.menu.helpSupport.action}
        />
        <SignOut pendingPunches={pendingPunches} />
      </Card>

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
    </Screen>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing[4],
  },
  // `profile-menu` drops Card's own padding for the full-bleed dividers
  // between rows (see Card's own docs), which otherwise leaves each row's
  // text flush against the card edge. This restores Card's usual inset on
  // the row's content without touching the divider, which is a border and
  // unaffected by padding.
  menuRow: {
    paddingHorizontal: spacing[4],
  },
});
