# 076 — Un solo formato de dinero y fecha en el web

**Estado:** Borrador
**Módulo:** web | **Depende de:** 026 (fechas), 065, 070

## Task

`formatMoney` existe tres veces con tres firmas: `carwash/pricing.ts` recibe centavos y devuelve
`'8.50'`, `carwash/cash-format.ts` recibe string y devuelve `'$8.50'`, `inventory/format.ts` otra
más. `formatCents` está en `carwash/performance.ts` y `inventory/consumption.ts`; `formatQuantity` en
`sale-cart.ts`, `product-lines.ts` e `inventory/format.ts`. El `Intl.DateTimeFormat` con
`weekday: 'long'` se arma cuatro veces. Se juntan en `lib/` con un nombre por significado.

## Done

- [ ] `lib/money.ts`: `formatMoney(amount: string): string` (`'$8.50'`), `formatCents(cents:
    number): string` (`'$8.50'`), `toCents(amount: string): number | null`, `centsToAmount(cents:
    number): string` (`'8.50'`), `moneyParts`. Cada una con un solo nombre y un solo significado.
- [ ] `lib/quantity.ts`: `formatQuantity`, `formatSignedQuantity`, `formatQuantityWithUnit`,
      `quantityMilli`, `milliToQuantity`.
- [ ] `lib/civil-date.ts` gana `dayLabel(iso | CivilDate)` («jueves 26 de septiembre») y
      `timeLabel(iso)`; `tickets-screen.tsx`, `board-screen.tsx`, `sale-format.ts` e
      `inventory/format.ts` lo usan en lugar de armar su `Intl.DateTimeFormat`.
- [ ] Ninguna feature exporta `formatMoney`, `formatCents` ni `formatQuantity` propios.
- [ ] `list-params.ts` (sincronización URL⇄estado) sale de `features/inventory/` a
      `lib/list-params.ts`; `catalog-screen.tsx` deja de importar desde inventario.
- [ ] Los specs existentes de `sale-cart`, `pricing`, `charge-math` y `format` siguen pasando y
      los helpers nuevos tienen el suyo en `lib/`.
- [ ] `DetailField` (copiado en `catalog-screen`, `employee-dialog`, `user-dialog`) pasa a
      `components/ui/detail-field.tsx`.

## Always

- Salida idéntica a la actual en cada pantalla: es un movimiento, no un rediseño.

## Ask first

- Si un helper tiene dos comportamientos distintos que hoy alguna pantalla necesita, se conservan
  los dos con nombres distintos; se pregunta antes de elegir uno.

## Never

- Mover lógica de negocio (descuentos, reparto de pagos) a `lib/`: solo formato.

## Verify

`pnpm build && pnpm lint && pnpm test && [ "$(grep -rln 'export function formatMoney' apps/web/src | wc -l)" -eq 1 ]`
