import { render, screen } from '@testing-library/react-native';

import { PlaceholderScreen } from './placeholder-screen';

describe('PlaceholderScreen', () => {
  it('renders the app name and subtitle', async () => {
    await render(<PlaceholderScreen />);

    expect(screen.getByText('Kolvi')).toBeOnTheScreen();
    expect(screen.getByText('App de empleados')).toBeOnTheScreen();
  });
});
