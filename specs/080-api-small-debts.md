# 080 — Deudas chicas del API

**Estado:** Terminada (aprobada por chat, 27 sept 2026: sin columna `position`)
**Módulo:** api | **Depende de:** 045, 065

## Task

Cinco cosas sueltas que no justifican una spec cada una pero sí quedar anotadas y cerradas juntas.

## Done

- [x] `carwash.module.ts` deja de instanciar a mano `PrismaAuthUserRepository` y
      `BcryptPasswordHasher` para `PRICE_AUTHORIZER`: importa `AuthModule`, que exporta
      `AuthorizeActionUseCase`, y lo inyecta. Un cambio de hasher en auth no deja atrás a carwash.
- [x] CORS en `main.ts`: `localhost`/`127.0.0.1` se aceptan solo si `NODE_ENV !== 'production'`.
      En producción, solo `WEB_ORIGIN`.
- [x] `uniqueViolationOn` (`prisma-inventory.repository.ts`) compara `meta.target` como arreglo
      de columnas, no `JSON.stringify(meta).includes(field)`. Los dos `!= null` del mismo archivo
      pasan a `!== null`. Vive en `common/prisma/unique-violation.ts` (073). Con Prisma 7 y
      `@prisma/adapter-pg` no llega `meta.target`: las columnas salen de
      `meta.driverAdapterError.cause.constraint` (`fields` o el nombre del índice).
- [x] Un helper `decimalToCents` / `decimalToMilli` en `common/prisma/` reemplaza el patrón
      `Decimal → toFixed → fromDecimalString` en los repositorios (más de 70 usos en 13 archivos).
      Hecho en los 31 usos compuestos (10 archivos); el `toFixed(n)` que va directo a una
      cadena del DTO queda como está, no pasa por el dominio.
- [x] `jwt-auth.guard.ts` y `floor-auth.guard.ts` comparten la lectura de cookie y el armado de
      la sesión (`common/auth/session-cookie.ts`): una sola forma de leer la cookie.
- [x] `assignedAt: new Date(now + index)` en `prisma-ticket.repository.ts` desaparece: desde la
      035 un lavado tiene 0 o 1 asignado, así que no hay orden que guardar y `assignedAt` es la hora
      real. La lectura sigue ordenando por `assignedAt` para los lavados viejos con varios (009).
      Sin columna nueva ni migración (decidido por chat, 27 sept 2026).
- [x] `ts-loader`, `tsconfig-paths`, `source-map-support` salen de `apps/api/package.json`;
      `@radix-ui/react-slot` de `apps/web/package.json`; `lucide-react` queda fijo en `^1.37.0`
      (era un `>=0.460.0` abierto; el lock sigue en 1.37.0).

## Always

- Cada punto es un commit propio: se pueden revertir por separado.

## Ask first

- Nada pendiente: el orden de lavadores se resolvió por chat (sin columna).

## Never

- Cambiar semántica de ningún endpoint.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-045.sh`
