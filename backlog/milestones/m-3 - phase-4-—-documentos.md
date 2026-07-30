---
id: m-3
title: "Phase 4 — Documentos"
---

## Description

Listado de documentos con contador de pendientes, lector, firma electrónica simple con código por correo, rechazo con motivo, y acceso al PDF firmado.

### Documentos — list, reader and firma electrónica simple

The employee reads and signs their documents from the phone. Signing sends a 6-digit code to their email with a 15-minute expiry; entering it completes a firma electrónica simple whose evidence trail (signed IP, user agent, content hash) must not be weakened by the mobile channel.

Per docs/design-decisions.md §8 a Rechazar action with a reason is included — a signature flow with no refusal path is legally lopsided — the code channel is email only in v1, and every trace of the mockup's demo mode must be absent from the build.

Refine into implementation-sized tasks before starting.
