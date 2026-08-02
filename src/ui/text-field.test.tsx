import { fireEvent, render, screen, userEvent } from '@testing-library/react-native';

import { colors, hitTargetMin, radius, tones, typography } from '@/theme';

import { TextField } from './text-field';

const noop = () => {};

function renderPassword(props: Partial<React.ComponentProps<typeof TextField>> = {}) {
  return render(
    <TextField
      label="Contraseña"
      value="secreto"
      onChangeText={noop}
      secureTextEntry
      revealLabel="Mostrar contraseña"
      hideLabel="Ocultar contraseña"
      testID="password"
      {...props}
    />,
  );
}

describe('TextField', () => {
  it('renders the label above the field and speaks it as the field name', async () => {
    await render(
      <TextField label="Correo electrónico" value="" onChangeText={noop} testID="email" />,
    );

    expect(screen.getByText('Correo electrónico')).toBeOnTheScreen();
    expect(screen.getByLabelText('Correo electrónico')).toBeOnTheScreen();
  });

  it('reports what the employee types', async () => {
    const onChangeText = jest.fn();
    await render(<TextField label="Correo" value="" onChangeText={onChangeText} testID="email" />);

    fireEvent.changeText(screen.getByTestId('email'), 'employee@example.com');

    expect(onChangeText).toHaveBeenCalledWith('employee@example.com');
  });

  it('keeps the label visible once there is a value, unlike a placeholder', async () => {
    await render(
      <TextField
        label="Correo"
        value="employee@example.com"
        onChangeText={noop}
        placeholder="nombre@empresa.cl"
      />,
    );

    expect(screen.getByText('Correo')).toBeOnTheScreen();
  });

  it('takes its outline, corner and type from the tokens', async () => {
    await render(<TextField label="Correo" value="" onChangeText={noop} testID="email" />);

    expect(screen.getByTestId('email')).toHaveStyle(typography.body);
    expect(screen.getByTestId('email-outline')).toHaveStyle({
      borderRadius: radius.md,
      borderColor: colors.border,
      backgroundColor: colors.surfaceCard,
    });
  });

  describe('password', () => {
    // #7 — masked by default.
    it('masks the value until the toggle is pressed', async () => {
      const user = userEvent.setup();
      await renderPassword();

      expect(screen.getByTestId('password')).toHaveProp('secureTextEntry', true);

      await user.press(screen.getByTestId('password-reveal'));

      expect(screen.getByTestId('password')).toHaveProp('secureTextEntry', false);
    });

    it('masks it again on a second press', async () => {
      const user = userEvent.setup();
      await renderPassword();

      await user.press(screen.getByTestId('password-reveal'));
      await user.press(screen.getByTestId('password-reveal'));

      expect(screen.getByTestId('password')).toHaveProp('secureTextEntry', true);
    });

    it('renames the toggle rather than only swapping the glyph', async () => {
      const user = userEvent.setup();
      await renderPassword();

      expect(screen.getByLabelText('Mostrar contraseña')).toBeOnTheScreen();

      await user.press(screen.getByTestId('password-reveal'));

      expect(screen.getByLabelText('Ocultar contraseña')).toBeOnTheScreen();
    });

    it('gives the toggle a full hit target', async () => {
      await renderPassword();

      expect(screen.getByTestId('password-reveal')).toHaveStyle({
        width: hitTargetMin,
        height: hitTargetMin,
      });
    });

    it('has no toggle on a field that is not a password', async () => {
      await render(<TextField label="Correo" value="" onChangeText={noop} testID="email" />);

      expect(screen.queryByTestId('email-reveal')).not.toBeOnTheScreen();
    });
  });

  describe('error', () => {
    it('shows the message and turns the outline, never colour alone', async () => {
      await render(
        <TextField
          label="Correo"
          value=""
          onChangeText={noop}
          error="Ingresa tu correo electrónico."
          testID="email"
        />,
      );

      expect(screen.getByText('Ingresa tu correo electrónico.')).toBeOnTheScreen();
      expect(screen.getByTestId('email-outline')).toHaveStyle({
        borderColor: tones.danger.foreground,
      });
    });

    it('reports the field as invalid to a screen reader', async () => {
      await render(
        <TextField label="Correo" value="" onChangeText={noop} error="Revísalo." testID="email" />,
      );

      expect(screen.getByTestId('email')).toHaveProp('aria-invalid', true);
    });

    it('announces the message when it appears', async () => {
      await render(
        <TextField label="Correo" value="" onChangeText={noop} error="Revísalo." testID="email" />,
      );

      expect(screen.getByText('Revísalo.')).toHaveProp('accessibilityLiveRegion', 'polite');
    });

    it('is valid and shows nothing when there is no error', async () => {
      await render(<TextField label="Correo" value="" onChangeText={noop} testID="email" />);

      expect(screen.getByTestId('email')).toHaveProp('aria-invalid', false);
      expect(screen.getByTestId('email-outline')).toHaveStyle({ borderColor: colors.border });
    });
  });
});
