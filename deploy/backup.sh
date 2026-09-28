#!/usr/bin/env bash
# Respaldo de la base: pg_dump comprimido en el VPS (14 días) + copia en R2 (30 días).
# Lo corre el cron a las 03:00 (deploy/setup-vps.sh); también se puede correr a mano:
#   bash deploy/backup.sh
# Un respaldo que no llega a R2 es un respaldo fallido: sale con código != 0 (RN-4).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="deploy/.env.production"
BACKUP_DIR="$ROOT/deploy/backups"
LOCAL_DAYS=14
R2_DAYS=30

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }
fail() { printf '[%s] ERROR: %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >&2; exit 1; }
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

[ -f "$ENV_FILE" ] || fail "No existe $ENV_FILE."
for key in POSTGRES_USER POSTGRES_DB R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET; do
  [ -n "$(env_get "$key")" ] || fail "Falta $key en $ENV_FILE."
done
PG_USER="$(env_get POSTGRES_USER)"
PG_DB="$(env_get POSTGRES_DB)"
R2_BUCKET="$(env_get R2_BUCKET)"

# rclone sin instalar nada en el host: config por variables, las llaves se pasan
# por entorno (no quedan en la línea de comandos).
export RCLONE_CONFIG_R2_TYPE=s3
export RCLONE_CONFIG_R2_PROVIDER=Cloudflare
export RCLONE_CONFIG_R2_ACCESS_KEY_ID="$(env_get R2_ACCESS_KEY_ID)"
export RCLONE_CONFIG_R2_SECRET_ACCESS_KEY="$(env_get R2_SECRET_ACCESS_KEY)"
export RCLONE_CONFIG_R2_ENDPOINT="https://$(env_get R2_ACCOUNT_ID).r2.cloudflarestorage.com"
export RCLONE_CONFIG_R2_NO_CHECK_BUCKET=true
rclone() {
  docker run --rm --user "$(id -u):$(id -g)" \
    -e RCLONE_CONFIG_R2_TYPE -e RCLONE_CONFIG_R2_PROVIDER \
    -e RCLONE_CONFIG_R2_ACCESS_KEY_ID -e RCLONE_CONFIG_R2_SECRET_ACCESS_KEY \
    -e RCLONE_CONFIG_R2_ENDPOINT -e RCLONE_CONFIG_R2_NO_CHECK_BUCKET \
    -v "$BACKUP_DIR:/data:ro" \
    rclone/rclone "$@"
}

mkdir -p "$BACKUP_DIR"
name="elite-$(date '+%Y%m%d-%H%M%S').dump"
tmp="$BACKUP_DIR/$name.tmp"
trap 'rm -f "$tmp"' EXIT

log "Inicio del respaldo: $name"
dc exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" -Fc >"$tmp" ||
  fail "pg_dump falló. ¿Está arriba el servicio postgres? (docker compose ... ps)"
[ -s "$tmp" ] || fail "El dump salió vacío."
mv "$tmp" "$BACKUP_DIR/$name"
log "Dump local listo: deploy/backups/$name ($(du -h "$BACKUP_DIR/$name" | cut -f1))"

# -mtime +13 = 14 días o más
find "$BACKUP_DIR" -maxdepth 1 -type f \( -name 'elite-*.dump' -o -name 'pre-restore-*.dump' \) \
  -mtime +$((LOCAL_DAYS - 1)) -print -delete | sed 's/^/  borrado local: /'
find "$BACKUP_DIR" -maxdepth 1 -type f -name '*.tmp' -mmin +60 -delete

log "Subiendo a R2: r2:$R2_BUCKET/elite/$name"
rclone copyto "/data/$name" "r2:$R2_BUCKET/elite/$name" ||
  fail "La subida a R2 falló. El dump quedó solo en el VPS: deploy/backups/$name"

log "Borrando de R2 los respaldos de más de $R2_DAYS días"
rclone delete --min-age "${R2_DAYS}d" "r2:$R2_BUCKET/elite/" ||
  fail "La subida salió bien, pero no se pudo limpiar R2 (revisá el permiso del token)."

log "Respaldo OK: $name"
