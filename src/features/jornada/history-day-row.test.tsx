import { fireEvent, render, screen } from '@testing-library/react-native';

import { tones } from '@/theme';

import { HistoryDayRow } from './history-day-row';

const noop = () => {};

describe('HistoryDayRow', () => {
  it('shows the date, the status badge and the three figures', async () => {
    await render(
      <HistoryDayRow
        dateLabel="Vie 14 ago"
        statusLabel="A tiempo"
        statusTone="success"
        workedTime="08:00"
        extraTime="00:00"
        missingTime="00:00"
        leaveTypeLabel={null}
        onPress={noop}
      />,
    );

    expect(screen.getByText('Vie 14 ago')).toBeOnTheScreen();
    expect(screen.getByText('A tiempo')).toBeOnTheScreen();
    expect(screen.getByText('08:00')).toBeOnTheScreen();
    expect(screen.getAllByText('00:00')).toHaveLength(2);
  });

  it('colours the badge in the tone the server sent', async () => {
    await render(
      <HistoryDayRow
        dateLabel="Vie 14 ago"
        statusLabel="Atrasado"
        statusTone="warning"
        workedTime="07:40"
        extraTime="00:00"
        missingTime="00:20"
        leaveTypeLabel={null}
        onPress={noop}
      />,
    );

    expect(screen.getByText('Atrasado')).toHaveStyle({ color: tones.warning.foreground });
  });

  it('draws no badge when the server sent no recognised status', async () => {
    await render(
      <HistoryDayRow
        dateLabel="Vie 14 ago"
        statusLabel={null}
        statusTone={null}
        workedTime="08:00"
        extraTime="00:00"
        missingTime="00:00"
        leaveTypeLabel={null}
        onPress={noop}
      />,
    );

    expect(screen.queryByText('A tiempo')).toBeNull();
  });

  it('shows the leave type in place of the three figures', async () => {
    await render(
      <HistoryDayRow
        dateLabel="Vie 14 ago"
        statusLabel="Justificado"
        statusTone="success"
        workedTime={null}
        extraTime={null}
        missingTime={null}
        leaveTypeLabel="Vacaciones"
        onPress={noop}
      />,
    );

    expect(screen.getByText('Vacaciones')).toBeOnTheScreen();
    expect(screen.queryByText('Trabajado')).toBeNull();
  });

  it('reports a press on the whole card', async () => {
    const onPress = jest.fn();

    await render(
      <HistoryDayRow
        dateLabel="Vie 14 ago"
        statusLabel="A tiempo"
        statusTone="success"
        workedTime="08:00"
        extraTime="00:00"
        missingTime="00:00"
        leaveTypeLabel={null}
        onPress={onPress}
        testID="history-day-row"
      />,
    );

    fireEvent.press(screen.getByTestId('history-day-row'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('announces the date, status and figures as one element', async () => {
    await render(
      <HistoryDayRow
        dateLabel="Vie 14 ago"
        statusLabel="A tiempo"
        statusTone="success"
        workedTime="08:00"
        extraTime="00:00"
        missingTime="00:00"
        leaveTypeLabel={null}
        onPress={noop}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'Vie 14 ago, A tiempo, Trabajado 08:00, Extra 00:00, Faltante 00:00',
      }),
    ).toBeOnTheScreen();
  });

  it('announces the leave type instead of the figures', async () => {
    await render(
      <HistoryDayRow
        dateLabel="Vie 14 ago"
        statusLabel="Justificado"
        statusTone="success"
        workedTime={null}
        extraTime={null}
        missingTime={null}
        leaveTypeLabel="Vacaciones"
        onPress={noop}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Vie 14 ago, Justificado, Vacaciones' }),
    ).toBeOnTheScreen();
  });
});
