---
id: KMO-3
title: Build the shared UI primitives the design repeats
status: Done
assignee:
  - '@jorge'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-01 13:21'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies:
  - KMO-2
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design reuses a small set of shapes across all four tabs. Building them once keeps the app visually coherent and makes each feature task an assembly job.

Read the design file to derive exact paddings, radii and shadows rather than approximating them.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Button supports primary, secondary/outline and danger-outline variants, a loading state with the spinner, and a disabled state that dims rather than hides
- [x] #2 Card renders the white surface with radius-lg and shadow-1 used by the shift, history and document rows
- [x] #3 StatusBadge takes a semantic tone and a label, renders as a pill, and always pairs colour with text so status is never encoded by colour alone
- [x] #4 SegmentedControl renders the two-option control used by Jornada and Permisos, with the selected segment styled per the design
- [x] #5 BottomSheet presents over a scrim with the slide-up animation, a scrollable body and a pinned footer action, and dismisses on backdrop press
- [x] #6 TileRow renders the label-over-value tiles used for Trabajado / Extra / Faltante
- [x] #7 Every interactive primitive meets the 44px minimum hit target and exposes an accessibility label
- [x] #8 Primitives render correctly at the largest OS font-scale setting without clipping
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Derive the primitives from the design file itself (`Kolvi App.dc.html`, read through DesignSync) rather than from the mockup screenshots: every button/badge/sheet is inline-styled there, so the shapes are exact.
2. `src/ui/button.tsx` — variants primary (ink fill), accent (coral fill, the punch/new-request emphasis), secondary (white + border, slate text), danger (transparent + danger-fg border/text); sizes sm 44 / md 52 / lg 64; loading renders ActivityIndicator + label and blocks press; disabled dims to 0.6 and stays visible.
3. `src/ui/card.tsx` — white surface, radius.lg, shadows.level1, spacing[4] padding.
4. `src/ui/status-badge.tsx` — pill, eyebrow type, tones[tone] background/foreground pair, label always rendered as text.
5. `src/ui/segmented-control.tsx` — border-tinted track with spacing[1] inset; selected segment white on primary text, unselected muted; segments minHeight 44 (design draws 36 — the hit-target criterion wins).
6. `src/ui/bottom-sheet.tsx` — RN Modal, ink@50% scrim, slide-up (translateY 24 -> 0 + fade, 280ms) via RN Animated, ScrollView body, footer pinned outside the scroll with safe-area inset, backdrop press and Android back both dismiss.
7. `src/ui/tile-row.tsx` — eyebrow label over h3 value, wraps at large font scale.
8. Jest tests beside each primitive for variants, disabled/loading, tone pairing, selection, dismissal, hit targets and accessibility roles/labels/state.
9. `src/ui/gallery.tsx` + `src/app/gallery.tsx` — temporary scaffolding so the primitives are on a real device (deleted by KMO-30, same footing as placeholder-screen).
10. `bin/device font <scale>` + `flows/kmo-3-ui-primitives.yaml` — drives the gallery at the default and the largest OS font scale, which is the only honest way to sign off #8.
11. `npm run check` green, then the flow on the emulator at both scales.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## What was built

`src/ui/`, one file plus its test each: `button`, `card`, `status-badge`, `segmented-control`, `bottom-sheet`, `tile-row`. Shapes were read out of the design file itself — every control in `Kolvi App.dc.html` is inline-styled, so the paddings, radii, shadows and the slide-up curve are the design's own values, not estimates from a screenshot. Pulled with the DesignSync tool; the `?file=` URL 403s to a plain fetch.

## Decisions worth knowing

- **Four button variants, not three.** The design draws two filled treatments: `--color-ink` for the confirming action at the end of a flow (`Listo`, `Continuar`, `Firmar`, eight occurrences) and `--color-accent-coral` for the one action a screen exists for (`Marcar entrada`, `+ Nueva solicitud`, three). Collapsing them into one `primary` would lose the distinction on the punch screen, so they are `primary` and `accent` alongside the AC's `secondary` and `danger`. The success-fill `Aprobar` and danger-fill `Rechazar` on the correction card appear once each and are left to KMO-35.
- **`loading` is busy, not disabled.** Pressable's `disabled` prop overwrites `accessibilityState.disabled`, so a punch in flight would announce as 'dimmed' — something the employee just pressed. `loading` blocks the press in the handler instead and sets `busy`; the device hierarchy dump reads `Guardando marca, busy`.
- **Segments are 44dp, the design draws 36dp.** #7 is the criterion and `--hit-target-min` is the token, so the control ends up 52dp tall rather than the design's 44dp. Deliberate, 8dp of chrome.
- **The sheet's backdrop is a sibling of the sheet, not its parent.** As a parent it takes the responder for every press inside the sheet that misses a control, and closes on an attempted scroll.
- **`accessibilityViewIsModal` sits on the whole overlay.** On the sheet alone it drops the backdrop out of the accessibility tree, leaving a screen-reader user no labelled way to close — which is why `dismissAccessibilityLabel` is a required prop rather than an optional one.
- **Off-grid design values snap to the token scales**, since KMO-2 made those closed sets: card padding 14/16/18 → `spacing[4]`, badge padding 4×10 → `spacing[1]`/`spacing[3]`, segment corner 9 → `radius.md - spacing[1]`. The sheet's 24dp corner is `radius.lg + spacing[2]` — exact, and without adding a fifth radius token that would reopen KMO-2.
- **Button type comes from a preset whole**: `sm` at `typography.label` (13, matches the design), `md`/`lg` at `typography.h3` (display 16 against the design's 15 and 18). KMO-2 ships nine presets and no others.
- **`ActivityIndicator` for the spinner**, not the design's fixed-sweep arc. It is the RN idiom, takes the variant's foreground colour, and is held out of the accessibility tree.

## Scaffolding added

`src/ui/gallery.tsx` at `kolvi://gallery` (route `src/app/gallery.tsx`) — every primitive on one screen. #7 and #8 cannot be signed off from Jest, which measures no layout, so the flow needed something real to drive. Same footing as `placeholder-screen`; KMO-30 deletes both. Noted in the README.

`bin/device font <scale>|max|reset` — Android's font-size setting, live. There was no way to set the condition #8 describes; `bin/device state` now reports it and the README table lists it.

## Validation

- `npm run check` — 93 Jest tests across 9 suites, typecheck, ESLint, Prettier. Green.
- `flows/kmo-3-ui-primitives.yaml` on the emulator, **the same assertions at both font scales**: `bin/device font reset` → passed 22s; `bin/device font max` (1.3, Android's largest) → passed 23s. A clipped primitive drops its text out of the hierarchy and the assertion fails; screenshots in `.artifacts/kmo-3-primitives{,-fontscale-1.3}.png` and `kmo-3-bottom-sheet{,-fontscale-1.3}.png`.
- Hit targets measured from the uiautomator hierarchy at density 420 (2.625 px/dp): `Marcar entrada` 64dp, the five `md` buttons 52dp, `Sincronizar` 44dp (115px — 44 × 2.625 = 115.5 floored), both segments 44dp. Every clickable node carries a `content-desc`.
- The flow's first attempt at 1.3 failed on `openLink: kolvi://gallery` landing before the bundle had mounted, which the dev client answers by showing its own launcher. Fixed in the flow by waiting for the app's first screen before deep-linking, and the reason is written into it.

## Post-completion change — SegmentedControl contrast

The unselected segment label moved from `colors.textMuted` to `colors.textBody`. The design specifies `--text-muted` on the `--color-border` track, which measures **3.1:1** — below the 4.5:1 WCAG AA asks of 13px text, and unreadable enough on a real screen that the inactive tab reads as absent (caught by eye on the emulator, not by any test). `textBody` is **6.0:1**. The selected state is untouched; the selection is carried by the raised white surface, not by the label colour.

Guarded by a new test that computes the WCAG ratio from the two tokens and asserts it clears 4.5, so the muted value cannot drift back in for fidelity's sake. `npm run check` green at 94 tests, and the change was confirmed on the emulator.

### Audit — `--text-muted` fails AA on every background the design uses

Prompted by the above, measured `--text-muted` (#5F8993) against every background in the design file:

| background | vs `--text-muted` | vs `--text-body` |
|---|---|---|
| white card #FFFFFF | 3.83:1 FAIL | 7.45:1 |
| page surface #F5F7FA | 3.57:1 FAIL | 6.94:1 |
| segmented track #D6EBEE | 3.09:1 FAIL | 6.02:1 |
| success tint #DFF3EC | 3.31:1 FAIL | 6.45:1 |
| warning tint #FDECC8 | 3.28:1 FAIL | 6.39:1 |
| danger tint #FFE1E1 | 3.12:1 FAIL | 6.07:1 |

It never reaches 4.5:1, **including on plain white**, and `Kolvi App.dc.html` uses it **63 times** against 17 uses of `--color-slate`. So this is a design-system-level problem, not a SegmentedControl one: the token is doing the job of a secondary text colour at a value that only clears AA's 3:1 large-text bar.

Only the SegmentedControl instance is fixed here — it is the one inside KMO-3's scope and the one observed failing. The remaining uses (eyebrows, captions, subtitles, the TileRow label, this task's own `TileRow`/gallery section headers) are untouched and still carry the design's value. Settling this properly is KMO-28's territory: either `--text-muted` is redefined darker in `src/theme/colors.ts`, which fixes all 63 at once and changes the brand's feel, or it is restricted to the 11-12px eyebrow sizes where 3:1 is the applicable bar and `--text-body` takes over elsewhere. Not decided here.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Six primitives in `src/ui/` — Button, Card, StatusBadge, SegmentedControl, BottomSheet, TileRow — with their paddings, radii, shadows and the 280ms slide-up curve read out of the design file's own inline styles rather than estimated from a screenshot.

Button carries four variants because the design draws two filled treatments (ink for the confirming action at the end of a flow, coral for the action a screen exists for) alongside the secondary and danger outlines; loading announces as busy rather than disabled, so a punch in flight is not reported as dimmed. Segments take the 44dp hit-target minimum over the design's 36dp. The sheet's backdrop is a sibling of the sheet so a press inside it cannot dismiss, and the modal boundary covers the backdrop so it keeps a labelled way out for a screen reader.

Verified at two tiers. Jest: 93 tests across 9 suites, with `npm run check` green. Device: `flows/kmo-3-ui-primitives.yaml` on the emulator, the same assertions passing at both the default font scale and Android's largest (1.3, set with the new `bin/device font`) — which is what carries #8, since Jest measures no layout. Hit targets measured from the uiautomator hierarchy: 64/52/44dp, every clickable node named.

Scaffolding: `src/ui/gallery.tsx` at `kolvi://gallery` gives the flow something real to drive; KMO-30 deletes it with the placeholder screen.
<!-- SECTION:FINAL_SUMMARY:END -->
