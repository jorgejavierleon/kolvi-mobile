import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { es } from '@/i18n';

import { DayDetailPlaceholder } from './day-detail-placeholder';

/** The sheet is pinned to the safe area, so it needs one to render at all. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

function draw(props: Partial<React.ComponentProps<typeof DayDetailPlaceholder>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <DayDetailPlaceholder visible onDismiss={() => {}} testID="day-detail" {...props} />
    </SafeAreaProvider>,
  );
}

describe('DayDetailPlaceholder', () => {
  it('says the day detail is not available yet, rather than showing nothing', async () => {
    await draw();

    expect(screen.getByText(es.jornada.historial.dayDetail.title)).toBeOnTheScreen();
    expect(screen.getByText(es.jornada.historial.dayDetail.body)).toBeOnTheScreen();
  });

  it('dismisses from the backdrop', async () => {
    const onDismiss = jest.fn();

    await draw({ onDismiss });

    await userEvent.press(screen.getByTestId('bottom-sheet-backdrop'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // A `Modal` left mounted-but-hidden keeps a second surface alongside the one
  // the app lives in, for as long as the tab is open.
  it('renders nothing at all when it is not being offered', async () => {
    await draw({ visible: false });

    expect(screen.queryByTestId('day-detail')).not.toBeOnTheScreen();
    expect(screen.queryByText(es.jornada.historial.dayDetail.title)).not.toBeOnTheScreen();
  });
});
