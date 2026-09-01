# 001 — Autenticación y RBAC dinámico

**Estado:** En desarrollo
**Módulo:** `auth`, `users`, `roles` | **Depende de:** Fase 0 (completada) · spec 002 (sistema de diseño)

## Contexto

Todo el sistema requiere identificar quién usa la aplicación y qué puede hacer. No existen roles fijos en el código: los roles se crean a demanda desde la administración y agrupan permisos por módulo/pantalla. Esta spec introduce además la base de datos (Prisma + PostgreSQL), que hasta ahora no existía.

Toda la UI de esta spec se construye sobre el sistema de diseño de `apps/web/DESIGN.md` («El Catálogo de Piezas»), implementado por la **spec 002**. Las tareas de `apps/web` de esta spec **no empiezan hasta que 002 esté terminada**: si se construyen antes, las pantallas salen con los tokens de fábrica de shadcn/ui —el panel genérico que `DESIGN.md` rechaza por nombre— y hay que rehacerlas.

## Historias

- Como usuario del taller, quiero iniciar sesión con correo y contraseña, para acceder al sistema.
- Como usuario con permiso `users.manage`, quiero crear, editar y desactivar usuarios y asignarles roles, para controlar quién entra al sistema.
- Como usuario con permiso `roles.manage`, quiero crear roles y marcar qué permisos tiene cada uno por módulo/pantalla, para dar acceso a la medida de cada puesto.
- Como usuario autenticado, quiero ver solo las pantallas y acciones que mis permisos habilitan, para no encontrarme con opciones que no puedo usar.

## Criterios de aceptación

- **Dado** un usuario activo con credenciales válidas, **cuando** hace `POST /api/auth/login`, **entonces** recibe sesión iniciada (cookie httpOnly con JWT) y sus datos con la lista de permisos efectivos.
- **Dado** un usuario con credenciales inválidas o desactivado, **cuando** intenta login, **entonces** recibe `401` con code `INVALID_CREDENTIALS` (mismo mensaje en ambos casos, sin revelar cuál falló).
- **Dado** un request sin sesión válida a cualquier endpoint no público, **cuando** llega al API, **entonces** responde `401 UNAUTHORIZED`.
- **Dado** un usuario autenticado sin el permiso requerido por un endpoint, **cuando** lo invoca, **entonces** responde `403 FORBIDDEN` (nunca se valida por nombre de rol).
- **Dado** un usuario con `roles.manage`, **cuando** crea un rol "Recepción" con los permisos `work-orders.read` y `clients.manage` (cuando existan), **entonces** cualquier usuario con ese rol obtiene exactamente esos permisos en su siguiente request, sin necesidad de volver a iniciar sesión (RN-6b).
- **Dado** un usuario con `roles.manage`, **cuando** crea un rol sin ningún permiso, **entonces** el rol se crea igual (un rol vacío es válido) y sus permisos pueden asignarse o quitarse después vía edición, sin recrear el rol ni tocar a los usuarios que lo tengan.
- **Dado** un rol con usuarios asignados, **cuando** se intenta eliminarlo, **entonces** el API responde `409 CONFLICT` y el rol no se borra.
- **Dado** una base de datos vacía, **cuando** corre el seed, **entonces** existen el catálogo de permisos, un rol `Administrator` con todos los permisos y un usuario admin tomado de `ADMIN_EMAIL`/`ADMIN_PASSWORD` del `.env`.
- **Dado** un usuario sin el permiso de una pantalla, **cuando** navega la app web, **entonces** esa pantalla no aparece en la navegación y la ruta directa lo redirige.
- **Dado** un usuario con sesión iniciada, **cuando** hace `POST /api/auth/logout`, **entonces** recibe `204`, la cookie queda vacía y expirada, y el siguiente request a un endpoint protegido responde `401`.
- **Dado** el único usuario que tiene `roles.manage`, **cuando** intenta quitárselo —desasignándose el rol en `PATCH /users/:id` **o** quitándole la clave a ese rol en `PATCH /roles/:id`—, **entonces** el API responde `409 SELF_LOCKOUT` y nada cambia (RN-5).
- **Dado** un usuario con `users.manage`, **cuando** envía un `roleId` que no existe, **entonces** el API responde `422 INVALID_ROLE` con la clave inválida en `details`.
- **Dado** un usuario con `users.manage`, **cuando** reemplaza la contraseña de otro usuario, **entonces** las sesiones vigentes de ese usuario dejan de ser válidas en su siguiente request (RN-10).
- **Dado** cualquier pantalla de esta spec, **cuando** se inspecciona su estilo, **entonces** usa exclusivamente tokens de `DESIGN.md` y no contiene ningún color, radio, sombra ni duración literal (RN-11).
- **Dado** un usuario autenticado en `/settings/users`, **cuando** se renderiza la tabla, **entonces** su propio usuario no aparece en la lista para evitar que se edite a sí mismo desde este panel.
- **Dado** un usuario desactivado en la tabla de `/settings/users`, **cuando** se renderiza su fila, **entonces** lleva el sello `INACTIVO` y la regla de anulación sobre el nombre, y **no** se comunica bajando la opacidad ni tapando el correo y los roles.
- **Dado** un usuario en la bahía con una tablet, **cuando** abre `/login`, **entonces** la pantalla resuelve en densidad `bahía` y ningún objetivo interactivo es menor a 44×44.

## Reglas de negocio

- **RN-1:** La autorización se evalúa SIEMPRE por clave de permiso (`module.action`), nunca por nombre de rol. Los nombres de rol son datos, no lógica.
- **RN-2:** El catálogo de permisos vive en código (`packages/shared`, registro tipado). El seed lo sincroniza a la base; no se pueden asignar claves que no existan en el registro.
- **RN-3:** Los permisos efectivos de un usuario son la unión de los permisos de todos sus roles.
- **RN-4:** Los usuarios se desactivan (`isActive = false`), nunca se eliminan. Un usuario desactivado no puede iniciar sesión y sus sesiones vigentes dejan de ser válidas (verificación de `isActive` en cada request).
- **RN-5:** Anti-lockout, por **las dos puertas**. Un usuario no puede dejarse a sí mismo sin acceso ni sin `roles.manage`: ni (a) desactivándose o quitándose roles en `PATCH /users/:id`, ni (b) quitándole la clave `roles.manage` en `PATCH /roles/:id` a un rol que él mismo tiene. La evaluación es siempre sobre los **permisos efectivos resultantes** del solicitante, nunca sobre nombres de rol. En ambos casos: `409 SELF_LOCKOUT` y nada cambia.
- **RN-6:** Un rol con usuarios asignados no puede eliminarse.
- **RN-6b:** Los roles son 100% a demanda: se crean con o sin permisos, y sus permisos se agregan o quitan en cualquier momento. El cambio aplica a todos los usuarios del rol en su siguiente request autenticado (los permisos efectivos se resuelven contra la base, no quedan congelados dentro del JWT).
- **RN-6c:** Costo declarado de RN-6b. Resolver los permisos efectivos contra la base implica **una consulta de usuario + roles + permisos por cada request autenticado**. Es un costo aceptado para el volumen del taller (decenas de usuarios). En v1 **no se cachea**; si alguna vez se cachea, la invalidación debe ser inmediata ante cambios de roles, de permisos, de `isActive` o de contraseña, o se rompen RN-4, RN-6b y RN-10.
- **RN-7:** Contraseñas: mínimo 8 caracteres, hash con bcrypt (factor 12). Nunca se devuelven ni se loguean.
- **RN-8:** JWT firmado con `JWT_SECRET` del `.env`, expiración 8 horas (jornada laboral), entregado en cookie `httpOnly` + `SameSite=Lax`. Sin refresh tokens en v1.
- **RN-9:** El seed solo crea el usuario admin si la tabla de usuarios está vacía (idempotente y no destructivo).
- **RN-10:** Cambio de contraseña. En v1 **solo** un usuario con `users.manage` puede reemplazar la contraseña de otro, vía `PATCH /users/:id`; no hay cambio de contraseña propia. `User` lleva `passwordChangedAt`: todo JWT emitido antes de esa marca se rechaza con `401`, de modo que reemplazar una contraseña invalida las sesiones vigentes de ese usuario. Lo evalúa el mismo chequeo por request que ya verifica `isActive` (RN-4), sin costo adicional.
- **RN-11:** Toda la UI de esta spec cumple `apps/web/DESIGN.md`. Ningún componente escribe un color, radio, sombra o duración literal: solo tokens del sistema. Ningún estado se comunica solo con color.

## Permisos

Introducidos por esta spec (el catálogo crecerá con cada módulo futuro):

| Clave | Descripción |
|-------|-------------|
| `users.read` | Ver la lista y el detalle de usuarios |
| `users.manage` | Crear/editar/desactivar usuarios y asignarles roles |
| `roles.read` | Ver roles y sus permisos |
| `roles.manage` | Crear/editar/eliminar roles y asignarles permisos |

`POST /auth/login`, `POST /auth/logout` y `GET /auth/me` son públicos o solo requieren sesión, sin permiso.

## Datos

Primer schema de Prisma (`apps/api/prisma/schema.prisma`) + primera migración. Se activa `DATABASE_URL` en `.env`.

```
User           id (uuid), email (unique), passwordHash, passwordChangedAt, fullName, isActive (default true), createdAt, updatedAt
Role           id (uuid), name (unique), description?, createdAt, updatedAt
Permission     id (uuid), key (unique), description
UserRole       userId + roleId (PK compuesta)
RolePermission roleId + permissionId (PK compuesta)
```

Seed (`prisma/seed.ts`): sincroniza catálogo de permisos desde `@elite/shared`, crea rol `Administrator` con todos los permisos, crea admin desde env (solo si no hay usuarios).

## API

Todos bajo el prefijo `/api`. Errores en el formato común `{ code, message, details? }`.

| Método | Ruta | Request | Response | Errores |
|--------|------|---------|----------|---------|
| POST | `/auth/login` | `{ email, password }` | `{ user, permissions[] }` + cookie | 401 `INVALID_CREDENTIALS` |
| POST | `/auth/logout` | — | 204, limpia cookie | — |
| GET | `/auth/me` | — | `{ user, roles[], permissions[] }` | 401 |
| GET | `/users` | — | `User[]` (sin passwordHash) | 401/403 (`users.read`) |
| POST | `/users` | `{ email, fullName, password, roleIds[] }` | `User` | 409 `EMAIL_TAKEN`, 422 `INVALID_ROLE` |
| PATCH | `/users/:id` | `{ fullName?, password?, roleIds?, isActive? }` | `User` | 404, 422 `INVALID_ROLE`, RN-5 → 409 `SELF_LOCKOUT` |
| GET | `/roles` | — | `Role[]` con permisos | 401/403 (`roles.read`) |
| POST | `/roles` | `{ name, description?, permissionKeys[] }` | `Role` | 409 `NAME_TAKEN`, 422 claves inválidas |
| PATCH | `/roles/:id` | `{ name?, description?, permissionKeys? }` | `Role` | 404, 409 `NAME_TAKEN`, 422, RN-5 → 409 `SELF_LOCKOUT` |
| DELETE | `/roles/:id` | — | 204 | 409 `ROLE_IN_USE` (RN-6) |
| GET | `/permissions` | — | catálogo agrupado por módulo | 401/403 (`roles.read`) |

**Sin paginación en v1.** `GET /users`, `GET /roles` y `GET /permissions` devuelven la colección completa: el volumen esperado es de decenas de filas. Cuando alguna supere las 100 se pagina, en su propia spec.

Backend: guard global de JWT (con decorator `@Public()` para login/health) + `PermissionsGuard` con decorator `@RequirePermissions('users.read')`. Los casos de uso reciben repositorios por puerto; Prisma solo en `infrastructure`.

## UI

Todo lo de abajo se construye con los tokens, densidades y primitivas de la spec 002. Las
referencias entre corchetes apuntan a secciones de `apps/web/DESIGN.md`.

### `/login`

La **única pantalla del sistema sin riel de navegación**: una lámina centrada sobre papel, ancho
fijo 360px, con el logo arriba y el formulario debajo (correo, contraseña, botón primario).

- Formulario con react-hook-form + schema Zod de `@elite/shared`, textos en español.
- Error de credenciales: mensaje al pie del formulario en Sello Rojo, tomado de
  `ApiErrorResponse.message`. Los campos se marcan desde `details` [Components → Inputs].
- Debe funcionar en densidad `bahía`: se abre desde la tablet del taller.
- **Es la primera pantalla donde aparece el logo, y el logo no existe** (ver *Bloqueos*).

### Layout autenticado — el riel tabulado

Sustituye al "shell con sidebar" genérico. Riel izquierdo de 200px desplegado / 52px plegado,
pestañas en Label (caja normal), muesca de 3px en Naranja Elite sobre la activa —nunca un bloque de
fondo relleno—, y barra inferior de iconos bajo 768px [Components → Navigation].

- Una pestaña para la que el usuario no tiene **ningún** permiso `module.*` **no se renderiza**.
  Oculta ≠ deshabilitada: deshabilitado dice "no ahora", ausente dice "esto no es tuyo".
- Ruta directa sin permiso → redirige. Ruta sin sesión → redirige a `/login`.
- Se resuelve con `usePermissions()` y `<RequirePermission>`, siempre contra claves
  `module.action` (RN-1).
- Cabecera del riel: el logo, alto mínimo 24px.
- Encima del título de cada pantalla, el **rastro de ficha** (`PageBreadcrumb`):
  `Configuración › Usuarios` / `Configuración › Roles y permisos`. Label, caja
  normal, Grafito en los tramos previos y Tinta en el actual. No es una barra
  superior [Components → Breadcrumb].

### `/settings/users`

Tabla del sistema [Components → Tables], densidad `mostrador`. Visible con `users.read`;
las acciones requieren `users.manage`.

- Columnas: número de referencia · nombre · correo · roles · estado. Sin cebra, filete de 1px entre
  filas, sin sombra, cabecera en Label (caja normal).
- Estado con **`<Stamp>`**, no con `badge` relleno: `ACTIVO` en Sello Verde, `INACTIVO` en
  Grafito.
- El usuario desactivado lleva la **regla de anulación sobre el nombre**, no opacidad reducida y no
  una marca sobre la fila entera: el correo y los roles se leen limpios porque hacen falta para
  decidir si se lo reactiva.
- Diálogo crear/editar: nombre, correo, contraseña, selección de roles y activo/inactivo.
- Un usuario con `users.read` pero sin `users.manage` ve los campos **como texto plano, sin
  caja**, y no ve el botón de crear. Nunca un control muerto.
- El usuario autenticado no se muestra en la tabla para evitar que se edite a sí mismo desde este panel.
- Vacío: la tabla conserva su cabecera y una línea en Grafito dice qué falta.

### `/settings/roles` — pantalla firma

La matriz de permisos es una **tabla de referencias cruzadas módulo × acción**: exactamente lo que
la dirección «El Catálogo de Piezas» sabe hacer mejor. Se diseña como tal, no como una lista de
checkboxes sueltos.

- Tabla de roles (referencia · nombre · descripción · nº de usuarios) y diálogo crear/editar.
- En el diálogo, la matriz: los módulos son grupos de filas con su número de referencia, las acciones son
  columnas, y la casilla vive en el cruce. Cabeceras de columna en Label (caja normal), cifras
  tabulares, filete de 1px.
- El rol `Administrator` y cualquier rol con usuarios asignados muestran la regla de anulación sobre
  la acción de eliminar, con el motivo escrito (RN-6).
- Visible con `roles.read`; acciones con `roles.manage`.

### Errores y confirmaciones

**No se usa `sonner`.** `DESIGN.md` no define un toast, y en este sistema los errores viven donde
ocurren: el `message` de `ApiErrorResponse` va al pie del formulario y `details` marca los
campos. Las confirmaciones destructivas van en diálogo, con el botón destructivo relleno en Sello
Rojo **solo dentro del diálogo**, nunca en la fila [Components → Buttons]. Si más adelante hace
falta un toast, se define primero en `DESIGN.md`.

### Componentes

La spec 002 ya agrega y realinea al sistema: `button`, `input`, `label`, `table`, `badge`,
`card`, `separator`, `dropdown-menu`, `dialog`, más `<Reference>` y `<Stamp>`.

Esta spec agrega solo: `form`, `checkbox`, `switch`.

### Bloqueos

**Falta el archivo del logo.** No existe SVG ni PNG en alta (ver `PRODUCT.md` → *Evidence on
Hand*). `/login` y la cabecera del riel lo necesitan, así que deja de ser un pendiente "para
producción" y pasa a ser **bloqueante de esta spec**: hay que pedirle el vectorial al taller. Si no
llega a tiempo se implementa un reservado del tamaño correcto, marcado como provisional en el
código, y se abre una tarea de reemplazo.

## Fuera de alcance

- Refresh tokens / rotación de sesión, "recordarme", expulsión de sesiones activas en tiempo real.
- Recuperación de contraseña por correo, 2FA.
- Auditoría de accesos y rate limiting.
- Perfil de usuario editable por sí mismo, **incluido el cambio de contraseña propia**: en v1 solo
  un usuario con `users.manage` puede reemplazar contraseñas (RN-10). Queda para una spec posterior.
- Toasts / notificaciones flotantes: no están definidos en `DESIGN.md` y esta spec no los introduce.
- El logo definitivo y cualquier trabajo de identidad de marca.

**Riesgos aceptados en v1**, registrados para no descubrirlos después: sin rate limiting ni bloqueo
por intentos fallidos, el login queda expuesto a fuerza bruta desde la red interna; y el admin
sembrado vive con la contraseña de `ADMIN_PASSWORD` hasta que alguien con `users.manage` se la
cambie, porque no hay recuperación por correo ni cambio forzado al primer inicio de sesión.

## Verificación

### Automática — `scripts/verify-001.sh`

Recorre los criterios de aceptación del API contra un stack levantado de verdad: base sembrada y
API en marcha. Son **49 comprobaciones** — login y sesión, permisos efectivos, RN-4, RN-5 por sus
dos puertas, RN-6, RN-6b, RN-7, RN-8, RN-9, RN-10 y logout. Crea un rol y un usuario con sufijo
`E2E` y los borra al terminar. Sale con código 1 si algo falla.

```bash
docker compose up -d
pnpm build && pnpm --filter @elite/api db:seed
pnpm dev                      # en otra terminal
bash scripts/verify-001.sh
```

No reemplaza a `pnpm test`: aquellos son unitarios con repositorios en memoria, este prueba el
sistema armado — Prisma, guards, cookies, HTTP.

### Visual — verificada en el navegador

Hecha con Chrome sin ventana, manejado por el protocolo de DevTools: se inyecta la cookie de
sesión, se fija tema y densidad, se navega y se captura. Sirve para repetirla sin depender de que
alguien se acuerde de mirar.

**`/login`** — tema claro y oscuro, y densidad `bahía` en ancho de tablet:

- [x] Lámina centrada sobre papel, sin riel. El reservado del logo se ve como lo que es: un marco
      punteado que dice «Logo pendiente».
- [x] En `bahía` los campos y el botón miden 48px de alto (salen de `--control-h`), por encima del
      mínimo táctil de 44.
- [x] Con credenciales malas el error sale al pie: «Correo o contraseña incorrectos.», en
      `oklch(0.52 0.19 25)` — Sello Rojo, tomado del `ApiErrorResponse`.

**`/settings/users`** — tema claro y oscuro, con datos de verdad:

- [x] La fila del propio usuario no aparece.
- [x] El usuario inactivo lleva el sello `INACTIVO` **y** la regla de anulación sobre el nombre. No se
      comunica bajando la opacidad.
- [x] En `bahía` las filas y el riel crecen de forma visible: la diferencia de densidad es real,
      no cosmética.

**`/settings/roles`** — tema claro y oscuro:

- [x] La matriz módulo × acción se lee de un vistazo, con «Marcar todo / Quitar todo» por fila y
      la nota de que el guion (—) es una acción que el módulo no tiene, no una casilla vacía.
- [x] Un rol con usuarios muestra el borrado anulado por su propio verbo («~~Eliminar~~ lo tienen 2
      usuarios»), no con un botón apagado.

**Anti-lockout desde la UI (puerta b de RN-5):**

- [x] Editar el rol propio, destildar «Administrar» en Roles y permisos y guardar: el diálogo
      muestra «Ese cambio te dejaría sin la administración de roles, así que no se aplicó.» en
      Sello Rojo, y los permisos del admin quedan intactos.

**En los dos temas:** el papel es papel y la microficha es microficha; nada queda gris sobre gris
ni pierde contraste.

#### Hallazgo resuelto: la trama de bloqueo tapaba el dato

La verificación visual encontró que la trama diagonal de 45° se dibujaba **encima del texto** de la
fila, no detrás: el correo de un usuario inactivo quedaba rayado y costaba leerlo, y en tema oscuro
era peor. Cumplía la regla —el estado no dependía del color— pero peleaba contra la razón por la
que este sistema usa Atkinson Hyperlegible.

Se reemplazó por la **regla de anulación** (`.is-ruled-out`): una línea de 1px en color de Regla
trazada sobre **el dato que dejó de valer**, no sobre el contenedor. En la tabla de usuarios se raya
el nombre y el correo se lee limpio; en la tabla de roles se anula el verbo de la acción
(«~~Eliminar~~ lo tienen 2 usuarios»). Sigue habiendo dos canales sin color —la raya y la palabra
del sello—, sigue siendo una marca en positivo y ya no tapa nada que haga falta leer.

El cambio bajó a `DESIGN.md` → Shapes, a `apps/web/AGENTS.md` y a la spec 002, que es donde vive la
utilidad.


## Tareas

- [x] `packages/shared`: registro tipado de permisos (`PERMISSIONS` por módulo) y schemas Zod (`loginSchema`, `createUserSchema`, `updateUserSchema`, `createRoleSchema`, `updateRoleSchema`) con types derivados.
- [x] `apps/api`: instalar Prisma, `schema.prisma` con las 5 tablas, migración inicial, `seed.ts` idempotente (RN-9), scripts `db:migrate` / `db:seed`.
- [x] `apps/api`: módulo `auth` en 4 capas (login/logout/me, bcrypt, JWT en cookie httpOnly, guard global + `@Public()`), con el chequeo por request de `isActive` y `passwordChangedAt` vs `iat` (RN-4, RN-10).
- [x] `apps/api`: `PermissionsGuard` + decorator `@RequirePermissions()` (evalúa por unión de permisos, RN-1/RN-3).
- [x] `apps/api`: módulo `users` (list/create/update con roles, RN-4/RN-5) validado con Zod compartido.
- [x] `apps/api`: módulo `roles` (CRUD + asignación de permisos, RN-2/RN-6) con la segunda puerta del anti-lockout en `PATCH /roles/:id` (RN-5, puerta b), y endpoint `GET /permissions`.
- [x] `apps/api`: tests unitarios con repositorios en memoria: login (ok, credenciales malas, usuario inactivo), guard de permisos (con/sin permiso), RN-5 por sus dos puertas, RN-6 y RN-10 (JWT anterior a `passwordChangedAt` → 401).
- [x] **Requisito previo:** spec 002 terminada. Ninguna tarea de `apps/web` de esta lista empieza antes.
- [x] `apps/web`: agregar `form`, `checkbox` y `switch` de shadcn y alinearlos al sistema (altura por densidad, radio del sistema, sin sombra, anillo de foco en Naranja Elite).
- [x] `apps/web`: pantalla `/login` como lámina centrada sin riel, con errores al pie desde `ApiErrorResponse`; contexto de sesión (`/auth/me` con TanStack Query) y redirección de rutas protegidas.
- [x] `apps/web`: `usePermissions()` + `<RequirePermission>` y el **riel tabulado** condicionado por permisos (pestaña sin permiso = no renderizada).
- [x] `apps/web`: pantalla `/settings/users` (tabla del sistema con `<Reference>` y `<Stamp>`, regla de anulación en inactivos, diálogo crear/editar, campos como texto plano sin `users.manage`).
- [x] `apps/web`: pantalla `/settings/roles` (tabla de roles + matriz de referencias cruzadas módulo × acción en el diálogo).
- [x] `.env.example`: agregar `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, descomentar `DATABASE_URL`.
- [x] Actualizar AGENTS.md afectados (api: convención de guards/permisos; web: convención de `<RequirePermission>`) en el mismo commit.
- [x] Verificar RN-11: correr `node <skill>/scripts/detect.mjs --json apps/web/src` y resolver lo mecánico; confirmar que ninguna pantalla usa color, radio, sombra o duración literal.
- [x] Verificar las dos pantallas de `/settings` en tema claro y oscuro, y `/login` además en densidad `bahía`. Hecho con Chrome sin ventana por el protocolo de DevTools (13 capturas + dos interacciones); el detalle está en *Verificación → Visual*. **Parte estática:** `pnpm build`, `pnpm lint` y `pnpm test` (56 tests) limpios; auditoría RN-11 sin un solo color, radio, sombra ni duración literal en `apps/web/src`; los dos juegos de tokens (`:root` y `.dark`) están completos, y todo control interactivo de `/login` sale de `--control-h`, que en `bahía` vale 48px (mínimo táctil de 44 cumplido). Queda anotado un hallazgo de legibilidad, abajo.
- [x] Verificación end-to-end manual: seed → login admin → crear rol → crear usuario con ese rol → login con el nuevo usuario → ve solo lo permitido. Automatizada en `scripts/verify-001.sh`: 49 comprobaciones, 0 fallas. Cubre además RN-4, RN-6, RN-6b (permisos frescos en la misma sesión, sin volver a iniciar), RN-7, RN-8 (cookie `HttpOnly` + `SameSite=Lax` + 8 h), RN-9 (seed re-corrido sin duplicar el admin) y RN-10.
- [x] Verificación de anti-lockout (RN-5) por las dos puertas: ambas responden `409 SELF_LOCKOUT` y nada cambia (`scripts/verify-001.sh`, sección 7). La puerta (a) —`PATCH /users/:id` quitándose los roles o desactivándose— se verifica **contra el API**, no desde `/settings/users`: esa pantalla oculta la fila del propio usuario por criterio de aceptación, así que la puerta (a) no es alcanzable desde la UI y el guard del API es el único camino. La puerta (b) —`PATCH /roles/:id` quitando `roles.manage` al rol propio— sí es alcanzable desde `/settings/roles`, y queda en la checklist visual.
- [ ] Pedir el logo vectorial al taller; si no llega, dejar el reservado marcado como provisional y abrir la tarea de reemplazo.
- [x] Reemplazar la trama de bloqueo de 45° por la regla de anulación (`.is-ruled-out`): la trama tapaba el dato que hay que leer para resolver el bloqueo (ver *Verificación → Hallazgo resuelto*). Bajado a `DESIGN.md`, `apps/web/AGENTS.md` y la spec 002 en el mismo commit.
