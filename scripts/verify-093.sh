#!/bin/bash
# Verificacion de la spec 093 (produccion en un VPS de OVH).
#
# No levanta nada: comprueba archivos, sintaxis de los scripts, que compose valide
# con un env de ejemplo, que solo caddy publique puertos, que no haya comandos
# prohibidos ni secretos, y que las dos imagenes compilen con `docker build`.
# El certificado de sslip.io y la subida a R2 los prueba deploy.sh / backup.sh
# en el VPS.
#
# Uso:
#   bash scripts/verify-093.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0

ok()   { echo "  OK   $1"; PASS=$((PASS+1)); }
fail() { echo "  FALLA $1"; FAIL=$((FAIL+1)); }

ck() {
  if [ "$2" = "$3" ]; then echo "  OK   $1  ($3)"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}

has() {
  local desc=$1 file=$2 needle=$3
  if grep -Fq -- "$needle" "$file" 2>/dev/null; then ok "$desc";
  else fail "$desc  no aparece '$needle' en $file"; fi
}

absent() {
  local desc=$1
  shift
  if grep -RIn "$@" >/dev/null 2>&1; then
    fail "$desc"
    grep -RIn "$@" | head -20
  else
    ok "$desc"
  fi
}

COMPOSE_FILE=deploy/compose.yml
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

echo "== 1. Archivos =="
for f in deploy/Dockerfile .dockerignore deploy/compose.yml deploy/Caddyfile \
         deploy/setup-vps.sh deploy/deploy.sh deploy/backup.sh deploy/restore.sh \
         deploy/README.md .env.example .gitignore docs/ARCHITECTURE.md AGENTS.md \
         scripts/verify-093.sh; do
  if [ -f "$f" ]; then ok "existe $f"; else fail "falta $f"; fi
done

echo
echo "== 2. Sintaxis de los scripts (bash -n + set -euo pipefail) =="
for f in deploy/*.sh; do
  [ -f "$f" ] || { fail "no hay scripts en deploy/"; break; }
  if bash -n "$f" 2>"$TMP_DIR/bashn.err"; then ok "bash -n $f";
  else fail "bash -n $f"; cat "$TMP_DIR/bashn.err"; fi
  has "$f usa set -euo pipefail" "$f" 'set -euo pipefail'
done

echo
echo "== 3. Dockerfile y Caddyfile =="
has "base node:22-bookworm-slim" deploy/Dockerfile 'node:22-bookworm-slim'
has "corepack" deploy/Dockerfile 'corepack enable'
PNPM_VERSION=$(node -p 'require("./package.json").packageManager.split("@")[1]')
has "pnpm de packageManager ($PNPM_VERSION)" deploy/Dockerfile "pnpm@$PNPM_VERSION"
has "install congelado" deploy/Dockerfile '--frozen-lockfile'
has "genera el cliente de Prisma" deploy/Dockerfile 'db:generate'
has "target api" deploy/Dockerfile 'AS api'
has "target web" deploy/Dockerfile 'AS web'
has "web con NEXT_PUBLIC_API_URL=/api" deploy/Dockerfile 'NEXT_PUBLIC_API_URL=/api'
has "web con API_UPSTREAM=http://api:3200" deploy/Dockerfile 'API_UPSTREAM=http://api:3200'
has "api: migrate deploy al arrancar" deploy/Dockerfile 'db:deploy'
has "api: seed al arrancar" deploy/Dockerfile 'db:seed'
has "openssl para Prisma" deploy/Dockerfile 'openssl'
has "corre como usuario node" deploy/Dockerfile 'USER node'
has ".dockerignore saca node_modules" .dockerignore 'node_modules'
has ".dockerignore saca .git" .dockerignore '.git'
has ".dockerignore saca .env" .dockerignore '.env'
has ".dockerignore deja .env.example" .dockerignore '!.env.example'
has ".dockerignore saca deploy/.env.production" .dockerignore 'deploy/.env.production'
has "Caddy sirve {\$DOMAIN}" deploy/Caddyfile '{$DOMAIN}'
has "Caddy: /api/* directo al api" deploy/Caddyfile 'reverse_proxy api:3200'
has "Caddy: SSE sin bufferear" deploy/Caddyfile 'flush_interval -1'
has "Caddy: el resto a la web" deploy/Caddyfile 'reverse_proxy web:3100'
# `encode` solo dentro del bloque de la web: nunca antes del handle de /api.
API_BLOCK=$(awk '/handle \/api\/\*/{f=1} f{print} f&&/^\t}/{exit}' deploy/Caddyfile)
if printf '%s\n' "$API_BLOCK" | grep -q 'encode'; then fail "Caddy comprime /api/*";
else ok "Caddy no comprime /api/*"; fi
BEFORE_API=$(awk '/handle \/api\/\*/{exit} {print}' deploy/Caddyfile | grep -v '^[[:space:]]*#')
if printf '%s\n' "$BEFORE_API" | grep -q 'encode'; then fail "encode global antes de /api/*";
else ok "sin encode global"; fi

echo
echo "== 4. docker compose config (env de ejemplo, fuera del repo) =="
EXAMPLE_ENV="$TMP_DIR/env.production.example"
cat >"$EXAMPLE_ENV" <<'EOF'
DOMAIN=203-0-113-10.sslip.io
POSTGRES_USER=elite
POSTGRES_PASSWORD=example_password
POSTGRES_DB=elite_service
JWT_SECRET=example_jwt_secret_for_verify_only
PIN_PEPPER=example_pin_pepper_for_verify_only
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=example_admin_password
R2_ACCOUNT_ID=example_account
R2_ACCESS_KEY_ID=example_key
R2_SECRET_ACCESS_KEY=example_secret
R2_BUCKET=example-bucket
EOF
DC=(docker compose --env-file "$EXAMPLE_ENV" -f "$COMPOSE_FILE")
if "${DC[@]}" config --quiet 2>"$TMP_DIR/config.err"; then ok "compose config valida";
else fail "compose config no valida"; cat "$TMP_DIR/config.err"; fi

if "${DC[@]}" config --format json >"$TMP_DIR/config.json" 2>/dev/null; then
  node - "$TMP_DIR/config.json" >"$TMP_DIR/checks.txt" <<'EOF'
const fs = require('fs');
const c = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const s = c.services || {};
const out = (ok, msg) => console.log(`${ok ? 'OK' : 'FALLA'}\t${msg}`);
const names = Object.keys(s).sort().join(',');
out(names === 'api,caddy,postgres,web', `servicios api,caddy,postgres,web (${names})`);
out(c.name === 'elite', `proyecto "elite" (${c.name})`);
const vols = Object.keys(c.volumes || {}).sort().join(',');
// La 095 agrega `files` (logo y fotos de la rentadora, ADR-014), montado en FILES_DIR del api.
out(vols === 'caddy_config,caddy_data,files,postgres_data', `volumenes (${vols})`);
const apiFiles = ((s.api || {}).volumes || []).find((v) => v.source === 'files');
const filesDir = ((s.api || {}).environment || {}).FILES_DIR;
out(apiFiles !== undefined && apiFiles.target === filesDir, `api monta files en FILES_DIR (${filesDir})`);
for (const [n, svc] of Object.entries(s)) {
  const ports = svc.ports || [];
  if (n === 'caddy') {
    const pub = ports.map((p) => `${p.published}/${p.protocol || 'tcp'}`).sort().join(',');
    out(pub === '443/tcp,443/udp,80/tcp', `caddy publica 80 y 443 (${pub})`);
  } else {
    out(ports.length === 0, `${n} no publica puertos (${ports.length})`);
    out(!svc.expose || svc.expose.length === 0 || n !== 'postgres', `${n} sin expose raro`);
  }
  out(svc.restart === 'unless-stopped', `${n} restart unless-stopped (${svc.restart})`);
  const env = svc.environment || {};
  out(env.TZ === 'America/El_Salvador', `${n} TZ=America/El_Salvador (${env.TZ})`);
}
const api = s.api || {}, web = s.web || {}, pg = s.postgres || {};
const aenv = api.environment || {};
out(aenv.NODE_ENV === 'production', 'api NODE_ENV=production');
out(aenv.API_PORT === '3200', `api API_PORT=3200 (${aenv.API_PORT})`);
out(aenv.PORT === undefined, 'api sin PORT (Nest usa API_PORT)');
out(aenv.WEB_ORIGIN === 'https://203-0-113-10.sslip.io', `api WEB_ORIGIN=https://$DOMAIN (${aenv.WEB_ORIGIN})`);
out(/^postgresql:\/\/elite:example_password@postgres:5432\/elite_service\?schema=public$/.test(aenv.DATABASE_URL || ''), 'api DATABASE_URL apunta a postgres:5432');
for (const k of ['JWT_SECRET', 'PIN_PEPPER', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']) out(!!aenv[k], `api recibe ${k}`);
out(((api.depends_on || {}).postgres || {}).condition === 'service_healthy', 'api espera a postgres sano');
out(JSON.stringify((api.healthcheck || {}).test || []).includes('/api/health'), 'api healthcheck /api/health');
out(JSON.stringify((pg.healthcheck || {}).test || []).includes('pg_isready'), 'postgres healthcheck pg_isready');
out((pg.image || '').startsWith('postgres:16'), `postgres 16 (${pg.image})`);
const wenv = web.environment || {};
out(wenv.NODE_ENV === 'production', 'web NODE_ENV=production');
out(wenv.PORT === '3100', `web PORT=3100 (${wenv.PORT})`);
out(((s.caddy || {}).environment || {}).DOMAIN === '203-0-113-10.sslip.io', 'caddy recibe DOMAIN');
out(((api.build || {}).target) === 'api' && ((web.build || {}).target) === 'web', 'build targets api/web');
EOF
  while IFS=$'\t' read -r status msg; do
    if [ "$status" = "OK" ]; then ok "$msg"; else fail "$msg"; fi
  done <"$TMP_DIR/checks.txt"
else
  fail "compose config --format json"
fi

echo
echo "== 5. Prohibiciones y secretos =="
# Scripts, compose, Dockerfile y Caddyfile. El README si puede advertir contra
# estos comandos: por eso queda afuera.
absent "sin 'down -v' en deploy/" --exclude='*.md' -E 'down[[:space:]]+(-[a-zA-Z]*v|--volumes)' deploy
absent "sin 'migrate dev' en deploy/" --exclude='*.md' -E 'migrate[[:space:]]+dev|db:migrate' deploy
absent "sin 'db push' en deploy/" --exclude='*.md' -E 'db[[:space:]]+push' deploy
absent "sin SameSite=None ni cookie Domain en deploy/" -Ei 'samesite=none|cookie.*domain=' deploy

if [ -f deploy/.env.production ] && git ls-files --error-unmatch deploy/.env.production >/dev/null 2>&1; then
  fail "deploy/.env.production esta versionado"
else
  ok "deploy/.env.production no esta versionado"
fi
if git check-ignore -q deploy/.env.production; then ok "deploy/.env.production gitignoreado";
else fail "deploy/.env.production no esta en .gitignore"; fi
if git check-ignore -q deploy/backups/elite-2026-01-01.dump; then ok "deploy/backups/ gitignoreado";
else fail "deploy/backups/ no esta en .gitignore"; fi

# Asignaciones de secretos con valores que no son placeholders, en lo que se versiona.
SECRETS=$(grep -RInE '^[[:space:]]*(export[[:space:]]+)?(JWT_SECRET|PIN_PEPPER|POSTGRES_PASSWORD|ADMIN_PASSWORD|R2_SECRET_ACCESS_KEY|R2_ACCESS_KEY_ID)[[:space:]]*[=:][[:space:]]*[^$[:space:]#{]' \
  deploy .env.example 2>/dev/null \
  | grep -viE '[=:][[:space:]]*["'\'']?(change_?me|example|ejemplo|xxx|your|tu_|<)' || true)
if [ -n "$SECRETS" ]; then fail "hay secretos con pinta de reales"; echo "$SECRETS";
else ok "sin secretos con pinta de reales en deploy/ ni .env.example"; fi
# Llaves privadas y tokens largos pegados.
absent "sin llaves privadas en deploy/" -E 'BEGIN [A-Z ]*PRIVATE KEY' deploy
# IPs publicas reales: solo se aceptan las de documentacion (RFC 5737), las
# privadas y el ejemplo de la spec (51-75-10-20.sslip.io).
IPS=$(grep -RInoE '\b([0-9]{1,3}[.-]){3}[0-9]{1,3}\b' deploy 2>/dev/null \
  | grep -vE ':(127[.-]|0[.-]0[.-]0[.-]0|10[.-]|192[.-]168[.-]|172[.-]|192[.-]0[.-]2[.-]|198[.-]51[.-]100[.-]|203[.-]0[.-]113[.-]|1[.-]2[.-]3[.-]4)' \
  | grep -vE ':51[.-]75[.-]10[.-]20$' || true)
if [ -n "$IPS" ]; then fail "hay IPs con pinta de reales en deploy/"; echo "$IPS";
else ok "sin IPs reales en deploy/"; fi

echo
echo "== 6. Imagenes (docker build) =="
for target in api web; do
  echo "  ... docker build --target $target (puede tardar)"
  if docker build -f deploy/Dockerfile --target "$target" -t "elite-verify-$target" . \
       >"$TMP_DIR/build-$target.log" 2>&1; then
    SIZE=$(docker image inspect "elite-verify-$target" --format '{{.Size}}' 2>/dev/null \
      | awk '{printf "%.0f MB", $1/1000/1000}')
    ok "imagen $target compila (elite-verify-$target, $SIZE)"
  else
    fail "imagen $target no compila"
    tail -40 "$TMP_DIR/build-$target.log"
  fi
done

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ] || exit 1
