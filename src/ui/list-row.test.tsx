import { fireEvent, render, screen } from '@testing-library/react-native';

import { colors, hitTargetMin, typography } from '@/theme';

import { ListRow } from './list-row';

const noop = () => {};

describe('ListRow', () => {
  it('renders the title over its subtitle with the trailing value beside them', async () => {
    await render(
      <ListRow
        accessibilityLabel="Entrada · Mié 5 ago · 08:03"
        onPress={noop}
        subtitle="Mié 5 ago"
        title="Entrada"
        trailing="08:03"
      />,
    );

    expect(screen.getByText('Entrada')).toBeOnTheScreen();
    expect(screen.getByText('Mié 5 ago')).toBeOnTheScreen();
    expect(screen.getByText('08:03')).toBeOnTheScreen();
  });

  it('draws the subtitle and the trailing value only when it has them', async () => {
    await render(<ListRow accessibilityLabel="Solo el título" onPress={noop} title="Entrada" />);

    expect(screen.getByText('Entrada')).toBeOnTheScreen();
    expect(screen.queryByText('Mié 5 ago')).not.toBeOnTheScreen();
  });

  it('announces the whole row as one element rather than three strings', async () => {
    await render(
      <ListRow
        accessibilityLabel="Entrada · Mié 5 ago · 08:03"
        onPress={noop}
        subtitle="Mié 5 ago"
        title="Entrada"
        trailing="08:03"
      />,
    );

    expect(screen.getByLabelText('Entrada · Mié 5 ago · 08:03')).toBeOnTheScreen();
  });

  it('reports a press', async () => {
    const onPress = jest.fn();

    await render(<ListRow accessibilityLabel="Entrada" onPress={onPress} title="Entrada" />);

    fireEvent.press(screen.getByLabelText('Entrada'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is a button, and takes the full hit target', async () => {
    await render(
      <ListRow accessibilityLabel="Entrada" onPress={noop} testID="row" title="Entrada" />,
    );

    // A row an employee can only discover by tapping is not a control. The role
    // is what announces it as one, and the 44dp is what makes it pressable with
    // a gloved thumb.
    expect(screen.getByRole('button', { name: 'Entrada' })).toBeOnTheScreen();
    expect(screen.getByTestId('row')).toHaveStyle({ minHeight: hitTargetMin });
  });

  it('separates itself from the row below it', async () => {
    await render(
      <ListRow accessibilityLabel="Entrada" onPress={noop} testID="row" title="Entrada" />,
    );

    expect(screen.getByTestId('row')).toHaveStyle({ borderBottomColor: colors.border });
  });

  it('drops the hairline on the last row, where it would read as a stray rule', async () => {
    await render(
      <ListRow
        accessibilityLabel="Entrada"
        divider={false}
        onPress={noop}
        testID="row"
        title="Entrada"
      />,
    );

    expect(screen.getByTestId('row')).not.toHaveStyle({ borderBottomColor: colors.border });
  });

  it('types the row as content rather than as an action', async () => {
    await render(
      <ListRow
        accessibilityLabel="Entrada"
        onPress={noop}
        subtitle="Mié 5 ago"
        title="Entrada"
        trailing="08:03"
      />,
    );

    expect(screen.getByText('Entrada')).toHaveStyle({
      ...typography.label,
      color: colors.textHeading,
    });
    expect(screen.getByText('Mié 5 ago')).toHaveStyle({
      ...typography.caption,
      color: colors.textMuted,
    });
    expect(screen.getByText('08:03')).toHaveStyle({
      ...typography.h3,
      color: colors.textHeading,
    });
  });
});
