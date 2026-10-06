# 109 — Caja de renta por turnos, con el mismo componente que la caja del lavado

**Estado:** Terminada (aprobada por chat, 5 oct 2026)
**Módulo:** rental-billing (api) · `features/cash-shift` (web, nuevo) · `features/carwash`
(web, solo extracción) · `features/rental-billing` (web) · `@elite/shared` rentals/billing.ts,
contracts.ts | **Depende de:** 107, 010, 038, 054, 055. Corre en paralelo con 108 y 110.
**Única spec de la épica que toca `schema.prisma`.**

## Contexto

La 098 hizo de la caja de renta un reporte diario porque el dueño dijo (1 oct 2026) que «la caja
del carwash es diferente a la de renta de carros». El 5 oct 2026, viendo el prototipo, cambió de
idea: «para caja, quiero que usemos el mismo componente, estandarízalo». La caja de renta pasa a
ser un **turno con fondo, apertura, cobros y cierre con arqueo**, igual que la del lavado, y la
pantalla es **el mismo componente** React para los dos negocios, con datos separados (094: cada
negocio su caja).

## Historias

- Como dueño, quiero abrir la caja de renta con un fondo, cobrar las rentas del día y cerrarla
  contando el efectivo, para cuadrar igual que en el lavado.
- Como dueño, quiero que las dos cajas se vean y se manejen igual, para no aprender dos pantallas.

## Criterios de aceptación

### API

- **Dado** `POST /rentals/cash/open { openingFloat }` sin turno abierto, **entonces** 201 con la
  sesión `OPEN`; con uno abierto → 409 `CASH_ALREADY_OPEN`; `openingFloat < 0` → 422.
- **Dado** `POST /rentals/agreements/:id/payments` sin turno abierto, **entonces** 409
  `CASH_NOT_OPEN` («Abrí la caja para cobrar.»); con turno abierto, el pago guarda
  `cashSessionId` y suma al turno.
- **Dado** `POST /rentals/payments/:id/void` de un pago cuyo turno ya cerró, **entonces** 409
  `CASH_SESSION_CLOSED`; de un turno abierto, se anula y deja de sumar.
- **Dado** `POST /rentals/cash/close { countedCash, notes? }`, **entonces** la sesión queda
  `CLOSED` con snapshot `cashTotal`, `cardTotal`, `transferTotal`, `otherTotal`, `expectedCash =
openingFloat + cashTotal`, `differenceCash = countedCash - expectedCash`; sin turno → 409
  `CASH_NOT_OPEN`.
- **Dado** `GET /rentals/cash/current`, **entonces** la sesión abierta con sus totales en vivo y
  `paymentCount`, o `null`. `GET /rentals/cash/sessions` devuelve `Page<RentalCashSession>`
  (`?page&pageSize`, más reciente primero). `GET /rentals/cash/sessions/:id` devuelve la sesión y
  sus pagos con `detail: { contractNumber, plate, customerName }` más `reference` cuando lo haya.
- **Dado** `GET /rentals/cash?date=`, **entonces** ya no existe (404). `GET /rentals/receivables` y
  `GET /rentals/deposits` siguen igual.
- Todo con `rentals.charge`; 403 sin él. Códigos: `CASH_NOT_OPEN` y `CASH_ALREADY_OPEN` se
  **reutilizan** de `errors.ts`; `CASH_SESSION_CLOSED` es nuevo.

### Componente compartido (web)

- **Dado** `features/cash-shift/`, **entonces** contiene lo que hoy vive en
  `features/carwash/components/cash-*.tsx`, `close-cash-dialog.tsx`,
  `cash-session-detail-screen.tsx`, `cash-format.ts` y `hooks/use-cash.ts`, parametrizado por un
  `CashShiftAdapter`: `{ basePath: '/carwash/cash' | '/rentals/cash', permission, sessionHref:
(id) => string, countLabel: 'Lavados cobrados' | 'Cobros', renderDetail: (payment) =>
ReactNode }`. Las pantallas del lavado quedan como envoltorios de una línea que pasan su
  adaptador; **ningún** test ni `verify-010.sh` cambia de resultado.
- **Dado** `/rentals/cash`, **entonces** es `CashShiftScreen` con el adaptador de renta: «Caja»,
  «Cerrar caja», tarjeta «Fondo / Abrir caja» sin turno, bloque **Cobrado** con las cuatro tarjetas
  de método (siempre visibles, efectivo en `go`), bloque **Turno** (Fondo, Esperado, Cobros),
  tabla **Cobros de este turno** (Ref., Método, Monto, Detalle = placa + cliente, Hora) y
  **Historial** con el sello «Cuadra / Sobra / Falta». Sin «por usuario», sin «Abrió X».
- **Dado** la misma pantalla, debajo del turno, **entonces** dos bloques propios de la renta con
  el mismo lenguaje (`Card` + `DataTable`, total junto al título): **Quién me debe** (de
  `/rentals/receivables`: placa, cliente, monto, botón «Cobrar» que abre `PaymentDialog`) y
  **Garantías** (de `/rentals/deposits`: placa, cliente, monto, botón «Devolver» que abre
  `DepositReturnDialog`). Vacíos: «Nadie», «Ninguna».
- **Dado** `PaymentDialog` sin turno abierto, **entonces** muestra «Sin caja abierta» con enlace a
  Caja en lugar del formulario (lee `GET /rentals/cash/current`).
- Se borra `rental-cash-screen.tsx` y todo lo del reporte diario (`RentalCashReport`,
  `cashQuerySchema`, «Imprimir cierre», «por usuario»).

### Texto y densidad

- Los mismos vacíos que el lavado pero sin la frase de ayuda: «Todavía no hay cobros», «Todavía no
  hay cierres». Nada de subtítulos.
- `bahia`: idéntico al lavado (ya resuelto en 010/055).

## Reglas de negocio

- **RN-1:** Una caja de renta a la vez. Las tablas son distintas de las del lavado:
  `rental_cash_sessions` y `rental_payments.cash_session_id`; nada se comparte salvo el enum
  `PaymentMethod` y los códigos de error.
- **RN-2:** Un pago sin turno abierto no existe (409). Los pagos anteriores a esta spec quedan con
  `cashSessionId = null` y no entran a ningún turno.
- **RN-3:** Los totales del cierre son snapshot, como en 010. `OTHER` no entra a `expectedCash`
  (069 RN-7).
- **RN-4:** La garantía **no pasa por la caja**: se cobra y se devuelve sobre la renta como en la
  098, sin tocar el turno. (Ver «Ask first».)
- **RN-5:** El componente no sabe de qué negocio es: todo lo que difiere entra por el adaptador.
  Prohibido `if (business === 'rentals')` adentro de `features/cash-shift`.

## Permisos

Sin claves nuevas: `rentals.charge`.

## Datos

```
RentalCashSession   id, status CashSessionStatus, openedByUserId, openedAt,
                    openingFloat, closedByUserId?, closedAt?, countedCash?,
                    cashTotal?, cardTotal?, transferTotal?, otherTotal?,
                    expectedCash?, differenceCash?, notes?, createdAt, updatedAt
                    @@map("rental_cash_sessions")  índices: status, openedAt

RentalPayment       + cashSessionId String? @db.Uuid  → RentalCashSession, onDelete Restrict
```

Migración `rental_cash_sessions` con `prisma migrate dev` en local. Nunca en el VPS (ahí corre
`migrate deploy` en el deploy).

## API

| Método | Ruta                         | Request                         | Response                   | Errores                       |
| ------ | ---------------------------- | ------------------------------- | -------------------------- | ----------------------------- |
| GET    | `/rentals/cash/current`      | —                               | sesión `OPEN` o `null`     | 403                           |
| GET    | `/rentals/cash/sessions`     | `?page&pageSize`                | `Page<RentalCashSession>`  | 403                           |
| GET    | `/rentals/cash/sessions/:id` | —                               | sesión + pagos con detalle | 403, 404                      |
| POST   | `/rentals/cash/open`         | `{ openingFloat }` default 0.00 | sesión `OPEN`              | 403, 409, 422                 |
| POST   | `/rentals/cash/close`        | `{ countedCash, notes? }`       | sesión `CLOSED`            | 403, 409 `CASH_NOT_OPEN`, 422 |

`POST /rentals/agreements/:id/payments` suma 409 `CASH_NOT_OPEN`; `POST /rentals/payments/:id/void`
suma 409 `CASH_SESSION_CLOSED`.

## Contrato compartido

`rentals/billing.ts`: `RentalCashSession`, `RentalCashSessionDetail`, `RentalCashPayment`
(mismos campos que `CashSession`/`CashSessionDetail`/`CashSessionPayment` de `contracts.ts` más
`detail`), reutilizando `openCashSchema` y `closeCashSchema` de `schemas.ts`. `RentalPayment`
gana `cashSessionId: string | null`. Se borran `RentalCashReport` y `cashQuerySchema`.

## Convivencia con 107, 108 y 110

Esta spec es dueña de `features/cash-shift/**`, `features/carwash/components/cash-*`,
`close-cash-dialog.tsx`, `cash-session-detail-screen.tsx`, `features/carwash/hooks/use-cash.ts`,
`features/rental-billing/**` (**salvo** `agreement-billing-panel.tsx`, que borra la 108),
`rentals/billing.ts`, `schema.prisma`, `errors.ts` y el módulo `rental-billing` del API. No toca
`nav-items.ts`, `features/rentals/**`, `features/fleet*` ni `features/rental-reports`.

## Ask first

- Si el dueño quiere que la garantía en efectivo entre y salga del cajón (hoy RN-4 la deja
  fuera, como la 098).
- Si la caja de renta debe exigir turno también para devolver una garantía.

## Never

- Nunca compartir filas con `cash_sessions` ni `payments` del lavado.
- Nunca un cobro de renta fuera de un turno.
- Nunca lógica de negocio dentro de `features/cash-shift`.

## Fuera de alcance

- Cuentas bancarias en la renta; impresión del cierre; cobros por usuario.

## Tareas

- [x] `schema.prisma` + migración; shared `rentals/billing.ts`; `errors.ts`
      (`CASH_SESSION_CLOSED`).
- [x] API rental-billing: puertos y casos de uso de abrir/cerrar/actual/lista/detalle; `payments`
      exige turno y lo liga; `void` respeta el cierre; borrar el reporte diario; tests en memoria.
- [x] Web: extraer `features/cash-shift/` con `CashShiftAdapter`; envoltorios del lavado; tests
      de `cash-format` movidos.
- [x] Web: `rental-cash-screen.tsx` nuevo = `CashShiftScreen` + «Quién me debe» + «Garantías»;
      `PaymentDialog` con «Sin caja abierta»; `page.tsx` de `/rentals/cash` y
      `/rentals/cash/[id]`; borrar el reporte.
- [x] `scripts/verify-109.sh`: pago sin turno → 409; abrir → pago liga `cashSessionId`; cerrar →
      snapshot y diferencia; anular tras cierre → 409; 403 sin `rentals.charge`; `/rentals/cash?date`
      → 404. `scripts/verify-098.sh`: quitar el reporte diario. `bash scripts/verify-010.sh` pasa
      sin cambios.
- [x] `apps/web/AGENTS.md`: `features/cash-shift` es el único componente de caja; los negocios
      pasan adaptador.

## Verificación

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-010.sh && bash scripts/verify-098.sh && bash scripts/verify-109.sh`
