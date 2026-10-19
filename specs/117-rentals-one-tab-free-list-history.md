# 117 — Rentas en una pestaña: Libre · Rentas · Historial

**Estado:** Terminada — aprobada 19 oct 2026, en el chat: «A» (apruebo las dos specs)
**Módulo:** app-shell (web) · `features/rentals` (web) · `components/ui/date-field` (web) | **Depende de:** 107, 108, 115, 116

## Contexto

Libre y Rentas eran dos pestañas para lo mismo: rentar. Y «Todas» mezclaba la operación del día con
meses de historia en una lista sin fin. El prototipo aprobado `docs/prototype/rentals-tabs.html`
(19 oct 2026) junta todo en una pestaña «Rentas» con tres tabs: **Libre** (cotizar y reservar),
**Rentas** (lo que pasa ahora) e **Historial** (lo cerrado y lo cancelado, por mes y paginado).
Mínimo texto, como en toda la renta.

## Historias

- Como dueño, quiero una sola pestaña para rentar, para no tener dos lugares con lo mismo.
- Como dueño, quiero ver solo lo que está pasando ahora, sin la historia mezclada.
- Como dueño, quiero buscar en la historia por mes, por carro o por estado, aunque haya años de datos.

## Criterios de aceptación

### Navegación

- **Dado** el espacio «Renta de carros», **entonces** el riel y la barra inferior muestran cuatro
  pestañas: **Hoy** `/rentals`, **Rentas** `/rentals/available`, **Caja**, **Carros**. «Rentas»
  queda activa en `/rentals/available`, `/rentals/agreements`, `/rentals/agreements/history` y en
  la ficha `/rentals/agreements/[id]`.
- **Dado** cualquiera de los tres tabs, **entonces** arriba están el título «Rentas», el botón
  «Nueva renta» (`rentals.manage`) y los tabs **Libre** `/rentals/available`, **Rentas**
  `/rentals/agreements` e **Historial** `/rentals/agreements/history`, cada uno con su URL (atrás
  del navegador y enlaces funcionan). El tab Rentas muestra la cantidad de atrasadas si hay
  (`GET /rentals/agreements?late=true&pageSize=1` → `total`).

### Libre

- **Dado** Libre, **entonces** las fechas se eligen con `DateRangeField` **sin atajos**: con
  `presets={[]}` el panel no dibuja la columna «Atajos» (cambio en `date-field.tsx`; con
  `presets` sin definir sigue igual que hoy). Se quita la grilla «Semana». Lo demás (tarjetas 3D,
  sello con la cantidad, «Reservar») no cambia.

### Rentas (operación)

- **Dado** el tab Rentas, **entonces** el buscador («Placa o cliente») va primero, a todo el ancho,
  y debajo, en otra fila, tres filtros con su cantidad: **Por salir** (`RESERVED`), **En la calle**
  (`IN_PROGRESS`, por defecto) y **Ya volvió** (`FINISHED` que tocan los últimos 7 días:
  `from = hoy − 7`, `to = hoy`). Sin «Más», «Todas», «Canceladas» ni campo de fechas.
- Columnas: **Carro** (miniatura 3D con `FleetCarImage`, placa y nombre), **Cliente** y
  **Cuándo** en dos líneas, arriba qué pasa y abajo la fecha exacta («Hoy, 9:00», «Mañana, 9:00»,
  «sáb 3 oct, 9:00»):
  - reserva por salir: «Por entregar» / fecha de salida;
  - reserva que pasó su salida sin retirarse: «No ha llegado · N días|horas» en rojo /
    «Debía salir: fecha»;
  - en la calle: «Regresa» / fecha de regreso;
  - atrasada: «Atrasado · N días|horas» en rojo / «Debía regresar: fecha»;
  - devuelta con saldo: «Debe $X» en rojo / «Regresó: fecha»; sin saldo: «Regresó» / fecha.

### Historial

- **Dado** `/rentals/agreements/history`, **entonces** muestra solo `FINISHED` y `CANCELLED`, de
  un mes a la vez (‹ septiembre 2026 ›; por defecto el mes actual; no avanza más allá del actual;
  `from`/`to` = primer y último día del mes) y la cantidad «N rentas».
- Filtros debajo del buscador («Placa, cliente o contrato»): **Todas · Cerradas · Canceladas** y un
  selector «Todos los carros» → un carro (`vehicleId`). Con texto en el buscador se ignora el mes y
  se ocultan sus flechas. Cambiar un filtro vuelve a la página 1.
- Paginado de 15 con el `Pager` de siempre («1–15 de 38»). Columnas: **Contrato** («#0741» o
  «Sin contrato» en gris), **Carro** (miniatura 3D), **Cliente**, **Fechas** («sáb 3 oct → lun 5
  oct») y **Total** (la cancelada muestra su sello en vez del total). Si el ítem de la lista no
  trae el total escrito, se agrega al contrato de la lista en `@elite/shared`.
- Abrir una renta desde Historial lleva `?from=` para que su enlace de regreso diga «Historial».

### Densidad

- En `bahia` y ancho de tablet: tabs y filtros de al menos `--touch-min`; los filtros se reparten a
  lo ancho y bajan de fila si no caben; la tabla pasa a tarjetas como las demás listas.

## Reglas de negocio

- **RN-1:** «Ya volvió» = `FINISHED` cuya renta toca los últimos 7 días civiles
  (`America/El_Salvador`).
- **RN-2:** la cantidad de días u horas de atraso se cuenta desde la fecha prevista hasta ahora;
  menos de un día se dice en horas.

## Permisos

Sin cambios: `rentals.read`; «Nueva renta» con `rentals.manage`.

## Datos

Sin cambios al schema.

## API

Sin endpoints nuevos: se usan `status`, `late`, `vehicleId`, `from`, `to`, `q`, `page`, `pageSize`
de `GET /rentals/agreements`. Solo si falta, agregar el total escrito al ítem de la lista.

## UI

- `nav-items.ts`: «Libre» sale del riel; «Rentas» apunta a `/rentals/available` y se activa en las
  rutas de arriba (y su test).
- Componente compartido de encabezado con tabs para los tres tabs.
- `available-screen.tsx`, `agreements-screen.tsx`, nueva pantalla de Historial y su `page.tsx`;
  `agreement-columns.tsx` / `agreement-format.ts` para «Cuándo» y la miniatura.

## Fuera de alcance

- Nueva renta (spec 118), Hoy (116), Caja, Carros, cambios de cobro.

## Tareas

- [x] `DateRangeField`: `presets={[]}` oculta la columna de atajos (+ test).
- [x] Navegación de cuatro pestañas y encabezado con tabs (+ test de `nav-items`).
- [x] Libre sin atajos ni grilla.
- [x] Rentas: buscador arriba, tres filtros con cantidad, «Cuándo» en dos líneas (+ tests de
      `agreement-format`), miniatura 3D.
- [x] Historial: ruta, mes, filtros, búsqueda, paginado de 15, regreso a Historial.
- [x] `bahia` y tablet contemplados en el código.

## Verificación

`pnpm build && pnpm lint && pnpm test`
