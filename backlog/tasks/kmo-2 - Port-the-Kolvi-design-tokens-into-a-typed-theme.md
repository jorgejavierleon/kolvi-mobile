---
id: KMO-2
title: Port the Kolvi design tokens into a typed theme
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-07-31 20:30'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies: []
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design ships a token-based system that the app adopts rather than re-derives. Per the design-system decision the employee app does NOT share the admin console theme, so these tokens are the single source of truth for the app.

Source files in the design project under _ds/kolvi-design-system-6b0e16fe-306c-4d78-bc48-383a8012a48e/tokens/ (colors, typography, spacing, radius, shadows) plus styles.css. The token values are reproduced in the Design system tokens section of docs/design-decisions.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A theme module exports colors, typography, spacing, radius and shadows matching the token files exactly; hex values are not duplicated anywhere else in the codebase
- [x] #2 Semantic tones success, warning, danger and neutral are exposed as background/foreground pairs and are the only way status colour is applied
- [x] #3 The Sora and Plus Jakarta Sans font families are bundled and load before first paint; headlines use weight 700 and UI emphasis 600, not the boldest cuts
- [x] #4 Typography presets exist for display, h1, h2, h3, body-lg, body, label, caption and eyebrow with the sizes and line heights from the token file
- [x] #5 Spacing follows the 8px grid and a hit-target-min of 44px is exported for reuse
- [x] #6 The theme is typed so an unknown token name is a compile error
- [x] #7 A lint rule or documented convention prevents raw hex colours and raw font sizes in feature code
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Locate the design system's token CSS (found on disk: the Claude Design export at ~/Downloads/Kolvi Brand Kit Design, project id 6b0e16fe — the same id the task references) and port colors, typography, spacing, radius and shadows verbatim.
2. src/theme/{colors,typography,spacing,radius,shadows}.ts, each an `as const` record with an exported key union, re-exported from src/theme/index.ts. Semantic tones exposed only as background/foreground pairs; the semantic hexes are not reachable through `colors`.
3. Bundle Sora 700 and Plus Jakarta Sans 400/500/600 via @expo-google-fonts + expo-font; `useKolviFonts` in the root layout holds expo-splash-screen up until they resolve, so the first painted frame is already in the brand faces.
4. Remove the last duplicated hex: convert app.json to app.config.ts so the splash and adaptive-icon colours import colors.primary.
5. Enforce the convention with ESLint no-restricted-syntax over src/** and app.config.ts (hex, rgb()/hsl(), bare fontSize/lineHeight/fontWeight/fontFamily), src/theme exempted.
6. Jest: restate the token files independently and assert the port matches; assert every preset's family has a bundled file; assert the font gate's failure path lets the app through.
7. Verify on the emulator that the fonts render and the splash lifts.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Token source.** The task pointed at the design project; the export is on disk at ~/Downloads/Kolvi Brand Kit Design (.design-sync/config.json carries projectId 6b0e16fe-306c-4d78-bc48-383a8012a48e — the same id the task references), so the five token CSS files were ported from the actual source rather than reconstructed from the prose in docs/design-decisions.md, which does not carry the type scale.

**Weights live in the font family name.** React Native cannot pick a weight out of a family the way a browser can — on Android an unmatched fontWeight is faked by smearing the glyphs. So each preset names a weight-specific family (Sora_700Bold, PlusJakartaSans_500Medium) and deliberately carries no fontWeight; a test asserts the absence. The numeric weights from the token file are still exported as `fontWeights` for the web build.

**Line heights.** The CSS ratios (42px/1.15 etc.) are kept as ratios in source and rounded to whole pixels at construction, so the token values stay literally visible in the port.

**Shadows use boxShadow.** A real style prop under the New Architecture, so `0 1px 3px rgba(11,37,48,.08)` survives the port 1:1 instead of being re-approximated with elevation. The rgba is colors.ink, referenced through a withAlpha() helper rather than restated.

**app.json became app.config.ts.** The last two duplicated hexes were the splash and adaptive-icon backgrounds; they now import colors.primary. Expo's config loader resolves TypeScript only when the specifier spells the extension out, hence the './src/theme/colors.ts' import and allowImportingTsExtensions in tsconfig.

**Font failure does not trap the app.** useKolviFonts reports ready on error as well as on success. Falling back to the system font is bad; a splash screen that never lifts because a .ttf did not decode leaves the employee unable to punch, which is worse.

**Unrelated finding.** The KMO-1 flow failed twice mid-session with a SIGSEGV on the JS thread during the dev-client bootstrap. Cause was a Metro process that had been running since 30 Jul, i.e. started before expo-font was installed; against a freshly started bundler KMO-1 and KMO-2 both pass. Not a code defect — but a long-lived Metro must be restarted after a native dependency is added.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Ported the Kolvi design system's five token files into a typed theme under src/theme — colors (with the semantic tones as background/foreground pairs), the nine typography presets, the 8px spacing grid, radius and the two shadow levels — sourced from the design project export on disk rather than from prose, and made it the only place a colour or a size is spelled out.

Sora 700 and Plus Jakarta Sans 400/500/600 are bundled via @expo-google-fonts; the root layout holds expo-splash-screen up until they resolve, and lets the app through if one fails to decode rather than trapping the employee behind a splash. app.json became app.config.ts so the splash and adaptive-icon colours import colors.primary — after which no hex appears outside src/theme at all. An ESLint no-restricted-syntax rule over src/** and app.config.ts fails the build on a hex, an rgb()/hsl() or a bare fontSize/lineHeight/fontWeight/fontFamily.

Verified: 30 Jest tests, including an independent restatement of each token file that the port is checked against; a throwaway tsc probe confirming colors.brandTeal, tones.info, typography.h4, spacing[7], radius.xl and shadows.level3 are all compile errors; an ESLint probe confirming the rule fires on each banned form; 'npx expo export --platform android' showing the four .ttf files in the bundle; and on the emulator a cold start with cleared state rendering the title in Sora and the subtitle in Plus Jakarta Sans (flows/kmo-2-fonts-load.yaml, screenshot in .artifacts). 'npm run check' and both Maestro flows pass.
<!-- SECTION:FINAL_SUMMARY:END -->
