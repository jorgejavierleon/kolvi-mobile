import { LockScreen } from '@/features/auth/lock-screen';

/**
 * The biometric gate. A route rather than an overlay drawn over the tabs, so that
 * `Stack.Protected` in `_layout.tsx` can take the tabs *out of the navigator* while
 * it is up — the same mechanism that keeps a signed-out employee off them.
 *
 * An overlay would leave the tab mounted underneath, one dropped frame or one
 * mis-set `zIndex` away from being visible, and KMO-10 #2 is about what can be seen.
 */
export default function LockRoute() {
  return <LockScreen />;
}
