# 012 — Buscar el vehículo por placa al anotar un carro

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003-carwash

## Task

Al teclear la placa en `TicketForm`, buscar el vehículo con `GET /vehicles?q=` (oficina) o
`GET /floor/vehicles?q=` (pista) y, si existe, autollenar tipo de carro, marca, color y dueño
y mandar `vehicleId` en el alta. Si la placa ya existe, el alta **no** puede sobrescribir la
ficha del vehículo ni reasignar el dueño sin confirmación explícita del usuario.

Evidencia: `docs/UX_AUDIT.md` hallazgos 09 y 10.

## Done

- [x] `TicketFormValues` (`ticket-form.tsx`) incluye `vehicleId: string | null`.
- [x] Al teclear ≥4 caracteres de placa, con debounce de 250ms, se consulta el endpoint que
      corresponde a la superficie (oficina o pista). Varios resultados: se usa el de placa
      exacta (normalizada); si no hay exacta, el usuario elige de una lista.
- [x] Con vehículo encontrado: se muestra una lámina «Ya lo conocemos» con placa, tipo, marca,
      color, dueño y fecha del último lavado, y marca/color se muestran como texto plano sin
      caja (DESIGN.md Campo de texto).
- [x] Con vehículo encontrado, el alta manda `vehicleId` y **no** manda `bodyTypeId`, `make`
      ni `color`. Autollenar dueño setea `customerId` del ticket.
- [x] `POST /carwash/tickets` y `POST /floor/tickets` aceptan `vehicleId` opcional.
- [x] Si la placa existe y no se mandó `vehicleId`, el API responde `409` con
      `{ code: "VEHICLE_PLATE_EXISTS", message, details: { vehicle } }` y **no** muta la ficha.
      `ticket.usecases.ts` deja de reescribir `bodyTypeId`, `make`, `color` y el dueño en ese
      caso.
- [x] Para cambiar tipo, marca, color o dueño de un vehículo conocido, el usuario confirma en
      un diálogo que nombra el valor guardado y el nuevo. Si la placa es de **otro** cliente,
      ese diálogo pregunta si cambió de dueño o si se equivocó de placa.
- [x] Verificado en escritorio, en ancho de tablet y en densidad `bahia`.

## Always

- La placa se normaliza a mayúsculas en el valor, nunca con `text-transform` (hallazgo 30).
- El campo de placa lleva `inputMode` y máscara `A000-000` (un patrón de El Salvador).
- Si el usuario no tiene `vehicles.manage`, el diálogo de cambio no se renderiza y los datos
  del vehículo conocido se muestran como texto plano sin caja.
- `GET /vehicles?q=` exige `vehicles.read`. En pista se usa `GET /floor/vehicles?q=` (sesión
  de empleado). Errores en `{ code, message, details? }`.

## Ask first

- (Cerrado) Placa de otro cliente: el diálogo lo pregunta; no se decide en silencio.
- (Cerrado) Máscara: `A000-000`. Si aparece un segundo patrón real, se abre otra spec.

## Never

- Nunca sobrescribir silenciosamente la ficha de un vehículo desde el alta de un lavado.
- Nunca inventar marca ni color: si el vehículo guardado no los tiene, se quedan vacíos.
- Nunca condicionar por nombre de rol; solo contra `vehicles.read` / `vehicles.manage`.

## Verify

`scripts/verify-012.sh` — contra un stack levantado: alta con placa nueva, alta con placa
conocida mandando `vehicleId` (la ficha no cambia), y alta con placa conocida sin `vehicleId`
(responde 409 con el vehículo y **no** muta nada).
