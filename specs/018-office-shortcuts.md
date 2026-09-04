# 018 — Efectivo por defecto, deshacer listo, Caja y Comisiones en el riel

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003-carwash, 009, 010

## Task

Tres atajos de la ola 1 sobre endpoints que ya existen. Evidencia: hallazgos
13, 15 y 37.

## Done

- [x] El diálogo de cobro abre con Efectivo elegido. Cancelar y volver a abrir
      también. El cajero puede pasar a Tarjeta o Transferencia.
- [x] Tras `Marcar listo` en `/carwash`, `/carwash/[id]`, `/floor` y
      `/floor/[id]`, el aviso dura 5s y trae `Deshacer`, que llama a `reopen`.
- [x] Caja (`carwash.cash`) y Comisiones (`carwash.commissions`) son pestañas
      del riel, grupo Operación. Salen de la cabecera de Lavados.
- [x] En `/carwash/cash` no queda activa también Lavados: gana el prefijo más
      largo.

## Always

- Una sola acción por fila de Lavados: no se suma `Reabrir` al lado de Cobrar.
- Autorización por clave de permiso, nunca por nombre de rol.

## Ask first

- (Cerrado) Deshacer 5s en el aviso, no un segundo botón en la fila.

## Never

- Nunca dejar Caja/Comisiones solo como botones de cabecera.
- Nunca filtrar el riel por rol.

## Verify

`pnpm lint && pnpm test && pnpm build`
