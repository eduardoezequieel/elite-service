# Fallas conocidas

## La web da `ENOENT … .next…` o queda en blanco: dos procesos en la misma carpeta de salida

Dos procesos de Next escribiendo en el mismo `distDir` se pisan los chunks y los manifiestos. Se ve
de tres formas, según qué alcanzó a pisar:

- **En silencio.** La página sirve el HTML pero `main-app.js` da 404, React no arranca y la
  pantalla queda vacía sin un solo error en la terminal.
- **A los gritos (webpack).** La terminal repite `Could not find the module … in the React Client
Manifest` y después `Cannot read properties of undefined`; la ruta devuelve 500 y recompila con
  muchos menos módulos que antes.
- **A los gritos (Turbopack).** La terminal repite `ENOENT: no such file or directory, open
'…/app-build-manifest.json'` y `…/_buildManifest.js.tmp.…`, y todas las rutas dan error.

En los tres casos **el código está bien**: no hay nada que arreglar en `src/`.

La causa clásica era `next build` encima de `next dev`. Ya no puede pasar: el `dev` escribe en
`apps/web/.next-dev` y el `build` en `apps/web/.next` (`distDir` por fase en `next.config.ts`). Lo
que sí sigue pudiendo pasar es **dos `next dev` a la vez sobre el mismo checkout**, por ejemplo la
pestaña Dev de Orca más un `pnpm dev` en otra terminal.

Salida: matá el `dev` de más (`pgrep -fl "next dev"`), borrá `apps/web/.next-dev` y levantá uno solo.

## El API se cae cuando alguien (o un agente) corre `pnpm build`

`nest build` borra su carpeta de salida antes de compilar (`deleteOutDir` en `nest-cli.json`). Si el
`dev` corría desde esa misma carpeta, el build se la borraba al API vivo y se caía. Ya no puede
pasar: el `dev` compila en `apps/api/dist-dev` (`tsconfig.dev.json`) y el `build` en
`apps/api/dist`. Si el API se sigue cayendo con cada build, el `dev` que tenés corriendo es anterior
al cambio: reinicialo una vez.

## `pnpm dev` muere con `'${PORT:-3100}' is not a non-negative number`

El script de `@elite/web` no puede usar sintaxis de bash (`${PORT:-3100}`). En macOS pnpm corre los scripts con bash y eso se expande; en Windows los corre con cmd y Next recibe el texto literal. El puerto lo resuelve `apps/web/scripts/run-next.mjs` (`PORT` del entorno, si no el `.env` de la raíz, si no `3100`).

## Una rejilla ignora su corte de escritorio (`min-table:`, `md:`) y queda en una sola columna

Tailwind 4 ordena las media queries agrupando por unidad antes que por tamaño. Si un corte está en
`rem` (los de fábrica: `sm` = 40rem) y otro en `px` (los nuestros), `sm:` puede salir **después** de
`min-table:` en el CSS y pisarlo en escritorio. Pasó en el resumen de Rendimiento: `sm:grid-cols-2`
le ganaba a `min-table:grid-cols-6` y cada cifra ocupaba la fila entera. Todos los
`--breakpoint-*` de `globals.css` van en `px`; un corte nuevo, también.

## `prisma migrate deploy` falla en `one_active_wash_per_vehicle`: «could not create unique index»

La migración de la spec 090 crea el único parcial que deja un solo lavado sin cobrar por carro. Si la
base ya tiene un carro con dos o más en `OPEN`, `WASHING` o `READY` —se podía hasta esa spec—, el
índice no se puede crear y el API no arranca (en Render, el deploy queda en rojo). Para encontrarlos:

```sql
SELECT v.plate, w.number, w.status, w."createdAt"
FROM work_orders w JOIN vehicles v ON v.id = w."vehicleId"
WHERE w.status IN ('OPEN', 'WASHING', 'READY')
  AND w."vehicleId" IN (
    SELECT "vehicleId" FROM work_orders
    WHERE status IN ('OPEN', 'WASHING', 'READY')
    GROUP BY "vehicleId" HAVING count(*) > 1
  )
ORDER BY v.plate, w."createdAt";
```

Local: el API viejo sigue arrancando sin la migración, así que cobrá o anulá los que sobran desde la
app (no a mano en la base: anular repone inventario) y volvé a correr
`pnpm --filter @elite/api db:deploy`. En Render el `startCommand` corre la migración antes de
levantar el API, así que la app no está: hacé el deploy del commit anterior a la 090, limpiá desde
la app y volvé a desplegar.
