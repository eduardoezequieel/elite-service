# 014 — Buscar un lavado y ver otro día

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003-carwash, 007-unified-data-table

## Task

Dar forma de encontrar un lavado sin leer la lista: buscador por placa, número y cliente en
`/carwash` y en `/floor`, más selector de día en `/carwash` usando el parámetro `date` que
`listTickets` ya acepta y ninguna pantalla expone.

Evidencia: `docs/UX_AUDIT.md` hallazgos 02, 11 y 12. Comportamiento propuesto:
`docs/prototype/ux-audit-2026-09.html`, pestañas «La fila de la pista» y «Lavados en el
mostrador».

## Done

- [x] `/carwash`: campo de búsqueda en `FieldBox` sobre la tabla, etiqueta «Buscar por placa,
      número o cliente», debounce 250ms, con el mismo patrón que `customers-screen.tsx`.
- [x] `/carwash`: selector de día en la cabecera, con «Hoy» por defecto, que alimenta
      `listTickets({ date })`. El título de la pantalla no cambia; el subtítulo dice el día.
      `date` es `YYYY-MM-DD` en zona local del navegador.
- [x] `/floor`: el mismo buscador arriba de `FloorQueue`, con alto `--control-h` de `bahia`.
      Sin selector de fecha.
- [x] La búsqueda filtra sin perder la pestaña de estado activa: los dos filtros se suman.
      `q` es contains, sin distinción de mayúsculas, sobre placa, número de referencia y
      nombre de cliente. Mínimo 1 carácter tras el debounce.
- [x] `GET /carwash/tickets` y `GET /floor/tickets` aceptan `q`. `date` ya existe. La
      búsqueda va como parámetro; no se filtra en el cliente lo que el API puede filtrar.
- [x] Estado vacío propio de la búsqueda, distinto del vacío del día: título «Ningún lavado
      coincide», frase «No hay placa, número ni cliente que coincida con «X».», sin botón
      de alta (no es el vacío del día).
- [x] Con un día que no es hoy, las acciones que mutan siguen respetando el estado del
      ticket; no se deshabilitan por fecha.
- [x] Verificado en escritorio, en ancho de tablet y en densidad `bahia`.

## Always

- El contador de cada pestaña cuenta sobre el día elegido, no sobre hoy.
- El día viaja en la URL (`?date=`). `q` también (`?q=`), para recargar y compartir.
- La búsqueda se queda dentro del día elegido (oficina) o del día de hoy (pista).

## Ask first

- (Cerrado) No cruzar días: `q` filtra dentro del día. Historial completo es otra spec.

## Never

- Nunca filtrar en el cliente lo que el API puede filtrar: la búsqueda va como parámetro.
- Nunca dejar la pista con selector de fecha: la pista es el día de hoy y nada más.

## Verify

`scripts/verify-014.sh` — contra un stack levantado: alta de tres lavados, búsqueda por placa
parcial, por número y por nombre de cliente; consulta con `date` de ayer devuelve vacío y con
el de hoy devuelve los tres; `GET /floor/tickets?q=` filtra igual.
