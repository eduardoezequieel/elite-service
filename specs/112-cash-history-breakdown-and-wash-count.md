# 112 — Desglose en el historial de caja y conteo real de lavados

**Estado:** Terminada (aprobada por chat, 8 oct 2026: «en el historial quieren poder ver todo esto detallado
sin necesidad de tener que entrar, también creo que las ventas se están contando como lavados»)
**Módulo:** `carwash` + `cash-shift` (api + shared + web) | **Depende de:** 010, 065, 069, 106, 109

## Task

1. «Lavados cobrados» del turno cuenta **lavados distintos** con al menos un pago en el turno. Hoy
   es `paymentCount` (todos los pagos), así que suma ventas sueltas, cuentas abiertas y cada pago
   de un lavado pagado con dos métodos.
2. La tabla «Historial» de caja muestra, por turno y sin entrar al detalle, lo mismo que las
   tarjetas del turno: Fondo, Efectivo, Tarjeta, Transferencia, Otro, Esperado, Contado,
   Diferencia y el conteo (lavados en el lavado, cobros en la renta).

## Done

- [x] API carwash: `CashSession` lleva `washCount` = cantidad de `workOrderId` distintos no nulos
      entre los pagos del turno. `paymentCount` se queda como está.
- [x] Contrato en `@elite/shared`. Si la renta comparte el tipo `CashSession`, el campo no la
      rompe (opcional o con su propio valor) y la renta sigue mostrando «Cobros» = `paymentCount`.
- [x] El adapter de caja (`CashShiftAdapter`) decide qué número se cuenta: el lavado usa
      `washCount`, la renta `paymentCount`. La tarjeta del turno y el historial usan ese número.
- [x] Historial: columnas Fondo, Efectivo, Tarjeta, Transferencia, Otro, Esperado, Contado,
      Diferencia y conteo, montos en `font-mono` a la derecha como las de hoy. «Abrió» y «Cerró»
      se juntan en una sola columna de dos líneas para que entre.
- [x] La fila sigue llevando al detalle. En ancho de tablet y densidad `bahia` la tabla no rompe la
      página: usa el apilado o el scroll horizontal que `DataTable` ya tenga, sin inventar otro.
- [x] Tests: API (`washCount` con venta suelta, cuenta abierta y lavado con dos métodos → 1) y web
      si hay lógica nueva fuera de JSX.

## Always

- Texto mínimo en la UI: solo encabezados y datos, sin ayudas ni subtítulos.

## Ask first

- Agregar un conteo de ventas sueltas o cuentas al turno.

## Never

- Tocar migraciones o la base.
- Cambiar cómo se calculan esperado, contado o diferencia.
- Abrir el navegador o levantar servidores.

## Verify

```sh
pnpm build && pnpm lint && pnpm test
```
