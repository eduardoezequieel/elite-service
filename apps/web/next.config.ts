import type { NextConfig } from 'next';

/**
 * Configuracion de Next.js. En Fase 0 se mantiene minima a proposito.
 *
 * Notas:
 * - `@elite/shared` se consume ya compilado (`dist/`), por eso NO hace falta
 *   `transpilePackages`. Si algun dia el paquete pasara a exportar TypeScript
 *   fuente, agregar aqui `transpilePackages: ['@elite/shared']`.
 * - Las variables de entorno publicas (`NEXT_PUBLIC_*`) se declaran en el
 *   `.env` de la raiz del monorepo; ver apps/web/AGENTS.md.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
