# 094 — Espacios de trabajo: Lavado, Renta de carros y Administración

**Estado:** Aprobada (por chat, 1 oct 2026: «Vaya, si vas a arrancar. Quiero que desplegues
agentes Opus … El entregable debería de ser que tengamos implementado todas las funcionalidades
del prototipo»)
**Módulo:** app-shell (web), permissions (shared) | **Depende de:** 068, 088

## Contexto

Elite Service pasa a atender dos negocios de la misma familia: el lavado (lo que existe hoy) y la
rentadora Riveras Rent a Car, cuyo prototipo HTML (Supabase, un solo archivo) se reescribe acá con el
diseño del carwash. Son dos empresas con NIT distinto: comparten login, usuarios y roles, y **nada
más**. Cada una tiene su caja, sus clientes, sus cuentas bancarias y sus reportes.

Esta spec abre la puerta: el riel se organiza por **espacio de trabajo**, con un selector arriba
(referencia: selector «Espacio de trabajo» con nombre, subtítulo y check en el activo), y nace el
espacio «Renta de carros» con su permiso y su pantalla de inicio vacía. Las specs siguientes lo
llenan: flota y clientes de renta (095), rentas con calendario e inspección (096), contrato
imprimible (097), dinero y caja de renta (098), mantenimiento y gastos (099), rentabilidad (100).

## Historias

- Como usuario con permisos en el lavado y en la rentadora, quiero cambiar de espacio desde el
  riel, para ver solo las pestañas del negocio que estoy atendiendo.
- Como cajero con permisos de un solo negocio, quiero que el riel se vea como hoy, para no ver un
  selector que no elige nada.
- Como dueño, quiero que «Usuarios» y «Roles» vivan en su propio espacio «Administración», para que
  lo que es común a los dos negocios no cuelgue del lavado.

## Criterios de aceptación

- **Dado** un usuario con `carwash.read` y `rentals.read`, **cuando** abre `/carwash`, **entonces**
  el riel muestra el selector con «Lavado» activo y solo las pestañas del espacio Lavado.
- **Dado** ese usuario, **cuando** elige «Renta de carros» en el selector, **entonces** navega a
  `/rentals` y el riel muestra solo las pestañas de ese espacio, con «Renta de carros» marcado.
- **Dado** un usuario con permisos de un solo espacio, **cuando** abre cualquier pantalla,
  **entonces** el selector **no se renderiza** y el riel es idéntico al actual.
- **Dado** un usuario con `users.read` y `carwash.read`, **cuando** abre `/settings/users`,
  **entonces** el espacio activo es «Administración» y el riel muestra Usuarios (y Roles si tiene
  `roles.read`), no las pestañas del lavado.
- **Dado** el riel plegado, **cuando** hay selector, **entonces** queda como botón de icono con el
  nombre del espacio en `aria-label`, y el menú abre igual.
- **Dado** ancho menor a 900px, **cuando** hay selector, **entonces** los espacios aparecen como
  grupo dentro del menú «Más» de la barra inferior; la barra solo pone las pestañas del espacio
  activo.
- **Dado** un usuario con solo `rentals.read`, **cuando** inicia sesión, **entonces** cae en
  `/rentals` y ve la pantalla de inicio vacía del espacio.
- **Dado** `/rentals`, **cuando** se abre con `rentals.read`, **entonces** muestra `ScreenHeader`
  «Renta de carros» y un estado vacío que dice que la flota se carga en la siguiente etapa; sin
  `rentals.read`, `RequirePermission` lo bloquea como en cualquier pantalla.

## Reglas de negocio

- **RN-1:** Un espacio de trabajo es un **dato** (`WORKSPACES` en `nav-items.ts`), no una ruta ni
  un estado guardado: cada `NavSection` declara a qué espacio pertenece y el espacio activo es el
  de la pestaña activa (`isNavItemActive`). Si ninguna pestaña cubre la ruta, es el primer espacio
  permitido.
- **RN-2:** Un espacio se ve si el usuario tiene **al menos una pestaña** permitida adentro. Sin
  pestañas, el espacio no existe para ese usuario (misma regla que las pestañas: ausente, no
  deshabilitado).
- **RN-3:** Elegir un espacio navega a su **primera pestaña permitida**. No hay «pantalla del
  espacio» distinta de sus pestañas.
- **RN-4:** Reparto inicial: **Lavado** = Operación (Lavados, Caja, Ventas, Rendimiento, Clientes,
  Inventario) + Configuración (Catálogo, Cuentas bancarias, Empleados). **Renta de carros** =
  Inicio (`/rentals`). **Administración** = Usuarios, Roles. Cuentas bancarias y empleados se
  quedan en Lavado porque son del lavado; la rentadora tendrá los suyos (098).
- **RN-5:** El orden de login no cambia: `firstAllowedHref` recorre los espacios en el orden
  Lavado → Renta de carros → Administración.
- **RN-6:** Nada se comparte entre negocios salvo sesión, usuarios y roles. Esta spec no toca
  datos ni API más allá del permiso nuevo.

## Permisos

| Clave          | Descripción                                   |
| -------------- | --------------------------------------------- |
| `rentals.read` | Ver el espacio de renta de carros y su inicio |

Grupo `rentals` («Renta de carros») en `PERMISSIONS`; las acciones siguientes las agregan las specs
095 a 100. El seed lo sincroniza solo.

## Datos

Ninguno.

## API

Ninguno nuevo. `GET /permissions` devuelve el grupo nuevo por el catálogo compartido.

## UI

- **`WorkspaceSwitcher`** (`components/app-shell/workspace-switcher.tsx`): rótulo «Espacio de
  trabajo» en `text-label` tenue, botón con icono del espacio + nombre + `ChevronsUpDown`, menú
  `DropdownMenu` con un ítem por espacio (icono, nombre, subtítulo en una línea, `Check` en el
  activo). Colores del riel (`text-rail-*`, fondos `white/x`), alto `TAB_HEIGHT`. Plegado: solo
  icono. Sin «Ver resumen general» (fuera de alcance).
- **`NavRail`**: el selector va entre el logo y los grupos; los grupos listados son los del espacio
  activo. Con un solo espacio no se renderiza y el riel queda como hoy.
- **`NavBottomBar`**: pestañas del espacio activo; en «Más», un grupo «Espacio de trabajo» con los
  espacios, antes de tema y densidad.
- **`/rentals`** (`app/(app)/rentals/page.tsx`, `features/rentals/components/rentals-home.tsx`):
  `ScreenHeader` «Renta de carros» con subtítulo «Flota, rentas y contratos» y `EmptyState` con
  icono `KeyRound`: «Todavía no hay flota. Los carros se cargan en la siguiente etapa.» Sin botón.
- Iconos: Lavado `Droplets`, Renta de carros `KeyRound`, Administración `Settings2`.
- Subtítulos: «Lavados, caja, clientes e inventario» · «Flota, rentas y contratos» · «Usuarios y
  roles».

## Fuera de alcance

- «Ver resumen general» del dueño (tablero de los dos negocios).
- Recordar el último espacio entre sesiones.
- Cualquier dato, API o enum de la rentadora (`BusinessArea.RENTALS` llega con la 095).
- Cambiar el nombre del producto o el logo del riel por espacio.

## Tareas

- [x] `packages/shared/src/permissions.ts`: grupo `rentals` con `read`.
- [x] `nav-items.ts`: tipo `Workspace` (`key`, `label`, `description`, `icon`), `WORKSPACES`,
      campo `workspace` en `NavSection`, `useWorkspaces()` (permitidos + activo) y
      `useNavSections()` devolviendo solo las del espacio activo. `firstAllowedHref` sin cambios de
      orden.
- [x] `nav-items.spec.ts`: espacio activo por ruta, espacio ausente sin pestañas, un solo espacio
      → sin selector, login de `rentals.read` → `/rentals`.
- [x] `workspace-switcher.tsx` nuevo; `nav-rail.tsx` y `nav-bottom-bar.tsx` lo integran.
- [x] `/rentals` con `RequirePermission` y la pantalla vacía.
- [x] `apps/web/DESIGN.md` → «Menú lateral y barra inferior»: el selector de espacio. `PRODUCT.md`
      y `AGENTS.md` raíz: el sistema atiende lavado y renta de carros; clientes, caja y cuentas
      separados por negocio.
- [x] `pnpm build && pnpm lint && pnpm test` en verde.

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
```

Sin script propio: no agrega endpoints. La comprobación visual del selector (riel, plegado, barra
inferior) la hace el usuario.
