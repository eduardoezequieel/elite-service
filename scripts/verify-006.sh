#!/bin/bash
# Verificacion end-to-end de la spec 006 (cambio de contraseña propia).
#
# Contra un stack levantado: base sembrada, API en marcha. Crea un usuario de
# prueba, cambia SU clave (no la del admin), y comprueba actual mala, nueva
# corta, exito, sesion vieja 401 y sesion nueva 200.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-006.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
PASS=0; FAIL=0

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

EMAIL="password.e2e@elite.local"
OLD_PASS="claveVieja1"
NEW_PASS="claveNueva1"

echo "== 1. Sin sesion =="
R=$(req $S/anon.jar POST /auth/password "{\"currentPassword\":\"$OLD_PASS\",\"newPassword\":\"$NEW_PASS\"}")
ck "POST /auth/password sin sesion -> 401" 401 "$(code "$R")"

echo
echo "== 2. Preparar usuario de prueba =="
R=$(req $S/admin.jar POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login admin -> 200" 200 "$(code "$R")"

# Si quedo de una corrida anterior, se reusa. Si no, se crea.
R=$(req $S/admin.jar GET /users)
USER_ID=$(body "$R" | jq -r --arg email "$EMAIL" '.[] | select(.email==$email) | .id')
if [ -z "$USER_ID" ] || [ "$USER_ID" = "null" ]; then
  R=$(req $S/admin.jar POST /users "{\"email\":\"$EMAIL\",\"fullName\":\"Password E2E\",\"password\":\"$OLD_PASS\",\"roleIds\":[]}")
  ck "POST /users de prueba -> 201" 201 "$(code "$R")"
  USER_ID=$(body "$R" | jq -r '.id')
else
  R=$(req $S/admin.jar PATCH /users/$USER_ID "{\"password\":\"$OLD_PASS\",\"isActive\":true}")
  ck "reusa usuario de prueba y restaura clave -> 200" 200 "$(code "$R")"
fi

R=$(req $S/user.jar POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASS\"}")
ck "login usuario de prueba -> 200" 200 "$(code "$R")"
cp "$S/user.jar" "$S/old.jar"

echo
echo "== 3. Validacion =="
R=$(req $S/user.jar POST /auth/password "{\"currentPassword\":\"noesesta\",\"newPassword\":\"$NEW_PASS\"}")
ck "actual mala -> 401" 401 "$(code "$R")"
ck "  code INVALID_CREDENTIALS" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"
ck "  mensaje dice que fallo la actual" "La contraseña actual no es correcta." "$(body "$R" | jq -r .message)"

R=$(req $S/user.jar POST /auth/password "{\"currentPassword\":\"$OLD_PASS\",\"newPassword\":\"corta\"}")
ck "nueva corta -> 422" 422 "$(code "$R")"
ck "  code VALIDATION_ERROR" VALIDATION_ERROR "$(body "$R" | jq -r .code)"

echo
echo "== 4. Cambio y sesiones =="
R=$(req $S/user.jar POST /auth/password "{\"currentPassword\":\"$OLD_PASS\",\"newPassword\":\"$NEW_PASS\"}")
ck "cambio correcto -> 204" 204 "$(code "$R")"
ck "  no viaja passwordHash" 0 "$(body "$R" | grep -c passwordHash)"

R=$(req $S/old.jar GET /auth/me)
ck "sesion vieja -> 401" 401 "$(code "$R")"

R=$(req $S/user.jar GET /auth/me)
ck "sesion nueva (cookie renovada) -> 200" 200 "$(code "$R")"
ck "  mismo usuario" "$EMAIL" "$(body "$R" | jq -r '.user.email')"

R=$(req $S/fresh.jar POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$NEW_PASS\"}")
ck "login con la clave nueva -> 200" 200 "$(code "$R")"

R=$(req $S/stale.jar POST /auth/login "{\"email\":\"$EMAIL\",\"password\":\"$OLD_PASS\"}")
ck "login con la clave vieja -> 401" 401 "$(code "$R")"

echo
echo "== 5. Limpieza =="
R=$(req $S/admin.jar PATCH /users/$USER_ID '{"isActive":false}')
ck "desactiva el usuario de prueba -> 200" 200 "$(code "$R")"

echo
echo "== Resultado: $PASS ok, $FAIL fallas =="
if [ "$FAIL" -ne 0 ]; then exit 1; fi
