# 079 — Alta de lavado atómica

**Estado:** Terminada (aprobada por chat, 27 sept 2026: «como veas que no se pateen todas, adelante»)
**Módulo:** carwash | **Depende de:** 003, 065

## Task

`TicketUseCases.create` crea el cliente (`resolveCustomerId`) y el vehículo (`createVehicleIfNew`)
antes de la transacción del lavado. Si después el kardex rechaza (`stockFailure`) o faltan datos
(`TICKET_INCOMPLETE`), quedan cliente y vehículo huérfanos. Además, tres `as string` tapan que
`missingFieldsOf` valida pero no estrecha el tipo. Se hace todo en una transacción y se tipa.

## Done

- [x] `TicketRepository.create` recibe el borrador completo (cliente nuevo o existente, vehículo
      nuevo o existente, líneas, lavadores) y hace las tres escrituras en **una** transacción de
      Prisma. Si algo falla, no queda ni cliente ni vehículo.
- [x] La validación `TICKET_INCOMPLETE` corre **antes** de cualquier escritura.
- [x] `missingFieldsOf` (dominio) devuelve `{ ok: true, draft: CompleteDraft } | { ok: false,
    missing }`; desaparecen los `as string` de `ticket.usecases.ts`.
- [x] La regla de placa tomada (`rejectTakenPlate`) hace una sola consulta, no `findByPlate` +
      `existsByPlate`.
- [x] `appendNote` lee y escribe dentro de una transacción con la fila bloqueada: dos notas
      simultáneas se concatenan, no se pisan.
- [x] Tests de aplicación: fallo de kardex en el alta → ni cliente ni vehículo en el repositorio
      en memoria; dos `appendNote` seguidos conservan las dos líneas.
- [x] `scripts/verify-079.sh`: alta con producto sin existencia → `409` y `SELECT count(*)` de
      clientes y vehículos sin cambios.

Puerto elegido: `NewTicketData.customer` es `{ id } | { create } | null` y `vehicle` es
`{ id, claimOwner } | { create }`; `PrismaTicketRepository.create` los escribe en su `$transaction`
con `vehicles/infrastructure/vehicle-writes.ts`. `findByPlate` devuelve la ficha activa o no.

## Always

- La creación de cliente por placa nueva se sigue comportando igual desde la pantalla.

## Ask first

- Si juntar las tres escrituras obliga a que `TicketRepository` conozca el repositorio de
  vehículos: se acepta un puerto compuesto (`TicketIntakeRepository`) o se pregunta.

## Never

- Compensar borrando cliente/vehículo después del fallo: es transacción o nada.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-079.sh`
