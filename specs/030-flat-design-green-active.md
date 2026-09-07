# 030 — Sin sombras y estados activos/cuadrados en verde

**Estado:** Terminada
**Módulo:** web | **Depende de:** 005, 007

## Task

1. Eliminar todas las sombras (`box-shadow`) del sistema a nivel de tokens CSS y componentes, adoptando diseño completamente plano.
2. Cambiar todos los sellos (`<Stamp>`) e indicadores de estado activo («Activo», «Activa») y de cuadre de caja («Cuadra») de gris a verde (`tone="green"`, `text-go-text`).
3. Actualizar el interruptor `<Switch>` cuando está activado (`checked`) a verde (`bg-go`).
4. Actualizar `DESIGN.md` y `apps/web/AGENTS.md` con la nueva convención visual.

## Done

- [x] Tokens `--shadow`, `--flame-glow`, `--shadow-elite`, `--shadow-pop` y `--shadow-flame` fijados en `none` en `src/app/globals.css` (tanto en `:root` como en `.light`).
- [x] Removidas las clases de sombra (`shadow-elite`, `shadow-flame`, `shadow-lg`) de `button.tsx`, `data-table.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `toast.tsx`, `ticket-summary.tsx`, `customer-field.tsx` y `design-reference.tsx`.
- [x] En `CashDifferenceStamp` (`cash-difference-stamp.tsx`), el estado «Cuadra» (`cents === 0`) usa `tone="green"` y `differenceToneClass(0)` devuelve `text-go-text`.
- [x] En `customers-screen.tsx` y `customer-detail-screen.tsx`, el sello «Activo» usa `tone="green"`.
- [x] En `employees-screen.tsx`, el sello «Activo» usa `tone="green"` tanto en tabla como en ficha.
- [x] En `users-table.tsx` y `user-dialog.tsx`, el sello «Activo» usa `tone="green"`.
- [x] En `catalog-screen.tsx` y `categories-screen.tsx`, los sellos «Activo» / «Activa» usan `tone="green"`.
- [x] En `switch.tsx`, el estado `data-[state=checked]` usa `bg-go text-white`.
- [x] `DESIGN.md` y `apps/web/AGENTS.md` actualizados reflejando el diseño sin sombras y el uso de verde para activos/cuadres.

## Always

- Mantener la palabra explícita en todos los chips de estado junto con el punto de color.
- Los inactivos se mantienen en `tone="neutral"` (`--text-dim`).
- Cero sombras visibles en tema claro y tema oscuro.

## Ask first

- ¿Los switches activos pasan a verde (`bg-go`) o se quedan con la llama (`bg-flame`)? (Incluido en el plan para verde).

## Never

- Nunca comunicar un estado únicamente por color sin etiqueta de texto.
- Nunca dejar `shadow-*` activas ni valores de sombra literal en `box-shadow`.

## Verify

`pnpm lint && pnpm test && pnpm build`
