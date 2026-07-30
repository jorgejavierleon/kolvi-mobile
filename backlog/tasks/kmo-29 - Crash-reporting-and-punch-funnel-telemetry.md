---
id: KMO-29
title: Crash reporting and punch funnel telemetry
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - release
milestone: m-0
dependencies:
  - KMO-17
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: chore
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Without this the pilot produces opinions instead of data, and the offline decision in KMO-21 has nothing to revisit itself against.

The funnel is deliberately minimal: app open, punch attempted, punch confirmed, with failure reasons. That is enough to measure goal G1 and to see whether connectivity is actually the problem the PRD assumes it is.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Crash reporting captures native and JavaScript crashes with symbolicated stack traces
- [ ] #2 The funnel records app open, punch attempted and punch confirmed, with a reason on every failure
- [ ] #3 Time from app open to punch confirmed is measurable so goal G1 p90 under 10 seconds can be evaluated
- [ ] #4 Offline punches and sync outcomes are counted, so pilot connectivity can be assessed against the KMO-21 decision
- [ ] #5 No location coordinates, RUT, name, email or any personal data is sent to telemetry, verified by inspecting the payloads
- [ ] #6 Telemetry is disabled in development builds
<!-- AC:END -->
