---
id: KMO-47
title: Maestro E2E harness for device-level acceptance criteria
status: Done
assignee:
  - '@claude'
created_date: '2026-07-31 01:27'
updated_date: '2026-07-31 20:03'
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
- [x] #1 Maestro is installed and its version is pinned somewhere the project can reproduce
- [x] #2 A flows/ directory holds Maestro YAML, with a documented convention that a flow is named for the task it verifies
- [x] #3 One worked example flow exercises app launch and asserts on-screen text, and passes against the local emulator
- [x] #4 A single command runs every flow headlessly and exits non-zero on failure
- [x] #5 Flow runs write screenshots into .artifacts so a failure can be inspected after the fact
- [x] #6 The README documents how to run the flows and how to write a new one
- [x] #7 The three validation tiers are written down: Jest for logic, Maestro on the emulator for device and visual behaviour, and physical device for what neither can cover
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Pin Maestro with mise (maestro = cli-2.7.0 in mise.toml [tools]), so the same mechanism that pins JDK 17 and ANDROID_HOME pins the E2E runner. No global install step for a contributor beyond 'mise install'.
2. Add flows/ holding Maestro YAML. Convention: one file per task, named kmo-<n>-<slug>.yaml, with a header comment naming the task and the acceptance criteria it covers. flows/README.md documents the convention and the emulator preconditions.
3. Worked example flows/kmo-1-app-launch.yaml: clearState + launchApp, assertVisible on the placeholder copy, takeScreenshot. Verifies KMO-1's 'app launches on the emulator' criterion.
4. bin/e2e runs the suite: resolves maestro through mise, requires a booted device via bin/_common.sh, runs 'maestro test flows/' with --format JUNIT and --test-output-dir under .artifacts/e2e, propagates the exit code. Accepts a flow name or path to run one flow. Expose as npm run test:e2e.
5. Screenshots and JUnit XML land in .artifacts/e2e/ (already gitignored) so a failed run is inspectable after the fact.
6. README: a 'Flows' section under 'Driving the emulator' covering how to run and how to write one, plus a 'Validation tiers' section stating the three tiers (Jest for logic, Maestro on the emulator for device and visual behaviour, physical device for the rest) and naming KMO-17 #9 as the example of what must stay manual.
7. Verify end to end against the running emulator: a passing run, and a deliberately broken assertion to confirm non-zero exit and a failure screenshot.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Maestro pinned via mise (`maestro = "cli-2.7.0"` in mise.toml [tools]) rather than a global install script — the repo already uses mise for JDK 17 and ANDROID_HOME, so `mise install` remains the one setup command. bin/e2e resolves the binary through `mise which maestro` so the pin beats any globally-installed Maestro on PATH.

The dev-build launch problem, and why flows/shared/launch.yaml exists: clearState is what makes a run repeatable, but on a development build it also discards the expo-dev-client's saved server, so the app cold-starts into the dev-client launcher instead of itself. The bootstrap — deep-link the dev client at Metro, dismiss the one-time developer-menu onboarding, close the dev menu — is absorbed into one shared subflow that every flow calls instead of launchApp. When a preview or release APK lands (KMO-7) that file collapses to clearState + launchApp and no flow that uses it changes.

bin/e2e preflights Metro: it re-asserts `adb reverse tcp:8081` and curls /status, failing with a readable message. Without that, a missing bundler surfaces as a three-minute wait for a screen that was never going to appear. Port overridable with KOLVI_METRO_PORT; the encoded dev-server URL is passed into the flow as the DEV_SERVER Maestro env var so the port lives in one place.

flows/config.yaml sets `flows: ['*.yaml']` so flows/shared/ is not collected as test cases — verified, the suite reports 1/1, not 2/2.

Maestro's analytics prompt reads stdin on first run and would hang CI; bin/e2e exports MAESTRO_CLI_NO_ANALYTICS and MAESTRO_CLI_ANALYSIS_NOTIFICATION_DISABLED.

The example flow asserts the KMO-1 placeholder copy. KMO-4 replaces that screen, and the flow's header comment says it follows the shell there rather than being deleted.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a Maestro E2E harness so a device-level acceptance criterion can live as a re-runnable file beside the task it verifies.

Maestro cli-2.7.0 is pinned in mise.toml alongside JDK 17, so setup stays 'mise install'. flows/ holds one YAML per task named kmo-<n>-<slug>.yaml; flows/README.md documents that convention, the artifact layout, and the three rules for writing one (start from shared/launch.yaml, assert src/i18n copy character for character, set device conditions with bin/device rather than from inside the flow). flows/config.yaml keeps flows/shared/ out of collection so subflows never run as test cases. bin/e2e (npm run test:e2e) runs the suite or a single flow, preflights the Metro reverse tunnel, and writes the JUnit report, screenshots, screen hierarchies and logs to .artifacts/e2e/.

flows/shared/launch.yaml absorbs the one awkward part: clearState is what makes a run repeatable, but on a development build it also discards the dev client's saved server, so the app no longer cold-starts into itself. The subflow deep-links the dev client at Metro and dismisses the developer-menu onboarding; when a release APK lands (KMO-7) it collapses to clearState + launchApp with no change to any flow that calls it.

The README gained a Flows section and a Validation tiers section stating the three tiers and why the third is not a formality — KMO-17 #9 (sunlight, gloves) would go green on any emulator run and mean nothing.

Verified against the running headless emulator: 'npm run test:e2e' passes 1/1 and exits 0; flipping the assertion to 'App de empleadas' exits 1 and leaves screenshots/step-011-assertCondition-App_de_empleadas.png plus the matching screen-hierarchy JSON in .artifacts/e2e/. 'bin/e2e kmo-1' resolves the single flow, an unmatched selector exits 1. Suite reports 1/1, confirming shared/ is excluded. 'npm run check' (typecheck, lint, format, jest) passes.
<!-- SECTION:FINAL_SUMMARY:END -->
