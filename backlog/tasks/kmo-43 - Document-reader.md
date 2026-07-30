---
id: KMO-43
title: Document reader
status: To Do
assignee: []
created_date: '2026-07-30 20:59'
labels:
  - mobile
  - documentos
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
ordinal: 43000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The document body with a sticky Firmar documento bar. The body is template-driven with resolved variables; how it arrives on the wire and how it renders safely is a security-relevant decision inside a signing flow and must be settled before implementation. A signatory whose turn has not come sees the document without the sign bar.

PLACEHOLDER — captures scope only. Decompose into implementation-sized tasks with full acceptance criteria at Phase refinement, against the design file and the API contract as it then stands.
<!-- SECTION:DESCRIPTION:END -->
