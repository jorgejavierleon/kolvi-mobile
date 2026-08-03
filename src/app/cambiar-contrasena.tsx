import { router } from 'expo-router';

import { ChangePassword } from '@/features/auth/change-password';
import { es } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';

/**
 * Cambiar contraseña (KMO-13 #5), reached from Mi perfil.
 *
 * On the root stack rather than inside the tabs, like `perfil` itself: it is
 * opened from the profile overlay, and a screen pushed from an overlay that covers
 * the tab bar must cover it too.
 */
export default function ChangePasswordScreen() {
  return (
    <Screen
      bottomInset
      header={
        <OverlayHeader
          title={es.auth.changePassword.action}
          backLabel={es.auth.changePassword.back}
          onBack={() => router.back()}
        />
      }
    >
      {/* Back to Mi perfil rather than deeper into the app: the employee came
          from there, and the change is not a step in a longer flow. */}
      <ChangePassword onDone={() => router.back()} />
    </Screen>
  );
}
