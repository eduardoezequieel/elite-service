# 126 — Combustible y daños al recibir el carro

**Estado:** Aprobada — 19 oct 2026, en el chat: «media vez esten apruebalas y desarrollalas,
quiero todo en main».
**Módulo:** `rentals` (api, web), `rentals/` de `@elite/shared` | **Depende de:** 108, 124
**ADR:** ADR-016 (propuesto con esta spec, en `docs/ARCHITECTURE.md`)

## Contexto

Al recibir un carro hoy solo se cobran días y km extra (`checkinSchema`,
`packages/shared/src/rentals/agreements.ts`). El combustible que falta y los daños nuevos no tienen
dónde ir: solo `extraCharges`, que mezcla todo y no se puede separar en reportes. El prototipo
`docs/prototype/rental-return-charges.html` (aprobado por el dueño) lleva al asistente
`handover-wizard.tsx` un indicador de combustible, líneas de daños y un visor 3D para marcar piezas.

## Historias

- Como dueño con `rentals.manage`, quiero anotar al recibir cuánto combustible y qué daños se
  cobran, para cerrar la cuenta en el mismo paso.
- Como dueño con `rentals.reports`, quiero que combustible y daños queden en campos propios, para
  distinguirlos de otros cargos.

## Criterios de aceptación

- **Dado** una renta en curso con cobertura `ACCEPTED` y deducible $500, **cuando** recibo con
  daños por $650, **entonces** `damageCharge` = `500.00` y el total suma $500.
- **Dado** cobertura `DECLINED` o `UNDEFINED`, **cuando** recibo con daños por $650, **entonces**
  `damageCharge` = `650.00`.
- **Dado** un combustible de $25 escrito, **cuando** recibo, **entonces** `fuelCharge` = `25.00`
  y `extraCharges` no cambia.
- **Dado** una garantía de $200 retenida, **cuando** recibo sin marcar «Devolver garantía»,
  **entonces** el saldo no baja por la garantía y `depositHeld` sigue en `200.00`.

## Reglas de negocio (decisiones del dueño, fijas)

- **RN-1 Combustible:** el nivel de regreso se elige en un indicador tipo tablero (semicírculo con
  aguja, por cuartos: 0/2/4/6/8 octavos de `FUEL_QUARTERS`, `fuel-scale.ts`) que muestra el nivel
  de salida como aguja fantasma «Salió». El monto se escribe a mano. Sin precio por cuarto ni ajuste
  nuevo.
- **RN-2 Daños:** líneas de pieza + monto (como Riveras, `checkinForm` de
  `docs/legacy/riveras-rent-a-car.html`). Tocar una zona sana en el visor agrega su línea con el
  nombre de `INSPECTION_ZONE_LABELS` y el monto vacío; tocarla otra vez la quita. «+ Daño» agrega
  una línea libre (sin zona). Las zonas dañadas en la salida no se pueden marcar.
- **RN-3 Tope (spec 124):** `damageCharge = coverage === 'ACCEPTED' ? min(Σ líneas, deductible) :
  Σ líneas`. Lo calcula una función pura de shared; el API la vuelve a correr y guarda el
  resultado. Las líneas se guardan con su monto original.
- **RN-4 Garantía:** no se resta del saldo. Se cobra el saldo completo y la garantía se devuelve
  aparte con el interruptor «Devolver garantía $X» (`depositReturn` de hoy).
- **RN-5 Totales:** `total = max(0, rental + extraCharges + extraKmCharge + fuelCharge +
  damageCharge + finesCharged − discount)`, en `agreementTotals` y `discountCeiling` de
  `rentals/money.ts`. Nadie más suma.

## Permisos

Sin claves nuevas. Recibir sigue con `rentals.manage`; el cobro, con `rentals.charge`.

## Datos

Migración `apps/api/prisma/migrations/<fecha>_rental_return_charges` sobre `rental_agreements`:

| Columna         | Tipo                       | Nota                                              |
| --------------- | -------------------------- | ------------------------------------------------- |
| `fuelCharge`    | `Decimal(12,2)` default 0  | monto escrito                                     |
| `damageLines`   | `Json?`                    | `[{ zone: InspectionZone \| null, part, amount }]` |
| `damageCharge`  | `Decimal(12,2)` default 0  | lo cobrado tras el tope (RN-3)                    |

Las filas existentes quedan en 0 / `null`: sus totales no cambian.

## API

| Método | Ruta                                  | Request                                              | Response          | Errores                       |
| ------ | ------------------------------------- | ---------------------------------------------------- | ----------------- | ----------------------------- |
| POST   | `/rentals/agreements/:id/checkin`     | `checkinSchema` + `fuelCharge`, `damageLines`        | `RentalAgreement` | 422 (montos), 409 de hoy      |

- `@elite/shared`: `damageLineSchema` (`zone` opcional de `INSPECTION_ZONES`, `part` 1–120,
  `amount` `moneySchema`), `checkinSchema` gana `fuelCharge` (default `'0.00'`) y `damageLines`
  (máx. 30, default `[]`); `damageChargeOf({ lines, coverage, deductible })` y los dos campos
  nuevos de `AgreementTotalsInput`/`DiscountCeilingInput` en `money.ts`; `RentalAgreement` gana
  `fuelCharge`, `damageLines`, `damageCharge`.
- Todo lugar que arma totales pasa los campos nuevos: `rentals/domain/agreement.ts`,
  `rental-billing/application/billing-view.ts` + `ports/agreement-reader.ts` +
  `infrastructure/billing-rows.ts` (sin esto `paymentFits` rechaza cobrar el saldo nuevo),
  `rental-reports/infrastructure/prisma-rental-reports.source.ts` y los repos en memoria.
- `CheckinWrite` (`ports/agreement.repository.ts`) y `PrismaAgreementRepository.checkin` escriben
  las tres columnas; `agreement-row.ts` las mapea.

## UI

`features/rentals`, mismo asistente de tres pasos (Kilometraje · Golpes · Cobro):

- **Kilometraje:** `fuel-gauge.tsx` (SVG, `role="slider"`, tocar/arrastrar/flechas, Inicio/Fin) +
  campo «Combustible ($)». Solo en `checkin`; la entrega sigue con `FuelPicker`.
- **Golpes:** visor 3D (ADR-016) a la izquierda y lista de líneas a la derecha; en `bahia` o
  < 560 px, una columna. Debajo, «Paga hasta $X · Cobra $Y» si hay daños. Fotos como hoy. Sin WebGL
  o si falla el `import()`, el `CarDiagram` 2D con el mismo comportamiento.
- **Cobro:** cuenta con Renta, Km extra, Combustible, Daños (con el monto original tachado y
  «Tope» si aplica), Total, Pagado y «Debe»/«Devolver». El monto a cobrar se prellena con el saldo
  que ya incluye combustible y daños. «Devolver garantía» aparte (RN-4).
- `accountLines` (`agreement-format.ts`) agrega «Combustible» y «Daños»;
  `inspection-sheet.tsx` imprime los dos renglones.
- Sin subtítulos ni ayudas (UI con poco texto). Tokens de `DESIGN.md`; el visor se repinta al
  cambiar el tema.

## Fuera de alcance

- Costo sugerido por pieza (el prototipo trae una tabla `ZONE_COST`): no se implementa.
- Cambiar combustible o daños después de recibir; mostrarlos aparte en «¿Cuánto dejó?».
- Migrar datos de Riveras.

## Tareas

- [ ] Migración + `schema.prisma` con las tres columnas.
- [ ] Shared: `damageLineSchema`, `checkinSchema`, `damageChargeOf`, totales y `RentalAgreement`,
      con tests en `money.spec.ts` y `agreements.spec.ts` (tope, sin tope, `UNDEFINED`, línea
      negativa → error).
- [ ] API: `checkin` calcula `damageCharge` con `damageChargeOf` y escribe las columnas; tests en
      `agreement.usecases.spec.ts` (ACCEPTED topado, DECLINED completo, garantía intacta).
- [ ] API: billing, reports y `domain/agreement.ts` pasan `fuelCharge` y `damageCharge` a
      `agreementTotals`; test en `rental-billing.usecases.spec.ts` de que se puede cobrar el saldo
      con daños.
- [ ] Web: `inspection-draft.ts` gana `fuelAmount` y `damageLines`; `checkinBody` los manda;
      tests en `inspection-draft.spec.ts`.
- [ ] Web: `fuel-gauge.tsx`, `damage-lines.tsx`, `car-3d-viewer.tsx` + `car-3d-scene.ts` con
      `import()` y respaldo 2D; montados en `handover-wizard.tsx` solo en `checkin`.
- [ ] Web: `accountLines` e `inspection-sheet.tsx` con los dos renglones; test en
      `agreement-format.spec.ts`.
- [ ] ADR-016 en `docs/ARCHITECTURE.md` pasa de «Propuesta» a vigente; `apps/web/AGENTS.md` y
      `apps/api/AGENTS.md` mencionan las columnas y el visor.
- [ ] `scripts/verify-126.sh` (como `verify-118.sh`): login, carro, cliente, renta ACCEPTED con
      deducible 500 y garantía 200, entrega, recepción con `fuelCharge` 25 y daños 650 →
      `damageCharge` `500.00`, `fuelCharge` `25.00`, total con los dos, `depositHeld` `200.00`;
      otra DECLINED → `650.00`; monto negativo → 422; sin sesión → 401.

## Always

- Dinero solo con `agreementTotals`, `discountCeiling` y `damageChargeOf` de `@elite/shared`.
- El API recalcula `damageCharge`; nunca lo toma del body.
- Densidad `bahia` y tablet contempladas en los tres pasos.

## Ask first

- Otra librería 3D, `@react-three/fiber` o un modelo `.glb` externo.
- Usar el indicador nuevo también en la entrega.
- Costo sugerido por pieza o precio por cuarto de tanque.

## Never

- Meter combustible o daños en `extraCharges`.
- Restar la garantía del saldo.
- Agregar ajustes nuevos en `rental-settings`.

## Verify

```bash
pnpm build && pnpm lint && pnpm test
API_BASE_URL=http://localhost:3200/api bash scripts/verify-126.sh
```
