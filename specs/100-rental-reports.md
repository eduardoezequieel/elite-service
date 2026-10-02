# 100 — Inicio de la rentadora y rentabilidad por carro

**Estado:** Terminada (aprobada por chat, 1 oct 2026, misma nota que la 095)
**Módulo:** rental-reports (api) · features/rental-reports (web) · `@elite/shared`
rentals/reports.ts | **Depende de:** 095, 096, 098, 099

## Contexto

Lo que el dueño mira al abrir: el tablero de la flota (quién tiene cada carro y cuándo regresa), lo
que sale y entra hoy y mañana, los próximos 7 días, el resumen del mes y los pendientes. Y lo que
decide si un carro vale la pena: ingresos, gastos, seguro, GPS, cuota, lo que quedó, veredicto
(ganancia · cubrió su costo · pérdida), inversión recuperada, gráfica de 12 meses y vista mes a mes.
Las fórmulas están en el prototipo (`profitOne`, `fixedCost`, `lifetime`, `monthsFrac`, `verdict`,
líneas 640–680 de `/Users/elopez/Downloads/index.html`) y se replican tal cual. Esta spec reemplaza
la pantalla vacía de `/rentals` de la 094 y agrega la pestaña «Meses» de la ficha del carro (095).

## Historias

- Como recepción, quiero abrir el espacio y ver de un vistazo qué carro está libre, rentado,
  atrasado o en taller, y qué entregas y salidas hay hoy y mañana.
- Como dueño con `rentals.reports`, quiero saber por carro y por periodo cuánto entró, cuánto se
  fue y si ya se pagó solo.

## Criterios de aceptación

- **Dado** `GET /rentals/reports/dashboard`, **entonces** devuelve `{ fleet: [{ vehicle, state:
  'FREE'|'OUT'|'LATE'|'BOOKED'|'IN_SHOP', agreement? (quién, cuándo regresa / cuándo sale) }],
  today: { pickups[], returns[] }, tomorrow: {...}, next7Days: [{ date, occupied, total }],
  month: { income, agreements, occupancy }, pending: { late[], balances[], maintenanceDue,
  documentsDue } }`. `BOOKED` = libre ahora pero con reserva que arranca en menos de 48 h.
- **Dado** una renta del 28 sep al 3 oct con total 300, **cuando** pido rentabilidad de octubre,
  **entonces** el ingreso de ese carro incluye `300 × (días de la renta en octubre / días totales)`
  (prorrateo por solapamiento, como `profitOne`).
- **Dado** un carro con seguro 40, GPS 15, cuota 350 activa y compra el 15 del mes, **cuando** pido
  el mes completo, **entonces** `fixed = 55 × fracción del mes desde el 15` y `installment = 350 ×
  esa fracción` (`monthsFrac`).
- **Dado** `operating = income − expenses − fixed` y `net = operating − installment`, **entonces**
  `verdict` es `GAIN` si `net > tol`, `LOSS` si `net < −tol`, `EVEN` si no, con `tol = max(10,
  3 % de los costos)`; sin costos ni ingresos, `NONE`.
- **Dado** un carro financiado con prima 3.000, cuota 350 y 8 cuotas pagadas, **entonces**
  `lifetime.disbursed = 3.000 + 8 × 350`, `recovered = operatingLifetime / disbursed` y la UI dice
  «Ya se pagó solo» si `>= 1`. Al contado: `disbursed = purchasePrice`. Sin datos → «Faltan datos».
- **Dado** `GET /fleet/vehicles/:id/months?year=2026`, **entonces** 12 filas con ingreso, gastos,
  fijos, cuota, neto, días rentados y ocupación.
- **Dado** un usuario sin `rentals.reports`, **cuando** pide rentabilidad, **entonces** 403; el
  tablero solo pide `rentals.read`.

## Reglas de negocio

- **RN-1:** Ingreso de una renta = `netOf(agreementTotals(...))` (IVA 0 ⇒ el total). Se excluyen
  `CANCELLED` y `RESERVED`. Prorrateo por solapamiento del intervalo ocupado con el periodo.
- **RN-2:** Gastos del periodo = `FleetExpensesReader.sumByVehicle` de la 099 (manuales + lavados +
  multas no cargadas). El módulo `rental-reports` importa `FleetMaintenanceModule` para ese puerto.
- **RN-3:** Fijos mensuales = `insuranceMonthly + gpsMonthly + otherFixedMonthly`, prorrateados por
  `monthsFrac` desde `purchasedAt ?? financingStartedAt ?? primera renta`. Cuota solo dentro del
  plazo (`financingStartedAt` + `termMonths`).
- **RN-4:** Ocupación = días rentados / días del periodo. Ingreso por día = ingreso / días
  rentados.
- **RN-5:** Punto de equilibrio del carro = `(fijos + cuota activa) / dailyRate` días al mes.
- **RN-6:** Todo cálculo es puro y vive en `rentals/reports.ts` de shared (con tests); el API solo
  junta datos y llama a esas funciones. Fechas y meses en `America/El_Salvador`.

## Permisos

`rentals.read` (tablero) y `rentals.reports` (rentabilidad, meses). Sin claves nuevas.

## Contrato compartido (`rentals/reports.ts`)

Tipos `RentalDashboard`, `VehicleProfitability`, `VehicleLifetime`, `VehicleMonthRow`, `Verdict`
con labels; schemas `profitabilityQuerySchema` (from, to civil; presets en la UI: este mes, mes
pasado, 3 meses, año), `monthsQuerySchema`; funciones puras `monthsFrac`, `prorate`, `fixedCost`,
`verdict`, `profitability(vehicle, agreements, expenses, from, to)`, `lifetime(...)`,
`breakEvenDays(...)`.

## API

| Método | Ruta                               | Permiso           | Notas                     |
| ------ | ---------------------------------- | ----------------- | ------------------------- |
| GET    | `/rentals/reports/dashboard`       | `rentals.read`    |                           |
| GET    | `/rentals/reports/profitability`   | `rentals.reports` | `?from&to` → por carro + totales |
| GET    | `/fleet/vehicles/:id/months`       | `rentals.reports` | `?year`                   |

Módulo `rental-reports` (cascarón de la 095); importa `FleetMaintenanceModule` (puerto de gastos)
y lee `rental_agreements`, `fleet_vehicles`, `rental_payments`, `rental_fines` con Prisma propio.

## UI

- **Inicio** `/rentals` (`features/rental-reports/components/rentals-home.tsx`; la página de la 094
  pasa a renderizar este componente y se borra el stub de `features/rentals/components/
  rentals-home.tsx`): saludo con la fecha; «Tablero de la flota» (tarjeta por carro: placa,
  modelo, `Stamp` de estado, quién lo tiene y cuándo regresa o cuándo sale); «Hoy» y «Mañana»
  (salidas y entregas con hora y cliente, enlaces a la renta); «Próximos 7 días» (barra de
  ocupación por día, patrón de barras de la 067); «Este mes» (`StatCard`s: ingresos, rentas,
  ocupación); «Pendientes» (atrasos, saldos, mantenimiento vencido, documentos por vencer, con
  enlaces). Estado vacío si no hay flota, con botón a Flota.
- **Rentabilidad** `/rentals/profitability` (`rentals.reports`): selector de periodo con presets y
  rango; `StatCard`s del total (ingresos, gastos, fijos, cuotas, neto); tabla por carro: ingresos,
  gastos, seguro+GPS, cuota, «lo que quedó», veredicto (`Stamp` con semáforo), ocupación, ingreso
  por día, inversión recuperada (barra o «Ya se pagó solo» / «Faltan datos»); al tocar un carro,
  su pestaña «Meses».
- **Meses** `/rentals/fleet/[id]/months` (pestaña del marco de la 095): selector de año, gráfica
  de 12 barras (SVG propio con tokens del tema, sin librería; leer la skill `dataviz` antes),
  tabla mes a mes, punto de equilibrio y ficha de inversión (desembolsado, cuotas pagadas,
  pendiente, recuperado).
- Densidad `bahia`: tarjetas en una columna, gráfica a ancho completo.

## Fuera de alcance

- «Ver resumen general» de los dos negocios (fuera de la épica).
- Exportar a Excel.

## Tareas

- [x] `rentals/reports.ts` en shared con tests de `monthsFrac`, prorrateo, `fixedCost`, `verdict`,
      `lifetime`.
- [x] Casos de uso con repos en memoria: dashboard, profitability, months; tests.
- [x] Infra Prisma + controller; importar `FleetMaintenanceModule`.
- [x] Inicio (reemplaza el stub de la 094), Rentabilidad, Meses.
- [x] `apps/api/AGENTS.md` y `apps/web/AGENTS.md`: una línea cada uno.
- [x] `scripts/verify-100.sh`: dashboard con estados, prorrateo entre meses, 403 sin
      `rentals.reports`, meses con 12 filas.

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
bash scripts/verify-100.sh
```
