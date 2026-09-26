# 058 — Los avisos en un cajón, con día, filtros y permiso propio

**Estado:** Aprobada
**Módulo:** web + shared | **Depende de:** 042, 034-permissions-master-detail

> Aprobada en el chat del 20 sep 2026 sobre el prototipo
> `docs/prototype/notifications-drawer.html`: «me parece perfecto, implementalo». La clave del
> permiso la eligió el usuario en ese mismo hilo: **clave nueva `notifications.read`**, no reusar
> `carwash.read`.

## Contexto

La campana de la 042 abre un menú desplegable de 320px anclado al riel: entra medio aviso, no se
puede buscar, no se puede recortar y la bandeja se poda al día siguiente, así que ayer no existe.
El taller pidió un cajón desde abajo, ordenado, con filtro por día. Y pidió que no todos lo vean.

## Historias

- Como quien tiene `notifications.read`, quiero abrir los avisos en un cajón y recortarlos por día,
  tipo o placa, para encontrar el lavado que se movió sin leer los 50 de la jornada.
- Como dueño, quiero que el que lava **no** vea los avisos de dinero, para que la plata del taller
  siga siendo de quien ve la caja.
- Como administrador, quiero conceder o quitar la campana por separado de la fila de lavados.

## Criterios de aceptación

- **Dado** un usuario sin `notifications.read`, **cuando** carga cualquier pantalla, **entonces** la
  campana **no se renderiza** —ni en el riel ni en la barra inferior— y no hay forma de abrir el
  cajón.
- **Dado** un usuario con `notifications.read` y sin `carwash.cash`, **cuando** otra persona cobra o
  deshace un cobro, **entonces** ese aviso **no entra** a su bandeja y el filtro «Cobros» no se
  dibuja.
- **Dado** el cajón abierto, **cuando** se elige un día, **entonces** la lista muestra solo los
  avisos de ese día y los contadores de tipo se recalculan sobre ese día.
- **Dado** el cajón abierto, **cuando** se escribe `P052-201` o `#7` en el buscador, **entonces**
  quedan solo los avisos de esa placa o ese lavado.
- **Dado** un aviso sin leer, **cuando** se toca, **entonces** queda leído, el cajón se cierra y el
  navegador va al lavado.
- **Dado** que se abrió el sistema un lunes y hoy es jueves, **cuando** se abre el cajón,
  **entonces** siguen estando los avisos de los últimos 7 días, agrupados por día.
- **Dado** el cajón abierto en una tablet, **cuando** se mira a 390px, **entonces** los días son un
  carril de píldoras arriba, el carril de tipos ocupa su propio renglón y todo lo tocable mide
  `--touch-min`.

## Reglas de negocio

- **RN-1:** La bandeja guarda **7 días** y hasta **200** avisos, lo que se acabe primero. Sigue
  viviendo en `localStorage` por usuario: no es una tabla y no viaja a otra máquina (042).
- **RN-2:** Un aviso de dinero —`ticket.charged`, `ticket.reversed`— solo entra a la bandeja de
  quien tiene `carwash.cash`. Se decide **al recibirlo**, no al pintarlo: lo que no se puede ver no
  se guarda.
- **RN-3:** La campana la ve quien tiene `notifications.read`. Oculta, no deshabilitada.
- **RN-4:** El hilo de eventos sigue pidiendo `carwash.read` (042). Sin ese permiso no hay stream,
  así que tener solo `notifications.read` da una bandeja que no se llena; es coherente y no es un
  error.
- **RN-5:** Ningún aviso propio, ningún error en la bandeja (042, sin cambios).

## Permisos

| Clave                | Descripción                                                |
| -------------------- | ---------------------------------------------------------- |
| `notifications.read` | Ver el centro de avisos y abrir el cajón                   |
| `carwash.cash`       | Ya existe. Acá además decide si llegan los avisos de cobro |

El catálogo es el de `@elite/shared`; el seed lo sincroniza y se lo concede al rol Administrator.
Después de actualizar hay que **volver a correr el seed** para que la clave exista en la base.

## Datos

Ninguno. La bandeja no tiene tabla y esta spec no le crea una.

## API

Ninguno nuevo. La clave viaja en el catálogo que ya sirve `GET /api/permissions`.

## UI

**El cajón** (`NotificationsDrawer`), sobre el `Dialog` del sistema con una variante nueva
`variant="drawer"`: pegado al pie en **todos** los anchos, ancho máximo 1100px centrado, alto
`min(72vh, 680px)` y 86vh bajo 900px. Esquinas de arriba redondeadas, `--surface`, filete
`--line-soft`. Cierra con Esc, con la X y tocando fuera; el foco lo administra Radix.

- **Cabecera:** título de diálogo «Avisos» (`text-headline`), y debajo, en un renglón, el chip
  «en vivo / sin conexión» y el contador «N sin leer de M».
- **Días:** columna de 210px a la izquierda con «Todos los días» y un botón por día —«Hoy», «Ayer»,
  «vie 18»— con su fecha corta y su cuenta; el día con avisos sin leer la muestra en
  `--flame-text`. Bajo 900px la columna desaparece y los días son un carril de píldoras arriba.
- **Filtros:** una fila de tres zonas fijas y **sin `wrap`** —buscador de 240px, carril de tipos que
  scrollea en horizontal, filete, interruptor «Solo sin leer» con su cuenta—. Todo mide
  `--control-h`. Los tipos son: Todos, Entradas, Avances, Cobros, Anulados.
- **Cada aviso** es una fila-tarjeta (`--surface-2`, radio `--radius-row`): hora a la izquierda en
  tabulares, icono del tipo en su tono, y los tres renglones de la 042 —titular con `#N`, placa más
  contexto, y quién lo movió con desde dónde—. Punto `--flame` a la derecha si está sin leer.
- **Agrupado por día** siempre, con cabecera pegajosa que dice el día y cuántos.
- **Vacío:** tres textos distintos según por qué está vacío —búsqueda sin resultados, nada sin leer,
  o bandeja vacía— nunca «No hay datos».
- **Pie:** el conteo de lo mostrado, «Marcar todo como leído» y «Ir a la fila».

Maqueta aprobada: `docs/prototype/notifications-drawer.html`.

## Fuera de alcance

- Guardar la bandeja en la base o compartirla entre máquinas (sigue igual que en la 042).
- Avisos de otros módulos (caja, usuarios): la bandeja sigue siendo de la fila de lavados.
- Preferencias de qué avisar por usuario.

## Tareas

- [x] `@elite/shared`: módulo `notifications` con la acción `read` en el catálogo de permisos.
- [x] `dialog.tsx`: variante `drawer` —pegado al pie en todo ancho, con el alto y el ancho de arriba—.
- [x] `notification.ts`: cada aviso lleva su `kind` (`in` | `move` | `cash` | `void`), derivado del
      evento, con test.
- [x] `store.ts`: `pruneToDays` de 7 días en vez de `pruneToDay`, límite 200, con test.
- [x] `filters.ts` nuevo: agrupar por día, contar por tipo y recortar por día/tipo/sin leer/texto.
      Lógica pura, con test.
- [x] `notifications-drawer.tsx` nuevo, según la maqueta.
- [x] `notification-bell.tsx`: la campana abre el cajón; se va el `DropdownMenu`.
- [x] `nav-rail.tsx` y `nav-bottom-bar.tsx`: la campana pide `notifications.read`.
- [x] `carwash-live-provider.tsx`: sin `carwash.cash` no se guardan los avisos de dinero.
- [x] `DESIGN.md`: reescribir «Centro de notificaciones» y anotar la variante `drawer` del diálogo.
- [x] `specs/042-realtime-carwash.md`: una línea que apunte acá por lo que cambió (poda y permiso).

## Verificación

`pnpm lint && pnpm test && pnpm build`, y `pnpm --filter @elite/api prisma:seed` para que
`notifications.read` exista en la base de desarrollo. La revisión visual —escritorio, tablet,
390px y densidad `bahia`— la hace el usuario sobre la app; el agente no abre el navegador.
