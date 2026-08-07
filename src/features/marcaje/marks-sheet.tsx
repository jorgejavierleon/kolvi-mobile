import { StyleSheet, Text, View } from 'react-native';

import { es, formatClockTime, formatShortDate, markSummary } from '@/i18n';
import { colors, radius, spacing, typography } from '@/theme';
import { BottomSheet } from '@/ui/bottom-sheet';
import { Button } from '@/ui/button';
import { ListRow } from '@/ui/list-row';
import { Skeleton } from '@/ui/skeleton';

import type { PunchReceipt } from './punch-api';
import { punchTypeName } from './punch-state';
import type { Marks } from './use-marks';

export type MarksSheetProps = {
  visible: boolean;
  /** The load, from `useMarks`. This component draws it and fetches nothing. */
  marks: Marks;
  /** A row was tapped — the screen opens the comprobante for that mark. */
  onSelect: (receipt: PunchReceipt) => void;
  /** `Listo`, the backdrop and the back button all land here. */
  onDismiss: () => void;
  testID?: string;
};

/**
 * Mis últimas marcas — the punches already in the register (KMO-20).
 *
 * Res. 38 Art. 22.1 gives the worker permanent and unrestricted access to their
 * own history. This is Phase 1's share of that: the ten most recent marks, each
 * one a tap away from the comprobante it was issued with. The five-year workday
 * history is Phase 2's, under Jornada.
 *
 * **A sheet rather than a screen**, and that is the criterion rather than a
 * preference (#5). A pushed route lands on the root stack and covers the tab bar
 * — that is exactly what makes `Mi perfil` an overlay — so a route would take the
 * employee out of Marcaje to reach a list about marcaje. The sheet rises over
 * the tab they are already on and leaves it underneath.
 *
 * Every row is a `PunchReceipt`, the same type the 201 answers with, so tapping
 * one hands `ReceiptSheet` exactly what a fresh punch hands it (#2) — carrying
 * the folio and the hash the register recorded rather than a second rendering of
 * them (#3). This component never opens the comprobante itself: it reports the
 * tap, and the screen composes the two sheets.
 */
export function MarksSheet({ visible, marks, onSelect, onDismiss, testID }: MarksSheetProps) {
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissAccessibilityLabel={es.marcaje.marks.close}
      footer={<Button label={es.marcaje.receipt.done} onPress={onDismiss} testID="marks-done" />}
      testID={testID}
    >
      <View style={styles.header}>
        <Text style={styles.title}>{es.marcaje.marks.title}</Text>
        <Text style={styles.subtitle}>{es.marcaje.marks.subtitle}</Text>
      </View>

      <Body marks={marks} onSelect={onSelect} />
    </BottomSheet>
  );
}

function Body({ marks, onSelect }: { marks: Marks; onSelect: (receipt: PunchReceipt) => void }) {
  if (marks.status === 'loading') {
    return <MarksSkeleton />;
  }

  if (marks.status === 'failed') {
    return <LoadFailure onRetry={marks.reload} retrying={marks.retrying} />;
  }

  if (marks.marks.length === 0) {
    return <Empty />;
  }

  return (
    <View style={styles.list} testID="marks-list">
      {marks.marks.map((receipt, index) => (
        <MarkRow
          key={receipt.markId}
          receipt={receipt}
          onSelect={onSelect}
          divider={index < marks.marks.length - 1}
        />
      ))}
    </View>
  );
}

/**
 * One punch: what it was, when it was, and the receipt behind it (#1, #2).
 *
 * Type, date and time and nothing else. The folio and the hash are on the
 * comprobante one tap away, and putting them on the row would make ten rows of
 * evidence that is unreadable at this size — the list's job is to let an
 * employee find the punch they mean.
 *
 * The time carries no seconds, which is the one place this list departs from the
 * receipt's formats. `formatReceiptTime` exists because Art. 13 requires
 * `hh:mm:ss` *on the receipt*; this is a row somebody scans, and the second that
 * distinguishes two marks in the register is on the sheet the row opens.
 */
function MarkRow({
  receipt,
  onSelect,
  divider,
}: {
  receipt: PunchReceipt;
  onSelect: (receipt: PunchReceipt) => void;
  divider: boolean;
}) {
  const type = punchTypeName(receipt.type);
  const date = formatShortDate(receipt.datetime);
  const time = formatClockTime(receipt.datetime);

  return (
    <ListRow
      // Announced as one phrase: the two columns would otherwise be read as
      // three unrelated strings, with nothing saying which date the time is on.
      accessibilityLabel={markSummary(type, date, time)}
      divider={divider}
      onPress={() => onSelect(receipt)}
      subtitle={date}
      testID={`mark-row-${receipt.markId}`}
      title={type}
      trailing={time}
    />
  );
}

/**
 * The employee has never punched (#4).
 *
 * A loaded state and not a failure, so it offers no retry: there is nothing to
 * ask again for. It says what will fill the list, because an empty history is
 * the one screen in this app an employee could reasonably read as their record
 * having been lost.
 */
function Empty() {
  return (
    <View accessible accessibilityLiveRegion="polite" style={styles.empty} testID="marks-empty">
      <Text style={styles.emptyTitle}>{es.marcaje.marks.empty}</Text>
      <Text style={styles.emptyBody}>{es.marcaje.marks.emptyBody}</Text>
    </View>
  );
}

/** The list did not load. `es.states.failed` — this is a list, not the punch screen. */
function LoadFailure({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <View accessibilityLiveRegion="polite" style={styles.failure} testID="marks-load-failed">
      <Text style={styles.failureMessage}>{es.states.failed}</Text>

      <Button
        label={es.actions.retry}
        loading={retrying}
        onPress={onRetry}
        size="sm"
        testID="marks-retry"
        variant="secondary"
      />
    </View>
  );
}

/** Rows in the shape of the rows that are coming, so the sheet does not jump. */
function MarksSkeleton() {
  return (
    <View
      accessibilityLabel={es.states.loading}
      accessibilityLiveRegion="polite"
      accessible
      style={styles.list}
      testID="marks-skeleton"
    >
      {skeletonRows.map((key) => (
        <View key={key} style={styles.skeletonRow}>
          <Skeleton width="45%" />
          <Skeleton width="20%" />
        </View>
      ))}
    </View>
  );
}

/** Three, not ten: enough to read as a list, short enough not to fill the sheet. */
const skeletonRows = [0, 1, 2];

const styles = StyleSheet.create({
  header: {
    marginBottom: spacing[4],
  },
  title: {
    ...typography.h2,
    color: colors.textHeading,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[1] / 2,
  },
  list: {
    backgroundColor: colors.surfacePage,
    borderRadius: radius.lg,
    paddingHorizontal: spacing[4],
    marginBottom: spacing[5],
  },
  empty: {
    marginBottom: spacing[5],
    gap: spacing[1],
  },
  emptyTitle: {
    ...typography.label,
    color: colors.textHeading,
  },
  emptyBody: {
    ...typography.caption,
    color: colors.textMuted,
  },
  failure: {
    marginBottom: spacing[5],
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  failureMessage: {
    ...typography.body,
    color: colors.textHeading,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing[4],
    paddingVertical: spacing[4],
  },
});
