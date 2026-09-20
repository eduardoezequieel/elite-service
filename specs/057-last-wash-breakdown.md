# 057 — El último lavado, desglosado en la ficha

**Estado:** Terminada
**Módulo:** carwash (shared + api + web) | **Depende de:** 041, 052, 039, 009

## Task

En la ficha «Ya lo conocemos», «Último lavado» dice hoy «20 sept · Lavado + aspirado» porque el
contrato solo trae el primer servicio. Pasa a mostrar un desglose corto de esa factura: fecha y
número de ticket, quién lo lavó, cada servicio con su precio, el total y cómo se pagó. Igual en
oficina y en pista. El aviso ámbar de la nota (052) no cambia.

## Done

- [x] `@elite/shared`: `LastWash` pasa a `{ id, number, createdAt, washers: string[], items:
  { serviceName, unitPrice }[], total, payment: { method, paidAt } | null, notes }`. Se va
      `serviceName`. Dinero como cadena decimal, igual que `Ticket`.
- [x] API: `lastWashOf` (`vehicles/domain/last-wash.ts`) arma el nuevo contrato; los `include` de
      `prisma-vehicle.repository.ts` y `prisma-ticket.repository.ts` traen todos los `items` en
      orden, el `payment` y los lavadores. `lastWashBefore` (052) no cambia de regla. Sin migración.
- [x] Tests de `last-wash.spec.ts`: ticket `PAID` con dos líneas → dos `items`, `total` y `payment`;
      ticket `READY` sin cobrar → `payment: null`; sin lavador → `washers: []`.
- [x] `known-vehicle-card.tsx`: el bloque «Último lavado» ocupa el ancho completo y muestra:
      primera línea «20 sept · #48 · Carlos» (`text-dense`, lavadores separados por «, »; sin
      lavador, «Oficina»), una fila por servicio con el precio a la derecha en `tabular-nums`, y un
      pie con «Total $22.00 · Efectivo» (`METHOD_LABELS`; sin pago, «Sin cobrar»). Sin lavado
      previo: «Primer lavado registrado», como hoy.
- [x] En oficina, con `carwash.read`, el número de ticket es un enlace a `/carwash/:id`. En pista no
      hay enlace: la pista no navega a tickets de otros (036).
- [x] `lastWashLabel` desaparece; `last-wash.ts` gana lo puro que haga falta (p. ej. `washersLabel`
      del lavado anterior) con su spec.
- [x] `DESIGN.md`: la ficha «Ya lo conocemos» documenta el desglose.
- [x] `scripts/verify-057.sh`: carro con un `PAID` de dos servicios y pago en efectivo → lookup de
      placa (oficina y pista) trae `lastWash` con `number`, dos `items`, `total` y
      `payment.method = CASH`; carro con un `READY` sin cobrar → `payment: null`.

Decisiones al implementar: el `include` y el mapeo de Prisma viven una sola vez en
`vehicles/infrastructure/last-wash-row.ts` y los dos repositorios lo comparten; el dominio recibe
cadenas decimales, no `Decimal`. En la web el enlace al ticket es un `OriginLink` (056) y la ficha
recibe `linkToTicket`, que `TicketForm` calcula con su `customerScope` y `carwash.read`.

## Always

- Contrato una sola vez en `@elite/shared`; lo consumen los dos lados.
- Autorización por permiso: el enlace al ticket depende de `carwash.read`, nunca de un rol.
- Densidad `bahia`: filas de servicio ≥ 44px de alto donde sean tocables; si no lo son, letra
  `text-body`.

## Ask first

- Mostrar comisión o descuento por línea del lavado anterior.
- Traer más de un lavado anterior (historial).

## Never

- Nunca un `VOID` como último lavado.
- Nunca precios recalculados en la web: `unitPrice` y `total` vienen del ticket cobrado.
- Nunca Playwright, Chromium ni el MCP de navegador.

## Verify

```bash
pnpm build && pnpm lint && pnpm test && bash scripts/verify-057.sh
```
