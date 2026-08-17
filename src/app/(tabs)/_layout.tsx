import { Tabs, type BottomTabBarProps } from 'expo-router/js-tabs';

import { useSession } from '@/features/auth/session';
import { UnverifiedSessionBanner } from '@/features/auth/unverified-session-banner';
import { usePendingCorrections } from '@/features/jornada/use-pending-corrections';
import { es, tabWithPendingCount } from '@/i18n';
import { colors } from '@/theme';
import { CalendarCheckIcon, ClockIcon, FileTextIcon, HomeIcon, type IconProps } from '@/ui/icons';
import { TabBar, type TabBarItem } from '@/ui/tab-bar';

/**
 * The four tabs, in the order the design draws them.
 *
 * The order is declared here rather than left to the router: Expo Router sorts
 * routes by filename with `index` first, which would put Documentos second.
 * Since the bar is drawn by hand anyway, it reads this table and looks each
 * route up by name.
 *
 * `key` is separate from `route` on purpose. It is what the bar's `testID`s are
 * built from, so a flow taps `tab-inicio` rather than `tab-index` — and rather
 * than the tab's own label, which on Inicio is the same word as the screen
 * title beneath it and would make the tap ambiguous.
 */
const tabs = [
  { key: 'inicio', route: 'index', label: es.tabs.inicio, icon: HomeIcon, pending: 'none' },
  {
    key: 'jornada',
    route: 'jornada',
    label: es.tabs.jornada,
    icon: ClockIcon,
    pending: 'corrections',
  },
  {
    key: 'permisos',
    route: 'permisos',
    label: es.tabs.permisos,
    icon: CalendarCheckIcon,
    pending: 'none',
  },
  {
    key: 'documentos',
    route: 'documentos',
    label: es.tabs.documentos,
    icon: FileTextIcon,
    pending: 'signatures',
  },
] as const satisfies readonly {
  key: string;
  route: string;
  label: string;
  icon: (props: IconProps) => React.ReactElement;
  pending: 'none' | 'corrections' | 'signatures';
}[];

/**
 * A correction fetch this tab bar does not need to make: an employee without
 * `ReviewOwn:MarkModification` has nothing to review, so `usePendingCorrections`
 * still runs (rules of hooks — the bar is always mounted) but against this
 * no-op client rather than asking a server it would get a 403 back from.
 */
const noCorrectionsApi = {
  fetchPendingCorrections: async () => [],
  approve: async () => {},
  decline: async () => {},
};

function KolviTabBar({ state, navigation }: BottomTabBarProps) {
  const active = state.routes[state.index];

  const session = useSession();
  const canReviewCorrections = session.can('ReviewOwn:MarkModification');
  const corrections = usePendingCorrections(canReviewCorrections ? undefined : noCorrectionsApi);

  /**
   * Mark corrections awaiting the employee's approval, and documents awaiting
   * their signature. Corrections come from the same request `JornadaScreen`'s
   * own pending-correction cards make (KMO-35) — this app has no shared
   * fetch cache, so the bar and the screen each hold their own subscription,
   * the same reasoning `use-upcoming-shifts.ts` gives for two screens' loads
   * being independent. Signatures stay zero until KMO-42 wires it; seeding it
   * with a number to make the badge visible would be exactly the sample data
   * KMO-30 exists to keep out of a build, so that badge's own behaviour is
   * covered by `tab-bar.test.tsx` instead.
   */
  const pendingCounts = {
    none: 0,
    corrections: corrections.status === 'loaded' ? corrections.corrections.length : 0,
    signatures: 0,
  } as const;

  const items = tabs.flatMap<TabBarItem>(({ key, route: name, label, icon, pending }) => {
    // A tab whose route is missing is a wiring mistake, not a runtime state.
    // Dropping it keeps the bar usable rather than crashing the whole shell.
    if (!state.routes.some((route) => route.name === name)) {
      return [];
    }

    const badgeCount = pendingCounts[pending];

    return [
      {
        key,
        label,
        icon,
        accessibilityLabel: badgeCount > 0 ? tabWithPendingCount(label, badgeCount) : label,
        badgeCount,
      },
    ];
  });

  return (
    <TabBar
      items={items}
      activeKey={tabs.find(({ route }) => route === active?.name)?.key ?? ''}
      accessibilityLabel={es.navigation.tabBar}
      testID="tab-bar"
      onSelect={(key) => {
        const name = tabs.find((tab) => tab.key === key)?.route;
        const route = state.routes.find((candidate) => candidate.name === name);

        if (route === undefined) {
          return;
        }

        // The standard tab-press contract: emit first so a screen can claim the
        // press — scroll-to-top on a second tap, an unsaved-changes guard — and
        // only navigate if nobody did and we are not already there.
        const event = navigation.emit({
          type: 'tabPress',
          target: route.key,
          canPreventDefault: true,
        });

        if (route.key !== active?.key && !event.defaultPrevented) {
          navigation.navigate(route.name, route.params);
        }
      }}
    />
  );
}

/**
 * The persistent chrome. Every tab keeps its own navigation state and scroll
 * position while the employee is elsewhere, which is React Navigation's default
 * for a tab navigator and the reason the shell uses one rather than swapping a
 * single screen's contents.
 */
export default function TabsLayout() {
  return (
    <>
      {/* Above the navigator, not inside any one tab's own `Screen` — a
          session fact is true on every tab at once (docs/design-decisions.md
          §4.7 D2). Draws its own top inset only when it has something to
          show, so a verified session — nearly always — gets no dead space
          above the tab it's actually on. */}
      <UnverifiedSessionBanner />

      <Tabs
        screenOptions={{
          // Each tab draws its own header inside its scroll area, as the design
          // does; see `ScreenHeader`.
          headerShown: false,
          sceneStyle: { backgroundColor: colors.surfacePage },
        }}
        tabBar={(props: BottomTabBarProps) => <KolviTabBar {...props} />}
      />
    </>
  );
}
