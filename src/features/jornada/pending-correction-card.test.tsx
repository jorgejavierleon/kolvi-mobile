import { render, screen, userEvent } from '@testing-library/react-native';

import type { NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import type { PendingCorrection } from './corrections-api';
import { PendingCorrectionCard } from './pending-correction-card';

const noop = () => {};

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

/** 2026-08-17 08:00:00 — two clear days before `correction.expiresAt`. */
const now = () => new Date(2026, 7, 17, 8, 0, 0);

describe('PendingCorrectionCard', () => {
  it('shows the current and proposed times, the reason and the requester', async () => {
    await render(
      <PendingCorrectionCard
        correction={correction}
        onApprove={noop}
        onDecline={noop}
        reviewing={false}
        error={null}
        now={now}
      />,
    );

    expect(screen.getByText(es.jornada.corrections.title)).toBeOnTheScreen();
    expect(screen.getByText('08:00')).toBeOnTheScreen();
    expect(screen.getByText('08:32')).toBeOnTheScreen();
    expect(screen.getByText('Olvido de marcar · Ana Pérez')).toBeOnTheScreen();
  });

  it('reads a correction with no prior mark as having none, not a blank', async () => {
    await render(
      <PendingCorrectionCard
        correction={{ ...correction, originalTime: null }}
        onApprove={noop}
        onDecline={noop}
        reviewing={false}
        error={null}
        now={now}
      />,
    );

    expect(screen.getByText(es.jornada.corrections.noCurrentTime)).toBeOnTheScreen();
  });

  it('counts down to the expiry', async () => {
    await render(
      <PendingCorrectionCard
        correction={correction}
        onApprove={noop}
        onDecline={noop}
        reviewing={false}
        error={null}
        now={now}
      />,
    );

    expect(screen.getByText('Vence en 2 días')).toBeOnTheScreen();
  });

  it('disables both actions once the review window has closed', async () => {
    const afterExpiry = () => new Date(2026, 7, 19, 8, 0, 1);

    await render(
      <PendingCorrectionCard
        correction={correction}
        onApprove={noop}
        onDecline={noop}
        reviewing={false}
        error={null}
        now={afterExpiry}
      />,
    );

    expect(screen.getByText(es.jornada.corrections.expired)).toBeOnTheScreen();
    expect(screen.getByTestId(`pending-correction-${correction.id}-approve`)).toBeDisabled();
    expect(screen.getByTestId(`pending-correction-${correction.id}-decline`)).toBeDisabled();
  });

  it('shows an inline message when the last review attempt failed', async () => {
    await render(
      <PendingCorrectionCard
        correction={correction}
        onApprove={noop}
        onDecline={noop}
        reviewing={false}
        error={new Error('boom')}
        now={now}
      />,
    );

    expect(screen.getByText(es.jornada.corrections.reviewFailed)).toBeOnTheScreen();
  });

  it('calls onApprove and onDecline from their own buttons', async () => {
    const onApprove = jest.fn();
    const onDecline = jest.fn();

    await render(
      <PendingCorrectionCard
        correction={correction}
        onApprove={onApprove}
        onDecline={onDecline}
        reviewing={false}
        error={null}
        now={now}
      />,
    );

    await userEvent.press(screen.getByTestId(`pending-correction-${correction.id}-approve`));
    await userEvent.press(screen.getByTestId(`pending-correction-${correction.id}-decline`));

    expect(onApprove).toHaveBeenCalledTimes(1);
    expect(onDecline).toHaveBeenCalledTimes(1);
  });
});
