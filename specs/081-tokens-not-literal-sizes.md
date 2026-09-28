# 081 — Tokens en vez de tamaños literales

**Estado:** Borrador
**Módulo:** web | **Depende de:** DESIGN.md

## Task

La convención 7/9 del web prohíbe colores, radios, sombras y tamaños literales fuera de
`globals.css`. Hoy hay 110 líneas con `-[NNpx]` (`w-[68px]`, `text-[38px]`, `gap-[18px]`,
`pb-[110px]`…), un `rgb()` con sombra a mano en `floor-ticket-detail.tsx`, dos `uppercase` y dos
gradientes inline. Cada valor pasa a un token con nombre y las pantallas lo usan.

## Done

- [ ] Inventario previo: la spec lista cada literal con archivo y valor antes de tocar nada.
- [ ] Tokens nuevos en `globals.css` (ejemplos): `--rail-w`, `--rail-w-collapsed`, `--bottom-bar-h`,
      `--page-px`, `--stat-size`, `--display-size-lg`, `--grid-gap`, `--gradient-flame`.
      Cada uno en `:root` y, si aplica, redefinido por `data-density`.
- [ ] `grep -rnE '\-\[[0-9.]+px\]' apps/web/src` → 0 líneas fuera de `components/design-reference/`.
- [ ] `grep -rnE 'rgb\(|oklch\(|hsl\(|#[0-9a-fA-F]{3,8}\b' apps/web/src --exclude=globals.css`
      → 0 líneas fuera de `design-reference/`.
- [ ] `grep -rn 'uppercase' apps/web/src` → 0.
- [ ] `grep -rn 'shadow-\[' apps/web/src` → 0. La sombra del pie de `floor-ticket-detail` se
      resuelve con `border-t border-line` (diseño plano) o con un token `--shadow-sheet` si
      DESIGN.md lo admite.
- [ ] `gridTemplate` (`@deprecated`) sale de `data-table.tsx`; `canEditPrice = true` sale de
      `ticket-form.tsx` junto con la rama muerta.
- [ ] `DESIGN.md` lista los tokens nuevos en el mismo commit.

## Always

- Mismo resultado en pantalla: es un cambio de nombre, no de medida. Se anota en la spec cualquier
  píxel que cambie y por qué.
- Los `style={{ width }}` calculados en runtime (barras de rendimiento) se quedan: no son literales.

## Ask first

- Cualquier medida que no tenga sentido como token (un caso único). Puede quedar como
  `--x-<pantalla>` o volverse una clase de Tailwind estándar.

## Never

- Reemplazar un literal por otro literal «más redondo».

## Verify

`pnpm build && pnpm lint && ! grep -rnE '\-\[[0-9.]+px\]' apps/web/src/features apps/web/src/components/app-shell apps/web/src/components/ui`
