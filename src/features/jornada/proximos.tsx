import { StyleSheet, Text, View } from 'react-native';

import { daysBetween, es, formatClockTime, formatShortDate, timeRange } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';

import type { NaiveDate } from '@/api';

import type { ScheduledDay, UpcomingShiftsApi } from './shifts-api';
import { TodayShiftCard } from './today-shift-card';
import { UpcomingShiftRow } from './upcoming-shift-row';
import { useUpcomingShifts } from './use-upcoming-shifts';

export type ProximosProps = {
  /** Injected in tests; the app uses the configured client. */
  api?: UpcomingShiftsApi;
};

/**
 * Jornada's Próximos segment (KMO-32): today's shift, highlighted, then the
 * schedule for the days after it.
 *
 * Composed the same way `HomeScreen` composes `/me/today`'s three load
 * states — a skeleton on first load, whatever was already on screen kept
 * through a retry, and a failed load turned into a retry rather than a blank
 * segment.
 */
export function Proximos({ api }: ProximosProps) {
  const upcoming = useUpcomingShifts(api);

  return (
    <View style={styles.container}>
      {upcoming.status === 'loading' ? <ProximosSkeleton /> : null}

      {upcoming.status === 'failed' ? (
        <LoadFailure onRetry={upcoming.reload} retrying={upcoming.retrying} />
      ) : null}

      {upcoming.status === 'loaded' ? (
        <>
          <TodayShiftCard shift={upcoming.shifts.today} />

          {upcoming.shifts.days.map((day) => (
            <UpcomingShiftRow
              key={day.date}
              dateLabel={dateLabelFor(upcoming.shifts.date, day)}
              premise={day.premise}
              trailing={trailingFor(day)}
            />
          ))}
        </>
      ) : null}
    </View>
  );
}

/**
 * "Mañana" only for the row whose date is literally one calendar day after
 * today — `daysBetween`, not row order, since the first row after a free
 * weekend is Monday, not tomorrow.
 */
function dateLabelFor(today: NaiveDate, day: ScheduledDay): string {
  const short = formatShortDate(day.date);

  return daysBetween(today, day.date) === 1 ? `${es.jornada.tomorrow} · ${short}` : short;
}

/** The time window, or whatever replaced it (KMO-32 #4, #5). */
function trailingFor(day: ScheduledDay): string {
  if (day.leaveTypeLabel !== null) {
    return day.leaveTypeLabel;
  }

  if (day.holidayName !== null) {
    return day.holidayName;
  }

  // Guaranteed paired by the wire contract — an annotated date never carries
  // one time without the other, and an ordinary date never carries neither.
  return day.startTime === null || day.endTime === null
    ? ''
    : timeRange(formatClockTime(day.startTime), formatClockTime(day.endTime));
}

function LoadFailure({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <Card testID="proximos-load-failed">
      <View accessibilityLiveRegion="polite" style={styles.failure}>
        <Text style={styles.failureMessage}>{es.jornada.loadFailed}</Text>

        <Button
          label={es.actions.retry}
          loading={retrying}
          onPress={onRetry}
          size="sm"
          testID="proximos-retry"
          variant="secondary"
        />
      </View>
    </Card>
  );
}

function ProximosSkeleton() {
  return (
    <View accessible accessibilityLabel={es.states.loading} testID="proximos-skeleton">
      <Skeleton height={88} style={styles.skeletonCard} />
      <Skeleton height={64} style={styles.skeletonCard} />
      <Skeleton height={64} style={styles.skeletonCard} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  failure: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  failureMessage: {
    ...typography.body,
    color: colors.textBody,
  },
  skeletonCard: {
    marginBottom: spacing[3],
  },
});
