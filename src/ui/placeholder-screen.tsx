import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

/**
 * Temporary scaffolding so the app has something to render before the real
 * chrome exists. Deleted by KMO-4 (navigation shell).
 *
 * Deliberately unstyled beyond layout: the design tokens land in KMO-2 and the
 * Spanish catalogue in KMO-6, so this screen introduces no colours or strings
 * that would later need unpicking.
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
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
  },
});
