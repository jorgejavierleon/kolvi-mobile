import {
  colors,
  fontAssets,
  fontFamilies,
  hitTargetMin,
  radius,
  shadows,
  spacing,
  tones,
  typography,
  withAlpha,
} from './index';

/**
 * These assertions restate the design system's `tokens/*.css` independently of the
 * port, so a token that gets "tidied" in `src/theme` fails here rather than shipping
 * a Kolvi that no longer looks like Kolvi.
 */
describe('colors', () => {
  it('are all six-digit hex', () => {
    for (const [token, value] of Object.entries(colors)) {
      expect(`${token}: ${value}`).toMatch(/: #[0-9A-F]{6}$/);
    }
  });

  it('keeps the brand values from tokens/colors.css', () => {
    expect(colors.primary).toBe('#003D5C');
    expect(colors.primaryDeep).toBe('#00293D');
    expect(colors.accentCoral).toBe('#FF4F5E');
    expect(colors.ink).toBe('#0B2530');
  });

  it('aliases roles onto the ramp rather than restating hex', () => {
    expect(colors.textHeading).toBe(colors.ink);
    expect(colors.textBody).toBe(colors.slate);
    expect(colors.textMuted).toBe(colors.mid);
    expect(colors.surfaceCard).toBe(colors.white);
    expect(colors.surfacePage).toBe(colors.surface);
  });
});

describe('tones', () => {
  it('covers exactly the four semantic states', () => {
    expect(Object.keys(tones)).toEqual(['success', 'warning', 'danger', 'neutral']);
  });

  it('exposes every tone as a background/foreground pair', () => {
    for (const tone of Object.values(tones)) {
      expect(Object.keys(tone)).toEqual(['background', 'foreground']);
      expect(tone.background).not.toBe(tone.foreground);
    }
  });

  it('draws the neutral tone from the ramp', () => {
    expect(tones.neutral).toEqual({ background: colors.border, foreground: colors.slate });
  });
});

describe('typography', () => {
  // `weight size/line-height family` from tokens/typography.css, restated.
  const tokenFile = {
    display: { fontFamily: fontFamilies.display, fontSize: 42, ratio: 1.15 },
    h1: { fontFamily: fontFamilies.display, fontSize: 26, ratio: 1.2 },
    h2: { fontFamily: fontFamilies.display, fontSize: 22, ratio: 1.2 },
    h3: { fontFamily: fontFamilies.display, fontSize: 16, ratio: 1.3 },
    bodyLg: { fontFamily: fontFamilies.uiRegular, fontSize: 16, ratio: 1.6 },
    body: { fontFamily: fontFamilies.uiMedium, fontSize: 14, ratio: 1.5 },
    label: { fontFamily: fontFamilies.uiSemiBold, fontSize: 13, ratio: 1.4 },
    caption: { fontFamily: fontFamilies.uiSemiBold, fontSize: 12, ratio: 1.4 },
    eyebrow: { fontFamily: fontFamilies.uiSemiBold, fontSize: 11, ratio: 1.4 },
  } as const;

  /**
   * `mono` is the one preset with no line in `tokens/typography.css`: the design
   * writes the comprobante's hash inline as `600 11px/1.5 monospace` (KMO-19
   * #5). It is named here so that the assertion above stays "the token file and
   * nothing else" rather than quietly widening to whatever `typography` holds.
   */
  const inlinePresets = ['mono'];

  it('defines every preset the design system names, and no others', () => {
    expect(Object.keys(typography)).toEqual([...Object.keys(tokenFile), ...inlinePresets]);
  });

  it('draws the hash in the platform monospace at the design’s 11/1.5', () => {
    expect(typography.mono).toEqual({
      fontFamily: fontFamilies.mono,
      fontSize: 11,
      lineHeight: 17,
    });
  });

  it.each(Object.entries(tokenFile))('%s matches the token file', (name, expected) => {
    expect(typography[name as keyof typeof tokenFile]).toEqual({
      fontFamily: expected.fontFamily,
      fontSize: expected.fontSize,
      lineHeight: Math.round(expected.fontSize * expected.ratio),
    });
  });

  it('carries no fontWeight, so Android never fakes a bold', () => {
    for (const preset of Object.values(typography)) {
      expect(preset).not.toHaveProperty('fontWeight');
    }
  });

  it('bundles a font file for every family a preset asks for', () => {
    for (const preset of Object.values(typography)) {
      if (preset.fontFamily === fontFamilies.mono) {
        // The platform's own face. `useFonts` has no file to load for it, which
        // is the point — see the note on `fontAssets`.
        continue;
      }

      expect(fontAssets[preset.fontFamily as keyof typeof fontAssets]).toBeDefined();
    }
  });

  it('stops at the weights Kolvi ships — 700 display, 600 UI', () => {
    expect(Object.values(fontFamilies)).toEqual([
      'Sora_700Bold',
      'PlusJakartaSans_400Regular',
      'PlusJakartaSans_500Medium',
      'PlusJakartaSans_600SemiBold',
      // `Platform.select` resolves per platform — `monospace` on Android,
      // `Menlo` on iOS — so the assertion names both rather than pinning the
      // one the test runner happens to be. Neither is a bundled weight.
      expect.stringMatching(/^(?:monospace|Menlo)$/),
    ]);
  });
});

describe('spacing', () => {
  it('stays on the 4px step of the 8px grid', () => {
    for (const [token, value] of Object.entries(spacing)) {
      expect(value).toBe(Number(token) * 4);
    }
  });

  it('exports the minimum hit target', () => {
    expect(hitTargetMin).toBe(44);
  });
});

describe('radius', () => {
  it('matches tokens/radius.css', () => {
    expect(radius).toEqual({ sm: 8, md: 12, lg: 16, pill: 999 });
  });
});

describe('shadows', () => {
  it('matches tokens/shadows.css, tinted with ink rather than black', () => {
    expect(shadows).toEqual({
      level1: { boxShadow: '0 1px 3px #0B253014' },
      level2: { boxShadow: '0 4px 16px #0B25301A' },
      modal: { boxShadow: '0 4px 20px #0B25301A' },
      accent: { boxShadow: '0 8px 24px #FF4F5E59' },
    });
  });

  it('throws the punch button its own colour rather than ink', () => {
    // The design's `rgba(255,79,94,.35)`, which is `colors.accentCoral` — the
    // one glow in the app, and the reason it is a token rather than an inline
    // style in `src/ui/button.tsx`.
    expect(shadows.accent.boxShadow).toContain(colors.accentCoral);
  });
});

describe('withAlpha', () => {
  it('appends the alpha byte', () => {
    expect(withAlpha('#0B2530', 1)).toBe('#0B2530FF');
    expect(withAlpha('#0B2530', 0.5)).toBe('#0B253080');
    expect(withAlpha('#0B2530', 0)).toBe('#0B253000');
  });
});
