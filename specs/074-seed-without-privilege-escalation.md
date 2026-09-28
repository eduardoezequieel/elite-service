# 074 — El seed no reparte permisos a roles ajenos

**Estado:** Terminada (aprobada por chat, 27 sept 2026: «A me parece bien, adelante» — columna `isSystem`)
**Módulo:** api (prisma/seed.ts) | **Depende de:** 001 (RBAC)

## Task

`prisma/seed.ts` (paso 2) concede **todos** los permisos a **todos** los roles del usuario
`ADMIN_EMAIL`. La intención era mantener al día el rol de administrador aunque lo hayan renombrado.
El efecto es otro: si a ese usuario le asignan un rol limitado («Cajero»), ese rol pasa a tener todo
para todos sus miembros en el siguiente deploy. Un archivo, pero es seguridad: va con spec.

## Done

- [x] El seed sincroniza permisos solo en el rol que él mismo creó, identificado por algo que no
      dependa del nombre: columna `isSystem` (o `seedKey`) en `Role`, `true` únicamente para ese rol.
      Migración: marca el rol llamado `Administrator`/`Administrador` que ya exista.
- [x] Se elimina el bloque que recorre `envAdmin.roles` y llama `createMany` por cada uno.
- [x] El usuario `ADMIN_EMAIL` sigue quedando vinculado al rol del sistema si no tiene ninguno.
- [x] El rol del sistema no se puede borrar ni quedar sin `roles.manage` desde el API
      (`409 SYSTEM_ROLE_PROTECTED`, código nuevo en `@elite/shared`).
- [x] Test de aplicación: borrar o vaciar el rol del sistema → 409.
- [x] `scripts/verify-074.sh`: crea un rol «Cajero» con un permiso, se lo asigna al admin del
      `.env`, corre `db:seed` y comprueba que «Cajero» sigue con un solo permiso.

## Always

- El seed sigue siendo idempotente: correrlo dos veces deja la base igual.

## Ask first

- Si preferís sin columna nueva: fijar el nombre `Administrator` como no editable. Es más simple
  pero vuelve a depender del nombre.

## Never

- Tocar permisos de un rol que el seed no creó.
- Bajar permisos a nadie: el seed solo agrega, y solo en su rol.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-074.sh`
