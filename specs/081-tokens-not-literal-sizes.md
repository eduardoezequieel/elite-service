# 081 — Tokens en vez de tamaños literales

**Estado:** Terminada (aprobada por chat, 27 sept 2026: «como veas que no se pateen todas, adelante»)
**Módulo:** web | **Depende de:** DESIGN.md

## Task

La convención 7/9 del web prohíbe colores, radios, sombras y tamaños literales fuera de
`globals.css`. Hoy hay 110 líneas con `-[NNpx]` (`w-[68px]`, `text-[38px]`, `gap-[18px]`,
`pb-[110px]`…), un `rgb()` con sombra a mano en `floor-ticket-detail.tsx`, dos `uppercase` y dos
gradientes inline. Cada valor pasa a un token con nombre y las pantallas lo usan.

## Done

- [x] Inventario previo: la spec lista cada literal con archivo y valor antes de tocar nada.
- [x] Tokens nuevos en `globals.css` (ejemplos): `--rail-w`, `--rail-w-collapsed`, `--bottom-bar-h`,
      `--page-px`, `--stat-size`, `--display-size-lg`, `--grid-gap`, `--gradient-flame`.
      Cada uno en `:root` y, si aplica, redefinido por `data-density`.
- [x] `grep -rnE '\-\[[0-9.]+px\]' apps/web/src` → 0 líneas fuera de `components/design-reference/`.
- [x] `grep -rnE 'rgb\(|oklch\(|hsl\(|#[0-9a-fA-F]{3,8}\b' apps/web/src --exclude=globals.css`
      → 0 líneas fuera de `design-reference/`. Quedan 6 falsos positivos: el folio `#142` en
      cuatro `*.spec.ts` y un comentario de `notification.ts`; son texto, no colores.
- [x] `grep -rn 'uppercase' apps/web/src` → 0.
- [x] `grep -rn 'shadow-\[' apps/web/src` → 0. La sombra del pie de `floor-ticket-detail` se
      resuelve con `border-t border-line` (diseño plano) o con un token `--shadow-sheet` si
      DESIGN.md lo admite.
- [x] `gridTemplate` (`@deprecated`) sale de `data-table.tsx`; `canEditPrice = true` sale de
      `ticket-form.tsx` junto con la rama muerta.
- [x] `DESIGN.md` lista los tokens nuevos en el mismo commit.

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

## Inventario (antes de tocar nada, 27 sept 2026)

Salida de los greps del **Done**, fuera de `components/design-reference/`. Rutas relativas a
`apps/web/src/`. Todo lo que no es un tamaño con papel propio va a la escala de espaciado de
Tailwind (`--spacing`, 0.25rem = 4px): mismo píxel, sin corchetes (`p-[14px]` → `p-3.5`). Es lo que
el código ya hace con `gap-3.5` o `px-2.5`, y el caso «clase de Tailwind estándar» del **Ask first**.

**Riel y barra inferior**

- `components/app-shell/nav-rail.tsx:89` → `w-[68px]` / `w-[248px]` (ancho plegado / abierto)
- `nav-rail.tsx:138` → `rounded-[9px]` (ítem del riel)
- `nav-rail.tsx:144` → `before:w-[3px] before:rounded-r-[3px]` + `bg-[linear-gradient(180deg,…)]`
- `nav-rail.tsx:159` → `px-[7px]` (contador del ítem)
- `components/app-shell/nav-bottom-bar.tsx:52`, `:111` → `text-[11px]/4` (rótulo del ícono)
- `nav-bottom-bar.tsx:113` → `before:h-[3px] before:rounded-b-[3px]` + `bg-[linear-gradient(90deg,…)]`
- `nav-bottom-bar.tsx:120` → `text-[10px]` (contador sobre el ícono)
- `components/ui/tabs.tsx:110` → `after:h-[2.5px]` (subrayado de la pestaña activa)

**Página (`main` y barras fijas de resumen)**

- `components/app-shell/app-shell.tsx:28` → `max-w-[1440px] pt-[22px] pb-[110px] md:px-[34px] md:pt-[30px] md:pb-[60px]`
- `features/carwash/components/ticket-summary.tsx:154` → `max-w-[1440px] md:px-[34px]`
- `ticket-summary.tsx:167` → `w-[152px]` (botón de la barra de resumen)
- `features/sales/components/sale-summary.tsx:151` → `max-w-[1440px] md:px-[34px]`
- `sale-summary.tsx:169` → `min-w-[152px]`
- (fuera del grep, mismo archivo) `ticket-summary.tsx:150` → `bottom-[calc(64px+…)]` (alto de la barra inferior)

**Separación entre bloques de rendimiento** — `gap-[18px]`

- `features/carwash/components/performance/performance-loyalty.tsx:76`, `:89`, `:172`, `:182`
- `performance-times.tsx:87`, `:197` · `performance-extras.tsx:75`, `:184` · `performance-summary.tsx:57`

**Cifras (display)**

- `components/ui/stat-card.tsx:77` → `text-[28px] sm:text-[32px]`
- `performance-parts.tsx:70` → `text-[38px]` (cifra en `bahia`)
- `performance-parts.tsx:73`, `:74` → `text-[20px]` / `text-[25px]` bahia (cifra que es un nombre)
- `features/carwash/components/ticket-status-hero.tsx:61` → `text-[34px]` (en `bahia`)
- `components/ui/segment-gauge.tsx:78` → `text-[19px]` (valor del medidor)

**Texto chico de interfaz**

- `features/notifications/components/notifications-drawer.tsx:234` → `text-[13.5px]` (título del grupo)
- `notifications-drawer.tsx:305`, `:309` → `text-[12px]` (fecha y contador del filtro)
- `notifications-drawer.tsx:349` → `text-[11.5px]` (contador del chip)
- `components/ui/label.tsx:14` → `text-[13px]` · `performance-times.tsx:356` → `text-[13px]`
- `components/ui/empty-state.tsx:34` → `text-[16px]` · `performance-screen.tsx:210` → `text-[16px]` (bahia) ·
  `performance-bars.tsx:101` → `text-[16px]` (bahia)

**Chip de placa y sello**

- `components/ui/plate-chip.tsx:18` → `rounded-[6px]`
- `plate-chip.tsx:22` → `text-[12px]` · `:23` → `px-[9px] py-[5px] text-[13.5px]` · `:24` → `text-[16px]`
- `components/ui/stamp.tsx:64` → `gap-[7px]` · `:72` → `px-[11px] py-[5px]`
- `components/ui/filters-popover.tsx:200` → `px-[7px]` (contador)
- `notifications-drawer.tsx:198` → `py-[3px]` · `:339` → `gap-[7px]` · `:378` → `size-[30px]`

**Filete de seleccionable** — `border-[1.5px]`

- `features/carwash/components/customer-field.tsx:193` · `body-type-card.tsx:122` ·
  `service-picker.tsx:110`, `:269`, `:294` · `product-picker.tsx:235` · `ticket-form.tsx:480` ·
  `known-vehicle-card.tsx:44` · `vehicle-change-dialog.tsx:199` ·
  `features/inventory/components/employee-radio-grid.tsx:93`

**Anchos de campo y columna**

- `features/carwash/components/change-price-dialog.tsx:103`, `:111` → `min-w-[140px]` (monto)
- `features/sales/components/sale-price-dialog.tsx:85`, `:91` → `min-w-[140px]`
- `features/carwash/components/charge-payment.tsx:316` → `w-[140px]` · `:432` → `min-w-[140px]` · `:438` → `min-w-[160px]`
- `customer-field.tsx:285` → `min-w-[200px]` · `features/sales/components/sales-screen.tsx:193` y
  `features/banking/components/bank-accounts-screen.tsx:116` → `min-w-[200px]` (cabecera)
- `components/ui/data-table.tsx:234`, `:285` → `w-[72px]` (columna Ref.)
- `features/carwash/components/board-screen.tsx:162`, `:167`, `:173`, `:181` → `min-w-[150px]`
- `features/floor/components/floor-queue.tsx:109` → `min-w-[240px]`
- `performance-screen.tsx:171` → `sm:w-[280px]`
- `features/auth/components/login-form.tsx:109`, `features/floor/components/floor-login-form.tsx:108` → `max-w-[380px]`
- `components/ui/help-tip.tsx:92` → `max-w-[260px]`
- `features/roles/components/permission-matrix.tsx:157` → `min-h-[360px] md:min-h-[420px]`

**Paddings de fila y tarjeta**

- `data-table.tsx:337` → `p-[14px]` · `:424` → `px-[18px]`
- `stat-card.tsx:58` → `min-h-[96px] px-[18px]`
- `performance-parts.tsx:69` → `px-[22px]` (bahia) · `:183` → `py-[18px]` · `:258`, `:268` → `px-[18px]`
- `performance-screen.tsx:210` → `px-[18px]` (bahia)

**Piezas chicas**

- `service-picker.tsx:280` → `size-[18px]` · `:284` → `size-[9px]` (el radio)
- `components/ui/checkbox.tsx:26` → `size-[17px] rounded-[5px]`
- `performance-times.tsx:338` → `gap-[3px] p-[3px]` · `:356` → `rounded-[7px]` (selector segmentado)
- `performance-bars.tsx:48`, `:80` → `rounded-[1px]` · `:74` → `min-w-[3px] rounded-r-[4px] h-[22px]`
- `performance-parts.tsx:166` → `w-[112px]` (medidor en bahia)
- `components/ui/skeleton.tsx:16` → `rounded-[6px]` · `:91` → `rounded-[8px]`
- `components/ui/table.tsx:102`, `:115` → `translate-y-[2px]`

**Cortes sueltos** (el grep los caza por la forma `min-[NNNpx]:`)

- `min-[1100px]:` / `max-[1099.98px]:` → `data-table.tsx:227`, `:324`, `:461`, `:471`, `:481` ·
  `performance-parts.tsx:93`–`95` · `performance-extras.tsx:242` ·
  `features/roles/components/roles-table.tsx:108`
- `min-[640px]:` → `performance-parts.tsx:93`, `:95`
- `max-[420px]:` → `features/floor/components/floor-ticket-detail.tsx:181`

**Comentario** — `app/globals.css:542`–`543` nombra `text-[13.5px]` y `text-[28px]`.

**Color, sombra, mayúsculas**

- `floor-ticket-detail.tsx:209` → `shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.25)]`
- `vehicle-change-dialog.tsx:155` y `permission-matrix.tsx:164` → `uppercase` (+ `tracking-wide(r)`)
- Los `#142` de `*.spec.ts` y `notification.ts:59` son folios de lavado, no colores: el grep de
  color los caza por la forma. Quedan.

**Código muerto** — `data-table.tsx:116`–`117` (`gridTemplate`, nadie lo pasa) ·
`ticket-form.tsx:167`–`168` (`canEditPrice = true`) y su rama en `:579`–`581` y `:593`.

## Resultado

**Cómo se piden.** Todo token nuevo vive en `:root` (los de densidad, también en
`[data-density=…]`; los de página, redefinidos bajo 900px) y se consume con la sintaxis de variable
de Tailwind v4: `w-(--rail-w)`, `text-(length:--stat-size)`, `border-(length:--selectable-border)`,
`rounded-(--check-radius)`. No van a `@theme`: `cn()` pasa por `tailwind-merge`, que tomaría un
`text-stat` o un `border-selectable` por un color y se comería la clase al lado de `text-go-text` o
`border-flame`. Con `(length:--x)` lo clasifica bien. Los únicos de `@theme` son dos cortes, porque
una variante no acepta variables: `--breakpoint-table` (1100px) y `--breakpoint-narrow` (420px).
Los gradientes van como `tabs.tsx`: `before:[background-image:var(--gradient-rail-active)]`.

**Reusados sin token nuevo:** `rounded-sm` (6px: placa, esqueleto), `px-card` (22px: tarjeta de
rendimiento en bahia), `sm:` (= `min-[640px]:`) y la escala de espaciado para las medidas de una
sola pieza (`p-3.5`, `px-4.5`, `min-w-37.5`, `size-4.25`…).

**Píxeles que cambian:**

- Pie de `floor-ticket-detail`: sale la sombra a mano y el filete sube de `--line-soft` a `--line`.
  Diseño plano (DESIGN.md: sin sombras salvo el diálogo).
- Los rótulos de `vehicle-change-dialog` («Valor guardado en sistema») y `permission-matrix`
  («Módulos (N)») pierden `uppercase` y su `tracking-wide(r)`: convención 12, caja normal.
- `max-[1099.98px]:` → `max-table:` (`width < 1100px`): la franja de 0.02px entre 1099.98 y 1100 ya
  no queda sin estilo. Nada visible.
- La escala de espaciado está en rem: igual al píxel con la fuente raíz en 16px, que es la del
  sistema (nadie la cambia). Si alguien agranda la fuente del navegador, esas medidas crecen con él.
- La raya de 2px de las barras de rendimiento pasa de `rounded-[1px]` a `rounded-full`: en 2px de
  ancho el radio queda en 1px igual.

**Código muerto:** `gridTemplate` fuera de `DataTableProps`; `canEditPrice = true` fuera de
`ticket-form.tsx` con su ternario (queda el texto de la rama que corría) y el prop que se pasaba
igual al valor por defecto de `ServicePicker`. En ese archivo, además, solo el `border-[1.5px]` de
la línea 480.

**Fuera del alcance** (no son `-[NNpx]` y no los pide el grep): `minmax(230px,1fr)` /
`minmax(260px,1fr)` de `StatGrid`, `min-h-[max(var(--touch-min),44px)]` del paginador,
`calc(var(--control-h)_-_8px)` del selector segmentado y los `calc(NNpx * var(--board-scale))`
del tablero en `globals.css`.
