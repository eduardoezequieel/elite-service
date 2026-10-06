# 110 — Carros: un solo estado, avisos, y servicio, gastos y «¿Cuánto dejó?» dentro del carro

**Estado:** Terminada
**Módulo:** fleet, fleet-maintenance, rental-reports (api) · `features/fleet`,
`features/fleet-maintenance`, `features/rental-reports` (web) · `features/rental-settings` (solo
mover dos campos) · `@elite/shared` rentals/fleet.ts, rentals/maintenance.ts, rentals/reports.ts
(rentabilidad) | **Depende de:** 107, 099, 100, 103. Corre en paralelo con 108 y 109.

## Contexto

Informes 09, 10, 11, 12 y 13 de la auditoría (5 oct 2026): la flota habla en lenguaje de
inventario («Disponible» cuando Inicio dice «Rentado»); Mantenimiento, Gastos y la cuenta del
carro están repetidos en el riel y en la ficha con otros totales y otras palabras; anotar un
aceite pide entender un plan y siete campos; anotar $40 de llantas atraviesa nueve categorías;
«rentabilidad» y «ocupación» no se entienden. El prototipo aprobado
`docs/prototype/rentals-simplified.html` (pestaña Carros y ficha) es el diseño.

## Criterios de aceptación

### Lista (`/rentals/fleet`)

- **Dado** `GET /rentals/fleet`, **entonces** cada ítem trae `availability: VehicleAvailability`
  (la función de la 107 RN-2, no otra) y `alerts: { kind: 'DOCUMENT' | 'SERVICE', text, level:
'WARN' | 'DUE' }[]` («Seguro vence en 12 días», «Le toca a los 50.000 km: Cambio de aceite y
  filtro», «Se pasó: iba a los 50.000 y va en 51.200: Cambio de aceite y filtro»). `RETIRED` queda
  fuera salvo `?status=RETIRED`.
- **Dado** la lista, **entonces** cada fila muestra `PlateChip`, nombre, tarifa por día, **un**
  sello con la palabra del estado (Libre, En renta, Atrasado, Reservado, Taller) y, si hay avisos,
  un sello «N avisos» (ámbar si `WARN`, rojo si hay algún `DUE`); el texto de cada aviso solo en la
  ficha. Cabecera: «Nuevo carro» (alta corta de la 103, sin cambios), el chip «Retirados»
  (`?status=RETIRED`, para quien lee la flota) y, con `rentals.reports`, «¿Cuánto dejó?».
- `fleet-status-stamp.tsx` deja de pintar `ACTIVE` como «Disponible»: ese sello solo se usa en la
  ficha para `IN_SHOP`/`RETIRED`; el estado del día lo da `availability`.

### Ficha (`/rentals/fleet/[id]`)

- **Dado** la ficha, **entonces** las pestañas son **Ficha · Servicio · Gastos · ¿Cuánto dejó?**
  (la última solo con `rentals.reports`). La cabecera lleva el sello de `availability` y los
  avisos como líneas cortas. Las tarjetas de la 103 no cambian.
- **Servicio**: una lista «Qué hay que hacer» (tareas del plan vencidas o próximas para este carro,
  cada una «Le toca a los 50.000 km» o «Le toca el 12 oct»; vacío: «Nada pendiente») y un botón
  «Anotar lo que se hizo» con **cuatro** campos: qué (las tareas del plan + «Otro»), km (prellenado
  con el actual), fecha (hoy), costo (opcional); nota opcional plegada. Debajo, lo hecho (fecha,
  qué, km, costo); cada fila, con `fleet.manage`, tiene «⋯ → Borrar» y el gasto ligado se va con
  el servicio. «Texto para el taller» y el `.ics` quedan en «⋯» de esta pestaña.
- **Dado** un servicio anotado con costo, **entonces** el API crea **un solo** gasto
  (`FleetExpense` categoría `MAINTENANCE`, ligado al `MaintenanceLog`); borrar el servicio borra
  el gasto. Nunca dos altas del mismo movimiento.
- **Gastos**: una sola lista (fecha, qué, monto) con los automáticos (lavado del carwash, multa no
  cargada) marcados con el sello «Automático», y un botón «Anotar gasto» con **tres** campos:
  monto, qué (texto libre), fecha (hoy). La categoría no se pide: `OTHER`, salvo que el texto
  coincida con una categoría existente, que es cosa del API (`domain/`); el enum no cambia. Un
  gasto manual (`editable`) tiene «⋯ → Corregir / Borrar». Uno automático, o ligado a un servicio,
  no.
- **¿Cuánto dejó?** del carro: la pestaña Meses actual con los rótulos **Entró / Se fue / Quedó**
  por mes; el mes en curso y el total del año cortan hoy. Sin «ocupación», «neto», «desembolso»,
  «fijos» (→ «Seguro y GPS», «Cuota»).

### ¿Cuánto dejó? de toda la flota (`/rentals/fleet/earnings`)

- **Dado** `/rentals/fleet/earnings` con `rentals.reports`, **entonces** es la pantalla de
  rentabilidad de la 100 con una fila por carro: **Entró**, **Se fue**, **Quedó**, y el mismo
  selector de rango. «Este mes» corta en **hoy**, no en fin de mes (cambio en `report-view.ts` /
  shared). Las barras de ocupación salen. `/rentals/profitability` redirige acá.

### Pantallas globales que se van

- `/rentals/maintenance` y `/rentals/expenses` redirigen a `/rentals/fleet`. Se borran
  `maintenance-screen.tsx`, `fleet-expenses-screen.tsx` y `vehicle-select.tsx`. El **plan** de
  tareas (uno para toda la flota, 099) se edita desde «⋯ → Plan de servicio» en la cabecera de
  Carros (`fleet.manage`), con el mismo `maintenance-plan-dialog.tsx`.
- Los dos ajustes «Avisar a cuántos km» y «Avisar con cuántos días» salen de Ajustes de renta y
  viven en el diálogo del plan, y solo los ve quien tiene `rentals.settings`. El contrato de
  ajustes no cambia: la pantalla de Ajustes deja de mostrarlos y el diálogo del plan los lee y
  escribe con el endpoint de ajustes existente.

### Texto y densidad

- Sin subtítulos ni ayudas. Vacíos: «Nada pendiente», «Sin gastos», «Nada todavía».
- `bahia`: lista a una columna, pestañas de la ficha como chips de `--touch-min`, diálogos a una
  columna.

## Reglas de negocio

- **RN-1:** `availability` y los avisos se calculan en el API, en un solo sitio, el mismo que usa
  Hoy (107). La web nunca deriva estados.
- **RN-2:** Un movimiento de plata del carro es **una** fila de gasto, venga de donde venga
  (anotado, servicio con costo, lavado, multa). `MaintenanceLog.cost` sin `FleetExpense` ligado
  no existe desde esta spec; los logs viejos con costo se migran con un script de datos
  idempotente en el seed/`verify-110.sh`, no con una migración de esquema.
- **RN-3:** «Este mes» y el mes en curso de la pestaña del carro = del 1 a hoy. El total de ese
  año también corta hoy; un año pasado queda entero. «Quedó» = Entró − Se fue, con los mismos
  cortes que Caja y Gastos.

## Permisos

Sin claves nuevas. «¿Cuánto dejó?» (lista y pestaña): `rentals.reports`. Anotar servicio y gasto:
`fleet.manage`.

## Datos

Sin cambios de esquema. Si `MaintenanceLog` ↔ `FleetExpense` no tiene cómo ligarse (ver 099), se
usa la columna o relación que la 099 dejó; si no hay ninguna, **preguntar antes** (la 109 es la
única que toca `schema.prisma` en esta épica; se coordina al final).

## API

| Método | Ruta                                  | Cambio                                                  |
| ------ | ------------------------------------- | ------------------------------------------------------- |
| GET    | `/rentals/fleet`                      | + `availability`, `alerts`; `RETIRED` fuera por defecto |
| GET    | `/rentals/fleet/:id`                  | + `availability`, `alerts`                              |
| GET    | `/rentals/fleet/:id/service`          | tareas pendientes del carro (si no existe ya en la 099) |
| POST   | `/rentals/fleet/:id/maintenance-logs` | con `cost` crea el gasto ligado                         |
| GET    | `/rentals/reports/profitability`      | sin ocupación; «este mes» corta hoy                     |

## Contrato compartido

`rentals/fleet.ts`: `FleetAlert`, `FleetVehicle.availability` y `.alerts` (`VehicleAvailability`
viene de la 107). `rentals/maintenance.ts`: lo que pida la lista de pendientes.
`rentals/reports.ts`: rótulos nuevos y el corte de «este mes»; se borra lo de ocupación.

## Convivencia con 107, 108 y 109

Esta spec es dueña de `features/fleet/**`, `features/fleet-maintenance/**`,
`features/rental-reports/**` **salvo** `today-screen.tsx` (107), `features/rental-settings/**`,
de `rentals/fleet.ts`, `rentals/maintenance.ts` y la parte de rentabilidad de
`rentals/reports.ts`, y de los módulos fleet, fleet-maintenance y rental-reports del API (salvo
`today`). No toca `nav-items.ts`, `features/rentals/**`, `features/rental-billing/**` ni
`schema.prisma`. La función `vehicleAvailability()` la crea la 107; esta la consume.

## Ask first

- Si no existe forma de ligar un servicio con su gasto sin columna nueva.
- Si el dueño quiere seguir viendo el plan desde Ajustes además de desde Carros.

## Never

- Nunca «Disponible» para un carro: la palabra es «Libre», y solo si está libre de verdad.
- Nunca pedir categoría para anotar un gasto.
- Nunca dos pantallas que listen los gastos o el servicio de un carro.

## Fuera de alcance

- Retirar un carro desde la lista (sigue en la ficha, 103). Corregir o borrar un gasto automático
  (lavado, multa, o el que sale de un servicio): ese se borra con el servicio.

## Tareas

- [x] Shared: `FleetAlert`, campos nuevos de `FleetVehicle`, rótulos de rentabilidad, corte de
      «este mes»; tests.
- [x] API: `availability` + `alerts` en lista y detalle (reusa la función de la 107); pendientes
      por carro; log con costo → gasto ligado (+ borrado en cascada); rentabilidad sin ocupación;
      tests en memoria.
- [x] Web lista: `fleet-screen.tsx` con estado único, «N avisos», «¿Cuánto dejó?» y «⋯ → Plan de
      servicio»; `fleet-status-stamp.tsx` solo para taller/retirado.
- [x] Web ficha: pestañas Ficha · Servicio · Gastos · ¿Cuánto dejó?; `vehicle-maintenance-tab.tsx`
      y `fleet-expenses-panel.tsx` rehechos a cuatro y tres campos; `vehicle-months-tab.tsx` con
      rótulos nuevos.
- [x] `/rentals/fleet/earnings` con `profitability-screen.tsx`; redirects de `maintenance`,
      `expenses` y `profitability`; borrar `maintenance-screen.tsx`, `fleet-expenses-screen.tsx`,
      `vehicle-select.tsx`, `occupancy` de los reportes.
- [x] Ajustes: quitar los dos campos de aviso de la pantalla; el diálogo del plan los edita.
- [x] `scripts/verify-110.sh`: `availability` por estado (libre, reservado hoy, en renta,
      atrasado, taller); `alerts` con seguro por vencer y tarea vencida; log con costo crea un
      gasto y borrarlo lo borra; `RETIRED` fuera por defecto; 403 sin `fleet.read`;
      `/rentals/reports/profitability` sin `occupancy`. `verify-099.sh`, `verify-100.sh` y
      `verify-103.sh` ajustados donde cambie el contrato.
- [x] `apps/web/AGENTS.md`: «Libre» es la única palabra para un carro sin renta.

## Verificación

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-099.sh && bash scripts/verify-100.sh && bash scripts/verify-103.sh && bash scripts/verify-110.sh`
