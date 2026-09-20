# 045 — Anular y deshacer cobro piden autorización

**Estado:** Terminada
**Módulo:** carwash + auth | **Depende de:** 003-carwash, 010-carwash-cash, 015-confirm-void

## Contexto

Hoy `Anular` y `Deshacer cobro` se esconden si al usuario le falta `carwash.void` /
`carwash.reverse`: el cajero no ve el botón y tiene que llamar a alguien que entre con su sesión.
El taller quiere lo contrario: el botón se ve siempre, pero no se ejecuta sin que un administrador
teclee sus credenciales ahí mismo. "Administrador" no existe en el código (RN-1 global): es quien
tenga la clave del permiso.

## Historias

- Como cajero con `carwash.read`, quiero ver `Anular` y pedirle al encargado que autorice en la
  misma pantalla, para no cederle mi sesión.
- Como administrador, quiero que todo lo que borra plata quede firmado con mi correo, para saber
  después quién autorizó qué.

## Criterios de aceptación

- **Dado** un usuario con `carwash.read` y sin `carwash.void`, **cuando** abre un lavado anulable,
  **entonces** ve el botón `Anular` habilitado.
- **Dado** el diálogo de anular, **cuando** escribe solo el motivo, **entonces** el destructivo
  queda deshabilitado hasta que correo y contraseña tengan valor, y no se llama al API.
- **Dado** el diálogo con motivo + credenciales de un usuario activo con `carwash.void`, **cuando**
  confirma, **entonces** el lavado queda anulado y la nota dice
  `Anulado: <motivo> (autorizó: <nombre del autorizante>)`.
- **Dado** credenciales de un usuario **sin** `carwash.void`, **cuando** confirma, **entonces** el
  API responde `403 AUTHORIZATION_FAILED`, el diálogo muestra el error con `role="alert"` y el
  lavado no cambia.
- **Dado** credenciales incorrectas o de un usuario desactivado, **cuando** confirma, **entonces**
  el mismo `403 AUTHORIZATION_FAILED` con el mismo texto; la sesión del que está adelante no se
  cierra ni se redirige a login.
- **Dado** un usuario que **sí** tiene `carwash.void`, **cuando** anula, **entonces** igual se le
  piden correo y contraseña (decisión del usuario, RN-3).
- Todo lo anterior vale igual para `Deshacer cobro` contra `carwash.reverse`, y su nota queda
  `Reverso: <motivo> (autorizó: <nombre>)`.

## Reglas de negocio

- **RN-1:** La autorización se evalúa contra la clave del permiso (`carwash.void`,
  `carwash.reverse`), nunca contra el nombre de un rol.
- **RN-2:** El autorizante debe estar activo y tener el permiso. Credenciales malas, usuario
  desactivado y permiso faltante salen por la misma puerta y con el mismo mensaje: no se revela
  cuál de los tres falló (mismo criterio que el login de la spec 001).
- **RN-3:** Se pide autorización **siempre**, incluso si el usuario logueado tiene el permiso.
- **RN-4:** Autorizar no abre sesión: no emite JWT, no toca la cookie, no cambia el usuario actual.
  El actor del evento de tiempo real sigue siendo el que está logueado.
- **RN-5:** La contraseña del autorizante no se guarda en ningún lado; solo viaja en el body de esa
  llamada. En la nota queda el nombre, no el correo ni el hash.
- **RN-6:** Para llegar a pedir autorización hace falta sesión con `carwash.read`. Un usuario sin
  ese permiso no ve la pantalla y el endpoint lo rechaza antes de mirar las credenciales.

## Permisos

No introduce claves nuevas. Cambia cómo se exigen dos existentes:

| Clave             | Antes                   | Ahora                                                     |
| ----------------- | ----------------------- | --------------------------------------------------------- |
| `carwash.void`    | permiso del que ejecuta | permiso del que **autoriza**; el que ejecuta, solo `read` |
| `carwash.reverse` | permiso del que ejecuta | permiso del que **autoriza**; el que ejecuta, solo `read` |

## Datos

Sin cambios de schema. La firma del autorizante va en la nota del ticket, igual que el motivo.

## API

Mismos endpoints, con un campo nuevo obligatorio en el body.

| Método | Ruta                           | Request                                          | Response | Errores                                                                                                           |
| ------ | ------------------------------ | ------------------------------------------------ | -------- | ----------------------------------------------------------------------------------------------------------------- |
| POST   | `/carwash/tickets/:id/void`    | `{ reason, authorization: { email, password } }` | `Ticket` | `422 VALIDATION_ERROR`, `403 FORBIDDEN` (sin `carwash.read`), `403 AUTHORIZATION_FAILED`, `409` los ya existentes |
| POST   | `/carwash/tickets/:id/reverse` | `{ reason, authorization: { email, password } }` | `Ticket` | idem, más `409 CASH_NOT_OPEN`                                                                                     |

`AUTHORIZATION_FAILED` es un código nuevo de `@elite/shared`. Es 403 y no 401 a propósito: un 401
lo lee el front como sesión vencida.

## UI

- `void-ticket-dialog.tsx` y `reverse-ticket-dialog.tsx`: debajo del motivo, un bloque
  **Autorización de un administrador** con `email` y `password`, ambos requeridos. El destructivo
  queda deshabilitado hasta que los tres campos tengan valor. El error del API se imprime en el
  diálogo con `role="alert"`, y los campos de credenciales se limpian tras un fallo.
- `ticket-detail-screen.tsx`: `canVoid` y `canReverse` pasan a depender de `carwash.read` (o sea,
  de que la pantalla se vea), no de `carwash.void` / `carwash.reverse`.
- Los dos diálogos son táctiles y respetan las densidades `mostrador` y `bahia`, como el resto
  (`apps/web/DESIGN.md`). El `password` usa `autoComplete="off"` y no autoenfoca.

## Fuera de alcance

- Autorizar con PIN de pista: los PINs son de empleados, no de usuarios de oficina.
- Una bitácora de auditoría aparte. La firma vive en la nota del ticket.
- Extender el patrón a otras acciones destructivas (borrar roles, desactivar usuarios).

## Tareas

- [x] `@elite/shared`: `authorizationSchema` (`email` + `password`), `authorization` obligatorio en
      `voidTicketSchema` y `reverseTicketSchema`, y `AUTHORIZATION_FAILED` en `errors.ts`.
- [x] `apps/api`: `AuthorizeActionUseCase` en `modules/auth/application` — busca por correo,
      verifica contraseña, exige activo y el permiso pedido; devuelve el nombre del autorizante.
- [x] `apps/api`: decorador `@RequireAuthorization(key)` en `common/auth/auth.decorators.ts`,
      `AuthorizationGuard` en `modules/auth/presentation`, registrado como `APP_GUARD` después de
      `PermissionsGuard`, y `@Authorizer()` para leerlo en el controller.
- [x] `apps/api`: los endpoints `void` y `reverse` pasan a `@RequirePermissions(carwash.read)` +
      `@RequireAuthorization(carwash.void | carwash.reverse)`.
- [x] `apps/api`: `voidWithReason` y `reverse` reciben el nombre del autorizante y lo escriben en
      la nota.
- [x] Tests: `authorize-action.usecase.spec.ts` (ok, contraseña mala, desactivado, sin permiso) y
      el guard; actualizar los specs de `ticket.usecases` por la firma nueva.
- [x] `apps/web`: campos de autorización en los dos diálogos y botones visibles con `carwash.read`.
- [x] `scripts/verify-045.sh`: anula con credenciales de admin (200 + nota firmada), con
      credenciales de un usuario sin el permiso (403 `AUTHORIZATION_FAILED`, ticket intacto) y sin
      `authorization` (422).
- [x] Actualizar `packages/shared/AGENTS.md` y `apps/api/AGENTS.md` con el patrón de autorización.

## Verificación

`pnpm lint && pnpm test && pnpm build` (corrido, en verde) y `scripts/verify-045.sh` con el stack
levantado (lo corre el usuario: necesita base y servidores).

Los `verify-003/004/009/037/041` ya mandaban `void` sin el bloque nuevo: se actualizaron en el
mismo commit para firmar con las credenciales del admin del `.env`.
