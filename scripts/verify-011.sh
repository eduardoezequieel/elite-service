#!/bin/bash
# Verificacion de la spec 011 (entorno remoto de desarrollo).
#
# No levanta servidores: comprueba archivos, el bind de PORT y que no haya secretos.
#
# Uso:
#   bash scripts/verify-011.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASS=0; FAIL=0

ck() {
  if [ "$2" = "$3" ]; then echo "  OK   $1  ($3)"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}

has() {
  local desc=$1 file=$2 needle=$3
  if grep -Fq -- "$needle" "$file"; then echo "  OK   $desc"; PASS=$((PASS+1));
  else echo "  FALLA $desc  no aparece '$needle' en $file"; FAIL=$((FAIL+1)); fi
}

absent() {
  local desc=$1
  shift
  if grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=.next-dev --exclude-dir=.git "$@" >/dev/null 2>&1; then
    echo "  FALLA $desc"
    grep -RIn --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.next --exclude-dir=.next-dev --exclude-dir=.git "$@" | head -20
    FAIL=$((FAIL+1))
  else
    echo "  OK   $desc"
    PASS=$((PASS+1))
  fi
}

echo "== 1. Archivos =="
for f in vercel.json render.yaml .env.example apps/api/src/listen-port.ts apps/api/src/main.ts \
         AGENTS.md apps/web/AGENTS.md apps/api/AGENTS.md scripts/verify-011.sh; do
  if [ -f "$f" ]; then echo "  OK   existe $f"; PASS=$((PASS+1));
  else echo "  FALLA falta $f"; FAIL=$((FAIL+1)); fi
done
ck "no hay Dockerfile en la raiz" 0 "$([ -f Dockerfile ] && echo 1 || echo 0)"
ck "no hay Dockerfile en apps/api" 0 "$([ -f apps/api/Dockerfile ] && echo 1 || echo 0)"
ck "no hay Dockerfile en apps/web" 0 "$([ -f apps/web/Dockerfile ] && echo 1 || echo 0)"

echo
echo "== 2. vercel.json (pnpm, Node 22, shared y despues web) =="
node -e 'JSON.parse(require("fs").readFileSync("vercel.json","utf8"))' >/dev/null \
  && { echo "  OK   vercel.json es JSON"; PASS=$((PASS+1)); } \
  || { echo "  FALLA vercel.json no es JSON valido"; FAIL=$((FAIL+1)); }
has "install con pnpm" vercel.json 'pnpm install'
BUILD=$(node -e 'const j=require("./vercel.json"); process.stdout.write(String(j.buildCommand||""))')
case "$BUILD" in
  *'@elite/shared build'*'@elite/web build'*) echo "  OK   build shared y despues web"; PASS=$((PASS+1));;
  *) echo "  FALLA buildCommand no es shared y despues web: $BUILD"; FAIL=$((FAIL+1));;
esac
has "Node 22 en engines de la raiz" package.json '"node": ">=22"'
has "Node 22 en engines de la web" apps/web/package.json '"node": ">=22"'
has "Node 22 en AGENTS (Vercel)" AGENTS.md 'Node 22'

echo
echo "== 3. render.yaml (web free, health, migrate+seed) =="
has "servicio web" render.yaml 'type: web'
has "plan free" render.yaml 'plan: free'
has "health /api/health" render.yaml 'healthCheckPath: /api/health'
has "migrate deploy al arrancar" render.yaml 'db:deploy'
has "seed al arrancar" render.yaml 'db:seed'
has "Node 22" render.yaml "NODE_VERSION"
has "runtime node (sin Docker)" render.yaml 'runtime: node'

echo
echo "== 4. Bind de PORT =="
has "lee PORT" apps/api/src/listen-port.ts 'env.PORT'
has "fallback API_PORT" apps/api/src/listen-port.ts 'env.API_PORT'
has "fallback 3200" apps/api/src/listen-port.ts 'DEFAULT_LISTEN_PORT = 3200'
has "main usa resolveListenPort" apps/api/src/main.ts 'resolveListenPort'
has "main pasa PORT" apps/api/src/main.ts "config.get<string>('PORT')"
has "main pasa API_PORT" apps/api/src/main.ts "config.get<string>('API_PORT')"

echo
echo "== 5. .env.example y dashboards =="
has "documenta API_UPSTREAM" .env.example 'API_UPSTREAM'
has "documenta PORT" .env.example 'PORT='
has "documenta WEB_ORIGIN" .env.example 'WEB_ORIGIN='
has "documenta URL directa de Neon" .env.example 'sslmode=require'
has "advierte contra el pooler" .env.example '-pooler'
has "raiz menciona Vercel" AGENTS.md 'Vercel'
has "raiz menciona Render" AGENTS.md 'Render'
has "raiz menciona Neon" AGENTS.md 'Neon'
has "web: no NEXT_PUBLIC_API_URL en Vercel" apps/web/AGENTS.md '**no** setear'
has "api: migrate deploy remoto" apps/api/AGENTS.md 'db:deploy'

echo
echo "== 6. Sin secretos ni prohibiciones =="
# Asignaciones reales (no comentarios) con -pooler.
if grep -E '^[[:space:]]*[^#[:space:]].*-pooler' .env.example vercel.json render.yaml >/dev/null 2>&1; then
  echo "  FALLA hay una asignacion con -pooler"
  FAIL=$((FAIL+1))
else
  echo "  OK   ninguna asignacion usa -pooler"
  PASS=$((PASS+1))
fi
absent "sin SameSite=None" -E "SameSite=None|sameSite:[[:space:]]*['\"]none['\"]" --include='*.ts' --include='*.js' --include='*.json'
absent "sin cookie Domain" -E "domain:[[:space:]]*['\"]" apps/api/src/modules/auth/presentation/session-cookie.service.ts apps/api/src/modules/employees/presentation/floor-cookie.service.ts

# Secretos: JWT_SECRET / passwords que no sean el placeholder del example.
SECRETS=$(git grep -I -n -E 'JWT_SECRET=[^c].+|JWT_SECRET=change_me_use_a_long_random_value.{8,}' -- ':!.env.example' ':!specs/*' ':!AGENTS.md' ':!apps/*/AGENTS.md' ':!scripts/*' 2>/dev/null || true)
if [ -n "$SECRETS" ]; then
  echo "  FALLA JWT_SECRET real en archivos versionados"
  echo "$SECRETS"
  FAIL=$((FAIL+1))
else
  echo "  OK   no hay JWT_SECRET real versionado"
  PASS=$((PASS+1))
fi

# Connection strings de Neon con credenciales, fuera de comentarios de example.
NEON=$(git grep -I -n -E 'postgresql://[^:]+:[^@]+@[^/]*neon\.tech' -- ':!.env.example' ':!specs/*' ':!AGENTS.md' ':!apps/*/AGENTS.md' ':!scripts/*' 2>/dev/null || true)
if [ -n "$NEON" ]; then
  echo "  FALLA URL de Neon con credenciales versionada"
  echo "$NEON"
  FAIL=$((FAIL+1))
else
  echo "  OK   no hay URL de Neon con credenciales versionada"
  PASS=$((PASS+1))
fi

# .env no se versiona.
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "  FALLA .env esta versionado"
  FAIL=$((FAIL+1))
else
  echo "  OK   .env no esta versionado"
  PASS=$((PASS+1))
fi

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ] || exit 1
