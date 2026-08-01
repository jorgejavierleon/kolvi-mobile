import { act, render as rtlRender, screen, userEvent } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { Text } from 'react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { colors, radius, spacing, withAlpha } from '@/theme';

import { BottomSheet } from './bottom-sheet';
import { Button } from './button';

const noop = () => {};

/**
 * A gesture-navigation Android phone: the pinned footer has to clear that
 * bottom inset, so the tests supply one rather than rendering into a device
 * with no safe area at all.
 */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const render = (ui: ReactElement) =>
  rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

function Comprobante({
  visible = true,
  onDismiss = noop,
  withFooter = true,
}: {
  visible?: boolean;
  onDismiss?: () => void;
  withFooter?: boolean;
}) {
  return (
    <BottomSheet
      visible={visible}
      onDismiss={onDismiss}
      dismissAccessibilityLabel="Cerrar comprobante"
      footer={withFooter ? <Button label="Listo" onPress={onDismiss} /> : undefined}
      testID="sheet"
    >
      <Text>¡Marca registrada!</Text>
    </BottomSheet>
  );
}

describe('BottomSheet', () => {
  it('renders nothing until it is visible', async () => {
    await render(<Comprobante visible={false} />);

    expect(screen.queryByText('¡Marca registrada!')).not.toBeOnTheScreen();
  });

  it('presents its body and its pinned footer when visible', async () => {
    await render(<Comprobante />);

    expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Listo' })).toBeOnTheScreen();
  });

  it('omits the footer when the caller has no action', async () => {
    await render(<Comprobante withFooter={false} />);

    expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Listo' })).not.toBeOnTheScreen();
  });

  it('lays a scrim of ink at half opacity over the screen', async () => {
    await render(<Comprobante />);

    expect(screen.getByTestId('bottom-sheet-scrim', { includeHiddenElements: true })).toHaveStyle({
      backgroundColor: withAlpha(colors.ink, 0.5),
    });
  });

  it('dismisses on backdrop press', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    await render(<Comprobante onDismiss={onDismiss} />);

    await user.press(screen.getByLabelText('Cerrar comprobante'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('names the backdrop, which is otherwise an unlabelled full-screen control', async () => {
    await render(<Comprobante />);

    expect(screen.getByRole('button', { name: 'Cerrar comprobante' })).toBeOnTheScreen();
  });

  it('dismisses on the Android back button', async () => {
    const onDismiss = jest.fn();
    await render(<Comprobante onDismiss={onDismiss} />);

    await act(async () => {
      screen.getByTestId('sheet').props.onRequestClose();
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not dismiss when the press lands on the sheet itself', async () => {
    // The backdrop is a sibling of the sheet, not its parent: as a parent it
    // would take the touch for every press inside the sheet that misses a
    // control, and close on an attempted scroll.
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    await render(<Comprobante onDismiss={onDismiss} />);

    await user.press(screen.getByText('¡Marca registrada!'));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('caps its height so the screen underneath stays visible behind the scrim', async () => {
    await render(<Comprobante />);

    // The body scrolls inside that cap; a long comprobante never pushes the
    // footer off the bottom.
    expect(screen.getByTestId('bottom-sheet-surface')).toHaveStyle({ maxHeight: '86%' });
  });

  it('rounds the top corners more than a card does', async () => {
    await render(<Comprobante />);

    // The design's 24dp — a card's radius plus a step of the spacing grid, so
    // the sheet reads as risen over the screen rather than as another card.
    expect(screen.getByTestId('bottom-sheet-surface')).toHaveStyle({
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
    });
    expect(radius.lg).toBeLessThan(24);
  });

  it('runs the slide-up rather than the platform modal animation', async () => {
    await render(<Comprobante />);

    expect(screen.getByTestId('sheet')).toHaveProp('animationType', 'none');
  });

  it('starts below its resting position, faded out', async () => {
    await render(<Comprobante />);

    // Where the slide-up begins. It settles on the native driver, which Jest
    // cannot step — the arrival is checked on the emulator by
    // flows/kmo-3-ui-primitives.yaml and its screenshot.
    expect(screen.getByTestId('bottom-sheet-surface')).toHaveStyle({
      opacity: 0,
      transform: [{ translateY: spacing[6] }],
    });
  });
});
