/**
 * Ported from the Kolvi design system, `tokens/spacing.css`. Strict 8px base grid;
 * the key is the CSS token's number and the value is `key * 4`.
 *
 * Only these steps exist, so `spacing[7]` is a compile error rather than a quiet
 * 28px that breaks the grid.
 */
export const spacing = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  11: 44,
} as const;

export type SpacingToken = keyof typeof spacing;

/**
 * `--hit-target-min`. Every touchable — including icon-only ones inside a denser
 * layout — is at least this tall and wide. Punching happens outdoors, often with
 * gloves on.
 */
export const hitTargetMin = spacing[11];
