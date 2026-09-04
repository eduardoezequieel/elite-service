import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Carga las variables del .env de la raiz del monorepo si existe
const rootEnvPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnvPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(rootEnvPath);
  } catch {
    // Si ya fue cargado o no se puede leer, continua normalmente
  }
}

/**
 * Configuracion de Next.js. En Fase 0 se mantiene minima a proposito.
 *
 * Notas:
 * - `distDir` depende de la fase: `next dev` escribe en `.next-dev` y
 *   `next build`/`next start` en `.next`. Si compartieran carpeta, un build
 *   lanzado con el dev andando le borra los manifiestos al servidor de
 *   desarrollo y la web muere con `ENOENT ... .next/...` sin que el codigo
 *   tenga la culpa. Next 15 no trae `isolatedDevBuild`; esta es la version
 *   manual de lo mismo.
 * - `@elite/shared` se consume ya compilado (`dist/`), por eso NO hace falta
 *   `transpilePackages`. Si algun dia el paquete pasara a exportar TypeScript
 *   fuente, agregar aqui `transpilePackages: ['@elite/shared']`.
 * - Las variables de entorno publicas (`NEXT_PUBLIC_*`) se declaran en el
 *   `.env` de la raiz del monorepo; ver apps/web/AGENTS.md.
 */
const nextConfig = (phase: string): NextConfig => ({
  reactStrictMode: true,
  distDir: phase === PHASE_DEVELOPMENT_SERVER ? '.next-dev' : '.next',
});

export default nextConfig;
