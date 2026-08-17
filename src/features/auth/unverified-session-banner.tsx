import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { es } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { WifiOffIcon } from '@/ui/icons';

import { useSession } from './session';

/**
 * "We could not confirm your session" — the tab-shell strip for docs/design-
 * decisions.md §4.7 D2 (KMO-49 #3).
 *
 * Composed once, above the tab navigator (`src/app/(tabs)/_layout.tsx`) rather
 * than owned by any one screen: it is a fact about the session, true on every
 * tab at once, the same reasoning that puts `PendingSyncBanner` on Inicio
 * because a queued punch is a fact about the phone. `useSession` is imported
 * directly rather than threaded down, matching how the tab bar already reads
 * it for the corrections badge.
 *
 * **Neutral, not warning.** An unverified session is not yet a problem the way
 * an unsynced punch is — it clears the moment a reconfirm lands, and most
 * never notice it at all. And it renders only for `verified: false`, which
 * `session.tsx` sets only when a cold start could not reach the server; an
 * ordinary mid-session signal drop never touches it, so a lift blocking
 * reception for ninety seconds is not this banner's business.
 */
export function UnverifiedSessionBanner() {
  const { status, verified } = useSession();

  if (status !== 'signedIn' || verified) {
    return null;
  }

  return (
    // Its own top inset: this sits above the tab navigator, outside every
    // screen's own `Screen`/`SafeAreaView`, and only when it actually draws —
    // a verified session (nearly always) leaves no dead space behind for it.
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View
        accessible
        accessibilityLiveRegion="polite"
        style={styles.banner}
        testID="unverified-session-banner"
      >
        <WifiOffIcon color={tones.neutral.foreground} size={iconSize} />
        <Text style={styles.message}>{es.auth.unverifiedSession}</Text>
      </View>
    </SafeAreaView>
  );
}

const iconSize = 18;

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.surfacePage,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2] + 2,
    backgroundColor: tones.neutral.background,
    borderRadius: radius.md,
    paddingVertical: spacing[2],
    paddingHorizontal: spacing[3],
    marginHorizontal: spacing[4],
    marginTop: spacing[2],
  },
  message: {
    ...typography.caption,
    color: tones.neutral.foreground,
    flex: 1,
  },
});
