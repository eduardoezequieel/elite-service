# 113 — Placa y tipos de la flota como en el lavado

**Estado:** Terminada (aprobada por chat, 11 oct 2026)
**Módulo:** `fleet` (shared + api + web) | **Depende de:** 095, 103, 105

## Task

El alta y la tarjeta de identificación de un carro de la flota piden la placa y el tipo igual que
el lavado, con criterio de El Salvador:

- **Placa:** la misma máscara del lavado (`formatPlate`: prefijo de 1–2 letras, guion tras los
  primeros 3 caracteres, `P` si empieza con número, máx. 6 tras el prefijo). Placeholder
  `P123-456`, `autoCapitalize="characters"`, `maxLength={10}`. Sigue siendo opcional.
- **Tipo:** los del lavado menos la moto: `SEDAN` «Sedán», `SUV` «Camioneta», `PICKUP` «Pick up».
  Salen `HATCHBACK`, `VAN` y `OTHER`. Etiqueta del campo: «Tipo de vehículo».

## Done

- [x] Migración: `HATCHBACK` y `OTHER` → `SEDAN`, `VAN` → `SUV`; el enum `FleetVehicleCategory`
      queda con `SEDAN`, `SUV`, `PICKUP`.
- [x] `@elite/shared`: `FLEET_VEHICLE_CATEGORIES` y `FLEET_CATEGORY_LABELS` con los tres tipos.
- [x] Web: los dos campos de placa (alta y tarjeta) aplican `formatPlate` al escribir.
- [x] Web: `CategoryField` con la etiqueta «Tipo de vehículo».
- [x] Prototipos `docs/prototype/fleet-*.html` con los tres tipos.
- [x] Tests: shared acepta los tres tipos y rechaza `HATCHBACK`, `VAN`, `OTHER` y `MOTO`. La máscara ya la cubre `format-plate.spec.ts`.

## Always

- El API no impone la máscara (igual que el lavado): la placa se sigue normalizando con `plateSchema`.
- Densidades `mostrador`/`bahia` y ancho de tablet como hoy.

## Ask first

- Reescribir las placas ya guardadas en la flota al formato con guion.

## Never

- `prisma migrate dev`/`db push` contra el VPS.
- Abrir el navegador o levantar servidores.

## Verify

```sh
pnpm build && pnpm lint && pnpm test
```
