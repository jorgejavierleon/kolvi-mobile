import { render, screen } from '@testing-library/react-native';

import { radius, tones, typography, type Tone } from '@/theme';

import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders as a pill', async () => {
    await render(<StatusBadge label="Completo" tone="success" testID="badge" />);

    expect(screen.getByTestId('badge')).toHaveStyle({ borderRadius: radius.pill });
  });

  // #3 — the colour is a repeat of the label, never a substitute for it. An
  // employee who cannot separate the amber pill from the green one still reads
  // "Atrasado".
  it.each<[Tone, string]>([
    ['success', 'Completo'],
    ['warning', 'Atrasado'],
    ['danger', 'Ausente'],
    ['neutral', 'Con permiso'],
  ])('states %s in words as well as colour', async (tone, label) => {
    await render(<StatusBadge label={label} tone={tone} testID="badge" />);

    expect(screen.getByText(label)).toBeOnTheScreen();
    expect(screen.getByTestId('badge')).toHaveStyle({ backgroundColor: tones[tone].background });
    expect(screen.getByText(label)).toHaveStyle({ color: tones[tone].foreground });
  });

  it('takes both colours from the same tone pair, never mixing two', async () => {
    await render(<StatusBadge label="Atrasado" tone="warning" testID="badge" />);

    const { background, foreground } = tones.warning;
    expect(screen.getByTestId('badge')).toHaveStyle({ backgroundColor: background });
    expect(screen.getByText('Atrasado')).toHaveStyle({ color: foreground });
    expect(background).not.toBe(foreground);
  });

  it('types the label from the eyebrow preset', async () => {
    await render(<StatusBadge label="Completo" tone="success" />);

    expect(screen.getByText('Completo')).toHaveStyle(typography.eyebrow);
  });

  it('shrinks and wraps rather than overflowing its row at a large font scale', async () => {
    await render(<StatusBadge label="Pendiente de revisión" tone="warning" testID="badge" />);

    expect(screen.getByTestId('badge')).toHaveStyle({ flexShrink: 1 });
    // No numberOfLines: a truncated status is an unreadable status.
    expect(screen.getByText('Pendiente de revisión')).not.toHaveProp(
      'numberOfLines',
      expect.anything(),
    );
  });
});
