import { router } from 'expo-router';

import { ForgotPassword } from '@/features/auth/forgot-password';
import { es } from '@/i18n';
import { OverlayHeader } from '@/ui/overlay-header';
import { Screen } from '@/ui/screen';

/**
 * `/recuperar-contrasena` (KMO-14), reached from the link on the login screen.
 *
 * Beside `login` under the signed-out guard rather than inside it: an employee
 * here has no session, and the screen has to survive being backed out of to the
 * form they came from.
 */
export default function ForgotPasswordRoute() {
  return (
    <Screen
      bottomInset
      header={
        <OverlayHeader
          title={es.auth.forgotPassword.title}
          backLabel={es.auth.forgotPassword.back}
          onBack={() => router.back()}
        />
      }
    >
      {/* Back to the login screen either way: whether the mail was requested or
          the employee changed their mind, the next thing they do is sign in. */}
      <ForgotPassword onDone={() => router.back()} />
    </Screen>
  );
}
