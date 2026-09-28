# 084 — Errores de aplicación sin HTTP

**Estado:** Terminada (aprobada por chat, 27 sept 2026: «A»; cambia la convención 6 de `apps/api/AGENTS.md`)
**Módulo:** api | **Depende de:** 075

## Task

`application/` importa `@nestjs/common` en más de 30 archivos: los casos de uso lanzan
`ConflictException` / `UnprocessableEntityException`, es decir, deciden 409 vs 422. La convención
local lo permite, pero contradice el espíritu de la regla global 4 y hace que un caso de uso no se
pueda reusar fuera de HTTP (un job, un CLI, el seed). `stock-failure.ts` e `inventory-http-errors.ts`
ya muestran la alternativa: un error de aplicación y un mapa a HTTP en `presentation/`.

## Done

- [x] `common/errors/application-error.ts`: `class ApplicationError extends Error { code:
  ApiErrorCode; details?: unknown }` y subclases `NotFoundError`, `ConflictError`,
      `ValidationError`, `ForbiddenError`.
- [x] Los casos de uso lanzan `ApplicationError`; `grep -rln "@nestjs/common"
  apps/api/src/modules/*/application` → 0.
- [x] `AllExceptionsFilter` mapea `ApplicationError` → status por subclase (`NotFound` 404,
      `Conflict` 409, `Validation` 422, `Forbidden` 403) y `{ code, message, details? }`. Sigue
      siendo el único lugar que arma la respuesta.
- [x] `inventory-http-errors.ts` se muda a `presentation/` o desaparece si el filtro lo cubre.
      Desapareció la parte HTTP; queda `application/inventory-errors.ts` (dominio → `ApplicationError`).
- [x] Los specs de aplicación cambian `toThrow(ConflictException)` por `toThrow(ConflictError)`
      sin tocar aserciones de código ni mensaje.
- [x] `apps/api/AGENTS.md` convención 6 dice: «Lanzá `ApplicationError` desde `application/`;
      `HttpException` solo en `presentation/` y guards».
- [ ] Los `verify-NNN.sh` existentes pasan: mismos status y mismos códigos. Sin correr: el API no
      estaba levantado al cerrar.

## Always

- Un módulo por commit; `pnpm test` en verde en cada uno.

## Ask first

- **Toda la spec.** Es un cambio de convención, no un bug. Si preferís dejar `@nestjs/common` en
  aplicación, se cierra como «rechazada» y se anota el porqué en el ADR-002.

## Never

- Cambiar un status o un código existente: es contrato con el web.

## Verify

`pnpm build && pnpm lint && pnpm test && ! grep -rln "@nestjs/common" apps/api/src/modules/*/application`
