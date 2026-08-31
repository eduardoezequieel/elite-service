# 003 — Consistencia de tablas, controles bloqueados y rastro de migas

**Estado:** En desarrollo
**Módulo:** web (transversal) | **Depende de:** 002, 001

## Contexto

Con las pantallas de la spec 001 en pantalla se ven tres problemas de forma, no de lógica:
la tabla de usuarios y la de roles se dibujan distinto (una va suelta dentro de una lámina de la
pantalla, la otra trae su propia lámina y su propia pila táctil), el control «Eliminar» bloqueado
se dibuja como una caja muerta rayada que se lee como un fallo de pintado, y no hay nada arriba del
contenido que diga dónde está parado el usuario. Esta spec unifica esas tres cosas **sin tocar
backend, permisos ni datos**.

## Historias

- Como cualquier usuario, quiero que todas las tablas del sistema se vean y se operen igual, para
  no tener que aprender cada pantalla por separado.
- Como administrador, quiero que ningún botón se vea como un control roto, para saber siempre qué
  puedo tocar y por qué algo no se puede hacer.
- Como cualquier usuario, quiero ver arriba del contenido en qué parte del sistema estoy, para
  volver atrás sin adivinar.

## Criterios de aceptación

- **Dado** `/settings/users` y `/settings/roles`, **cuando** las comparo lado a lado en el mismo
  ancho, **entonces** las dos usan la misma lámina, la misma franja de cabecera, la misma columna
  de referencia, el mismo alto de fila y el mismo bloque de acciones.
- **Dado** cualquiera de esas dos pantallas bajo 768px, **cuando** la miro, **entonces** las filas
  se apilan como fichas numeradas dentro de la misma lámina —nunca scroll horizontal a ciegas— y el
  contenido de toda columna oculta sigue visible como par etiqueta/valor.
- **Dado** un rol que todavía tienen usuarios asignados, **cuando** miro su fila, **entonces** no
  hay ningún control muerto ni trama rayada: el botón «Eliminar» está vivo y es el diálogo de
  confirmación el que explica que no se puede y qué hacer primero (RN-6 de la spec 001 se sigue
  respetando en el API).
- **Dado** un botón deshabilitado por estado transitorio —un envío en curso—, **cuando** lo miro,
  **entonces** se muestra con relleno neutro y cursor de no permitido, **nunca** con opacidad
  reducida ni con la trama diagonal.
- **Dado** cualquier pantalla del área autenticada, **cuando** carga, **entonces** arriba del
  contenido hay un rastro de migas que nombra la sección y la pantalla actual, la actual marcada
  con `aria-current="page"` y las anteriores navegables.
- **Dado** el rastro de migas en densidad `bahía`, **cuando** lo toco, **entonces** cada enlace
  tiene un área táctil de al menos 44×44.

## Reglas de negocio

- **RN-1:** La tabla es un solo componente del sistema. Una pantalla declara columnas; no vuelve a
  dibujar una tabla a mano ni inventa su propia versión táctil.
- **RN-2:** Ningún control se deshabilita bajando la opacidad. Lo que no se puede hacer **ahora** se
  ve con relleno neutro; lo que no es del usuario **no se renderiza**; lo que está fuera de servicio
  como superficie lleva la trama de 45°. La trama es para superficies y campos, nunca para un botón.
- **RN-3:** El rastro de migas se deriva de la ruta, no se escribe a mano en cada pantalla.

## Permisos

No introduce ninguno. El rastro de migas solo nombra rutas a las que el usuario ya llegó.

## Datos

Sin cambios.

## API

Sin cambios.

## UI

- `components/data-table/data-table.tsx` — la tabla del sistema. Recibe columnas y filas; dibuja la
  lámina, la franja de cabecera, la columna de referencia, el estado de carga, el de error y el
  vacío, y la forma apilada bajo `md`. Cada columna declara qué papel juega al apilarse
  (`title`, `meta`, `field`, `actions`, `hidden`).
- `components/app-shell/breadcrumbs.tsx` — el rastro de migas, derivado de la ruta.
- `components/app-shell/page-header.tsx` — la cabecera de pantalla: título, línea de contexto y
  acciones a la derecha.
- `features/users/components/users-table.tsx` y `features/roles/components/roles-table.tsx` pasan a
  ser solo definiciones de columnas.
- `components/ui/button.tsx` — tratamiento de deshabilitado del sistema, sin opacidad.
- `DESIGN.md` gana la sección del rastro de migas y corrige la regla de bloqueo; `AGENTS.md` de web
  registra las dos convenciones nuevas.

## Fuera de alcance

- Ordenamiento, filtrado, paginación y selección múltiple en la tabla: llegan con la spec que los
  necesite.
- Cualquier cambio de backend, de permisos o de contrato.

## Tareas

- [x] `DataTable` del sistema, con lámina, franja de cabecera, referencia, estados y forma apilada.
- [x] `users-table` y `roles-table` reescritas como definiciones de columnas.
- [x] Botón: deshabilitado con relleno neutro, sin opacidad; se quita el falso «Eliminar» rayado.
- [x] `Breadcrumbs` derivado de la ruta, montado en el armazón.
- [x] `PageHeader` en las dos pantallas de administración.
- [x] La matriz de permisos usa las primitivas de tabla del sistema.
- [x] `DESIGN.md` y `apps/web/AGENTS.md` actualizados en el mismo commit.
- [x] `pnpm build`, `pnpm lint` y `pnpm test` limpios.
- [ ] Verificación visual en ancho de tablet y de teléfono, y en densidad `bahía`. **Pendiente:**
      falta abrir las pantallas en el navegador; no se pudo hacer desde esta máquina.
