# 125 — Inicio de la renta: flota, semana, dinero y pendientes

**Estado:** Terminada — 19 oct 2026. Aprobada — 19 oct 2026, en el chat: «asi como esta me parece, implementemoslo» (tras el
prototipo `docs/prototype/rentals-home.html`)
**Módulo:** `features/rental-reports` (web) | **Depende de:** 107, 115, 116, 121

## Task

Rehacer `/rentals` (`today-screen.tsx`) como el prototipo, solo web y con endpoints que ya
existen: `GET /rentals/reports/today`, `GET /fleet/vehicles`, `GET /rentals/calendar`,
`GET /rentals/reports/profitability`. Sin cambios al API ni a `@elite/shared`.

## Done

- [x] Encabezado «Hoy, 19 de oct» con «¿Qué hay libre?» (`outline`, link a `/rentals/available`) y
      «Nueva renta» (`rentals.manage`), como hoy.
- [x] Flota (`fleet.read`): chips de estado iguales a los de `/rentals/fleet` («Todos» + estados con
      carros, en `AVAILABILITY_ORDER`, con su número) y la grilla de `FleetVehicleCard` de los carros
      activos (sin retirados), ordenada con `sortByAvailability`. Se reutilizan los componentes y
      helpers de `features/fleet`; no se copian.
- [x] «Próximos 7 días»: hoy + 6, cada día con «Lun 19», carros ocupados / carros activos y una barra.
      Ocupado = algún `AgreementSlot` del calendario cuyo `start`–`end` toca ese día civil
      (`America/El_Salvador`). Hoy lleva borde de acento. Cálculo en una función pura con test.
- [x] «Dinero»: `StatCard` «Cobrado hoy» (tono `go`, link a `/rentals/cash` con `rentals.charge`)
      y, con `rentals.reports`, «Rentado en {mes}», «Gastos de {mes}», «Ganancia de {mes}» del mes en
      curso hasta hoy (mismos cálculos que `profitability-screen.tsx`: `income`, `spentOf`, `net`).
      Sin ese permiso, solo «Cobrado hoy».
- [x] «Salen y vuelven»: salidas de hoy (`departures`, botón «Entregar») y rentas que vuelven hoy
      (`out` con `TODAY`, botón «Recibir»), ordenadas por hora. Vacío: «Nada por hoy».
- [x] «Pendientes»: rentas atrasadas (`out` con `OVERDUE`, «Llamar» si hay teléfono) y carros con
      avisos `DUE` de la flota (abre la ficha). Vacío: «Todo en orden».
- [x] Mínimo texto: sin subtítulos ni ayudas. Densidad `bahia`/tablet: semana deslizable, cifras
      2×2, bloques en una columna, controles ≥ `--touch-min`.

## Always

- Reutilizar `ScreenHeader`, `Button`, `StatCard`, `FilterChip`, `PlateChip`, `FleetVehicleCard`,
  `OriginLink` y los hooks existentes (`useRentalToday`, flota, calendario, rentabilidad).
- Lógica nueva en archivos `.ts` puros con `*.spec.ts`.

## Ask first

- Cualquier cambio al API, a `@elite/shared` o a otra pantalla (Rentabilidad sigue con Entró/Se
  fue/Quedó).

## Never

- Saldos por cobrar en Pendientes (el API de Hoy no los da). Abrir el navegador.

## Verify

`pnpm build && pnpm lint && pnpm test`
