import type { ViewStyle } from 'react-native';

import { colors, withAlpha } from './colors';

/**
 * Ported from the Kolvi design system, `tokens/shadows.css`. The CSS spells the
 * colour as `rgba(11,37,48,…)`, which is `colors.ink`; it is referenced rather than
 * restated so the app still has exactly one place hex values live.
 *
 * Two elevation levels plus the modal, and one glow. `boxShadow` is a real React
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

  /**
   * The punch button, and nothing else (KMO-17 #1).
   *
   * The odd one out: the other three are neutral elevation, and this one is the
   * button's own colour thrown onto the page. The design spells it inline rather
   * than as a token — `0 8px 24px rgba(255,79,94,.35)` — and it is what makes the
   * one action a screen exists for read as the one action, on a screen an
   * employee is scanning in a hurry outdoors. It lives here anyway, because a
   * shadow spelled out in `src/ui` is a hex value spelled out in `src/ui`.
   *
   * It is deliberately not drawn on the disabled button: the design drops it to
   * `transparent` there, and a glow under a control that will not respond is the
   * dimming saying one thing and the elevation another.
   */
  accent: { boxShadow: `0 8px 24px ${withAlpha(colors.accentCoral, 0.35)}` },
} as const satisfies Record<string, Pick<ViewStyle, 'boxShadow'>>;

export type ShadowToken = keyof typeof shadows;
