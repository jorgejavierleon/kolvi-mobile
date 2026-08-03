import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BiometricOffer } from '@/features/auth/biometric-offer';
import { LockProvider, useLock } from '@/features/auth/lock';
import { SessionProvider, useSession } from '@/features/auth/session';
import { colors, useKolviFonts } from '@/theme';

// Held up until the bundled fonts are ready, so the first frame is already in Sora
// and Plus Jakarta Sans instead of flashing the system font and reflowing.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const fontsReady = useKolviFonts();

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        {/* Inside the session, because the lock is a gate in front of one rather
            than a part of one: it reads `status` to know whether there is anything
            to protect, and clears itself when there stops being. */}
        <LockProvider>
          <RootNavigator />
          {/* A sibling of the navigator rather than a child of it: the sheet is a
              Modal, and the only thing it needs is to be inside the lock. */}
          <BiometricOffer />
        </LockProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

/**
 * Which half of the app exists right now.
 *
 * `Stack.Protected` takes the screens behind a false guard out of the navigator
 * rather than redirecting away from them, so there is no frame in which a signed-out
 * employee is on a tab, and no back gesture from Marcaje to the login screen after
 * signing in.
 */
function RootNavigator() {
  const { status } = useSession();
  const { locked } = useLock();

  const signedIn = status === 'signedIn';

  // The splash stays up for the token lookup as well as the fonts: hiding it
  // earlier would show the login screen for a frame to an employee who turns out
  // to be signed in already. `LockProvider` renders nothing until the unlock
  // preference has been read too, so reaching this component at all means both
  // questions are already answered.
  useEffect(() => {
    if (status !== 'restoring') {
      void SplashScreen.hideAsync();
    }
  }, [status]);

  if (status === 'restoring') {
    return null;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surfacePage },
      }}
    >
      <Stack.Protected guard={signedIn && !locked}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="perfil" />
        <Stack.Screen name="cambiar-contrasena" />
      </Stack.Protected>

      {/* Not `!signedIn`: an employee behind the lock is signed in, and the way
          past it is a biometric or the login screen the button there sends them
          to — never a back gesture onto a tab. */}
      <Stack.Protected guard={signedIn && locked}>
        <Stack.Screen name="bloqueo" options={{ gestureEnabled: false }} />
      </Stack.Protected>

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
