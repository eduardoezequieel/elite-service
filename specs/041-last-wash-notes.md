# 041 — Notas del último lavado al anotar un carro conocido

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003, 012, 040

## Task

Cuando un carro conocido vuelve, la ficha «Ya lo conocemos» muestra las notas del último lavado
(además de cuándo vino y qué le hicieron), para saber qué ofrecerle. Quien lava y quien cobra
pueden dejar esa nota en el ticket.

## Done

- [x] `VehicleWithOwner` incluye `lastWash: { createdAt, serviceName, notes } | null`: el último
      ticket no anulado de ese vehículo. Oficina y pista lo leen del lookup de placa; no se infiere
      listando tickets de pista (esa lista no trae PAID).
- [x] La ficha de vehículo conocido (oficina y pista) muestra esas notas al lado de «Último lavado».
- [x] Si `lastWash` es null o `notes` está vacío, el bloque de notas no aparece. No se inventa texto.
- [x] En pista, el detalle del ticket permite leer y guardar `notes` (`PATCH /floor/tickets/:id`;
      el schema ya lo acepta).
- [x] En oficina, el cobro permite leer y guardar `notes` del ticket (el alta y la edición ya lo tienen).
- [x] La UI dice **nota** (del último lavado). Densidad `bahia` ≥ 44px.

## Always

- Reutilizar `WorkOrder.notes` (máx. 500). No hay tabla nueva ni «preferencias del carro».
- Autorización por permiso, nunca por nombre de rol.
- Errores `{ code, message, details? }`.
- Contrato en `@elite/shared`.

## Ask first

- (Cerrado) Solo las notas del último lavado no anulado, no el historial.
- (Cerrado) Quien lava (pista) y quien cobra (oficina) pueden escribir la nota del ticket abierto.
- (Cerrado) Las notas viejas no se copian al ticket nuevo.

## Never

- Nunca bloquear el alta ni el cobro por falta de nota.
- Nunca mostrar notas de un ticket VOID.
- Nunca mezclar las notas de caja (`CashSession.notes`) con las del lavado.

## Verify

`scripts/verify-041.sh` — lookup de placa conocida con un lavado PAID que tiene notes: el vehículo
trae `lastWash.notes`; lookup cuyo último ticket es VOID: `lastWash` es el anterior no anulado o
null; `PATCH` de pista y `PATCH` de oficina persisten `notes`.
