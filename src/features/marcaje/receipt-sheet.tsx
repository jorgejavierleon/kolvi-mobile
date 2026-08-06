import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, formatReceiptDate, formatReceiptTime, formatRut, isRut } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';
import { Button } from '@/ui/button';
import { CheckIcon } from '@/ui/icons';

import type { PunchReceipt } from './punch-api';
import { punchTypeName } from './punch-state';

/** The design's `setTimeout(… 1500)` before `Copiado` goes back to `Copiar`. */
const copiedFor = 1500;

export type ReceiptSheetProps = {
  /** The receipt to show. `null` is the sheet closed — there is no other way. */
  receipt: PunchReceipt | null;
  /** `Listo`, the backdrop and the back button all land here. */
  onDismiss: () => void;
  /** Injected in tests; the app writes to the real clipboard. */
  copyToClipboard?: (text: string) => Promise<unknown>;
  testID?: string;
};

/**
 * El comprobante — the receipt an employee sees the instant a punch is recorded
 * (KMO-19).
 *
 * **Everything on it comes off the 201 and nothing comes from this phone** (#9).
 * That is the whole design of the component: it takes a `PunchReceipt` and has
 * no other source — no session, no `useNow`, no `Date`, not even the punch type
 * the employee pressed for. Res. 38 Art. 11 makes the register the record, so a
 * receipt assembled from client state would be evidence of a punch the register
 * may not contain, and the way to make that impossible is to give the component
 * nothing else to read.
 *
 * Res. 38 Art. 13 is what the rows are: date, time, name, RUT and hash are the
 * regulation's minimum content, and `N° comprobante` is docs/design-decisions.md
 * D-F2-a on top of it. A row whose value the register does not hold is left out
 * rather than drawn empty — `ams` stamps the identity from a nullable `users.rut`
 * (KOL-35), so an absent RUT is a fact about the record and not a bug to paper
 * over with a placeholder.
 *
 * The scrim, the slide-up, the pinned footer and the independently scrolling
 * body (#1, #10) are all `@/ui/bottom-sheet`'s, which was built for this sheet.
 */
export function ReceiptSheet({
  receipt,
  onDismiss,
  copyToClipboard = Clipboard.setStringAsync,
  testID,
}: ReceiptSheetProps) {
  return (
    <BottomSheet
      visible={receipt !== null}
      onDismiss={onDismiss}
      dismissAccessibilityLabel={es.marcaje.receipt.close}
      footer={<Button label={es.marcaje.receipt.done} onPress={onDismiss} testID="receipt-done" />}
      testID={testID}
    >
      {receipt === null ? null : <Body receipt={receipt} copyToClipboard={copyToClipboard} />}
    </BottomSheet>
  );
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
      {/* Announced as one block, so a screen reader reads the confirmation
          rather than a lone check icon followed by two headings. */}
      <View accessible accessibilityLiveRegion="polite" style={styles.headline}>
        <View style={styles.badge} testID="receipt-badge">
          <CheckIcon color={tones.success.foreground} size={checkSize} />
        </View>

        <Text style={styles.title}>{es.marcaje.receipt.headline}</Text>
        <Text style={styles.subtitle}>{es.marcaje.receipt.subtitle}</Text>
      </View>

      <View style={styles.details} testID="receipt-details">
        <Row label={es.marcaje.receipt.type} value={punchTypeName(receipt.type)} />
        <Row label={es.marcaje.receipt.date} value={formatReceiptDate(receipt.datetime)} />
        <Row label={es.marcaje.receipt.time} value={formatReceiptTime(receipt.datetime)} />
        <Row label={es.marcaje.receipt.worker} value={receipt.employeeName} />
        <Row label={es.marcaje.receipt.rut} value={rutOf(receipt)} />
        <Row label={es.marcaje.receipt.folio} value={receipt.folio} />

        <Hash hash={receipt.hash} copyToClipboard={copyToClipboard} />

        {/* #7. The server's verdict, never the client's advisory one — the
            employee may have pressed the override from inside the fence, and
            what belongs on a receipt is what the register recorded. */}
        {receipt.geoStatus === 'outside' ? (
          <Text style={styles.outOfRange} testID="receipt-out-of-range">
            {es.marcaje.receipt.outOfRange}
          </Text>
        ) : null}
      </View>

      {/* #8. Unconditional, for every mark: it is the sentence that tells the
          employee which register their punch just joined. */}
      <Text style={styles.legal} testID="receipt-legal">
        {es.marcaje.receipt.legal}
      </Text>
    </View>
  );
}

/**
 * One Art. 13 row, or nothing at all.
 *
 * A `null` value renders no row. The alternative — a label with an empty space
 * after it — reads on a legal receipt as a value that failed to load, and sends
 * an employee to their jefatura about a mark that is correctly recorded.
 */
function Row({ label, value }: { label: string; value: string | null }) {
  if (value === null) {
    return null;
  }

  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      {/* The value wraps rather than truncating: a long Chilean name is four
          words, and an employee has to be able to read the one on their own
          receipt. */}
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/**
 * The SHA-256 and its copy button (#5, #6).
 *
 * The hash **wraps** — 64 hex characters over four monospace lines — and is
 * never truncated. An ellipsis would make the one value on the sheet that is
 * evidence unusable for the thing it is evidence for: comparing this receipt
 * against the copy Art. 12 mails.
 *
 * `Copiar` becomes `Copiado` for a second and a half and then goes back, which
 * is the design's own behaviour. It confirms in the control itself rather than
 * in a toast: a toast over a bottom sheet covers the hash the employee just
 * copied, and on Android it would be announced after the button they are still
 * looking at.
 */
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
        // A clipboard the OS refused is not worth a dialog over a receipt that
        // is already recorded. The label simply does not change, so the
        // employee can see it did not take and press again.
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
        <Text style={styles.hashValue} testID="receipt-hash">
          {hash}
        </Text>

        <Button
          label={copied ? es.actions.copied : es.actions.copy}
          onPress={copy}
          size="sm"
          style={styles.copy}
          testID="receipt-copy"
          variant="secondary"
        />
      </View>
    </View>
  );
}

/**
 * The RUT, dotted — or nothing, when the register holds something `formatRut`
 * cannot punctuate.
 *
 * `isRut` rather than a `try`/`catch` because this is the case that module
 * exports it for: a screen deciding between rendering a RUT and rendering
 * nothing. A comprobante that threw on a malformed RUT would take the whole
 * receipt — including the hash — off the screen of an employee whose punch was
 * recorded perfectly well.
 */
function rutOf(receipt: PunchReceipt): string | null {
  return isRut(receipt.employeeRut) ? formatRut(receipt.employeeRut) : null;
}

/** The design's 64dp circle, and the 30dp check inside it. */
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
    backgroundColor: tones.success.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing[4],
  },
  title: {
    // The design draws 19px here, between `h2` and `h3`. A preset is taken
    // whole rather than resized (see src/theme/typography.ts), and `h2` is the
    // one whose role matches: this is the heading of the sheet, and the largest
    // thing on it.
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
    // The design's own 18px, the same step wider than a `Card` that the punch
    // success panel takes.
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
    // Takes the remaining width and wraps into it, so a four-word name pushes
    // the row taller instead of pushing the label off the sheet.
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
    color: colors.textHeading,
    // `flex: 1` and no `numberOfLines`: the hash takes the row's width and
    // wraps down it (#5). Truncating the one value that is evidence would be
    // the receipt failing at its only job.
    flex: 1,
  },
  copy: {
    flexShrink: 0,
    paddingHorizontal: spacing[3],
  },
  outOfRange: {
    ...typography.caption,
    color: tones.warning.foreground,
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
});
