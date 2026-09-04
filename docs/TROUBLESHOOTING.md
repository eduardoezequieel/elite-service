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
