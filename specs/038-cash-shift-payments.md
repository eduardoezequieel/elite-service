# 038 — Cobros del turno de caja con método visible

**Estado:** Terminada
**Módulo:** web/carwash | **Depende de:** 010, 007, 032

## Task

En Caja, con el turno abierto, listar cada cobro del turno con un sello **Efectivo / Tarjeta / Transferencia**. El detalle de un turno cerrado usa el mismo sello.

## Done

- [x] `PaymentMethodStamp`: sello con la palabra. `CASH` verde + billete, `CARD` azul + tarjeta, `TRANSFER` ámbar + flechas. Labels en `METHOD_LABELS`.
- [x] Turno abierto en `/carwash/cash`: `GET /carwash/cash/sessions/:id` (el id del current) y `DataTable` **Cobros de este turno** debajo de las stats, encima del historial.
- [x] Columnas: lavado (`#N` con `referenceOf`), método (sello), monto, hora. Vacío: «Todavía no hay cobros» / «Cuando cobres un lavado va a aparecer acá.»
- [x] Clic de fila → `/carwash/:workOrderId`.
- [x] Detalle `/carwash/cash/:id`: el mismo sello y las mismas columnas. Texto plano «Efectivo» fuera.

## Always

- DataTable de 007. Fila clickeable de 032. Stamp con la palabra escrita.
- Los dos temas y las dos densidades.
- `GET /carwash/cash/current` no cambia: los pagos salen del detalle por id.

## Ask first

- Nada: eligió A (lista de cobros, no solo destacar las stats).

## Never

- Nunca mezclar tarjeta/transferencia en el esperado.
- Nunca mostrar caja ni esta lista en la pista.
- Nunca cambiar abrir/cerrar, `verify-010.sh` ni el contrato de `GET /current`.
- Nunca un filtro extra en esta lista.

## Verify

```bash
pnpm lint && pnpm --filter @elite/web test && pnpm --filter @elite/web build
```
