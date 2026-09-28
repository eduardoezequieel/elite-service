# 093 — Producción en un VPS de OVH (Docker Compose + Caddy + respaldos a R2)

**Estado:** Terminada (aprobada el 28 sept 2026, en el chat: «adelante»).
**Módulo:** infra | **Depende de:** 011 (entorno remoto de desarrollo), 042 (SSE)

## Contexto

El usuario contrató un VPS en OVH Cloud y quiere que sea **la producción real del lavado**, de uso
interno. Render/Vercel/Neon (spec 011) siguen siendo el entorno de pruebas y no se tocan. Sin
dominio comprado: el nombre sale de `sslip.io` a partir de la IP (`51-75-10-20.sslip.io`), y el
HTTPS lo pone Caddy con Let's Encrypt. El HTTPS es obligatorio, no un lujo: la cookie de sesión y
la de pista son `secure` con `NODE_ENV=production`.

Decisiones del usuario (chat, 28 sept 2026): producción real · `sslip.io` · deploy **a mano** con
un comando por SSH · respaldos a **Cloudflare R2**.

## Historias

- Como dueño, quiero publicar lo último de `main` con un solo comando en el VPS, para no depender
  de Render, que se duerme.
- Como dueño, quiero un respaldo diario de la base fuera del VPS, para no perder los lavados si
  el VPS se pierde.

## Criterios de aceptación

- **Dado** un Ubuntu 24.04 recién creado, **cuando** corro `sudo bash deploy/setup-vps.sh`,
  **entonces** quedan instalados Docker + Compose, el firewall con solo 22/80/443 abiertos, 2 GB
  de swap si la RAM es menor a 4 GB, las actualizaciones de seguridad automáticas y el cron del
  respaldo. Correrlo dos veces no duplica nada.
- **Dado** `deploy/.env.production` completo, **cuando** corro `bash deploy/deploy.sh`,
  **entonces** baja `main` con `--ff-only`, compila las imágenes, levanta los servicios y termina
  con código 0 solo si `https://$DOMAIN/api/health` responde 200 antes de 120 s.
- **Dado** el stack arriba, **entonces** Postgres, api y web **no** publican puertos al host; solo
  Caddy publica 80 y 443.
- **Dado** el stack arriba, **cuando** el browser pide `/api/*`, **entonces** Caddy lo manda
  directo al api (no pasa por Next), sin comprimir ni bufferear los `/stream` de SSE.
- **Dado** el cron diario (03:00, hora de El Salvador), **cuando** corre `deploy/backup.sh`,
  **entonces** deja un `pg_dump` comprimido en el VPS (se guardan 14 días) y lo sube a R2 (se
  guardan 30 días). Si la subida falla, el script sale con código ≠ 0 y lo deja en el log.
- **Dado** un dump, **cuando** corro `bash deploy/restore.sh <archivo|r2:nombre>`, **entonces**
  pide escribir `RESTAURAR` para confirmar, frena el api, restaura y lo vuelve a levantar.
- **Dado** que se reinicia el VPS, **entonces** todo vuelve a levantar solo (`restart:
unless-stopped`).

## Reglas de negocio

- **RN-1:** Un solo archivo de secretos en el VPS: `deploy/.env.production`, fuera del repo
  (gitignoreado). Sus claves se documentan en `.env.example` con valores de ejemplo.
- **RN-2:** `WEB_ORIGIN` es `https://$DOMAIN`. Cambiar de `sslip.io` a un dominio propio es
  cambiar `DOMAIN` y volver a correr `deploy.sh`; nada más.
- **RN-3:** Migraciones con `prisma migrate deploy` y seed idempotente al arrancar el api, igual
  que en Render. Nunca `migrate dev` en el VPS.
- **RN-4:** Un respaldo que no se sube a R2 es un respaldo fallido: el script no lo oculta.
- **RN-5:** `restore.sh` es la única forma documentada de pisar la base y siempre pide
  confirmación escrita.

## Datos

Sin cambios al schema.

## Archivos

| Archivo                 | Qué hace                                                                                                                                                                                                                                       |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `deploy/Dockerfile`     | Multi-stage sobre `node:22-bookworm-slim` con corepack. Un builder instala el workspace y compila shared + api (con `db:generate`) + web. Targets `api` y `web`. Build de web con `NEXT_PUBLIC_API_URL=/api` y `API_UPSTREAM=http://api:3200`. |
| `.dockerignore` (raíz)  | Excluye `node_modules`, `dist*`, `.next*`, `.git`, `.env*` (menos `.env.example`).                                                                                                                                                             |
| `deploy/compose.yml`    | `postgres` (16-alpine, volumen, healthcheck, sin puertos), `api` (espera a postgres sano; migrate + seed + start), `web`, `caddy` (80/443, volúmenes `caddy_data`/`caddy_config`). Todo `restart: unless-stopped`, `TZ=America/El_Salvador`.   |
| `deploy/Caddyfile`      | `{$DOMAIN}`: `/api/*` → `api:3200` con `flush_interval -1`; el resto → `web:3100` con `encode`.                                                                                                                                                |
| `deploy/setup-vps.sh`   | Preparación idempotente del VPS (criterio 1).                                                                                                                                                                                                  |
| `deploy/deploy.sh`      | Pull + build + up + espera de health + `docker image prune -f`.                                                                                                                                                                                |
| `deploy/backup.sh`      | `pg_dump -Fc` por `docker compose exec`, rotación local, subida y rotación en R2 con la imagen `rclone/rclone` (config por variables `RCLONE_CONFIG_R2_*`, sin instalar nada en el host).                                                      |
| `deploy/restore.sh`     | Restauración con confirmación (criterio 6).                                                                                                                                                                                                    |
| `deploy/README.md`      | Paso a paso para el usuario: crear bucket y token en R2, primer arranque, actualizar, respaldar, restaurar, pasar a dominio propio.                                                                                                            |
| `.env.example`          | Sección «Producción en VPS»: `DOMAIN`, `POSTGRES_*`, `JWT_SECRET`, `PIN_PEPPER`, `ADMIN_*`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`.                                                                          |
| `.gitignore`            | `deploy/.env.production` y `deploy/backups/`.                                                                                                                                                                                                  |
| `docs/ARCHITECTURE.md`  | ADR-013: producción en VPS con Docker Compose + Caddy (por qué no Render/Vercel para producción, por qué Caddy y no nginx).                                                                                                                    |
| `AGENTS.md` (raíz)      | Sección corta «Producción (spec 093)» con la tabla de dónde vive cada cosa y link a `deploy/README.md`.                                                                                                                                        |
| `scripts/verify-093.sh` | Verificación (abajo).                                                                                                                                                                                                                          |

## Fuera de alcance

- Deploy automático desde GitHub Actions (quedó para después).
- Dominio propio, email, monitoreo externo y alertas.
- Tocar `render.yaml`, `vercel.json` o el `docker-compose.yml` local.
- Cambios en `apps/*` o `packages/*`: el código ya soporta este despliegue tal cual.

## Always

- Solo Caddy expone puertos. Postgres nunca se publica al host.
- Secretos solo en `deploy/.env.production` del VPS; distintos a los del `.env` local y a los de
  Render.
- Scripts con `set -euo pipefail`, idempotentes donde se pueda y con mensajes en español.
- `node:22` (igual que CI y `engines`) y el `pnpm` de `packageManager`.

## Ask first

- Entrar al VPS por SSH o correr algo ahí: lo hace el usuario, salvo un sí explícito en el chat.
- Cualquier cambio en `apps/*` o `packages/*` que aparezca como necesario.

## Never

- Nada de secretos reales, IPs reales ni llaves en el repo.
- No `SameSite=None`, no cookie `Domain`, no desactivar `secure`.
- No `prisma migrate dev` ni `db push` en producción.
- No `docker compose down -v` en ningún script (borra la base).

## Tareas

- [x] `deploy/Dockerfile` + `.dockerignore`.
- [x] `deploy/compose.yml` + `deploy/Caddyfile`.
- [x] `deploy/setup-vps.sh`, `deploy/deploy.sh`, `deploy/backup.sh`, `deploy/restore.sh`.
- [x] `.env.example`, `.gitignore`, `deploy/README.md`.
- [x] ADR-013 y sección en `AGENTS.md`.
- [x] `scripts/verify-093.sh` pasa.

## Verificación

```bash
bash scripts/verify-093.sh
```

Comprueba, sin levantar nada: que existan los archivos; `bash -n` de cada script; que
`docker compose -f deploy/compose.yml config` valide con un env de ejemplo; que solo `caddy`
publique puertos; que no haya `down -v`, `migrate dev` ni secretos; y que ambas imágenes
(`--target api` y `--target web`) **compilen** con `docker build`. Lo que no puede probar desde
acá —el certificado de `sslip.io` y la subida a R2— lo prueba `deploy.sh` al final (health por
HTTPS) y el primer `backup.sh` en el VPS.
