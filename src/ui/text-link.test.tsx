import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors, hitTargetMin } from '@/theme';

import { TextLink } from './text-link';

const noop = () => {};

describe('TextLink', () => {
  it('renders its label and calls onPress', async () => {
    const onPress = jest.fn();
    await render(<TextLink label="¿Olvidaste tu contraseña?" onPress={onPress} />);

    expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeOnTheScreen();

    fireEvent.press(screen.getByRole('link'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a link to a screen reader, not a button', async () => {
    await render(<TextLink label="¿Olvidaste tu contraseña?" onPress={noop} />);

    // The distinction matters on the login screen, where `Ingresar` is the
    // button: a screen reader user hearing two buttons has to guess which is
    // which from the label alone.
    expect(screen.getByRole('link')).toBeOnTheScreen();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('takes the full hit target even though it draws as text', async () => {
    await render(<TextLink label="¿Olvidaste tu contraseña?" onPress={noop} />);

    expect(screen.getByRole('link')).toHaveStyle({
      minHeight: hitTargetMin,
      minWidth: hitTargetMin,
    });
  });

  it('carries the underline as well as the colour', async () => {
    await render(<TextLink label="¿Olvidaste tu contraseña?" onPress={noop} />);

    // Colour alone is never the carrier of meaning in this app; a link that is
    // only tinted is invisible to an employee who cannot see the tint.
    expect(screen.getByText('¿Olvidaste tu contraseña?')).toHaveStyle({
      color: colors.primary,
      textDecorationLine: 'underline',
    });
  });
});
