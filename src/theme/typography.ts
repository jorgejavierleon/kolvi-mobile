import { Platform } from 'react-native';

/**
 * Ported from the Kolvi design system, `tokens/typography.css`.
 *
 * The CSS shorthand there is `weight size/line-height family`, e.g.
 * `--text-h1: 700 26px/1.2 var(--font-display)`. React Native has no such shorthand
 * and — importantly — cannot pick a weight out of a family the way a browser can:
 * on Android an unmatched `fontWeight` gets faked by smearing the glyphs. So the
 * weight is baked into the family name (`Sora_700Bold`) and the presets deliberately
 * carry no `fontWeight`.
 */

/**
 * Families as registered by `useKolviFonts`, one per weight actually used.
 *
 * Kolvi ships lighter cuts than the typefaces' boldest: 700 for headlines (not
 * Sora's 800) and 600 for UI emphasis (not Jakarta's 700). That restraint is the
 * brand — calm competence, not shouting.
 *
 * `mono` is the exception to all of that, and to `fontAssets` as well: it is the
 * platform's own monospace face rather than a bundled one. The design writes the
 * comprobante's SHA-256 as generic `monospace` and names no typeface, and the
 * one thing that face has to do — keep a 64-character hex string on a fixed
 * advance so a reader can compare it against the emailed copy character by
 * character — every system mono already does. Bundling a fourth family would
 * add a font file to the splash path that can fail to decode, for a string
 * nobody reads for its shapes.
 */
export const fontFamilies = {
  /** `--font-display` at `--weight-headline` */
  display: 'Sora_700Bold',
  /** `--font-ui` at `--weight-ui-regular` */
  uiRegular: 'PlusJakartaSans_400Regular',
  /** `--font-ui` at `--weight-ui-medium` */
  uiMedium: 'PlusJakartaSans_500Medium',
  /** `--font-ui` at `--weight-ui-bold` */
  uiSemiBold: 'PlusJakartaSans_600SemiBold',
  /**
   * The design's bare `monospace`. Android resolves that name itself; iOS does
   * not, and falls back to the system UI font — which would silently lose the
   * fixed advance the hash is shown in — so it is named there.
   */
  mono: Platform.select<'Menlo' | 'monospace'>({ ios: 'Menlo', default: 'monospace' }),
} as const;

export type FontFamilyToken = keyof typeof fontFamilies;
export type FontFamily = (typeof fontFamilies)[FontFamilyToken];

/**
 * The families with a `.ttf` behind them, which is every one except `mono`.
 * `fontAssets` is keyed on this rather than on `FontFamily` so that adding a
 * platform face to the table above cannot silently create a font the loader is
 * then required to find a file for.
 */
export type BundledFontFamily = (typeof fontFamilies)[Exclude<FontFamilyToken, 'mono'>];

/**
 * The numeric weights the token file names. The presets do not use these (see the
 * note above); they are here so the values have one home if a surface that *can*
 * synthesise weights — the web build — ever needs them.
 */
export const fontWeights = {
  headline: 700,
  uiRegular: 400,
  uiMedium: 500,
  uiBold: 600,
} as const;

export type TypographyStyle = {
  readonly fontFamily: FontFamily;
  readonly fontSize: number;
  readonly lineHeight: number;
};

/**
 * The CSS line heights are unitless ratios; React Native wants pixels. Rounding to a
 * whole pixel keeps text on the same grid the spacing scale uses.
 */
function preset(fontFamily: FontFamily, fontSize: number, ratio: number): TypographyStyle {
  return { fontFamily, fontSize, lineHeight: Math.round(fontSize * ratio) };
}

/**
 * The nine presets from the token file. Text in the app uses one of these whole —
 * spreading a preset and then overriding `fontSize` defeats the point.
 */
export const typography = {
  /** `--text-display` — the clock on the home screen, nothing else */
  display: preset(fontFamilies.display, 42, 1.15),
  /** `--text-h1` — screen titles */
  h1: preset(fontFamilies.display, 26, 1.2),
  /** `--text-h2` — section headings */
  h2: preset(fontFamilies.display, 22, 1.2),
  /** `--text-h3` — card titles */
  h3: preset(fontFamilies.display, 16, 1.3),
  /** `--text-body-lg` — reading copy: legal notes, help content */
  bodyLg: preset(fontFamilies.uiRegular, 16, 1.6),
  /** `--text-body` — the default */
  body: preset(fontFamilies.uiMedium, 14, 1.5),
  /** `--text-label` — form labels, buttons, list rows */
  label: preset(fontFamilies.uiSemiBold, 13, 1.4),
  /** `--text-caption` — secondary metadata */
  caption: preset(fontFamilies.uiSemiBold, 12, 1.4),
  /** `--text-eyebrow` — the small uppercase kicker above a heading */
  eyebrow: preset(fontFamilies.uiSemiBold, 11, 1.4),
  /**
   * The comprobante's SHA-256, and nothing else (KMO-19 #5).
   *
   * Not from the token file — the design writes this one inline as
   * `600 11px/1.5 monospace`, because it is the only string in the app that is
   * data rather than language. The generous 1.5 is what makes a 64-character
   * hash readable once it wraps across four lines.
   */
  mono: preset(fontFamilies.mono, 11, 1.5),
} as const;

export type TypographyPreset = keyof typeof typography;
