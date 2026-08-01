import { render as rtlRender, screen, userEvent } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { tabWithPendingCount } from '@/i18n';
import { colors, hitTargetMin, radius, spacing } from '@/theme';

import { CalendarCheckIcon, ClockIcon, FileTextIcon, HomeIcon } from './icons';
import { TabBar, type TabBarItem } from './tab-bar';

/** A gesture-navigation Android phone — the bar has to clear that bottom inset. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const Wrapper = ({ children }: { children: ReactElement }) => (
  <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
);

/** Rendered through a wrapper rather than a fragment so `rerender` keeps it. */
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: Wrapper });

const noop = () => {};

/**
 * The badge is deliberately outside the accessibility tree, and the queries
 * skip hidden elements by default — so every assertion about whether the pill
 * was drawn has to opt back in. That the default query finds nothing is itself
 * asserted below, as the thing that proves it is hidden.
 */
const badge = (tab: string) =>
  screen.queryByTestId(`tab-${tab}-badge`, { includeHiddenElements: true });

/** The four tabs as `src/app/(tabs)/_layout.tsx` composes them. */
function tabs({
  corrections = 0,
  signatures = 0,
}: { corrections?: number; signatures?: number } = {}): readonly TabBarItem[] {
  return [
    { key: 'inicio', label: 'Inicio', icon: HomeIcon, accessibilityLabel: 'Inicio' },
    {
      key: 'jornada',
      label: 'Jornada',
      icon: ClockIcon,
      accessibilityLabel: corrections > 0 ? tabWithPendingCount('Jornada', corrections) : 'Jornada',
      badgeCount: corrections,
    },
    { key: 'permisos', label: 'Permisos', icon: CalendarCheckIcon, accessibilityLabel: 'Permisos' },
    {
      key: 'documentos',
      label: 'Documentos',
      icon: FileTextIcon,
      accessibilityLabel:
        signatures > 0 ? tabWithPendingCount('Documentos', signatures) : 'Documentos',
      badgeCount: signatures,
    },
  ];
}

describe('TabBar', () => {
  // #1 — the four items, in the design's order.
  it('renders the four tabs with the design labels', async () => {
    await render(<TabBar items={tabs()} activeKey="inicio" onSelect={noop} />);

    expect(screen.getAllByRole('tab').map((tab) => tab.props.accessibilityLabel)).toEqual([
      'Inicio',
      'Jornada',
      'Permisos',
      'Documentos',
    ]);
  });

  // #1 — the active tab in the primary colour, the rest muted. Asserted on both
  // the icon and the label because the design colours them together.
  it('tints the active tab primary and the inactive ones muted', async () => {
    await render(<TabBar items={tabs()} activeKey="jornada" onSelect={noop} />);

    expect(screen.getByText('Jornada')).toHaveStyle({ color: colors.primary });

    for (const label of ['Inicio', 'Permisos', 'Documentos']) {
      expect(screen.getByText(label)).toHaveStyle({ color: colors.textMuted });
    }
  });

  it('moves the tint when the active tab changes', async () => {
    await render(<TabBar items={tabs()} activeKey="inicio" onSelect={noop} />);
    expect(screen.getByRole('tab', { name: 'Inicio' })).toBeSelected();

    await screen.rerender(<TabBar items={tabs()} activeKey="documentos" onSelect={noop} />);

    expect(screen.getByRole('tab', { name: 'Documentos' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Inicio' })).not.toBeSelected();
    expect(screen.getByText('Inicio')).toHaveStyle({ color: colors.textMuted });
  });

  it('reports the key of the tab pressed', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    await render(<TabBar items={tabs()} activeKey="inicio" onSelect={onSelect} />);

    await user.press(screen.getByRole('tab', { name: 'Permisos' }));

    expect(onSelect).toHaveBeenCalledWith('permisos');
  });

  // #2 — the white surface with the design's border-top.
  it('sits on the white surface with the border-top from the design', async () => {
    await render(<TabBar items={tabs()} activeKey="inicio" onSelect={noop} testID="bar" />);

    expect(screen.getByTestId('bar')).toHaveStyle({
      backgroundColor: colors.surfaceCard,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    });
  });

  // #2 — the bar is the last thing above the system navigation bar, so the
  // inset is added to its own padding rather than replacing it.
  it('adds the device bottom inset to its padding', async () => {
    await render(<TabBar items={tabs()} activeKey="inicio" onSelect={noop} testID="bar" />);

    expect(screen.getByTestId('bar')).toHaveStyle({
      paddingBottom: spacing[3] + metrics.insets.bottom,
    });
  });

  describe('the pending-count badge', () => {
    // #3 — nothing at zero. A grey or empty pill would read as "something is
    // waiting" on the tabs where nothing is.
    it('draws no badge when the count is zero', async () => {
      await render(<TabBar items={tabs()} activeKey="inicio" onSelect={noop} />);

      expect(badge('jornada')).toBeNull();
      expect(badge('documentos')).toBeNull();
    });

    // #3 — Jornada carries pending mark corrections, Documentos pending
    // signatures, and neither of the other two carries a count at all.
    it('draws a coral badge on Jornada and Documentos when their counts are positive', async () => {
      await render(
        <TabBar
          items={tabs({ corrections: 2, signatures: 3 })}
          activeKey="inicio"
          onSelect={noop}
        />,
      );

      expect(badge('jornada')).toHaveStyle({
        backgroundColor: colors.accentCoral,
        borderRadius: radius.pill,
      });
      expect(screen.getByText('2', { includeHiddenElements: true })).toBeOnTheScreen();

      expect(badge('documentos')).not.toBeNull();
      expect(screen.getByText('3', { includeHiddenElements: true })).toBeOnTheScreen();

      expect(badge('inicio')).toBeNull();
      expect(badge('permisos')).toBeNull();
    });

    it('badges only the tab whose count is positive', async () => {
      await render(<TabBar items={tabs({ signatures: 1 })} activeKey="inicio" onSelect={noop} />);

      expect(badge('jornada')).toBeNull();
      expect(badge('documentos')).not.toBeNull();
    });
  });

  describe('accessibility', () => {
    // #6 — the count is spoken as part of the tab's own name. The pill itself
    // is out of the tree, so this is the only way it is announced at all.
    it('speaks the tab name and its pending count', async () => {
      await render(
        <TabBar
          items={tabs({ corrections: 2, signatures: 1 })}
          activeKey="inicio"
          onSelect={noop}
        />,
      );

      expect(screen.getByRole('tab', { name: 'Jornada, 2 pendientes' })).toBeOnTheScreen();
      expect(screen.getByRole('tab', { name: 'Documentos, 1 pendiente' })).toBeOnTheScreen();
    });

    it('drops the count from the name once nothing is pending', async () => {
      await render(<TabBar items={tabs()} activeKey="inicio" onSelect={noop} />);

      expect(screen.getByRole('tab', { name: 'Jornada' })).toBeOnTheScreen();
      expect(screen.getByRole('tab', { name: 'Documentos' })).toBeOnTheScreen();
    });

    it('keeps the badge itself out of the accessibility tree', async () => {
      await render(<TabBar items={tabs({ corrections: 2 })} activeKey="inicio" onSelect={noop} />);

      // Drawn…
      expect(badge('jornada')).not.toBeNull();
      // …and invisible to the queries that skip what a screen reader skips.
      expect(screen.queryByTestId('tab-jornada-badge')).toBeNull();
      expect(screen.queryByText('2')).toBeNull();
    });

    it('is a tablist that names itself and reports which tab is selected', async () => {
      await render(
        <TabBar
          items={tabs()}
          activeKey="permisos"
          onSelect={noop}
          accessibilityLabel="Secciones de la app"
          testID="bar"
        />,
      );

      expect(screen.getByTestId('bar')).toHaveProp('accessibilityRole', 'tablist');
      expect(screen.getByTestId('bar')).toHaveProp('accessibilityLabel', 'Secciones de la app');
      expect(screen.getByRole('tab', { name: 'Permisos' })).toBeSelected();
    });

    // The same rule that sizes the segmented control in KMO-3: a tab is a
    // control, so the 44dp minimum wins over the design's tighter row.
    it('gives every tab the minimum hit target', async () => {
      await render(<TabBar items={tabs()} activeKey="inicio" onSelect={noop} />);

      for (const tab of screen.getAllByRole('tab')) {
        expect(tab).toHaveStyle({ minHeight: hitTargetMin });
      }
    });
  });
});
