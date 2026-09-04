# 008 — Enlace de regreso en toda pantalla hija

**Estado:** Terminada
**Módulo:** web (transversal) | **Depende de:** spec 001 terminada, spec 005 terminada

## Contexto

Entrar a una pantalla que vive dentro de otra y no encontrar la salida. Eso es lo que arregla esta
spec.

El rastro de ficha (`PageBreadcrumb`, spec 001) existe y se deriva solo del riel, sin mapa que
mantener. Pero el árbol de rutas del sistema es de **un solo nivel**: `/settings/catalog`,
`/settings/users` y los demás son destinos del riel, no hijos de nada —`/settings` ni siquiera
existe como página—. Así que el rastro nunca dibuja más de un tramo, y ese tramo único va pintado
como miga: `text-label` de 12px en `--text-faint`. Un susurro, no una salida.

Peor: la pista (`/floor`) no dibuja nada. El rastro deriva de `NAV_ITEMS` y `/floor` no está ahí
—no es una pestaña del riel—, así que `/floor/new` y `/floor/[id]` se quedan sin ningún camino de
vuelta arriba. Y es el peor sitio para que falte: la pista se trabaja de pie, en tablet, sin riel y
sin barra inferior.

La maquinaria de migas resuelve un problema que esta app no tiene. Se cambia por lo que la app sí
necesita: un enlace de regreso al padre, legible y tocable.

## Historias

- Como usuario con `carwash.read`, quiero volver a la lista de lavados desde la ficha de un lavado
  con un solo toque visible arriba, para no quedarme atrapado en la ficha.
- Como lavador en la pista, quiero volver a la fila desde la ficha de un carro sin buscar, para no
  perder tiempo de pie con la tablet en la mano.
- Como usuario que llega por un enlace directo o recarga la página, quiero que la salida siga
  estando, para que volver no dependa de cómo llegué.

## Criterios de aceptación

- **Dado** un usuario en una pantalla hija (`/carwash/new`, `/carwash/[id]`, `/customers/[id]`,
  `/floor/new`, `/floor/[id]`), **cuando** mira la cabecera, **entonces** ve encima del título un
  enlace con una flecha a la izquierda y el nombre de la pantalla padre, y al tocarlo llega a esa
  pantalla padre.
- **Dado** un usuario en una pantalla de primer nivel (`/carwash`, `/customers`, las cuatro de
  `/settings/*`, `/floor`), **cuando** mira la cabecera, **entonces** **no** hay enlace de regreso:
  el riel —o la cabecera de pista— ya dice dónde está.
- **Dado** un usuario que abre `/carwash/[id]` por URL directa o recarga estando ahí, **cuando**
  carga la pantalla, **entonces** el enlace de regreso está igual que si hubiera llegado navegando.
- **Dado** un usuario que acaba de crear un lavado y el sistema lo llevó a la ficha con
  `router.replace`, **cuando** toca el enlace de regreso, **entonces** llega a la lista de lavados
  y no al formulario de alta que ya no existe.
- **Dado** un dispositivo en densidad `bahia`, **cuando** se mide el enlace de regreso, **entonces**
  su área tocable es de al menos 44px de alto (`--touch-min`).
- **Dado** el tema claro o el oscuro, **cuando** se mira el enlace, **entonces** se lee sin perder
  contraste: usa `--text-dim` y pasa a `--text` al apuntarlo.

## Reglas de negocio

- **RN-1: El regreso es estructural, no histórico.** El enlace lleva siempre al padre de la ruta,
  nunca a `router.back()`. El historial miente cuando se llega por enlace directo, tras una recarga
  o después de un `router.replace`; la ruta no.
- **RN-2: Se sigue derivando, no se registra.** El padre sale de las raíces conocidas
  (`NAV_ITEMS` más la pista). Agregar una subpantalla no obliga a registrarla en ningún lado.
- **RN-3: La pista es la excepción declarada.** `/floor` no es una pestaña del riel, así que su raíz
  se declara aparte, en un único sitio y con su comentario. Es la única raíz que no sale del riel.
- **RN-4: Un solo tramo.** Se nombra al padre, no a toda la cadena. Si algún día una ruta tiene dos
  niveles de ancestros, el enlace apunta al más cercano.

## Permisos

No introduce ni modifica permisos.

## Datos

Sin cambios de schema.

## API

Sin endpoints nuevos.

## UI

- **`components/app-shell/back-link.ts`** (reemplaza a `breadcrumbs.ts`): `backLinkFor(pathname)`
  devuelve `{ label, href }` de la raíz **más profunda** que sea prefijo estricto de la ruta, o
  `null`. Raíces: `NAV_ITEMS` más `{ href: '/floor', label: 'La fila' }` —la misma etiqueta que
  titula `FloorQueue`, para que el enlace prometa lo que la pantalla cumple—.
- **`components/app-shell/page-back-link.tsx`** (reemplaza a `page-breadcrumb.tsx`):
  `<PageBackLink />`. `null` en primer nivel. Si hay padre: `ChevronLeft` de `lucide-react` (trazo
  1.5, `--icon-size`) más la etiqueta, en `text-dense` sobre `--text-dim`, a `--text` al apuntarlo,
  con `min-h-(--touch-min)` y la transición de estado del sistema. Lleva `data-slot="back-link"`,
  como el resto de las piezas del sistema, para poder señalarlo desde una comprobación.
  El nombre del archivo no puede ser `back-link.tsx`: convive con `back-link.ts` en la misma
  carpeta y la resolución de módulos se volvería ambigua.
- **`ScreenHeader`**: monta `<PageBackLink />` en vez de `<PageBreadcrumb />`. Su `title` pasa a aceptar
  `ReactNode`, para que la pista pueda titular con su `PlateChip` sin escribir un `<h1>` a mano.
- **`/floor/[id]`** (`floor-ticket-detail.tsx`): cambia su `<header>` propio por `ScreenHeader`
  —placa como título, `#n · tipo` como subtítulo, el sello como acción—. Con eso deja de ser la
  única pantalla que incumple la convención 13 de `apps/web/AGENTS.md`.

Los «Volver a la fila» del pie de las fichas de lavado (spec 005) **se quedan**: el enlace de arriba
es la salida siempre visible, el del pie es el remate cuando ya bajaste hasta el fondo. Los
«Cancelar» de las altas también: abandonar un formulario no es navegar.

## Fuera de alcance

- Convertir en rutas propias lo que hoy vive en diálogo: usuarios, roles, empleados y servicios del
  catálogo se ven y se editan en `Dialog`, no tienen URL y se cierran con Esc o con su botón.
- Barra superior global. No la hay y no se agrega (`app-shell.tsx`).
- Persistir o recordar de dónde vino el usuario (RN-1).

## Tareas

- [x] **1. Derivación.** `breadcrumbs.ts` → `back-link.ts` con `backLinkFor`, raíces del riel más la
      pista.
- [x] **2. Componente.** `page-breadcrumb.tsx` → `page-back-link.tsx` con `<PageBackLink />`.
- [x] **3. Cabecera.** `ScreenHeader` monta `<PageBackLink />` y acepta `ReactNode` como título.
- [x] **4. Pista.** `floor-ticket-detail.tsx` pasa a `ScreenHeader`.
- [x] **5. Documentación.** `DESIGN.md`, `apps/web/AGENTS.md`, y nota de remisión en las specs 001 y
      005.
- [x] **6. Verificación.** `pnpm build`, `pnpm lint`, `pnpm test` y el recorrido visual.

## Verificación

Sin `verify-008.sh`: no toca el API. El precedente es la spec 007.

- `pnpm build`: shared, api y las 16 rutas de web compilan sin errores.
- `pnpm lint`: limpio, sin warnings.
- `pnpm test`: 25 suites, 192 tests en verde.
- **Recorrido de las 12 rutas en el navegador**, en densidad `bahia` a 834px, comprobando en el DOM
  el enlace (`[data-slot="back-link"]`), su destino y su alto:

  | Ruta | Enlace |
  | --- | --- |
  | `/carwash`, `/customers`, `/settings/catalog`, `/settings/employees`, `/settings/users`, `/settings/roles`, `/floor` | sin enlace |
  | `/carwash/new` · `/carwash/[id]` | «Lavados» → `/carwash`, 44px |
  | `/customers/[id]` | «Clientes» → `/customers`, 44px |
  | `/floor/new` · `/floor/[id]` | «La fila» → `/floor`, 44px |

  Los 44px son exactamente `--touch-min` de `bahia`. Las hijas se abrieron por URL directa, así que
  queda probado que el enlace no depende del historial (RN-1).
- Capturas en **1280px** (`mostrador`), **834px** y **390px** (`bahia`), en tema oscuro y claro.
  `/floor/[id]` conserva placa, `#n · tipo` y sello tras pasar a `ScreenHeader`.
