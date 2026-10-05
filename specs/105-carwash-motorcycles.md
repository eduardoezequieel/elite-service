# 105 — Motos en el lavado

**Estado:** Terminada (5 oct 2026) · Aprobada (por chat, 5 oct 2026: «quiero que incluyas las motos
como tipo de vehiculo»; alcance «Solo lavado»; precio «Sin precio propio»)
**Módulo:** seed del carwash (api) · `features/carwash`, `features/catalog`, `features/floor`,
`features/combos` (web) | **Depende de:** 003, 104

## Task

Sumar «Moto» como cuarto tipo de vehículo del lavado. Los tipos son datos (`vehicle_body_types`,
sin endpoint de alta): entra por el seed, que corre en cada arranque también en producción. La
renta (flota, categorías, inspección) **no** cambia.

## Done

- [x] `apps/api/prisma/seed.ts`: `BODY_TYPES` suma `{ key: 'moto', name: 'Moto', sortOrder: 4 }`.
      Ningún servicio lleva fila de matriz para moto: cobra el precio base hasta que lo cambien en
      Catálogo. El log del seed dice «tipos de vehículo».
- [x] `vehicle-icons.tsx`: `BodyTypeShape` suma `'moto'`; `bodyTypeShapeOf` reconoce `moto`,
      `motocicleta`, `motorcycle` antes que las otras formas; silueta de moto de perfil con el mismo
      lienzo (48×24), trazo 1.6 y `currentColor`, con sus propias ruedas (las ruedas dejan de ser
      fijas para todas las formas). `BODY_TYPE_MODELS.moto` con tres modelos de ejemplo. La lógica
      pura (`BodyTypeShape`, `bodyTypeShapeOf`, `BODY_TYPE_MODELS`) vive en
      `features/carwash/body-type-shape.ts` para poder testearla sin JSX; `vehicle-icons.tsx` la
      reexporta.
- [x] Test de `bodyTypeShapeOf` (moto por key y por nombre; los tres tipos viejos no cambian).
- [x] `BodyTypePicker` (`body-type-card.tsx`): 2 columnas angosto, 4 en una fila cuando hay
      espacio. Usa container query (`@container`) para que funcione igual en la pantalla de alta,
      en la bahía y dentro del diálogo «Editar lavado». Nada de `sm:grid-cols-3` fijo.
- [x] Texto visible: «Tipo de carro» → «Tipo de vehículo» en `vehicle-fields.tsx`,
      `edit-ticket-dialog.tsx`, `performance-times.tsx` (título y `aria-label`),
      `performance-parts.tsx`, `catalog-screen.tsx`, `design-reference.tsx`. Filtros de
      `tickets-screen.tsx` y `floor-queue.tsx`: «Carrocería» → «Tipo» y «Todas las carrocerías» →
      «Todos los tipos». Mensajes del API: «Ese tipo de carro no existe.» → «Ese tipo de vehículo
      no existe.» y «Tipo de carro inválido» (combos) → «Tipo de vehículo inválido». También los
      mensajes de los schemas del lavado en `@elite/shared` («Elegí el tipo de vehículo.», «Tipo de
      vehículo inválido.»); el de la flota de renta no se toca.
- [x] Combo `FIXED` (104): el diálogo y la lista de combos se ven bien con 4 tipos; un combo viejo
      sin precio de moto la cobra a la suma por separado (ya lo hace `comboPriceFor`), con test.
- [x] `pnpm build`, `pnpm lint`, `pnpm test` limpios. `scripts/verify-105.sh` pasa.

## Always

- Densidad `bahia` y ancho de tablet contemplados en todo lo que se toque.
- Tests que afirman los textos cambiados se actualizan, no se borran.

## Ask first

- Cualquier cambio de schema o migración (no hace falta: es un dato del seed).

## Never

- Tocar la renta (`FleetVehicleCategory`, inspección, contrato).
- Reescribir el «carro» genérico del resto del lavado («El carro», «Trajo otro carro»…): solo el
  rótulo del tipo.
- Precios de moto en el seed.

## Verify

[`bash scripts/verify-105.sh`](../scripts/verify-105.sh) contra un stack levantado: `GET /vehicle-body-types` y
`GET /floor/vehicle-body-types` traen `moto` en cuarto lugar; un lavado nuevo con placa nueva y
tipo moto se crea y su línea de SRV-0001 vale el base del servicio; crear un combo `FIXED` sin
precio de moto responde 422 (RN-2 de la 104 ya pide un precio por cada tipo activo).
