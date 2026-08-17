import { StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';

import type { PendingCorrectionsApi } from './corrections-api';
import { PendingCorrectionCard } from './pending-correction-card';
import { usePendingCorrections } from './use-pending-corrections';

export type PendingCorrectionsProps = {
  /** Injected in tests; the app uses the configured client. */
  api?: PendingCorrectionsApi;
  /** Injected in tests; the app uses the real clock. */
  now?: () => Date;
};

/**
 * The pending-correction cards at the top of the Jornada tab (KMO-35),
 * visible from either sub-tab — the design's own placement, above the
 * segmented control rather than inside either segment.
 *
 * Nothing renders while loading or on an empty list: unlike Historial, a
 * skeleton for a section that is empty on every ordinary day would be a
 * near-permanent flash of placeholder above the real content. A failed load
 * does get a card — silently dropping it would recreate exactly the harm the
 * PRD raised this screen to fix, an admin-requested correction expiring
 * because the employee never saw it.
 */
export function PendingCorrections({ api, now }: PendingCorrectionsProps) {
  const corrections = usePendingCorrections(api);

  if (corrections.status === 'loading') {
    return null;
  }

  if (corrections.status === 'failed') {
    return (
      <Card testID="pending-corrections-failed" style={styles.gap}>
        <View accessibilityLiveRegion="polite" style={styles.failure}>
          <Text style={styles.failureMessage}>{es.jornada.loadFailed}</Text>

          <Button
            label={es.actions.retry}
            loading={corrections.retrying}
            onPress={corrections.reload}
            size="sm"
            testID="pending-corrections-retry"
            variant="secondary"
          />
        </View>
      </Card>
    );
  }

  if (corrections.corrections.length === 0) {
    return null;
  }

  return (
    <View style={styles.list} testID="pending-corrections">
      {corrections.corrections.map((correction) => (
        <PendingCorrectionCard
          key={correction.id}
          correction={correction}
          reviewing={corrections.reviewingIds.has(correction.id)}
          error={corrections.reviewErrors.get(correction.id) ?? null}
          onApprove={() => corrections.review(correction, 'approve')}
          onDecline={() => corrections.review(correction, 'decline')}
          now={now}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: spacing[3],
    marginBottom: spacing[3],
  },
  gap: {
    marginBottom: spacing[3],
  },
  failure: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  failureMessage: {
    ...typography.body,
    color: colors.textBody,
  },
});
