import { render as rtlRender, screen, userEvent } from '@testing-library/react-native';
import { type ReactElement } from 'react';
import { SafeAreaProvider, type Metrics } from 'react-native-safe-area-context';

import type { NaiveDateTime } from '@/api';
import { colors, tones, typography } from '@/theme';

import type { PunchReceipt } from './punch-api';
import { ReceiptSheet } from './receipt-sheet';

const noop = () => {};

/** A gesture-navigation Android phone, so the pinned footer has an inset to clear. */
const metrics: Metrics = {
  frame: { x: 0, y: 0, width: 412, height: 892 },
  insets: { top: 24, left: 0, right: 0, bottom: 48 },
};

const render = (ui: ReactElement) =>
  rtlRender(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);

/**
 * A complete 201, as `MarkResource` sends one since `ams` KOL-35.
 *
 * The hash is a real 64-character SHA-256 shape on purpose: #5 is about what a
 * hash of that length does to the layout, and a short stand-in would wrap on no
 * line at all and prove nothing.
 */
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

function Sheet({
  value = receipt(),
  onDismiss = noop,
  copyToClipboard = jest.fn().mockResolvedValue(undefined),
}: {
  value?: PunchReceipt | null;
  onDismiss?: () => void;
  copyToClipboard?: (text: string) => Promise<unknown>;
}) {
  return (
    <ReceiptSheet
      receipt={value}
      onDismiss={onDismiss}
      copyToClipboard={copyToClipboard}
      testID="receipt-sheet"
    />
  );
}

describe('the comprobante sheet', () => {
  // #1. The sheet is a function of the receipt and of nothing else: there is no
  // `visible` prop to leave true over a `null` receipt, which is the state that
  // would draw a comprobante with no punch behind it.
  it('is closed until there is a receipt to show', async () => {
    await render(<Sheet value={null} />);

    expect(screen.queryByText('¡Marca registrada!')).not.toBeOnTheScreen();
  });

  it('opens over the screen once one arrives', async () => {
    await render(<Sheet />);

    expect(screen.getByTestId('bottom-sheet-surface')).toBeOnTheScreen();
    expect(
      screen.getByTestId('bottom-sheet-scrim', { includeHiddenElements: true }),
    ).toBeOnTheScreen();
  });

  // #2.
  it('leads with the headline the design writes for a confirmed mark', async () => {
    await render(<Sheet />);

    expect(screen.getByText('¡Marca registrada!')).toBeOnTheScreen();
    expect(screen.getByText('Comprobante de marca')).toBeOnTheScreen();
  });

  it('draws the check on the success tint, not on a colour picked for this screen', async () => {
    await render(<Sheet />);

    // The same green every other successful state in the app is drawn in — a
    // tone pair, per the theme's one rule about status colour. The check inside
    // it takes `tones.success.foreground`; RNTL v14 queries host elements only,
    // so the glyph's own stroke is verified on the device instead.
    expect(screen.getByTestId('receipt-badge')).toHaveStyle({
      backgroundColor: tones.success.background,
    });
  });

  // #1 again — the action is pinned below the scroll area, so it stays reachable
  // however long the body gets.
  it('dismisses from the pinned Listo button', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    await render(<Sheet onDismiss={onDismiss} />);

    await user.press(screen.getByRole('button', { name: 'Listo' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('dismisses from the backdrop, which is named for a screen reader', async () => {
    const user = userEvent.setup();
    const onDismiss = jest.fn();
    await render(<Sheet onDismiss={onDismiss} />);

    await user.press(screen.getByRole('button', { name: 'Cerrar comprobante' }));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  /** #3 — Res. 38 Art. 13's minimum content, plus D-F2-a's folio. */
  describe('the Art. 13 detail block', () => {
    it('lists the six rows the regulation and the design ask for', async () => {
      await render(<Sheet />);

      for (const label of ['Tipo', 'Fecha', 'Hora', 'Trabajador', 'RUT', 'N° comprobante']) {
        expect(screen.getByText(label)).toBeOnTheScreen();
      }
    });

    it('takes every value from the receipt the server answered with', async () => {
      await render(<Sheet />);

      expect(screen.getByText('Entrada')).toBeOnTheScreen();
      expect(screen.getByText('María Fernanda Soto')).toBeOnTheScreen();
      expect(screen.getByText('20260805-0042')).toBeOnTheScreen();
    });

    it('names a salida as a salida', async () => {
      await render(<Sheet value={receipt({ type: 'out' })} />);

      expect(screen.getByText('Salida')).toBeOnTheScreen();
    });

    // The folio is the number an employee reads back to HR (D-F2-a). It is the
    // server's, and it is deliberately not a formatted `mark_id`.
    it('shows the server’s folio rather than anything derived from the mark id', async () => {
      await render(<Sheet value={receipt({ folio: '20260805-0001', markId: 99 })} />);

      expect(screen.getByText('20260805-0001')).toBeOnTheScreen();
      expect(screen.queryByText('99')).not.toBeOnTheScreen();
    });

    it('dots the RUT the way a Chilean reads it, from the undotted wire value', async () => {
      await render(<Sheet />);

      expect(screen.getByText('21.437.581-8')).toBeOnTheScreen();
    });

    // `ams` stamps the identity from a nullable `users.rut`, so an absent value
    // is a fact about the register. A label with nothing after it would read as
    // a receipt that failed to load.
    it.each([
      ['Trabajador', { employeeName: null }],
      ['RUT', { employeeRut: null }],
      ['N° comprobante', { folio: null }],
    ] as const)(
      'omits the %s row entirely when the register has no value',
      async (label, absent) => {
        await render(<Sheet value={receipt(absent)} />);

        expect(screen.queryByText(label)).not.toBeOnTheScreen();
      },
    );

    it('omits the RUT row rather than throwing on one it cannot punctuate', async () => {
      await render(<Sheet value={receipt({ employeeRut: 'not-a-rut' })} />);

      expect(screen.queryByText('RUT')).not.toBeOnTheScreen();
      // The rest of the receipt survives — including the hash, which is the
      // part that is evidence.
      expect(screen.getByTestId('receipt-hash')).toBeOnTheScreen();
    });
  });

  /** #4 — the two formats Art. 13 names. */
  describe('the legal date and time', () => {
    it('writes the date as dd/mm/aa', async () => {
      await render(<Sheet />);

      expect(screen.getByText('05/08/26')).toBeOnTheScreen();
    });

    it('keeps the seconds, which is what separates two punches in one minute', async () => {
      await render(<Sheet />);

      expect(screen.getByText('08:03:11')).toBeOnTheScreen();
    });

    // #9. The wall-clock string the server sent is read as written — no `Date`,
    // no device zone. A receipt that moved by an hour twice a year would be the
    // adulteration Art. 8 is about, on the screen shown as proof.
    it('renders the server’s wall clock verbatim, whatever the device believes', async () => {
      await render(<Sheet value={receipt({ datetime: '2026-01-15 23:59:59' as NaiveDateTime })} />);

      expect(screen.getByText('15/01/26')).toBeOnTheScreen();
      expect(screen.getByText('23:59:59')).toBeOnTheScreen();
    });
  });

  /** #5, #6 — the hash and its one button. */
  describe('the verification hash', () => {
    it('labels it with the algorithm, as the design does', async () => {
      await render(<Sheet />);

      expect(screen.getByText('Hash de verificación (SHA-256)')).toBeOnTheScreen();
    });

    it('renders it in the monospace preset', async () => {
      await render(<Sheet />);

      expect(screen.getByTestId('receipt-hash')).toHaveStyle({
        fontFamily: typography.mono.fontFamily,
        fontSize: typography.mono.fontSize,
      });
    });

    // The one value on the sheet that is evidence. Truncating it would make it
    // useless for comparing against the copy Art. 12 mails.
    it('wraps all sixty-four characters rather than truncating them', async () => {
      await render(<Sheet />);

      const hash = screen.getByTestId('receipt-hash');

      expect(hash).toHaveTextContent(receipt().hash);
      expect(hash.props.numberOfLines).toBeUndefined();
      expect(hash.props.ellipsizeMode).toBeUndefined();
    });

    it('copies the hash to the clipboard', async () => {
      const user = userEvent.setup();
      const copyToClipboard = jest.fn().mockResolvedValue(undefined);
      await render(<Sheet copyToClipboard={copyToClipboard} />);

      await user.press(screen.getByTestId('receipt-copy'));

      expect(copyToClipboard).toHaveBeenCalledWith(receipt().hash);
    });

    it('confirms by becoming its own confirmation', async () => {
      const user = userEvent.setup();
      await render(<Sheet />);

      expect(screen.getByRole('button', { name: 'Copiar' })).toBeOnTheScreen();

      await user.press(screen.getByTestId('receipt-copy'));

      expect(screen.getByRole('button', { name: 'Copiado' })).toBeOnTheScreen();
      expect(screen.queryByRole('button', { name: 'Copiar' })).not.toBeOnTheScreen();
    });

    // A clipboard the OS refused is not worth a dialog over a punch that is
    // already recorded — but the label must not claim a copy that did not take.
    it('leaves the label alone when the clipboard refused', async () => {
      const user = userEvent.setup();
      const copyToClipboard = jest.fn().mockRejectedValue(new Error('denied'));
      await render(<Sheet copyToClipboard={copyToClipboard} />);

      await user.press(screen.getByTestId('receipt-copy'));

      expect(screen.getByRole('button', { name: 'Copiar' })).toBeOnTheScreen();
    });
  });

  /** #7 — the server's verdict, on the receipt. */
  describe('a punch made out of range', () => {
    it('adds the pending-review line in the warning colour', async () => {
      await render(<Sheet value={receipt({ geoStatus: 'outside' })} />);

      const line = screen.getByTestId('receipt-out-of-range');

      expect(line).toHaveTextContent('Marca fuera de rango — pendiente de revisión');
      expect(line).toHaveStyle({ color: tones.warning.foreground });
    });

    // The line is about the mark the register holds, not about what this phone
    // computed on the way there — an employee can press the override from
    // inside the fence, and the server is the one that decides.
    it.each(['inside', 'unknown'] as const)('says nothing for a %s mark', async (geoStatus) => {
      await render(<Sheet value={receipt({ geoStatus })} />);

      expect(screen.queryByTestId('receipt-out-of-range')).not.toBeOnTheScreen();
    });
  });

  /** #8 — on every receipt, without exception. */
  describe('the legal note', () => {
    it.each(['inside', 'outside', 'unknown'] as const)(
      'is present on a %s mark',
      async (geoStatus) => {
        await render(<Sheet value={receipt({ geoStatus })} />);

        expect(screen.getByTestId('receipt-legal')).toHaveTextContent(
          'Este registro forma parte del libro de asistencia electrónico (Resolución 38 de la Dirección del Trabajo).',
        );
      },
    );

    it('is present even on a receipt missing every optional field', async () => {
      await render(
        <Sheet value={receipt({ folio: null, employeeName: null, employeeRut: null })} />,
      );

      expect(screen.getByTestId('receipt-legal')).toBeOnTheScreen();
    });

    it('is drawn as muted body copy rather than as a warning', async () => {
      await render(<Sheet />);

      expect(screen.getByTestId('receipt-legal')).toHaveStyle({ color: colors.textMuted });
    });
  });

  /**
   * #9, stated as a structural fact rather than as an assertion about pixels.
   *
   * The sheet renders with no session provider, no clock and no navigation
   * around it. If any value on it came from client state, this render would
   * fail — which is the cheapest possible guard against a future edit reaching
   * for `useSession()` to fill a row the server left null.
   */
  it('needs nothing but the receipt to render', async () => {
    await render(<Sheet />);

    expect(screen.getByTestId('receipt-details')).toBeOnTheScreen();
    expect(screen.getByText('María Fernanda Soto')).toBeOnTheScreen();
  });
});
