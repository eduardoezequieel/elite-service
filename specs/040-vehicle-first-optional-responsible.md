# 040 — El carro es la entidad; el responsable es opcional

**Estado:** Terminada
**Módulo:** carwash + customers + vehicles | **Depende de:** 003, 004, 012, 021, 030

## Task

1. Abrir un lavado con placa + tipo de carro + servicio, **sin nombre**.
2. El cliente deja de ser obligatorio y pasa a **responsable** opcional, ligado al carro (`VehicleOwner`), no al ticket.
3. En el cobro, si el carro no tiene responsable, se puede buscar o crear nombre + teléfono y queda pegado a ese carro. Cobrar no se bloquea si sigue vacío.

## Done

- [x] `WorkOrder.customerId` es nullable. No se crea un cliente fantasma «Sin nombre».
- [x] `POST` de alta (oficina y pista) abre el ticket con `customerId` nulo cuando no hay responsable.
- [x] En pista, el alta no pide nombre: placa + tipo + servicio alcanzan. El responsable es un control secundario, plegado.
- [x] Placa conocida con responsable: se muestra y no hay que tocarlo para abrir.
- [x] Placa conocida sin responsable: se abre igual.
- [x] En cobro, un bloque «Responsable» permite vincular nombre/teléfono al carro (existente o nuevo) antes o al cobrar.
- [x] Vincular un responsable actualiza el dueño actual del vehículo (`VehicleOwner.isCurrent`) y, si el ticket estaba sin cliente, también el ticket.
- [x] La UI dice **responsable**, no «dueño». Densidad `bahia` ≥ 44px.

## Always

- Máscara de placa SV (024). Una placa = un vehículo (RN-12).
- Autorización por permiso, nunca por nombre de rol.
- Errores `{ code, message, details? }`.
- Contrato de alta y cobro en `@elite/shared`, una sola vez.

## Ask first

- (Cerrado) El cobro se puede hacer sin responsable.
- (Cerrado) La pestaña Clientes se queda. La ficha del carro del prototipo no entra en esta spec.

## Never

- Nunca exigir nombre en pista para abrir un lavado.
- Nunca inventar un cliente «Sin nombre» para satisfacer el schema.
- Nunca pisar en silencio el responsable de un carro conocido (012).

## Verify

`scripts/verify-040.sh` — contra un stack levantado: alta solo con placa (201, `customerId` null), alta con placa conocida que ya tiene responsable (el dueño no cambia), cobro sin responsable (el ticket pasa a PAID), cobro vinculando un responsable nuevo (el carro queda con `VehicleOwner` actual y el ticket con ese `customerId`).
