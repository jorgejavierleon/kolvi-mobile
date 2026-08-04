import { act, render, screen } from '@testing-library/react-native';
import { useRef } from 'react';
import { Text, View } from 'react-native';

import { typography } from '@/theme';

import { Clock } from './clock';
import { CLOCK_TICK_MS } from './now-clock';

function fixedClock(iso: string) {
  let current = new Date(iso);

  return {
    read: () => current,
    advanceTo: (next: string) => {
      current = new Date(next);
    },
  };
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('Clock', () => {
  it('renders the current time as hh:mm (#3)', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    await render(<Clock punchState="before" clock={clock.read} />);

    expect(screen.getByTestId('clock-time')).toHaveTextContent('14:07');
  });

  it('shows no seconds — those belong to the comprobante, not to a clock', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    await render(<Clock punchState="before" clock={clock.read} />);

    expect(screen.queryByText('14:07:22')).not.toBeOnTheScreen();
  });

  it('updates at least every 30 seconds (#3)', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    await render(<Clock punchState="before" clock={clock.read} />);

    clock.advanceTo('2026-08-04T14:08:05');
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS);
    });

    expect(screen.getByTestId('clock-time')).toHaveTextContent('14:08');
  });

  it('is drawn in the display preset the token file reserves for it', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');

    await render(<Clock punchState="before" clock={clock.read} />);

    expect(screen.getByTestId('clock-time')).toHaveStyle({
      fontFamily: typography.display.fontFamily,
      fontSize: typography.display.fontSize,
    });
  });

  describe('the status line (#4)', () => {
    it.each([
      ['before', 'Aún no marcas entrada'],
      ['working', 'En jornada'],
      ['done', 'Jornada finalizada'],
    ] as const)('reads %s as "%s"', async (state, line) => {
      const clock = fixedClock('2026-08-04T14:07:22');

      await render(<Clock punchState={state} clock={clock.read} />);

      expect(screen.getByTestId('clock-status')).toHaveTextContent(line);
    });

    it('says nothing when the state is unknown, rather than guessing', async () => {
      // Telling an employee who punched in at 08:00 that they have not marked
      // entrada is the one wrong answer here that costs them a workday.
      const clock = fixedClock('2026-08-04T14:07:22');

      await render(<Clock punchState={null} clock={clock.read} />);

      expect(screen.queryByTestId('clock-status')).not.toBeOnTheScreen();
      expect(screen.queryByText('Aún no marcas entrada')).not.toBeOnTheScreen();
      expect(screen.getByTestId('clock-time')).toBeOnTheScreen();
    });
  });

  describe('what a tick costs', () => {
    /** Counts every render of whatever sits beside the clock on the screen. */
    function Sibling({ renders }: { renders: { current: number } }) {
      const own = useRef(0);
      own.current += 1;
      renders.current = own.current;

      return (
        <View>
          <Text>Turno de hoy</Text>
        </View>
      );
    }

    it('re-renders the clock and not the screen around it (#3)', async () => {
      const clock = fixedClock('2026-08-04T14:07:22');
      const renders = { current: 0 };

      await render(
        <View>
          <Clock punchState="before" clock={clock.read} />
          <Sibling renders={renders} />
        </View>,
      );

      const before = renders.current;

      clock.advanceTo('2026-08-04T14:08:05');
      await act(async () => {
        await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS);
      });

      // The time moved; nothing beside it was asked to draw again.
      expect(screen.getByTestId('clock-time')).toHaveTextContent('14:08');
      expect(renders.current).toBe(before);
    });
  });

  it('stops ticking once the screen has gone', async () => {
    const clock = fixedClock('2026-08-04T14:07:22');
    const read = jest.fn(clock.read);

    const { unmount } = await render(<Clock punchState="before" clock={read} />);
    await act(async () => {
      unmount();
    });

    const readsBefore = read.mock.calls.length;
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CLOCK_TICK_MS * 4);
    });

    expect(read).toHaveBeenCalledTimes(readsBefore);
  });
});
