/**
 * The Kolvi design tokens, ported from the design system's `tokens/` CSS files.
 * They are the single source of truth for the employee app; per the design-system
 * decision in docs/design-decisions.md the app does not share the admin console's
 * Tailwind theme, and the two are deliberately not reconciled.
 *
 * Import from `@/theme`, never from the individual files.
 */
export { colors, tones, withAlpha } from './colors';
export type { ColorToken, Tone, ToneColors } from './colors';

export { fontFamilies, fontWeights, typography } from './typography';
export type { FontFamily, FontFamilyToken, TypographyPreset, TypographyStyle } from './typography';

export { fontAssets, useKolviFonts } from './fonts';

export { hitTargetMin, spacing } from './spacing';
export type { SpacingToken } from './spacing';

export { radius } from './radius';
export type { RadiusToken } from './radius';

export { shadows } from './shadows';
export type { ShadowToken } from './shadows';
