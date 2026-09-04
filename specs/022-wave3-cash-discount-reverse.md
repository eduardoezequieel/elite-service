# 022 — Reverso de cobro, cierre con diferencia, rango de comisiones, descuento

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 009, 010, 017

## Task

Ola 3. Hallazgos 06, 42, 43, 44.

## Done

- [x] `carwash.reverse`. `POST /carwash/tickets/:id/reverse` con `{ reason }`.
      Solo `PAID` cobrado en el turno de caja **abierto**. Borra pago y
      comisiones, vuelve a `READY`.
- [x] Diálogo en la ficha `PAID`: motivo obligatorio, destructivo.
- [x] Cerrar caja: si `|contado − esperado| ≥ $10`, hay que marcar
      «Confirmo la diferencia» para habilitar el cierre.
- [x] Comisiones: además de Hoy/7 días/mes, `from` y `to` (`YYYY-MM-DD`).
- [x] Editar lavado abierto: cada servicio admite `unitPrice` ≤ catálogo.

## Always

- Autorización por clave, nunca por rol.
- El reverso no toca turnos de caja ya cerrados.

## Never

- Nunca revertir un cobro de un turno cerrado.
- Nunca un `unitPrice` por encima del catálogo.

## Verify

`pnpm lint && pnpm test && pnpm build`
