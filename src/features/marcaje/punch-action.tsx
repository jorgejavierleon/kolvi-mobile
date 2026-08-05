import { StyleSheet, Text, View } from 'react-native';

import { es } from '@/i18n';
import { radius, shadows, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';

import { punchActionLabel, punchTypeFor, type PunchState } from './punch-state';
import type { PunchAttempt } from './use-punch';

export type PunchActionProps = {
  /** Today's state. `null` shows nothing at all — see `punch-state.ts`. */
  state: PunchState | null;
  attempt: PunchAttempt;
  onPunch: () => void;
  /**
   * Holds the button without hiding it. Nothing sets it yet: KMO-18 is what
   * disables the primary action in the out-of-range and no-signal states, and it
   * arrives together with the two escape hatches beneath it. Disabling before
   * those exist would make attendance unrecordable for an employee standing
   * outside a geofence, which is the one thing docs/design-decisions.md D-F1-c
   * forbids.
   */
  disabled?: boolean;
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
 */
export function PunchAction({
  state,
  attempt,
  onPunch,
  disabled = false,
  testID,
}: PunchActionProps) {
  // Nobody has said what the day looks like. The screen shows no punch surface
  // rather than guessing `before` — the one wrong answer here that costs an
  // employee a day's attendance (KMO-15 #4).
  if (state === null) {
    return null;
  }

  const type = punchTypeFor(state);

  return (
    <View style={styles.slot} testID={testID}>
      {type === null ? (
        <DayClosed testID={testID} />
      ) : (
        <Button
          label={punchActionLabel(type)}
          loading={attempt.status === 'submitting'}
          disabled={disabled}
          onPress={onPunch}
          size="lg"
          style={[styles.button, disabled ? null : shadows.accent]}
          testID="punch-button"
          variant="accent"
        />
      )}

      {attempt.status === 'failed' || attempt.status === 'duplicate' ? (
        <Attempt attempt={attempt} />
      ) : null}
    </View>
  );
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
    // it, which in KMO-18 becomes the override and the GPS retry.
    gap: spacing[2] + 2,
  },
  button: {
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
