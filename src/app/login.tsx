import { LoginScreen } from '@/features/auth/login-screen';

/**
 * `/login`. The route exists so the navigator has something to protect; the screen
 * itself lives in the feature, where it can be rendered by a test without a router.
 */
export default LoginScreen;
