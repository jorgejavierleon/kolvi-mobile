---
id: KMO-44
title: Sign with email verification code
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - documentos
  - compliance
milestone: m-3
dependencies:
  - KMO-4
  - KMO-9
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
priority: medium
type: feature
ordinal: 44000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The firma electrónica simple flow: request a 6-digit code, enter it, confirm. The code expires in 15 minutes and a live code is reused rather than reminted unless explicitly resent, so the app shows the expiry and offers resend. Signing records the IP, user agent and content hash as evidence — the app must send nothing that weakens that trail. Success shows the folio. Per docs/design-decisions.md §8 the channel is email only in v1.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->
