# 128 — Otras rentas del cliente en la ficha de la renta

**Estado:** Terminada — 20 oct 2026. Aprobada — 20 oct 2026, en el chat sobre el prototype
`docs/prototype/rental-customer-history.html`: «Me parece bien, implementemoslo asi».

## Task

Sacar el `<details>` «Historial» del encabezado de `agreement-detail-screen.tsx`. Junto al nombre
del cliente va un dato corto: «N rentas» (las otras rentas de ese cliente), «Debe $X» si debe en
otra renta devuelta, o «Cliente nuevo» si no tiene otras. Al final de la ficha, la sección «Otras
rentas»: las 3 más recientes sin la actual, con `<DataTable>` y las columnas de la ficha del
cliente, más «Ver todas» hacia la ficha del cliente cuando hay más de 3. Una sola consulta:
`GET /rentals/agreements?customerId&pageSize=100`.

## Done

- [x] El encabezado no tiene `<details>`; el dato del cliente baja a la sección con `#other-rentals`.
- [x] «N rentas» sale de `total − 1`; «Debe» suma el saldo de las otras rentas `FINISHED` cargadas.
- [x] Sin otras rentas no se dibuja la sección. «Ver todas» solo con más de 3 y `renters.read`.
- [x] `RenterHistory` pierde la prop `folded`, que ya nadie usa.
- [x] Lógica pura en `features/rentals/other-rentals.ts`, con test.

## Always

- Una consulta compartida por el dato y la sección (misma clave de react-query).
- Densidad `bahia`: el dato del cliente con `--touch-min`; la tabla se apila sola.

## Ask first

- Cambiar el API o agregar campos al contrato.

## Never

- Paginador dentro de la ficha de la renta. Texto de ayuda en la sección.

## Verify

`pnpm build && pnpm lint && pnpm test`
