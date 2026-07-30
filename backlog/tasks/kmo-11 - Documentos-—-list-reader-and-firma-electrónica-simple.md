---
id: KMO-11
title: 'Documentos — list, reader and firma electrónica simple'
status: To Do
assignee: []
created_date: '2026-07-30 14:32'
labels:
  - mobile
  - documentos
  - compliance
milestone: m-3
dependencies:
  - KMO-1
  - KMO-2
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/prd-mobile-app.md
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The employee reads and signs their documents from the phone. Signing sends a 6-digit code to their email with a 15-minute expiry; entering it completes a firma electrónica simple whose evidence trail (signed IP, user agent, content hash) must not be weakened by the mobile channel.

Per docs/design-decisions.md §8 a Rechazar action with a reason is included — a signature flow with no refusal path is legally lopsided — the code channel is email only in v1, and every trace of the mockup's demo mode must be absent from the build.

Refine into implementation-sized subtasks before starting.
<!-- SECTION:DESCRIPTION:END -->
