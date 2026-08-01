import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { colors, hitTargetMin, radius, tones, typography } from '@/theme';

import { Button, type ButtonSize, type ButtonVariant } from './button';

const noop = () => {};

/**
 * The spinner is deliberately outside the accessibility tree, which is exactly
 * what RNTL treats as hidden — so it has to be asked for explicitly.
 */
const spinner = () => screen.getByTestId('button-spinner', { includeHiddenElements: true });

describe('Button', () => {
  it('renders its label and calls onPress', async () => {
    const onPress = jest.fn();
    await render(<Button label="Marcar entrada" onPress={onPress} />);

    expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  describe('variants', () => {
    it('fills primary with ink and accent with coral', async () => {
      await render(<Button label="Listo" onPress={noop} variant="primary" />);
      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: colors.ink,
        borderWidth: 0,
      });
      expect(screen.getByText('Listo')).toHaveStyle({ color: colors.white });

      await screen.rerender(<Button label="Marcar entrada" onPress={noop} variant="accent" />);
      expect(screen.getByRole('button')).toHaveStyle({ backgroundColor: colors.accentCoral });
      expect(screen.getByText('Marcar entrada')).toHaveStyle({ color: colors.white });
    });

    it('outlines secondary in the border colour on a white surface', async () => {
      await render(<Button label="Reintentar ubicación" onPress={noop} variant="secondary" />);

      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: colors.surfaceCard,
        borderColor: colors.border,
        borderWidth: 1,
      });
      expect(screen.getByText('Reintentar ubicación')).toHaveStyle({ color: colors.slate });
    });

    it('outlines danger in the danger tone, never filling it', async () => {
      await render(<Button label="Rechazar" onPress={noop} variant="danger" />);

      expect(screen.getByRole('button')).toHaveStyle({
        backgroundColor: 'transparent',
        borderColor: tones.danger.foreground,
        borderWidth: 1,
      });
      expect(screen.getByText('Rechazar')).toHaveStyle({ color: tones.danger.foreground });
    });

    it('takes its corner from the radius token, never a bare number', async () => {
      await render(<Button label="Listo" onPress={noop} />);

      expect(screen.getByRole('button')).toHaveStyle({ borderRadius: radius.md });
    });
  });

  describe('sizes', () => {
    // #7 — the floor, not the target: every size clears it, so no button in the
    // app can end up below the minimum by picking the wrong one.
    it.each<[ButtonSize, number]>([
      ['sm', hitTargetMin],
      ['md', 52],
      ['lg', 64],
    ])('gives %s a %ddp minimum height', async (size, expected) => {
      await render(<Button label="Listo" onPress={noop} size={size} />);

      expect(screen.getByRole('button')).toHaveStyle({ minHeight: expected });
      expect(expected).toBeGreaterThanOrEqual(hitTargetMin);
    });

    it('sets a minimum height rather than a height, so a scaled label is not clipped', async () => {
      await render(<Button label="Marcar de todas formas" onPress={noop} />);

      expect(screen.getByRole('button')).not.toHaveStyle({ height: 52 });
    });

    it('types the label from a preset — sm at label, md and lg at h3', async () => {
      await render(<Button label="Listo" onPress={noop} size="sm" />);
      expect(screen.getByText('Listo')).toHaveStyle(typography.label);

      await screen.rerender(<Button label="Listo" onPress={noop} size="md" />);
      expect(screen.getByText('Listo')).toHaveStyle(typography.h3);
    });
  });

  describe('disabled', () => {
    it('dims rather than hides, and blocks the press', async () => {
      const onPress = jest.fn();
      await render(<Button label="Marcar entrada" onPress={onPress} disabled />);

      // #1 — still on screen and still readable. An employee outside the
      // geofence has to see the action they cannot take.
      expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();
      expect(screen.getByRole('button')).toHaveStyle({ opacity: 0.6 });

      fireEvent.press(screen.getByRole('button'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('announces itself as disabled', async () => {
      await render(<Button label="Marcar entrada" onPress={noop} disabled />);

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('loading', () => {
    it('shows the spinner, keeps the label and blocks the press', async () => {
      const onPress = jest.fn();
      await render(<Button label="Marcar entrada" onPress={onPress} loading />);

      expect(spinner()).toBeOnTheScreen();
      expect(screen.getByText('Marcar entrada')).toBeOnTheScreen();

      fireEvent.press(screen.getByRole('button'));
      expect(onPress).not.toHaveBeenCalled();
    });

    it('reads as busy and not as disabled', async () => {
      await render(<Button label="Marcar entrada" onPress={noop} loading />);

      // A punch in flight was pressed on purpose. "Dimmed" would be a lie, and
      // it is also not dimmed on screen.
      expect(screen.getByRole('button')).toBeBusy();
      expect(screen.getByRole('button')).toBeEnabled();
      expect(screen.getByRole('button')).toHaveStyle({ opacity: 1 });
    });

    it('keeps the spinner out of the accessibility tree', async () => {
      await render(<Button label="Marcar entrada" onPress={noop} loading />);

      expect(spinner()).toHaveProp('accessibilityElementsHidden', true);
    });

    it('shows no spinner when idle', async () => {
      await render(<Button label="Marcar entrada" onPress={noop} />);

      expect(
        screen.queryByTestId('button-spinner', { includeHiddenElements: true }),
      ).not.toBeOnTheScreen();
    });
  });

  describe('accessibility', () => {
    it('exposes the label as the accessible name by default', async () => {
      await render(<Button label="Sincronizar" onPress={noop} />);

      expect(screen.getByLabelText('Sincronizar')).toBeOnTheScreen();
    });

    it('lets the caller override the name and add a hint', async () => {
      await render(
        <Button
          label="Copiar"
          onPress={noop}
          accessibilityLabel="Copiar hash de verificación"
          accessibilityHint="Copia el hash al portapapeles"
        />,
      );

      expect(screen.getByLabelText('Copiar hash de verificación')).toBeOnTheScreen();
      expect(screen.getByRole('button')).toHaveProp(
        'accessibilityHint',
        'Copia el hash al portapapeles',
      );
    });

    it.each<ButtonVariant>(['primary', 'accent', 'secondary', 'danger'])(
      'exposes the button role for %s',
      async (variant) => {
        await render(<Button label="Listo" onPress={noop} variant={variant} />);

        expect(screen.getByRole('button', { name: 'Listo' })).toBeOnTheScreen();
      },
    );

    it('is reachable by a real press gesture, not only a synthetic event', async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await render(<Button label="Listo" onPress={onPress} />);

      await user.press(screen.getByRole('button'));

      expect(onPress).toHaveBeenCalledTimes(1);
    });
  });
});
