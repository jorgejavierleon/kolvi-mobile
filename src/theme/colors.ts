/**
 * Ported verbatim from the Kolvi design system, `tokens/colors.css` (design project
 * `6b0e16fe-306c-4d78-bc48-383a8012a48e`). Reproduced in docs/design-decisions.md
 * under "Design system tokens".
 *
 * This file holds every hex value in the app. Nothing else — feature code, `src/ui`,
 * even `app.config.ts` — spells a colour out; the ESLint `no-restricted-syntax` rule
 * in `eslint.config.js` enforces that.
 */

/**
 * The raw ramp. Neutrals are warm teal-tinted grays on purpose, never cool grays —
 * cool grays are what buk.cl and Talana look like.
 */
const palette = {
  primary: '#003D5C',
  primaryDeep: '#00293D',
  accentCoral: '#FF4F5E',
  ink: '#0B2530',
  slate: '#3E5964',
  mid: '#5F8993',
  muted: '#AFD0DA',
  border: '#D6EBEE',
  surface: '#F5F7FA',
  bgPage: '#E4F1F4',
  white: '#FFFFFF',
} as const;

/** The ramp plus the token file's role aliases. */
export const colors = {
  ...palette,
  textHeading: palette.ink,
  textBody: palette.slate,
  textMuted: palette.mid,
  surfaceCard: palette.white,
  surfacePage: palette.surface,
} as const;

export type ColorToken = keyof typeof colors;

/**
 * Semantic tones, as background/foreground pairs. **This is the only way status
 * colour is applied** — a badge, a geolocation card or a banner picks a tone, never
 * a palette entry, so a state cannot drift between screens.
 *
 * The four tones map 1:1 onto the server's `badge()` tones (`success` / `warning` /
 * `destructive` / `neutral`, the last two named `danger` / `neutral` here) so web and
 * mobile never disagree about what a state looks like.
 */
export const tones = {
  success: { background: '#DFF3EC', foreground: '#0E7A54' },
  warning: { background: '#FDECC8', foreground: '#A66A0A' },
  danger: { background: '#FFE1E1', foreground: '#C41E2E' },
  neutral: { background: palette.border, foreground: palette.slate },
} as const;

export type Tone = keyof typeof tones;
export type ToneColors = (typeof tones)[Tone];

/**
 * `#RRGGBB` plus an alpha byte, for the shadow tokens. Keeping it a function is what
 * lets the shadows reference `colors.ink` instead of restating it as `rgba(11,37,48)`.
 */
export function withAlpha(color: string, alpha: number): string {
  const byte = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')
    .toUpperCase();

  return `${color}${byte}`;
}
