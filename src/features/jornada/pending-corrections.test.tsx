import { render, screen, waitFor } from '@testing-library/react-native';

import type { NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import type { PendingCorrection, PendingCorrectionsApi } from './corrections-api';
import { PendingCorrections } from './pending-corrections';

const correction: PendingCorrection = {
  id: 1,
  workdayId: 10,
  markTypeLabel: 'Entrada',
  originalTime: '08:00',
  proposedTime: '08:32',
  reason: 'Olvido de marcar',
  requestedBy: 'Ana Pérez',
  expiresAt: '2026-08-19 08:00:00' as NaiveDateTime,
};

function apiWith(corrections: readonly PendingCorrection[]): PendingCorrectionsApi {
  return {
    fetchPendingCorrections: async () => corrections,
    approve: async () => {},
    decline: async () => {},
  };
}

const failingApi: PendingCorrectionsApi = {
  fetchPendingCorrections: async () => {
    throw new Error('boom');
  },
  approve: async () => {},
  decline: async () => {},
};

describe('PendingCorrections', () => {
  it('renders nothing while there is nothing pending', async () => {
    await render(<PendingCorrections api={apiWith([])} />);

    await waitFor(() => {
      expect(screen.queryByTestId('pending-corrections')).toBeNull();
    });
    expect(screen.queryByTestId('pending-corrections-failed')).toBeNull();
  });

  it('renders one card per pending correction', async () => {
    await render(<PendingCorrections api={apiWith([correction])} />);

    expect(await screen.findByTestId(`pending-correction-${correction.id}`)).toBeOnTheScreen();
  });

  it('shows a retry card when the load fails', async () => {
    await render(<PendingCorrections api={failingApi} />);

    expect(await screen.findByTestId('pending-corrections-failed')).toBeOnTheScreen();
    expect(screen.getByText(es.jornada.loadFailed)).toBeOnTheScreen();
  });
});
