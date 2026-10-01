# syntax=docker/dockerfile:1
#
# Imagenes de produccion del VPS (spec 093). Se construye desde la raiz del repo:
#
#   docker build -f deploy/Dockerfile --target api .
#   docker build -f deploy/Dockerfile --target web .
#
# Cada target tiene su propio build: `--target api` no compila la web y al reves.
# Cada uno instala solo el cierre de dependencias de su app (`--filter <app>...`),
# con devDependencies: el api necesita el CLI de `prisma` al arrancar
# (`migrate deploy` + seed) y la web lee `next.config.ts` en `next start`.

ARG NODE_IMAGE=node:22-bookworm-slim

# --- base: Node 22 + pnpm de `packageManager`, ya descargado -------------------
FROM ${NODE_IMAGE} AS base
# openssl: Prisma lo necesita para elegir y correr su motor en bookworm-slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
# pnpm queda descargado en la imagen (COREPACK_HOME compartido y legible), asi el
# usuario `node` lo usa al arrancar sin bajar nada de internet.
ENV COREPACK_HOME=/opt/corepack \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    NEXT_TELEMETRY_DISABLED=1 \
    CHECKPOINT_DISABLE=1
RUN corepack enable \
  && corepack prepare pnpm@11.24.0 --activate \
  && chmod -R a+rX /opt/corepack
WORKDIR /app

# Manifiestos del workspace: la instalacion queda en su propia capa y solo se
# repite si cambian las dependencias, no el codigo.
FROM base AS manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/

# --- api ----------------------------------------------------------------------
FROM manifests AS api-build
RUN --mount=type=cache,id=elite-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@elite/api..."
COPY packages/shared packages/shared
COPY apps/api apps/api
# `prisma generate` carga prisma.config.ts, que pide DATABASE_URL aunque no se
# conecte. Es una URL de mentira solo para este paso (igual que en CI).
RUN pnpm --filter @elite/shared build \
  && DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm --filter @elite/api db:generate \
  && pnpm --filter @elite/api build

FROM api-build AS api
ENV NODE_ENV=production \
    API_PORT=3200
# El volumen `files` (spec 095) hereda el dueno de esta carpeta al crearse:
# sin esto queda de root y el API, que corre como `node`, no puede escribir.
RUN mkdir -p /data/files && chown node:node /data/files
USER node
# Falla el build si pnpm no esta disponible sin red para el usuario `node`.
RUN COREPACK_ENABLE_NETWORK=0 pnpm --version
EXPOSE 3200
# Igual que render.yaml: migraciones + seed idempotente + arranque.
CMD ["sh", "-c", "pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed && exec pnpm --filter @elite/api start"]

# --- web ----------------------------------------------------------------------
FROM manifests AS web-build
RUN --mount=type=cache,id=elite-pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --store-dir /pnpm/store --filter "@elite/web..."
COPY packages/shared packages/shared
COPY apps/web apps/web
# El rewrite /api -> api se fija en el build (next.config.ts): same-origin, y
# Next reenvia al servicio `api` de compose. En el VPS Caddy manda /api/* directo
# al api; este rewrite queda de respaldo si alguien pega a web:3100.
ARG NEXT_PUBLIC_API_URL=/api
ARG API_UPSTREAM=http://api:3200
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    API_UPSTREAM=${API_UPSTREAM}
# El build de la web compila shared primero. La cache de webpack no viaja a la imagen.
RUN pnpm --filter @elite/web build \
  && rm -rf apps/web/.next/cache

FROM web-build AS web
ENV NODE_ENV=production \
    PORT=3100
# `next start` escribe su cache en .next/cache: es lo unico que necesita el usuario `node`.
RUN mkdir -p apps/web/.next/cache && chown node:node apps/web/.next/cache
USER node
RUN COREPACK_ENABLE_NETWORK=0 pnpm --version
EXPOSE 3100
CMD ["pnpm", "--filter", "@elite/web", "start"]
