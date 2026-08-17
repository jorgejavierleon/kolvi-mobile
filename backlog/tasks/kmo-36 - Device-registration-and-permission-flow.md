---
id: KMO-36
title: Device registration and permission flow
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
updated_date: '2026-08-17 19:41'
labels:
  - mobile
  - notifications
milestone: m-4
dependencies:
  - KMO-4
  - KMO-9
documentation:
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 36000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Push token acquisition, registration against the device endpoint, re-registration on token rotation, and the OS permission request with a Spanish rationale. An employee who declines push keeps a fully working app.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Push permission is requested with a Spanish rationale sheet explaining why, shown before the OS prompt, offered once after the employee's first login on this device
- [ ] #2 Declining the rationale or refusing the OS prompt is recorded so the offer never repeats automatically; the app remains fully functional with no feature gated on push permission
- [ ] #3 Granting the permission acquires a push token and registers it against the server, keyed to this install's stable device identity (KMO-9's device id)
- [ ] #4 A token rotation while permission remains granted re-registers the new token automatically, without a fresh permission prompt
- [ ] #5 A registration call that fails (offline, server error) does not block or error the UI, and is retried on the next app launch rather than lost
- [ ] #6 An employee who already granted the OS permission (prior install, or a later OS-level grant) is detected without re-prompting, and their current token is registered
- [ ] #7 Signing out revokes this device's server-side registration so the phone stops receiving push after the account leaves it
- [ ] #8 Receiving a push while foregrounded, backgrounded or killed does not crash and does not navigate the app - routing to a screen is KMO-37's job, not this ticket's
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. ams (separate worktree off master, not the dirty feature/kol-47 branch) - new push_tokens table (user_id, device_name matching the Sanctum token name from KMO-9, platform, token, timestamps), POST /api/v1/me/devices (upsert by device_name+user, covers register + rotation), DELETE /api/v1/me/devices (called at sign-out alongside the existing DELETE /api/v1/tokens/current). No send-side notification channel yet - that belongs to whichever ticket first sends a push (KMO-37/38 territory), this ticket only proves registration.
2. src/features/notifications/push.ts - the only file importing expo-notifications, shaped like src/features/marcaje/location.ts: getPermission/requestPermission/getToken/addTokenListener, injected for tests.
3. src/features/notifications/devices-api.ts - wire client for POST and DELETE /api/v1/me/devices, following corrections-api.ts's parse-and-throw convention, device_name from auth/device-name.ts's resolveDeviceName (#3).
4. src/features/notifications/push-offer.ts + push-offer.tsx - once-per-install offer sheet and decision recording, shaped like auth/biometric-offer.tsx (#1, #2).
5. src/features/notifications/use-push-registration.ts - acquires token on grant, listens for rotation, registers/re-registers, retries once on next launch on failure, never blocks the UI (#3, #4, #5, #6).
6. src/features/auth/sign-out.tsx - call the device DELETE alongside the existing token revocation (#7).
7. src/i18n/strings.ts - es.permissions.push.rationale.* copy, no design mockup for this screen so authored to match location-rationale.tsx's pattern - flagging for your sign-off before implementation.
8. flows/kmo-36-push-registration.yaml - device tier for the rationale-before-OS-prompt order and the decline-keeps-app-working path.
Tier: Jest for #3-6 (logic + isolated rendering); Maestro for #1/#2's on-device order; #3's actual delivery (a push arriving) is not device-tier testable without a real send from ams, so AC #8 is proven by construction (no navigation code exists yet, only KMO-37 adds it) rather than by receiving a live push.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Deferred: push notifications out of scope for MVP (user, 2026-08-17). AC/plan drafted above were exploratory research into transport (Expo Push vs raw FCM) - revisit them, don't assume they're settled, when this is picked back up post-MVP.
<!-- SECTION:NOTES:END -->
