---
id: KMO-1.7
title: CI pipeline and Android build
status: To Do
assignee: []
created_date: '2026-07-30 14:34'
labels:
  - mobile
  - foundation
  - release
milestone: m-0
dependencies:
  - KMO-1.1
documentation:
  - docs/design-decisions.md
parent_task_id: KMO-1
priority: medium
type: chore
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Automated checks on every change and a reproducible Android build artifact, so the pilot release is a routine action rather than a one-off from somebody laptop.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CI runs typecheck, lint and tests on every pull request and blocks merge on failure
- [ ] #2 An Android build produces an installable artifact from a clean checkout
- [ ] #3 Build configuration separates a development and a production environment, including the API base URL
- [ ] #4 Secrets and signing credentials are supplied by the CI environment and are absent from the repository
- [ ] #5 README documents how to trigger a build and where the artifact lands
<!-- AC:END -->
