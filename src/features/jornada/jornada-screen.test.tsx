import { render, screen, userEvent } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { NaiveDate, NaiveDateTime } from '@/api';
import type { AuthApi } from '@/features/auth/auth-api';
import {
  employeePermissions,
  parsePermissions,
  type Permission,
} from '@/features/auth/permissions';
import { SessionProvider } from '@/features/auth/session';
import type { SessionUser } from '@/features/auth/session-user';
import { createMemoryTokenStore } from '@/features/auth/token-store';
import { es } from '@/i18n';

import type { PendingCorrection, PendingCorrectionsApi } from './corrections-api';
import { JornadaScreen } from './jornada-screen';
import type { UpcomingShiftsApi } from './shifts-api';
import type { WorkdaysApi } from './workdays-api';

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function user(overrides: Partial<SessionUser> = {}): SessionUser {
  return {
    id: 5,
    name: 'Camila Rojas',
    firstName: 'Camila',
    email: 'c.rojas@example.com',
    rut: '12345678-9',
    position: null,
    premise: null,
    personalEmail: null,
    phone: null,
    supervisor: null,
    contractStartDate: null,
    permissions: parsePermissions(employeePermissions),
    ...overrides,
  };
}

/** A session provider already holding a signed-in employee, same shape home-screen.test.tsx's own wrapper takes. */
function sessionWrapper(sessionUser: SessionUser) {
  const authApi: AuthApi = {
    issueToken: async () => 'tok_test',
    fetchSessionUser: async () => sessionUser,
    revokeToken: async () => true,
  };

  const store = createMemoryTokenStore();
  void store.write('tok_test');

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider initialMetrics={metrics}>
        <SessionProvider authApi={authApi} tokenStore={store} deviceName={async () => 'Kolvi test'}>
          {children}
        </SessionProvider>
      </SafeAreaProvider>
    );
  };
}

const workingApi: UpcomingShiftsApi = {
  fetchUpcomingShifts: async () => ({ date: '2026-08-13' as NaiveDate, today: null, days: [] }),
};

const workingWorkdaysApi: WorkdaysApi = {
  fetchWorkdays: async () => [],
};

const workingCorrectionsApi: PendingCorrectionsApi = {
  fetchPendingCorrections: async () => [],
  approve: async () => {},
  decline: async () => {},
};

async function mount(
  sessionUser: SessionUser,
  api: UpcomingShiftsApi = workingApi,
  workdaysApi: WorkdaysApi = workingWorkdaysApi,
  correctionsApi: PendingCorrectionsApi = workingCorrectionsApi,
) {
  await render(
    <JornadaScreen
      onOpenProfile={() => {}}
      api={api}
      workdaysApi={workdaysApi}
      correctionsApi={correctionsApi}
    />,
    {
      wrapper: sessionWrapper(sessionUser),
    },
  );
}

describe('JornadaScreen', () => {
  it('shows the segmented control, Próximos selected by default', async () => {
    await mount(user());

    expect(await screen.findByTestId('jornada-segments')).toBeOnTheScreen();
    expect(await screen.findByTestId('today-shift-card-empty')).toBeOnTheScreen();
  });

  it('switches to Historial and back', async () => {
    await mount(user());
    await screen.findByTestId('jornada-segments');

    await userEvent.press(screen.getByText(es.jornada.segments.historial));
    expect(await screen.findByTestId('historial-empty')).toBeOnTheScreen();

    await userEvent.press(screen.getByText(es.jornada.segments.proximos));
    expect(await screen.findByTestId('today-shift-card-empty')).toBeOnTheScreen();
  });

  it('opens the profile from the avatar', async () => {
    const opened = jest.fn();
    await render(
      <JornadaScreen
        onOpenProfile={opened}
        api={workingApi}
        workdaysApi={workingWorkdaysApi}
        correctionsApi={workingCorrectionsApi}
      />,
      {
        wrapper: sessionWrapper(user()),
      },
    );

    await userEvent.press(screen.getByTestId('profile-button'));

    expect(opened).toHaveBeenCalled();
  });

  describe('without ViewOwn:Workday', () => {
    it('shows an explanatory state rather than the segmented control', async () => {
      const noWorkdayAccess = employeePermissions.filter(
        (permission): permission is Permission => permission !== 'ViewOwn:Workday',
      );

      await mount(user({ permissions: parsePermissions(noWorkdayAccess) }));

      expect(await screen.findByTestId('jornada-no-access')).toBeOnTheScreen();
      expect(screen.getByText(es.jornada.noAccess)).toBeOnTheScreen();
      expect(screen.queryByTestId('jornada-segments')).toBeNull();
    });
  });

  describe('pending corrections (KMO-35)', () => {
    const pending: PendingCorrection = {
      id: 1,
      workdayId: 10,
      markTypeLabel: 'Entrada',
      originalTime: '08:00',
      proposedTime: '08:32',
      reason: 'Olvido de marcar',
      requestedBy: 'Ana Pérez',
      expiresAt: '2026-08-19 08:00:00' as NaiveDateTime,
    };

    const correctionsApi: PendingCorrectionsApi = {
      fetchPendingCorrections: async () => [pending],
      approve: async () => {},
      decline: async () => {},
    };

    it('shows the card on Próximos', async () => {
      await mount(user(), workingApi, workingWorkdaysApi, correctionsApi);

      expect(await screen.findByTestId('pending-correction-1')).toBeOnTheScreen();
    });

    it('keeps the card on screen after switching to Historial', async () => {
      await mount(user(), workingApi, workingWorkdaysApi, correctionsApi);
      await screen.findByTestId('pending-correction-1');

      await userEvent.press(screen.getByText(es.jornada.segments.historial));

      expect(screen.getByTestId('pending-correction-1')).toBeOnTheScreen();
    });

    it('does not fetch corrections without ReviewOwn:MarkModification', async () => {
      const noReviewAccess = employeePermissions.filter(
        (permission): permission is Permission => permission !== 'ReviewOwn:MarkModification',
      );
      const fetchPendingCorrections = jest.fn(async () => [pending]);

      await mount(
        user({ permissions: parsePermissions(noReviewAccess) }),
        workingApi,
        workingWorkdaysApi,
        { ...correctionsApi, fetchPendingCorrections },
      );
      await screen.findByTestId('jornada-segments');

      expect(fetchPendingCorrections).not.toHaveBeenCalled();
      expect(screen.queryByTestId('pending-correction-1')).toBeNull();
    });
  });
});
