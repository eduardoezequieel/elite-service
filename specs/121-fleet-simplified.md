# 121 — Carros sin duplicados ni menú escondido

**Estado:** Aprobada — 19 oct 2026, en el chat: «Asi me parece bien, implementalo» (tras el
prototipo `docs/prototype/fleet-simplified.html`, vista «Propuesta»)
**Módulo:** `features/fleet`, `features/fleet-maintenance`, `features/rental-reports` (web) |
**Depende de:** 095, 099, 110, 115

## Contexto

La lista de carros repetía cada estado hasta 4 veces (medidor, chips, título de grupo, sello,
«Listo para rentar»), tenía filtros de más para una flota de ~9 carros y escondía en un ⋯
herramientas de toda la flota. La ficha repetía tarifa y papeles en una franja de cuadros. Solo
web: el API y `@elite/shared` no cambian.

## Criterios de aceptación

**Lista (`/rentals/fleet`)**

- Encabezado: «Carros» y, a la derecha, en este orden:
  - «Mandar al taller» con el número de carros que tienen al menos un aviso `SERVICE`. Solo si
    ese número es > 0. Abre `WorkshopTextDialog`. Permiso `fleet.read`.
  - «¿Cuánto dejó?»: botón normal (`variant="outline"`), link a `/rentals/fleet/earnings`.
    Permiso `rentals.reports`.
  - «Nuevo carro» (`fleet.manage`), como hoy.
- Sin ⋯, sin `FleetViewSwitch`, sin el botón-pestaña «Retirados».
- Sin `FleetPulse`: ni medidor, ni «Ocupación de la flota», ni «Ingreso diario en renta».
- Una fila: el buscador y un grupo de chips de estado:
  - «Todos» con el total de activos.
  - Solo los estados con al menos un carro, en el orden `AVAILABILITY_ORDER`, cada uno con su
    número.
  - Al final, separado, «Retirados» con su número. Ese número sale de una consulta
    `status: 'RETIRED'` (`pageSize: 1`, se usa `total`). Si es 0, el chip no aparece.
  - Tocar «Retirados» cambia a los retirados (`?status=RETIRED`). Tocar otro chip vuelve a los
    activos.
- Sin chips de tipo (Sedán/Camioneta/Pick up). Sin conmutador tarjetas/lista: se borran la
  `DataTable`, `ViewButton`, `FleetView` y el parámetro `?view`.
- Sin títulos de grupo. Las tarjetas van en una sola grilla, ordenadas por `AVAILABILITY_ORDER` (lo
  urgente primero), con orden estable dentro de cada estado.
- El `Pager` solo aparece con más de una página.

**Tarjeta (`FleetVehicleCard`)**

- Foto con el sello de disponibilidad, nombre (`fleetVehicleName`, ya trae el año), placa, línea
  de actividad, avisos y precio por día.
- Se va el subtítulo «año · tipo» y el `Reference` (#n).
- La línea de actividad solo aparece si hay `activity`. `fleetActivityLine` devuelve `null` para
  FREE y WORKSHOP sin actividad: se van «Listo para rentar» y «En taller». Actualizar
  `fleet-activity.spec.ts`.

**Ficha del carro**

- Encabezado (`FleetVehicleFrame`): `back` a `/rentals/fleet` («Carros»).
- Los avisos usan el mismo componente que la tarjeta: rojo + triángulo si es `DUE`, ámbar si es
  `WARN`, ícono de documento o de llave según el tipo. Ese componente se extrae a un archivo
  propio y lo usan los dos.
- Pestaña Ficha: se va la franja de 3 cuadros (Tarifa diaria, Kilometraje, Papeles). La tarjeta
  Identificación gana la fila «Kilometraje» (`48,000 km`, solo lectura), después de Color.
- Pestaña Servicio:
  - Se va el ⋯ («Texto para el taller» y «Recordatorios»).
  - Al lado de «Anotar lo que se hizo» va «Plan de servicio» (`variant="outline"`, permiso
    `fleet.manage`), que abre `MaintenancePlanDialog`.

**Plan de servicio**

- Los dos campos de aviso se llaman «Avisar estos km antes» y «Avisar estos días antes». Siguen
  en el diálogo: moverlos a Ajustes de la renta choca con la spec 120, que está en curso.

**¿Cuánto dejó? (`/rentals/fleet/earnings`)**

- En vez de `FleetViewSwitch`, `back` a `/rentals/fleet` («Carros»).
- `fleet-view-switch.tsx` se borra.

**Recordatorios**

- Sale de la web: nada descarga `reminders.ics`. El endpoint del API se queda (ver Ask first).

## Always

- Densidad `bahia` y ancho de tablet: los chips y botones nuevos usan `--touch-min` y
  `--control-h`, como los de hoy.
- Reusar `ScreenHeader` (`back`), `FilterChip`, `Button`, `Pager` y los tokens de `DESIGN.md`.
- Textos de UI en usted, sin voseo ni tuteo. Mínimo texto: sin ayudas ni subtítulos nuevos.
- Borrar el código que quede sin uso (componentes, helpers, imports, tests de lo borrado).

## Ask first

- Cambiar el API o `@elite/shared`, incluido quitar el endpoint de recordatorios.
- Tocar `features/rental-settings` (spec 120 en curso).

## Never

- Navegador, Playwright o `pnpm dev` para revisar.
- Dejar el ⋯ en la lista o en Servicio.

## Done

- [x] Lista: encabezado, chips con Retirados al final, sin pulso/tipo/vista/grupos, pager condicional.
- [x] Tarjeta sin subtítulo ni #n; `fleetActivityLine` sin FREE/WORKSHOP; spec actualizada.
- [x] Avisos con color en la ficha, con un componente compartido con la tarjeta.
- [x] Ficha sin franja; Kilometraje en Identificación.
- [x] Servicio sin ⋯ y con «Plan de servicio»; rótulos nuevos en el diálogo del plan.
- [x] ¿Cuánto dejó? con `back`; `fleet-view-switch.tsx` borrado; recordatorios fuera de la web.

## Verify

`pnpm build && pnpm lint && pnpm test`
