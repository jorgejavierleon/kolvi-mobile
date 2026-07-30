---
id: m-0
title: "Phase 1 — Marcaje MVP"
---

## Description

El ciclo completo de marcaje y nada más: autenticación con token seguro y desbloqueo biométrico, pantalla de inicio con el turno de hoy, geolocalización con sus tres estados, marcaje con evaluación de geocerca en servidor, comprobante conforme a Res. 38 Art. 13, cola offline, e historial de las últimas 10 marcas. Perfil con cierre de sesión y cambio de contraseña. Se despliega a una sucursal piloto.

### App foundation — Expo project, design system, navigation shell

Everything the four feature tabs stand on: the Expo/TypeScript project itself, the Kolvi design tokens as a typed theme, the shared UI primitives the design repeats, the tab navigation shell, the API client, and the Spanish string catalogue.

No employee-visible feature ships from this epic. It exists so that the Marcaje, Jornada, Permisos and Documentos work is assembling components rather than inventing them, and so that visual decisions are made once.

### Authentication, session and device lifecycle

Login, secure token storage, biometric unlock, password management, and the 401/deactivation paths.

Res. 38 Art. 7f (worker-changeable password with automatic email confirmation) and Art. 7g (two identification alternatives, one non-biometric) land here. Per docs/design-decisions.md §5, biometric unlock plus the password is the Art. 7g answer, and mobile login does not honour the web app's 2FA in v1.

The design has no login screen — these screens are built from the design system tokens and primitives, following the visual language of the designed surfaces.

### Marcaje — home screen, geolocation and punch

The reason the app exists. The employee opens the app and registers an entrada or salida in under 10 seconds, with geolocation evidence and a receipt that satisfies Res. 38 Art. 13.

Covers the home tab (greeting, geolocation card, today's shift with the informational colación row, live clock, punch button, week summary), the three geolocation states, the punch state machine before → working → done, and the comprobante bottom sheet.

Per docs/design-decisions.md §2: no colación punches, one entrada and one salida per day, out-of-range punches are recorded and flagged rather than blocked, and the server assigns the timestamp.

### Offline punch queue

An attendance app that cannot record a punch without signal will be worked around, and the workaround is a paper book. Warehouses, basements and cold rooms are exactly where Kolvi's employees work.

A punch attempted offline is written to a durable local queue and acknowledged with a visually distinct receipt that is honest about not yet being in the attendance book. The queue flushes in order on reconnect, with idempotency keys so a retry cannot double-punch.

This is the highest-risk item in the PRD (§7.3). The compliance position and the wire contract are settled by a blocking spike before any implementation task starts.

### Mi perfil — profile, my data and help

The profile surface reachable from the avatar button on every tab: identity header, then Mis datos, Notificaciones, Ayuda y soporte, Cerrar sesión.

Res. 38 Art. 5 requires the platform and its manuals in Chilean Spanish; the in-app help is where that obligation lands for mobile.

Notification preferences are a stub in Phase 1 and are wired up in the Phase 2 push epic.

### Phase 1 release readiness — accessibility, telemetry, pilot build

What stands between a feature-complete Phase 1 and a build a pilot premise can actually use: the accessibility pass, crash reporting and the punch funnel, removal of all mockup scaffolding, and the store submission itself.

Field conditions are the acceptance bar — direct sunlight, gloves, one-handed use, a mid-range Android on patchy mobile data.
