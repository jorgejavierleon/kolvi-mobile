---
id: KMO-4
title: Navigation shell with the four-tab bar
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-01 14:20'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies:
  - KMO-3
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 4000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The persistent chrome: a bottom tab bar with Inicio, Jornada, Permisos and Documentos, plus the profile surface that opens over any tab from the avatar button in the header.

Jornada and Documentos carry a coral count badge for pending mark corrections and pending signatures respectively.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Four tabs render with the design icons and labels Inicio, Jornada, Permisos, Documentos; the active tab uses the primary colour and inactive tabs the muted colour
- [x] #2 Tab bar sits on a white surface with the border-top from the design and respects the device safe area
- [x] #3 Jornada and Documentos tab items render a coral count badge when their pending count is greater than zero, and no badge when it is zero
- [x] #4 The avatar button in each tab header opens the profile surface as a full-screen overlay with a back affordance, over any tab
- [x] #5 Tab state and per-tab scroll position survive switching tabs and returning
- [x] #6 Screen-reader users hear the tab name and the pending count when a badge is present
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read the tab bar, the four tab headers and the profile overlay out of `Kolvi App.dc.html` through DesignSync — the same route KMO-3 used — so the paddings, the icon paths and the badge geometry are the design's own values.
2. Add `react-native-svg` (SDK-pinned 15.15.4). The design's icons are inline Lucide SVG paths; with SVG they are reproduced exactly rather than approximated from an icon font.
3. `src/i18n/index.ts` — start the es-CL catalogue with the shell's strings only (tab names, header titles, the profile surface, the a11y pending-count label). KMO-6 grows it; the shell must not scatter literals across six route files.
4. `src/ui/icons.tsx` — the five design icons as typed components (home, clock, calendar-check, file-text, chevron-left) plus a user glyph for the avatar until KMO-8 supplies initials.
5. `src/ui/tab-bar.tsx` — presentational bottom bar: white surface, border-top, bottom safe-area inset, four items, coral count badge hidden from the a11y tree because the count is spoken as part of the tab's own name.
6. `src/ui/screen-header.tsx`, `src/ui/screen.tsx`, `src/ui/overlay-header.tsx` — the repeated chrome. The tab header scrolls with the content, as the design draws it, rather than being pinned by the navigator.
7. `src/app/(tabs)/_layout.tsx` — `Tabs` from `expo-router/js-tabs` (React Navigation is vendored inside expo-router, so no new navigation dependency), `headerShown: false`, custom `tabBar`. Four routes: `index`, `jornada`, `permisos`, `documentos`.
8. `src/app/perfil.tsx` on the root Stack, so it covers the tab bar; back chevron plus the hardware back button.
9. Delete `src/ui/placeholder-screen.tsx` and re-anchor `flows/kmo-3-ui-primitives.yaml`, which waits on its copy.
10. Jest for what renders in isolation (#1, #3, #6); `flows/kmo-4-navigation-shell.yaml` for what only a device can show (#2, #4, #5).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What shipped

`src/app/(tabs)/` — `Tabs` from `expo-router/js-tabs` with a hand-drawn `tabBar`. No new navigation dependency: expo-router vendors React Navigation under `build/react-navigation/`, so `BottomTabBarProps` and the navigator both come from the package already installed.

`src/ui/`: `tab-bar`, `screen-header`, `overlay-header`, `screen`, `icons`, and the temporary `section-scaffold`. `placeholder-screen` is gone.

**One new dependency: `react-native-svg` 15.15.4** (the SDK 57 pin). The design's tab icons are inline Lucide SVG paths; with SVG they are transcribed path-for-path out of `Kolvi App.dc.html` rather than approximated from an icon font. It is a native module, so the dev build had to be rebuilt.

**`src/i18n/index.ts` exists now, holding the shell's strings only.** The alternative was scattering Spanish literals across six route files, against a convention the README already states. KMO-6 grows it — this does not preempt its structure, only starts the file.

## Decisions

**Tab order is declared, not inherited.** Expo Router sorts routes by filename with `index` first, which puts Documentos second. The bar reads its own table, and `key` is separate from the route name so a flow taps `tab-inicio` rather than `tab-index` — and rather than the label `Inicio`, which is the same word as the screen title beneath it.

**The tab header scrolls; the profile header is pinned.** Both follow the design. The tab header is inside the scroll area (the home screen gives its first screenful to the clock, and a fixed bar would take a slice back); the profile bar carries the only way back, so it cannot scroll out of reach. The pinned bar also takes the status-bar inset itself, so its white runs to the top edge instead of leaving a strip of page tint above it.

**Badge counts are zero and stay zero.** KMO-35 wires pending corrections and KMO-42 pending signatures. Seeding numbers to make the pill visible on a device would be the sample data KMO-30 exists to keep out of a build, so #3 is carried by `tab-bar.test.tsx` — the cheapest tier that can honestly carry it.

**No initials in the avatar.** The design fills it with the employee's; there is no session until KMO-8. It falls back to a person glyph rather than to invented initials.

**`textMuted` on the inactive tab is 3.83:1 on white** — under the 4.5:1 WCAG AA wants at that size, though well clear of the 3.1:1 the same token hit on the segmented control's tinted track in KMO-3. Left as the design draws it, because #1 asks for the muted colour and because `--text-muted` is used 63 times across the design: it is a design-system-level decision, and KMO-28 is where it belongs. Recorded in a comment beside the line so it cannot be lost.

## Harness change

`app.config.ts` now passes `toolsButton: false` to the `expo-dev-client` plugin. The dev client's floating tools button parks itself in the top-right corner — exactly where the design puts the avatar — and swallowed every tap on it, so no flow could reach the profile. Debug builds only; the dev menu is still one `adb shell input keyevent 82` away.

`flows/kmo-1`, `kmo-2` and `kmo-3` asserted on the deleted placeholder copy and were re-anchored to the shell's own.

## Validation

`npm run check` — typecheck, ESLint, Prettier and 120 Jest tests, all green. 24 of them are new, across `tab-bar`, `screen-header`, `overlay-header` and `screen`.

`npm run test:e2e` — 4/4 flows pass against the headless emulator, including the new `flows/kmo-4-navigation-shell.yaml`.

Evidence per criterion:

- **#1** — `tab-bar.test.tsx`: the four labels in order; the active label at `colors.primary` and the other three at `colors.textMuted`; the tint moving when the active tab changes. The icons are the design's own path data (`src/ui/icons.tsx`), checked by eye against the design on `kmo-4-tab-bar.png`.
- **#2** — `tab-bar.test.tsx`: `surfaceCard` background with a 1dp `colors.border` top edge, and `paddingBottom` = the bar's own 12dp **plus** the 48dp device inset rather than in place of it. On the device, `kmo-4-tab-bar.png` shows the labels clear of the gesture bar.
- **#3** — `tab-bar.test.tsx`: no badge at zero on either tab; a coral pill at `radius.pill` on Jornada and Documentos when their counts are positive, with Inicio and Permisos never badged; and only the tab whose count is positive badged when just one is. Device evidence is limited to the zero case, for the reason in the decisions above.
- **#4** — `screen-header.test.tsx` and `overlay-header.test.tsx` for the two controls. On the device the flow opens the profile from Documentos, asserts the tab bar is gone underneath it, returns with `Volver`, then opens it again from Inicio and dismisses it with the hardware back button — `kmo-4-perfil.png`.
- **#5** — device only. The flow scrolls Jornada to `Fin de Jornada`, switches to Permisos, asserts the marker is gone, switches back and asserts it is still on screen. A shell that remounted the screen would return it to the top.
- **#6** — `tab-bar.test.tsx`: the tab is found by the accessible name `Jornada, 2 pendientes` / `Documentos, 1 pendiente` when counts are pending and by the bare name when they are not, and the pill itself is absent from the accessibility tree so the count is not announced twice. Maestro drives the app through that same tree, so the flow tapping `Abrir mi perfil` — a label with no visible text behind it — is the device-side confirmation that these names are what Android exposes.

## Known flake

`shared/launch.yaml` failed once mid-suite: its `back` press raced the developer menu's dismissal, backed out of the app and left the run on the launcher. Pre-existing in the KMO-47 harness and unrelated to this change — the same flow passed on the immediate re-run and on a full clean suite afterwards.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The app now opens into the design's persistent chrome: a bottom bar with Inicio, Jornada, Permisos and Documentos, and the profile surface opening over any of them from the avatar in the tab header.

`src/app/(tabs)/` holds the navigator — `Tabs` from `expo-router/js-tabs` with a hand-drawn tab bar, so the order, the coral count badge and the spoken names are all ours rather than React Navigation's defaults. `src/ui/` gains `tab-bar`, `screen-header`, `overlay-header`, `screen` and `icons`; `placeholder-screen` is deleted and `src/i18n` starts with the shell's copy. One new dependency, `react-native-svg`, so the design's Lucide icons are transcribed path-for-path from `Kolvi App.dc.html` instead of approximated.

Verified with `npm run check` (typecheck, lint, format, 120 Jest tests) and `npm run test:e2e` (4/4 Maestro flows on the emulator, including the new `kmo-4-navigation-shell.yaml`). #1, #2, #3 and #6 are carried by `tab-bar.test.tsx` — labels and tints, the white surface with its border-top and the safe-area inset added to its own padding, the badge above and at zero, and the accessible name that carries the count. #4 and #5 are device-only and carried by the flow: the profile opens over two different tabs and dismisses by both chevron and hardware back, and Jornada comes back still scrolled to where it was left.

Two things this deliberately does not do. The badge counts are hardcoded to zero — KMO-35 and KMO-42 supply them, and seeding numbers to make the pill visible would be the sample data KMO-30 exists to prevent. The avatar shows a glyph rather than initials, because there is no session until KMO-8.

One harness change came with it: `toolsButton: false` on the `expo-dev-client` plugin. The dev client's floating button sits exactly where the design puts the avatar and swallowed every tap on it, so no flow could reach the profile until it was off.
<!-- SECTION:FINAL_SUMMARY:END -->
