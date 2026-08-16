import { render as rtlRender, screen, userEvent } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import type { PunchReceipt } from './punch-receipt-api';
import { PunchReceiptSheet, type PunchReceiptLoad } from './punch-receipt-sheet';

const noop = () => {};

const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const render = (ui: ReactElement) =>
  rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

function receipt(overrides: Partial<PunchReceipt> = {}): PunchReceipt {
  return {
    markId: 1841,
    type: 'in',
    datetime: '2026-08-05 08:03:11' as NaiveDateTime,
    hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
    geoStatus: 'inside',
    folio: '20260805-0042',
    employeeName: 'María Fernanda Soto',
    employeeRut: '214375818',
    capturedOffline: false,
    ...overrides,
  };
}

const loaded = (overrides: Partial<PunchReceipt> = {}): PunchReceiptLoad => ({
  status: 'loaded',
  receipt: receipt(overrides),
});

function Sheet({
  load = loaded(),
  onDismiss = noop,
  onRetry = noop,
  copyToClipboard = jest.fn().mockResolvedValue(undefined),
}: {
  load?: PunchReceiptLoad | null;
  onDismiss?: () => void;
  onRetry?: () => void;
  copyToClipboard?: (text: string) => Promise<unknown>;
}) {
  return (
    <PunchReceiptSheet
      load={load}
      onDismiss={onDismiss}
      onRetry={onRetry}
      copyToClipboard={copyToClipboard}
      testID="punch-receipt-sheet"
    />
  );
}

describe('PunchReceiptSheet', () => {
  it('is closed until a punch has been tapped', async () => {
    await render(<Sheet load={null} />);

    expect(screen.queryByTestId('punch-receipt-sheet')).not.toBeOnTheScreen();
  });

  it('shows a loading skeleton while the tapped punch’s receipt is in flight', async () => {
    await render(<Sheet load={{ status: 'loading' }} />);

    expect(screen.getByTestId('punch-receipt-sheet')).toBeOnTheScreen();
    expect(screen.getByTestId('punch-receipt-loading')).toBeOnTheScreen();
  });

  it('opens with the receipt once it arrives', async () => {
    await render(<Sheet />);

    expect(screen.getByTestId('punch-receipt-sheet')).toBeOnTheScreen();
    expect(screen.getByText(es.marcaje.receipt.headline)).toBeOnTheScreen();
  });

  it('shows the Art. 13 rows off the receipt, not redrawn from the day-detail figures', async () => {
    await render(<Sheet />);

    expect(screen.getByText(es.marcaje.receipt.types.in)).toBeOnTheScreen();
    expect(screen.getByText('María Fernanda Soto')).toBeOnTheScreen();
    expect(screen.getByText('20260805-0042')).toBeOnTheScreen();
    expect(
      screen.getByText('9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443'),
    ).toBeOnTheScreen();
  });

  it('names a salida as a salida', async () => {
    await render(<Sheet load={loaded({ type: 'out' })} />);

    expect(screen.getByText(es.marcaje.receipt.types.out)).toBeOnTheScreen();
  });

  it('omits the RUT row rather than throwing on one it cannot punctuate', async () => {
    await render(<Sheet load={loaded({ employeeRut: null })} />);

    expect(screen.queryByText(es.marcaje.receipt.rut)).not.toBeOnTheScreen();
  });

  it('adds the out-of-range note in the warning colour', async () => {
    await render(<Sheet load={loaded({ geoStatus: 'outside' })} />);

    expect(screen.getByTestId('punch-receipt-out-of-range')).toBeOnTheScreen();
  });

  it('says nothing about geofencing for an ordinary mark', async () => {
    await render(<Sheet />);

    expect(screen.queryByTestId('punch-receipt-out-of-range')).not.toBeOnTheScreen();
  });

  it('says the mark synced from an offline capture, when it did', async () => {
    await render(<Sheet load={loaded({ capturedOffline: true })} />);

    expect(screen.getByTestId('punch-receipt-captured-offline')).toBeOnTheScreen();
  });

  it('copies the hash to the clipboard and confirms in the button itself', async () => {
    const copyToClipboard = jest.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    await render(<Sheet copyToClipboard={copyToClipboard} />);

    await user.press(screen.getByTestId('punch-receipt-copy'));

    expect(copyToClipboard).toHaveBeenCalledWith(
      '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
    );
    expect(screen.getByText(es.actions.copied)).toBeOnTheScreen();
  });

  it('dismisses from the pinned Listo button', async () => {
    const onDismiss = jest.fn();
    const user = userEvent.setup();

    await render(<Sheet onDismiss={onDismiss} />);

    await user.press(screen.getByTestId('punch-receipt-done'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  describe('a failed fetch', () => {
    it('shows a retry rather than the receipt, or nothing at all', async () => {
      await render(<Sheet load={{ status: 'failed' }} />);

      expect(screen.getByTestId('punch-receipt-failed')).toBeOnTheScreen();
      expect(screen.queryByText(es.marcaje.receipt.headline)).not.toBeOnTheScreen();
    });

    it('has no pinned Listo — it never held a receipt to be done with', async () => {
      await render(<Sheet load={{ status: 'failed' }} />);

      expect(screen.queryByTestId('punch-receipt-done')).not.toBeOnTheScreen();
    });

    it('asks again on retry', async () => {
      const onRetry = jest.fn();
      const user = userEvent.setup();

      await render(<Sheet load={{ status: 'failed' }} onRetry={onRetry} />);

      await user.press(screen.getByTestId('punch-receipt-retry'));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });
  });
});
