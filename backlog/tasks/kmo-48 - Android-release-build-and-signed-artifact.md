---
id: KMO-48
title: Android release build and signed artifact
status: To Do
assignee: []
created_date: '2026-08-02 00:36'
labels:
  - mobile
  - foundation
  - release
milestone: m-0
dependencies:
  - KMO-7
documentation:
  - docs/design-decisions.md
priority: medium
type: chore
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Produce an installable, signed Android artifact from a clean checkout by a CI action rather than from somebody's laptop, so the pilot release is routine and reproducible.

Split out of KMO-7, which now covers only the pull-request checks. The release half was deferred on purpose: it is only worth building once there is an app worth installing and a real production API origin to point it at. Both arrive near KMO-31.

KMO-7's plan already researched this half — a GitHub Actions job running `expo prebuild --platform android --clean` then `gradlew assembleRelease`, with signing supplied through AGP's `-Pandroid.injected.signing.*` properties so no keystore or credential lives in the repo. Treat that as a starting point to re-verify, not as settled: `android/` is generated, so whoever picks this up should re-read app.config.ts and the toolchain pins first.

Note that `bin/_common.sh` and every flow under `flows/` hardcode the package id `cl.kolvi.empleados`, so a per-environment package suffix would break the E2E harness. KMO-47's notes also expect a release APK to let flows/shared/launch.yaml collapse to clearState + launchApp.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 An Android build produces an installable artifact from a clean checkout
- [ ] #2 Build configuration separates a development and a production environment, including the API base URL
- [ ] #3 Secrets and signing credentials are supplied by the CI environment and are absent from the repository
- [ ] #4 README documents how to trigger a build and where the artifact lands
<!-- AC:END -->
