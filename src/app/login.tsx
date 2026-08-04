import { router } from 'expo-router';

import { LoginScreen } from '@/features/auth/login-screen';

/**
 * `/login`. The route exists so the navigator has something to protect; the screen
 * itself lives in the feature, where it can be rendered by a test without a router.
 *
 * The navigation is handed in rather than reached for inside the feature: nothing
 * under `src/features` imports `expo-router`, and the forgot-password link (KMO-14
 * #1) is not the place to start.
 */
export default function LoginRoute() {
  return <LoginScreen onForgotPassword={() => router.push('/recuperar-contrasena')} />;
}
