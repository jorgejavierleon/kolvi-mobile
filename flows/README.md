# Flows

[Maestro](https://maestro.dev) flows — the device-level tier of the three described in the
[root README](../README.md#validation-tiers). A flow drives the real app on the emulator and
asserts on what is actually on screen, which is what most of the acceptance criteria in this
backlog are written about: exact Spanish copy, under a named device condition.

Maestro is pinned in `mise.toml`, so `mise install` is the whole setup.

## Running

```bash
bin/emu start        # the flows need a booted emulator
npm run android      # and a Metro bundler, until there is a release build
npm run test:e2e     # every flow; non-zero if any fails
bin/e2e kmo-1        # just flows/kmo-1-*.yaml
bin/e2e flows/kmo-1-app-launch.yaml
```

Each run wipes and rewrites `.artifacts/e2e/`:

| Path                       | What                                            |
| -------------------------- | ----------------------------------------------- |
| `junit.xml`                | the report CI reads                             |
| `<flow>/takeScreenshot/`   | whatever the flow captured deliberately         |
| `<flow>/screenshots/`      | the screen at the moment a command failed       |
| `<flow>/screen-hierarchy/` | the view tree at that moment, with every string |
| `<flow>/logs/`             | Maestro's log and the device logcat             |

The failure pair is the point: when an assertion on Spanish copy fails, the screenshot shows
what was rendered and the hierarchy dump shows the string it actually found.

## Writing one

One flow per task, named for it: `kmo-<n>-<slug>.yaml`. A flow is the executable form of that
task's acceptance criteria, so it belongs in the same commit as the feature, and its header
comment says which criteria it covers.

```yaml
# KMO-17 — punching moves the card from "Marcar entrada" to "En jornada".
#
# Covers #3 (the state transition) and #5 (the button is disabled while in flight).
appId: cl.kolvi.empleados
name: KMO-17 punch in
tags:
  - marcaje
---
- runFlow: shared/launch.yaml

- assertVisible: 'Marcar entrada'
- tapOn: 'Marcar entrada'
- assertVisible: 'En jornada'

- takeScreenshot: kmo-17-en-jornada
```

Three conventions:

1. **Start with `runFlow: shared/launch.yaml`**, not a bare `launchApp`. It clears state so the
   run does not inherit the last flow's tokens or queued punches, and absorbs the
   expo-dev-client bootstrap that a development build needs. See the comment in that file.
2. **Assert on the copy from `src/i18n`, character for character.** A flow that matches loosely
   passes when the wording is wrong, and the wording is the compliance requirement.
3. **Set the device condition with `bin/device`, not from inside the flow.** Maestro drives the
   app; permissions, GPS, connectivity and the clock are the emulator's business:

   ```bash
   bin/device perm revoke && bin/e2e kmo-16
   bin/device net off && bin/e2e kmo-22
   ```

`shared/` holds subflows pulled in with `runFlow`. They are excluded from collection by
`config.yaml`, so a file there never runs as a test case of its own. There are three:

- `shared/launch.yaml` — cold start, nothing more. Since KMO-8 that leaves the app on the
  login screen, which is where a flow that does not need a session should stay: it keeps the
  flow independent of whether a backend is running.
- `shared/sign-in.yaml` — the same launch, then a real login as the seeded
  `employee@example.com`, ending on the tab shell. Anything behind the session starts here,
  and needs a reachable `ams` with `EXPO_PUBLIC_API_URL` pointing at it. Since KMO-10 it also
  declines the biometric offer on the way past, because that sheet is a modal: on an AVD with
  a fingerprint enrolled nothing behind it is in the hierarchy, and every flow using this one
  would otherwise fail on an assertion unrelated to what it was testing.
- `shared/enter-credentials.yaml` — launch and submit the credentials, stopping there.
  What `sign-in.yaml` is built from, and the starting point for a flow that is _about_ what
  happens right after a login rather than about getting past it.

A flow that only means something under a device condition the suite cannot set for one flow
carries a tag `config.yaml` excludes, and is run on its own:

```bash
bin/device net off       && bin/e2e flows/kmo-8-login-offline.yaml && bin/device net on
bin/device finger enroll && bin/e2e flows/kmo-10-biometric-unlock.yaml
bin/device finger clear  && bin/e2e flows/kmo-10-biometric-unavailable.yaml
```

`requires-biometric` and `requires-no-biometric` are mutually exclusive by definition — one
needs a fingerprint enrolled on the AVD and the other needs there to be none — so a single
run can never contain both. `bin/device finger enroll` walks Settings' enrolment wizard,
which has no adb equivalent, and is idempotent; `bin/device finger clear` puts the AVD back.

## What does not belong here

Anything the emulator cannot honestly reproduce. KMO-17 #9 — legible in direct sunlight,
operable with gloves — is the clearest case: an emulator run can be made to pass it and would
mean nothing. Those criteria stay manual on a physical mid-range Android, and the task says so.
