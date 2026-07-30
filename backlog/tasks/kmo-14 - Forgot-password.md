---
id: KMO-14
title: Forgot password
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - auth
milestone: m-0
dependencies:
  - KMO-8
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A mobile-only employee who forgets their password currently has no route back in without going to a desktop or asking HR. That makes the app unusable for exactly the person it is built for.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A forgot-password link on the login screen collects the email and requests a reset
- [ ] #2 The response is identical whether or not the email exists, so the screen does not disclose which addresses are registered
- [ ] #3 The confirmation explains in Spanish what the employee should expect and where to look
- [ ] #4 The reset link opens correctly from the phone and the employee can log in with the new password afterwards
- [ ] #5 Repeated requests are rate-limited or throttled with a clear message rather than failing silently
<!-- AC:END -->
