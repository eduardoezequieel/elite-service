# 087 — El precio de un servicio de lavado también puede subir

**Estado:** Terminada (aprobada por chat, 28 sept 2026: «adelante»)
**Módulo:** api (carwash) + web (carwash) | **Depende de:** 022 RN-5 (descuento), 030 RN-3 (tipo de carro), 060 (precio bajo llave)

## Task

Hoy el precio de una línea de **servicio** solo baja: el API responde `PRICE_ABOVE_CATALOG` y la web
recorta al catálogo. Pasa a poder subir también (recargo), con el mismo piso de 0 y **sin techo**.
Solo servicios: productos dentro del lavado (065) y ventas de mostrador siguen sin poder pasar el
precio del artículo. Todo lo demás de la 060 queda igual: con el lavado abierto/lavándose se teclea
libre; desde listo, cualquier precio distinto al catálogo —arriba o abajo— pide la firma de
`carwash.discount`.

**API** (`domain/pricing.ts`, `build-ticket-items.ts`, `ticket.usecases.ts#authorizePrice`):
- `rejectServicePrice(unitPrice)` → `'NEGATIVE' | null`; `rejectPrice` queda para productos.
- Alta/edición: las líneas de servicio usan `rejectServicePrice`; las de producto, `rejectPrice`.
- `authorizePrice`: si la línea es `SERVICE`, `rejectServicePrice`; si es `PRODUCT`, `rejectPrice`.
- `discountOf` suma solo lo que baja por línea (un recargo no resta descuento).
- `repriceForBodyType`: una línea con recargo queda en `max(unitPrice, catálogoNuevo)`, espejo del
  `min` que ya lleva la rebajada.

**Web** (`pricing.ts`, `service-groups.ts`, `service-picker.tsx`, `ticket-form.tsx`,
`edit-ticket-dialog.tsx`, `change-price-dialog.tsx`, `ticket-lines-fields.tsx`):
- `clampToCatalog` → `normalizeServicePrice(raw, catalog)`: vacío/ilegible vuelve al catálogo, piso 0, sin techo.
- `clampToBodyType` recibe el catálogo anterior: si el precio estaba en catálogo sigue al nuevo; si
  estaba rebajado, `min(precio, nuevo)`; si tenía recargo, `max(precio, nuevo)`.
- `surchargeCents(catalog, price)` junto a `discountCents`.
- Elegir servicio: con recargo muestra la insignia `+$X.XX` (distinta a la del descuento) y el
  catálogo tachado. Texto bajo el campo: «Catálogo: $X.» en lugar de «Tope… solo baja». `title` del
  botón y el párrafo de ayuda dejan de decir «para descontar».
- Diálogo de cambiar precio: el aviso `aboveCatalog` y el bloqueo aplican solo a productos.

**Verificadores:** `verify-003.sh` (línea 124), `verify-039.sh` (línea 102) y `verify-060.sh`
(línea 134) hoy esperan 422 al subir un servicio: pasan a esperar éxito y el `unitPrice` nuevo.
Si alguno ya tiene un caso de producto arriba del precio, se deja como 422.

## Done

- [x] `rejectServicePrice` en dominio, con test: negativo → `NEGATIVE`, arriba del catálogo → `null`.
- [x] Alta y edición aceptan un servicio arriba del catálogo; un producto arriba sigue en 422 `PRICE_ABOVE_CATALOG` (test en `build-ticket-items.spec.ts`).
- [x] `authorizePrice` acepta subir un servicio y rechaza subir un producto (test en `ticket.usecases.spec.ts`).
- [x] Subir un servicio con el lavado listo sin firma sigue rechazado (test existente de 060 sigue verde, más uno de subida).
- [x] `discountOf` y `repriceForBodyType` con tests de recargo.
- [x] Web: `normalizeServicePrice` y `clampToBodyType` con tests (`pricing.spec.ts`, `service-groups.spec.ts`).
- [x] Web: insignia de recargo y textos nuevos en el selector; diálogo sin bloqueo para servicios.
- [x] `bahia`: la insignia no rompe la fila a ancho de tablet (flex-wrap que ya tiene la fila).
- [x] `verify-003/039/060.sh` actualizados.

## Always

- Piso 0 en servicios; el techo de productos y ventas de mostrador no se toca.
- Después de listo, subir o bajar pide firma: la regla es «distinto al catálogo», no «menor».
- Se mantiene el código `PRICE_ABOVE_CATALOG` en `@elite/shared` (lo siguen usando productos y mostrador).

## Ask first

- Poner un techo al recargo.
- Tocar `@elite/shared`, la base o los reportes.

## Never

- Tocar `sales/` ni la lógica de precio de productos (`product-lines.ts`, `product-picker.tsx`).
- Renombrar el permiso `carwash.discount`.

## Verify

`pnpm build && pnpm lint && pnpm test`, más `scripts/verify-003.sh`, `verify-039.sh` y
`verify-060.sh` contra el stack levantado (los corre el usuario si el agente no tiene stack).

`pnpm lint` falla solo en `apps/web/scripts/run-next.mjs` (sin commitear, previo a esta spec). Los
`verify-003/039/060.sh` quedan actualizados pero sin correr: necesitan el stack levantado.
El comentario de `TicketItem.unitPrice` en `@elite/shared` («Entre 0 y `catalogPrice`») quedó
desactualizado para servicios; no se tocó por el Ask first.
