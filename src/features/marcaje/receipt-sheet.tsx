import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, formatReceiptDate, formatReceiptTime, formatRut, isRut } from '@/i18n';
import { colors, radius, spacing, tones, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';
import { Button } from '@/ui/button';
import { CheckIcon, SavedOfflineIcon } from '@/ui/icons';

import type { OfflineReceipt, PunchReceipt } from './punch-api';
import { punchTypeName } from './punch-state';

/** The design's `setTimeout(… 1500)` before `Copiado` goes back to `Copiar`. */
const copiedFor = 1500;

/**
 * What the sheet draws (KMO-24): a receipt the register confirmed, or the
 * draft shown for a punch still sitting in the queue. A union rather than a
 * `PunchReceipt` with optional `markId`/`hash`/`folio`, because those are not
 * optional on a confirmed receipt — a confirmed receipt without them is a
 * parse failure (`punch-api.ts`), and letting the sheet's own prop type say
 * otherwise would let a stray read of `.hash` compile against a punch the
 * register has never seen.
 */
export type ReceiptView =
  | { readonly kind: 'confirmed'; readonly receipt: PunchReceipt }
  | { readonly kind: 'offline'; readonly receipt: OfflineReceipt };

export type ReceiptSheetProps = {
  /** The receipt to show. `null` is the sheet closed — there is no other way. */
  view: ReceiptView | null;
  /** `Listo`, the backdrop and the back button all land here. */
  onDismiss: () => void;
  /** Injected in tests; the app writes to the real clipboard. */
  copyToClipboard?: (text: string) => Promise<unknown>;
  testID?: string;
};

/**
 * El comprobante — the receipt an employee sees the instant a punch is made
 * (KMO-19), in either of its two shapes (KMO-24).
 *
 * **Everything on a confirmed receipt comes off the 201 and nothing comes
 * from this phone** (#9). That is still the whole design of the `confirmed`
 * half: no session, no `useNow`, no `Date`. The `offline` half is the one
 * deliberate exception — `OfflineReceipt.employeeName`/`employeeRut` are the
 * signed-in employee's own, because the register is the one source that does
 * not exist yet for a punch it has not seen (§4.5) — but the sheet itself
 * still reads nothing beyond the `ReceiptView` it is handed; the caller
 * decides where an offline draft's identity comes from, not this component.
 *
 * Res. 38 Art. 13 is what the rows are: date, time, name, RUT and hash are the
 * regulation's minimum content, and `N° comprobante` is docs/design-decisions.md
 * D-F2-a on top of it. On a confirmed receipt a row whose value the register
 * does not hold is left out rather than drawn empty; on an offline receipt the
 * folio and hash rows show the design's own placeholder copy instead, because
 * there the absence is the point being made rather than an unrelated gap.
 *
 * The scrim, the slide-up, the pinned footer and the independently scrolling
 * body (#1, #10) are all `@/ui/bottom-sheet`'s, which was built for this sheet.
 */
export function ReceiptSheet({
  view,
  onDismiss,
  copyToClipboard = Clipboard.setStringAsync,
  testID,
}: ReceiptSheetProps) {
  return (
    <BottomSheet
      visible={view !== null}
      onDismiss={onDismiss}
      dismissAccessibilityLabel={es.marcaje.receipt.close}
      footer={<Button label={es.marcaje.receipt.done} onPress={onDismiss} testID="receipt-done" />}
      testID={testID}
    >
      {view === null ? null : <Body view={view} copyToClipboard={copyToClipboard} />}
    </BottomSheet>
  );
}

function Body({
  view,
  copyToClipboard,
}: {
  view: ReceiptView;
  copyToClipboard: (text: string) => Promise<unknown>;
}) {
  const { receipt } = view;
  const offline = view.kind === 'offline';
  const datetime = view.kind === 'offline' ? view.receipt.deviceDatetime : view.receipt.datetime;

  return (
    <View style={styles.body}>
      {/* Announced as one block, so a screen reader reads the confirmation
          rather than a lone icon followed by two headings. */}
      <View accessible accessibilityLiveRegion="polite" style={styles.headline}>
        <View
          style={[
            styles.badge,
            { backgroundColor: offline ? tones.warning.background : tones.success.background },
          ]}
          testID="receipt-badge"
        >
          {/* #1. The offline icon on the warning tint, never the success check —
              this is the one glance that tells an employee which of the two
              receipts they are looking at. */}
          {offline ? (
            <SavedOfflineIcon color={tones.warning.foreground} size={offlineIconSize} />
          ) : (
            <CheckIcon color={tones.success.foreground} size={checkSize} />
          )}
        </View>

        <Text style={styles.title}>
          {offline ? es.marcaje.receipt.offlineHeadline : es.marcaje.receipt.headline}
        </Text>
        <Text style={styles.subtitle}>{es.marcaje.receipt.subtitle}</Text>
      </View>

      <View style={styles.details} testID="receipt-details">
        <Row label={es.marcaje.receipt.type} value={punchTypeName(receipt.type)} />
        <Row label={es.marcaje.receipt.date} value={formatReceiptDate(datetime)} />
        <Row label={es.marcaje.receipt.time} value={formatReceiptTime(datetime)} />
        <Row label={es.marcaje.receipt.worker} value={receipt.employeeName} />
        <Row label={es.marcaje.receipt.rut} value={rutOf(receipt.employeeRut)} />

        {/* #2. On the offline draft this is the design's own placeholder copy,
            not an invented folio — the register has not allocated one yet. */}
        <Row
          label={es.marcaje.receipt.folio}
          value={view.kind === 'offline' ? es.marcaje.receipt.pendingFolio : view.receipt.folio}
        />

        <Hash
          color={offline ? tones.warning.foreground : colors.textHeading}
          copyable={!offline}
          hash={view.kind === 'offline' ? es.marcaje.receipt.pendingHash : view.receipt.hash}
          copyToClipboard={copyToClipboard}
        />

        {/* #7. The server's verdict, never the client's advisory one — the
            employee may have pressed the override from inside the fence, and
            what belongs on a receipt is what the register recorded. Only
            meaningful once there is a server verdict to show. */}
        {view.kind === 'confirmed' && view.receipt.geoStatus === 'outside' ? (
          <Text style={styles.note} testID="receipt-out-of-range">
            {es.marcaje.receipt.outOfRange}
          </Text>
        ) : null}

        {/* #3. What makes the missing folio and hash legible as a status
            rather than a bug. */}
        {offline ? (
          <Text style={styles.note} testID="receipt-offline-note">
            {es.marcaje.receipt.offlineNote}
          </Text>
        ) : null}

        {/* #8. The provenance survives the sync rather than being erased by
            it — a mark shown as `OfflineReceipt` before it synced is still
            identifiable as such once it carries a folio and a hash. */}
        {view.kind === 'confirmed' && view.receipt.capturedOffline ? (
          <Text style={styles.provenance} testID="receipt-captured-offline">
            {es.marcaje.receipt.capturedOffline}
          </Text>
        ) : null}
      </View>

      {/* KMO-19 #8, and KMO-24 #7: unconditional on both variants. It is the
          sentence that tells the employee which register their punch is
          joining, or has already joined. */}
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
 * The SHA-256 and its copy button (#5, #6) — or the offline draft's
 * placeholder copy with no button at all (KMO-24 #4).
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
 * looking at. There is nothing to copy on an offline draft — `copyable` is
 * `false` — so the button is absent rather than disabled: a disabled `Copiar`
 * would still promise the value is coming, which is exactly what §4.5 says it
 * is not.
 */
function Hash({
  hash,
  color,
  copyable,
  copyToClipboard,
}: {
  hash: string;
  color: string;
  copyable: boolean;
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
        <Text style={[styles.hashValue, { color }]} testID="receipt-hash">
          {hash}
        </Text>

        {copyable ? (
          <Button
            label={copied ? es.actions.copied : es.actions.copy}
            onPress={copy}
            size="sm"
            style={styles.copy}
            testID="receipt-copy"
            variant="secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

/**
 * The RUT, dotted — or nothing, when the source holds something `formatRut`
 * cannot punctuate.
 *
 * `isRut` rather than a `try`/`catch` because this is the case that module
 * exports it for: a screen deciding between rendering a RUT and rendering
 * nothing. A comprobante that threw on a malformed RUT would take the whole
 * receipt — including the hash — off the screen of an employee whose punch was
 * recorded perfectly well.
 */
function rutOf(rut: string | null): string | null {
  return isRut(rut) ? formatRut(rut) : null;
}

/** The design's 64dp circle. The check is drawn at 30dp, the offline glyph at 28. */
const badgeSize = 64;
const checkSize = 30;
const offlineIconSize = 28;

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
    // `flex: 1` and no `numberOfLines`: the hash takes the row's width and
    // wraps down it (#5). Truncating the one value that is evidence would be
    // the receipt failing at its only job.
    flex: 1,
  },
  copy: {
    flexShrink: 0,
    paddingHorizontal: spacing[3],
  },
  /** Shared by the out-of-range line and the offline explanatory line — same
      warning-tinted footnote treatment, different sentence above it. */
  note: {
    ...typography.caption,
    color: tones.warning.foreground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: spacing[3],
  },
  /** The offline-provenance line on a confirmed receipt — informational
      rather than a warning, so it takes the neutral tone instead of #note's. */
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
});
