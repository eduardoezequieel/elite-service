# 034 — Combobox propio

**Estado:** Terminada
**Módulo:** web/ui | **Depende de:** 002-design-system, 004-customers, 016-create-catalog, 021-vehicles-on-customer, 028-unified-customer-fields-with-search

## Task

Sacar el `<select>` nativo y las sugerencias a mano. Una sola pieza `Combobox` según
`docs/prototype/combobox.html` (maqueta aprobada, sin la barra de llama en la opción activa).

Dos modos, una caja:

- lista corta — Tipo del carro, Categoría del servicio. Typeahead al teclear.
- búsqueda — Nombre del cliente en el alta. Se escribe; Enter sin elegir deja el texto.

## Done

- [x] `components/ui/combobox.tsx` exporta `Combobox`. El listado va en portal, mismo ancho que la caja, 8px de gap; si no cabe abajo se da vuelta; si no cabe de ningún lado scrollea adentro.
- [x] `lib/combobox.ts` concentra `foldText`, `filterOptions`, `typeaheadIndex`, `placeComboboxPanel`; hay tests.
- [x] `vehicle-dialog.tsx` (Tipo) y `catalog-screen.tsx` (Categoría) dejan el `<select>`.
- [x] `OwnerField` (Nombre) usa el modo búsqueda. La pastilla de registrado y «¿Es el mismo?» no se tocan.
- [x] Ningún `<select>` queda en `apps/web/src` salvo menciones en comentarios.
- [x] `DESIGN.md` y `apps/web/AGENTS.md` nombran la pieza.

## Always

- Tokens, los dos temas y las dos densidades. Tamaños desde `--field-*`, `--touch-min`, `--icon-size`.
- Elegida: tilde + peso 700 + `--surface-2`. Activa de teclado: el mismo fondo, sin barra.
- Panel plano: `--surface`, filete `--line-soft`, sin sombra. Encima del diálogo (portal).
- Escape cierra el listado y no el diálogo. Textos de UI en español.

## Ask first

- Nada: el gesto lo cerró el prototipo.

## Never

- Nunca `<select>` nativo, ni shadcn Combobox/Command, ni `cmdk`.
- Nunca un hex, un radio, una sombra ni un alto literal fuera de `globals.css`.
- Nunca `--gradient-action` ni barra de llama en una opción.
- Nunca tocar `IntakeField` (filas mixtas de placa/cliente/carro nuevo), el API ni el contrato.

## Verify

`pnpm --filter @elite/web test && pnpm lint && pnpm --filter @elite/web build && ! rg -l '<select' apps/web/src --glob '*.tsx' | rg -v washers-field`
