---
id: KMO-10
title: Biometric app unlock
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - auth
  - compliance
milestone: m-0
dependencies:
  - KMO-9
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Device fingerprint or face unlock gates access to the stored token. Per docs/design-decisions.md §5 this is the second of the two identification alternatives Res. 38 Art. 7g asks for, with the password as the non-biometric one.

This is app unlock, not identity proof. It does not identify the employee to the server and must not be described in the UI as if it did.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After first login the user is offered biometric unlock, with a clear Spanish explanation of what it does
- [ ] #2 When enabled, returning to the app after backgrounding requires a successful biometric prompt before any screen with employee data is visible
- [ ] #3 A failed or cancelled biometric prompt falls back to entering the password, and never silently grants access
- [ ] #4 A device with no enrolled biometric does not offer the option and the app remains fully usable
- [ ] #5 Biometric unlock can be turned off from the profile, which does not sign the user out
- [ ] #6 No biometric data leaves the device and none is sent to the server
<!-- AC:END -->
