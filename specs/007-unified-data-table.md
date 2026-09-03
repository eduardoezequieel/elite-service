# 007 — Tabla unificada en pantallas principales

**Estado:** Terminada
**Módulo:** web (transversal) | **Depende de:** spec 005 terminada

## Contexto

El rediseño visual (spec 005) implementó las listas del sistema (`DataTable`) como filas-tarjeta
individuales con rejilla CSS en escritorio (`gap-2.5` entre filas y cabecera flotante). En la práctica,
esto provocó que las columnas de datos se desalinearan de los encabezados (por ejemplo en `/carwash`,
donde cada fila calcula independientemente el ancho de sus columnas `auto`). Además, en pantallas
como `/settings/roles` se generó una disparidad visual: la lista de roles usa tarjetas flotantes
desconectadas mientras que la matriz de permisos (`PermissionMatrix`) dentro del diálogo usa una
tabla continua, contenida y limpia.

Esta spec unifica el diseño de `<DataTable>` en escritorio (≥900px) adoptando una lámina contenedora
única con tabla HTML nativa, cabecera `bg-surface-2` y filas continuas con hover, resolviendo la
desalineación de columnas y conservando el apilado táctil en pantallas móviles y tablets (<900px).

## Historias

- Como usuario en escritorio (mostrador o administración), quiero que las tablas del sistema tengan
  sus cabeceras y columnas de datos perfectamente alineadas verticalmente, para poder escanear
  rápidamente folios, clientes, estados y montos sin confusión visual.
- Como usuario del sistema, quiero que todas las pantallas principales (Lavados, Roles, Usuarios,
  Empleados, Clientes, Catálogo) compartan el mismo estilo de tabla contenida y pulida que ya tiene
  la matriz de permisos, para una experiencia visual consistente.
- Como usuario en tablet o móvil (<900px / bahía), quiero que las listas sigan apilándose en tarjetas
  táctiles accesibles con botones de al menos 44px, sin depender de un ratón.

## Criterios de aceptación

- **Dado** un usuario que navega en escritorio (≥900px) a cualquier pantalla con lista (`/carwash`,
  `/settings/roles`, `/settings/users`, `/settings/employees`, `/customers`, `/settings/catalog`),
  **cuando** la lista tiene filas cargadas,
  **entonces** se visualiza dentro de una lámina única con borde `border-line-soft`, fondo `bg-surface`,
  radio `rounded-row` y sombra `shadow-elite`.
- **Dado** una tabla en escritorio,
  **cuando** se observan los encabezados y las celdas de cualquier columna,
  **entonces** la cabecera `thead` tiene fondo `bg-surface-2` con borde inferior `border-line`, y cada celda
  se alinea exactamente bajo su encabezado (`text-left` para texto, `text-right` para números/montos y acciones).
- **Dado** una fila de la tabla en escritorio,
  **cuando** el puntero pasa sobre ella,
  **entonces** la fila completa resalta con fondo `hover:bg-surface-2` y transición suave de color.
- **Dado** un dispositivo móvil o tablet con pantalla menor a 900px,
  **cuando** se visualiza una lista,
  **entonces** se mantiene la vista de tarjetas apiladas con la referencia arriba, datos rotulados y
  acciones al pie a todo el ancho.
- **Dado** un cambio en la densidad activa (`mostrador` vs `bahia`),
  **cuando** cambia `--row-h`,
  **entonces** la altura mínima de las filas de la tabla responde dinámicamente (`h-row`).

## Reglas de negocio

- **RN-1:** La referencia (`#14`) sigue siendo siempre la primera columna visible en escritorio y la
  cabecera de la tarjeta en móvil.
- **RN-2:** Las acciones de fila permanecen siempre visibles; ninguna acción se oculta detrás de un `hover`.
- **RN-3:** Los estados de la lista (`loading`, `empty`, `error`) conservan sus textos y componentes
  unificados (`EmptyState`, mensaje de error con `role="alert"`).

## Permisos

No introduce nuevos permisos ni modifica los existentes.

## UI

- `<DataTable>` (`apps/web/src/components/ui/data-table.tsx`):
  - Escritorio (≥900px): Contenedor con `border-line-soft bg-surface shadow-elite overflow-x-auto rounded-row border hidden md:block`.
  - Elemento `<table>` nativo con `thead` (`bg-surface-2 border-b border-line`) y `tbody` (`border-b border-line-soft last:border-b-0`).
  - Celdas con `h-row px-3 align-middle text-dense` y alineación coherente.
  - Táctil (<900px): Tarjeta apilada en bloque `md:hidden`.
- `/carwash`: Columna `customer` con `headerClassName: 'w-full'` para expandirse y fijar anchos ordenados en las demás columnas.
- Actualización de `DESIGN.md` y `AGENTS.md` para reflejar la convención de tabla unificada.

## Fuera de alcance

- Paginación o virtualización de listas (las listas actuales manejan el volumen de operación del taller).
- Cambios en endpoints del backend o contratos de datos de `@elite/shared`.
- Alteraciones a la fila de la pista (`/floor`), que usa láminas táctiles propias (`FloorQueue`).

## Tareas

- [x] **1. Componente `<DataTable>`.** Reemplazar en escritorio las tarjetas individuales por la tabla HTML unificada con contenedor enmarcado, cabecera `bg-surface-2` y filas con separadores sutiles y hover. Conservar intacto el apilado táctil móvil.
- [x] **2. Ajuste de columnas en pantallas.** Asegurar distribución óptima de anchos en `/carwash` y pantallas dependientes.
- [x] **3. Documentación.** Actualizar `DESIGN.md`, `AGENTS.md` y la referencia en `/design`.
- [x] **4. Verificación.** Ejecutar `pnpm build`, `pnpm lint`, `pnpm test`, y verificar alineación y comportamiento responsive (escritorio, tablet y 390px).

## Verificación

- `pnpm build`: compila shared, api y las 16 rutas de web sin errores.
- `pnpm lint`: linter limpio sin warnings.
- `pnpm test`: 25 suites y 192 tests en verde.
- Comprobación visual mediante capturas en escritorio (1280px) y móvil (390px) validando la tabla unificada en `/design` y la perfecta alineación de columnas.
