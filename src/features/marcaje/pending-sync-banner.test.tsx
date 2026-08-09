import { fireEvent, render, screen } from '@testing-library/react-native';

import { es } from '@/i18n';

import { PendingSyncBanner } from './pending-sync-banner';

describe('PendingSyncBanner', () => {
  describe('when the queue is empty', () => {
    it('draws nothing', async () => {
      // #6. Being offline with nothing waiting is not news the employee needs,
      // and this component is never told about connectivity at all — the count
      // is the only thing that puts it on screen.
      await render(<PendingSyncBanner count={0} onSync={jest.fn()} testID="banner" />);

      expect(screen.queryByTestId('banner')).toBeNull();
      expect(screen.queryByText(es.actions.sync)).toBeNull();
    });

    it('draws nothing for a count below zero either', async () => {
      await render(<PendingSyncBanner count={-1} onSync={jest.fn()} testID="banner" />);

      expect(screen.queryByTestId('banner')).toBeNull();
    });
  });

  describe('the count', () => {
    it('is singular for one punch', async () => {
      await render(<PendingSyncBanner count={1} onSync={jest.fn()} testID="banner" />);

      expect(screen.getByText('1 marca esperando sincronizar')).toBeTruthy();
    });

    it('is plural for more than one', async () => {
      await render(<PendingSyncBanner count={3} onSync={jest.fn()} testID="banner" />);

      expect(screen.getByText('3 marcas esperando sincronizar')).toBeTruthy();
    });
  });

  describe('the subtitle (#3)', () => {
    it('says the punches are not in the attendance book yet', async () => {
      // The reason the banner exists: §4.5 settles that a queued punch is
      // captured and stored, not registered.
      await render(<PendingSyncBanner count={2} onSync={jest.fn()} testID="banner" />);

      expect(screen.getByText('Aún no forman parte del libro de asistencia')).toBeTruthy();
    });

    it('agrees in number with the count above it', async () => {
      // The design only ever draws this banner in the plural, so its subtitle is
      // `no forman` — a plural verb over `1 marca esperando sincronizar`. Art. 5
      // makes the Spanish a requirement, not a preference.
      await render(<PendingSyncBanner count={1} onSync={jest.fn()} testID="banner" />);

      expect(screen.getByText('Aún no forma parte del libro de asistencia')).toBeTruthy();
      expect(screen.queryByText('Aún no forman parte del libro de asistencia')).toBeNull();
    });
  });

  it('announces itself, as one sentence', async () => {
    await render(<PendingSyncBanner count={2} onSync={jest.fn()} testID="banner" />);

    const title = screen.getByTestId('banner-title');

    // The employee is looking at the punch button below when this appears.
    expect(title.parent?.props.accessibilityLiveRegion).toBe('polite');
    expect(title.parent?.props.accessible).toBe(true);
  });

  describe('Sincronizar', () => {
    it('flushes the queue when pressed', async () => {
      const onSync = jest.fn();
      await render(<PendingSyncBanner count={2} onSync={onSync} testID="banner" />);

      fireEvent.press(screen.getByTestId('pending-sync-action'));

      expect(onSync).toHaveBeenCalledTimes(1);
    });

    it('shows progress while the flush runs', async () => {
      await render(<PendingSyncBanner count={2} syncing onSync={jest.fn()} testID="banner" />);

      // #4. Busy rather than disabled: the employee did press it, and a screen
      // reader announcing "dimmed" would describe a refusal.
      expect(screen.getByTestId('pending-sync-action').props.accessibilityState.busy).toBe(true);
      // The spinner sits outside the accessibility tree, which is what RNTL
      // treats as hidden — see `button.test.tsx`.
      expect(screen.getByTestId('button-spinner', { includeHiddenElements: true })).toBeTruthy();
    });

    it('is never disabled, even mid-flush', async () => {
      await render(<PendingSyncBanner count={2} syncing onSync={jest.fn()} testID="banner" />);

      // Art. 38 b) names a blocked app as non-conforming, and the button is the
      // employee's own way to hurry the Art. 10 send along.
      expect(
        screen.getByTestId('pending-sync-action').props.accessibilityState.disabled,
      ).toBeFalsy();
    });
  });

  describe('when a flush failed', () => {
    it('shows the reason in Spanish and keeps the count', async () => {
      // #7. The marks are still on the phone, so the banner still says how many
      // and adds why they are still there.
      await render(
        <PendingSyncBanner
          count={2}
          error={es.errors.network}
          onSync={jest.fn()}
          testID="banner"
        />,
      );

      expect(screen.getByText('2 marcas esperando sincronizar')).toBeTruthy();
      expect(screen.getByTestId('pending-sync-error')).toHaveTextContent(es.errors.network);
    });

    it('shows no reason line when there is nothing to report', async () => {
      await render(<PendingSyncBanner count={2} onSync={jest.fn()} testID="banner" />);

      expect(screen.queryByTestId('pending-sync-error')).toBeNull();
    });
  });
});
