import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors, useKolviFonts } from '@/theme';

// Held up until the bundled fonts are ready, so the first frame is already in Sora
// and Plus Jakarta Sans instead of flashing the system font and reflowing.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const fontsReady = useKolviFonts();

  useEffect(() => {
    if (fontsReady) {
      void SplashScreen.hideAsync();
    }
  }, [fontsReady]);

  if (!fontsReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surfacePage },
        }}
      />
    </SafeAreaProvider>
  );
}
