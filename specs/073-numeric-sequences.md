# 073 — Correlativos que no se rompen en el 9999

**Estado:** Terminada (aprobada por chat, 27 sept 2026: «Si, aprobado»)
**Módulo:** carwash + sales + services | **Depende de:** 003 (numeración), 065 (patrón de inventario)

## Task

El siguiente correlativo se busca con `orderBy: { number: 'desc' }`, que ordena texto: `CW-9999` es
mayor que `CW-10000`, así que pasado el 9999 se vuelve a generar `CW-10000` y choca con el unique
para siempre (500 en cada alta). `numbering.ts` promete lo contrario. Inventario ya lo hace bien
(`ORDER BY length(code) DESC, code DESC` + 3 reintentos ante P2002). Se copia ese patrón a los
cuatro sitios que tienen el bug y se unifica en un solo lugar.

## Done

- [x] Un helper en `common/` (por ejemplo `common/prisma/last-sequence.ts`) que recibe `tx`, tabla,
      columna, prefijo y devuelve el último correlativo ordenando por largo y después por texto.
- [x] `prisma-ticket.repository.ts` (`CW-`), `prisma-charge.repository.ts` (`C-`),
      `counter-sale-ledger.ts` (`SALE_PREFIX`) y `prisma-service-catalog.repository.ts`
      (`SERVICE_PREFIX`) lo usan. Ninguno conserva `orderBy: { number: 'desc' }` para elegir el
      último.
- [x] Choque de unique en el correlativo (P2002 sobre `number`/`code`) por dos altas simultáneas:
      se reintenta hasta 3 veces, igual que `createItem`. Al cuarto fallo sale el error tal cual.
- [x] Test de dominio: `nextNumber('CW', 'CW-9999')` → `CW-10000` y `nextNumber('CW', 'CW-10000')`
      → `CW-10001` (ya existe `parseSequence`; falta cubrir el salto).
- [x] `scripts/verify-073.sh`: inserta a mano un `CW-9999` y un `CW-10000` en la base, crea un
      lavado por HTTP y espera `CW-10001`. Mismo caso para cobro y venta.

## Always

- La lectura y la inserción siguen en la misma transacción (RN-15 de la 003).
- Los correlativos existentes no se tocan ni se renumeran.

## Ask first

- Cambiar el ancho de 4 dígitos o el formato de los folios.

## Never

- Una secuencia de Postgres en vez del prefijo + número: rompería los folios ya emitidos.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-073.sh` ([`scripts/verify-073.sh`](../scripts/verify-073.sh): siembra `X-9999` y `X-10000` en lavado, cobro, venta, servicio y artículo y espera `X-10001`).
