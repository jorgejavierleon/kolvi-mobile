---
id: KMO-30
title: Strip mockup scaffolding and demo affordances
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-15 17:57'
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
priority: high
type: chore
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The design file carries scaffolding that exists only to demonstrate states: the flask button in the home header, the demo panel that switches punch state, geolocation state and connectivity, and the line Modo demostración: código 482913 in the signing flow.

None of it may reach a build. A demo verification code printed on screen in a signature flow is the kind of thing that survives to production precisely because it looks obviously temporary.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 No demo state-switcher, flask button or demo panel exists in the codebase
- [x] #2 No hardcoded verification code, credential or placeholder secret exists anywhere in the app
- [x] #3 No mock or sample employee data ships in a release build
- [x] #4 Debug logging is stripped from release builds and no logging of location or personal data exists in any build
- [x] #5 A release build is inspected to confirm the above and the check is documented so it can be repeated
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. src/features/marcaje/punch-api.ts:288 -- gate the one production console.error (the invalid-queued-punch log) behind `if (__DEV__)`. It logs only an ApiError (kind/status/code/fieldErrors), never location or personal data, but it is debug logging and AC#4 requires that stripped from release. __DEV__ is inlined to `false` by Metro's release transform, so the whole branch is dead-code-eliminated from the production bundle.
2. Delete src/ui/gallery.tsx, src/app/gallery.tsx and flows/kmo-3-ui-primitives.yaml -- three separate committed comments already say 'KMO-30 deletes it'. The gallery is a primitives showcase reachable via an unauthenticated deep link (kolvi://gallery, outside the session guard) -- a demo affordance the earlier draft of this plan missed. Also drops the now-dead src/ui/gallery.tsx exemption from eslint.config.js's i18n-selector ignores, and trims the README's 'two temporary files' note down to one (section-scaffold.tsx, still live for Permisos/Documentos).
3. No other source changes. Grep across src/ confirms no flask button, demo-panel or punch/geolocation/connectivity state-switcher (AC#1); no hardcoded verification code, credential or placeholder secret (AC#2); no mock/sample/fixture employee data -- the 'mock' hits are all comments about the design 'mockup', not data (AC#3); no console.* call anywhere except the one now-gated punch-api.ts line, and no other logging utility in src/ (AC#4). The design's flask button, demo panel and 'Modo demostracion: codigo 482913' (docs/design-decisions.md D-F6-d) live only in the mockup HTML -- the Documentos feature they belong to is still unbuilt (src/features/documentos is a bare .gitkeep), so there is nothing to strip there yet.
4. Add bin/release-check -- exports the production Android bundle via npx expo export --platform android --no-bytecode (bytecode isn't greppable) into .artifacts/release-check (gitignored) and greps it for a fixed list of forbidden strings: '482913', 'Modo demostracion', 'demo panel', 'flask', the ungated punch-api console.error text, and the gallery route/screen strings. Exits non-zero and names the match on failure -- this is what makes AC#5 repeatable.
5. Document the check in README.md under '## Checks', next to the existing npx expo export smoke-test line.
6. Verify: npm run check, then bin/release-check against the real export, and additionally build the actual release APK (cd android && ./gradlew assembleRelease) once and inspect its bundled Hermes bytecode directly (unzip + grep, sanity-checked against known-present strings) as the one-time AC#5 evidence that the exported-bundle check and the real release artifact agree.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Widened scope beyond the initial plan after finding src/ui/gallery.tsx, src/app/gallery.tsx and flows/kmo-3-ui-primitives.yaml each carried a committed comment saying 'KMO-30 deletes it' -- an unauthenticated deep-link demo screen the earlier plan missed. Confirmed with user before deleting.

Evidence: npm run check green (typecheck, lint, format:check, 1314 tests). bin/release-check passes against a real npx expo export --platform android --no-bytecode. cd android && ./gradlew assembleRelease built successfully; unzipped app-release.apk and grepped assets/index.android.bundle (Hermes bytecode) directly for all forbidden strings -- all absent -- sanity-checked against known-present strings ('Ingresar', 'Marcar entrada') to confirm the grep methodology works on Hermes bytecode.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Gated the one production console.error in punch-api.ts behind __DEV__ (AC#4). Deleted the gallery scaffolding (src/ui/gallery.tsx, src/app/gallery.tsx, flows/kmo-3-ui-primitives.yaml) and its eslint exemption -- an unauthenticated demo screen three separate code comments already flagged as this ticket's to remove. Confirmed by grep that no flask button, demo panel, state-switcher, hardcoded verification code, mock employee data or other debug/location logging exists anywhere in src/ (AC#1-3). Added bin/release-check, documented in README, as the repeatable AC#5 check: it exports the real production bundle and greps it for a fixed forbidden-string list. Verified once against an actual signed release APK (gradlew assembleRelease), unzipped and grepped directly, confirming the exported-bundle check and the real release artifact agree.
<!-- SECTION:FINAL_SUMMARY:END -->
