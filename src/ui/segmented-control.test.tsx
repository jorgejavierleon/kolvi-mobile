import { render, screen, userEvent } from '@testing-library/react-native';

import { colors, hitTargetMin, radius, typography } from '@/theme';

import { SegmentedControl, type Segment } from './segmented-control';

type JornadaTab = 'proximos' | 'historial';

const jornada: readonly [Segment<JornadaTab>, Segment<JornadaTab>] = [
  { value: 'proximos', label: 'Próximos' },
  { value: 'historial', label: 'Historial' },
];

const noop = () => {};

/** WCAG 2.1 relative luminance, then the standard (L1+0.05)/(L2+0.05). */
function contrastRatio(foreground: string, background: string): number {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const [r, g, b] = channels.map((c) =>
      c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4,
    );

    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };

  const [lighter, darker] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);

  return (lighter! + 0.05) / (darker! + 0.05);
}

describe('SegmentedControl', () => {
  it('renders both options', async () => {
    await render(<SegmentedControl segments={jornada} value="proximos" onChange={noop} />);

    expect(screen.getByText('Próximos')).toBeOnTheScreen();
    expect(screen.getByText('Historial')).toBeOnTheScreen();
  });

  it('styles the selected segment as the raised white one, per the design', async () => {
    await render(<SegmentedControl segments={jornada} value="proximos" onChange={noop} />);

    const [proximos, historial] = screen.getAllByRole('tab');

    expect(proximos).toHaveStyle({ backgroundColor: colors.surfaceCard });
    expect(screen.getByText('Próximos')).toHaveStyle({ color: colors.primary });

    expect(historial).not.toHaveStyle({ backgroundColor: colors.surfaceCard });
    expect(screen.getByText('Historial')).toHaveStyle({ color: colors.textBody });
  });

  // The design's `--text-muted` on the track is 3.1:1, under the 4.5:1 WCAG AA
  // wants for 13px text; `textBody` is 6.0:1. Asserted rather than left to a
  // comment so the muted value cannot drift back in for fidelity's sake.
  it('keeps the unselected label above the AA contrast floor for its size', async () => {
    await render(<SegmentedControl segments={jornada} value="proximos" onChange={noop} />);

    expect(contrastRatio(colors.textBody, colors.border)).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByText('Historial')).not.toHaveStyle({ color: colors.textMuted });
  });

  it('tints the track with the border colour and insets the segments', async () => {
    await render(
      <SegmentedControl segments={jornada} value="proximos" onChange={noop} testID="control" />,
    );

    expect(screen.getByTestId('control')).toHaveStyle({
      backgroundColor: colors.border,
      borderRadius: radius.md,
    });
  });

  it('rounds the segment to the track radius less its inset', async () => {
    await render(<SegmentedControl segments={jornada} value="proximos" onChange={noop} />);

    // 12 - 4 = 8: the inner corner sits concentric with the outer one.
    expect(screen.getAllByRole('tab')[0]).toHaveStyle({ borderRadius: radius.sm });
  });

  it('reports the value of the segment pressed', async () => {
    const user = userEvent.setup();
    const onChange = jest.fn();
    await render(<SegmentedControl segments={jornada} value="proximos" onChange={onChange} />);

    await user.press(screen.getByText('Historial'));

    expect(onChange).toHaveBeenCalledWith('historial');
  });

  it('moves the selection when the caller changes value', async () => {
    await render(<SegmentedControl segments={jornada} value="proximos" onChange={noop} />);
    expect(screen.getByRole('tab', { name: 'Próximos' })).toBeSelected();

    await screen.rerender(
      <SegmentedControl segments={jornada} value="historial" onChange={noop} />,
    );
    expect(screen.getByRole('tab', { name: 'Historial' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Próximos' })).not.toBeSelected();
  });

  describe('accessibility', () => {
    it('is a tablist of named tabs, with the selection announced', async () => {
      await render(
        <SegmentedControl
          segments={jornada}
          value="proximos"
          onChange={noop}
          accessibilityLabel="Vista de jornada"
          testID="control"
        />,
      );

      // The track carries the group's role and name but is deliberately not an
      // accessibility element itself — marking it one would collapse both tabs
      // into a single node on iOS and lose the selection.
      expect(screen.getByTestId('control')).toHaveProp('accessibilityRole', 'tablist');
      expect(screen.getByTestId('control')).toHaveProp('accessibilityLabel', 'Vista de jornada');

      expect(screen.getByRole('tab', { name: 'Próximos' })).toBeSelected();
      expect(screen.getByRole('tab', { name: 'Historial' })).not.toBeSelected();
    });

    // #7 — the design draws a 36dp segment; a segment is a control, so it gets
    // the 44dp minimum and the track grows to fit.
    it('gives each segment the minimum hit target', async () => {
      await render(<SegmentedControl segments={jornada} value="proximos" onChange={noop} />);

      for (const tab of screen.getAllByRole('tab')) {
        expect(tab).toHaveStyle({ minHeight: hitTargetMin });
      }
    });
  });

  it('centres and wraps a label rather than clipping it at a large font scale', async () => {
    await render(
      <SegmentedControl
        segments={[
          { value: 'lista', label: 'Mis solicitudes' },
          { value: 'calendario', label: 'Calendario' },
        ]}
        value="lista"
        onChange={noop}
      />,
    );

    expect(screen.getByText('Mis solicitudes')).toHaveStyle({
      ...typography.label,
      textAlign: 'center',
    });
    expect(screen.getByText('Mis solicitudes')).not.toHaveProp('numberOfLines', expect.anything());
  });
});
