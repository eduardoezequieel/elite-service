# 020 — Estado Lavando

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003-carwash

## Task

Entre `OPEN` y `READY` existe `WASHING`: quién lo está lavando y desde cuándo.
Evidencia: hallazgo 04.

## Done

- [x] Enum Prisma y contrato: `OPEN | WASHING | READY | PAID | VOID`.
- [x] `washingStartedAt` en el ticket. Se setea al pasar a `WASHING`, se limpia
      al volver a `OPEN`.
- [x] `POST /floor/tickets/:id/start`: `OPEN` → `WASHING`, suma al empleado de
      la sesión a los lavadores.
- [x] `ready` vale desde `OPEN` y desde `WASHING` (oficina puede saltar).
- [x] `void` vale desde `OPEN`, `WASHING` y `READY`.
- [x] Stamp: `OPEN` = En cola (sin latido). `WASHING` = Lavando (late).
- [x] Pista: `OPEN` muestra `Tomar`; `WASHING` muestra lavadores, espera y
      `Marcar listo`.
- [x] Pendientes de oficina incluyen `WASHING`.

## Always

- El empleado de pista no cobra ni anula.
- Errores `{ code, message }`.

## Never

- Nunca latir el chip de En cola.
- Nunca inventar un lavador: si oficina marca listo desde `OPEN`, no se finge.

## Verify

`pnpm lint && pnpm test && pnpm build`
