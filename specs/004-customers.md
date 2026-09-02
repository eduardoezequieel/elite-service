# 004 — Clientes: buscarlos al vuelo y verlos después

**Estado:** Terminada
**Módulo:** `customers`, `vehicles`, `carwash` | **Depende de:** spec 003 (carwash) terminada · spec 005 (rediseño visual) terminada

> Aprobada por el usuario el 2026-09-02, con la instrucción de implementarla a continuación de la
> spec 005. Toda la UI de esta spec se construye con el sistema visual de la 005 (`DataTable`,
> `PlateChip`, `Stamp`, `EmptyState`, `Tabs`, toasts de éxito, chips de placa) y con las mismas
> reglas: cero hex fuera de `globals.css`, estados vacíos con título y acción, 44px en bahía.

## Contexto

Hoy la ficha de lavado tiene dos campos libres —Nombre y Teléfono— y **siempre crea un cliente
nuevo**. Tres lavados del mismo señor son tres clientes distintos, y no hay ninguna pantalla donde
darse cuenta: los clientes existen en la base pero no en la aplicación.

Esta spec cierra las dos puntas. En la ficha, el cliente se **busca mientras se escribe** y se
elige de un toque; si se escribe uno que ya existe y no se eligió, el sistema pregunta antes de
guardar. En oficina, una pestaña **Clientes** para encontrarlos, corregirlos y ver qué carros
tienen y qué lavados les hicimos.

## Historias

- Como empleado de pista, quiero que al escribir el nombre o el teléfono me aparezcan los clientes
  que ya existen y elegir uno tocándolo, para no volver a darlo de alta con el carro esperando.
- Como empleado de pista o de mostrador, quiero que si escribo un cliente que ya existe y no lo
  elegí me pregunten «¿es el mismo?» antes de guardar, para no duplicarlo sin darme cuenta.
- Como usuario con `customers.read`, quiero una pestaña Clientes con buscador por nombre o
  teléfono, para encontrar a alguien sin ir lavado por lavado.
- Como usuario con `customers.read`, quiero abrir un cliente y ver sus carros y sus lavados, para
  saber qué le hicimos y cuándo.
- Como usuario con `customers.manage`, quiero corregir el nombre o el teléfono y desactivar a un
  cliente, para limpiar lo que se anotó mal en la pista.

## Criterios de aceptación

### Buscar al vuelo en la ficha de lavado

- **Dado** que existe «Juan Pérez» con teléfono `7777-8888`, **cuando** en la ficha de lavado se
  escribe `jua` en el campo Cliente, **entonces** aparece Juan Pérez como sugerencia tocable con su teléfono
  al lado.
- **Dado** ese mismo cliente, **cuando** se escribe `77778888` en ese mismo campo, **entonces** también
  aparece: el mismo campo busca por nombre y por teléfono.
- **Dado** que se tocó la sugerencia, **cuando** se abre el lavado, **entonces** el cuerpo lleva
  `customerId` y **no se crea** ningún cliente. El total de clientes no cambia.
- **Dado** un cliente elegido, **cuando** se toca «Cambiar», **entonces** se vuelve al buscador
  vacío y se puede elegir otro o escribir uno nuevo.
- **Dado** un texto que no coincide con nadie, **cuando** se abre el lavado, **entonces** se crea
  el cliente con ese nombre y teléfono, como hasta hoy.
- **Dado** un cliente **desactivado**, **cuando** se escribe su nombre, **entonces** no aparece
  entre las sugerencias.

### Preguntar antes de duplicar

- **Dado** que existe «Juan Pérez» `7777-8888` y se escribió «juan perez» sin elegir la sugerencia,
  **cuando** se toca «Abrir lavado», **entonces** aparece un diálogo «Ya existe Juan Pérez ·
  7777-8888. ¿Es el mismo?» con «Usar ese» y «Crear otro».
- **Dado** ese diálogo, **cuando** se toca «Usar ese», **entonces** el lavado se abre con
  `customerId` del existente y no se crea nadie.
- **Dado** ese diálogo, **cuando** se toca «Crear otro», **entonces** el lavado se abre con un
  cliente nuevo: dos personas pueden llamarse igual y el sistema no lo impide (RN-2).
- **Dado** que se escribió el teléfono `7777 8888` de Juan pero con otro nombre, **cuando** se toca
  «Abrir lavado», **entonces** también pregunta: el teléfono pesa más que el nombre (RN-1).
- **Dado** que no hay ninguna coincidencia, **cuando** se toca «Abrir lavado», **entonces** no
  aparece ningún diálogo y el lavado se abre directo.

### Verlos después

- **Dado** un usuario con `customers.read`, **cuando** entra a la vista admin, **entonces** ve la
  pestaña **Clientes** en Operación; sin ese permiso, la pestaña no se dibuja y `/customers`
  responde con la redirección de siempre (003 RN-16).
- **Dado** la pantalla Clientes, **cuando** se escribe en el buscador, **entonces** la lista se
  filtra por nombre o teléfono.
- **Dado** un cliente abierto, **cuando** se carga su ficha, **entonces** se ven sus datos, sus
  carros (placa, tipo, marca y color) y sus lavados (número, fecha, total y estado), del más nuevo
  al más viejo, y cada lavado enlaza a su detalle.
- **Dado** un usuario con `customers.manage`, **cuando** corrige el teléfono, **entonces** queda
  guardado y se ve en la ficha; **cuando** lo desactiva, **entonces** deja de sugerirse en la ficha
  de lavado pero sus lavados viejos lo siguen mostrando (003 RN-13).
- **Dado** un usuario **sin** `customers.manage`, **cuando** abre la pantalla, **entonces** no ve
  «Nuevo cliente», «Editar» ni «Desactivar».
- **Dado** una sesión de **pista**, **cuando** pide `/api/customers` o `/api/customers/:id`,
  **entonces** responde `401` o `403`: la pista busca y da de alta, no administra (RN-5).

## Reglas de negocio

- **RN-1 (qué es una coincidencia).** Se compara normalizando, no letra por letra:
  - **Teléfono:** solo los dígitos. `7777-8888`, `7777 8888` y `77778888` son el mismo teléfono.
    Dos teléfonos iguales son coincidencia **fuerte**.
  - **Nombre:** minúsculas, sin acentos, espacios de sobra colapsados. «Juan Pérez», «JUAN PEREZ»
    y «juan perez» son el mismo nombre. Dos nombres iguales son coincidencia **por nombre**.
  - Si hay de las dos, gana el teléfono. Un teléfono vacío nunca coincide con otro vacío.
- **RN-2 (nunca duplica en silencio, nunca bloquea).** Al guardar sin haber elegido de la lista, si
  hay coincidencia se pregunta. «Crear otro» siempre existe: dos personas pueden llamarse igual y
  el sistema no está para discutirlo con quien tiene al cliente enfrente.
- **RN-3 (sugerencias).** Desde 2 caracteres, como mucho 6 sugerencias, pidiéndolas al servidor con
  un respiro de 250 ms desde la última tecla. Se eligen **tocando**, en botones de alto
  `--touch-min`; nunca en un `<select>` (003 RN-17).
- **RN-4 (bajas).** Un cliente desactivado no se sugiere ni se puede elegir en una ficha nueva. En
  los lavados que ya tiene, se sigue mostrando. Los clientes se desactivan, no se borran
  (003 RN-13).
- **RN-5 (la pista no administra).** La pista puede buscar clientes y darlos de alta al vuelo —eso
  ya existe—, pero no editarlos, desactivarlos ni listarlos en una pantalla propia (003 RN-0).
- **RN-6 (el cliente elegido no se edita desde el lavado).** Si se eligió a Juan y su teléfono está
  mal, se corrige en Clientes. La ficha de lavado no pisa datos de un cliente existente: el
  mostrador no debería cambiarle el nombre a alguien por escribir apurado.

## Permisos

Ninguno nuevo. Esta spec le da pantalla a los que la 003 ya creó:

| Clave              | Dónde se usa ahora                                                       |
| ------------------ | ------------------------------------------------------------------------ |
| `customers.read`   | Pestaña Clientes, lista, ficha del cliente, `GET /customers/*`           |
| `customers.manage` | «Nuevo cliente», «Editar», «Desactivar», `POST` y `PATCH /customers`     |
| `vehicles.read`    | Los carros del cliente en su ficha (`GET /vehicles?customerId=`)         |
| `carwash.read`     | Los lavados del cliente en su ficha (`GET /carwash/tickets?customerId=`) |

## Datos

Sin cambios de schema ni migración. Todo sale de `Customer`, `Vehicle` y `WorkOrder` como ya están.

## API

| Método | Ruta                     | Request                          | Response              | Errores          |
| ------ | ------------------------ | -------------------------------- | --------------------- | ---------------- |
| GET    | `/customers/match`       | `?fullName=` `&phone=`           | `CustomerMatch\|null` | 400 falta nombre |
| GET    | `/customers/:id`         | —                                | `Customer`            | 404 `NOT_FOUND`  |
| GET    | `/vehicles`              | `?customerId=` (nuevo, opcional) | `VehicleWithOwner[]`  | —                |
| GET    | `/carwash/tickets`       | `?customerId=` (nuevo, opcional) | `Ticket[]`            | —                |
| GET    | `/floor/customers/match` | `?fullName=` `&phone=`           | `CustomerMatch\|null` | 400 falta nombre |

- `CustomerMatch` es nuevo en `@elite/shared`: `{ customer: Customer; on: 'phone' | 'name' }`. El
  `on` es lo que deja escribir el diálogo en un idioma («mismo teléfono» / «mismo nombre») sin que
  la web repita la regla.
- `GET /customers` y `GET /floor/customers` no cambian: siguen filtrando por `q` y son las que
  alimentan las sugerencias. Sí dejan de devolver desactivados en la búsqueda de la ficha
  (parámetro `activeOnly`, por omisión `true`; la pantalla de oficina pide `false` para poder
  reactivar a alguien).
- `GET /carwash/tickets?customerId=` **no** se limita al día de hoy —ese recorte es para la fila—;
  devuelve los últimos 20 lavados de ese cliente, en cualquier estado.
- Los permisos son los de la tabla de arriba; las rutas `/floor/*` van con sesión de pista, como
  todo el resto de ese controller.

## UI

### Ficha de lavado — sección Cliente (`/floor/new` y `/carwash/new`, mismo `TicketForm`)

Tres estados en el mismo lugar:

1. **Buscando** — un solo campo, «Cliente (nombre o teléfono)». Debajo, las sugerencias como
   láminas tocables: nombre en peso medio, teléfono en tono apagado. Al final de la lista, siempre,
   «Es alguien nuevo» para seguir de largo cuando no es ninguno de los sugeridos.
2. **Elegido** — una lámina con el nombre, el teléfono y «Cambiar». Los campos de texto
   desaparecen: el cliente ya no se escribe (RN-6).
3. **Nuevo** — Nombre y Teléfono, como hoy, cuando se decidió que no es ninguno de los sugeridos.

El diálogo «¿Es el mismo?» usa el `Dialog` del sistema, con las dos salidas del mismo tamaño
—«Usar ese» y «Crear otro»—: ninguna es la peligrosa.

### `/customers` — pestaña Clientes (grupo Operación, debajo de Lavados)

`ScreenHeader` con el subtítulo real («N clientes activos»), buscador arriba (`Input` con icono, filtra
con el mismo respiro de 250 ms contra `GET /customers?q=&activeOnly=false`), y la lista con
`DataTable`: Ref · Nombre (`stack: title`, con `.is-ruled-out` si está desactivado) · Teléfono
(mono) · Estado (`Stamp` Activo/Inactivo) · Acciones («Abrir» siempre; «Editar» con
`customers.manage`). Estado vacío propio: «Todavía no hay clientes» + «Los clientes se crean solos al
anotar un lavado, o acá con Nuevo cliente» + acción «Nuevo cliente» si hay `customers.manage`. Vacío de
búsqueda: «Nadie coincide con «texto»». «Nuevo cliente» abre un diálogo del sistema (Nombre, Teléfono)
y el mismo diálogo sirve para editar (Nombre, Teléfono, Activo). Toast de éxito al guardar.

### `/customers/:id` — ficha del cliente

`ScreenHeader` con el nombre (rastro «Clientes» derivado del riel), subtítulo con teléfono (mono) y
`Stamp` de estado; acciones de `customers.manage`: «Editar» (abre el diálogo) y «Desactivar» /
«Reactivar» (`outline`; sin confirmación, como el resto de las desactivaciones del sistema). Debajo,
dos `Card`: **Carros** (`DataTable`: Ref · Placa con `PlateChip` · Tipo · Marca y color; solo si hay
`vehicles.read`) y **Lavados** (`DataTable`: Ref `#14` · Fecha · Total mono · `TicketStatusStamp` ·
«Abrir» al detalle `/carwash/:id`; solo si hay `carwash.read`). Vacíos: «Este cliente todavía no tiene
carros anotados» / «Este cliente todavía no tiene lavados». Sin el permiso, la lámina no se dibuja.

## Fuera de alcance

- **Elegir el carro del cliente en la ficha.** Que al elegir a Juan se ofrezcan sus placas es lo
  natural que sigue, pero es otro problema (el vehículo ya se reutiliza por placa, 003 RN-12) y va
  en su propia spec.
- **Fusionar dos clientes que ya se duplicaron.** Esta spec evita el próximo duplicado; no limpia
  los viejos.
- Pantalla de clientes en la pista, historial de taller y cualquier dato de contacto que no sea
  nombre y teléfono.

## Tareas

- [x] `@elite/shared`: tipo `CustomerMatch` y el schema de la consulta (`customerMatchQuerySchema`).
- [x] Dominio `customers/domain/customer-match.ts`: normalizar teléfono y nombre, y elegir la
      coincidencia (RN-1). Tests unitarios: acentos, mayúsculas, espacios, guiones del teléfono,
      teléfono vacío, empate entre nombre y teléfono.
- [x] `FindCustomerMatchUseCase` + `activeOnly` en el puerto y en el repositorio de clientes, con
      tests en memoria.
- [x] API oficina: `GET /customers/match`, `GET /customers/:id`, `activeOnly` en `GET /customers`.
- [x] API pista: `GET /floor/customers/match` y `activeOnly` en `GET /floor/customers`.
- [x] `customerId` en `GET /vehicles` y en `GET /carwash/tickets` (sin recorte por día, últimos 20),
      con test del filtro.
- [x] `TicketForm`: sección Cliente con los tres estados y las sugerencias tocables (RN-3, RN-6).
      Las dos vistas comparten el componente y cada una le pasa su función de búsqueda.
- [x] Diálogo «¿Es el mismo?» al guardar, en las dos vistas (RN-2).
- [x] Pestaña Clientes en `nav-items.ts` con `customers.read`, y rastro de ficha.
- [x] Pantalla `/customers`: buscador, lista, alta y edición con `customers.manage`.
- [x] Pantalla `/customers/:id`: datos, carros y lavados.
- [x] `scripts/verify-004.sh`: coincidencia por nombre y por teléfono, alta con `customerId` sin
      crear cliente, desactivado que no se sugiere, y la pista que no puede listar clientes.
- [x] Verificar criterios automáticos: `pnpm build`, `pnpm lint`, `pnpm test` y
      `bash scripts/verify-004.sh`, todos en verde.
- [x] Mirar las dos pantallas nuevas y la ficha de lavado en ancho de tablet y densidad `bahía`
      además de escritorio. Verificado el 2026-09-02 con capturas en `docs/reviews/005/customers-*`,
      `customer-detail-*` y `carwash-new-customer-search-*` (1440px y 390px, densidad `bahia`):
      lista con buscador, ficha con Carros y Lavados apilados, y las sugerencias tocables en el alta.

## Verificación

Script end-to-end: [`scripts/verify-004.sh`](../scripts/verify-004.sh). Se corre con el stack
levantado (`docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev`); crea empleado,
clientes, vehículos y lavados con sufijo `VIS` y los borra al terminar.

**Resultado: 54 comprobaciones, 54 en verde, 0 fallas.** Lo que recorre:

1. **Coincidencia por nombre** — «juan perez vis», «JUAN PEREZ VIS» (con un espacio de sobra en el
   medio) y «Juan Pérez VIS» son el mismo cliente: acentos, mayúsculas y espacios repetidos no
   cuentan.
2. **Coincidencia por teléfono** — `7777-0104`, `7777 0104` y `77770104` son el mismo teléfono, y
   con otro nombre igual coincide. Coincidiendo las dos cosas, `on` viene `phone`.
3. **Sin coincidencia** — cuerpo `null`; un teléfono vacío no coincide con otro vacío; sin
   `fullName`, 422.
4. **Desactivado** — no sale en `GET /customers?q=`, sí con `activeOnly=false`, no se propone como
   «el mismo» y la pista tampoco lo sugiere.
5. **Alta con `customerId`** — desde oficina y desde pista: el lavado queda a nombre del elegido y
   el total de clientes no cambia (se cuenta antes y después).
6. **La ficha** — `GET /customers/:id` 200 y 404 `NOT_FOUND`; `GET /vehicles?customerId=` trae solo
   sus carros; `GET /carwash/tickets?customerId=` trae su historial en cualquier estado —incluido
   un anulado—, sin recorte por día y con tope de 20.
7. **La pista no administra** — con la cookie de pista, `/customers`, `/customers/:id` y
   `/customers/match` responden 401; la oficina tampoco entra por `/floor/customers/match`.
8. **Corregir y desactivar** — el teléfono corregido queda guardado y pasa a ser el que coincide;
   desactivado deja de sugerirse pero sus lavados viejos lo siguen mostrando; reactivado vuelve.

También en verde, desde la raíz: `pnpm build`, `pnpm lint`, `pnpm test` (24 suites, 188 tests, con
los nuevos de `customer-match`, `customer.usecases` y `ticket-query`) y `npx tsc --noEmit` en
`apps/web`. Las rutas `/customers`, `/customers/:id`, `/carwash/new` y `/floor/new` responden 200
en el dev, sin errores de compilación.

**Dos decisiones donde la spec y el código no coincidían:**

- **El error de `GET /customers/match` sin nombre es 422, no el 400 de la tabla de API.** En este
  repo el 400 queda para el request malformado y los datos inválidos son 422, que es lo que
  produce el `ZodValidationPipe` compartido (`apps/api/AGENTS.md`, convención 5). Se prefirió no
  inventar una validación a mano solo para cambiarle el número a un error.
- **La coincidencia se calcula en memoria sobre los clientes activos.** Normalizar en SQL —dígitos
  del teléfono, nombre sin acentos— pediría la extensión `unaccent` y una migración, y esta spec no
  toca el schema. La comparación corre una sola vez por alta y el taller tiene miles de clientes,
  no millones; está anotado en `FindCustomerMatchUseCase`.

**Pendiente:** la revisión a ojo en ancho de tablet y densidad `bahía`. Se construyó con los
componentes y tokens del sistema (`DataTable`, `PlateChip`, `Stamp`, `EmptyState`, `Dialog`), con
todo lo tocable en `min-h-touch` o botones `size="sm"` —44px en `bahia`— y sin un solo color
literal fuera de `globals.css`, pero no se abrió un navegador para confirmarlo.
