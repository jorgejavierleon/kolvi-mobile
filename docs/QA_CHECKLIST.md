# Manual QA checklist

Device-level checks that need a human's eyes rather than the emulator this repo is
usually driven from headless over SSH. Newest entries first. Each entry names its
branch, what's already proven by `npm run check` / Maestro (don't re-check that), and
the precise, checkbox-able things left for a person to look at.

When an entry passes, move it to _Verified_ with the date. If something fails, leave
it in _Pending_ and note what broke.

---

## Pending

### KMO-51 — Mis datos read-only profile detail

- **Branch:** `feature/kmo-51-mis-datos-read-only` (commit `44910ff`), not yet merged.
- **Automated coverage:** `npm run check` green (69 suites, 1223 tests).
  `flows/kmo-51-mis-datos-read-only.yaml` 1/1 pass.
- **Prerequisite:** `ams` KOL-62 (adds `personal_email`/`phone`/`supervisor`/
  `contract_start_date` to `GET /api/v1/user`) is implemented but not merged — branch
  `feature/kol-mis-datos-user-fields` in a separate worktree, status "In Review".
  Without it the screen still works but shows fewer fields (#5 below).

**Setup:** `bin/emu start && npm run android` → sign in as `employee@example.com` /
`admin` → tap the avatar (top right) → **Mis datos**.

- [ ] 1. Layout matches the rest of the app: one card, hairline dividers between rows,
      label above value, no visual glitches at the top/bottom edges.
- [ ] 2. Every field the backend actually returns is on screen: Nombre, RUT (dotted,
      e.g. `21.437.581-8`), Correo corporativo, and whichever of Correo personal /
      Teléfono / Cargo / Sucursal / Jefatura / Fecha de inicio de contrato the seeded
      employee currently has set.
- [ ] 3. No blank or placeholder row for a field that isn't set — the row is absent
      entirely, not empty.
- [ ] 4. Nothing on the screen is tappable or editable — no input box, no button, no
      "edit" affordance, no link.
- [ ] 5. **If KOL-62 is not yet merged:** the amber prompt ("No tienes un correo
      personal registrado...") is shown instead of a Correo personal row, and
      Teléfono/Cargo\*/Sucursal/Jefatura/Fecha de inicio de contrato are all absent.
      \*Cargo may still show — it's set on the live seed data independently of KOL-62.
- [ ] 6. **If KOL-62 is merged:** Correo personal, Teléfono, Jefatura and Fecha de
      inicio de contrato (`d de mmmm aaaa` format, e.g. `1 de marzo 2024`) all appear.
- [ ] 7. Back chevron returns to Mi perfil correctly.
- [ ] 8. Spanish copy reads naturally, no truncation or overflow on field values
      (RUT, email, job title).

---

## Verified

_Nothing yet._
