import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { es, locationConfirmed, locationOutOfRange } from '@/i18n';
import { colors, radius, spacing, tones, typography, withAlpha, type Tone } from '@/theme';
import { Button } from '@/ui/button';
import { MapPinIcon, MapPinOffIcon, TriangleAlertIcon, WifiOffIcon } from '@/ui/icons';

import type { LocationState } from './use-location';

export type LocationCardProps = {
  state: LocationState;
  /**
   * The premise the shift is worked at, for the two states that name it. `null`
   * on a day with nothing scheduled, which leaves the confirmed card with its
   * title and no subtitle rather than a sentence about a place that is not there.
   */
  premise: string | null;
  /** Reopens the rationale, and the OS prompt behind it. */
  onEnable: () => void;
  /** Opens the OS settings, for the refusal that has no prompt left (#8). */
  onOpenSettings: () => void;
  testID?: string;
};

/**
 * The card above the shift card: whether the employee can punch from where they
 * are standing, before they reach for the button (KMO-16).
 *
 * Every state pairs its tint with its own title and its own icon — the tone
 * never carries the meaning by itself (#5), which matters here more than
 * anywhere else in the app: this card is read in one glance, outdoors, by
 * someone who may not distinguish the warning amber from the success green.
 *
 * What it says is advisory. The server decides whether a punch was inside the
 * geofence (docs/design-decisions.md §2), and nothing here is allowed to read
 * like a verdict.
 */
export function LocationCard({
  state,
  premise,
  onEnable,
  onOpenSettings,
  testID,
}: LocationCardProps) {
  const { tone, title, subtitle } = describe(state, premise);
  const palette = tones[tone];

  return (
    <View style={[styles.card, { backgroundColor: palette.background }]} testID={testID}>
      <View
        style={[
          styles.well,
          // The design's own two well fills: solid white on the confirmed card,
          // and a softened white on the other two so the tint reads through.
          { backgroundColor: tone === 'success' ? colors.white : wellOnTint },
        ]}
      >
        <StateIcon state={state} color={palette.foreground} />
      </View>

      <View style={styles.body}>
        {/* One accessible element, so a screen reader reads the state as the
            sentence it is rather than as two unrelated fragments — and announces
            it when it changes, because the employee is watching the button
            below it rather than this card. */}
        <View accessible accessibilityLiveRegion="polite">
          <Text style={styles.title} testID={testID === undefined ? undefined : `${testID}-title`}>
            {title}
          </Text>

          {subtitle === null ? null : <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>

        {state.kind === 'denied' ? (
          <Button
            label={state.canAskAgain ? es.permissions.location.enable : es.actions.openSettings}
            onPress={state.canAskAgain ? onEnable : onOpenSettings}
            size="sm"
            testID="location-settings"
            variant="secondary"
          />
        ) : null}
      </View>
    </View>
  );
}

/** The design's `rgba(255,255,255,.6)` well, over a tinted card. */
const wellOnTint = withAlpha(colors.white, 0.6);

function StateIcon({ state, color }: { state: LocationState; color: string }) {
  const size = iconSize;

  if (state.kind === 'outside') {
    return <TriangleAlertIcon color={color} size={size} />;
  }

  if (state.kind === 'noSignal') {
    return <WifiOffIcon color={color} size={size} />;
  }

  if (state.kind === 'denied') {
    return <MapPinOffIcon color={color} size={size} />;
  }

  if (state.kind === 'acquiring') {
    return <ActivityIndicator color={color} size="small" />;
  }

  return <MapPinIcon color={color} size={size} />;
}

/**
 * The tone, title and subtitle for a state.
 *
 * The three the design draws are transcribed from it. `acquiring` takes the
 * neutral tone because it is not yet news of any kind, and `denied` takes the
 * danger tone it shares with no-signal — they look alike because they mean the
 * same thing to a punch, and they read differently because their causes and
 * their remedies are not the same at all.
 */
function describe(
  state: LocationState,
  premise: string | null,
): { tone: Tone; title: string; subtitle: string | null } {
  switch (state.kind) {
    case 'acquiring':
      return {
        tone: 'neutral',
        title: es.marcaje.location.acquiring,
        subtitle: es.marcaje.location.acquiringBody,
      };

    case 'confirmed':
      return {
        tone: 'success',
        title: es.marcaje.location.confirmed,
        subtitle: premise === null ? null : locationConfirmed(premise, state.distanceMeters),
      };

    case 'outside':
      return {
        tone: 'warning',
        title: es.marcaje.location.outside,
        // The subtitle names the premise the employee has to be inside of, so a
        // card with no premise on it would be telling them to go nowhere.
        subtitle: premise === null ? null : locationOutOfRange(premise),
      };

    case 'noSignal':
      return {
        tone: 'danger',
        title: es.marcaje.location.noSignal,
        subtitle: es.permissions.location.servicesOff,
      };

    case 'denied':
      return {
        tone: 'danger',
        title: es.marcaje.location.denied,
        // Which sentence depends on whether there is a prompt left to raise: one
        // asks for the permission, the other sends them to settings, and giving
        // the wrong one is advice the employee cannot act on.
        subtitle: state.canAskAgain
          ? es.permissions.location.denied
          : es.permissions.location.deniedForever,
      };
  }
}

/** The design draws the card's icons at 18 inside a 36px well. */
const iconSize = 18;

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
    borderRadius: radius.lg,
    // The design's `14px 16px`, which is off the 8px grid on purpose: this card
    // is shorter than a `Card` so it reads as a status strip above one.
    paddingVertical: spacing[3] + 2,
    paddingHorizontal: spacing[4],
    // The design's own `margin-bottom:14px`. It lives here rather than as a gap
    // on the screen because this card sits directly under `Screen`, outside the
    // body that KMO-15 spaces with one.
    marginBottom: spacing[3] + 2,
  },
  well: {
    width: spacing[8] + spacing[1],
    height: spacing[8] + spacing[1],
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing[2],
    alignItems: 'flex-start',
  },
  title: {
    ...typography.label,
    color: colors.textHeading,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing[1],
  },
});
