# 083 — Núcleo de carwash más chico

**Estado:** Borrador
**Módulo:** carwash (api + web) | **Depende de:** 075, 079, 082

## Task

`carwash` es el 48% del API (14.200 líneas): `TicketUseCases` tiene 928 líneas y 8 dependencias,
`ChargeUseCases` 577 y 8. En el web, `charge-dialog.tsx` (582, 10 `useState`, un `close()` que
resetea 14 cosas) y `charge-payment.tsx` (511) son la pieza más difícil de tocar. `money.ts`,
`numbering.ts`, `civil-range.ts` y `stock.ts` son compartidos de facto pero viven dentro de un
módulo. No es código enredado, es denso: se parte por responsabilidad, sin cambiar comportamiento.

## Done

- [ ] `common/domain/` en el API con `money.ts`, `numbering.ts`, `civil-range.ts`; `carwash`,
      `sales`, `inventory` y `banking` importan de ahí. Ningún módulo importa `domain/` de otro.
- [ ] `TicketUseCases` se parte en `TicketIntakeUseCases` (alta y edición), `TicketStatusUseCases`
      (estados, lavadores, notas) y `TicketQueryUseCases` (lista, detalle, línea de tiempo).
      Ningún archivo de `application/` supera 500 líneas; ninguna clase recibe más de 5 puertos.
- [ ] `ChargeUseCases.loadChargeable` usa `findByIds` (una consulta), no N `findById`.
- [ ] Un diagrama en `docs/ARCHITECTURE.md` (Mermaid) del camino de un cobro:
      `controller → ChargeUseCases → PrismaChargeRepository → counter-sale-ledger → stock-ledger`
      y qué módulo es dueño de cada paso.
- [ ] Web: `charge-dialog.tsx` guarda el estado del cobro en un `useReducer` con un solo `reset`;
      cada pestaña del diálogo (`efectivo`, `tarjeta`, `transferencia`, `otro`) es su componente
      en `features/carwash/components/charge/`. Ningún archivo supera 400 líneas.
- [ ] `date-field.tsx` (829) y `combobox.tsx` (575) se parten en `ui/date-field/` y
      `ui/combobox/` con un archivo por pieza (calendario, rango, entrada; lista, búsqueda, panel).
- [ ] Los 1.678 + 501 + 502 líneas de specs de `ticket.usecases`, `ticket-products` y
      `performance` siguen pasando sin cambiar ninguna aserción: solo cambian los imports.

## Always

- Cero cambios de comportamiento: los `verify-NNN.sh` de 003, 045, 059, 060, 065, 066 y 069 pasan
  igual antes y después.
- Un commit por corte; cada uno deja `pnpm build && pnpm test` en verde.

## Ask first

- Cualquier corte que obligue a cambiar una firma de endpoint o un contrato de shared.
- El orden de los cortes si preferís empezar por el web.

## Never

- Mezclar un refactor con un arreglo de bug: si aparece uno, se anota y se abre spec.
- Tocar `presentation/`: los controllers ya delegan bien.

## Verify

`pnpm build && pnpm lint && pnpm test && for s in 003 045 059 060 065 066 069; do bash scripts/verify-$s.sh; done`
