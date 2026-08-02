---
id: KMO-31
title: Pilot release to the Play Store
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
updated_date: '2026-08-02 00:37'
labels:
  - mobile
  - release
milestone: m-0
dependencies:
  - KMO-7
  - KMO-28
  - KMO-29
  - KMO-30
  - KMO-48
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: chore
ordinal: 31000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Phase 1 ships to one pilot premise. This is the task that turns a working build into something an employee can install.

Store listing copy is Chilean Spanish, and the location permission disclosure has to explain honestly what attendance geolocation is used for, or review will reject it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A signed release build is uploaded to a Play Store internal or closed testing track
- [ ] #2 The store listing, description and screenshots are in Chilean Spanish
- [ ] #3 The privacy policy and data-safety declaration accurately describe the collection of location and attendance data
- [ ] #4 The location permission disclosure explains the attendance purpose in terms a reviewer and an employee both accept
- [ ] #5 Pilot employees can install the app and complete a real punch end to end
- [ ] #6 A rollback path is documented in case the pilot build has to be pulled
<!-- AC:END -->
