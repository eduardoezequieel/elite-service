# 066 — Una sola cuenta: lavados y productos sueltos en el mismo cobro

**Estado:** Terminada (aprobada por chat, 26 sept 2026)
**Módulo:** carwash + sales + shared | **Depende de:** 059 (cuenta de cobro), 060 (precio autorizado), 065 (venta suelta)

## Task

Hoy la cuenta de la 059 junta lavados y la venta suelta de la 065 se cobra aparte, aunque por dentro
las dos ya son una `Charge` (`Charge.counterSale` es 1:1). Se unifican **en el cobro**, no en la
entidad: una cuenta lleva **0..N lavados listos + 0..1 venta suelta** (con sus productos), al menos
uno de los dos, con un solo pago (partido o no) y un solo vuelto. El lavado sigue siendo lavado
(carro, estados, comisión) y la venta sigue siendo venta (sin carro, sin comisión).

- `POST /api/carwash/charges` acepta además `products: [{ inventoryItemId, quantity, unitPrice? }]` y
  `priceAuthorization?`; `workOrderIds` puede venir vacío si hay productos. Si hay productos, crea la
  `CounterSale` colgada de esa misma `Charge`, en la misma transacción (065 RN-18/RN-19).
  `POST /api/sales` sigue y delega en lo mismo con cero lavados.
- Reparto de cada pago (059 RN-5) entre los lavados **y** la venta, proporcional al total de cada uno.
- Anular: deshacer el cobro de cualquier parte deshace la cuenta completa (059 RN-8): los lavados
  vuelven a `READY` (sus productos siguen en el lavado) y la venta queda `VOID` con sus productos de
  vuelta al inventario (065 RN-22). Una sola autorización.
- UI: el diálogo de cobro del lavado suma «Sumar productos sueltos» junto a «Sumar otro lavado»; la
  pantalla «Nueva venta» suma «Sumar un lavado listo». Mismo bloque de pago en las dos. La venta en
  la lista y en su detalle dice «Cobrada con #7, #8» y enlaza a los lavados.

## Done

- [x] Shared: `products` y `priceAuthorization` en el request de cobro; `Charge` expone su venta;
      `CounterSale` expone los lavados de su cuenta.
- [x] API: cobro con lavados + productos en una transacción; reparto RN-5 incluyendo la venta; `/sales`
      delega; anulación de la cuenta completa desde el lavado o desde la venta. Tests en memoria.
- [x] Web: productos sueltos en el diálogo de cobro; lavados listos en «Nueva venta»; «Cobrada con …».
      Lógica pura con tests. Densidades `mostrador`/`bahia`.
- [x] Una cuenta sin lavados ni productos → `422 VALIDATION_ERROR`.
- [x] `scripts/verify-066.sh`: cuenta de 2 lavados + 1 producto con pago partido → lavados `PAID`,
      venta `PAID` en la misma `Charge`, reparto al centavo, existencia baja; anular desde un lavado
      → lavados `READY`, venta `VOID`, existencia repuesta, pagos fuera del turno.

## Always

- Una transacción por cuenta: o se cobra todo o nada.
- La comisión sigue saliendo solo de servicios de lavados.

## Ask first

- Cualquier cambio de tabla más allá de lo que ya existe (`Charge.counterSale` alcanza).

## Never

- Convertir la venta en un lavado sin carro, ni el lavado en venta.
- Anular solo una parte de una cuenta.

## Verify

`pnpm build && pnpm lint && pnpm test`, y `scripts/verify-066.sh` contra el stack levantado.

Falta correr `scripts/verify-066.sh` contra el stack.
