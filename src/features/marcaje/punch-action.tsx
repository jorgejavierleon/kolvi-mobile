import { StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { radius, shadows, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';

import { punchActionLabel, punchTypeFor, type PunchState } from './punch-state';
import type { PunchAttempt } from './use-punch';

/**
 * Why the primary button is held, and the way out of it (KMO-18).
 *
 * The two are one value on purpose. **A hold always carries its own escape
 * hatch**, so there is no way to express a disabled punch button with nothing
 * beneath it — which is docs/design-decisions.md D-F1-c stated in the type
 * system rather than in a comment somebody has to remember. Out of range is
 * recorded and flagged, never blocked; an employee who cannot record attendance
 * at all is a legal problem, not a product one.
 *
 * `null` is every other state, including the seconds a cold fix takes: the
 * design's own `primaryDisabled` is `geoOutside || geoNoGps` and nothing else,
 * and a button dimmed for the twelve seconds a warehouse GPS start can run —
 * with nothing under it to press — is goal G1 spent on a dead control.
 */
export type PunchHold =
  | {
      /** The employee is outside the geofence. `Marcar de todas formas …` (#1). */
      readonly kind: 'outside';
      readonly onOverride: () => void;
    }
  | {
      /** No fix, and one might still arrive. `Reintentar ubicación` (#3). */
      readonly kind: 'noSignal';
      readonly onRetry: () => void;
      /** The phone has been asked again and has not answered yet (#4). */
      readonly retrying: boolean;
    };

export type PunchActionProps = {
  /** Today's state. `null` shows nothing at all — see `punch-state.ts`. */
  state: PunchState | null;
  attempt: PunchAttempt;
  onPunch: () => void;
  /** What the geolocation card is holding the punch for, or `null` (KMO-18). */
  hold?: PunchHold | null;
  testID?: string;
};

/**
 * The primary action under the clock — the interaction the app exists for
 * (KMO-17).
 *
 * It is one component and not two because the button and the success panel are
 * the *same slot* in three different states: the day's last punch does not
 * disable the button, it replaces it (#3). Splitting them would let a screen
 * render both, which is a finished day still offering to finish.
 *
 * Goal G1 — ten seconds from app open to a punch at p90 — is what sizes it: full
 * width, 64dp tall, the app's one coral, and a glow that makes it the only thing
 * on the screen that looks pressable. It is aimed at with a gloved thumb, in a
 * hurry, outdoors.
 *
 * The escape hatches beneath it are KMO-18, and they are in the same slot for
 * the same reason: a held button and the way out of it are one control from the
 * employee's side. `hold` is what carries both, and it cannot express one
 * without the other.
 */
export function PunchAction({ state, attempt, onPunch, hold = null, testID }: PunchActionProps) {
  // Nobody has said what the day looks like. The screen shows no punch surface
  // rather than guessing `before` — the one wrong answer here that costs an
  // employee a day's attendance (KMO-15 #4).
  if (state === null) {
    return null;
  }

  const type = punchTypeFor(state);
  const held = hold !== null;

  return (
    <View style={styles.slot} testID={testID}>
      {type === null ? (
        <DayClosed testID={testID} />
      ) : (
        <>
          <Button
            label={punchActionLabel(type)}
            loading={attempt.status === 'submitting'}
            disabled={held}
            // Why it is dimmed, for the employee who cannot see the card above
            // it — the same sentence that card is showing, so the screen has one
            // explanation rather than two.
            accessibilityHint={held ? holdReason(hold) : undefined}
            onPress={onPunch}
            size="lg"
            style={[styles.button, held ? null : shadows.accent]}
            testID="punch-button"
            variant="accent"
          />

          {/* Under the button, never over it, and only in the two states that
              hold it: a finished day has no hold and the `done` branch above
              renders no button for one to sit beneath (#6). */}
          {hold === null ? null : <Escape hold={hold} />}
        </>
      )}

      {attempt.status === 'failed' || attempt.status === 'duplicate' ? (
        <Attempt attempt={attempt} />
      ) : null}
    </View>
  );
}

/**
 * The way out of a held button (KMO-18 #1, #3).
 *
 * One component for both because they are one slot — the design draws a single
 * full-width control under the primary at `margin-top:10px`, and only ever one
 * of them at a time. Both clear the 44px minimum by taking `size="sm"`, whose
 * height *is* `hitTargetMin` (#7), rather than by carrying a number of their own.
 *
 * The override is drawn in the warning tone the card above it is tinted with, so
 * the button and the reason for it read as one thing; the retry is the app's
 * ordinary secondary, because asking the phone again costs nothing and warns
 * about nothing.
 */
function Escape({ hold }: { hold: PunchHold }) {
  if (hold.kind === 'outside') {
    return (
      <Button
        label={es.marcaje.punch.override}
        onPress={hold.onOverride}
        size="sm"
        style={styles.escape}
        testID="punch-override"
        variant="warning"
      />
    );
  }

  return (
    <Button
      label={es.marcaje.location.retry}
      loading={hold.retrying}
      onPress={hold.onRetry}
      size="sm"
      style={styles.escape}
      testID="location-retry"
      variant="secondary"
    />
  );
}

/** The card's own title, reused as the disabled button's spoken explanation. */
function holdReason(hold: PunchHold): string {
  return hold.kind === 'outside' ? es.marcaje.location.outside : es.marcaje.location.noSignal;
}

/**
 * The success panel that stands where the button was (#3).
 *
 * The title is the same `Jornada finalizada` the status line above it already
 * says. That repetition is the design's, and it is right: the line under the
 * clock is a caption an employee's eye skips on the way to the button, and this
 * is what their eye lands on instead when the button has gone.
 */
function DayClosed({ testID }: { testID?: string }) {
  return (
    <View
      accessible
      accessibilityLiveRegion="polite"
      style={styles.panel}
      testID={testID === undefined ? 'punch-done' : `${testID}-done`}
    >
      <Text style={styles.panelTitle}>{es.marcaje.status.done}</Text>
      <Text style={styles.panelBody}>{es.marcaje.punch.panelBody}</Text>
    </View>
  );
}

/**
 * What the last attempt has to say, under the button and never over it (#7, #8).
 *
 * A line rather than a dialog, for both of them. A modal would take the button
 * off screen and put a dismissal between the employee and the retry — and for
 * the duplicate it would be an error interrupting someone whose punch is
 * already, correctly, in the register.
 *
 * There is no retry control here: the primary button *is* the retry, it is
 * directly above this line, and it kept its label because the state never moved
 * (#8). A second button offering the same action is a second thing to read
 * outdoors.
 */
function Attempt({ attempt }: { attempt: Extract<PunchAttempt, { message: string }> }) {
  const failed = attempt.status === 'failed';

  return (
    <View
      accessible
      accessibilityLiveRegion="assertive"
      style={[
        styles.attempt,
        { backgroundColor: failed ? tones.danger.background : tones.neutral.background },
      ]}
      testID={failed ? 'punch-failed' : 'punch-duplicate'}
    >
      <Text
        style={[
          styles.attemptMessage,
          { color: failed ? tones.danger.foreground : tones.neutral.foreground },
        ]}
      >
        {attempt.message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    // The design's `margin-top:10px` between the button and whatever sits under
    // it: the override, the GPS retry, or the line a failed attempt leaves.
    gap: spacing[2] + 2,
  },
  button: {
    width: '100%',
  },
  // Full width like the button it belongs to. The 10px above it is the slot's
  // own gap, which is the design's `margin-top:10px`.
  escape: {
    width: '100%',
  },
  panel: {
    backgroundColor: tones.success.background,
    borderRadius: radius.lg,
    // The design's own `18px`, a step wider than a `Card` — the panel is the
    // last thing on a finished day and reads as a full stop.
    padding: spacing[4] + 2,
    alignItems: 'center',
    gap: spacing[1],
  },
  panelTitle: {
    ...typography.label,
    color: tones.success.foreground,
    textAlign: 'center',
  },
  panelBody: {
    ...typography.caption,
    color: tones.success.foreground,
    textAlign: 'center',
  },
  attempt: {
    borderRadius: radius.md,
    paddingVertical: spacing[3],
    paddingHorizontal: spacing[4],
  },
  attemptMessage: {
    ...typography.body,
    textAlign: 'center',
  },
});
