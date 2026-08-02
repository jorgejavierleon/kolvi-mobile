import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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
        <RootNavigator />
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
  const signedIn = status === 'signedIn';

  // The splash stays up for the token lookup as well as the fonts: hiding it
  // earlier would show the login screen for a frame to an employee who turns out
  // to be signed in already.
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
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="perfil" />
      </Stack.Protected>

      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
