import { render, screen, userEvent } from '@testing-library/react-native';

import { colors, hitTargetMin, radius, typography } from '@/theme';

import { ScreenHeader } from './screen-header';

const noop = () => {};

describe('ScreenHeader', () => {
  it('renders the screen title', async () => {
    await render(
      <ScreenHeader title="Mi jornada" avatarLabel="Abrir mi perfil" onPressAvatar={noop} />,
    );

    expect(screen.getByText('Mi jornada')).toHaveStyle({
      ...typography.h2,
      color: colors.textHeading,
    });
  });

  // #4 — the avatar is the only way to the profile, from every tab.
  it('opens the profile when the avatar is pressed', async () => {
    const user = userEvent.setup();
    const onPressAvatar = jest.fn();
    await render(
      <ScreenHeader
        title="Documentos"
        avatarLabel="Abrir mi perfil"
        onPressAvatar={onPressAvatar}
      />,
    );

    await user.press(screen.getByRole('button', { name: 'Abrir mi perfil' }));

    expect(onPressAvatar).toHaveBeenCalledTimes(1);
  });

  it('draws the avatar as the design does — a primary-filled circle', async () => {
    await render(
      <ScreenHeader title="Permisos" avatarLabel="Abrir mi perfil" onPressAvatar={noop} />,
    );

    expect(screen.getByTestId('profile-button')).toHaveStyle({
      backgroundColor: colors.primary,
      borderRadius: radius.pill,
    });
  });

  it('fills the avatar with the employee initials when there are any', async () => {
    await render(
      <ScreenHeader
        title="Permisos"
        avatarLabel="Abrir mi perfil"
        onPressAvatar={noop}
        avatarInitials="JL"
      />,
    );

    expect(screen.getByText('JL')).toHaveStyle({ color: colors.white });
  });

  // There is no session to read a name from until KMO-8, and placeholder
  // initials would be the sample data KMO-30 exists to keep out of a build.
  it('falls back to a glyph rather than to invented initials', async () => {
    await render(
      <ScreenHeader title="Permisos" avatarLabel="Abrir mi perfil" onPressAvatar={noop} />,
    );

    expect(screen.getByRole('button', { name: 'Abrir mi perfil' })).toBeOnTheScreen();
    expect(screen.queryByText(/^[A-Z]{1,3}$/)).not.toBeOnTheScreen();
  });

  it('gives the avatar the minimum hit target', async () => {
    await render(
      <ScreenHeader title="Inicio" avatarLabel="Abrir mi perfil" onPressAvatar={noop} />,
    );

    expect(screen.getByTestId('profile-button')).toHaveStyle({
      width: hitTargetMin,
      height: hitTargetMin,
    });
  });
});
