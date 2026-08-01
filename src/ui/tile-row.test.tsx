import { render, screen } from '@testing-library/react-native';

import { colors, spacing, typography } from '@/theme';

import { TileRow, type Tile } from './tile-row';

const workday: readonly Tile[] = [
  { label: 'Trabajado', value: '08:00' },
  { label: 'Extra', value: '00:03' },
  { label: 'Faltante', value: '00:00' },
];

describe('TileRow', () => {
  it('renders every label over its value', async () => {
    await render(<TileRow tiles={workday} />);

    for (const { label, value } of workday) {
      expect(screen.getByText(label)).toBeOnTheScreen();
      expect(screen.getByText(value)).toBeOnTheScreen();
    }
  });

  it('types the label as an eyebrow and the value as a display figure', async () => {
    await render(<TileRow tiles={workday} />);

    expect(screen.getByText('Trabajado')).toHaveStyle({
      ...typography.eyebrow,
      color: colors.textMuted,
    });
    expect(screen.getByText('08:00')).toHaveStyle({
      ...typography.h3,
      color: colors.textHeading,
    });
  });

  it('lays the tiles out in a row on the spacing grid', async () => {
    await render(<TileRow tiles={workday} testID="tiles" />);

    expect(screen.getByTestId('tiles')).toHaveStyle({
      flexDirection: 'row',
      gap: spacing[4],
    });
  });

  it('wraps rather than clipping when the tiles no longer fit across', async () => {
    await render(<TileRow tiles={workday} testID="tiles" />);

    expect(screen.getByTestId('tiles')).toHaveStyle({ flexWrap: 'wrap' });
  });

  it('announces each label and value as one element', async () => {
    await render(<TileRow tiles={workday} />);

    // Two adjacent strings would be read as unrelated; "Faltante 00:00" is the
    // fact the employee is checking.
    expect(screen.getByLabelText('Trabajado 08:00')).toBeOnTheScreen();
    expect(screen.getByLabelText('Extra 00:03')).toBeOnTheScreen();
    expect(screen.getByLabelText('Faltante 00:00')).toBeOnTheScreen();
  });

  it('renders whatever tiles it is handed, in order', async () => {
    await render(<TileRow tiles={[{ label: 'Trabajado', value: '—' }]} />);

    expect(screen.getByLabelText('Trabajado —')).toBeOnTheScreen();
    expect(screen.queryByText('Extra')).not.toBeOnTheScreen();
  });
});
