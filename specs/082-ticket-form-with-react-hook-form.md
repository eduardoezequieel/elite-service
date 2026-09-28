# 082 — El alta de lavado con react-hook-form

**Estado:** Borrador
**Módulo:** web (carwash + sales) | **Depende de:** 003, 034, 051, 060, 065

## Task

`ticket-form.tsx` (778 líneas, 19 `useState`, 0 `useForm`) es el único formulario grande que no
usa `react-hook-form` + `zodResolver` (convención 5). Dos `useEffect` orquestan flujo (abren un
diálogo cuando cambia `error`, seleccionan vehículo sin deps completas) y un cast sin guard lee
`error.details`. `edit-ticket-dialog.tsx` y `new-sale-screen.tsx` repiten el patrón manual. Se
pasan los tres a la misma forma que `customer-dialog.tsx`.

## Done

- [ ] `ticket-form.tsx` usa `useForm` con `zodResolver(createTicketSchema)` de `@elite/shared`
      (o una composición de su `.shape`, como hace `customer-dialog.tsx`). Placa, tipo, marca,
      color, nota, cliente, lavadores y líneas viven en el form, no en `useState`.
- [ ] Selección de vehículo conocido / vehículo nuevo: es una acción del usuario (`onSelect`), no
      un `useEffect` sobre `data`. Desaparecen los dos efectos de las líneas ~231 y ~246.
- [ ] `error.details` con `vehicle` se valida con un guard de forma (como `sale-cart.ts`), sin
      `as { vehicle?: … }`.
- [ ] Los `catch {}` que tragan `updateCustomer`/`matchCustomer` distinguen `ApiError` (se sigue,
      documentado) de fallo de red (se muestra al pie del formulario con `role="alert"`).
- [ ] `ticket-form.tsx` queda bajo 400 líneas; lo que sobra se parte en `vehicle-fields.tsx`,
      `customer-fields.tsx`, `washer-picker.tsx` dentro de `features/carwash/components/`.
- [ ] `edit-ticket-dialog.tsx` y `sales/components/new-sale-screen.tsx` con `useForm` +
      `zodResolver` sobre los schemas compartidos.
- [ ] Sincronización URL⇄estado en `tickets-screen.tsx`, `performance-screen.tsx` y
      `sales-screen.tsx` usa `lib/list-params.ts` (076), sin `replaceState` a mano en el primer
      render.
- [ ] Todo `useEffect` que quede en esos archivos pasa `exhaustive-deps` (077) sin `eslint-disable`.
- [ ] Specs de la lógica extraída sin React (armado del borrador, líneas, lavadores) en
      `features/carwash/*.spec.ts`.

## Always

- Mismo comportamiento: placa conocida trae vehículo y cliente, precio bloqueado desde `READY`
  (060), productos con existencia (065), nota con conflicto (041).
- Densidad `bahia` y tablet: los campos siguen en `FieldBox`, objetivos táctiles de 44px.

## Ask first

- Antes de partir `charge-dialog.tsx` / `charge-payment.tsx`: van en la 083, no acá.

## Never

- Duplicar validación: si falta una regla en `createTicketSchema`, va a shared.
- Abrir el navegador para verlo: la revisión visual la hace el usuario.

## Verify

`pnpm build && pnpm lint && pnpm test && grep -c 'useForm' apps/web/src/features/carwash/components/ticket-form.tsx`
