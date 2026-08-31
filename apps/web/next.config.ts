import fs from 'node:fs';
import path from 'node:path';
import type { NextConfig } from 'next';

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
