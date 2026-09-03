# 005 — Rediseño visual: la piel del prototipo

**Estado:** Terminada
**Módulo:** web (transversal) | **Depende de:** spec 001, 002 y 003 terminadas

> Aprobada por el usuario el 2026-09-01 con el brief «Rediseño visual completo — Elite Service
> Carwash» y la instrucción explícita de reescribir `apps/web/DESIGN.md` para que describa la
> dirección del prototipo.

## Contexto

El sistema funciona (login, lavados, catálogo, empleados, usuarios, roles, pista) pero visualmente
usa un gris neutro con un solo naranja y no se parece a la marca. Existe un prototipo aprobado en un
solo archivo HTML, copiado a **`docs/prototype/elite-service-prototipo.html`**: su CSS es la fuente
de verdad para colores, tipografía, espaciado y comportamiento de los componentes.

Esta spec lleva **todas** las pantallas a esa dirección. Es un cambio de piel, no de producto.

## Regla número uno

**No se elimina, no se rompe y no se «simplifica» ninguna funcionalidad.** Cada botón, filtro,
permiso, validación, estado de carga, mensaje de error, atajo y llamada al API del inventario de
abajo sigue existiendo y funcionando igual. Si algo debería cambiar de comportamiento, **no se
cambia**: se anota en _Propuestas de cambio funcional_ y se sigue.

Tampoco se cambian rutas, nombres de campos, contratos del API ni la forma de los datos. No se
inventan pantallas, campos ni funciones. No se agregan librerías de UI (el proyecto ya tiene
shadcn/ui sobre `radix-ui`, que incluye `Toast`).

## Historias

- Como dueño del carwash, quiero que el sistema se vea como mi marca (azul marino, llama, la
  itálica ancha del logo), para que el mostrador y la tablet se sientan de Elite Service.
- Como cajero, quiero ver de un vistazo cuántos carros hay en cola, cuántos están listos para cobrar
  y cuánto se cobró hoy, y cobrar desde la fila.
- Como lavador, quiero la misma piel en la pista, con botones de 44px y sin depender del mouse.
- Como cualquier usuario, quiero tema oscuro por defecto y un tema claro igual de cuidado.

## Inventario (checklist de verificación)

Todo lo listado existe hoy y debe seguir existiendo. Detalle exacto (textos, permisos, condiciones)
en el código; acá va lo que se comprueba.

### Rutas

| Ruta                  | Pantalla                      | Guardia / permiso                                      |
| --------------------- | ----------------------------- | ------------------------------------------------------ |
| `/`                   | redirector                    | sesión → `firstAllowedHref`; sin sesión → `/login`     |
| `/login`              | inicio de sesión admin        | pública; con sesión redirige a `/`                     |
| `/floor/login`        | entrada a la pista (PIN)      | pública; usuario recordado en `localStorage`           |
| `/floor`              | la fila (pista)               | sesión de pista; densidad `bahia` forzada              |
| `/floor/new`          | anotar carro                  | sesión de pista                                        |
| `/floor/[id]`         | lavado (pista)                | sesión de pista                                        |
| `/carwash`            | lavados (oficina)             | `carwash.read`; «Nuevo lavado» con `carwash.manage`    |
| `/carwash/new`        | nuevo lavado (emergencia)     | `carwash.manage`                                       |
| `/carwash/[id]`       | detalle + cobro               | `carwash.read` (+ `manage`, `charge`, `void` internos) |
| `/settings/catalog`   | catálogo                      | `services.read`; editar con `services.manage`          |
| `/settings/employees` | empleados                     | `employees.read`; crear/editar con `employees.manage`  |
| `/settings/users`     | usuarios                      | `users.read` interno; crear/editar con `users.manage`  |
| `/settings/roles`     | roles y permisos              | `roles.read` interno; crear/editar/borrar con `manage` |
| `/design`             | referencia visual del sistema | pública, sin shell                                     |

### Lo que cada pantalla conserva

- **`/`**: «Cargando…», «No hay pantallas para tu usuario.».
- **`/login`**: correo + contraseña (RHF + `loginSchema`), errores por campo y general (`role=alert`),
  «Entrar» / «Entrando…», «Comprobando la sesión…», «Ya tenés la sesión abierta.». No existe
  «olvidé mi contraseña»: no se agrega.
- **`/floor/login`**: usuario recordado (`elite-floor-username`), foco en PIN, «Entrar» /
  «Entrando…», error al pie. Sin enlace al login admin.
- **Shell de pista**: «Pista» (link), nombre del empleado, «Salir»; guardia a `/floor/login`;
  fuerza `data-density="bahia"` y la restaura al salir. Sin riel, sin toggle de tema.
- **`/floor`**: «Anotar carro»; láminas con placa, `#n · tipo · cliente`, sello, servicios, total,
  «Ver», «Marcar listo» solo en `OPEN` (sin confirmación), error de acción al pie. Vacío: «No hay
  carros en la fila. Tocá «Anotar carro» para empezar.».
- **`/floor/new`** y **`/carwash/new`**: el mismo `TicketForm`. Campos: Nombre, Teléfono, Placa,
  Marca, Color, Tipo de vehículo (radiogroup de tarjetas), Servicios (multiselección, precio
  resuelto por tipo; sin tipo, el aviso «Elegí primero el tipo de carro…»), Lavador (solo oficina;
  «Oficina» por defecto; solo empleados activos), Nota. `complete` = nombre + placa + tipo + ≥1
  servicio. «Abrir lavado» / «Guardando…». Total en centavos enteros. Al éxito, `replace` al
  detalle.
- **`/floor/[id]`**: placa como título, `#n · tipo`, sello, Cliente/Teléfono/Lavador, líneas con
  `unitPrice`, Total, «Marcar listo» (`OPEN`), «Reabrir» (`READY`), «Volver a la fila». Nunca
  Cobrar ni Anular.
- **`/carwash`**: tres pestañas (Pendientes `OPEN,READY` · Listos para cobrar `READY` · Todos),
  columnas Ref · Placa · Cliente · Lavador · Estado · Total · Acciones, «Abrir» a cada detalle,
  «Nuevo lavado» con `carwash.manage`. Sin búsqueda, orden ni paginación (no hay hoy).
- **`/carwash/[id]`**: `#n` + folio `CW-xxxx`, sello, aviso de anulado con `.is-ruled-out` sobre
  «Este lavado», ficha (Cliente, Teléfono, Placa, Tipo de carro, Marca y color, Lavador, Nota),
  líneas con precio de catálogo tachado si hubo descuento, Total, bloque Cobro (Método, Monto) si
  hay pago. Acciones por estado × permiso: «Cobrar $X» (`READY` + `charge`, abre el diálogo),
  «Marcar listo» (`OPEN` + `manage`), «Reabrir» (`READY` + `manage`), «Anular» (`OPEN|READY` +
  `void`, sin confirmación), «Volver a la fila». Los que no aplican **no se dibujan**.
- **Diálogo Cobrar**: título, descripción, total grande, tres métodos como botones (Efectivo,
  Tarjeta, Transferencia) con su verbo («Cobrar en efectivo»…), sin campo de monto, «Elegí un
  método» deshabilitado hasta elegir, error al pie, reset al cerrar.
- **`/settings/catalog`**: columnas Ref · Servicio (nombre + código `SRV-xxxx`) · Categoría · Base ·
  una por tipo de carro (`—` = usa el base, con `title`) · Estado · Editar (`services.manage`).
  Diálogo Editar servicio: Nombre, Precio base, una celda por tipo (vacío = borra la celda), Activo,
  «Guardar cambios». Vacío: «Todavía no hay servicios.».
- **`/settings/employees`**: Ref · Nombre (`.is-ruled-out` si inactivo) · Usuario · Estado ·
  Editar. Diálogo alta/edición: Nombre, Usuario, PIN (ayuda distinta en alta y edición), Activo
  solo en edición, `complete`, «Crear empleado» / «Guardar cambios». Vacío con «Nuevo empleado».
- **`/settings/users`**: no lista al usuario autenticado; Ref · Nombre · Correo · Roles · Estado ·
  Editar / Ver ficha; dos textos de vacío según permiso; pantalla «No tenés permiso…». Diálogo en
  modos create/edit/view; `UserForm` con Nombre, Correo (solo alta; texto plano en edición),
  Contraseña (ayudas distintas), Roles (cinco estados del bloque), Usuario activo (solo edición),
  errores bajados a campo (`EMAIL_TAKEN`, `INVALID_ROLE`, `VALIDATION_ERROR`).
- **`/settings/roles`**: Ref · Nombre · Descripción · Usuarios · Acciones (Editar / Ver permisos;
  Eliminar solo con `userCount === 0`; si está en uso, «~~Eliminar~~ lo tienen N usuarios»).
  Diálogo de rol (alta, edición, solo lectura) con Nombre, Descripción, **matriz de permisos**
  (escritorio: tabla módulo × acción con «Fila completa» y «Marcar todo / Quitar todo»; táctil: una
  sección por módulo; guion = acción inexistente; nota al pie). Diálogo de borrado con el único
  rojo relleno del sistema, «Eliminando…», y la variante bloqueada.
- **Shell de oficina**: riel con grupos Operación / Configuración, pestañas filtradas por permiso,
  plegado a 52px, menú de usuario (nombre, correo, «Cerrar sesión» / «Cerrando sesión…»), toggle de
  tema (Claro / Oscuro / Automático), barra inferior en móvil, rastro de ficha derivado del riel (**hoy enlace de regreso, spec 008**)
  (solo ancestros), `ScreenHeader` con alto reservado, `SessionGuard` con sus dos mensajes.
- **Componentes**: `Button` (7 variantes, 8 tamaños), `Stamp` (5 tonos, `label` obligatorio),
  `DataTable` (columnas declarativas, `stack`, referencia, estados), `Reference`, `Dialog`,
  `DropdownMenu`, `Input`, `Textarea`, `Label`, `Checkbox` y `Switch` (área táctil 44px), `Card`,
  `Separator`, `Form`, `Badge`, `RequirePermission`, `TicketStatusStamp`, `ThemeToggle`,
  `DensityProvider`.

### Deuda que el inventario destapó (se corrige en esta spec)

- Clases sin token (`bg-plate`, `bg-wash`, `text-graphite`, `border-graphite`) en `ticket-form.tsx`
  y `charge-dialog.tsx`: hoy no pintan nada. Desaparecen con los tokens nuevos.
- `text-white`, `text-[12px]`, `shadow-xs` sueltos en `ticket-form.tsx`.
- `/design` rotula la tipografía como «Archivo · JetBrains Mono»: se reescribe entera.
- `BODY_TYPE_METADATA` en `ticket-form.tsx` inventa una duración por tipo de carro que no existe
  en el catálogo. Los **modelos de ejemplo** se quedan (el brief los pide); la duración **se
  quita** porque es un dato falso, y se anota como propuesta (ver abajo).

## Sistema de diseño

La fuente de verdad visual es el CSS de `docs/prototype/elite-service-prototipo.html`.
`apps/web/DESIGN.md` se reescribe para describir **esta** dirección y deja de prohibir lo que el
prototipo usa (arco de medidor, degradado de acción, sombra alta, Inter).

### Tokens (un solo lugar: `src/app/globals.css`)

Nombres de marca, con alias a los nombres que ya consume shadcn/ui (`--background`, `--card`,
`--border`, `--primary`, `--ring`, `--destructive`, `--sidebar-*`…) para no tocar cada componente.
**Prohibido escribir hex sueltos en componentes.**

| Token                                                 | Oscuro (por defecto)                                                                              | Claro                                 | Uso                                         |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------- |
| `--bg`                                                | `#070E1C` (navy-950)                                                                              | `#EEF1F6`                             | fondo de la app                             |
| `--surface`                                           | `#0B1730` (navy-900)                                                                              | `#FFFFFF`                             | tarjetas, filas                             |
| `--surface-2`                                         | `#101E3C` (navy-850)                                                                              | `#F6F8FC`                             | inputs, hover, seleccionables               |
| `--surface-3`                                         | `#152747` (navy-800)                                                                              | `#E6EBF3`                             | superficie elevada extra                    |
| `--line`                                              | `#1E3358`                                                                                         | `#D9E0EC`                             | borde visible                               |
| `--line-soft`                                         | `#182B4C`                                                                                         | `#E6EBF3`                             | borde suave                                 |
| `--rail`                                              | `#050A15`                                                                                         | `#0B1730`                             | menú lateral, **siempre azul marino**       |
| `--plate-bg`                                          | `#0E1B33`                                                                                         | `#F1F4FA`                             | fondo del chip de placa                     |
| `--text`                                              | `#EAF0FA` (chrome)                                                                                | `#0B1730`                             | texto principal                             |
| `--text-dim`                                          | `#8FA4C6` (steel)                                                                                 | `#4E5D77`                             | texto secundario                            |
| `--text-faint`                                        | `#63779A` (steel-dim); si no da 4.5:1 sobre `--surface`, se sube hasta que dé                     | `#7E8BA3` (misma regla sobre blanco)  | texto tenue                                 |
| `--flame`                                             | `#F04E23`                                                                                         | igual                                 | acción principal, pestaña e ítem activos    |
| `--flame-hot`                                         | `#F58220`                                                                                         | igual                                 | extremo claro del degradado, foco           |
| `--flame-deep`                                        | `#C4161C`                                                                                         | igual                                 | extremo oscuro del degradado                |
| `--go`                                                | `#2FBF7C`                                                                                         | igual                                 | **solo** «Listo» y «Cobrado»                |
| `--danger`                                            | derivado de `--flame-deep`: más oscuro y menos saturado, distinguible a ojo del naranja de acción | misma base; texto ajustado al tema    | error, destructivo, sello Anulado           |
| `--warn`                                              | ámbar cercano a `--flame-hot`, menos saturado                                                     | igual                                 | advertencia                                 |
| `--gradient-action`                                   | `linear-gradient(100deg, #F58220, #F04E23 55%, #C4161C)`                                          | igual                                 | primario, subrayado de pestaña, barra       |
| `--shadow`                                            | `0 18px 40px -24px rgba(0,0,0,.9)`                                                                | `0 14px 30px -22px rgba(11,23,48,.5)` | la única sombra                             |
| `--radius-control` / `--radius-row` / `--radius-card` | 10px / 12px / 14px                                                                                |                                       | botones e inputs / filas / tarjetas grandes |

Reglas: el naranja-rojo solo para acción principal, pestaña activa, ítem activo del menú y datos que
se salen del valor base; no es relleno ni decoración. `--go` solo para listo/cobrado. El rojo de
error **no** es el naranja de acción. Cada token existe en `:root` (oscuro) y se redefine en el tema
claro; ningún color vive en un solo tema. Los valores de `--danger` y `--warn` se documentan en
`DESIGN.md` con su contraste medido.

Los tokens de **densidad** (`--row-h`, `--control-h`, `--touch-min`, `--plate-pad`, `--icon-size`),
el `data-density` y el `DensityProvider` se conservan: la regla global 9 sigue vigente.

### Tema

Oscuro por defecto (`defaultTheme="dark"`). Siguen existiendo Claro / Oscuro / Automático, con
persistencia y sin parpadeo. El riel es azul marino en los dos temas.

### Tipografía

- **Display**: `Saira`, itálica, 700–800. Títulos de pantalla (38px escritorio / 30px móvil,
  `line-height` .95), cifras de estadística, total grande, valor del medidor, wordmark.
- **Interfaz**: `Inter` 400/500/600/700. Cuerpo 14.5px.
- **Datos**: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` para placas, referencias
  `#14`, códigos `SRV-0001` y montos en tablas. Cifras tabulares.
- Se cargan con `next/font/google` (`Saira`, `Inter`) con `display: 'swap'`: Next descarga los
  archivos en el build y los sirve desde el propio dominio (`/_next/static/media`), así que en
  producción **no hay ninguna petición a una CDN externa**. Atkinson Hyperlegible se retira; el
  ADR-007 se reemplaza por uno nuevo.
- Sin etiquetas en MAYÚSCULAS con letras separadas y sin mayúsculas forzadas en el cuerpo de la
  interfaz. La única excepción es el wordmark del logo.

### Forma, espacio y movimiento

- Radios 10 / 12 / 14px según jerarquía. Borde 1px `--line-soft` en reposo, 1.5px en
  seleccionables, `--flame` seleccionado.
- Padding de tarjeta 22px. Separación entre filas 10px.
- Foco visible siempre: `outline: 2px solid var(--flame-hot); outline-offset: 2px`. Nunca
  `outline: none` sin reemplazo.
- Movimiento solo como respuesta a una acción (abrir, seleccionar, confirmar). Sin animaciones de
  entrada por sección ni transiciones al pasar el mouse por todo. `prefers-reduced-motion` apaga el
  punto que late y las transiciones.

### Cortes

- **1180px**: el resumen de «Nuevo lavado» deja de ser fijo; las estadísticas pasan a 2 columnas.
- **900px**: el menú lateral pasa a barra inferior fija; las listas se apilan en tarjetas.
- Se prueba a **390px**. En móvil todo lo tocable mide ≥ 44px y el botón principal de cada tarjeta
  va a todo el ancho.
- Se materializa en `@theme`: `--breakpoint-md: 900px`, `--breakpoint-xl: 1180px`; los usos de
  `lg:` se auditan. El `DensityProvider` mueve su corte compacto a `899.98px` para coincidir.

## Componentes

Se **modifican** los que existen; no se crean paralelos.

1. **Botón** (`ui/button.tsx`): `default` = degradado de llama con texto blanco; `outline`/`secondary`
   = fantasma (superficie 2 con borde `--line`, borde `--flame` al pasar el mouse); `destructive` y
   `destructiveSolid` = peligro con `--danger`; `ghost`, `link`, tamaños `sm`/`xs`/`icon*`. Estados:
   reposo, hover, activo (baja 1px), foco, deshabilitado, cargando.
2. **Input, textarea** (`ui/input.tsx`, `ui/textarea.tsx`): fondo `--surface-2`, borde `--line`,
   borde `--flame` al enfocar, estado `aria-invalid` con `--danger`, texto de ayuda debajo.
3. **Chip de estado** (`ui/stamp.tsx` y `ticket-status-stamp.tsx`): punto + texto. Tonos: `queue`
   (gris), `washing` (naranja, punto latiendo), `ready` (`--go`), `paid` (tenue), `void`
   (`--danger`), más los neutros que usan Activo/Inactivo. El latido respeta
   `prefers-reduced-motion`. Mapa de tickets: `OPEN` → «Abierto» latiendo, `READY` → «Listo»,
   `PAID` → «Cobrado» tenue, `VOID` → «Anulado». Las etiquetas no cambian.
4. **Chip de placa** (`ui/plate-chip.tsx`, nuevo): mono, negrita, `letter-spacing: .06em`, fondo
   `--plate-bg`, borde `--line`. Se usa donde aparezca una placa (fila, detalle, pista, resumen).
5. **Fila de lista** (`ui/data-table.tsx`): misma API declarativa (`columns`, `stack`, `reference`,
   `isLoading`, `errorMessage`), nuevo render: en escritorio cada fila es una tarjeta en rejilla CSS
   (radio 12, separación 10, cabecera de columnas encima); bajo 900px se apila con los rótulos por
   `stack`. Sin `<table>`. Nuevos props `emptyTitle` y `emptyAction` para el estado vacío.
6. **Tabs** (`ui/tabs.tsx`, nuevo, sobre `role=tablist`): subrayado con degradado y contador al lado.
   Reemplaza los botones a mano de `/carwash`.
7. **Tarjeta de estadística** (`ui/stat-card.tsx`, nuevo): etiqueta arriba, cifra Saira itálica.
8. **Medidor de segmentos** (`ui/segment-gauge.tsx`, nuevo): arco con `stroke-dasharray: 5 4.5`,
   pista y valor con degradado. Solo para «X de Y».
9. **Selector de tipo de vehículo** (`BodyTypeCard` en `ticket-form.tsx`): tres tarjetas con icono
   de perfil (los tres SVG del prototipo, mismo trazo 1.6), nombre (peso fijo), precio «desde $X»
   real del catálogo y modelos de ejemplo. Seleccionado = borde `--flame` + fondo tintado +
   palomita. `role=radiogroup` navegable con flechas.
10. **Modal / hoja lateral** (`ui/dialog.tsx`): lenguaje de tarjeta (radio 14, sombra única); en
    móvil sube desde abajo.
11. **Estado vacío** (`ui/empty-state.tsx`, nuevo): borde punteado, título, frase que explica qué va
    a aparecer, botón de acción opcional. Nunca «No hay datos» a secas. Lo usa `DataTable` y la fila
    de la pista.
12. **Toast** (`ui/toast.tsx` + provider, nuevo, sobre `radix-ui` Toast): verde éxito, rojo error.
    **Aditivo**: confirma mutaciones que salen bien (cobrado, guardado, creado, eliminado, marcado
    listo, reabierto, anulado). Los errores siguen imprimiéndose donde ocurren, con `role=alert`;
    no se duplican en toast.
13. **Menú lateral** (`nav-rail.tsx`, `nav-bottom-bar.tsx`): azul marino en los dos temas, grupos
    con encabezado, barra de llama a la izquierda del ítem activo, **contador** a la derecha de
    «Lavados» (pendientes `OPEN,READY` del día, solo si hay `carwash.read`; reutiliza `useTickets`),
    pie con usuario y cambio de tema, plegado conservado. Bajo 900px: barra inferior fija con iconos
    y etiquetas cortas, ítem activo con línea arriba.
14. **Logo** (`brand/logo.tsx`, reemplaza a `LogoPlaceholder`): la marca del prototipo (arco
    segmentado con degradado + aguja + wordmark «ELITE / SERVICE» en Saira). Sustituye el recuadro
    «Logo pendiente» en login, pista, riel y `/design`. **Sigue pendiente el vectorial original del
    taller**: cuando llegue, se cambia en un solo archivo.

## Pantalla por pantalla

### Login (`/login`, `/floor/login`)

Fondo azul marino con el arco del medidor insinuado detrás de la tarjeta, muy tenue. Logo centrado.
Tarjeta con correo, contraseña con **mostrar/ocultar** (solo visual: el campo sigue siendo el mismo),
botón primario a todo el ancho, y **espacio reservado** para el mensaje de error para que el
formulario no salte. El login de pista usa la misma tarjeta con Usuario y PIN.

### Lavados (`/carwash`)

- Encabezado con título, **fecha y hora actual** como subtítulo, acciones a la derecha.
- Franja de cuatro estadísticas calculadas en el cliente a partir de la consulta «Todos» (hoy):
  en cola (`OPEN`), listos para cobrar (`READY`), cobrado hoy (suma de `total` de `PAID`), y el
  medidor **«Avance del día»: cobrados X de Y** (Y = lavados de hoy no anulados). No existe una
  capacidad diaria en los datos; ver _Propuestas_.
- Pestañas Pendientes / Listos para cobrar / Todos con **contador real**, sobre el mismo filtro de
  hoy.
- Fila: referencia, placa como chip, cliente con servicios y tipo debajo, lavador («Oficina» si no
  hay), chip de estado, total mono, **acción principal contextual** más el enlace «Abrir» que ya
  existe:
  - `OPEN` + `carwash.manage` → «Marcar listo» (fantasma; misma mutación que el detalle).
  - `READY` + `carwash.charge` → **«Cobrar»** (el único primario de la lista; abre el mismo
    `ChargeDialog`).
  - `PAID` → «Ver recibo» (va al detalle). `VOID` → «Ver».
  - Sin el permiso correspondiente, solo «Abrir».
- Estado vacío distinto por pestaña: Pendientes «Nada pendiente…», Listos «Nada por cobrar…»,
  Todos «Hoy no hay lavados…», cada uno con la frase de qué aparecerá y «Nuevo lavado» si hay
  `carwash.manage`.
- No hay barra de avance: no existe dato de progreso (ver _Propuestas_).

### Nuevo lavado (`/carwash/new`, `/floor/new`)

Ya es pantalla completa; se conserva la ruta. Rejilla `1fr 340px` con **resumen fijo** a la
derecha (estático bajo 1180px): chip de placa en vivo, tipo, cliente, cada servicio elegido con su
precio, total grande en Saira, botón «Abrir lavado» abajo y la nota «Entra a la fila como Abierto.
El cobro se hace en oficina.». Secciones: Carro y cliente → Tipo de vehículo → Servicios → Lavador
(solo oficina) → Nota. Los precios de los servicios **se actualizan en vivo** al cambiar el tipo
con la matriz real. En la pista, el primario también vive en el resumen (que en móvil queda al
final, a todo el ancho).

### Catálogo (`/settings/catalog`)

Filas con referencia, nombre + código, categoría como chip, y columnas Base · Sedán · Camioneta ·
Pick up (una por tipo de carro real). Los precios que **difieren del base** van en `--flame-hot`
y peso 700; los iguales, normales. La nota del guion **solo se muestra si hay alguna celda con
guion**. Subtítulo real: «N servicios activos · precios con IVA incluido». En móvil, tarjeta con
pares etiqueta/valor. Se conservan editar y activar/desactivar. No existe «Nuevo servicio» ni
crear categorías: no se inventan (ver _Propuestas_).

### Empleados, Usuarios, Roles

Mismo patrón de lista, estado vacío propio con su acción, diálogos con la piel nueva, botón de
peligro en el borrado de rol. La matriz de permisos **conserva su estructura**: solo cambia la
piel (fondo, bordes, casillas, cabecera).

### Cobro / recibo

Existe como diálogo de cobro y como bloque «Cobro» en el detalle. Se migran. No existe pantalla de
recibo imprimible: no se inventa (ver _Propuestas_).

### Pista (`/floor/*`)

Misma piel, densidad `bahia`, láminas grandes (`FloorQueue`), chips de placa y estado, primario
de 48px. La barra superior «Pista · nombre · Salir» se conserva.

### `/design`

Se reescribe como referencia del sistema nuevo: tokens de los dos temas, tipografía, chips, chip
de placa, botones, campos, tabs, tarjeta de estadística, medidor, estado vacío, toast y densidad.

## Accesibilidad (mínimo)

- Contraste AA (4.5:1) en texto normal, verificado para `--text-faint` sobre `--surface` en los dos
  temas y para el texto de cada chip sobre su tinte.
- El estado nunca se comunica solo con color: el chip siempre lleva la palabra.
- Tipo de vehículo y método de pago son grupos de radio de verdad (`role=radiogroup`,
  `aria-checked`, flechas). Servicios y lavador conservan sus semánticas actuales.
- Todo lo interactivo se alcanza con Tab y se activa con Enter o Espacio.
- `prefers-reduced-motion: reduce` apaga el latido y las transiciones.

## Fuera de alcance

- Cualquier cambio de comportamiento, ruta, contrato o dato (ver _Propuestas_).
- Recibo imprimible, cierre de caja, capacidad diaria, asignación de lavador a posteriori.
- El vectorial original del logo.

## Propuestas de cambio funcional (NO aplicadas)

1. **Capacidad del día**: definir un techo diario (configurable) para que el medidor mida
   «lavados de hoy de N» en vez de «cobrados de lavados de hoy».
2. **Barra de avance en «lavando»**: requiere duración estimada por servicio en el catálogo
   (`Service.durationMinutes`) y hora de inicio del lavado.
3. **Estado «lavando» separado de «en cola»**: hoy `OPEN` cubre ambos. Un estado `WASHING` (o la
   asignación de lavador como señal) permitiría la acción «Asignar lavador».
4. **Placa obligatoria y cliente opcional** en el alta (el brief lo describe así; hoy el nombre del
   cliente es obligatorio en front y en `TICKET_INCOMPLETE`).
5. **Tiempo estimado** en el resumen del alta: depende de la propuesta 2.
6. **Nuevo servicio y categorías** desde la UI del catálogo (el API ya lo permite).
7. **Recibo** imprimible / compartible tras cobrar.
8. **Cerrar caja**: no existe el módulo de caja (spec 003, fuera de alcance).
9. **Olvidé mi contraseña**: no existe la función.
10. **Confirmación antes de «Anular»**: hoy es inmediato y no se puede deshacer.
11. **Búsqueda, orden y paginación** en las listas cuando crezcan.
12. **Persistir el plegado del riel** entre recargas.
13. **`loading` en los botones de mutación** (marcar listo, reabrir, anular, cobrar, guardar) los
    deshabilita mientras corre la petición. Evita el doble envío, pero es un cambio de
    comportamiento mínimo: se quita en una línea por botón si no se quiere.
14. **`useCatalogCategories` quedó sin uso**: el subtítulo del catálogo ya no cuenta categorías. Se
    conserva el hook; borrarlo requiere confirmación.
15. **Un `[data-theme="dark"]` explícito en `globals.css`** permitiría fijar una muestra en oscuro
    dentro de `/design` cuando el tema activo es el claro (hoy el oscuro vive solo en `:root`).
16. **Etiquetas cortas propias para la barra inferior** (`shortLabel` en `NavItem`) en vez de
    depender del tamaño de letra para que «Empleados» entre a 390px.

## Tareas

Orden de entrega, cada paso verificable con `pnpm build`, `pnpm lint` y captura en oscuro y claro,
escritorio y 390px.

- [x] **1. Tokens y tipografía.** `globals.css` con los tokens de arriba (oscuro en `:root`, claro
      en `.light`), alias a shadcn, `--danger`/`--warn` documentados con contraste, radios, sombra,
      breakpoints 900/1180, foco de 2px `--flame-hot`. `Saira` + `Inter` con `next/font/google`.
      `defaultTheme="dark"`. `DESIGN.md` reescrito. ADR nuevo en `docs/ARCHITECTURE.md`
      (tipografía y dirección visual). `apps/web/AGENTS.md` actualizado (fuentes, toasts,
      cortes). Cero hex fuera de `globals.css`.
- [x] **2. Componentes base.** Botón, input/textarea, chip de estado con latido, chip de placa,
      `DataTable` como filas-tarjeta con estado vacío, tabs, tarjeta de estadística, medidor,
      estado vacío, toast + provider, diálogo, riel/barra inferior/shell/`ScreenHeader`, logo.
- [x] **3. Login** admin y pista.
- [x] **4. Lavados**: estadísticas, pestañas con contador, fila con acción contextual, vacíos por
      pestaña, detalle y diálogo de cobro; fila y detalle de la pista.
- [x] **5. Nuevo lavado**: `TicketForm` en dos columnas con resumen fijo, selector de vehículo
      accesible, precios en vivo; sin la duración inventada.
- [x] **6. Catálogo**: precios distintos al base en naranja, nota condicional, subtítulo real.
- [x] **7. Empleados, Usuarios, Roles** y `/design`.
- [x] **8. Repaso**: modales, confirmaciones, toasts, estados de carga y error sueltos; auditoría
      de hex, `lg:`, `console.error`; capturas finales; lista de propuestas entregada aparte.

## Verificación

Hecha el 2026-09-02 sobre el stack levantado (`docker compose`, api en 3200, web en 3100).

- `pnpm build` compila (shared, api y las 15 rutas de la web). `pnpm lint` limpio. `pnpm test`:
  21 suites, 165 tests en verde.
- `grep -rnE "#[0-9a-fA-F]{3,8}\b|rgb\(|oklch\(" apps/web/src` → sin resultados: todos los
  colores viven en `globals.css`.
- Contrastes medidos (script en el scratchpad, valores en `DESIGN.md`): `--text-faint` 4.91:1
  oscuro / 5.28:1 claro sobre superficie; texto de cada chip ≥ 4.26:1 sobre su tinte; `--danger`
  con blanco encima 7.14:1. Excepción documentada: el texto blanco sobre la mitad clara del
  degradado de acción (3.61:1 en `--flame`), mantenido por ser la dirección aprobada del prototipo.
- **Capturas** en `docs/reviews/005/`: 49 imágenes tomadas con Chrome sin ventana por el protocolo
  de DevTools (1440px y 390px, oscuro; claro en las pantallas principales), con datos reales creados
  por el API (seis lavados en los cuatro estados, dos empleados). Cubren login (admin y pista),
  lavados (Pendientes y Listos), nuevo lavado, detalle en `OPEN`/`READY`/`PAID`, diálogo de cobro,
  catálogo y su diálogo, empleados y su diálogo, usuarios y su diálogo, roles y la matriz, la fila,
  el alta y el detalle de la pista, y `/design`.
- Defectos encontrados en la revisión visual y corregidos en el mismo paso: el valor largo de una
  columna `field` se desbordaba en la tarjeta móvil del `DataTable`; el `DensityProvider` pisaba a
  `mostrador` la densidad `bahia` de la pista en escritorio con puntero fino (ahora el shell de pista
  lleva `data-density="bahia"` en su contenedor, sin carrera); la etiqueta «Empleados» de la barra
  inferior se cortaba a 390px; el spinner del botón tapaba el texto «Entrando…» / «Guardando…»
  (ahora va al lado); `Button` con `asChild` recibía dos hijos.
- Inventario recorrido por los agentes de cada pantalla leyendo el código final (ver los
  reportes resumidos en las tareas 3 a 7): permisos, condiciones de estado, textos, validaciones,
  redirecciones y hooks sin cambios. El usuario con solo `carwash.read` + `carwash.charge` no se
  probó a ojo en esta ronda; la lógica de permisos no se tocó.
- Pendiente fuera de esta spec: el vectorial original del logo (se reemplaza en `brand/logo.tsx`).
