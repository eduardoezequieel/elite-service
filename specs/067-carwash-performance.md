# 067 — Rendimiento: comisiones, tiempos, extras y clientes fieles

**Estado:** Terminada — falta correr `scripts/verify-067.sh` con el stack levantado y la revisión
visual del usuario (aprobada por chat, 26 sept 2026, sobre `docs/prototype/performance.html`:
«yo ya lo veo perfecto, dejalo implementado entonces, adelante»)
**Módulo:** carwash + services + employees + shared + web | **Depende de:** 009, 039, 046, 049, 056,
061

## Contexto

El dueño quiere medir a cada empleado del lavado. Comisiones (009/061) solo da plata. Esta spec
suma tres indicadores —tiempo de lavado por tipo de carro, extras vendidos y clientes fieles— y
los junta con Comisiones en una pantalla **Rendimiento**. Cada indicador se ve de todo el equipo o
de un empleado. El prototipo aprobado manda en todo lo visual.

## Historias

- Como dueño, quiero ver cuánto tarda cada empleado contra el equipo, en el mismo tipo de carro.
- Como dueño, quiero ver quién vende extras y cuáles se venden más.
- Como dueño, quiero ver si los carros que lava un empleado vuelven.
- Como dueño, quiero pasar del equipo a un empleado y volver sin perder la pestaña ni el rango.

## Criterios de aceptación

- [x] El menú dice «Rendimiento» (`/carwash/performance`) donde decía «Comisiones», con el mismo
      permiso `carwash.commissions`.
- [x] `/carwash/commissions` y `/carwash/commissions/<id>` redirigen a Rendimiento, pestaña
      Comisiones, con el mismo rango y empleado.
- [x] Pestañas Resumen · Comisiones · Tiempos · Extras · Clientes fieles. Pestaña, empleado y rango
      viven en la URL (`tab`, `employee`, `start`, `end`) y sobreviven a la recarga.
- [x] Selector «Ver» con «Todo el equipo» + empleados **activos**. Con un empleado elegido aparece
      «‹ Todo el equipo» al lado. El nombre del empleado no se repite en un título aparte.
- [x] El rango usa el `DateRangeField` existente y arranca en «Este mes».
- [x] Tocar un empleado en cualquier tabla o barra cambia el alcance sin cambiar de pestaña.
- [x] «Editar empleado» abre su edición en Empleados; solo se renderiza con `employees.manage`.
      Empleados tiene «Ver rendimiento» por fila; solo se renderiza con `carwash.commissions`.
- [x] Resumen: 3 cifras arriba (lavados, comisión, tiempo promedio por lavado) y 2 medidores abajo
      (con extras, clientes fieles), más la tabla por empleado con «Tiempo vs promedio», «Lavados
      con extras» y «Clientes fieles» (porcentaje y «X de Y» debajo).
- [x] Comisiones: equipo = reporte de la 009 (incluye inactivos con chip «Inactivo» y la nota de
      por qué); empleado = detalle de la 061.
- [x] Tiempos: una cifra por tipo de carro, barras por empleado con la marca del promedio del equipo
      (selector de tipo), tabla por tipo; empleado: su promedio por tipo contra el equipo y sus
      lavados con el tiempo de cada uno. Los lavados sin tiempo se cuentan en una línea aparte.
- [x] Extras: medidor, vendido en extras, el que más sale, barras por servicio, tabla por empleado;
      empleado: lo suyo contra el equipo y sus lavados con extras.
- [x] Clientes fieles: aviso con el rango que se mide cuando se corrió, medidor, días promedio,
      tabla por empleado; empleado: sus lavados con «Sí, a los N días · lo lavó X» / «No».
- [x] Tiempo en palabras: «N min más rápido», «N min más lento», «en el promedio»; nunca solo color.
- [x] Cada tarjeta de cifra y las columnas explicadas llevan un icono de ayuda con su explicación
      (hover, foco y toque).
- [x] Las listas de lavados paginan de a 10 («Anterior · 1–10 de 69 · Siguiente»).
- [x] Catálogo: la categoría tiene «Cuenta como extra» (por defecto sí). «Lavado premium» del seed
      queda en no.
- [x] Densidad `bahia` distinta de verdad: tablas a tarjetas bajo 900px, controles de 48px, cifras
      y barras más grandes.
- [x] Inactivos no aparecen en el selector ni en ningún número de Rendimiento salvo Comisiones.

## Reglas de negocio

- **RN-1 Qué lavados cuentan.** `area = CARWASH`, `status = PAID`, `chargedAt` en el rango
  (día civil `America/El_Salvador`, igual que la 009), con al menos un empleado **activo**
  asignado. Los de oficina sin empleado no cuentan. Un lavado compartido del legado (antes de la
  035) cuenta para cada uno de sus empleados y una sola vez para el equipo.
- **RN-2 Tiempo.** De `washingStartedAt` a la última entrada `STATUS` a `READY` posterior a ese
  momento (`WorkOrderStatusEvent`). Sin alguno de los dos, el lavado queda **sin tiempo** y no
  entra a ningún promedio. Minutos con un decimal.
- **RN-3 Tiempo contra el equipo.** Promedio del equipo por tipo de carro (`WorkOrder.bodyTypeId`,
  snapshot) sobre los lavados medidos del rango. Para un empleado: promedio de
  `minutos − promedio del equipo en ese tipo` sobre sus lavados medidos. Negativo = más rápido.
- **RN-4 Extras.** Líneas `SERVICE` cuyo servicio pertenece hoy a una categoría con
  `isExtra = true`. Las líneas `PRODUCT` (065) no son extras. Monto = `unitPrice` de la línea.
- **RN-5 Clientes fieles.** Un lavado «volvió» si el mismo vehículo tiene otro lavado CARWASH no
  anulado creado después de `chargedAt` y dentro de 30 días civiles. Días = diferencia de días
  civiles. «Lo lavó» = el empleado asignado a ese siguiente lavado.
- **RN-6 Rango de fieles.** Solo se miden lavados cuyos 30 días ya pasaron: corte = hoy − 30. Si
  `to ≤ corte`, se mide `from`–`to`. Si no, `returnsTo = corte` y `returnsFrom = from` si
  `from ≤ corte`, o `corte − (to − from)` si no. `returnsShifted` avisa del corrimiento.
- **RN-7 Nada se recalcula.** Comisión y ventas atribuidas salen de `CommissionEntry` y del total
  congelado, como en la 009 (RN-8 de esa spec).
- **RN-8 Inactivos.** Fuera del selector, de las tablas y de las cifras del equipo. Sí en la
  pestaña Comisiones, porque se les puede deber la comisión del rango.

## Permisos

| Acción                                 | Permiso               |
| -------------------------------------- | --------------------- |
| Ver Rendimiento (todas las pestañas)   | `carwash.commissions` |
| Ver «Editar empleado»                  | `employees.manage`    |
| Ver «Ver rendimiento» en Empleados     | `carwash.commissions` |
| Cambiar «Cuenta como extra»            | el del catálogo hoy   |

## Datos

- `ServiceCategory.isExtra Boolean @default(true)`. La migración deja en `false` la categoría
  CARWASH llamada «Lavado premium» (la del lavado principal del seed); el seed hace lo mismo.

## API

Contrato en `@elite/shared` (sección «spec 067»). Query `performanceQuerySchema` (`from`, `to`,
igual que comisiones).

- `GET /carwash/performance?from&to` → `PerformanceReport`. Permiso `carwash.commissions`.
- `GET /carwash/performance/:employeeId?from&to` → `PerformanceEmployeeDetail`. Id no-UUID,
  inexistente o inactivo → `404 NOT_FOUND`. Sin lavados → `200` con cifras en cero.
- Categorías: `isExtra` en `ServiceCategorySummary` y en el alta/edición.

Verificación: `scripts/verify-067.sh` (contra el stack levantado).

## UI

`docs/prototype/performance.html` es la referencia. Piezas nuevas reutilizables: `HelpTip`
(icono de ayuda con tooltip), `help` en `StatCard` y en la columna de `DataTable`, y `pageSize` en
`DataTable` (paginado en cliente). Se documentan en `apps/web/DESIGN.md`.

## Propuestas (decididas sin preguntar, cambiables)

- Extras por bandera en la categoría y no por nombre: el catálogo puede crecer.
- Productos (065) fuera de extras: tienen su propio reporte en Inventario.
- Detalle de un inactivo = 404: Rendimiento no los muestra.
- Sin «Mes pasado»: el `DateRangeField` real tiene Hoy, 7 días y Este mes.

## Desvíos del prototipo (convenciones de la web mandan)

- Sin botón «Ver empleado» por fila: la fila entera cambia al empleado (`apps/web/AGENTS.md`,
  convención 13, prohíbe el «Ver» redundante).
- Medidores: el `SegmentGauge` existente lleva la cuenta en el arco; la cifra grande es el % con
  «X de Y» al lado.
- Tablas y paginado se apilan a 1100px, que es el corte real de `DataTable`, no 900px.
- Comisiones del equipo: el total sigue en el bloque «A pagar» de la 009 (el `DataTable` no tiene
  fila de pie) y se fue el filtro de Estado. El detalle de un empleado mantiene las columnas de la
  061 (ese contrato no trae tipo de carro).
- Las pestañas se acomodan en dos líneas en teléfono, como el `Tabs` existente.

## Fuera de alcance

- Ajustar el tiempo por extras (un lavado con tapicería tarda más). Hoy se compara solo por tipo
  de carro.
- Asistencia y horas trabajadas («lavados por hora»).
- Exportar.

## Tareas

- [x] Contrato en `@elite/shared` (`contracts.ts`, `schemas.ts`).
- [x] API: migración + seed `isExtra`, catálogo lo expone y lo edita.
- [x] API: dominio de rendimiento (puro, con tests), caso de uso, repositorio Prisma, endpoints.
- [x] `scripts/verify-067.sh`.
- [x] Web: `HelpTip`, `StatCard.help`, `DataTable` con `help` y `pageSize`; «Cuenta como extra» en
      categorías; «Ver rendimiento» y apertura de edición por URL en Empleados.
- [x] Web: pantalla Rendimiento, redirecciones, menú, enlace de regreso.
- [x] `apps/web/DESIGN.md`, `apps/web/AGENTS.md` y `PRODUCT.md` si algo cambia de convención.

## Verificación

```
pnpm build && pnpm lint && pnpm test
bash scripts/verify-067.sh   # con docker compose up -d && pnpm dev
```
