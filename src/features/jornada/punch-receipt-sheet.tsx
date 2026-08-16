import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, formatReceiptDate, formatReceiptTime, formatRut, isRut } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';
import { Button } from '@/ui/button';
import { CheckIcon } from '@/ui/icons';
import { Skeleton } from '@/ui/skeleton';

import type { PunchReceipt } from './punch-receipt-api';

/** The design's `setTimeout(… 1500)` before `Copiado` goes back to `Copiar`. */
const copiedFor = 1500;

export type PunchReceiptLoad =
  | { readonly status: 'loading' }
  | { readonly status: 'loaded'; readonly receipt: PunchReceipt }
  | { readonly status: 'failed' };

export type PunchReceiptSheetProps = {
  /** The punch to show, and how far its own fetch has gotten. `null` is the sheet closed. */
  load: PunchReceiptLoad | null;
  onDismiss: () => void;
  onRetry: () => void;
  /** Injected in tests; the app writes to the real clipboard. */
  copyToClipboard?: (text: string) => Promise<unknown>;
  testID?: string;
};

/**
 * El comprobante, opened by tapping a punch marker on the attendance strip
 * (KMO-34 #5) — a trimmed-down `features/marcaje/receipt-sheet.tsx`, and
 * deliberately so rather than imported: a feature never imports another
 * feature (README), and every mark reachable from a computed workday has, by
 * definition, already synced. So this carries only the *confirmed* half of
 * that sheet — the same Art. 13 rows, the out-of-range and captured-offline
 * notes when the mark carries them, but no `OfflineReceipt` branch, offline
 * icon or offline copy state, because there is nothing here that ever draws
 * one.
 *
 * Unlike the punch-success sheet, this one's data arrives over the network
 * after the sheet is already open (the tap opens it, the fetch follows), so
 * it carries its own loading skeleton and its own failed-plus-retry state
 * rather than assuming the receipt is always already in hand.
 */
export function PunchReceiptSheet({
  load,
  onDismiss,
  onRetry,
  copyToClipboard = Clipboard.setStringAsync,
  testID,
}: PunchReceiptSheetProps) {
  return (
    <BottomSheet
      visible={load !== null}
      onDismiss={onDismiss}
      dismissAccessibilityLabel={es.marcaje.receipt.close}
      footer={
        load?.status === 'loaded' ? (
          <Button label={es.marcaje.receipt.done} onPress={onDismiss} testID="punch-receipt-done" />
        ) : undefined
      }
      testID={testID}
    >
      {load === null ? null : (
        <Contents load={load} onRetry={onRetry} copyToClipboard={copyToClipboard} />
      )}
    </BottomSheet>
  );
}

function Contents({
  load,
  onRetry,
  copyToClipboard,
}: {
  load: PunchReceiptLoad;
  onRetry: () => void;
  copyToClipboard: (text: string) => Promise<unknown>;
}) {
  if (load.status === 'loading') {
    return (
      <View accessible accessibilityLabel={es.states.loading} testID="punch-receipt-loading">
        <Skeleton height={64} style={styles.skeletonBadge} />
        <Skeleton height={20} style={styles.skeletonLine} />
        <Skeleton height={140} />
      </View>
    );
  }

  if (load.status === 'failed') {
    return (
      <View style={styles.failure} testID="punch-receipt-failed">
        <Text style={styles.failureMessage}>{es.jornada.loadFailed}</Text>
        <Button label={es.actions.retry} onPress={onRetry} size="sm" testID="punch-receipt-retry" />
      </View>
    );
  }

  return <Body receipt={load.receipt} copyToClipboard={copyToClipboard} />;
}

function Body({
  receipt,
  copyToClipboard,
}: {
  receipt: PunchReceipt;
  copyToClipboard: (text: string) => Promise<unknown>;
}) {
  return (
    <View style={styles.body}>
      <View accessible accessibilityLiveRegion="polite" style={styles.headline}>
        <View
          style={[styles.badge, { backgroundColor: tones.success.background }]}
          testID="punch-receipt-badge"
        >
          <CheckIcon color={tones.success.foreground} size={checkSize} />
        </View>

        <Text style={styles.title}>{es.marcaje.receipt.headline}</Text>
        <Text style={styles.subtitle}>{es.marcaje.receipt.subtitle}</Text>
      </View>

      <View style={styles.details} testID="punch-receipt-details">
        <Row label={es.marcaje.receipt.type} value={es.marcaje.receipt.types[receipt.type]} />
        <Row label={es.marcaje.receipt.date} value={formatReceiptDate(receipt.datetime)} />
        <Row label={es.marcaje.receipt.time} value={formatReceiptTime(receipt.datetime)} />
        <Row label={es.marcaje.receipt.worker} value={receipt.employeeName} />
        <Row label={es.marcaje.receipt.rut} value={rutOf(receipt.employeeRut)} />
        <Row label={es.marcaje.receipt.folio} value={receipt.folio} />

        <Hash hash={receipt.hash} copyToClipboard={copyToClipboard} />

        {receipt.geoStatus === 'outside' ? (
          <Text style={styles.note} testID="punch-receipt-out-of-range">
            {es.marcaje.receipt.outOfRange}
          </Text>
        ) : null}

        {receipt.capturedOffline ? (
          <Text style={styles.provenance} testID="punch-receipt-captured-offline">
            {es.marcaje.receipt.capturedOffline}
          </Text>
        ) : null}
      </View>

      <Text style={styles.legal} testID="punch-receipt-legal">
        {es.marcaje.receipt.legal}
      </Text>
    </View>
  );
}

/** One Art. 13 row, or nothing — a `null` value renders no row, matching `receipt-sheet.tsx`'s own reasoning. */
function Row({ label, value }: { label: string; value: string | null }) {
  if (value === null) {
    return null;
  }

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Hash({
  hash,
  copyToClipboard,
}: {
  hash: string;
  copyToClipboard: (text: string) => Promise<unknown>;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
    },
    [],
  );

  const copy = useCallback(() => {
    void (async () => {
      try {
        await copyToClipboard(hash);
      } catch {
        return;
      }

      setCopied(true);
      if (timer.current !== null) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => setCopied(false), copiedFor);
    })();
  }, [copyToClipboard, hash]);

  return (
    <View style={styles.hash}>
      <Text style={styles.hashLabel}>{es.marcaje.receipt.hash}</Text>

      <View style={styles.hashRow}>
        <Text style={styles.hashValue} testID="punch-receipt-hash">
          {hash}
        </Text>

        <Button
          label={copied ? es.actions.copied : es.actions.copy}
          onPress={copy}
          size="sm"
          style={styles.copy}
          testID="punch-receipt-copy"
          variant="secondary"
        />
      </View>
    </View>
  );
}

function rutOf(rut: string | null): string | null {
  return isRut(rut) ? formatRut(rut) : null;
}

const badgeSize = 64;
const checkSize = 30;

const styles = StyleSheet.create({
  body: {
    alignItems: 'stretch',
  },
  headline: {
    alignItems: 'center',
  },
  badge: {
    width: badgeSize,
    height: badgeSize,
    borderRadius: badgeSize / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    ...typography.h2,
    color: colors.textHeading,
    textAlign: 'center',
  },
  subtitle: {
    ...typography.label,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing[1] / 2,
  },
  details: {
    backgroundColor: colors.surfacePage,
    borderRadius: radius.lg,
    padding: spacing[4] + 2,
    marginVertical: spacing[5],
    gap: spacing[2] + 2,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing[4],
  },
  rowLabel: {
    ...typography.caption,
    color: colors.textMuted,
    flexShrink: 0,
  },
  rowValue: {
    ...typography.label,
    color: colors.textHeading,
    flexShrink: 1,
    textAlign: 'right',
  },
  hash: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing[2],
  },
  hashLabel: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing[2] - 2,
  },
  hashRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[2],
  },
  hashValue: {
    ...typography.mono,
    flex: 1,
  },
  copy: {
    flexShrink: 0,
    paddingHorizontal: spacing[3],
  },
  note: {
    ...typography.caption,
    color: tones.warning.foreground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing[3],
  },
  provenance: {
    ...typography.caption,
    color: tones.neutral.foreground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing[3],
  },
  legal: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing[5],
  },
  skeletonBadge: {
    alignSelf: 'center',
    width: badgeSize,
    borderRadius: badgeSize / 2,
    marginBottom: spacing[4],
  },
  skeletonLine: {
    marginBottom: spacing[5],
  },
  failure: {
    alignItems: 'flex-start',
    gap: spacing[3],
    paddingVertical: spacing[4],
  },
  failureMessage: {
    ...typography.body,
    color: colors.textBody,
  },
});
