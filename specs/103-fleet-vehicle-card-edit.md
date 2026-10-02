# 103 — Ficha del carro: alta corta y edición por tarjeta

**Estado:** Terminada (aprobada por chat, 1 oct 2026: «lo veo bien, implementemoslo, ya de a poquito iremos
revisando el apartado al hacer click», sobre `docs/prototype/fleet-vehicle.html`)
**Módulo:** fleet, rental-reports (api) · `@elite/shared` rentals · `features/fleet` (web) |
**Depende de:** 095, 100. Corre en paralelo con la 101 (paginación): ver «Convivencia con la 101».

## Contexto

El modal «Editar carro» de la 095 mete 25 campos en una sola hoja, repite el estado (que ya tiene
botones en la ficha) y deja editar a mano un kilometraje que la entrega y la recepción actualizan
solas. El prototipo aprobado `docs/prototype/fleet-vehicle.html` lo parte: alta corta, y en la
ficha cada tarjeta se edita con su propio diálogo chico. Además agrega aseguradora y póliza, y el
interruptor «la cuota incluye seguro y GPS» para no contarlos dos veces en la rentabilidad.

## Criterios de aceptación

- **Dado** la lista de la flota, **cuando** toco «Nuevo carro», **entonces** el diálogo pide solo
  marca, modelo, placa, año, color, tipo, tarifa diaria y «Kilometraje al recibirlo»; al crear,
  navega a la ficha del carro nuevo.
- **Dado** la ficha, **entonces** muestra seis tarjetas: Identificación (incluye color y
  kilometraje de solo lectura), Tarifas y km, Compra y financiamiento, Costos fijos mensuales,
  Seguro y circulación, Notas. Cada una con su botón «Editar» (si hay `fleet.manage`) que abre un
  diálogo con **solo** sus campos y manda un `PATCH` con **solo** esos campos.
- **Dado** el encabezado de la ficha, **entonces** el botón «Editar» general desaparece; quedan la
  acción de estado más común («Mandar a taller» / «Volver a disponible» / «Volver a la flota») y
  «Cambiar estado…», que abre un diálogo con los tres estados. Retirar pide confirmación con
  `destructiveSolid`. La tarjeta «Estado» de la ficha desaparece.
- **Dado** tarifas de 7+ o 30+ vacías, **entonces** la ficha dice «Igual que la diaria» (o «Igual
  que la de 7+» para la de 30+ si hay semanal) y el campo vacío lleva ese texto de placeholder,
  nunca `0.00`. Con km libre, «Km adicional» dice «No aplica».
- **Dado** el diálogo de Tarifas, **entonces** un interruptor «Km limitado» muestra u oculta km
  libres por día y precio por km adicional; apagado guarda ambos en `null`.
- **Dado** un carro financiado con plazo e inicio, **entonces** la tarjeta muestra el avance:
  «Cuota N de M · faltan K · termina en mmm aaaa» con barra.
- **Dado** `installmentIncludesExtras = true`, **entonces** la tarjeta de costos y su diálogo
  ocultan seguro y GPS con un aviso, y la rentabilidad (100) no los suma aunque tengan monto.
- **Dado** un usuario sin `rentals.reports`, **entonces** el API devuelve el carro con los campos
  de costo en `null` (`costsHidden: true`), la ficha muestra esas dos tarjetas bajo llave («Solo lo
  ve quien tiene permiso de rentabilidad») y un `PATCH` que traiga campos de costo responde 403.
- **Dado** un `PATCH` con `odometerKm`, **entonces** 422: el kilometraje solo se escribe en el alta.
- Los vencimientos marcan «Vence en N días» en ámbar dentro de `daysAlert` y «Vencido» en rojo.
- Densidad `bahia`: tarjetas a una columna y diálogos a una columna; bajo 900px los diálogos suben
  desde abajo (componente existente).

## Reglas de negocio

- **RN-1:** Los campos de costo son: `purchasePrice`, `purchasedAt`, `financed`, `downPayment`,
  `installment`, `termMonths`, `financingStartedAt`, `installmentIncludesExtras`,
  `insuranceMonthly`, `gpsMonthly`, `otherFixedMonthly`. Verlos y editarlos pide
  `rentals.reports` (la clave existente «Ver rentabilidad e inversión recuperada»); editarlos pide
  además `fleet.manage`. Sin claves nuevas. Aseguradora, póliza y vencimientos **no** son costo.
- **RN-2:** `installmentIncludesExtras` solo vale con `financed = true`; si `financed` pasa a
  `false`, se guarda `false`. En `monthlyFixedCents` (shared `reports.ts`) seguro y GPS cuentan 0
  cuando el carro está financiado con la bandera encendida.
- **RN-3:** `odometerKm` se fija en el alta y después solo lo sube la entrega/recepción (096). Sale
  de `updateFleetVehicleSchema`.
- **RN-4:** Tarifa de 30+ vacía cae a la de 7+ si existe, si no a la diaria; tarifa de 7+ vacía cae
  a la diaria. **Verificar** que así cotiza hoy `rentals/money.ts`; si no, la ficha muestra lo que
  el cálculo realmente hace (no se cambia el cálculo en esta spec).
- **RN-5:** Primera cuota vacía: los reportes ya caen a la fecha de compra (`financingRange`). El
  campo se rotula «Primera cuota» con esa ayuda.

## Datos

`FleetVehicle` gana tres columnas (migración nueva, aditiva, sin tocar datos):

| Columna                     | Tipo                      |
| --------------------------- | ------------------------- |
| `insurer`                   | `String?` (máx. 80)       |
| `policyNumber`              | `String?` (máx. 40)       |
| `installmentIncludesExtras` | `Boolean @default(false)` |

## API

| Método | Ruta                             | Cambio                                                                                                                                                                                                   |
| ------ | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET    | `/fleet/vehicles/:id` y la lista | Agrega `insurer`, `policyNumber`, `installmentIncludesExtras`, `costsHidden`. Sin `rentals.reports`: campos de RN-1 en `null` (`financed`/`installmentIncludesExtras` en `false`) y `costsHidden: true`. |
| POST   | `/fleet/vehicles`                | Acepta los campos nuevos. Campos de costo sin `rentals.reports` → 403.                                                                                                                                   |
| PATCH  | `/fleet/vehicles/:id`            | Sin `odometerKm` (422 si viene). Campos de costo sin `rentals.reports` → 403 `FORBIDDEN`.                                                                                                                |

El enmascarado vive en un solo lugar (presentation o application del módulo fleet), no en cada
endpoint.

## UI

Copiar la estructura del prototipo, con los componentes reales (`Card`, `CardSectionHeading`,
`DetailField`, `Dialog`, `TextField`, `Switch`, `Combobox`, `Stamp`, `ScreenHeader`):

- `fleet-vehicle-dialog.tsx` se parte en `fleet-vehicle-create-dialog.tsx` (alta corta) y
  `fleet-vehicle-section-dialog.tsx` (un diálogo por sección, mismo `applyApiError`).
- `fleet-vehicle-detail.tsx`: las seis tarjetas; las de costo bajo llave con `costsHidden`.
- `fleet-vehicle-frame.tsx`: encabezado con acción de estado + «Cambiar estado…» + confirmación.
- `vehicle-form.ts`: schemas de formulario por sección (con tests).

## Convivencia con la 101

La 101 está en curso sin commitear y toca la lista. Esta spec **no toca**:
`fleet-screen.tsx`, `fleetVehiclesQuerySchema`, el `list()` del repositorio/usecases/controller de
fleet, `common/pagination/`, ni ningún archivo de otros módulos que la 101 modifica salvo
`rental-reports` (solo el `select`/mapeo del campo nuevo). En `packages/shared/src/rentals/fleet.ts`
y `prisma-fleet-vehicle.repository.ts` los cambios se limitan al shape del carro y al mapeo de
filas, para que el merge con la 101 sea de bloques separados. «Nuevo carro» sigue abriéndose desde
`fleet-screen.tsx`: se cambia solo el import del diálogo.

## Fuera de alcance

- Mostrar de qué renta salió el último kilometraje.
- Cambiar el cálculo de cobro de `rentals/money.ts`.
- Paginación (101).

## Verificación

`pnpm build && pnpm lint && pnpm test` y [`bash scripts/verify-103.sh`](../scripts/verify-103.sh) contra el API local
(crea un carro, PATCH por sección, 422 con `odometerKm`, 403 de costos con un usuario sin
`rentals.reports`, enmascarado en el GET).

## Tareas

- [x] Migración + `schema.prisma` con las tres columnas.
- [x] Shared: `FleetVehicle` y schemas (campos nuevos, `costsHidden`, sin `odometerKm` en update);
      `monthlyFixedCents` con RN-2; tests en `fleet.spec.ts` y `reports` spec.
- [x] API fleet: mapeo, enmascarado y 403 de costos; tests en `fleet-vehicle.usecases.spec.ts`.
- [x] API rental-reports: leer `installmentIncludesExtras`.
- [x] Web: alta corta, diálogos por sección, tarjetas, encabezado de estado; tests de `vehicle-form`.
- [x] `scripts/verify-103.sh` pasa.
- [x] `apps/web/DESIGN.md` o `AGENTS.md` solo si cambia una convención.
