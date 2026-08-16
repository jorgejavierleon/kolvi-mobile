import { render, screen } from '@testing-library/react-native';

import { es } from '@/i18n';

import { KpiTiles } from './kpi-tiles';

describe('KpiTiles', () => {
  it('shows all four figures, matching the design’s own labels', async () => {
    await render(
      <KpiTiles
        workedTime="08:03"
        extraTime="00:00"
        missingTime="00:00"
        markInTime="08:02"
        markOutTime="17:05"
      />,
    );

    expect(screen.getByLabelText(`${es.jornada.historial.worked} 08:03`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${es.jornada.dayDetail.extra} 00:00`)).toBeOnTheScreen();
    expect(
      screen.getByLabelText(`${es.jornada.dayDetail.entradaSalida} 08:02 – 17:05`),
    ).toBeOnTheScreen();
  });

  it('reads a missing punch as — rather than blank, on both the tile and the strip (#6)', async () => {
    await render(
      <KpiTiles
        workedTime="00:00"
        extraTime="00:00"
        missingTime="08:00"
        markInTime="08:02"
        markOutTime={null}
      />,
    );

    expect(
      screen.getByLabelText(`${es.jornada.dayDetail.entradaSalida} 08:02 – —`),
    ).toBeOnTheScreen();
  });
});
