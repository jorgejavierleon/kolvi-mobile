import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { es, formatLongDate, greeting, weekSummary } from '@/i18n';
import { colors, spacing, tones, typography } from '@/theme';
import { Button } from '@/ui/button';
import { Card } from '@/ui/card';
import { Screen } from '@/ui/screen';
import { ScreenHeader } from '@/ui/screen-header';
import { Skeleton } from '@/ui/skeleton';
import { TextLink } from '@/ui/text-link';

import { useSession } from '../auth/session';
import { Clock } from './clock';
import type { ConnectivitySource } from './connectivity';
import type { LocationSource } from './location';
import { LocationCard } from './location-card';
import { LocationRationale } from './location-rationale';
import type { MarksApi } from './marks-api';
import { MarksSheet } from './marks-sheet';
import { useNow } from './now-clock';
import { PendingSyncBanner } from './pending-sync-banner';
import { PunchAction, type PunchHold } from './punch-action';
import { createPunchSync, type PunchApi, type PunchReceipt } from './punch-api';
import {
  punchQueue as appPunchQueue,
  usePunchQueue,
  type PunchQueue,
  type PunchSync,
  type QueuedPunch,
} from './punch-queue';
import { ReceiptSheet, type ReceiptView } from './receipt-sheet';
import { ShiftCard, ShiftCardSkeleton } from './shift-card';
import type { TodayApi, TodaySummary } from './today-api';
import { useConnectivity } from './use-connectivity';
import { useLocation } from './use-location';
import { useMarks } from './use-marks';
import { usePunch, type Punch } from './use-punch';
import { useToday } from './use-today';

export type HomeScreenProps = {
  /** Opens Mi perfil. The route supplies the navigation; this screen does none. */
  onOpenProfile: () => void;
  /** Injected in tests; the app uses the configured client. */
  api?: TodayApi;
  /** Injected in tests; the app uses the configured client. */
  punchApi?: PunchApi;
  /** Injected in tests; the app uses the configured client. */
  marksApi?: MarksApi;
  /** Injected in tests; the app reads the phone. */
  clock?: () => Date;
  /** Injected in tests; the app reads the phone's location. */
  locationSource?: LocationSource;
  /** Injected in tests; the app uses the process-wide queue. */
  queue?: PunchQueue;
  /** Injected in tests; the app reads the phone. */
  connectivitySource?: ConnectivitySource;
  /**
   * How one queued punch is transmitted — `createPunchSync` in `punch-api.ts`
   * by default, which is the wire body in docs/design-decisions.md §4.3 and
   * the response-code branching KMO-23 builds. Injected in tests.
   */
  punchSync?: PunchSync;
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
 * The comprobante (KMO-19) is composed here for the same reason: `usePunch`
 * hands back the receipt the server answered with, `ReceiptSheet` draws it, and
 * this screen is the only thing that knows whether the employee is still looking
 * at it.
 *
 * The punch history (KMO-20) is the second thing that opens that sheet. Res. 38
 * Art. 22.1 makes a receipt retrievable rather than a one-time view, so the list
 * hands `ReceiptSheet` a stored mark exactly as `usePunch` hands it a fresh one,
 * and this screen is again the only thing that knows which of the two sheets the
 * employee is on.
 *
 * The pending-sync banner (KMO-22) is composed above the location card, in the
 * slot the design puts it in, and it is the third thing on this screen that
 * sits outside the three load states: an untransmitted punch is a fact about
 * the phone, not about `/me/today`. What is *not* here is anything that decides
 * to queue — that is a request that failed, and it arrives with KMO-23.
 */
export function HomeScreen({
  onOpenProfile,
  api,
  punchApi,
  marksApi,
  clock,
  locationSource,
  queue = appPunchQueue,
  connectivitySource,
  punchSync,
}: HomeScreenProps) {
  // Built once, like `punchApi`/`marksApi` below: a fresh function identity
  // every render would be a new `flushQueue` identity for `useConnectivity`'s
  // `onRestored` to resubscribe against on every paint.
  const sync = useMemo(() => punchSync ?? createPunchSync(), [punchSync]);

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

  /**
   * KMO-20 #5. `ViewOwn:Mark` is the permission the history is behind, and it is
   * a different one from `ClockOwn:Mark`: an employee whose role reads marks but
   * does not make them still has a record to consult, and one who punches
   * without it has no list to open. Gated the same way the punch surface is —
   * hidden rather than shown and 403ing, which is the safe direction to be wrong
   * in on a screen about a legal register.
   */
  const canViewMarks = session.can('ViewOwn:Mark');

  const location = useLocation({
    geofence: shift?.geofence ?? null,
    enabled: canPunch,
    source: locationSource,
  });

  /**
   * The comprobante the last punch produced (KMO-19), or `null` when there is
   * none on screen — `confirmed` off the register, or `offline` for a punch
   * still sitting in the queue (KMO-24).
   *
   * Screen state rather than a read of `punch.receipt`, and the distinction is
   * the whole reason it exists: `punch.receipt` is the last receipt the *hook*
   * holds, which survives the sheet being dismissed, so a screen that drew from
   * it would reopen the comprobante on the next render. What is being tracked
   * here is not "was there a punch" but "is the employee looking at its
   * receipt", and only this screen knows that.
   */
  const [receiptView, setReceiptView] = useState<ReceiptView | null>(null);
  const dismissReceipt = useCallback(() => setReceiptView(null), []);

  /**
   * Whether the employee is looking at their punch history (KMO-20).
   *
   * A sheet rather than a route, and that is #5 rather than a preference: a
   * pushed route lands on the root stack and covers the tab bar — that is what
   * makes `Mi perfil` an overlay — so a route would take the employee out of
   * Marcaje to reach a list about marcaje. The sheet rises over the tab they are
   * already on.
   */
  const [marksOpen, setMarksOpen] = useState(false);
  const openMarks = useCallback(() => setMarksOpen(true), []);
  const dismissMarks = useCallback(() => setMarksOpen(false), []);

  /**
   * The history itself, loaded only once the list has been opened — Inicio keeps
   * its one `/me/today` and the ten-second time-to-punch pays nothing for a list
   * nobody has looked at. See `use-marks.ts`.
   */
  const marks = useMarks({ enabled: canViewMarks && marksOpen, api: marksApi });

  /**
   * The confirmed receipt straight onto the sheet above (KMO-19, and KMO-17
   * #10) — the `PunchReceipt` `usePunch` hands back wrapped as a `ReceiptView`,
   * which is all the sheet takes since KMO-24.
   */
  const onPunched = useCallback(
    (receipt: PunchReceipt) => setReceiptView({ kind: 'confirmed', receipt }),
    [],
  );

  /**
   * The offline draft (KMO-24), the moment the punch is durably queued —
   * `usePunch`'s own doc comment left this callback for this ticket. Identity
   * comes from the signed-in session rather than the register: the register is
   * the one source that does not exist yet for a punch it has not seen (§4.5),
   * so it is the only exception to "the sheet reads nothing but its receipt" —
   * decided here, once, rather than inside the sheet itself.
   */
  const onQueued = useCallback(
    (punch: QueuedPunch) => {
      setReceiptView({
        kind: 'offline',
        receipt: {
          type: punch.type,
          deviceDatetime: punch.deviceDatetime,
          employeeName: session.user?.name ?? null,
          employeeRut: session.user?.rut ?? null,
        },
      });
    },
    [session.user],
  );

  /**
   * The punch (KMO-17).
   *
   * The state it is handed is the server's; what it hands back is that state
   * advanced by any punch it has since recorded, which is what the clock's
   * status line and the button both read. `onAlreadyMarked` is the reconcile:
   * the register already holds the mark, so the screen asks for the day again
   * rather than trusting the step it just inferred (#7); `onPunched` and
   * `onQueued` are the two receipt shapes going straight to the sheet above.
   */
  const punch = usePunch({
    state: today.status === 'loaded' ? today.summary.punchState : null,
    fix: location.fix,
    geoStatus: location.geoStatus,
    onPunched,
    onQueued,
    onAlreadyMarked: today.reload,
    api: punchApi,
    clock,
    queue,
  });

  /**
   * The punches this phone is still holding (KMO-22, durable since KMO-23).
   *
   * Read here rather than inside the banner so the screen — which already owns
   * every other composition decision on it — is the one place that knows the
   * queue exists.
   */
  const pending = usePunchQueue(queue);

  /**
   * The connectivity edge that flushes the queue automatically (#4) — Art. 10's
   * own condition, `se realice automáticamente cuando recupere la señal`, and
   * not something `Sincronizar` merely offers to do.
   *
   * `online: true` here rather than `connectivity.online`, deliberately: this
   * fires from inside `useConnectivity`'s effect at the instant the OS reports
   * the `false → true` edge, which lands before this render's own `online`
   * closes over the new value. Reading the stale one would tell `flush` the
   * radio is still off at the exact moment it just came back.
   */
  const flushQueueOnRestore = useCallback((): void => {
    void queue.flush({ sync, online: true });
  }, [queue, sync]);

  /**
   * Whether the phone thinks it can reach anything (#1).
   *
   * Used for two things now: explaining a doomed `Sincronizar` press
   * immediately rather than spending a round trip on a radio that is off, and
   * firing the automatic flush above. It never decides that a punch belongs in
   * the queue — that is a request that actually failed, per §4.6 and the
   * header of `connectivity.ts` — and there is no setting anywhere that can put
   * the app in this state on purpose (#8).
   */
  const connectivity = useConnectivity({
    source: connectivitySource,
    onRestored: flushQueueOnRestore,
  });

  /** `Sincronizar` — the Art. 10 accelerator, never the mechanism (§4.1). */
  const flushQueue = useCallback((): void => {
    void queue.flush({ sync, online: connectivity.online });
  }, [connectivity.online, sync, queue]);

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

      {/* Above the location card, where the design puts it — and outside the
          three load states for the same reason that card is: what this says is
          a fact about the phone, and a `/me/today` that is slow or never
          arrives does not make an untransmitted punch any less untransmitted.

          It draws nothing at all when the queue is empty (#6), so there is no
          gate on it here: the count is what puts it on screen. */}
      <PendingSyncBanner
        count={pending.count}
        // `lastError` first: it means the flush stopped and everything still
        // waiting needs that explained. `lastNotice` (KMO-23 #12) is the other
        // case — a row left the queue with a refusal (a duplicate, or one of
        // the two offline-window 422s) while the flush kept going for the
        // rest, and the employee is told rather than it being dropped
        // silently.
        error={pending.lastError ?? pending.lastNotice}
        onSync={flushQueue}
        syncing={pending.syncing}
        testID="pending-sync-banner"
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

      {/* KMO-20 #5. Outside the three load states, like the location card and
          for the same kind of reason: Art. 22.1 access to the register is not
          conditional on today's summary having arrived, so an employee whose
          `/me/today` failed can still open their history and read a receipt. */}
      {canViewMarks ? (
        <TextLink
          label={es.marcaje.marks.open}
          onPress={openMarks}
          style={styles.openMarks}
          testID="marks-open"
        />
      ) : null}

      {/* The two sheets **swap** rather than stack: a row tapped in the list
          sets `receiptView`, which closes the list under it, and dismissing the
          comprobante puts the employee back on the list they came from. Two RN
          `Modal`s over each other is a stack neither platform agrees about, and
          there is nothing here that needs one. A row in the history is always
          a confirmed receipt — an offline draft never reaches `GET /marks`. */}
      <MarksSheet
        visible={marksOpen && receiptView === null}
        marks={marks}
        onSelect={(receipt) => setReceiptView({ kind: 'confirmed', receipt })}
        onDismiss={dismissMarks}
        testID="marks-sheet"
      />

      {/* Over everything, and only ever from a receipt the server answered with
          (KMO-19 #9, and the criterion KMO-17 left open at #10) or a punch this
          phone just queued (KMO-24). It is outside the three load states on
          purpose: a comprobante is about the punch that was just made, and a
          `/me/today` reload happening behind it must not take it off the
          screen the employee is reading.

          Since KMO-20 it also draws a *stored* mark, unchanged: the history
          hands it the same `PunchReceipt` the 201 does, so a retrieved receipt
          carries the folio and the hash the register recorded (#2, #3) — and,
          since KMO-24, the same offline provenance it was made with, if any. */}
      <ReceiptSheet view={receiptView} onDismiss={dismissReceipt} testID="receipt-sheet" />
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
  openMarks: {
    alignSelf: 'center',
    marginTop: spacing[5],
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
