# 096 — Rentas: reserva, entrega, recepción, calendario y disponibilidad

**Estado:** Aprobada (por chat, 1 oct 2026, misma nota que la 095)
**Módulo:** rentals (api) · features/rentals (web) · `@elite/shared` rentals/agreements.ts |
**Depende de:** 095

## Contexto

El corazón de la rentadora. Una renta nace **reservada**, pasa a **en curso** al entregar el carro
(con inspección), y termina **finalizada** al recibirlo (con inspección de regreso), o se
**cancela**. Si se pasa de la hora de regreso sin recibir, se ve **atrasada** (estado derivado, no
guardado). Hay extensiones, cambio de carro, reasignación de reservas, calendario por carro y el
buscador «¿Qué hay libre?». Los cobros sueltos, depósitos y multas son de la 098; la impresión del
contrato, de la 097. Esta spec **no toca `schema.prisma`**: todo lo que necesita está en la 095.

## Historias

- Como recepción con `rentals.manage`, quiero reservar un carro para un cliente en un rango de
  fecha y hora, para que nadie más lo tome en ese rango.
- Como recepción, quiero entregar el carro registrando km, combustible, golpes y accesorios desde
  el celular, para que la devolución se compare contra algo.
- Como recepción, quiero recibir el carro, cobrar los días y km extra y cerrar la renta, para que
  el carro vuelva a estar disponible.
- Como recepción, quiero ver en un calendario quién tiene cada carro y buscar qué hay libre en un
  rango, para cotizar por WhatsApp sin equivocarme.

## Criterios de aceptación

- **Dado** un cliente activo y un carro `ACTIVE` libre, **cuando** hago `POST /rentals/agreements`
  con fechas y tarifa, **entonces** nace `RESERVED`, `billableDays` sale de `billableDays()` con la
  gracia de ajustes y `dailyRate` por defecto sale de `rateForDays()`.
- **Dado** un carro reservado del 10 al 12 10:00, **cuando** intento otra renta del 12 10:30 al 14,
  **entonces** 409 `VEHICLE_UNAVAILABLE` (margen `bufferHours` = 1 h); del 12 11:00 en adelante,
  pasa.
- **Dado** un cliente `isBlocked`, **cuando** intento crearle una renta, **entonces** 409
  `RENTER_BLOCKED`. Un carro `IN_SHOP` o `RETIRED` → 409 `VEHICLE_NOT_RENTABLE`.
- **Dado** una renta `RESERVED`, **cuando** hago checkout con inspección y km, **entonces** pasa a
  `IN_PROGRESS`, guarda `actualPickupAt`, `pickupInspection`, `pickupOdometerKm`, le asigna
  `contractNumber` si no tenía (correlativo desde `contractStartNumber`), actualiza `odometerKm`
  del carro y registra el pago inicial si vino.
- **Dado** una renta `IN_PROGRESS` con `plannedReturnAt` en el pasado, **cuando** la listo,
  **entonces** `derivedStatus` es `LATE`.
- **Dado** una renta `IN_PROGRESS`, **cuando** hago checkin con km de regreso mayor al permitido
  (`freeKmPerDay × billableDays`), **entonces** `extraKmCharge = kmExtra × extraKmPrice` (solo si
  `chargeExtraKm`), pasa a `FINISHED`, guarda `returnInspection`, `returnOdometerKm`,
  `actualReturnAt`, actualiza `odometerKm` del carro y, si vino, registra el pago y la devolución
  del depósito (`depositReturnedAmount`, que no puede superar `deposit` → 409
  `DEPOSIT_EXCEEDS_HELD`).
- **Dado** una renta `IN_PROGRESS`, **cuando** la extiendo a una fecha posterior, **entonces** crea
  una `RentalExtension`, recalcula `billableDays`, y rechaza con 409 `VEHICLE_UNAVAILABLE` si la
  nueva fecha choca con una reserva siguiente.
- **Dado** una renta `IN_PROGRESS`, **cuando** hago cambio de carro, **entonces** la actual queda
  `FINISHED` en la fecha del cambio (días recalculados), nace una nueva `IN_PROGRESS` con el carro
  nuevo ligada por `previousAgreementId`, el depósito pasa a la nueva
  (`depositTransferredToId`) y el contrato nuevo recibe número propio.
- **Dado** una renta `RESERVED`, **cuando** la reasigno a otro carro libre, **entonces** cambia
  `vehicleId`; si está `IN_PROGRESS`, 409 `AGREEMENT_NOT_RESERVED`.
- **Dado** una renta `FINISHED` o `CANCELLED`, **cuando** intento cualquier mutación, **entonces**
  409 `AGREEMENT_CLOSED`.
- **Dado** `GET /rentals/availability?from&to&category`, **entonces** cada carro `ACTIVE` viene
  con `availability: 'FREE' | 'FREE_IF_RETURNED' | 'BUSY'` y la renta que lo ocupa;
  `FREE_IF_RETURNED` cuando el único choque es una renta en curso cuyo regreso planificado (más
  margen) es antes de `from`.
- **Dado** `GET /rentals/calendar?from&to`, **entonces** devuelve una fila por carro con sus rentas
  (reservadas, en curso, atrasadas, finalizadas) que tocan el rango.

## Reglas de negocio

- **RN-1:** Estados guardados `RESERVED → IN_PROGRESS → FINISHED`, `RESERVED → CANCELLED`,
  `IN_PROGRESS → CANCELLED` solo si no hay pagos. `LATE` es derivado: `IN_PROGRESS` y
  `plannedReturnAt < now`. Las transiciones viven en `domain/`.
- **RN-2:** Intervalo ocupado de una renta: `[actualPickupAt ?? plannedPickupAt, plannedReturnAt]`,
  y si está en curso y atrasada, hasta `now`. Choque = intersección con margen `bufferHours` a cada
  lado. Solo `RESERVED` e `IN_PROGRESS` ocupan.
- **RN-3:** Número de contrato: `max(contractNumber) + 1`, nunca menor que
  `contractStartNumber`; único; se asigna en checkout o con `POST /:id/contract-number` (la 097 lo
  llama antes de imprimir). Reintento ante choque del unique (ver `retryOnSequenceClash` como
  referencia de patrón; acá la columna es `contract_number` entera).
- **RN-4:** `billableDays` se recalcula en checkout (con `actualPickupAt`), en extensión y en
  checkin (`actualReturnAt`), siempre con `billableDays()` de shared; el usuario puede
  sobreescribirlo en checkin (`billableDays` explícito) con nota.
- **RN-5:** Un carro solo vuelve a estar disponible al **recibirlo** (checkin). Pasarse de la hora
  no lo libera.
- **RN-6:** Tarjeta de garantía: solo `cardLast4` (4 dígitos), código y monto de autorización.
  Nunca el número completo.
- **RN-7:** La inspección (`RentalInspection`, shared): `{ odometerKm, fuelEighths: 0..8,
  damages: [{ zone: InspectionZone, description }], accessories: Record<string, boolean>,
  tires: { front?, rear? }, battery?, photoIds: string[], notes? }`. Zonas (shared,
  `INSPECTION_ZONES`): `hood, roof, trunk, front_bumper, rear_bumper, windshield, rear_window,
  left_front_fender, left_front_door, left_rear_door, left_rear_fender, right_front_fender,
  right_front_door, right_rear_door, right_rear_fender, left_mirror, right_mirror, wheels`.
- **RN-8:** El checkout exige `fuelEighths` y `odometerKm`; lo demás es opcional. El checkin marca
  los daños nuevos comparando zonas contra la inspección de salida.
- **RN-9:** WhatsApp: enlaces `https://wa.me/503XXXXXXXX?text=…` (8 dígitos → prefijo 503), con
  textos: cotización (desde disponibilidad), recordatorio de regreso, aviso de atraso. Se abren en
  pestaña nueva; no se envía nada desde el servidor.
- **RN-10:** Totales siempre con `agreementTotals()` de shared; el API devuelve `totals` calculado
  en el DTO de detalle para que la UI no sume.

## Permisos

Usa `rentals.read` (lecturas, calendario, disponibilidad) y `rentals.manage` (todas las
mutaciones). Sin claves nuevas.

## Datos

Ninguno nuevo (095). Si falta un campo, se reporta al orquestador; no se migra desde acá.

## Contrato compartido (`rentals/agreements.ts`)

Enums y labels (`AGREEMENT_STATUS_LABELS` con `LATE`), `INSPECTION_ZONES` con labels,
`rentalInspectionSchema`, `createAgreementSchema` (customerId, vehicleId, plannedPickupAt,
plannedReturnAt, pickupLocation, returnLocation, dailyRate?, billableDays?, cdwPerDay?, deductible?,
coverage, includesVat, extraCharges, extraChargesNote, discount, deposit, depositMethod?, cardLast4?,
authorizationCode?, authorizationAmount?, authorizationDate?, additionalDriver?, notes?,
`checkoutNow?: boolean` con `checkout?` adjunto), `updateAgreementSchema`, `checkoutSchema`
(actualPickupAt, inspection, deposit?, depositMethod?, payment?: { amount, method, reference?,
note? }), `checkinSchema` (actualReturnAt, inspection, billableDays?, billableDaysNote?,
chargeExtraKm, payment?, depositReturn?: { amount, method?, note? }, notes?), `extendSchema`,
`swapSchema` (at, newVehicleId, dailyRate?, reason), `reassignSchema`, `cancelSchema`,
`agreementsQuerySchema` (status[], derived `late`, customerId, vehicleId, from, to, q),
`availabilityQuerySchema`, `calendarQuerySchema`; tipos `RentalAgreement` (DTO con `customer`,
`vehicle` resumidos, `derivedStatus`, `totals`, `payments[]`, `fines[]`, `extensions[]`),
`AvailabilityRow`, `CalendarRow`. Helpers puros: `derivedStatus(agreement, now)`,
`occupiedInterval(agreement, now)`, `intervalsClash(a, b, bufferMs)`, `waLink(phone, text)`,
`quoteText(...)`, `newDamages(pickup, return)`.

## API

| Método | Ruta                                       | Permiso          | Notas                                              |
| ------ | ------------------------------------------ | ---------------- | -------------------------------------------------- |
| GET    | `/rentals/agreements`                      | `rentals.read`   | filtros de `agreementsQuerySchema`; orden por `plannedPickupAt desc` |
| GET    | `/rentals/agreements/:id`                  | `rentals.read`   | DTO completo con `totals`                          |
| POST   | `/rentals/agreements`                      | `rentals.manage` | 201; `checkoutNow` entrega en el mismo paso        |
| PATCH  | `/rentals/agreements/:id`                  | `rentals.manage` | solo `RESERVED`/`IN_PROGRESS`; revalida choques    |
| POST   | `/rentals/agreements/:id/checkout`         | `rentals.manage` | RESERVED → IN_PROGRESS                             |
| POST   | `/rentals/agreements/:id/checkin`          | `rentals.manage` | IN_PROGRESS → FINISHED                             |
| POST   | `/rentals/agreements/:id/extend`           | `rentals.manage` |                                                    |
| POST   | `/rentals/agreements/:id/swap`             | `rentals.manage` | devuelve `{ closed, opened }`                      |
| POST   | `/rentals/agreements/:id/reassign`         | `rentals.manage` | solo RESERVED                                      |
| POST   | `/rentals/agreements/:id/cancel`           | `rentals.manage` |                                                    |
| POST   | `/rentals/agreements/:id/contract-number`  | `rentals.manage` | idempotente                                        |
| GET    | `/rentals/availability`                    | `rentals.read`   | `?from&to&category`                                |
| GET    | `/rentals/calendar`                        | `rentals.read`   | `?from&to`                                         |

Todo en el módulo `rentals` ya registrado (cascarón de la 095): `domain/` (estados, intervalo,
choques), `application/` (casos de uso + puertos `AgreementRepository`, `FleetVehicleReader`,
`RenterReader`, `RentalSettingsReader`, `ContractNumberSequence`), `infrastructure/` (Prisma),
`presentation/` (controller). Los lectores de flota, clientes y ajustes se implementan con Prisma
dentro de este módulo (lectura directa a las tablas), sin importar los módulos de la 095.

## UI (`features/rentals`)

Claves de react-query: lista `['rental-agreements', filters]`, detalle `['rental-agreement', id]`,
calendario `['rental-calendar', from, to]`, disponibilidad `['rental-availability', q]`. La 098
invalida `['rental-agreement', id]` y `['rental-agreements']` tras cobrar.

- **Rentas** `/rentals/agreements`: `DataTable` con contrato (`Reference`), cliente, carro
  (`PlateChip`), sale / regresa, estado `Stamp` (reservada · en curso · atrasada · finalizada ·
  cancelada; atrasada en el color de peligro del semáforo), saldo. Filtros por estado y rango;
  búsqueda por cliente, placa o contrato. Botón «Nueva renta».
- **Nueva renta** `/rentals/agreements/new`: formulario (react-hook-form, patrón 082) en grupos:
  Cliente (combobox con búsqueda + «Registrar cliente nuevo» inline, alertas: bloqueado, licencia
  vencida, menor de edad mínima), Fechas y lugares, Carro (select con disponibilidad en vivo:
  libre / libre si regresa a tiempo / ocupado, y aviso de mantenimiento próximo si la 099 ya expone
  ese dato — si no, se omite), Cobro (tarifa sugerida por tramo, días calculados y editables, CDW y
  deducible por defecto de ajustes, cobertura, IVA incluido si `vatRate > 0`, cargos extra,
  descuento), Garantía (depósito, método, tarjeta últimos 4, autorización), Conductor adicional,
  Observaciones. Botones «Reservar» y «Entregar ahora» (abre el checkout en el mismo flujo).
- **Detalle** `/rentals/agreements/[id]`: cabecera con `Reference` del contrato, `Stamp`, cliente
  y carro con enlaces, fechas planificadas y reales, totales (total, pagado, saldo) y depósito,
  inspecciones de salida y regreso (resumen: km, combustible, daños, accesorios faltantes, fotos
  miniatura), extensiones, cambio de carro (enlaces a la renta anterior/siguiente), acciones según
  estado: Entregar · Recibir · Extender · Cambiar carro · Reasignar · Editar · Cancelar · WhatsApp
  (recordatorio / atraso). **Dos ranuras**: `<AgreementBillingPanel agreement />` importado de
  `@/features/rental-billing/components/agreement-billing-panel` y `<AgreementDocumentsActions
  agreement />` de `@/features/rental-documents/components/agreement-documents-actions`. **Crear
  ambos archivos como stubs que devuelven `null`** con un comentario «la 098/097 lo reemplaza»;
  no escribir nada más en esas carpetas.
- **Entrega / Recepción**: diálogo a pantalla completa en celular (`bahia`), pasos: Fecha y hora ·
  Km y combustible (selector de octavos, táctil) · Inspección (SVG del carro con zonas tocables ⇒
  lista de daños con descripción; en recepción las zonas de salida se ven tenues y los daños nuevos
  resaltados) · Accesorios (lista de ajustes con casillas) · Llantas y batería · Fotos (cámara o
  galería, se reducen a 1600 px en el cliente y suben a `POST /rental-files` con
  `kind=INSPECTION_PHOTO`) · Cobro (días, km extra calculado, pago opcional, devolución de depósito
  en recepción).
- **Calendario** `/rentals/calendar`: una fila por carro, columnas por día (rango de 1 a 4
  semanas, hoy marcado), barras por renta con color por estado y nombre del cliente; tocar una barra
  abre el detalle, tocar un hueco abre «Nueva renta» con carro y fecha prellenados. Scroll
  horizontal con la primera columna fija.
- **¿Qué hay libre?** `/rentals/availability`: rango de fecha y hora + categoría; tarjetas por
  carro con disponibilidad, tarifa para esos días (`rateForDays`) y total estimado; «Cotizar por
  WhatsApp» (RN-9) y «Reservar» con el carro prellenado.
- **`RenterHistory`** (`features/rentals/components/renter-history.tsx`, reemplaza el stub de la
  095): lista de rentas del cliente con estado y saldo.
- Densidades: en `bahia` las listas pasan a tarjetas, los diálogos a una columna, el calendario
  reduce a 7 días. Todo táctil.

## Fuera de alcance

- Cobros sueltos, anulación de pagos, multas, caja (098). Impresión (097). Inicio (100).
- Notificaciones o recordatorios automáticos; SSE.

## Tareas

- [ ] `rentals/agreements.ts` en shared con helpers puros y tests (estado derivado, choque con
      margen, texto de WhatsApp, daños nuevos).
- [ ] Dominio: transiciones, intervalo, choque; tests.
- [ ] Casos de uso con repos en memoria y tests: crear, checkout (número de contrato), checkin
      (km extra, depósito), extend, swap, reassign, cancel, availability, calendar.
- [ ] Infra Prisma + controller + lectores de flota/clientes/ajustes.
- [ ] Pantallas: lista, nueva renta, detalle (con las dos ranuras stub), entrega/recepción con
      inspección y fotos, calendario, disponibilidad, `RenterHistory`.
- [ ] `apps/api/AGENTS.md` y `apps/web/AGENTS.md`: una línea cada uno.
- [ ] `scripts/verify-096.sh`: alta, choque 409 con margen, bloqueado 409, checkout con número de
      contrato, atraso derivado, checkin con km extra y depósito, extend, swap, cerrado 409,
      disponibilidad `FREE_IF_RETURNED`.

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
bash scripts/verify-096.sh
```
