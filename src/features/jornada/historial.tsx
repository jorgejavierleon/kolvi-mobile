import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, formatShortDate } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

import type { NaiveDate } from '@/api';

import { DayDetailPlaceholder } from './day-detail-placeholder';
import { HistoryDayRow } from './history-day-row';
import type { WorkdaysApi } from './workdays-api';
import { useWorkdays } from './use-workdays';

export type HistorialProps = {
  /** Injected in tests; the app uses the configured client. */
  api?: WorkdaysApi;
};

/**
 * Jornada's Historial segment (KMO-33): the employee's own workdays, newest
 * first, paged back a month at a time.
 *
 * Composed the same way `Proximos` composes its own load — a skeleton on
 * first load, whatever was already on screen kept through a retry, and a
 * failed load turned into a retry rather than a blank segment. `loadOlderMonth`
 * is its own addition and fails independently: a page-back that does not
 * arrive leaves every month already loaded exactly where it was (#6).
 */
export function Historial({ api }: HistorialProps) {
  const workdays = useWorkdays(api);
  const [openDay, setOpenDay] = useState<NaiveDate | null>(null);

  return (
    <View style={styles.container}>
      {workdays.status === 'loading' ? <HistorialSkeleton /> : null}

      {workdays.status === 'failed' ? (
        <LoadFailure onRetry={workdays.reload} retrying={workdays.retrying} />
      ) : null}

      {workdays.status === 'loaded' ? (
        <>
          {workdays.workdays.length === 0 ? (
            <Card testID="historial-empty">
              <Text style={styles.empty}>{es.jornada.historial.empty}</Text>
            </Card>
          ) : (
            workdays.workdays.map((day) => (
              <HistoryDayRow
                key={day.date}
                dateLabel={formatShortDate(day.date)}
                statusLabel={day.statusLabel}
                statusTone={day.statusTone}
                workedTime={day.workedTime}
                extraTime={day.extraTime}
                missingTime={day.missingTime}
                leaveTypeLabel={day.leaveTypeLabel}
                onPress={() => setOpenDay(day.date)}
              />
            ))
          )}

          <LoadOlderMonth
            onPress={workdays.loadOlderMonth}
            loading={workdays.loadingMore}
            failed={workdays.loadMoreFailed}
          />
        </>
      ) : null}

      <DayDetailPlaceholder visible={openDay !== null} onDismiss={() => setOpenDay(null)} />
    </View>
  );
}

function LoadOlderMonth({
  onPress,
  loading,
  failed,
}: {
  onPress: () => void;
  loading: boolean;
  failed: boolean;
}) {
  return (
    <View style={styles.loadMore}>
      {failed ? (
        <Text style={styles.loadMoreFailed}>{es.jornada.historial.loadOlderMonthFailed}</Text>
      ) : null}

      <Button
        label={es.jornada.historial.loadOlderMonth}
        loading={loading}
        onPress={onPress}
        size="sm"
        testID="historial-load-older"
        variant="secondary"
      />
    </View>
  );
}

function LoadFailure({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <Card testID="historial-load-failed">
      <View accessibilityLiveRegion="polite" style={styles.failure}>
        <Text style={styles.failureMessage}>{es.jornada.loadFailed}</Text>

        <Button
          label={es.actions.retry}
          loading={retrying}
          onPress={onRetry}
          size="sm"
          testID="historial-retry"
          variant="secondary"
        />
      </View>
    </Card>
  );
}

function HistorialSkeleton() {
  return (
    <View accessible accessibilityLabel={es.states.loading} testID="historial-skeleton">
      <Skeleton height={96} style={styles.skeletonCard} />
      <Skeleton height={96} style={styles.skeletonCard} />
      <Skeleton height={96} style={styles.skeletonCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  empty: {
    ...typography.body,
    color: colors.textBody,
  },
  failure: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  failureMessage: {
    ...typography.body,
    color: colors.textBody,
  },
  loadMore: {
    alignItems: 'flex-start',
    gap: spacing[2],
    marginTop: spacing[1],
  },
  loadMoreFailed: {
    ...typography.caption,
    color: colors.textMuted,
  },
  skeletonCard: {
    marginBottom: spacing[3],
  },
});
