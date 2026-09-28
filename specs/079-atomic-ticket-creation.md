# 079 — Alta de lavado atómica

**Estado:** Borrador
**Módulo:** carwash | **Depende de:** 003, 065

## Task

`TicketUseCases.create` crea el cliente (`resolveCustomerId`) y el vehículo (`createVehicleIfNew`)
antes de la transacción del lavado. Si después el kardex rechaza (`stockFailure`) o faltan datos
(`TICKET_INCOMPLETE`), quedan cliente y vehículo huérfanos. Además, tres `as string` tapan que
`missingFieldsOf` valida pero no estrecha el tipo. Se hace todo en una transacción y se tipa.

## Done

- [ ] `TicketRepository.create` recibe el borrador completo (cliente nuevo o existente, vehículo
      nuevo o existente, líneas, lavadores) y hace las tres escrituras en **una** transacción de
      Prisma. Si algo falla, no queda ni cliente ni vehículo.
- [ ] La validación `TICKET_INCOMPLETE` corre **antes** de cualquier escritura.
- [ ] `missingFieldsOf` (dominio) devuelve `{ ok: true, draft: CompleteDraft } | { ok: false,
    missing }`; desaparecen los `as string` de `ticket.usecases.ts`.
- [ ] La regla de placa tomada (`rejectTakenPlate`) hace una sola consulta, no `findByPlate` +
      `existsByPlate`.
- [ ] `appendNote` lee y escribe dentro de una transacción con la fila bloqueada: dos notas
      simultáneas se concatenan, no se pisan.
- [ ] Tests de aplicación: fallo de kardex en el alta → ni cliente ni vehículo en el repositorio
      en memoria; dos `appendNote` seguidos conservan las dos líneas.
- [ ] `scripts/verify-079.sh`: alta con producto sin existencia → `409` y `SELECT count(*)` de
      clientes y vehículos sin cambios.

## Always

- La creación de cliente por placa nueva se sigue comportando igual desde la pantalla.

## Ask first

- Si juntar las tres escrituras obliga a que `TicketRepository` conozca el repositorio de
  vehículos: se acepta un puerto compuesto (`TicketIntakeRepository`) o se pregunta.

## Never

- Compensar borrando cliente/vehículo después del fallo: es transacción o nada.

## Verify

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-079.sh`
