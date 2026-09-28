#!/usr/bin/env bash
# Restaura la base desde un respaldo (spec 093, RN-5). Pisa TODOS los datos actuales.
# Uso:
#   bash deploy/restore.sh --list                       # respaldos locales y en R2
#   bash deploy/restore.sh deploy/backups/elite-....dump # desde un archivo del VPS
#   bash deploy/restore.sh r2:elite-....dump             # lo baja de R2 y restaura
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="deploy/.env.production"
BACKUP_DIR="$ROOT/deploy/backups"

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

usage() {
  echo "Uso: bash deploy/restore.sh <deploy/backups/archivo.dump | r2:archivo.dump | --list>" >&2
  exit 1
}

[ $# -eq 1 ] || usage
[ -f "$ENV_FILE" ] || fail "No existe $ENV_FILE."
PG_USER="$(env_get POSTGRES_USER)"
PG_DB="$(env_get POSTGRES_DB)"
R2_BUCKET="$(env_get R2_BUCKET)"
[ -n "$PG_USER" ] && [ -n "$PG_DB" ] || fail "Faltan POSTGRES_USER o POSTGRES_DB en $ENV_FILE."
mkdir -p "$BACKUP_DIR"

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
    -v "$BACKUP_DIR:/data" \
    rclone/rclone "$@"
}

if [ "$1" = "--list" ]; then
  say "Respaldos en el VPS (deploy/backups)"
  ls -lh "$BACKUP_DIR"/*.dump 2>/dev/null || echo "  (ninguno)"
  say "Respaldos en R2 (r2:$R2_BUCKET/elite/)"
  rclone lsl "r2:$R2_BUCKET/elite/" || fail "No se pudo listar R2 (revisá las llaves R2_* del archivo de secretos)."
  exit 0
fi

arg="$1"
if [[ "$arg" == r2:* ]]; then
  name="${arg#r2:}"
  [[ "$name" =~ ^[A-Za-z0-9._-]+\.dump$ ]] || fail "Nombre inválido: '$name' (ejemplo: r2:elite-20260928-030000.dump)."
  say "Bajando $name de R2"
  rclone copyto "r2:$R2_BUCKET/elite/$name" "/data/$name" || fail "No se pudo bajar $name de R2."
  file="$BACKUP_DIR/$name"
else
  file="$arg"
fi
[ -s "$file" ] || fail "No existe o está vacío: $file"

cat <<EOF

ATENCIÓN: esto BORRA todos los datos actuales de la base '$PG_DB'
y los reemplaza por los de: $file

Antes se guarda una copia de lo actual en deploy/backups/pre-restore-*.dump.
Para seguir escribí RESTAURAR (en mayúsculas). Cualquier otra cosa cancela.
EOF
printf '> '
read -r answer </dev/tty
[ "$answer" = "RESTAURAR" ] || fail "Cancelado. No se tocó nada."

safety="$BACKUP_DIR/pre-restore-$(date '+%Y%m%d-%H%M%S').dump"
say "Guardando copia de lo actual: $safety"
dc exec -T postgres pg_dump -U "$PG_USER" -d "$PG_DB" -Fc >"$safety" ||
  { rm -f "$safety"; fail "No se pudo respaldar lo actual; no se restauró nada."; }

say "Frenando api y web"
dc stop api web
# Pase lo que pase, api y web vuelven a levantar.
trap 'say "Levantando api y web"; dc start api web' EXIT

say "Restaurando (una sola transacción: si algo falla, la base queda como estaba)"
if dc exec -T postgres pg_restore --clean --if-exists --no-owner --single-transaction \
  -U "$PG_USER" -d "$PG_DB" <"$file"; then
  say "Restauración OK desde $file"
else
  fail "pg_restore falló; la base quedó como estaba. Copia previa: $safety"
fi
