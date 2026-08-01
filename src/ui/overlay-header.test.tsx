import { render as rtlRender, screen, userEvent } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { colors, hitTargetMin, spacing, typography } from '@/theme';

import { OverlayHeader } from './overlay-header';

/** A phone with a status bar — the bar has to run underneath it. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const render = (ui: ReactElement) =>
  rtlRender(ui, {
    wrapper: ({ children }: { children: ReactElement }) => (
      <SafeAreaProvider initialMetrics={metrics}>{children}</SafeAreaProvider>
    ),
  });

const noop = () => {};

describe('OverlayHeader', () => {
  it('renders the surface title', async () => {
    await render(<OverlayHeader title="Mi perfil" backLabel="Volver" onBack={noop} />);

    expect(screen.getByText('Mi perfil')).toHaveStyle({
      ...typography.h3,
      color: colors.textHeading,
    });
  });

  // #4 — the back affordance. A lone chevron has no text of its own, so the
  // label is the only thing that names it to a screen reader.
  it('names the back control and reports the press', async () => {
    const user = userEvent.setup();
    const onBack = jest.fn();
    await render(<OverlayHeader title="Mi perfil" backLabel="Volver" onBack={onBack} />);

    await user.press(screen.getByRole('button', { name: 'Volver' }));

    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('sits on the white bar with the design border-bottom', async () => {
    await render(
      <OverlayHeader title="Mi perfil" backLabel="Volver" onBack={noop} testID="header" />,
    );

    expect(screen.getByTestId('header')).toHaveStyle({
      backgroundColor: colors.surfaceCard,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    });
  });

  // It is the topmost thing on the surface, so its white runs under the status
  // bar rather than leaving a strip of page tint above it.
  it('runs its own surface under the status bar', async () => {
    await render(
      <OverlayHeader title="Mi perfil" backLabel="Volver" onBack={noop} testID="header" />,
    );

    expect(screen.getByTestId('header')).toHaveStyle({
      paddingTop: spacing[4] + metrics.insets.top,
    });
  });

  it('gives the back control the minimum hit target', async () => {
    await render(<OverlayHeader title="Mi perfil" backLabel="Volver" onBack={noop} />);

    expect(screen.getByTestId('overlay-back')).toHaveStyle({
      width: hitTargetMin,
      height: hitTargetMin,
    });
  });
});
