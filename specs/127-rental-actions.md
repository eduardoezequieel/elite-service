# 127 — Acciones de la renta a la vista: extender, multa y cambiar carro

**Estado:** Aprobada — 19 oct 2026, en el chat: «media vez esten apruebalas y desarrollalas,
quiero todo en main». Excedente pagado al cambiar de carro: opción «A» del dueño (RN-5).
**Módulo:** `rentals`, `rental-billing`, `fleet` (web); `rentals`, `rental-billing` (api); `rentals/`
de `@elite/shared` | **Depende de:** 126 (piezas de recepción: indicador, líneas de daños, visor 3D,
`fuelCharge`/`damageLines`/`damageCharge`), 098, 108

## Contexto

En el detalle (`agreement-detail-screen.tsx`) hay un primario y el resto en «⋯»; «Dar más días»
vive ahí, y `SwapDialog` (`agreement-action-dialogs.tsx`) y `FineDialog`
(`rental-billing/components/fine-dialog.tsx`) existen pero nadie los monta. El cambio de carro de
hoy (`POST agreements/:id/swap`, `agreement.usecases.ts`) cierra sin inspección de regreso y abre
con `inspection: null` y el km del carro. El prototipo `docs/prototype/rental-actions.html`
(aprobado) pone todo a la vista y hace el cambio como Riveras (`cambioForm` → `checkinForm` →
`checkoutForm` en `docs/legacy/riveras-rent-a-car.html`).

## Historias

- Como dueño con `rentals.manage`, quiero extender, cambiar de carro y recibir desde botones
  visibles, para no buscar en «⋯».
- Como dueño con `rentals.charge`, quiero cargar una multa a la renta o, desde el carro, a quien lo
  tenía, para cobrarla o dejarla como gasto.

## Criterios de aceptación

- **Dado** una renta en curso a $35/día por 5 días, **cuando** la extiendo a 9 días sin tocar la
  tarifa, **entonces** `dailyRate` sigue `35.00` (no salta a la semanal).
- **Dado** «Cobrar ahora» marcado, **cuando** extiendo, **entonces** queda un pago por el monto
  escrito; sin marcar, solo sube el saldo.
- **Dado** una multa desde la renta con fecha fuera de su tramo, **cuando** la guardo,
  **entonces** 422 en `occurredAt`.
- **Dado** una multa desde el carro en una fecha sin renta, **cuando** la guardo, **entonces**
  `chargedToCustomer = false` y sale en `GET /fleet/expenses` como tipo `FINE`.
- **Dado** un cambio de carro con inspección de regreso y de salida, **cuando** se confirma,
  **entonces** la renta vieja queda `FINISHED` con `returnOdometerKm`, combustible y daños (126), y
  la nueva `IN_PROGRESS` con número de contrato nuevo, `pickupOdometerKm` del carro nuevo y la
  garantía retenida de la vieja.

## Reglas de negocio (decisiones del dueño, fijas)

- **RN-1 Botones:** en curso o atrasada: Recibir (primario), Extender, Multa, Cambiar carro y
  Cobrar (si hay saldo y `rentals.charge`). Devuelta: Cobrar o Devolver garantía como hoy, y Multa.
  En «⋯» quedan Editar, Cancelar, Imprimir contrato e Imprimir inspección. Cada botón se esconde sin
  su permiso.
- **RN-2 Extender:** se queda la tarifa pactada aunque pase de 7 o 30 días; el campo «Tarifa por
  día» viene lleno con ella y se puede editar. El API ya lo hace (`extend` solo cambia `dailyRate`
  si viene; no llama `rateForDays`): no cambia. Atajos +1, +2, +3 y +7 días. «Cobrar ahora» marcado
  por defecto con el monto agregado (`agreementTotals` después − antes) y el método; es un segundo
  pedido a `POST /rentals/agreements/:id/payments`, como la entrega (108): si el cobro falla, la
  extensión queda y se muestra el error. Sin marcar, solo sube el saldo. Si el carro está reservado
  después (409 `VEHICLE_UNAVAILABLE`), el aviso ofrece «Cambiar carro».
- **RN-3 Multa desde la renta:** carro y cliente fijos; solo fecha y hora, monto y de qué es. Se
  carga a esa renta (`chargeToCustomer: true`). La fecha tiene que caer en el tramo de la renta.
- **RN-4 Multa desde el carro:** carro fijo; con la fecha y hora, `GET /rentals/fines/resolve` dice
  quién lo tenía y se le carga. Sin renta, se guarda con `chargeToCustomer: false` y la 099 ya la
  lee como gasto «Multa» (`unchargedFines`, `prisma-automatic-expense.source.ts`). Sin interruptor.
- **RN-5 Cambiar carro**, tres pasos: **Recibir** el carro actual (fecha, km ≥ salida, indicador de
  combustible + monto, daños con las piezas de la 126, por qué: Falla/Choque/Extendió/Pidió otro +
  detalle) → **Entregar** el nuevo (carro libre en `[at, regreso)`, km, combustible, golpes y fotos
  como la entrega de hoy, tarifa) → **Listo** (resumen de las dos rentas). La vieja se cierra con
  esa inspección y sus cargos (tope de la 126 RN-3); la nueva abre con contrato nuevo por los días
  que faltan y la garantía retenida pasa a ella (`depositTransferredToId`, ya existe). El cambio no
  cobra. **Lo pagado de más pasa a la nueva** (decisión del dueño, 19 oct 2026, opción A): si lo
  pagado en la vieja supera su total al cerrar, el excedente sale de la vieja y entra a la nueva
  como pago, en la misma transacción, sin tocar caja (no es un cobro nuevo). Ejemplo: pagó $400
  por 10 días, cambia el día 4: la vieja queda en $160 pagados y saldo 0; la nueva, $240 pagados
  de $240. Si en la vieja queda deuda, se queda en ella.
- **RN-6 Tarifa del carro nuevo:** opciones «La misma» (por defecto, como Riveras y RN-2), «Del
  carro» (`rateForDays`) y «Otra». El web siempre manda `dailyRate`; sin él, el API usa la de la
  renta vieja (hoy usa `rateForDays`).

## Permisos

Sin claves nuevas: extender y cambiar con `rentals.manage`; multa y cobro con `rentals.charge`;
multa desde el carro además pide estar en la ficha (`fleet.read`).

## Datos

Sin migración (usa las columnas de la 126).

## API

| Método | Ruta                               | Request                                            | Response              | Errores                                 |
| ------ | ---------------------------------- | -------------------------------------------------- | --------------------- | --------------------------------------- |
| POST   | `/rentals/agreements/:id/swap`     | `swapSchema` nuevo (abajo)                         | `AgreementSwapResult` | 422, 409 `VEHICLE_UNAVAILABLE`, los de hoy |
| POST   | `/rentals/fines`                   | `createFineSchema` + `agreementId?`                | `RentalFine`          | 422 `occurredAt` fuera del tramo        |
| POST   | `/rentals/agreements/:id/extend`   | sin cambio                                         | `RentalAgreement`     | sin cambio                              |
| POST   | `/rentals/agreements/:id/payments` | sin cambio (lo usa «Cobrar ahora»)                 | sin cambio            | sin cambio                              |

- `swapSchema` (`agreements.ts`): `at`, `newVehicleId`, `dailyRate?`, `reason`, más
  `returnInspection: rentalInspectionSchema`, `chargeExtraKm` (default `true`), `fuelCharge`,
  `damageLines` (los de la 126) y `pickupInspection: rentalInspectionSchema`. Es un cambio de
  contrato: el body viejo responde 422.
- `swap` (use case) valida `returnInspection.odometerKm ≥ pickupOdometerKm` como `checkin`, calcula
  `extraKmCharge` y `damageCharge` igual que `checkin`. `SwapWrite` gana `closed: { inspection,
  extraKmCharge, fuelCharge, damageLines, damageCharge }`; `opened.checkout` recibe
  `pickupInspection` y su km. `PrismaAgreementRepository.swap` escribe todo en la misma
  transacción y sube el odómetro de los dos carros (`bumpOdometer`).
- `createFineSchema` (`billing.ts`) gana `agreementId?`. Con él, `RentalFineUseCases.create` exige
  que `occurredAt` caiga en el tramo de esa renta (`agreementHolding` sobre ese carro devuelve esa
  renta) o 422 `VALIDATION_ERROR` con `details.occurredAt`.

## UI

- `agreement-detail-screen.tsx`: botones de RN-1 en `ScreenHeader`; en `bahia` hacen fila con
  salto y objetivos de `--touch-min`.
- `ExtendDialog` rehecho: Regresaba (lectura) → Regresa, atajos, tarifa, nota, resumen Días ·
  Agrega · Saldo, «Cobrar ahora» con monto y método, total al pie. La cuenta pura en
  `features/rentals/extend-draft.ts`.
- Multa: `FineDialog` gana el modo renta (`agreementId`, sin selector de carro ni interruptor) y el
  modo carro (resuelve quién lo tenía y lo muestra, o «Sin renta · Gasto «Multa»»).
  `fine-form.ts` se ajusta. El modo carro se monta en `fleet-vehicle-frame.tsx`.
- `swap-wizard.tsx` reemplaza a `SwapDialog`: pantalla completa en tablet como `HandoverWizard`,
  pasos Recibir · Entregar · Listo; reutiliza `fuel-gauge.tsx`, `damage-lines.tsx` y
  `car-3d-viewer.tsx` (126) y el paso Golpes de la entrega. Al terminar navega a la renta nueva.

## Fuera de alcance

- Botón de WhatsApp.
- Programar un cambio para más adelante (Riveras «Programar cambio»): el cambio es al momento.
- `ReassignDialog` (sigue sin montar).
- Migrar datos de Riveras.

## Tareas

- [ ] Shared: `swapSchema` y `createFineSchema` nuevos, con tests en `agreements.spec.ts` y
      `billing.spec.ts`.
- [ ] API swap: use case, `SwapWrite`, repo y tests en `agreement.usecases.spec.ts` (inspecciones,
      km menor → 422, tope de daños, garantía pasa, tarifa por defecto = la vieja, excedente
      pagado pasa a la nueva y la caja no cambia).
- [ ] API extend: test de que pasar de 7 y de 30 días deja `dailyRate` igual.
- [ ] API multa: `agreementId` y su 422; tests en `rental-billing.usecases.spec.ts`.
- [ ] Web detalle: botones RN-1 y «⋯» reducido.
- [ ] Web extender: `extend-draft.ts` (+ spec), diálogo y cobro en segundo pedido.
- [ ] Web multa: modos renta y carro en `FineDialog`, `fine-form.spec.ts` al día, montaje en
      detalle y en `fleet-vehicle-frame.tsx`.
- [ ] Web cambio: `swap-wizard.tsx` + su borrador puro con spec; se borra `SwapDialog`.
- [ ] `apps/web/AGENTS.md` y `apps/api/AGENTS.md` al día.
- [ ] `scripts/verify-127.sh` (como `verify-118.sh`): extender a 9 y a 31 días deja la tarifa;
      extender + pago; multa con `agreementId` fuera del tramo → 422; multa del carro sin renta →
      `chargedToCustomer=false` y aparece en `/fleet/expenses`; swap con body viejo → 422; swap
      completo → vieja `FINISHED` con `returnOdometerKm`/`fuelCharge`/`damageCharge`, nueva con
      contrato nuevo, `pickupOdometerKm` y `deposit` = garantía retenida; sin sesión → 401.

## Always

- Reutilizar las piezas de la 126; no duplicar indicador, líneas ni visor.
- Dinero con `agreementTotals` y `damageChargeOf` de `@elite/shared`.
- El cambio de carro es una sola transacción.

## Ask first

- Cobrar dentro del cambio de carro.
- Cualquier traslado de excedente que no se pueda hacer sin tocar la caja o los turnos.
- Montar `ReassignDialog` o programar cambios a futuro.

## Never

- Botón o acción de WhatsApp en el detalle de la renta.
- Cambiar a la tarifa semanal o mensual al extender.
- Un segundo camino que escriba multas o pagos fuera de `rental-billing`.

## Verify

```bash
pnpm build && pnpm lint && pnpm test
API_BASE_URL=http://localhost:3200/api bash scripts/verify-127.sh
```
