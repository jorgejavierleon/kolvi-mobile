---
id: KMO-35
title: Pending-correction card and approve/decline
status: In Progress
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-17 13:52'
labels:
  - mobile
  - jornada
  - compliance
milestone: m-1
dependencies:
  - KMO-34
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 35000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The card on the Jornada tab, visible from either sub-tab: original versus proposed time, the reason and requester, an expiry label, and the Rechazar / Aprobar actions. Actions honour the server actionable window so an expired correction cannot be acted on. The coral count badge on the tab-bar item reflects the pending count.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The pending-correction card shows on the Jornada tab above the segmented control, visible from both Próximos and Historial, for every admin-requested correction awaiting the employee's review
- [x] #2 Each card shows the original and proposed time, the reason and requester, and an expiry countdown
- [x] #3 Aprobar calls the approve endpoint and removes the card from the list on success
- [x] #4 Rechazar calls the decline endpoint and removes the card from the list on success
- [x] #5 Once a correction's review window has closed, its own Aprobar/Rechazar are disabled rather than left actionable client-side
- [x] #6 A failed approve/decline keeps the card on screen with an inline message rather than losing the correction
- [ ] #7 The Jornada tab-bar item carries a coral badge with the pending-correction count, gated the same way the card is
- [ ] #8 An employee without ReviewOwn:MarkModification sees neither the cards nor the badge, and the app does not ask the server for them
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ams KOL-69 (separate repo/worktree) — GET /api/v1/me/mark-modifications, POST .../workdays/{workday}/modifications/{modification}/approve and /decline. Built and tested first since no backend endpoint existed; see ams backlog/tasks/kol-69.
2. src/features/jornada/corrections-api.ts — wire client for the three KOL-69 endpoints, following workdays-api.ts's parse-and-throw convention.
3. src/features/jornada/use-pending-corrections.ts — load state (loading/loaded/failed+retry, use-upcoming-shifts.ts's shape) plus per-item review(id, approve|decline) with reviewingIds/reviewErrors.
4. src/ui/icons.tsx — ArrowRightIcon (current->proposed transition, path-for-path from the design).
5. src/ui/button.tsx — successSolid variant (Aprobar; danger outline already covers Rechazar).
6. src/i18n/strings.ts — es.jornada.corrections.*, correctionExpiryLabel(), correctionSubtitle().
7. src/features/jornada/pending-correction-card.tsx — one card: current/proposed time, reason/requester, countdown, Aprobar/Rechazar, client-side isActionable() mirror that disables both actions once expiresAt has passed.
8. src/features/jornada/pending-corrections.tsx — the list wrapper: nothing while loading or empty, a retry card on failure (never silent — that is the harm this ticket exists to prevent), one PendingCorrectionCard per pending row.
9. src/features/jornada/jornada-screen.tsx — render PendingCorrections above the segmented control, gated on ReviewOwn:MarkModification, visible from either sub-tab per the design.
10. src/app/(tabs)/_layout.tsx — wire the Jornada tab's badgeCount from the same hook's loaded corrections.length, gated the same way, independent fetch from the screen's own (no shared cache in this app).
Tier: Jest for all of the above (logic + isolated rendering) — no criterion here needs the emulator or a physical device.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
KOL-69 built first in ams (separate worktree) since /api/v1 had no mark-modification endpoints yet — see that ticket for the backend evidence. Mobile side: npm run typecheck/lint/format:check green; npm test 93/93 suites, 1413/1413 tests green (full local suite, small enough to run in full — not the ams situation). AC 1-6 proven by: jornada-screen.test.tsx (card visible from both sub-tabs, gated on ReviewOwn:MarkModification), pending-correction-card.test.tsx (fields shown, expiry disables actions), use-pending-corrections.test.ts (approve/decline remove the card on success, keep it with an inline error on failure), corrections-api.test.ts (wire shape). AC 7-8's badge half (src/app/(tabs)/_layout.tsx) has no automated coverage by this app's own convention (badge rendering itself is tab-bar.test.tsx's job, and app/ composition isn't unit tested) — verifying on the emulator before checking those.
<!-- SECTION:NOTES:END -->
