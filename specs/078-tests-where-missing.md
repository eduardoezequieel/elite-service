# 078 — Tests donde faltan: shared y casos de uso sin spec

**Estado:** Borrador
**Módulo:** shared + api | **Depende de:** —

## Task

`@elite/shared` tiene lógica testeable (`moneySchema`, `decimalQuantity`, `refinePaymentLine`,
`bankName`, `isPermissionKey`) y cero tests; el único test de `moneySchema` vive en el API. En el
API quedan cinco casos de uso sin spec propio. Se cubren con el mismo estilo que el resto.

## Done

- [ ] Jest en `packages/shared` (ts-jest, `rootDir: src`, `.spec.ts`). `pnpm test` en la raíz lo
      corre. El `"test": "echo (sin tests todavia)"` desaparece.
- [ ] `schemas.spec.ts`: `moneySchema` (acepta `'8.5'` → `'8.50'`, rechaza negativo, tres
      decimales y texto), `decimalQuantity`, `refinePaymentLine` (RN-4/5/6: suma exacta, un
      método por línea, `TRANSFER` exige cuenta).
- [ ] `permissions.spec.ts`: `isPermissionKey`, `listPermissionGroups` cubre todas las claves.
- [ ] `banking/contracts.spec.ts`: `bankName` con código conocido y desconocido.
- [ ] `apps/api/src/common/validation/money-schema.spec.ts` se mueve a shared (o se borra si
      queda duplicado).
- [ ] Specs nuevos en el API: `auth/get-session.usecase`, `employees/create-employee.usecase`,
      `employees/list-employees.usecase`, `services/catalog.usecases`, `vehicles/vehicle.usecases`.
      Cada uno con su repositorio en memoria en `application/testing/`.
- [ ] `roles/infrastructure/in-memory-role.repository.ts` se muda a `roles/application/testing/`
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
