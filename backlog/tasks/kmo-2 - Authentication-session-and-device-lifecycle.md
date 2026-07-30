---
id: KMO-2
title: 'Authentication, session and device lifecycle'
status: To Do
assignee: []
created_date: '2026-07-30 14:31'
labels:
  - mobile
  - auth
  - compliance
milestone: m-0
dependencies: []
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: high
type: feature
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Login, secure token storage, biometric unlock, password management, and the 401/deactivation paths.

Res. 38 Art. 7f (worker-changeable password with automatic email confirmation) and Art. 7g (two identification alternatives, one non-biometric) land here. Per docs/design-decisions.md §5, biometric unlock plus the password is the Art. 7g answer, and mobile login does not honour the web app's 2FA in v1.

The design has no login screen — these screens are built from the design system tokens and primitives, following the visual language of the designed surfaces.
<!-- SECTION:DESCRIPTION:END -->
