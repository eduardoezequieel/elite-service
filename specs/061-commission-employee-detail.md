# 061 — Detalle de comisiones por empleado

**Estado:** Terminada (aprobada por chat, 26 sept 2026: «B me parece mejor … adelante»)
**Módulo:** `carwash` | **Depende de:** spec 009 terminada, spec 056 terminada

## Task

El reporte de comisiones (009) solo da totales por empleado. Tocar una fila abre
`/carwash/commissions/<employeeId>` con los lavados cobrados de ese empleado en el mismo rango:
número, fecha de cobro, placa, total del lavado y la comisión que le tocó. El reporte arranca en
«Este mes», no en «Hoy». El rango viaja en la URL (`?start=&end=`; `from` ya es el origen de 056),
así que el enlace de regreso vuelve al reporte con el mismo rango puesto.

Contrato nuevo: `GET /carwash/commissions/:employeeId?from=&to=` → `CommissionEmployeeDetail`
(`@elite/shared`). Mismo permiso `carwash.commissions`, mismo eje `chargedAt` (009 RN-5), mismas
filas `CommissionEntry` (009 RN-8): no se recalcula nada.

## Done

- [x] `/carwash/commissions` sin parámetros abre en el mes actual (1 del mes → hoy).
- [x] El rango elegido queda en la URL (`start`, `end`) y sobrevive a la recarga.
- [x] Cada fila del reporte lleva a `/carwash/commissions/<employeeId>?start=&end=`.
- [x] El detalle muestra nombre (+ «Inactivo» si aplica), el rango, tres cifras (lavados, ventas
      atribuidas, comisión) y una tabla de lavados, más reciente arriba.
- [x] Un lavado compartido (legado anterior a 035) dice «entre N» junto a su comisión.
- [x] Tocar un lavado abre su ficha; el regreso de la ficha dice «Empleado» y vuelve al detalle.
- [x] El regreso del detalle dice «Comisiones» y vuelve al reporte con el rango que tenía.
- [x] API: empleado inexistente o id no-UUID → `404 NOT_FOUND`; sin lavados en el rango → `200` con
      lista vacía y cifras en `0.00`.
- [x] Tests: armado del detalle en dominio, caso de uso (404 y rango), `back-link` con la etiqueta
      nueva.

## Always

- Reutilizar `commissionsQuerySchema`, `referenceOf`, `DataTable` (`rowHref`) y `ScreenHeader`.
- La tabla colapsa a láminas en `bahia`/teléfono (lo hace `DataTable`).

## Ask first

- Filtros o acciones nuevas en el detalle (pagar, exportar, marcar pagado).

## Never

- Recalcular la comisión con la fórmula: se leen las entradas congeladas.
- Cadena de migas: el regreso nombra solo al padre (DESIGN.md → Enlace de regreso).

## Verify

```bash
pnpm build && pnpm lint && pnpm test
bash scripts/verify-061.sh   # con el stack levantado
```
