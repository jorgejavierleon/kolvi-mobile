import type { ViewStyle } from 'react-native';

import { colors, withAlpha } from './colors';

/**
 * Ported from the Kolvi design system, `tokens/shadows.css`. The CSS spells the
 * colour as `rgba(11,37,48,…)`, which is `colors.ink`; it is referenced rather than
 * restated so the app still has exactly one place hex values live.
 *
 * Two elevation levels plus the modal, and no more. `boxShadow` is a real React
 * Native style prop under the New Architecture and maps 1:1 onto the CSS, so the
 * token survives the port intact instead of being re-approximated with `elevation`.
 */
export const shadows = {
  /** `--shadow-1` — rows, chips, the default card */
  level1: { boxShadow: `0 1px 3px ${withAlpha(colors.ink, 0.08)}` },
  /** `--shadow-2` — elevated cards, popovers */
  level2: { boxShadow: `0 4px 16px ${withAlpha(colors.ink, 0.1)}` },
  /** `--shadow-modal` — modals and bottom sheets */
  modal: { boxShadow: `0 4px 20px ${withAlpha(colors.ink, 0.1)}` },
} as const satisfies Record<string, Pick<ViewStyle, 'boxShadow'>>;

export type ShadowToken = keyof typeof shadows;
