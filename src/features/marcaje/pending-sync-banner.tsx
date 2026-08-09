import { StyleSheet, Text, View } from 'react-native';

import { es, pendingSyncSubtitle, pendingSyncSummary } from '@/i18n';
import { radius, spacing, tones, typography, withAlpha } from '@/theme';
import { Button } from '@/ui/button';
import { CloudUploadIcon } from '@/ui/icons';

export type PendingSyncBannerProps = {
  /** How many punches this phone is still holding. Zero draws nothing. */
  count: number;
  /** A flush in progress — `Sincronizar` reports itself busy (#4). */
  syncing?: boolean;
  /** Why the last flush stopped, in Spanish, or `null` (#7). */
  error?: string | null;
  /** `Sincronizar`. An accelerator, never the mechanism — see below. */
  onSync: () => void;
  testID?: string;
};

/**
 * The banner above the location card: some of this employee's punches are not
 * yet in the attendance book (KMO-22).
 *
 * **It says "not registered" because they are not registered.**
 * docs/design-decisions.md §4.5 settles this against the regulation rather than
 * against taste: the libro de asistencia is the central database (Res. 38
 * Art. 9), a queued punch has no folio and no Art. 8 checksum — Art. 8 has the
 * *system* generate one after each marcación — and it is invisible to the
 * Art. 17 fiscalización portal. Under Art. 10 it is captured and stored, pending
 * transmission. That is a real status, and it is not registration. A banner that
 * said `guardadas` and stopped would describe a record that does not exist.
 *
 * **It appears only when there is something waiting** (#6). Being offline with an
 * empty queue is not news the employee needs: nothing of theirs is at risk, and a
 * standing "sin conexión" strip is how somebody learns to read past the one that
 * matters.
 *
 * **`Sincronizar` is an accelerator.** Art. 10's exception carries one condition
 * — `su envío posterior … se realice automáticamente cuando recupere la señal` —
 * so the queue draining is the system's job and this button only hurries it
 * (§4.1, and KMO-23 #4 builds the automatic half). It is never disabled: a button
 * the employee cannot press is the *bloqueo* Art. 38 b) names, and with no signal
 * pressing it produces the reason immediately rather than a doomed round trip.
 */
export function PendingSyncBanner({
  count,
  syncing = false,
  error = null,
  onSync,
  testID,
}: PendingSyncBannerProps) {
  if (count <= 0) {
    return null;
  }

  return (
    <View style={styles.banner} testID={testID}>
      <View style={styles.row}>
        <CloudUploadIcon color={tones.warning.foreground} size={iconSize} />

        {/* One accessible element, like the location card: the count and what it
            means are a single sentence, and a screen reader reading them as two
            unrelated fragments would announce a number with no subject. It is a
            live region because the employee is looking at the punch button
            below when this appears and when it goes. */}
        <View accessible accessibilityLiveRegion="polite" style={styles.body}>
          <Text style={styles.title} testID={testID === undefined ? undefined : `${testID}-title`}>
            {pendingSyncSummary(count)}
          </Text>

          <Text style={styles.subtitle}>{pendingSyncSubtitle(count)}</Text>
        </View>

        <Button
          label={es.actions.sync}
          loading={syncing}
          onPress={onSync}
          shape="pill"
          size="sm"
          testID="pending-sync-action"
          variant="warningSolid"
        />
      </View>

      {/* Under the row rather than in place of it. The count is still true after
          a failed flush — that is the point of #7 — so the banner keeps saying
          what is waiting and adds why it is still waiting. */}
      {error === null ? null : (
        <Text accessibilityLiveRegion="polite" style={styles.error} testID="pending-sync-error">
          {error}
        </Text>
      )}
    </View>
  );
}

/** The design draws the banner's icon at 18, like the location card's. */
const iconSize = 18;

const styles = StyleSheet.create({
  banner: {
    backgroundColor: tones.warning.background,
    borderRadius: radius.lg,
    // The design's `12px 14px`, off the 8px grid for the same reason the
    // location card's `14px 16px` is: this is a status strip, not a card.
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[3] + 2,
    // The design's own `margin-bottom:14px`, matching the location card it sits
    // above — the two read as one stack above the shift card.
    marginBottom: spacing[3] + 2,
    gap: spacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    // The design's `gap:10px`.
    gap: spacing[2] + 2,
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    ...typography.label,
    color: tones.warning.foreground,
  },
  subtitle: {
    // The design's `500 11px`, which is the `eyebrow` step of the type scale —
    // the only 11px preset there is. Its usual job is an uppercase label; here
    // it is the size the design asks for and nothing more.
    ...typography.eyebrow,
    // The design's `opacity:.85` on the same warning foreground, so the two
    // lines read as a heading and its qualifier rather than as two statements.
    color: withAlpha(tones.warning.foreground, 0.85),
    marginTop: spacing[1] / 2,
  },
  error: {
    ...typography.caption,
    color: tones.danger.foreground,
  },
});
