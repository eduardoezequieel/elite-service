# 075 — Un solo catálogo de errores y permisos tipados

**Estado:** Borrador
**Módulo:** shared + api + web | **Depende de:** 001, 006

## Task

`apps/api/src/common/errors/api-error.ts` redefine `API_ERROR_CODES` y `ApiErrorResponse` como
«Fase 0, reemplazar después». Nunca se reemplazó: el filtro global usa la copia local, que ya
diverge (`TOO_MANY_REQUESTS` y `BAD_REQUEST` no existen en shared). Además, `ApiErrorResponse.code`
es `string` y `RequirePermissions(...string[])` / `can(...string[])` aceptan cualquier texto aunque
`ApiErrorCode` y `PermissionKey` ya existan. Se borra la copia y se usa el tipo en las dos puntas.

## Done

- [ ] `apps/api/src/common/errors/api-error.ts` desaparece. `all-exceptions.filter.ts` importa
      `API_ERROR_CODES`, `ApiErrorCode` y `ApiErrorResponse` de `@elite/shared`. La función que
      mapea status → código se queda en el filtro.
- [ ] `BAD_REQUEST` entra al catálogo compartido (lo emite el filtro para el request malformado).
      `TOO_MANY_REQUESTS` no: el filtro usa `TOO_MANY_ATTEMPTS`, que ya existe.
- [ ] `ApiErrorResponse.code: ApiErrorCode` en shared. `ApiError.code` del web
      (`lib/api.ts`) pasa a `ApiErrorCode`; un código desconocido que llegue del servidor se
      mapea a `INTERNAL_ERROR` en `apiFetch`, no se propaga como `string`.
- [ ] `RequirePermissions(...permissions: PermissionKey[])` y `RequireAuthorization(PermissionKey)`
      en el API. `can`, `canAny` y `permissions` de `usePermissions` y la prop `permission` de
      `RequirePermission` en el web usan `PermissionKey`. `permissionKeys`/`permissions` de los
      contratos de sesión, usuario y rol en shared pasan a `PermissionKey[]`.
- [ ] `grep -rn "code: 'NOT_FOUND'" apps/api/src` → 0 (el spec de performance usa el catálogo).
- [ ] `pnpm build` compila sin tocar ningún literal: si un permiso literal no compila, es un typo
      real y se corrige en la misma spec.

## Always

- Los códigos de error existentes no cambian de texto: son contrato con el web desplegado.

## Ask first

- Si el tipado destapa un permiso que no existe en `PERMISSIONS`, se agrega al catálogo, no se
  afloja el tipo.

## Never

- Un segundo catálogo en ninguna app, ni «temporal».

## Verify

`pnpm build && pnpm lint && pnpm test && ! grep -rn "errors/api-error" apps/api/src`
