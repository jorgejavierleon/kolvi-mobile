---
id: KMO-47
title: Maestro E2E harness for device-level acceptance criteria
status: To Do
assignee: []
created_date: '2026-07-31 01:27'
labels:
  - mobile
  - tooling
  - testing
dependencies: []
priority: high
type: chore
ordinal: 47000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The emulator workflow set up in KMO-1 makes device state scriptable (bin/emu, bin/shot, bin/ui, bin/device). What is still missing is a way to express a whole flow as a repeatable artefact that lives beside the task it verifies.

Maestro is the fit: flows are YAML, it drives the app by visible text, it runs headless against the same emulator, and it emits JUnit XML for CI. Its assertions read in the same vocabulary the acceptance criteria are written in, which matters because most of ours are exact Spanish copy.

This task covers the harness only, not flows for features that do not exist yet. Each feature task writes its own flow as part of its own work.

Scope note: some acceptance criteria are not emulator-testable and must not be signed off from a Maestro run. KMO-17 #9 (legible in direct sunlight, operable with gloves, on a physical mid-range Android) is the clearest example. Those stay manual and should be called out as such.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Maestro is installed and its version is pinned somewhere the project can reproduce
- [ ] #2 A flows/ directory holds Maestro YAML, with a documented convention that a flow is named for the task it verifies
- [ ] #3 One worked example flow exercises app launch and asserts on-screen text, and passes against the local emulator
- [ ] #4 A single command runs every flow headlessly and exits non-zero on failure
- [ ] #5 Flow runs write screenshots into .artifacts so a failure can be inspected after the fact
- [ ] #6 The README documents how to run the flows and how to write a new one
- [ ] #7 The three validation tiers are written down: Jest for logic, Maestro on the emulator for device and visual behaviour, and physical device for what neither can cover
<!-- AC:END -->
