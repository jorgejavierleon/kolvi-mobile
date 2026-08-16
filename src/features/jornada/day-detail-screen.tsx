import { StyleSheet, Text, View } from 'react-native';

import type { NaiveDate } from '@/api';
import { es, formatClockTime } from '@/i18n';
import { colors, spacing, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Skeleton } from '@/ui/skeleton';
import { StatusBadge } from '@/ui/status-badge';

import { AttendanceStrip } from './attendance-strip';
import type { DayDetailApi } from './day-detail-api';
import { KpiTiles } from './kpi-tiles';
import type { PunchReceiptApi } from './punch-receipt-api';
import { PunchReceiptSheet } from './punch-receipt-sheet';
import { useDayDetail } from './use-day-detail';
import { usePunchReceipt } from './use-punch-receipt';

export type DayDetailScreenProps = {
  date: NaiveDate;
  /** Injected in tests; the app uses the configured clients. */
  dayDetailApi?: DayDetailApi;
  punchReceiptApi?: PunchReceiptApi;
};

/**
 * The day-detail screen a Historial row opens (KMO-34), replacing the
 * `DayDetailPlaceholder` sheet KMO-33 left in its place: the status badge,
 * the four KPI tiles, the attendance strip, or the leave-day treatment in
 * place of both (#7).
 */
export function DayDetailScreen({ date, dayDetailApi, punchReceiptApi }: DayDetailScreenProps) {
  const day = useDayDetail(date, dayDetailApi);
  const punch = usePunchReceipt(punchReceiptApi);

  if (day.status === 'loading') {
    return <DayDetailSkeleton />;
  }

  if (day.status === 'failed') {
    return <LoadFailure onRetry={day.reload} retrying={day.retrying} />;
  }

  const { detail } = day;

  return (
    <View style={styles.container}>
      {detail.statusLabel === null || detail.statusTone === null ? null : (
        <StatusBadge label={detail.statusLabel} tone={detail.statusTone} />
      )}

      {detail.leaveTypeLabel === null ? (
        <>
          <KpiTiles
            workedTime={detail.workedTime}
            extraTime={detail.extraTime}
            missingTime={detail.missingTime}
            markInTime={detail.markIn === null ? null : formatClockTime(detail.markIn.time)}
            markOutTime={detail.markOut === null ? null : formatClockTime(detail.markOut.time)}
          />

          <AttendanceStrip
            shiftStart={detail.shiftStart}
            shiftEnd={detail.shiftEnd}
            markIn={detail.markIn}
            markOut={detail.markOut}
            statusTone={detail.statusTone}
            onPressMarkIn={() => detail.markIn !== null && punch.open(detail.markIn.markId)}
            onPressMarkOut={() => detail.markOut !== null && punch.open(detail.markOut.markId)}
          />
        </>
      ) : (
        <Card style={styles.leaveCard} testID="day-detail-leave">
          <Text style={styles.leaveEyebrow}>{es.jornada.dayDetail.leave}</Text>
          <Text style={styles.leaveValue}>{detail.leaveTypeLabel}</Text>
        </Card>
      )}

      <PunchReceiptSheet load={punch.load} onDismiss={punch.dismiss} onRetry={punch.retry} />
    </View>
  );
}

function LoadFailure({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <Card testID="day-detail-load-failed">
      <View accessibilityLiveRegion="polite" style={styles.failure}>
        <Text style={styles.failureMessage}>{es.jornada.loadFailed}</Text>

        <Button
          label={es.actions.retry}
          loading={retrying}
          onPress={onRetry}
          size="sm"
          testID="day-detail-retry"
          variant="secondary"
        />
      </View>
    </Card>
  );
}

function DayDetailSkeleton() {
  return (
    <View accessible accessibilityLabel={es.states.loading} testID="day-detail-skeleton">
      <Skeleton height={24} width="30%" style={styles.skeletonBadge} />
      <Skeleton height={160} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing[3],
  },
  leaveCard: {
    gap: spacing[1],
  },
  leaveEyebrow: {
    ...typography.eyebrow,
    color: colors.textMuted,
  },
  leaveValue: {
    ...typography.h3,
    color: colors.textHeading,
  },
  failure: {
    alignItems: 'flex-start',
    gap: spacing[3],
  },
  failureMessage: {
    ...typography.body,
    color: colors.textBody,
  },
  skeletonBadge: {
    marginBottom: spacing[4],
    borderRadius: 999,
  },
});
