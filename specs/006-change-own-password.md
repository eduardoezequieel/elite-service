# 006 — Cambio de contraseña propia

**Estado:** Aprobada
**Módulo:** `auth` (web + api) | **Depende de:** spec 001 terminada

> Aprobada con el plan del 2026-09-02: el usuario pide cambiar su clave desde el
> sistema. La spec 001 lo había dejado fuera (RN-10, *Fuera de alcance*).

## Contexto

En v1 solo un usuario con `users.manage` puede reemplazar la contraseña de
**otro**, vía `PATCH /users/:id`. El propio usuario no aparece en
`/settings/users`, así que el admin sembrado —y cualquiera— no puede cambiarse
la clave a sí mismo. Esta spec cierra ese hueco: cambio propio, pidiendo la
actual, desde el menú de cuenta.

No es un perfil editable. Solo la contraseña. El PIN de pista no entra.

## Historias

- Como usuario autenticado de oficina, quiero cambiar mi contraseña pidiendo la
  actual, para no depender de que otro con `users.manage` me la reemplace.
- Como cajero en tablet, quiero el mismo diálogo usable con el dedo, para
  cambiarla de pie en la bahía.

## Criterios de aceptación

- **Dado** un usuario con sesión de oficina, **cuando** elige «Cambiar
  contraseña» en el menú de cuenta, **entonces** se abre un diálogo con
  contraseña actual, contraseña nueva y repetir la nueva.
- **Dado** ese diálogo con la actual correcta y la nueva de al menos 8
  caracteres, coincidente en los dos campos, **cuando** confirma, **entonces** el
  API responde `204`, se escribe un JWT nuevo en la cookie, el diálogo se cierra,
  aparece el toast «Contraseña actualizada» y **sigue adentro**.
- **Dado** una sesión anterior al cambio (otra pestaña, otro navegador),
  **cuando** pide un endpoint protegido, **entonces** recibe `401` (RN-10: el
  `iatMs` del token es anterior a `passwordChangedAt`).
- **Dado** la actual incorrecta, **cuando** confirma, **entonces** recibe `401`
  `INVALID_CREDENTIALS` con el mensaje «La contraseña actual no es correcta.» y
  el error se imprime en el diálogo (`role=alert`), no en un toast.
- **Dado** una nueva de menos de 8 caracteres, **cuando** confirma, **entonces**
  recibe `422` `VALIDATION_ERROR` y el campo lo dice.
- **Dado** que las dos nuevas no coinciden, **cuando** confirma, **entonces** el
  cliente lo dice en el campo «Repetir» y **no** llama al API.
- **Dado** un request sin sesión a `POST /auth/password`, **cuando** llega,
  **entonces** responde `401`.
- **Dado** una sesión de pista, **cuando** pide `POST /auth/password`,
  **entonces** responde `401` (esta ruta es de oficina).
- **Dado** el cambio, **cuando** se inspecciona la respuesta, **entonces** no
  viaja `passwordHash` ni la clave en claro (RN-7).
- **Dado** un usuario con `users.manage`, **cuando** reemplaza la clave de
  **otro** con `PATCH /users/:id`, **entonces** sigue igual que en la spec 001:
  no pide la actual.

## Reglas de negocio

- **RN-1:** Solo la clave propia. El body no lleva `userId`; el sujeto sale de
  la sesión.
- **RN-2:** Hay que acertar la actual. Quien tiene `users.manage` sigue
  pudiendo resetear la de otro sin saberla (`PATCH /users/:id`, spec 001 RN-10).
- **RN-3:** Mismo hash y misma marca que al editar un usuario: bcrypt factor 12
  y `passwordChangedAt = now`.
- **RN-4:** Sin permiso nuevo. Con sesión de oficina alcanza.
- **RN-5:** Pista / PIN, afuera.
- **RN-6:** La clave nunca vuelve en la respuesta ni se loguea.
- **RN-7:** La sesión que acaba de cambiar recibe un JWT **nuevo**, emitido
  **después** de escribir `passwordChangedAt`. Comparación de spec 001 RN-10:
  `issuedAtMillis < passwordChangedAt` — igual no se rechaza, así que esta
  sesión sigue. Las demás mueren.

## Permisos

Ninguno. No se introduce ninguna clave `module.action`.

## Datos

Ninguno. Se reusa `User.passwordHash` y `User.passwordChangedAt`.

## API

Todos bajo el prefijo `/api`. Errores `{ code, message, details? }`.

| Método | Ruta              | Request                                      | Response                         | Errores                                              |
| ------ | ----------------- | -------------------------------------------- | -------------------------------- | ---------------------------------------------------- |
| POST   | `/auth/password`  | `{ currentPassword, newPassword }` (≥ 8)     | 204 + cookie nueva               | 401 `UNAUTHORIZED`, 401 `INVALID_CREDENTIALS`, 422   |

`PATCH /users/:id` no cambia.

## UI

- Ítem **Cambiar contraseña** en el menú de cuenta (`UserMenu`): pie del riel y
  barra inferior. Debajo del nombre, **arriba** de «Cerrar sesión».
- Diálogo: actual, nueva, repetir. Campos con `<FieldBox>`. Un primario:
  «Guardar». «Cancelar» es fantasma.
- Errores donde ocurren, `role=alert`. Toast solo si salió bien.
- Escritorio y densidad `bahia`. Bajo 900px el diálogo ya sube desde abajo.

## Fuera de alcance

- Recuperación por correo, 2FA, «olvidé mi contraseña».
- Editar nombre o correo propios.
- Forzar cambio al primer ingreso.
- PIN de pista.

## Tareas

- [x] Contrato en `@elite/shared`: `changePasswordSchema` y su tipo.
- [x] `apps/api`: puerto para persistir hash + marca, `ChangePasswordUseCase`,
      test en memoria, `POST /auth/password` que setea la cookie nueva.
- [x] `apps/web`: llamada, hook, diálogo, ítem en `UserMenu`.
- [x] `scripts/verify-006.sh` enlazado en Verificación.
- [x] Spec 001: el fuera de alcance de «cambio propio» apunta acá.

## Verificación

### Automática — `scripts/verify-006.sh`

Contra un stack levantado. Crea un usuario de prueba, cambia **su** clave (no
la del admin), comprueba actual mala, nueva corta, éxito, sesión vieja `401` y
sesión nueva `200`. Lo borra de la circulación al terminar (desactivar).

```bash
docker compose up -d
pnpm build && pnpm --filter @elite/api db:seed
pnpm dev
bash scripts/verify-006.sh
```

### Visual

Login de oficina, menú de cuenta → Cambiar contraseña. Actual mala. Cambio
bueno: toast, seguís adentro. Escritorio y densidad `bahia`.
