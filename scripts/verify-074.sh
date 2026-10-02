#!/bin/bash
# Verificacion end-to-end de la spec 074 (el seed no reparte permisos a roles
# ajenos).
#
# Lo que prueba y `pnpm test` no puede: la migracion (columna `isSystem` y un
# solo rol marcado), que el seed real contra la base solo le agregue permisos al
# rol del sistema —aunque el admin del `.env` tenga otro rol limitado— y que el
# API responda 409 SYSTEM_ROLE_PROTECTED al borrarlo o vaciarlo.
#
# Uso:
#   docker compose up -d && pnpm build && pnpm --filter @elite/api db:deploy && pnpm dev
#   bash scripts/verify-074.sh
#
# `pnpm build` antes: `db:seed` corre `dist/prisma/seed.js` si existe.
#
# Deja la base como la encontro: le devuelve al admin sus roles de antes y
# borra el rol «Cajero» que crea.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
POSTGRES_USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
POSTGRES_DB=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)
POSTGRES_USER=${POSTGRES_USER:-elite}
POSTGRES_DB=${POSTGRES_DB:-elite_service}
PASS=0; FAIL=0
RUN=$(date +%H%M%S)
ROLE_NAME="Cajero VIS074 $RUN"

ck() {
  if [ "$2" = "$3" ]; then echo "  OK   $1  ($3)"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}
req() {
  local jar=$1 m=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -b "$jar" -c "$jar" -X "$m" "$API$path" -H 'Content-Type: application/json' -d "$body" -w '\n%{http_code}'
  else
    curl -s -b "$jar" -c "$jar" -X "$m" "$API$path" -w '\n%{http_code}'
  fi
}
code() { echo "$1" | tail -1; }
body() { echo "$1" | sed '$d'; }
sql() {
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$1" 2>/dev/null | tr -d '\r'
}

OFF=$S/office.jar
ADMIN_ID=""; ORIGINAL_ROLES=""; CAJERO=""

# Pase lo que pase, el admin vuelve a sus roles y «Cajero» se va.
cleanup() {
  if [ -n "$ADMIN_ID" ] && [ -n "$ORIGINAL_ROLES" ]; then
    req $OFF PATCH /users/$ADMIN_ID "{\"roleIds\":$ORIGINAL_ROLES}" >/dev/null
  fi
  if [ -n "$CAJERO" ]; then
    req $OFF DELETE /roles/$CAJERO >/dev/null
  fi
  rm -rf "$S"
}
trap cleanup EXIT

echo "== 0. Migracion y sesion =="
ck "migracion role_is_system aplicada" 1 \
  "$(sql "SELECT count(*) FROM _prisma_migrations WHERE migration_name LIKE '%_role_is_system' AND finished_at IS NOT NULL")"
ck "  un solo rol marcado isSystem" 1 "$(sql "SELECT count(*) FROM roles WHERE \"isSystem\"")"

R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login del admin del .env -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')
ORIGINAL_ROLES=$(body "$R" | jq -c '[.user.roles[].id]')

R=$(req $OFF GET "/roles?pageSize=100")
ck "GET /roles -> 200" 200 "$(code "$R")"
SYSTEM=$(body "$R" | jq -r '[.items[]|select(.isSystem)][0].id // empty')
ck "  el rol del sistema viaja con isSystem" true "$([ -n "$SYSTEM" ] && echo true || echo false)"
ck "  los demas roles viajan con isSystem=false" 0 \
  "$(body "$R" | jq '[.items[]|select(.isSystem != true and .isSystem != false)]|length')"
R=$(req $OFF GET "/roles?page=1&pageSize=1")
ck "  /roles pagina en servidor (102)" true "$(body "$R" | jq '(.items|length) == 1 and .total >= 1 and .pageSize == 1')"

echo
echo "== 1. Un rol limitado en el admin del .env =="
R=$(req $OFF POST /roles "{\"name\":\"$ROLE_NAME\",\"permissionKeys\":[\"users.read\"]}")
ck "crear «Cajero» con un permiso -> 201" 201 "$(code "$R")"
CAJERO=$(body "$R" | jq -r '.id // empty')
ck "  isSystem=false" false "$(body "$R" | jq -r .isSystem)"

WITH_CAJERO=$(echo "$ORIGINAL_ROLES" | jq -c --arg c "$CAJERO" '. + [$c]')
R=$(req $OFF PATCH /users/$ADMIN_ID "{\"roleIds\":$WITH_CAJERO}")
ck "asignarle «Cajero» al admin -> 200" 200 "$(code "$R")"

echo
echo "== 2. db:seed no le reparte permisos (spec 074) =="
if pnpm --filter @elite/api db:seed >"$S/seed.log" 2>&1; then SEED=0; else SEED=1; cat "$S/seed.log"; fi
ck "db:seed termina bien" 0 "$SEED"
ck "  «Cajero» sigue con un solo permiso (base)" 1 \
  "$(sql "SELECT count(*) FROM role_permissions WHERE \"roleId\" = '$CAJERO'")"
R=$(req $OFF GET "/roles?pageSize=100")
ck "  «Cajero» sigue con un solo permiso (API)" '["users.read"]' \
  "$(body "$R" | jq -c --arg c "$CAJERO" '.items[]|select(.id==$c)|.permissionKeys')"
TOTAL=$(sql "SELECT count(*) FROM permissions")
ck "  el rol del sistema tiene todo el catalogo" "$TOTAL" \
  "$(sql "SELECT count(*) FROM role_permissions WHERE \"roleId\" = '$SYSTEM'")"
if pnpm --filter @elite/api db:seed >"$S/seed2.log" 2>&1; then SEED=0; else SEED=1; fi
ck "  segundo db:seed: idempotente, «Cajero» igual" "0 1" \
  "$SEED $(sql "SELECT count(*) FROM role_permissions WHERE \"roleId\" = '$CAJERO'")"
ck "  sigue habiendo un solo rol del sistema" 1 "$(sql "SELECT count(*) FROM roles WHERE \"isSystem\"")"

echo
echo "== 3. El API protege el rol del sistema =="
R=$(req $OFF DELETE /roles/$SYSTEM)
ck "DELETE del rol del sistema -> 409" 409 "$(code "$R")"
ck "  code" SYSTEM_ROLE_PROTECTED "$(body "$R" | jq -r .code)"
R=$(req $OFF PATCH /roles/$SYSTEM '{"permissionKeys":["users.read"]}')
ck "quitarle roles.manage -> 409" 409 "$(code "$R")"
ck "  code" SYSTEM_ROLE_PROTECTED "$(body "$R" | jq -r .code)"
ck "  no cambio nada" "$TOTAL" "$(sql "SELECT count(*) FROM role_permissions WHERE \"roleId\" = '$SYSTEM'")"

echo
echo "== 4. Limpieza =="
R=$(req $OFF PATCH /users/$ADMIN_ID "{\"roleIds\":$ORIGINAL_ROLES}")
ck "devolverle al admin sus roles -> 200" 200 "$(code "$R")"
R=$(req $OFF DELETE /roles/$CAJERO)
ck "borrar «Cajero» -> 204" 204 "$(code "$R")"
[ "$(code "$R")" = "204" ] && CAJERO=""

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
