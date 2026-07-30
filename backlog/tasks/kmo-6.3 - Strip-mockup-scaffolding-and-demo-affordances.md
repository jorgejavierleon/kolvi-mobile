---
id: KMO-6.3
title: Strip mockup scaffolding and demo affordances
status: To Do
assignee: []
created_date: '2026-07-30 14:38'
labels:
  - mobile
  - release
  - compliance
milestone: m-0
dependencies: []
references:
  - >-
    https://claude.ai/design/p/b62ea466-327b-4798-a07a-6afbc268c6bf?file=Kolvi+App.dc.html
documentation:
  - docs/design-decisions.md
parent_task_id: KMO-6
priority: high
type: chore
ordinal: 41000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design file carries scaffolding that exists only to demonstrate states: the flask button in the home header, the demo panel that switches punch state, geolocation state and connectivity, and the line Modo demostración: código 482913 in the signing flow.

None of it may reach a build. A demo verification code printed on screen in a signature flow is the kind of thing that survives to production precisely because it looks obviously temporary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No demo state-switcher, flask button or demo panel exists in the codebase
- [ ] #2 No hardcoded verification code, credential or placeholder secret exists anywhere in the app
- [ ] #3 No mock or sample employee data ships in a release build
- [ ] #4 Debug logging is stripped from release builds and no logging of location or personal data exists in any build
- [ ] #5 A release build is inspected to confirm the above and the check is documented so it can be repeated
<!-- AC:END -->
