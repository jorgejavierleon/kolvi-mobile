import { render as rtlRender, screen, userEvent, waitFor } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { NaiveDate, NaiveTime } from '@/api';
import { es } from '@/i18n';

import type { DayDetail, DayDetailApi } from './day-detail-api';
import { DayDetailScreen } from './day-detail-screen';
import type { PunchReceipt, PunchReceiptApi } from './punch-receipt-api';

const date = '2026-08-14' as NaiveDate;

/** The punch-receipt sheet is a `BottomSheet`, which needs a safe area to render. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const render = (ui: ReactElement) =>
  rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

function detail(overrides: Partial<DayDetail> = {}): DayDetail {
  return {
    date,
    statusLabel: 'A tiempo',
    statusTone: 'success',
    shiftStart: '08:00:00' as NaiveTime,
    shiftEnd: '17:00:00' as NaiveTime,
    workedTime: '08:03',
    extraTime: '00:00',
    missingTime: '00:00',
    leaveTypeLabel: null,
    markIn: { time: '08:02:00' as NaiveTime, markId: 501 },
    markOut: { time: '17:05:00' as NaiveTime, markId: 502 },
    ...overrides,
  };
}

function receipt(overrides: Partial<PunchReceipt> = {}): PunchReceipt {
  return {
    markId: 501,
    type: 'in',
    datetime: '2026-08-14 08:02:11' as never,
    hash: '9f2c1b0e5d4a3c2b1a0f9e8d7c6b5a4938271605f4e3d2c1b0a9988776655443',
    geoStatus: 'inside',
    folio: '20260814-0007',
    employeeName: 'María Fernanda Soto',
    employeeRut: '214375818',
    capturedOffline: false,
    ...overrides,
  };
}

function apiResolving(value: DayDetail): DayDetailApi {
  return { fetchDayDetail: () => Promise.resolve(value) };
}

function receiptApiResolving(value: PunchReceipt): PunchReceiptApi {
  return { fetchPunchReceipt: () => Promise.resolve(value) };
}

describe('DayDetailScreen', () => {
  it('shows the status badge, the tiles and the strip once loaded (#1, #2, #3)', async () => {
    await render(<DayDetailScreen date={date} dayDetailApi={apiResolving(detail())} />);

    await waitFor(() => expect(screen.getByText('A tiempo')).toBeOnTheScreen());
    expect(screen.getByTestId('kpi-tiles')).toBeOnTheScreen();
    expect(screen.getByTestId('attendance-strip')).toBeOnTheScreen();
  });

  it('shows a skeleton while loading', async () => {
    await render(
      <DayDetailScreen
        date={date}
        dayDetailApi={{ fetchDayDetail: () => new Promise(() => {}) }}
      />,
    );

    expect(screen.getByTestId('day-detail-skeleton')).toBeOnTheScreen();
  });

  it('shows a retry that reloads only this screen on a failed load (#8)', async () => {
    const fetchDayDetail = jest
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(detail());
    const user = userEvent.setup();

    await render(<DayDetailScreen date={date} dayDetailApi={{ fetchDayDetail }} />);

    await waitFor(() => expect(screen.getByTestId('day-detail-load-failed')).toBeOnTheScreen());

    await user.press(screen.getByTestId('day-detail-retry'));

    await waitFor(() => expect(screen.getByText('A tiempo')).toBeOnTheScreen());
    expect(fetchDayDetail).toHaveBeenCalledTimes(2);
  });

  it('shows the leave type in place of the tiles and the strip, not zeros (#7)', async () => {
    await render(
      <DayDetailScreen
        date={date}
        dayDetailApi={apiResolving(
          detail({
            leaveTypeLabel: 'Vacaciones',
            workedTime: null,
            extraTime: null,
            missingTime: null,
            markIn: null,
            markOut: null,
          }),
        )}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('day-detail-leave')).toBeOnTheScreen());
    expect(screen.getByText('Vacaciones')).toBeOnTheScreen();
    expect(screen.queryByTestId('kpi-tiles')).not.toBeOnTheScreen();
    expect(screen.queryByTestId('attendance-strip')).not.toBeOnTheScreen();
  });

  it('shows a missing punch honestly rather than a fabricated marker (#6)', async () => {
    await render(
      <DayDetailScreen date={date} dayDetailApi={apiResolving(detail({ markOut: null }))} />,
    );

    await waitFor(() => expect(screen.getByTestId('attendance-strip')).toBeOnTheScreen());
    expect(screen.queryByTestId('attendance-strip-mark-out')).not.toBeOnTheScreen();
  });

  it('opens the tapped punch’s own comprobante, fetched by its own mark id (#5)', async () => {
    const fetchPunchReceipt = jest.fn().mockResolvedValue(receipt());
    const user = userEvent.setup();

    await render(
      <DayDetailScreen
        date={date}
        dayDetailApi={apiResolving(detail())}
        punchReceiptApi={{ fetchPunchReceipt }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('attendance-strip-mark-in')).toBeOnTheScreen());
    await user.press(screen.getByTestId('attendance-strip-mark-in'));

    expect(fetchPunchReceipt).toHaveBeenCalledWith(501, expect.anything());
    await waitFor(() => expect(screen.getByText(es.marcaje.receipt.headline)).toBeOnTheScreen());
    expect(screen.getByText('20260814-0007')).toBeOnTheScreen();
  });

  it('opens the salida’s own receipt from the salida marker, not the entrada’s', async () => {
    const fetchPunchReceipt = receiptApiResolving(
      receipt({ markId: 502, type: 'out' }),
    ).fetchPunchReceipt;
    const spy = jest.fn(fetchPunchReceipt);
    const user = userEvent.setup();

    await render(
      <DayDetailScreen
        date={date}
        dayDetailApi={apiResolving(detail())}
        punchReceiptApi={{ fetchPunchReceipt: spy }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId('attendance-strip-mark-out')).toBeOnTheScreen());
    await user.press(screen.getByTestId('attendance-strip-mark-out'));

    expect(spy).toHaveBeenCalledWith(502, expect.anything());
  });
});
