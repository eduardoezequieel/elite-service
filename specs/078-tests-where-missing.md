# 078 — Tests donde faltan: shared y casos de uso sin spec

**Estado:** Terminada (aprobada por chat, 27 sept 2026: «como veas que no se pateen todas, adelante»)
**Módulo:** shared + api | **Depende de:** —

## Task

`@elite/shared` tiene lógica testeable (`moneySchema`, `decimalQuantity`, `refinePaymentLine`,
`bankName`, `isPermissionKey`) y cero tests; el único test de `moneySchema` vive en el API. En el
API quedan cinco casos de uso sin spec propio. Se cubren con el mismo estilo que el resto.

## Done

- [x] Jest en `packages/shared` (ts-jest, `rootDir: src`, `.spec.ts`). `pnpm test` en la raíz lo
      corre. El `"test": "echo (sin tests todavia)"` desaparece.
- [x] `schemas.spec.ts`: `moneySchema` (acepta `'8.5'` → `'8.50'`, rechaza negativo, tres
      decimales y texto), `decimalQuantity`, `refinePaymentLine` (RN-4/5/6: suma exacta, un
      método por línea, `TRANSFER` exige cuenta). La suma exacta (059 RN-3) no vive en shared:
      la valida `ChargeUseCases` en el API y ya tiene su test. Suma `errors.spec.ts`
      (`isApiErrorCode`). Queda un `it.todo`: `moneySchema` redondea el **número** `8.555` a
      `'8.55'` en vez de rechazarlo como al texto; decidir en otra spec.
- [x] `permissions.spec.ts`: `isPermissionKey`, `listPermissionGroups` cubre todas las claves.
- [x] `banking/contracts.spec.ts`: `bankName` con código conocido y desconocido.
- [x] `apps/api/src/common/validation/money-schema.spec.ts` se mueve a shared (o se borra si
      queda duplicado). Movido a `schemas.spec.ts` y borrado del API.
- [x] Specs nuevos en el API: `auth/get-session.usecase`, `employees/create-employee.usecase`,
      `employees/list-employees.usecase`, `services/catalog.usecases`, `vehicles/vehicle.usecases`.
      Cada uno con su repositorio en memoria en `application/testing/`.
- [x] `roles/infrastructure/in-memory-role.repository.ts` se muda a `roles/application/testing/`
      como en los demás módulos; los specs de roles apuntan ahí.

## Always

- Tests contra implementaciones en memoria, nunca base ni red.

## Ask first

- Tests de componentes React en el web: el Jest actual es `testEnvironment: node` y `.spec.ts`
  solo. Cambiarlo es otra spec.

## Never

- Cambiar comportamiento de producción para que un test pase: si un test destapa un bug, se anota
  y se abre spec.

## Verify

`pnpm build && pnpm lint && pnpm test && [ -d packages/shared/src ] && ls packages/shared/src/*.spec.ts`
