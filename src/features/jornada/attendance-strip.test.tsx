import { render, screen, userEvent } from '@testing-library/react-native';

import { naiveTime, type NaiveTime } from '@/api';
import { es } from '@/i18n';

import { AttendanceStrip, type AttendanceStripProps } from './attendance-strip';

const time = (value: string): NaiveTime => naiveTime(`${value}:00`);

function draw(overrides: Partial<AttendanceStripProps> = {}) {
  return render(
    <AttendanceStrip
      shiftStart={time('08:00')}
      shiftEnd={time('17:00')}
      markIn={{ time: time('08:02'), markId: 501 }}
      markOut={{ time: time('17:05'), markId: 502 }}
      statusTone="success"
      onPressMarkIn={() => {}}
      onPressMarkOut={() => {}}
      {...overrides}
    />,
  );
}

describe('AttendanceStrip', () => {
  it('renders the axis ticks and both markers', async () => {
    await draw();

    expect(screen.getByText('08:00')).toBeOnTheScreen();
    expect(screen.getByText('17:00')).toBeOnTheScreen();
    expect(screen.getByLabelText(`${es.marcaje.receipt.types.in} 08:02`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${es.marcaje.receipt.types.out} 17:05`)).toBeOnTheScreen();
  });

  it('draws no marker for a missing punch, rather than one at a fabricated position (#6)', async () => {
    await draw({ markOut: null });

    expect(screen.getByTestId('attendance-strip-mark-in')).toBeOnTheScreen();
    expect(screen.queryByTestId('attendance-strip-mark-out')).not.toBeOnTheScreen();
  });

  it('renders nothing when the day has no assigned shift', async () => {
    await draw({ shiftStart: null, shiftEnd: null });

    expect(screen.queryByTestId('attendance-strip')).not.toBeOnTheScreen();
  });

  it('opens the tapped punch’s own receipt', async () => {
    const onPressMarkIn = jest.fn();
    const onPressMarkOut = jest.fn();
    const user = userEvent.setup();

    await draw({ onPressMarkIn, onPressMarkOut });

    await user.press(screen.getByTestId('attendance-strip-mark-in'));
    expect(onPressMarkIn).toHaveBeenCalledTimes(1);
    expect(onPressMarkOut).not.toHaveBeenCalled();

    await user.press(screen.getByTestId('attendance-strip-mark-out'));
    expect(onPressMarkOut).toHaveBeenCalledTimes(1);
  });

  it('wraps a shift crossing midnight to the correct order rather than reversing (#4)', async () => {
    await draw({
      shiftStart: time('22:00'),
      shiftEnd: time('06:00'),
      markIn: { time: time('22:10'), markId: 501 },
      markOut: { time: time('05:45'), markId: 502 },
    });

    expect(screen.getByText('22:00')).toBeOnTheScreen();
    expect(screen.getByText('06:00')).toBeOnTheScreen();
    expect(screen.getByLabelText(`${es.marcaje.receipt.types.in} 22:10`)).toBeOnTheScreen();
    expect(screen.getByLabelText(`${es.marcaje.receipt.types.out} 05:45`)).toBeOnTheScreen();
  });
});
