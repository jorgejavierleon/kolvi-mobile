---
id: KMO-1.1
title: Scaffold the Expo TypeScript project
status: To Do
assignee: []
created_date: '2026-07-30 14:33'
labels:
  - mobile
  - foundation
milestone: m-0
dependencies: []
documentation:
  - docs/design-decisions.md
parent_task_id: KMO-1
priority: high
type: chore
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Stand up the repository as a working Expo app so every later task has somewhere to land. Android is the primary target (Android 9+); iOS builds from the same codebase one release later.

The repo currently holds only docs and this Backlog.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A new Expo app with TypeScript in strict mode runs on an Android emulator and shows a placeholder screen
- [ ] #2 Directory structure separates app screens, shared UI primitives, domain features, API layer and i18n; the convention is written down in the README
- [ ] #3 ESLint and Prettier are configured and pass on a clean checkout
- [ ] #4 A test runner is configured and one example test passes
- [ ] #5 app.json declares the Android package id, minimum SDK for Android 9, app name and the portrait-only orientation
- [ ] #6 README documents how to install, run on device or emulator, and run the checks
<!-- AC:END -->
