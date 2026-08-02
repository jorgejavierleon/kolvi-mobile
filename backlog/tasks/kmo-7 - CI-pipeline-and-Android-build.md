---
id: KMO-7
title: Gate pushes on the local checks
status: Done
assignee:
  - '@claude'
created_date: '2026-07-30 20:59'
updated_date: '2026-08-02 00:48'
labels:
  - mobile
  - foundation
  - release
milestone: m-0
dependencies:
  - KMO-1
documentation:
  - docs/design-decisions.md
priority: medium
type: chore
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Run the checks automatically before anything leaves the machine, so a broken typecheck, a violated lint rule or a failing test cannot reach master.

The lint config is why this is worth having early rather than late: `eslint.config.js` fails on a raw hex colour, an `rgba()`, a bare `fontSize` and a user-facing Spanish string typed into a component. Those are the rules that erode quietly between tickets, and only an automatic gate catches that.

Deliberately local, not hosted. This repo has one developer and will not see a pull request against master for a long time, so a GitHub Actions workflow would gate a path nobody takes while adding a second place the check command is written down. When a second contributor arrives, the same `npm run check` moves into a workflow and this hook stays as the fast local copy.

The Android release build, environment separation and signing that this task originally also covered were split into KMO-48 and deferred until there is an app worth installing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Typecheck, lint and tests run automatically before a push and abort the push when they fail
- [x] #2 The gate installs itself on a clean checkout without adding a dependency
- [x] #3 README documents the gate and how to bypass it deliberately
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. .githooks/pre-push — runs `npm run check`, aborts the push on failure, and points at `git push --no-verify` in its own error message. Per push rather than per commit: a full typecheck and 310 tests are too slow to pay on every commit, and a broken intermediate commit on a branch harms nobody.

2. package.json — a `prepare` script setting `core.hooksPath` to .githooks, so `npm install` installs the gate. No new dependency: husky would add one to do what one git config line does.

3. README — a 'Before a push' subsection under Checks, stating there is no hosted CI and why, plus the two commands (confirm installation, bypass deliberately).

4. mise.toml — pin node, the one tool the README asked for that nothing pinned.

Not built, on the user's decision: a GitHub Actions workflow and a master ruleset. Solo developer, no pull requests against master for the foreseeable future, so a hosted gate would guard a path nobody takes and duplicate where the check command is written down. A workflow was written and removed rather than left in place.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Verified against a throwaway bare remote so the gate was exercised by a real `git push`, not simulated:
- clean tree -> hook ran npm run check, 20 suites / 310 tests, push accepted (exit 0)
- src/ui/gate-probe.ts containing a raw hex -> ESLint's no-restricted-syntax fired, hook printed the abort message, push rejected (exit 1). This is the rule the task exists to protect.
- same failing tree with --no-verify -> push accepted, confirming the escape hatch works.
Probe commit and remote removed afterwards; tree clean.

Install path verified on a fresh clone in a scratch directory: core.hooksPath is UNSET before `npm ci` and .githooks after it, and .githooks/pre-push arrives executable (git preserves the mode bit). package.json dependencies and devDependencies are untouched — the only addition is the prepare script.

Chose core.hooksPath over husky: husky is a devDependency, a postinstall step and a .husky/ directory to do what one git config line does, and this repo has kept its tooling in bin/ shell scripts rather than npm packages.

`prepare` ends in '|| true' so `npm install` outside a git work tree (a tarball, a container build) does not fail on the git config call.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added .githooks/pre-push, which runs `npm run check` and aborts the push when the typecheck, the lint rules, Prettier or the 310 tests fail. `npm install` installs it: a `prepare` script points core.hooksPath at .githooks/, so a fresh checkout is gated after one command and nothing enters the dependency tree. README gained a 'Before a push' subsection under Checks, and mise.toml now pins node alongside java and maestro.

Deliberately local rather than hosted, on the product owner's call: one developer, no pull requests against master for the foreseeable future, so a GitHub Actions workflow would gate a path nobody takes and become a second place the check command is written down. A workflow was written during this task and removed rather than left in the tree. When a second contributor arrives the same `npm run check` lifts into a workflow and the hook stays as the fast local copy.

Verified by real pushes to a throwaway bare remote: a clean tree pushed (exit 0, 20 suites / 310 tests); a file containing a raw hex outside src/theme was rejected by ESLint's no-restricted-syntax with the push aborted (exit 1); the same tree with --no-verify pushed, confirming the escape hatch. The install path was verified on a separate fresh clone, where core.hooksPath went from unset to .githooks across `npm ci` and the hook arrived executable.

The Android release build, the development/production environment split and CI-supplied signing were split out to KMO-48, which now also blocks KMO-31. They were deferred on the reasoning that a release pipeline is not worth standing up before there is an app worth installing or a real production API origin to point it at.
<!-- SECTION:FINAL_SUMMARY:END -->
