# 092 — El marco de Inventario no se vuelve a montar al cambiar de pestaña

**Estado:** Terminada (aprobada por chat, 28 sept 2026: «verifica por qué cada vez que hago
click en una tab, se renderiza nuevamente esto y se anima todo, solo debería de ser el contenido
interno»)
**Módulo:** inventory (web) | **Depende de:** 088, 091

## Task

Al pasar de Existencias a Movimientos o a Consumos del personal, la cabecera «Inventario» —título,
subtítulo, acciones— y las pestañas vuelven a entrar en cascada. Causa: cada pestaña es una ruta
distinta y cada pantalla envuelve su contenido con su propio `<InventoryFrame>`, así que Next
desmonta la página anterior y monta la nueva con un marco nuevo; la animación de entrada de la
spec 088 corre al insertarse el elemento. Solución: mover el marco a un layout de Next compartido
por las tres rutas, en un grupo de rutas `(tabs)`, para que solo cambie el hijo. Las fichas
`/inventory/[id]` y `/inventory/consumption/[employeeId]` quedan fuera del grupo y no llevan el
marco.

## Done

- [x] `app/(app)/inventory/(tabs)/layout.tsx` monta `<InventoryFrame>` una sola vez; las páginas
      `page.tsx`, `movements/page.tsx` y `consumption/page.tsx` se mueven dentro de `(tabs)/` sin
      cambiar sus URLs ni su `metadata`.
- [x] `InventoryFrame` deduce la pestaña activa de `usePathname()` en vez de recibir `section`.
- [x] `InventoryScreen`, `MovementsScreen` y `ConsumptionReportScreen` ya no envuelven con
      `InventoryFrame`: renderizan solo su contenido.
- [x] Al cambiar de pestaña, `[data-slot='screen-header']` y las pestañas conservan su nodo del
      DOM (no se reinsertan); el contenido de la pestaña sí entra con la cascada de la 088.
- [x] `/inventory/[id]` y `/inventory/consumption/[employeeId]` siguen sin marco y con su regreso.

## Always

- Las URLs no cambian: `/inventory`, `/inventory/movements`, `/inventory/consumption`.
- El filtro de cada pestaña sigue viviendo en su propia URL (091).
- `RequirePermission` se queda en cada página, no en el layout.

## Ask first

- Nada.

## Never

- No tocar la cascada de `globals.css` ni `motion.ts` para «apagar» la animación de la cabecera.
- No unir las tres rutas en una sola página con estado de pestaña en el cliente.

## Verify

```bash
pnpm build && pnpm lint && pnpm test
```

Sin script propio: no toca el API. La comprobación de que la cabecera ya no se anima la hace el
usuario en el navegador.
