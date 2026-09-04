# Review Opus — cierre UX audit (012–023)

HEAD: 8255ef7
Modelo: claude-opus-5 (Claude Opus 5)

## Veredicto

Se puede revisar en local: `pnpm lint`, `pnpm test` (249 tests) y `pnpm build` pasan limpios, y
41 de los 42 hallazgos en alcance están cerrados en el árbol de hoy con código, no solo con la
casilla marcada de la spec. Hay un GAP real: el hallazgo 09 —buscar el vehículo por placa— está
cableado entero pero **nunca encuentra nada**, porque el cliente busca con la placa sin guion y la
base la guarda con guion (`P123-456`). Ese fallo arrastra un segundo defecto de datos: cada 409 de
placa conocida deja un cliente creado de más. Hay además dos bugs de dinero/estabilidad
(precio rancio al cambiar el tipo de carro en la edición, y hooks condicionales en
`/settings/users`). Nada de esto bloquea la revisión local; sí conviene arreglarlo antes de que
alguien confíe en la búsqueda de placa.

## Hallazgos 01–44

| #   | Veredicto     | Evidencia                                                                                            | Nota                                                                                     |
| --- | ------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 01  | DONE          | `apps/web/src/features/carwash/components/ticket-summary.tsx:127`; `ticket-form.tsx:356`             | Barra fija bajo 1180px, y el `form` reserva su alto con `env(safe-area-inset-bottom)`.   |
| 02  | DONE          | `apps/web/src/features/floor/components/floor-queue.tsx:50`                                          | Buscador con debounce; los chips de estado no los pidió la spec 014.                     |
| 03  | DONE          | `apps/web/src/features/carwash/hooks/use-tickets.ts:57`; `features/floor/hooks/use-floor.ts:108`     | 15s en las dos filas + renglón «se actualiza sola» (`tickets-screen.tsx:323`).           |
| 04  | DONE          | `apps/api/src/modules/carwash/domain/work-order.ts:10,21`; `ticket-status-stamp.tsx:18`              | `WASHING` en enum, transiciones, Stamp y pista.                                          |
| 05  | DONE          | `apps/web/src/features/carwash/components/ticket-detail-screen.tsx:225,233`                          | `VoidTicketDialog` con motivo obligatorio.                                               |
| 06  | DONE          | `apps/api/src/modules/carwash/presentation/carwash-tickets.controller.ts:154`; `ticket.usecases.ts:254` | `carwash.reverse`, solo del turno abierto.                                            |
| 07  | DONE          | `apps/web/src/features/catalog/components/catalog-screen.tsx:112`; `categories-screen.tsx:50`        | Crear servicio y categoría, con `useCreateService`/`createCategory` ya usados.           |
| 08  | DONE          | `ticket-detail-screen.tsx:178`; `features/carwash/components/edit-ticket-dialog.tsx:1`               | Solo en `OPEN` y con `carwash.manage`.                                                   |
| 09  | **GAP**       | `apps/web/src/features/carwash/hooks/use-vehicle-search.ts:65`; `apps/api/.../prisma-vehicle.repository.ts:61` | Busca `P123456`, la base guarda `P123-456`: nunca hay match. Ver Issue 1.       |
| 10  | DONE          | `apps/api/src/modules/carwash/application/ticket.usecases.ts:407`                                    | 409 `VEHICLE_PLATE_EXISTS` con `details.vehicle`; ya no pisa la ficha.                    |
| 11  | DONE          | `apps/web/src/features/carwash/components/tickets-screen.tsx:352`                                    | Buscador por placa, número y cliente, resuelto en el API.                                |
| 12  | DONE          | `tickets-screen.tsx:191,327`                                                                          | Selector de día + `?date=` en la URL. El día lo corta la zona del proceso: Issue 5.      |
| 13  | DONE          | `apps/web/src/features/carwash/components/charge-dialog.tsx:68`                                      | `useState<PaymentMethod>('CASH')`, y `close()` lo devuelve a Efectivo.                    |
| 14  | DONE          | `charge-dialog.tsx:115-143`                                                                           | «Abrir caja y seguir» dentro del mismo diálogo.                                          |
| 15  | DONE          | `apps/web/src/features/carwash/ready-undo.ts:7`; `components/toast-provider.tsx:46`                  | Deshacer en el aviso, 5s, en las cuatro pantallas.                                       |
| 16  | DONE          | `apps/web/src/features/carwash/washers.ts:25`; `floor-queue.tsx:124`                                 | La pista nombra a todos; el «+1» queda solo en la tabla de oficina.                      |
| 17  | OUT_OF_SCOPE  | —                                                                                                     | Refutado en `UX_AUDIT_VERIFIED.md`. Los tiempos igual se pintan (`wait.ts`).             |
| 18  | DONE          | `apps/web/src/components/app-shell/nav-bottom-bar.tsx:21,46`                                          | 4 fijos + «Más» con resto, densidad, tema y usuario.                                     |
| 19  | DONE          | `apps/web/src/components/ui/data-table.tsx:142,230`                                                   | Corte a `min-[1100px]`.                                                                  |
| 20  | DONE          | `tickets-screen.tsx:565,589,600,630`                                                                  | Sin `size="sm"`: alto `--control-h`.                                                     |
| 21  | DONE          | `apps/web/src/features/floor/components/floor-shell.tsx:83`                                           | Diálogo «¿Salir de la pista?».                                                           |
| 22  | DONE          | `apps/web/src/features/customers/components/vehicle-dialog.tsx:43`; `customer-detail-screen.tsx:73`  | Crear y editar carro desde la lámina Carros.                                             |
| 23  | DONE          | `ticket-detail-screen.tsx:160`; `apps/web/src/app/globals.css:644`                                    | `window.print()` en `PAID` y hoja de impresión que apaga riel, avisos y botones.         |
| 24  | DONE          | `use-vehicle-search.ts:20`; `ticket-form.tsx:380`                                                     | Máscara `A000-000` real. `inputMode="text"` es nominal (la placa lleva letra).           |
| 25  | DONE          | `apps/web/src/components/app-shell/nav-rail.tsx:162`; `components/density-menu.tsx:21`               | Densidad fijable desde el riel y desde «Más», persistida en `localStorage`.              |
| 26  | DONE          | `catalog-screen.tsx:248`; `employees-screen.tsx:152`                                                  | Aparece «Ver». Los campos siguen siendo controles muertos: Issue 6.                      |
| 27  | DONE          | `tickets-screen.tsx:328,398`; `customers-screen.tsx:80,111`; `employees-screen.tsx:84,114`           | Cabecera y vacío son mutuamente excluyentes en las seis listas.                          |
| 28  | DONE          | `employees-screen.tsx:142`; `users-table.tsx:100`; `cash-difference-stamp.tsx:19`                     | `Activo` y `Cuadra` pasaron a `queue`; ya no hay `tone="go"` fuera de «Listos».          |
| 29  | DONE          | `catalog-screen.tsx:163`                                                                              | `emptyAction` con «Nuevo servicio».                                                      |
| 30  | DONE          | `use-vehicle-search.ts:21`; `ticket-summary.tsx:56`                                                   | Cero `text-transform`/`uppercase`: el valor viaja ya en mayúsculas.                      |
| 31  | OUT_OF_SCOPE  | —                                                                                                     | Refutado en `UX_AUDIT_VERIFIED.md`.                                                      |
| 32  | DONE          | `nav-rail.tsx:107,124`                                                                                | `aria-label={label}` y el texto en `sr-only` al plegar; ya no depende del `title`.       |
| 33  | DONE          | `catalog-screen.tsx:3,362`; `employees-screen.tsx:3,231`                                              | `zodResolver` sobre `createServiceSchema` / `createEmployeeSchema` de `@elite/shared`.   |
| 34  | DONE          | 11 `useForm` con `mode: 'onChange'` (p. ej. `employees-screen.tsx:232`, `user-form.tsx:150`)         | No queda ninguno en el modo por defecto.                                                 |
| 35  | DONE          | `apps/web/src/components/ui/deactivate-confirm-dialog.tsx:19`; `employees-screen.tsx:457`; `user-dialog.tsx:99`; `customer-detail-screen.tsx:270` | Diálogos hermanos, no anidados dentro del `DialogContent`. |
| 36  | DONE          | `employees-screen.tsx:87`; `users-screen.tsx:116`; `roles-screen.tsx:79`; `catalog-screen.tsx:136`   | Buscador en las cuatro. Orden y paginación quedaron fuera por decisión de la spec 023.   |
| 37  | DONE          | `apps/web/src/components/app-shell/nav-items.ts:71,77`                                                | Caja y Comisiones en el grupo Operación, con prefijo más largo (`nav-items.ts:130`).     |
| 38  | DONE          | `data-table.tsx:313`                                                                                  | `role="status"` en `Cargando…`.                                                          |
| 39  | DONE          | `ticket-detail-screen.tsx:230`; `floor-ticket-detail.tsx:177`                                         | «Volver a la fila» ya no existe fuera de la referencia de diseño.                        |
| 40  | DONE          | `apps/web/src/app/(app)/carwash/page.tsx:18`; `settings/catalog/page.tsx:18`; `settings/employees/page.tsx:18` | Las otras rutas siguen en blanco: Issue 7.                                     |
| 41  | DONE          | `ticket-form.tsx:369`                                                                                 | «Placa, cliente, tipo de carro y servicio son obligatorios», que es lo que pide `complete`. |
| 42  | DONE          | `close-cash-dialog.tsx:55,125,155`                                                                    | Casilla obligatoria desde $10 de diferencia.                                             |
| 43  | DONE          | `commissions-screen.tsx:80,89`                                                                        | `Desde`/`Hasta` además de los tres rangos fijos.                                         |
| 44  | DONE          | `edit-ticket-dialog.tsx:169`; `apps/api/.../build-ticket-items.ts:62`                                 | El descuento se crea al editar, tope catálogo. Ver Issue 3.                              |

## Extras 023

- Fila con `rowHref` accionable con Enter/Espacio — **DONE** (`data-table.tsx:188,249`).
- `findByPlate` no reusa un vehículo desactivado — **DONE** (`prisma-vehicle.repository.ts:83`); la
  placa inactiva cae en `existsByPlate` y devuelve 409 sin `details.vehicle` (`ticket.usecases.ts:417`).
- Alta con `vehicleId` alinea el `customerId` al dueño sin tocar la ficha — **DONE**
  (`ticket.usecases.ts:98`; la ficha solo se muta por `PATCH /vehicles/:id`).
- `refetchOnWindowFocus` en el `QueryClient` — **DONE** (`lib/query-client.tsx:12`).
- Catálogo de pista y de oficina a 30s, no 5 min — **DONE** (`use-floor.ts:150`; `use-tickets.ts:132`).
- Link de placa con anillo de foco — **DONE** (ya no hay `focus-visible:outline-none`; el anillo
  global vive en `globals.css:389`).
- `--touch-min` en `Button` — **DONE** para el alto (`components/ui/button.tsx:23`); el **ancho** de
  `icon-xs`/`icon-sm` sigue por debajo de 44px en bahía (Issue 9).
- PIN 4–8 validado en el cliente — **DONE** (`employees-screen.tsx:194,257`).
- Ojito del PIN a tamaño táctil — **DONE** en la pista (`floor-login-form.tsx:86`, `size="icon"`);
  el login de oficina sigue en `icon-xs` (`login-form.tsx:163`).
- Login de pista en densidad `bahia` — **DONE** (`app/floor/login/page.tsx:15`).
- Confirmación al desactivar cliente, empleado y usuario — **DONE**, con diálogos hermanos.
- Categoría editable/desactivable y «Crear empleado dice qué falta» — **DONE**
  (`categories-screen.tsx:98`; `employees-screen.tsx:421`).
- Front-matter de `DESIGN.md` alineado al CSS (fila 52px) — **DONE** (`DESIGN.md:113`).
- Anular pide motivo — **DONE** (`voidTicketSchema`; `ticket.usecases.ts:164`).
- Verde de «Cuadra» y `StatCard Esperado` — **DONE** (`cash-difference-stamp.tsx:19`; no queda
  ningún `tone` verde en `cash-screen.tsx`).
- «Marcar listo» de un toque en la pista — **DONE por otra vía**: no confirma, pero el aviso trae
  Deshacer 5s (`ready-undo.ts:7`), que es lo que decidió la spec 018.
- Sin `services.read`/`employees.read` ya no se ve el vacío de «no hay datos» — **DONE**
  (`PermissionDenied` en las dos rutas).
- Placa normalizada al guardar — **DONE** en el valor (`schemas.ts:147`), pero con guion; de ahí
  sale el Issue 1.

## Issues

### Issue 1 -- Severity: bug

- File: apps/web/src/features/carwash/hooks/use-vehicle-search.ts:65
- Description: la búsqueda de vehículo del alta manda la placa **normalizada sin guion**
  (`normalizePlate` quita `-`, línea 16), pero la placa se guarda **con** guion: `formatPlate`
  inserta `A000-000` (línea 31) y el schema compartido solo quita espacios
  (`packages/shared/src/schemas.ts:153`). El repositorio filtra con
  `plate: { contains: trimmed.toUpperCase().replace(/\s+/g,'') }`
  (`apps/api/src/modules/vehicles/infrastructure/prisma-vehicle.repository.ts:61`), sin tolerar el
  guion y sin `mode: 'insensitive'`. Resultado: `exactMatch` nunca dispara, la lámina «Ya lo
  conocemos» no aparece nunca y el alta manda siempre `vehicleId: null`. `scripts/verify-012.sh:89`
  no lo detecta porque consulta `?q=PVIS-912`, con el guion, que es justo lo que el cliente **no**
  manda.
- Failure scenario: se anota `P123-456` (queda guardado así). Al día siguiente se teclea la misma
  placa en `/carwash/new`: `GET /vehicles?q=P123456` devuelve `[]`, no se autollena tipo/marca/
  color/dueño, y al guardar el API responde 409 `VEHICLE_PLATE_EXISTS`.
- Suggestion: normalizar en un solo lado. Lo más barato es que el repositorio compare sin guion
  —columna normalizada o `plate: { contains: term, mode: 'insensitive' }` más una variante sin
  `-`, como ya hace `prisma-ticket.repository.ts:150-160`—, y sumar al `verify-012.sh` un caso que
  busque sin guion.
- Status: open

### Issue 2 -- Severity: bug

- File: apps/api/src/modules/carwash/application/ticket.usecases.ts:95
- Description: `create()` resuelve el cliente **antes** que el vehículo. `resolveCustomerId` crea el
  cliente nuevo en la base (línea 374) y, dos líneas después, `resolveVehicle` puede tirar el 409
  `VEHICLE_PLATE_EXISTS` (línea 410). No hay transacción ni compensación: el cliente queda creado
  aunque el lavado no se abra. Cada reintento con un cliente nuevo agrega otro duplicado, y hoy el
  409 es el camino habitual por el Issue 1.
- Failure scenario: se anota un carro con placa ya conocida y un cliente nuevo («Ana Ruiz»). El API
  responde 409 y no abre el lavado, pero «Ana Ruiz» ya existe en `/customers`. Si el usuario
  reintenta dos veces, hay tres «Ana Ruiz».
- Suggestion: resolver el vehículo (y su 409) antes de crear al cliente, o envolver
  `resolveCustomerId` + `resolveVehicle` + `tickets.create` en una transacción.
- Status: open

### Issue 3 -- Severity: bug

- File: apps/web/src/features/carwash/components/edit-ticket-dialog.tsx:169
- Description: `prices[serviceId]` se fija cuando se selecciona el servicio (línea 163) o desde
  `ticket.items` (línea 50) y **no** se recalcula al cambiar el tipo de carro, aunque `priceOf`
  (línea 63) sí devuelve el precio del tipo nuevo. El rótulo dice «Precio (máx. $X)» con el catálogo
  nuevo mientras el input conserva el viejo, y el submit manda ese `unitPrice` (línea 103).
- Failure scenario: lavado abierto de Sedán con Lavado completo a $10. En Editar se cambia el tipo a
  Camioneta (catálogo $15): el campo sigue mostrando `10.00`, se guarda y el ticket queda con un
  descuento de $5 que nadie pidió. Al revés (Camioneta → Sedán) el guardado falla con 422
  `PRICE_ABOVE_CATALOG` y el diálogo no explica de dónde sale.
- Suggestion: al cambiar `bodyTypeId`, reescribir `prices` con `priceOf` de cada servicio
  seleccionado (o vaciarlo, que el API ya interpreta ausente = precio de catálogo).
- Status: open

### Issue 4 -- Severity: bug

- File: apps/web/src/features/users/components/users-screen.tsx:92
- Description: el `return` temprano de «sin permiso» está en la línea 80, y el `useState` del
  buscador (línea 92) y los dos `useMemo` (líneas 95 y 99) que agregó la spec 023 quedaron
  **después**. Es una violación de las reglas de hooks: si `canRead` pasa de `true` a `false` con la
  pantalla montada, React renderiza menos hooks de los que ya vio y lanza «Rendered fewer hooks than
  expected». El ESLint del repo no lo ve porque `eslint.config.mjs` no carga `eslint-plugin-react-hooks`.
  `roles-screen.tsx:62` tiene el mismo respaldo pero con todos los hooks arriba, que es la forma
  correcta.
- Failure scenario: un admin está en `/settings/users`; otro admin le quita `users.read`. Al volver a
  la pestaña, `refetchOnWindowFocus` trae la sesión con menos permisos, se toma el `return` de la
  línea 81 y la pantalla revienta en vez de mostrar el mensaje.
- Suggestion: mover el bloque de `useState`/`useMemo` (92–106) por encima del `if` de la línea 80, y
  agregar `eslint-plugin-react-hooks` a la config raíz.
- Status: open

### Issue 5 -- Severity: suggestion

- File: apps/api/src/modules/carwash/infrastructure/prisma-ticket.repository.ts:117
- Description: `civilRange` construye el rango con `new Date('YYYY-MM-DDT00:00:00')`, que se
  interpreta en la zona del **proceso**, mientras `dayRange` elige el día por defecto con
  `TIME_ZONE = 'America/El_Salvador'` (línea 128). Si el API corre en UTC —lo normal en un
  contenedor— la ventana del día queda corrida 6 horas. La spec 014 declara que `date` es
  `YYYY-MM-DD` en zona local del navegador, y el selector de día lo hace visible por primera vez.
  El mismo `civilRange` alimenta las comisiones (línea 436).
- Failure scenario: con el API en UTC, un lavado abierto a las 19:00 del 3 de septiembre cae en la
  ventana del 4: no aparece en «Hoy» y aparece al elegir mañana. Las comisiones de un día lo cuentan
  en el rango equivocado.
- Suggestion: calcular los bordes con `TIME_ZONE` (el mismo helper que ya usa `commission.ts:45`), o
  fijar `TZ=America/El_Salvador` en el proceso del API y documentarlo en `.env.example`.
- Status: open

### Issue 6 -- Severity: suggestion

- File: apps/web/src/features/employees/components/employees-screen.tsx:335
- Description: sin `employees.manage` el diálogo abre en «Ver empleado» y esconde el submit, pero los
  campos siguen siendo `Input` con `disabled={readOnly}` (líneas 335, 358) y el `Switch` de Activo
  también (línea 411). `apps/web/AGENTS.md` regla 14 y `DESIGN.md` piden lo contrario: «lo que el
  usuario puede ver pero no editar se muestra como texto plano sin caja, nunca como un control
  muerto». El mismo caso en `catalog-screen.tsx:471,516,541,567`, donde ni siquiera hay `disabled`:
  sin `services.manage` los campos son editables y solo falta el botón de guardar. `user-dialog.tsx:80`
  ya tiene resuelto el patrón correcto (`UserDetail`, texto plano).
- Failure scenario: un cajero con `employees.read` abre «Ver» de un empleado y encuentra cuatro cajas
  de formulario apagadas; en Catálogo puede escribir un precio nuevo, y nada le dice por qué no
  aparece cómo guardarlo.
- Suggestion: reusar la forma de `UserDetail`: en modo lectura, rótulo + valor en texto plano, sin
  `FieldBox`.
- Status: open

### Issue 7 -- Severity: suggestion

- File: apps/web/src/app/(app)/customers/page.tsx:15
- Description: el hallazgo 40 se cerró en `/carwash`, catálogo y empleados con `PermissionDenied`,
  pero `RequirePermission` sigue con `fallback = null` (`require-permission.tsx:27`) en
  `/customers`, `/carwash/cash` (`cash/page.tsx:15`) y `/settings/catalog/categories`
  (`categories/page.tsx:15`). Son exactamente la pantalla en blanco que describía el hallazgo.
- Failure scenario: alguien con `carwash.read` pero sin `customers.read` toca Clientes en el riel —o
  llega por un enlace guardado— y ve el armazón con el área de contenido vacía, sin mensaje ni salida.
- Suggestion: pasar `fallback={<PermissionDenied screen="…" />}` en esas tres rutas. Los ítems del
  riel ya se filtran por permiso, así que el caso llega por URL directa o por un permiso revocado.
- Status: open

### Issue 8 -- Severity: suggestion

- File: apps/web/DESIGN.md:429
- Description: la spec 020 partió `OPEN` y `WASHING`, pero `DESIGN.md` —que `apps/web/AGENTS.md`
  declara fuente de verdad visual— sigue diciendo «El mapa de un lavado: `OPEN` → «Abierto»
  (`washing`)» y, en la línea 349, «la única animación en bucle es el punto del chip «Abierto»». El
  código dice `OPEN` = «En cola» sin latido y `WASHING` = «Lavando» con latido
  (`ticket-status-stamp.tsx:17-18`). La tabla de tonos de la línea 418 sí se actualizó, así que el
  documento se contradice a sí mismo. La regla global 8 pide arreglarlo en el mismo commit.
- Failure scenario: quien implemente la próxima pantalla de lavados lee la línea 429, pinta `OPEN`
  con `tone="washing"` y devuelve el latido al chip de «En cola», que es justo el `Never` de la
  spec 020.
- Suggestion: reescribir las líneas 349 y 429 con los cinco estados y dejar el latido nombrado en
  «Lavando». De paso, `components/density-provider.tsx:16` todavía documenta «Fila 36px» para
  `mostrador`, contra los 52px del CSS.
- Status: open

### Issue 9 -- Severity: nit

- File: apps/web/src/components/ui/button.tsx:43
- Description: `min-h-(--touch-min)` (línea 23) arregla el **alto** de todos los tamaños, pero
  `icon-xs` e `icon-sm` fijan el ancho con `size-[calc(var(--control-h) - 12px)]`: en bahía quedan
  36px y 42px de ancho contra el mínimo de 44 de `apps/web/AGENTS.md` convención 10, y además el
  botón deja de ser cuadrado (44 de alto, 36 de ancho). Hoy `icon-xs` solo se usa en el ojito del
  login de oficina (`features/auth/components/login-form.tsx:163`); la pista ya pasó a `size="icon"`.
- Failure scenario: en un portátil táctil (`pointer: coarse` → densidad `bahia`) el ojito de mostrar
  la contraseña es un objetivo de 36px de ancho, bajo el mínimo del sistema.
- Suggestion: `min-w-(--touch-min)` junto al `min-h`, o subir el login de oficina a `size="icon"`
  como la pista.
- Status: open

### Issue 10 -- Severity: nit

- File: specs/017-edit-open-ticket.md:34
- Description: la spec 017 quedó en `Estado: Terminada` con «Nunca mandar `unitPrice` desde este
  diálogo» y con el Done «Guardar manda `bodyTypeId`, `items: [{ serviceId }]`, `notes`» (línea 17).
  La spec 022 (línea 19) invirtió esa decisión —«cada servicio admite `unitPrice` ≤ catálogo»— y el
  código sigue a la 022 (`edit-ticket-dialog.tsx:101-104`). Quedan dos specs terminadas que se
  contradicen sobre el mismo diálogo.
- Failure scenario: alguien lee la 017 antes de tocar `EditTicketDialog`, quita el `unitPrice`
  «porque la spec lo prohíbe» y borra el único flujo que crea descuentos (hallazgo 44).
- Suggestion: una línea en la 017 que remita a la 022 como la que manda sobre `unitPrice`.
- Status: open
