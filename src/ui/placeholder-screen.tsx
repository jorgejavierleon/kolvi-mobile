import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing, typography } from '@/theme';

/**
 * Temporary scaffolding so the app has something to render before the real
 * chrome exists. Deleted by KMO-4 (navigation shell).
 *
 * Styled from the tokens only — it is currently the only place the bundled
 * typefaces are visible on a device, so it doubles as the smoke test that they
 * loaded. It introduces no strings that would outlive KMO-6.
 */
export function PlaceholderScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Kolvi</Text>
        <Text style={styles.subtitle}>App de empleados</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.surfacePage,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
  },
  title: {
    ...typography.h1,
    color: colors.textHeading,
  },
  subtitle: {
    ...typography.body,
    color: colors.textMuted,
  },
});
