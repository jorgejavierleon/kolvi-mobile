import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, formatLongDate, greeting, weekSummary } from '@/i18n';
import { colors, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Screen } from '@/ui/screen';
import { ScreenHeader } from '@/ui/screen-header';
import { Skeleton } from '@/ui/skeleton';

import { useSession } from '../auth/session';
import { Clock } from './clock';
import type { LocationSource } from './location';
import { LocationCard } from './location-card';
import { LocationRationale } from './location-rationale';
import { useNow } from './now-clock';
import { PunchAction, type PunchHold } from './punch-action';
import type { PunchApi } from './punch-api';
import { ShiftCard, ShiftCardSkeleton } from './shift-card';
import type { TodayApi, TodaySummary } from './today-api';
import { useLocation } from './use-location';
import { usePunch, type Punch } from './use-punch';
import { useToday } from './use-today';

export type HomeScreenProps = {
  /** Opens Mi perfil. The route supplies the navigation; this screen does none. */
  onOpenProfile: () => void;
  /** Injected in tests; the app uses the configured client. */
  api?: TodayApi;
  /** Injected in tests; the app uses the configured client. */
  punchApi?: PunchApi;
  /** Injected in tests; the app reads the phone. */
  clock?: () => Date;
  /** Injected in tests; the app reads the phone's location. */
  locationSource?: LocationSource;
};

/**
 * Inicio — the marcaje screen (KMO-15).
 *
 * Everything below the header comes from **one** `GET /me/today` (#6). That is
 * the screen's whole architecture: goal G1 is time-to-punch under ten seconds
 * from app open at p90, and a screen that fanned out to the shift, the marks and
 * the week separately would spend three round trips on a warehouse connection
 * before the button was live.
 *
 * The header is the exception, and deliberately so. The date is the phone's and
 * the name is the session's, so it paints immediately — an employee opening the
 * app sees their own name while the request is still going, rather than a
 * screenful of grey blocks.
 *
 * The geolocation card (KMO-16) is the exception to the one-request rule in the
 * other direction: it reads the phone rather than the server, and it starts
 * doing so while `/me/today` is still in flight. The two are independent, and
 * serialising them would add a fix's twelve seconds to the slowest path to a
 * punch. What it needs from the response — the premise and its geofence —
 * arrives later and simply re-evaluates the card.
 *
 * The punch itself (KMO-17) is composed here rather than owned here, like
 * everything else on this screen: `usePunch` decides, `PunchAction` draws, and
 * the route below only hands the one to the other. What it does own is the
 * reconciliation — a punch the server says it already has reloads `/me/today`,
 * so what an employee ends up looking at is the register and not this screen's
 * idea of it.
 *
 * The two escape hatches under the button (KMO-18) are composed here too, and
 * they are the reason this screen reads the location card and the punch as one
 * subject: what holds the button is a fact about the phone, and what releases it
 * is an action about the punch.
 *
 * What is not here yet: the comprobante sheet a punch opens (KMO-19) and the
 * pending-sync banner (KMO-22). Each lands in the slot the design puts it in.
 */
export function HomeScreen({
  onOpenProfile,
  api,
  punchApi,
  clock,
  locationSource,
}: HomeScreenProps) {
  const session = useSession();
  const today = useToday(api);
  const now = useNow(clock);

  const shift = today.status === 'loaded' ? today.summary.shift : null;

  /**
   * #8. `ClockOwn:Mark` is what makes this a punch screen rather than a view of
   * today, and it is the permission an admin who also punches carries. Without
   * it the tab still works — the date, the shift and the week are all readable —
   * and only the punch surface is absent, which is the difference between an
   * employee whose role does not punch and one looking at a broken app.
   *
   * The surface is the status line and, from KMO-17, the primary button: both
   * describe or perform punching, and there is no punch state to announce to
   * someone who cannot punch. The clock is not part of it. It is the screen's
   * ambient time and hiding it would leave a conspicuous hole where the design's
   * largest element is.
   */
  const canPunch = session.can('ClockOwn:Mark');

  const location = useLocation({
    geofence: shift?.geofence ?? null,
    enabled: canPunch,
    source: locationSource,
  });

  /**
   * The punch (KMO-17).
   *
   * The state it is handed is the server's; what it hands back is that state
   * advanced by any punch it has since recorded, which is what the clock's
   * status line and the button both read. `onAlreadyMarked` is the reconcile:
   * the register already holds the mark, so the screen asks for the day again
   * rather than trusting the step it just inferred (#7).
   */
  const punch = usePunch({
    state: today.status === 'loaded' ? today.summary.punchState : null,
    fix: location.fix,
    geoStatus: location.geoStatus,
    onAlreadyMarked: today.reload,
    api: punchApi,
  });

  /**
   * What the geolocation card is holding the punch for, and the way out of it
   * (KMO-18). Composed here, like everything else on this screen: the hook knows
   * where the employee is, the component draws a button, and this is the one
   * place that decides those are the same subject.
   *
   * The override calls `punch.punch` itself. An override is not a different
   * request — `geoStatus` already travels as `outside` and the server runs its
   * own haversine (`ams` KOL-34) — it is the same punch made deliberately, which
   * is what the label above it warns about.
   */
  const hold = useMemo<PunchHold | null>(() => {
    if (location.state.kind === 'outside') {
      return { kind: 'outside', onOverride: punch.punch };
    }

    // `retrying` keeps the button on screen across the `acquiring` the retry
    // itself causes; without it the control would vanish under the thumb that
    // pressed it (#4).
    if (location.state.kind === 'noSignal' || location.retrying) {
      return { kind: 'noSignal', onRetry: location.retry, retrying: location.retrying };
    }

    // Everything else, including `denied`: no fix is ever coming for that
    // employee, so the punch goes with `geo_status: unknown` rather than being
    // held behind a retry that cannot help (KMO-17 #11).
    return null;
  }, [location.retry, location.retrying, location.state.kind, punch.punch]);

  // `first_name` is nullable in `ams`, so the greeting falls back to the full
  // name rather than to `Hola, ` with nothing after the comma.
  const name = session.user?.firstName ?? session.user?.name ?? null;

  return (
    <Screen testID="home-screen">
      <ScreenHeader
        title={name === null ? es.headers.inicio : greeting(name)}
        eyebrow={formatLongDate(now.date)}
        avatarLabel={es.profile.open}
        onPressAvatar={onOpenProfile}
      />

      {/* Above the shift card, where the design puts it, and above the three
          load states rather than inside the loaded one: this card is about the
          phone and not about the response, so it has something true to say
          while `/me/today` is still in flight and if it never arrives. */}
      {canPunch ? (
        <LocationCard
          state={location.state}
          premise={shift?.premise ?? null}
          onEnable={location.offerRationale}
          onOpenSettings={location.openSettings}
          testID="location-card"
        />
      ) : null}

      <LocationRationale
        visible={location.rationaleVisible}
        onAccept={location.acceptRationale}
        onDismiss={location.dismissRationale}
        testID="location-rationale"
      />

      {today.status === 'loading' ? <HomeSkeleton /> : null}

      {today.status === 'failed' ? (
        <LoadFailure onRetry={today.reload} retrying={today.retrying} />
      ) : null}

      {today.status === 'loaded' ? (
        <HomeBody
          summary={today.summary}
          canPunch={canPunch}
          clock={clock}
          punch={punch}
          hold={hold}
        />
      ) : null}
    </Screen>
  );
}

function HomeBody({
  summary,
  canPunch,
  clock,
  punch,
  hold,
}: {
  summary: TodaySummary;
  canPunch: boolean;
  clock?: () => Date;
  punch: Punch;
  hold: PunchHold | null;
}) {
  return (
    <View style={styles.body}>
      <ShiftCard shift={summary.shift} testID="shift-card" />

      {/* The clock is always drawn; only the status line under it is gated,
          because only that line is about punching. KMO-18's recovery actions
          sit directly below the button, inside the same gate.

          Both the line and the button read `punch.state` and not the summary:
          they have to agree, and after a punch the summary is a request behind
          — a clock reading `Aún no marcas entrada` over `Marcar salida` is the
          screen contradicting itself about the one fact it exists to state. */}
      <Clock punchState={canPunch ? punch.state : null} clock={clock} testID="clock" />

      {canPunch ? (
        <PunchAction
          state={punch.state}
          attempt={punch}
          onPunch={punch.punch}
          hold={hold}
          testID="punch-action"
        />
      ) : null}

      {summary.week === null ? null : (
        <Text style={styles.week} testID="week-summary">
          {weekSummary(summary.week.workedHours, summary.week.contractedHours)}
        </Text>
      )}
    </View>
  );
}

/**
 * The first paint, before the request has landed (#9).
 *
 * Blocks in the shape of what is coming rather than a spinner over an empty
 * screen: the layout does not jump when the response arrives, which matters here
 * more than on a list because the thing an employee is reaching for is a button
 * that must not move under their thumb.
 */
function HomeSkeleton() {
  return (
    <View
      accessibilityLabel={es.states.loading}
      accessibilityLiveRegion="polite"
      accessible
      style={styles.body}
      testID="home-skeleton"
    >
      <ShiftCardSkeleton testID="shift-card-skeleton" />

      <View style={styles.clockSkeleton}>
        <Skeleton height={clockSkeletonHeight} width="45%" />
        <Skeleton width="55%" />
      </View>

      <Skeleton width="60%" style={styles.weekSkeleton} />
    </View>
  );
}

/**
 * The load failed (#9).
 *
 * It replaces the body and not the screen: the header, the tab bar and the
 * employee's place in the app all survive, so retrying is a tap rather than a
 * journey back to where they were. `Reintentar` is `es.actions.retry`, the one
 * spelling of that verb in the app.
 */
function LoadFailure({ onRetry, retrying }: { onRetry: () => void; retrying: boolean }) {
  return (
    <Card testID="home-load-failed">
      <View accessibilityLiveRegion="polite" style={styles.failure}>
        <Text style={styles.failureMessage}>{es.marcaje.loadFailed}</Text>

        <Button
          label={es.actions.retry}
          loading={retrying}
          onPress={onRetry}
          size="sm"
          testID="home-retry"
          variant="secondary"
        />
      </View>
    </Card>
  );
}

/** The clock's own 42dp line, so the skeleton reserves the height it will take. */
const clockSkeletonHeight = typography.display.lineHeight;

const styles = StyleSheet.create({
  body: {
    gap: spacing[5],
  },
  week: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  clockSkeleton: {
    alignItems: 'center',
    gap: spacing[2],
  },
  weekSkeleton: {
    alignSelf: 'center',
  },
  failure: {
    gap: spacing[3],
    alignItems: 'flex-start',
  },
  failureMessage: {
    ...typography.body,
    color: tones.danger.foreground,
  },
});
