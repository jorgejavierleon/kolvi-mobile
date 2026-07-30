---
id: KMO-9
title: Secure token storage
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - auth
  - compliance
milestone: m-0
dependencies:
  - KMO-8
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The Sanctum token is a long-lived credential to an employee attendance record. It goes in the platform keystore, never in AsyncStorage.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 The token is persisted in Expo SecureStore, backed by Keychain on iOS and EncryptedSharedPreferences on Android
- [ ] #2 The token is never written to AsyncStorage, to a plain file, or to logs, and this is verifiable by inspecting the codebase
- [ ] #3 A valid stored token restores the session on cold start without showing the login screen
- [ ] #4 Clearing the session removes the token from secure storage
- [ ] #5 The device where secure storage is unavailable degrades to requiring login each launch rather than falling back to insecure storage
<!-- AC:END -->
