#!/usr/bin/env bash
# Publica lo último de main en el VPS (spec 093).
# Uso: bash deploy/deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="deploy/.env.production"
REQUIRED_KEYS=(DOMAIN POSTGRES_USER POSTGRES_PASSWORD POSTGRES_DB JWT_SECRET PIN_PEPPER
  ADMIN_EMAIL ADMIN_PASSWORD R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET)
HEALTH_TIMEOUT=120

say() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
dc() { docker compose -p elite --env-file "$ENV_FILE" -f deploy/compose.yml "$@"; }

# Lee KEY=valor del archivo de secretos sin ejecutarlo (quita comillas y \r).
env_get() {
  local v
  v="$(grep -E "^[[:space:]]*$1=" "$ENV_FILE" | tail -n 1 || true)"
  v="${v#*=}"
  v="${v%$'\r'}"
  v="${v%\"}"; v="${v#\"}"
  v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

[ -f "$ENV_FILE" ] || fail "No existe $ENV_FILE. Copialo de la sección de producción de .env.example (ver deploy/README.md)."

missing=()
placeholder=()
for key in "${REQUIRED_KEYS[@]}"; do
  value="$(env_get "$key")"
  if [ -z "$value" ]; then
    missing+=("$key")
  elif [[ "$value" == change_me* ]]; then
    placeholder+=("$key")
  fi
done
[ ${#missing[@]} -eq 0 ] || fail "Faltan valores en $ENV_FILE: ${missing[*]}"
[ ${#placeholder[@]} -eq 0 ] || fail "Todavía tienen el valor de ejemplo (change_me...): ${placeholder[*]}"

DOMAIN="$(env_get DOMAIN)"
[[ "$DOMAIN" != 203-0-113-* ]] || fail "DOMAIN todavía es el de ejemplo: poné la IP de tu VPS con guiones + .sslip.io."

branch="$(git rev-parse --abbrev-ref HEAD)"
[ "$branch" = "main" ] || fail "El repo del VPS está en '$branch'; producción sale de main (git checkout main)."

say "Bajando lo último de main"
git pull --ff-only

say "Compilando las imágenes (tarda unos minutos)"
dc build

say "Levantando los servicios"
dc up -d --remove-orphans

say "Esperando a que https://$DOMAIN/api/health responda (hasta ${HEALTH_TIMEOUT} s)"
SECONDS=0
until curl -fsS -o /dev/null --max-time 5 "https://$DOMAIN/api/health"; do
  if [ "$SECONDS" -ge "$HEALTH_TIMEOUT" ]; then
    printf '\nERROR: el sitio no respondió en %s s. Estado y últimos logs:\n\n' "$HEALTH_TIMEOUT" >&2
    dc ps >&2 || true
    printf '\n--- api ---\n' >&2
    dc logs --tail 50 api >&2 || true
    printf '\n--- caddy ---\n' >&2
    dc logs --tail 50 caddy >&2 || true
    exit 1
  fi
  sleep 3
done

say "Limpiando imágenes viejas"
docker image prune -f >/dev/null

say "Listo: https://$DOMAIN está arriba ($(git rev-parse --short HEAD))."
