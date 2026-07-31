import { render, screen } from '@testing-library/react-native';

import { colors, typography } from '@/theme';

import { PlaceholderScreen } from './placeholder-screen';

describe('PlaceholderScreen', () => {
  it('renders the app name and subtitle', async () => {
    await render(<PlaceholderScreen />);

    expect(screen.getByText('Kolvi')).toBeOnTheScreen();
    expect(screen.getByText('App de empleados')).toBeOnTheScreen();
  });

  it('takes its type and colour from the theme', async () => {
    await render(<PlaceholderScreen />);

    expect(screen.getByText('Kolvi')).toHaveStyle({
      ...typography.h1,
      color: colors.textHeading,
    });
    expect(screen.getByText('App de empleados')).toHaveStyle({
      ...typography.body,
      color: colors.textMuted,
    });
  });
});
