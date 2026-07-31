/**
 * Ported from the Kolvi design system, `tokens/radius.css`. Nothing in the app has
 * sharp corners.
 */
export const radius = {
  /** chips, small inputs */
  sm: 8,
  /** buttons, form fields */
  md: 12,
  /** cards, modals, bottom sheets */
  lg: 16,
  /** badges, avatars */
  pill: 999,
} as const;

export type RadiusToken = keyof typeof radius;
