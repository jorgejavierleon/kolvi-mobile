import { render, screen } from '@testing-library/react-native';

import { UpcomingShiftRow } from './upcoming-shift-row';

describe('UpcomingShiftRow', () => {
  it('shows the date, the premise and the trailing value', async () => {
    await render(
      <UpcomingShiftRow
        dateLabel="Mañana · Vie 14 ago"
        premise="Sucursal Ñuñoa"
        trailing="08:00 – 17:00"
      />,
    );

    expect(screen.getByText('Mañana · Vie 14 ago')).toBeOnTheScreen();
    expect(screen.getByText('Sucursal Ñuñoa')).toBeOnTheScreen();
    expect(screen.getByText('08:00 – 17:00')).toBeOnTheScreen();
  });

  it('draws no premise line when there is none', async () => {
    await render(
      <UpcomingShiftRow dateLabel="Vie 14 ago" premise={null} trailing="08:00 – 17:00" />,
    );

    expect(screen.queryByText('Sucursal Ñuñoa')).toBeNull();
  });

  it('announces the whole row as one accessible element', async () => {
    await render(
      <UpcomingShiftRow dateLabel="Vie 14 ago" premise="Sucursal Ñuñoa" trailing="08:00 – 17:00" />,
    );

    expect(screen.getByLabelText('Vie 14 ago, Sucursal Ñuñoa, 08:00 – 17:00')).toBeOnTheScreen();
  });
});
