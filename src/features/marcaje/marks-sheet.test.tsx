import { fireEvent, render as rtlRender, screen } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { NaiveDateTime } from '@/api';
import { es } from '@/i18n';

import { MarksSheet } from './marks-sheet';
import type { PunchReceipt } from './punch-api';
import type { Marks } from './use-marks';

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
    ...overrides,
  };
}

const noop = () => {};

/** A gesture-navigation Android phone, so the pinned footer has an inset to clear. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const render = (ui: ReactElement) =>
  rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

function loaded(marks: readonly PunchReceipt[]): Marks {
  return { status: 'loaded', marks, retrying: false, reload: noop };
}

function renderSheet(marks: Marks, props: Partial<React.ComponentProps<typeof MarksSheet>> = {}) {
  return render(<MarksSheet marks={marks} onDismiss={noop} onSelect={noop} visible {...props} />);
}

describe('MarksSheet', () => {
  it('is closed until it is opened', async () => {
    await renderSheet(loaded([receipt()]), { visible: false });

    expect(screen.queryByText(es.marcaje.marks.title)).not.toBeOnTheScreen();
  });

  it('names itself and says how far back it goes', async () => {
    await renderSheet(loaded([receipt()]));

    expect(screen.getByText(es.marcaje.marks.title)).toBeOnTheScreen();
    // The list is the ten most recent, and an employee who read it as their
    // whole record would conclude the register had lost the rest.
    expect(screen.getByText(es.marcaje.marks.subtitle)).toBeOnTheScreen();
  });

  describe('the list (#1)', () => {
    it('draws each punch with its type, date and time', async () => {
      await renderSheet(loaded([receipt()]));

      expect(screen.getByText('Entrada')).toBeOnTheScreen();
      expect(screen.getByText('Mié 5 ago')).toBeOnTheScreen();
      expect(screen.getByText('08:03')).toBeOnTheScreen();
    });

    it('names a salida as one', async () => {
      await renderSheet(
        loaded([
          receipt({ markId: 1842, type: 'out', datetime: '2026-08-05 18:02:40' as NaiveDateTime }),
        ]),
      );

      expect(screen.getByText('Salida')).toBeOnTheScreen();
    });

    it('keeps the order it was given, which is newest first', async () => {
      await renderSheet(
        loaded([
          receipt({ markId: 3, datetime: '2026-08-05 08:03:11' as NaiveDateTime }),
          receipt({ markId: 2, datetime: '2026-08-04 17:59:02' as NaiveDateTime }),
          receipt({ markId: 1, datetime: '2026-08-03 08:01:00' as NaiveDateTime }),
        ]),
      );

      // The ordering itself is `parseMarks`'; what this asserts is that the
      // sheet does not reorder what it was handed.
      const dates = screen.getAllByText(/ago$/).map((node) => node.props.children as string);

      expect(dates).toEqual(['Mié 5 ago', 'Mar 4 ago', 'Lun 3 ago']);
    });

    it('announces a row as one phrase rather than three loose strings', async () => {
      await renderSheet(loaded([receipt()]));

      expect(screen.getByLabelText('Entrada · Mié 5 ago · 08:03')).toBeOnTheScreen();
    });

    it('leaves the seconds to the comprobante the row opens', async () => {
      await renderSheet(loaded([receipt()]));

      // Art. 13's `hh:mm:ss` is a requirement on the receipt, not on a row
      // somebody scans down.
      expect(screen.queryByText('08:03:11')).not.toBeOnTheScreen();
    });
  });

  describe('tapping a punch (#2)', () => {
    it('hands back the whole stored mark, not an id to go and fetch', async () => {
      const onSelect = jest.fn();
      const mark = receipt();

      await renderSheet(loaded([mark]), { onSelect });

      fireEvent.press(screen.getByTestId('mark-row-1841'));

      // The same `PunchReceipt` a punch answers with, so `ReceiptSheet` draws a
      // retrieved receipt exactly as it draws a fresh one — folio, hash and all
      // (#3).
      expect(onSelect).toHaveBeenCalledWith(mark);
    });

    it('opens the right one when several are listed', async () => {
      const onSelect = jest.fn();
      const older = receipt({ markId: 1840, datetime: '2026-08-04 17:59:02' as NaiveDateTime });

      await renderSheet(loaded([receipt(), older]), { onSelect });

      fireEvent.press(screen.getByTestId('mark-row-1840'));

      expect(onSelect).toHaveBeenCalledWith(older);
    });
  });

  describe('an employee with no punches yet (#4)', () => {
    it('says so in Spanish, and says what will fill the list', async () => {
      await renderSheet(loaded([]));

      expect(screen.getByText(es.marcaje.marks.empty)).toBeOnTheScreen();
      expect(screen.getByText(es.marcaje.marks.emptyBody)).toBeOnTheScreen();
    });

    it('offers no retry — nothing failed', async () => {
      await renderSheet(loaded([]));

      expect(screen.queryByTestId('marks-retry')).not.toBeOnTheScreen();
      expect(screen.queryByText(es.states.failed)).not.toBeOnTheScreen();
    });
  });

  describe('before and instead of the list', () => {
    it('reserves the shape of the rows while the request is in flight', async () => {
      await renderSheet({ status: 'loading', reload: noop });

      expect(screen.getByTestId('marks-skeleton')).toBeOnTheScreen();
      expect(screen.getByLabelText(es.states.loading)).toBeOnTheScreen();
    });

    it('offers the load again when it failed', async () => {
      const reload = jest.fn();

      await renderSheet({ status: 'failed', error: new Error('nope'), retrying: false, reload });

      expect(screen.getByText(es.states.failed)).toBeOnTheScreen();

      fireEvent.press(screen.getByTestId('marks-retry'));

      expect(reload).toHaveBeenCalledTimes(1);
    });

    it('keeps the rows on screen while the retry runs', async () => {
      await renderSheet({ status: 'loaded', marks: [receipt()], retrying: true, reload: noop });

      expect(screen.getByText('Entrada')).toBeOnTheScreen();
    });
  });

  describe('dismissing', () => {
    it('closes on Listo', async () => {
      const onDismiss = jest.fn();

      await renderSheet(loaded([receipt()]), { onDismiss });

      fireEvent.press(screen.getByTestId('marks-done'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('closes on the backdrop, which a screen reader can name', async () => {
      const onDismiss = jest.fn();

      await renderSheet(loaded([receipt()]), { onDismiss });

      fireEvent.press(screen.getByLabelText(es.marcaje.marks.close));

      expect(onDismiss).toHaveBeenCalledTimes(1);
    });
  });
});
