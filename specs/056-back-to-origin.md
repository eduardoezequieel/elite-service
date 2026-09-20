# 056 — Volver a la pantalla de la que viniste

**Estado:** Aprobada (por chat, 20 sept 2026)
**Módulo:** web (transversal) | **Depende de:** spec 008 terminada

## Contexto

Una ficha con una sola puerta de entrada se sale por donde se entró aunque el regreso se calcule de
la ruta. Una ficha con varias, no: desde Caja se toca un cobro, se abre el lavado y el enlace de
arriba dice «Lavados» y lleva a `/carwash`. El usuario aterriza en una pantalla que no pidió.

La spec 008 lo resolvió con `backLinkFor(pathname)`, que sube al prefijo más hondo de la ruta. Es
correcto para el 90% y su RN-1 —nunca `router.back()`— sigue en pie: el historial miente tras un
enlace directo, una recarga o el `router.replace` del alta. Lo que falta no es historial, es que la
ruta de destino **no sabe por dónde se entró**. Esta spec se lo dice, en la URL.

## Historias

- Como cajero, quiero volver a la caja desde el lavado que abrí de la tabla de cobros, para no tener
  que buscar la pestaña Caja otra vez.
- Como usuario en la ficha de un cliente, quiero volver a esa ficha desde uno de sus lavados, para
  seguir revisando su historial donde lo dejé.
- Como usuario que estaba mirando los lavados de un día pasado, quiero que al volver de una ficha
  siga puesto ese día y mi búsqueda, para no re-filtrar en cada lavado que abro.
- Como usuario que abre un lavado desde un aviso de la campana, quiero volver a lo que estaba
  haciendo, no a la lista de lavados.
- Como usuario que llega por enlace directo o recarga, quiero que el regreso siga estando, igual que
  hoy.

## Criterios de aceptación

- **Dado** un usuario en `/carwash/cash` con cobros del turno, **cuando** toca una fila y luego el
  enlace de regreso, **entonces** vuelve a `/carwash/cash` y el enlace dice «Caja».
- **Dado** un usuario en el detalle de un turno cerrado (`/carwash/cash/<id>`), **cuando** entra a un
  cobro y vuelve, **entonces** vuelve a ese turno y el enlace dice «Turno».
- **Dado** un usuario en la ficha de un cliente, **cuando** entra a uno de sus lavados y vuelve,
  **entonces** vuelve a la ficha de ese cliente y el enlace dice «Cliente».
- **Dado** un usuario en `/carwash?date=2026-09-19&q=abc`, **cuando** entra a un lavado —por la fila
  o por la placa— y vuelve, **entonces** la lista aparece con esa fecha y esa búsqueda puestas.
- **Dado** un usuario en cualquier pantalla, **cuando** abre un lavado desde la campana de avisos y
  vuelve, **entonces** llega a la pantalla en la que estaba.
- **Dado** un usuario que abre `/carwash/<id>` por URL directa, sin `?from=`, o recarga estando ahí,
  **cuando** mira la cabecera, **entonces** el enlace dice «Lavados» y lleva a `/carwash`, como hoy.
- **Dado** un `?from=` manipulado (`//evil.com`, `https://evil.com`, `/../etc`, una ruta que no
  existe), **cuando** carga la pantalla, **entonces** el enlace lo ignora y cae al regreso
  estructural.
- **Dado** un usuario en una pantalla de primer nivel, **cuando** mira la cabecera, **entonces** no
  hay enlace de regreso, traiga la URL lo que traiga.

## Reglas de negocio

- **RN-1: El origen viaja en la URL, nunca en el historial ni en memoria.** Un parámetro `from` con
  la ruta de origen. Sobrevive a la recarga, se puede compartir el enlace y se verifica sin
  navegador. RN-1 de la spec 008 sigue valiendo: `router.back()` no se usa en ninguna parte.
- **RN-2: Sin `from`, manda la estructura.** Ausente, inválido o apuntando afuera, el regreso es el
  de la spec 008. El parámetro es una mejora, nunca un requisito.
- **RN-3: `from` se valida contra las rutas conocidas.** Tiene que empezar con `/`, no ser
  protocolo-relativo (`//`), no traer `..`, no pasar de 512 caracteres, colgar de una raíz conocida
  y no ser la pantalla actual. Lo que no cumpla se descarta.
- **RN-4: No se anota lo que ya se deriva.** Si el regreso estructural del destino ya es el origen
  —entrar a un lavado desde `/carwash` pelado—, no se agrega `from`: la URL queda limpia.
- **RN-5: Las etiquetas de detalle son la única tabla nueva.** Las raíces siguen saliendo del riel
  (RN-2 de la 008). Solo las pantallas de detalle, que no son raíz de nada, tienen nombre declarado:
  «Turno», «Cliente», «Lavado».
- **RN-6: Una pestaña nueva no tiene de dónde volver.** ⌘/Ctrl+clic abre el destino sin `from`.

## Permisos

No introduce ni modifica permisos.

## Datos

Sin cambios de schema.

## API

Sin endpoints nuevos.

## UI

- **`components/app-shell/back-link.ts`**: `BACK_PARAM`, `safeOrigin(value, pathname)`,
  `labelFor(path)`, `withBackTo(href, origin)`, `currentOrigin()` y `backLinkFor(pathname, from?)`.
  `currentOrigin()` lee `window.location` y se llama **dentro de un manejador de evento**: la fecha y
  la búsqueda de `/carwash` se escriben con `history.replaceState`, así que no están en
  `useSearchParams`.
- **`components/app-shell/page-back-link.tsx`**: lee `useSearchParams().get('from')` y se lo pasa a
  `backLinkFor`. Nada cambia en su pintado.
- **`components/app-shell/screen-header.tsx`**: monta el enlace dentro de `<Suspense fallback={null}>`.
  Next lo exige para prerenderizar las rutas de primer nivel (`/carwash`, `/customers`,
  `/settings/*`), que son justo en las que el enlace es `null`.
- **`components/ui/data-table.tsx`**: el `rowHref` de cualquier tabla pasa por `withBackTo` en el
  clic y en Enter/Espacio. Con eso heredan el arreglo las filas de cobros, las de la ficha de cliente
  y las de la lista de lavados, y cualquier tabla futura sin registrar nada.
- **`features/notifications/components/notification-bell.tsx`** y la placa de
  **`features/carwash/components/tickets-screen.tsx`**: son `<Link>` propios —la tabla no toca los
  clics sobre anclas—, así que llevan el mismo `withBackTo` en un `onClick` que respeta ⌘/Ctrl+clic.

## Fuera de alcance

- `router.back()`.
- Recordar el origen en `sessionStorage` o en un store: lo que no está en la URL no sobrevive a la
  recarga.
- Rastro de migas de varios tramos: se sigue nombrando un solo salto (RN-4 de la 008).
- Rutas, permisos, endpoints o schema.

## Tareas

- [x] **1. Núcleo.** `back-link.ts`: parámetro, validación, etiquetas de detalle, `withBackTo`,
      `currentOrigin`, `backLinkFor` con origen.
- [x] **2. Lector.** `page-back-link.tsx` lee el parámetro; `screen-header.tsx` lo envuelve en
      `Suspense`.
- [x] **3. Filas.** `data-table.tsx` marca el origen en `rowHref`.
- [x] **4. Enlaces sueltos.** Campana de avisos y placa de la lista de lavados.
- [x] **5. Prueba.** `back-link.spec.ts`: estructural sin `from`, origen válido con etiqueta, query
      conservada, basura descartada, `withBackTo` que no ensucia.
- [x] **6. Documentación.** `DESIGN.md`, `apps/web/AGENTS.md` y nota de remisión en la spec 008.

## Verificación

Sin `verify-056.sh`: no toca el API. El precedente es la spec 008.

- `pnpm build`, `pnpm lint`, `pnpm test`.
- Recorrido visual del usuario: Caja → cobro → «Caja»; turno cerrado → cobro → «Turno»; ficha de
  cliente → lavado → «Cliente»; `/carwash` con fecha vieja → lavado → vuelve con la fecha puesta;
  campana → lavado → vuelve a donde estaba; `/carwash/<id>` por URL directa → «Lavados».
