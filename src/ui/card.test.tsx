import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { colors, radius, shadows, spacing } from '@/theme';

import { Card } from './card';

describe('Card', () => {
  it('renders its children', async () => {
    await render(
      <Card>
        <Text>Turno de hoy</Text>
      </Card>,
    );

    expect(screen.getByText('Turno de hoy')).toBeOnTheScreen();
  });

  it('is the white surface at radius-lg with shadow-1', async () => {
    await render(<Card testID="card">{null}</Card>);

    expect(screen.getByTestId('card')).toHaveStyle({
      backgroundColor: colors.surfaceCard,
      borderRadius: radius.lg,
      ...shadows.level1,
    });
  });

  it('pads on the grid by default and drops the padding on request', async () => {
    await render(<Card testID="card">{null}</Card>);
    expect(screen.getByTestId('card')).toHaveStyle({ padding: spacing[4] });

    await screen.rerender(
      <Card testID="card" padded={false}>
        {null}
      </Card>,
    );
    expect(screen.getByTestId('card')).not.toHaveStyle({ padding: spacing[4] });
  });

  it('sets no height, so a card grows with a scaled-up label', async () => {
    await render(
      <Card testID="card">
        <Text>Vie 24 jul</Text>
      </Card>,
    );

    expect(screen.getByTestId('card').props.style).toEqual(
      expect.not.objectContaining({ height: expect.anything() }),
    );
  });

  it('stays out of the accessibility tree unless the caller opts in', async () => {
    // A card is a container. Where it is tappable the caller wraps it, so the
    // role and the hit target belong to the wrapper, not to this.
    await render(<Card testID="card">{null}</Card>);
    expect(screen.getByTestId('card')).not.toHaveProp('accessibilityRole', 'button');

    await screen.rerender(
      <Card testID="card" accessible accessibilityRole="summary" accessibilityLabel="Turno de hoy">
        {null}
      </Card>,
    );
    expect(screen.getByLabelText('Turno de hoy')).toBeOnTheScreen();
  });
});
