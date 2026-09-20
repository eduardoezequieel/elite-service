#!/bin/bash
# Verificacion end-to-end de la spec 044 (entrada a la pista solo con PIN).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy
#   pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-044.sh
#
# Necesita PIN_PEPPER en el .env de la raiz: sin eso el API no arranca.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
PASS=0; FAIL=0

# PINes de esta verificacion. Son unicos en todo el taller (RN-3), asi que no
# pueden repetir los de los otros verify-*.sh.
CARLOS_PIN=440001
ANA_PIN=440002
NADIE_PIN=440999

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

OFF=$S/office.jar; FLR=$S/floor.jar; ANON=$S/anon.jar
rm -f "$OFF" "$FLR" "$ANON"

echo "== 0. Sesion de oficina =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

echo
echo "== 1. Alta con PIN de 6 digitos (RN-2) =="
R=$(req $OFF POST /employees "{\"fullName\":\"Carlos VIS044\",\"username\":\"carlos.vis044\",\"pin\":\"$CARLOS_PIN\"}")
C=$(code "$R")
if [ "$C" = "201" ]; then
  ck "alta de empleado -> 201" 201 201
  ck "  no devuelve el hash del PIN (RN-8)" 0 "$(body "$R" | grep -c pinHash)"
else
  ck "empleado ya existia (409 usuario tomado)" 409 "$C"
fi
CARLOS_ID=$(body "$(req $OFF GET /employees)" | jq -r '.[]|select(.username=="carlos.vis044").id')
ck "id de carlos resuelto" true "$([ -n "$CARLOS_ID" ] && [ "$CARLOS_ID" != "null" ] && echo true || echo false)"

R=$(req $OFF POST /employees '{"fullName":"Corto VIS044","username":"corto.vis044","pin":"12345"}')
ck "PIN de 5 digitos -> 422" 422 "$(code "$R")"
R=$(req $OFF POST /employees '{"fullName":"Letras VIS044","username":"letras.vis044","pin":"12345a"}')
ck "PIN con letras -> 422" 422 "$(code "$R")"

echo
echo "== 2. El PIN no se repite entre empleados (RN-3) =="
R=$(req $OFF POST /employees "{\"fullName\":\"Ana VIS044\",\"username\":\"ana.vis044\",\"pin\":\"$CARLOS_PIN\"}")
ck "alta con el PIN de otro -> 409" 409 "$(code "$R")"
ck "  code PIN_TAKEN" PIN_TAKEN "$(body "$R" | jq -r .code)"

R=$(req $OFF POST /employees "{\"fullName\":\"Ana VIS044\",\"username\":\"ana.vis044\",\"pin\":\"$ANA_PIN\"}")
C=$(code "$R")
if [ "$C" = "201" ] || [ "$C" = "409" ]; then echo "  empleada ana lista ($C)"; else ck "alta de ana" 201 "$C"; fi
ANA_ID=$(body "$(req $OFF GET /employees)" | jq -r '.[]|select(.username=="ana.vis044").id')

R=$(req $OFF PATCH /employees/$ANA_ID "{\"pin\":\"$CARLOS_PIN\"}")
ck "editar tomando el PIN de otro -> 409" 409 "$(code "$R")"
ck "  code PIN_TAKEN" PIN_TAKEN "$(body "$R" | jq -r .code)"

echo
echo "== 3. Entrar solo con el PIN (RN-1) =="
R=$(req $FLR POST /floor/login "{\"pin\":\"$CARLOS_PIN\"}")
ck "login de pista sin usuario -> 200" 200 "$(code "$R")"
ck "  es Carlos" "Carlos VIS044" "$(body "$R" | jq -r .employee.fullName)"
ck "  cookie de pista escrita" 1 "$(grep -c elite_floor_session $FLR)"
ck "  la sesion vale" 200 "$(code "$(req $FLR GET /floor/me)")"

echo
echo "== 4. PIN de nadie y empleado desactivado responden igual (RN-7) =="
R=$(req $ANON POST /floor/login "{\"pin\":\"$NADIE_PIN\"}")
ck "PIN que no es de nadie -> 401" 401 "$(code "$R")"
ck "  code INVALID_CREDENTIALS" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"
ck "  mensaje" "PIN incorrecto." "$(body "$R" | jq -r .message)"

req $OFF PATCH /employees/$ANA_ID '{"isActive":false}' >/dev/null
R=$(req $ANON POST /floor/login "{\"pin\":\"$ANA_PIN\"}")
ck "PIN de un desactivado -> 401" 401 "$(code "$R")"
ck "  mismo code" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"
ck "  mismo mensaje (no revela cual fallo)" "PIN incorrecto." "$(body "$R" | jq -r .message)"
req $OFF PATCH /employees/$ANA_ID '{"isActive":true}' >/dev/null

echo
echo "== 5. Cambiar el PIN cierra las sesiones (RN-18 de 003) =="
req $OFF PATCH /employees/$CARLOS_ID "{\"pin\":\"$CARLOS_PIN\"}" >/dev/null
ck "tras reemplazarle el PIN -> 401" 401 "$(code "$(req $FLR GET /floor/me)")"

echo
echo "== 6. Freno de intentos (RN-6). Deja la IP cerrada 60s: va al final =="
rm -f "$ANON"
LAST=""
for i in 1 2 3 4 5; do
  LAST=$(req $ANON POST /floor/login "{\"pin\":\"$NADIE_PIN\"}")
done
ck "los 5 primeros fallos siguen siendo 401" 401 "$(code "$LAST")"
R=$(req $ANON POST /floor/login "{\"pin\":\"$NADIE_PIN\"}")
ck "el sexto intento -> 429" 429 "$(code "$R")"
ck "  code TOO_MANY_ATTEMPTS" TOO_MANY_ATTEMPTS "$(body "$R" | jq -r .code)"
R=$(req $ANON POST /floor/login "{\"pin\":\"$CARLOS_PIN\"}")
ck "ni con el PIN bueno entra mientras dura -> 429" 429 "$(code "$R")"

echo
echo "== Resultado: $PASS ok, $FAIL fallos =="
echo "   (la IP queda sin poder entrar a la pista por 60s: es el freno de RN-6)"
[ "$FAIL" -eq 0 ]
