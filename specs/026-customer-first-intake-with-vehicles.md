# 026 — Flujo cliente primero y preaparición de vehículos en alta de lavado

**Estado:** Terminada
**Módulo:** web + carwash | **Depende de:** 012, 021, 024

## Task

1. Reordenar el formulario de alta de lavado (`TicketForm`, pista y oficina) para que la búsqueda/selección del cliente esté primero.
2. Al seleccionar un cliente con carros registrados, consultar sus vehículos:
   - Si tiene exactamente 1 carro registrado: preseleccionarlo automáticamente (autollenando placa, tipo de carro, marca y color).
   - Si tiene más de 1 carro: mostrarlos como opciones tocables (`min-h-touch`) para elegir cuál llegó con 1 toque.
3. Si el cliente no tiene carros o vino con otro distinto, permitir escribir la placa y datos del vehículo normalmente.

## Done

- [x] `FloorTicketsController` admite `@Query('customerId')` en `GET /floor/vehicles`.
- [x] En `TicketForm`, la sección de cliente se ubica antes de la sección del vehículo.
- [x] Al seleccionar un cliente (`chosen`), se consultan sus vehículos registrados según la superficie (oficina o pista).
- [x] Si el cliente tiene exactamente 1 carro registrado, se preselecciona automáticamente (placa, tipo de carro, marca y color).
- [x] Si el cliente tiene más de 1 carro, se muestran como opciones tocables con placa en chip, marca, color y tipo.
- [x] Tocar un vehículo de la lista autollena placa, tipo de vehículo (`bodyTypeId`), marca y color.
- [x] Se mantiene la posibilidad de ingresar una placa diferente si el cliente trajo otro carro.
- [x] Si se cambia o quita el cliente, se resetea la selección y la lista de vehículos sugeridos.

## Always

- Mantener objetivos táctiles de 44px (`min-h-touch`) para tablet.
- Placa siempre en mono con tracking apropiado.
- Compatibilidad completa entre pista (`/floor/new`) y oficina (`/carwash/new`).

## Never

- Nunca bloquear el ingreso de una placa manual si el cliente trajo un vehículo no registrado.
- Nunca romper la creación de tickets ni las validaciones existentes.

## Verify

`pnpm lint && pnpm test && pnpm build`
