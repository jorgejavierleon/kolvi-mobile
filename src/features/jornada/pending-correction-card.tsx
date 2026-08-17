import { StyleSheet, Text, View } from 'react-native';

import {
  compareNaiveDateTime,
  dateOf,
  formatNaiveDate,
  formatNaiveDateTime,
  type NaiveDateTime,
} from '@/api';
import { correctionExpiryLabel, correctionSubtitle, daysBetween, es } from '@/i18n';
import { colors, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { ArrowRightIcon } from '@/ui/icons';

import type { PendingCorrection } from './corrections-api';

export type PendingCorrectionCardProps = {
  correction: PendingCorrection;
  onApprove: () => void;
  onDecline: () => void;
  /** An approve/decline request is in flight for this correction. */
  reviewing: boolean;
  /** The most recent approve/decline failure, if any — kept on the card rather than a toast. */
  error: unknown;
  /** Injected in tests; the app uses the real clock. */
  now?: () => Date;
};

/**
 * One admin-requested correction on the Jornada tab (KMO-35): original vs.
 * proposed time, the reason and requester, an expiry countdown, and
 * Aprobar/Rechazar. The card computes its own `isExpired` from `expiresAt`
 * rather than trusting a `pending` list to have dropped a stale row — the
 * server's sweep that consolidates an unopposed request runs on a 10-minute
 * schedule (docs/design-decisions.md §6), so a row already past its window
 * can still be on screen for a few minutes. Disabling the actions here is the
 * client half of "an expired correction cannot be acted on"; `isActionable()`
 * on the server is the half that actually enforces it.
 */
export function PendingCorrectionCard({
  correction,
  onApprove,
  onDecline,
  reviewing,
  error,
  now = () => new Date(),
}: PendingCorrectionCardProps) {
  const clock = now();
  const expired = hasExpired(correction.expiresAt, clock);
  const daysRemaining = daysBetween(todayOf(clock), dateOf(correction.expiresAt));

  const subtitle = correctionSubtitle(correction.reason, correction.requestedBy);

  return (
    <Card testID={`pending-correction-${correction.id}`} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{es.jornada.corrections.title}</Text>
        <Text style={styles.expiry}>
          {expired ? es.jornada.corrections.expired : correctionExpiryLabel(daysRemaining)}
        </Text>
      </View>

      <View style={styles.times}>
        <View>
          <Text style={styles.timeLabel}>{es.jornada.corrections.currentTime}</Text>
          <Text style={styles.currentTime}>
            {correction.originalTime ?? es.jornada.corrections.noCurrentTime}
          </Text>
        </View>

        <ArrowRightIcon color={colors.textMuted} size={16} />

        <View>
          <Text style={styles.timeLabel}>{es.jornada.corrections.proposedTime}</Text>
          <Text style={styles.proposedTime}>{correction.proposedTime}</Text>
        </View>
      </View>

      {subtitle === null ? null : <Text style={styles.subtitle}>{subtitle}</Text>}

      {error === undefined || error === null ? null : (
        <Text style={styles.error}>{es.jornada.corrections.reviewFailed}</Text>
      )}

      <View style={styles.actions}>
        <Button
          label={es.jornada.corrections.decline}
          onPress={onDecline}
          variant="danger"
          size="sm"
          disabled={expired}
          loading={reviewing}
          style={styles.action}
          testID={`pending-correction-${correction.id}-decline`}
        />
        <Button
          label={es.jornada.corrections.approve}
          onPress={onApprove}
          variant="successSolid"
          size="sm"
          disabled={expired}
          loading={reviewing}
          style={styles.action}
          testID={`pending-correction-${correction.id}-approve`}
        />
      </View>
    </Card>
  );
}

function hasExpired(expiresAt: NaiveDateTime, now: Date): boolean {
  return compareNaiveDateTime(nowNaive(now), expiresAt) >= 0;
}

function nowNaive(now: Date): NaiveDateTime {
  return formatNaiveDateTime({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
    hour: now.getHours(),
    minute: now.getMinutes(),
    second: now.getSeconds(),
  });
}

function todayOf(now: Date) {
  return formatNaiveDate({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  });
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 2,
    borderColor: tones.warning.foreground,
    gap: spacing[3],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing[3],
  },
  title: {
    ...typography.label,
    color: colors.textHeading,
    flexShrink: 1,
  },
  expiry: {
    ...typography.eyebrow,
    color: tones.warning.foreground,
  },
  times: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[4],
  },
  timeLabel: {
    ...typography.eyebrow,
    color: colors.textMuted,
  },
  currentTime: {
    ...typography.h3,
    color: colors.textHeading,
  },
  proposedTime: {
    ...typography.h3,
    color: colors.primary,
  },
  subtitle: {
    ...typography.caption,
    color: colors.slate,
  },
  error: {
    ...typography.caption,
    color: tones.danger.foreground,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing[3],
  },
  action: {
    flex: 1,
  },
});
