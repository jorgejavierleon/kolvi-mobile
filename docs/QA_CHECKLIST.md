### KMO-35 — Pending-correction card and approve/decline

- [ ] Open Jornada — the coral badge on the tab and the seeded pending-correction cards show, from both Próximos and Historial.
- [ ] Run `bin/e2e kmo-35` against a backend carrying ams KOL-69.
- [ ] Tap Aprobar on a card — it disappears and the badge count drops by one.
- [ ] Tap Rechazar on another card — same result.

### KMO-27 — Ayuda y soporte help content

- [ ] Read the six help sections end to end — accurate, no typos, no awkward Chilean Spanish.
- [ ] Tap "Escribir a soporte" on a phone with a real mail app and confirm it opens a compose addressed to soporte@kolvi.cl.

### KMO-32 — Próximos upcoming shifts

- [ ] Open the Jornada tab — Próximos is selected by default, today's shift shows as a highlighted card with the right window, premise and punch status.
- [ ] Scroll the upcoming list — dates, time windows and premises read correctly for a few real days out.
- [ ] Tap Historial then back to Próximos — the segment switches cleanly and Próximos keeps its scroll/state.
- [ ] If any of the next 14 days land on a holiday or an approved leave, confirm it shows the holiday/leave name instead of a time window.
