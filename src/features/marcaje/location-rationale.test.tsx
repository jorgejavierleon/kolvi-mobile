import { render, screen, userEvent } from '@testing-library/react-native';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import { es } from '@/i18n';

import { LocationRationale } from './location-rationale';

/** The sheet is pinned to the safe area, so it needs one to render at all. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

function draw(props: Partial<React.ComponentProps<typeof LocationRationale>> = {}) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <LocationRationale
        visible
        onAccept={() => {}}
        onDismiss={() => {}}
        testID="rationale"
        {...props}
      />
    </SafeAreaProvider>,
  );
}

describe('LocationRationale (#1)', () => {
  it('explains what the permission is for before the OS asks for it', async () => {
    await draw();

    expect(screen.getByText(es.permissions.location.rationale.title)).toBeOnTheScreen();
    expect(screen.getByText(es.permissions.location.rationale.body)).toBeOnTheScreen();
  });

  // The three things worth knowing before deciding, since the decision can be
  // permanent: what it is read for, when it is read, and that refusing does not
  // stop them punching (#7, #10).
  it.each([
    ['what it is read for', 'marcar'],
    ['that it is only read in the foreground', 'segundo plano'],
    ['that a refusal does not block a punch', 'igual puedes marcar'],
  ])('says %s', (_case, phrase) => {
    expect(es.permissions.location.rationale.body).toContain(phrase);
  });

  it('raises the OS prompt on Continuar', async () => {
    const onAccept = jest.fn();

    await draw({ onAccept });

    await userEvent.press(screen.getByTestId('location-rationale-accept'));

    expect(onAccept).toHaveBeenCalledTimes(1);
  });

  it('takes Ahora no as an answer', async () => {
    const onDismiss = jest.fn();

    await draw({ onDismiss });

    await userEvent.press(screen.getByTestId('location-rationale-dismiss'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // A `Modal` left mounted-but-hidden keeps a second surface alongside the one
  // the app lives in, for as long as the tab is open.
  it('renders nothing at all when it is not being offered', async () => {
    await draw({ visible: false });

    expect(screen.queryByTestId('rationale')).not.toBeOnTheScreen();
    expect(screen.queryByText(es.permissions.location.rationale.title)).not.toBeOnTheScreen();
  });
});
