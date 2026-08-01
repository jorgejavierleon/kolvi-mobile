---
name: implement-ticket
description: End-to-end workflow for delivering a Backlog.md task (KMO-N) in this repo — review the ticket, branch off master, research and record a plan, write the code and its tests, verify every acceptance criterion with real evidence, hand back for review, and merge only once approved. Use this whenever the user asks to implement, start, pick up, continue or finish a ticket, task, story or issue — by id ("do KMO-17", "KMO-5 please"), by name ("the login screen ticket"), or vaguely ("take the next task", "what's next in the backlog — go"), even if they never mention this skill.
---

# Implementing a ticket

The point of this workflow is that a task moves to Done only when someone could
re-run your evidence and get the same answer. Everything below serves that: the plan is
written after reading the code so it is not fiction, the tests are written with the feature
so the criteria are assertable, and the merge waits for the user because they are the one
signing off.

Work through the phases in order. Do not batch them into one silent run — phase 5 is a stop.

## 0. Read the ticket

```bash
backlog task view KMO-N --plain
```

Read acceptance criteria, dependencies, references and linked docs. If the ticket has a
`References:` design URL, that design is the source of truth for spacing, colour and copy —
read it through `DesignSync` rather than approximating from a screenshot.

Check the ticket is actually eligible before touching anything:

- Dependencies not `Done` → say so and ask whether to proceed anyway.
- Acceptance criteria that no emulator can honestly carry (sunlight, gloves, real GPS drift,
  weak mobile network, mid-range hardware) → flag them now. They need the physical-device
  tier and the ticket cannot close on your run alone.
- Criteria that read as a different feature → this is scope creep in the ticket. Ask.

## 1. Branch

Work on a branch so a second ticket can run in parallel and so master always builds:

```bash
git switch master && git pull --ff-only
git switch -c feature/kmo-N-short-slug     # type = the ticket's own type: feature|bugfix|chore|spike
```

If the working tree is dirty, stop and ask — do not stash someone else's work.

## 2. Research, then write the plan into the ticket

Set the ticket in progress first so parallel work is visible:

```bash
backlog task edit KMO-N -s "In Progress" -a @claude
```

Now read the current code — the routes, features and primitives the ticket touches, the
tests beside them, and how the two or three most recent similar tickets solved the same
problem. Do this _now_, not from memory of the backlog: a plan written when the ticket was
created describes a codebase that has since moved.

Orient with `README.md` — "Where code goes", "Conventions" and "Validation tiers" are the
three sections that decide most of the plan. The rules that get broken most often:

- `src/app/` composes, `src/features/` decides, `src/ui/` renders. A feature never imports
  another feature. Everything under `src/app/` becomes a route, so tests live beside the
  implementation in `features/` or `ui/`, never in `app/`.
- No raw hex, `rgba()` or bare `fontSize` outside `src/theme` — ESLint fails the build on it.
- No user-facing string literals in components; they come from `src/i18n` or from the server.
- Wire datetimes are naive Santiago wall-clock strings. Never convert or stamp an offset.
- Tokens go in Expo SecureStore. Import through `@/`.

Then write the plan onto the ticket, numbered, naming real files:

```bash
backlog task edit KMO-N --plan "1. src/ui/foo.tsx — ...
2. ..."
```

A good plan says which tier will carry each criterion, because that decides what you build:
Jest for logic and isolated rendering, a Maestro flow for anything only a device can show,
the physical device for the rest. Pick the cheapest tier that can honestly carry a criterion
and never a cheaper one.

Two things send the plan to the user for approval before any code:

- **The ticket is `HIGH` priority** (`Priority: High` in the ticket view). These are the ones
  the rest of the backlog is built on, so a wrong shape is expensive to unwind later — cheap
  to correct while it is still a numbered list.
- **The plan contains a material decision** — a new dependency, a new native module, a change
  to the API contract or the theme, deleting or reshaping something other tickets depend on,
  or a criterion you cannot verify.

In either case present the plan in the chat, say what you recommend and why, and wait. Otherwise
go straight into implementation; the plan is on the ticket either way.

## 3. Implement

Work in slices; after each, run the narrow check (`npx jest path/to/file.test.tsx`) rather
than the full suite. Keep the ticket as the plan of record — if the approach changes, update
`--plan` before continuing, and record decisions as you make them:

```bash
backlog task edit KMO-N --append-notes "Chose X over Y because ..."
```

Write the tests with the feature, not after. A device-level criterion is not done until
`flows/kmo-N-<slug>.yaml` exists; `flows/README.md` has the conventions (start from
`shared/launch.yaml`, header comment naming which criteria it covers).

If you find work outside the acceptance criteria, stop and ask whether to widen the ticket or
open a follow-up. Do not silently expand it, and do not create follow-up tasks unasked.

## 4. Verify

Static checks first — they are fast and catch most of it:

```bash
npm run check     # typecheck, lint, format:check, jest — what CI runs
```

Then the device tier, for any criterion about navigation, on-screen Spanish copy, permissions
or offline behaviour:

```bash
bin/emu start                    # headless; boots the AVD and waits
npm run android                  # run in background — it builds, installs and holds Metro open
bin/e2e kmo-N                    # that ticket's flow
```

`npm run android` only needs a rebuild when a native dependency changed; otherwise
`bin/device launch` is enough once Metro is up. When a flow fails, read
`.artifacts/e2e/<flow>/` — the screenshot and the view-hierarchy dump at the failure point
tell you which string was actually on screen.

Then look at the result yourself rather than trusting that it compiled:

```bash
bin/shot kmo-N-after.png         # prints the path — read the PNG
bin/ui                           # every visible string
bin/ui "En jornada"              # exit 0 if that copy is on screen
bin/device state                 # permissions, network, gps, font scale
```

Screenshot and read it. Rendering that passes an assertion can still be visibly wrong —
overlapping text, a badge off the edge, the safe area ignored — and this is the cheapest
place to catch that.

Review your own diff before you call it done: `git diff master...HEAD`. Look for debug
leftovers, sample data (KMO-30 exists to keep it out of a build), copy that drifted from the
design, and criteria you satisfied in the test but not in the app.

Finish the ticket only against evidence:

```bash
backlog task edit KMO-N --check-ac 1 --check-ac 2      # only what the evidence proves
backlog task edit KMO-N --check-dod 1
backlog task edit KMO-N --append-notes "npm run check green; bin/e2e kmo-N 4/4"
backlog task edit KMO-N --final-summary "Added ..., verified with ..."
backlog task edit KMO-N -s "Done"
```

Code presence is not evidence. An unchecked criterion with a note saying why is a better
outcome than a checked one that nobody proved — say plainly in the handoff which ones you
left open and what they need.

Commit the code, the tests, the flow and the ticket file together:

```bash
git add -A && git commit -m "KMO-N Add the thing the ticket describes"
```

Imperative, sentence case, no trailing period, no attribution or co-author trailers —
`git log --oneline` shows the house style.

## 5. Hand back — this is a stop

Report briefly: what you built, what you verified and how, anything you deliberately left
open. A few lines, no walkthrough of the diff.

If the result is visible in the UI, leave the emulator booted with the app installed and give
the user the shortest path to look at it themselves:

- Live, from another machine: `ssh -L 5555:localhost:5555 <this-host>` then
  `adb connect localhost:5555 && scrcpy` on the viewing machine.
- Or point them at the screenshot you already took in `.artifacts/`.
- Then the taps: "open Jornada, pull down — the pending-sync banner should read …".

Then wait. Do not merge on your own judgement that it looks fine.

## 6. Merge, once the user approves

```bash
git switch master && git pull --ff-only
git switch feature/kmo-N-slug && git rebase master
npm run check                                   # the rebase may have brought in a conflict
git switch master && git merge --ff-only feature/kmo-N-slug
git push origin master
git branch -d feature/kmo-N-slug
```

Fast-forward keeps the linear history this repo has. If `--ff-only` refuses, the rebase did
not take — fix that rather than reaching for a merge commit.

## Stop and ask when

- A dependency ticket is not Done, or the tree is dirty at the start.
- The ticket is HIGH priority — the plan gets reviewed before code.
- The plan needs a new dependency, native module, API-contract or theme change.
- A criterion needs a physical device, or you cannot verify it any other way.
- Work appears that is outside the acceptance criteria.
- `npm run check` fails for a reason that predates your branch.

Everything else — file layout, test shape, naming, which primitive to reuse — is a routine
call. Make it, note it on the ticket, and keep moving.
