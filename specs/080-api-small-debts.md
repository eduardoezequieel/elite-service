# 080 — Deudas chicas del API

**Estado:** Borrador
**Módulo:** api | **Depende de:** 045, 065

## Task

Cinco cosas sueltas que no justifican una spec cada una pero sí quedar anotadas y cerradas juntas.

## Done

- [ ] `carwash.module.ts` deja de instanciar a mano `PrismaAuthUserRepository` y
      `BcryptPasswordHasher` para `PRICE_AUTHORIZER`: importa `AuthModule`, que exporta
      `AuthorizeActionUseCase`, y lo inyecta. Un cambio de hasher en auth no deja atrás a carwash.
- [ ] CORS en `main.ts`: `localhost`/`127.0.0.1` se aceptan solo si `NODE_ENV !== 'production'`.
      En producción, solo `WEB_ORIGIN`.
- [ ] `uniqueViolationOn` (`prisma-inventory.repository.ts`) compara `meta.target` como arreglo
      de columnas, no `JSON.stringify(meta).includes(field)`. Los dos `!= null` del mismo archivo
      pasan a `!== null`.
- [ ] Un helper `decimalToCents` / `decimalToMilli` en `common/prisma/` reemplaza el patrón
      `Decimal → toFixed → fromDecimalString` en los repositorios (más de 70 usos en 13 archivos).
- [ ] `jwt-auth.guard.ts` y `floor-auth.guard.ts` comparten la lectura de cookie y el armado de
      la sesión (`common/auth/session-cookie.ts`): una sola forma de leer la cookie.
- [ ] `assignedAt: new Date(now + index)` en `prisma-ticket.repository.ts` se reemplaza por una
      columna `position` en la relación lavado–lavador; migración conserva el orden actual.
- [ ] `ts-loader`, `tsconfig-paths`, `source-map-support` salen de `apps/api/package.json`;
      `@radix-ui/react-slot` de `apps/web/package.json`; `lucide-react` pasa a `^0.460.0`.

## Always

- Cada punto es un commit propio: se pueden revertir por separado.

## Ask first

- La columna `position`: si preferís no migrar, se queda el truco de fecha y se anota en
  `TROUBLESHOOTING.md`.

## Never

- Cambiar semántica de ningún endpoint.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-045.sh`
