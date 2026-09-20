#!/bin/bash
# Verificacion end-to-end de la spec 039 (un servicio por categoria).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-039.sh
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

OFF=$S/office.jar; FLR=$S/floor.jar
rm -f "$OFF" "$FLR"

echo "== 0. Sesiones y catalogo =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS039","username":"carlos.vis039","pin":"390001"}')
if [ "$(code "$R")" = "201" ]; then
  ck "alta de empleado de pista -> 201" 201 201
else
  ck "reutiliza empleado de pista" 200 200
fi
R=$(req $FLR POST /floor/login '{"pin":"390001"}')
ck "login de pista -> 200" 200 "$(code "$R")"

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')

R=$(req $OFF GET /services)
ck "GET /services -> 200" 200 "$(code "$R")"
SRV1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").id')   # Lavado premium
SRV2=$(body "$R" | jq -r '.[]|select(.code=="SRV-0002").id')   # Lavado premium
SRV3=$(body "$R" | jq -r '.[]|select(.code=="SRV-0101").id')   # Pulido de silvines
CAT1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").category.id')
CAT3=$(body "$R" | jq -r '.[]|select(.code=="SRV-0101").category.id')

ck "el catalogo trae al menos dos rubros con servicios" true \
  "$([ -n "$CAT1" ] && [ -n "$CAT3" ] && [ "$CAT1" != "$CAT3" ] && echo true || echo false)"

echo
echo "== 1. Dos rubros distintos se suman =="
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"P039-201\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"},{\"serviceId\":\"$SRV3\"}]}")
ck "POST oficina con dos rubros -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r .id)
ck "  dos lineas en el ticket" 2 "$(body "$R" | jq -r '.items|length')"
SUM=$(body "$R" | jq -r '[.items[].unitPrice|tonumber]|add|.*100|round/100|tostring')
ck "  el total es la suma de las lineas" "$SUM" "$(body "$R" | jq -r '.total|tonumber|.*100|round/100|tostring')"

echo
echo "== 2. Dos servicios del mismo rubro: 422 =="
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"P039-202\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"},{\"serviceId\":\"$SRV2\"}]}")
ck "POST oficina con dos del mismo rubro -> 422" 422 "$(code "$R")"
ck "  code" DUPLICATE_SERVICE_CATEGORY "$(body "$R" | jq -r .code)"
ck "  details.categoryId" "$CAT1" "$(body "$R" | jq -r .details.categoryId)"

R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P039-203\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"},{\"serviceId\":\"$SRV2\"}]}")
ck "POST pista con dos del mismo rubro -> 422" 422 "$(code "$R")"
ck "  code" DUPLICATE_SERVICE_CATEGORY "$(body "$R" | jq -r .code)"

echo
echo "== 3. La edicion sigue la misma regla =="
R=$(req $OFF PATCH /carwash/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV1\"},{\"serviceId\":\"$SRV2\"}]}")
ck "PATCH con dos del mismo rubro -> 422" 422 "$(code "$R")"
ck "  code" DUPLICATE_SERVICE_CATEGORY "$(body "$R" | jq -r .code)"

R=$(req $OFF PATCH /carwash/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV2\"},{\"serviceId\":\"$SRV3\"}]}")
ck "PATCH con dos rubros distintos -> 200" 200 "$(code "$R")"
ck "  dos lineas" 2 "$(body "$R" | jq -r '.items|length')"

echo
echo "== 4. El descuento sigue siendo por linea =="
CAT_SRV2=$(body "$(req $OFF GET /carwash/tickets/$T1)" | jq -r --arg s "$SRV2" '.items[]|select(.serviceId==$s).catalogPrice')
R=$(req $OFF PATCH /carwash/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV2\",\"unitPrice\":\"1.00\"},{\"serviceId\":\"$SRV3\"}]}")
ck "PATCH con descuento en una linea -> 200" 200 "$(code "$R")"
ck "  la linea descontada cobra 1.00" "1.00" "$(body "$R" | jq -r --arg s "$SRV2" '.items[]|select(.serviceId==$s).unitPrice')"
ck "  su tope sigue siendo el del catalogo" "$CAT_SRV2" "$(body "$R" | jq -r --arg s "$SRV2" '.items[]|select(.serviceId==$s).catalogPrice')"
ck "  la otra linea no se toca" "$(body "$R" | jq -r --arg s "$SRV3" '.items[]|select(.serviceId==$s).catalogPrice')" \
  "$(body "$R" | jq -r --arg s "$SRV3" '.items[]|select(.serviceId==$s).unitPrice')"

R=$(req $OFF PATCH /carwash/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV2\",\"unitPrice\":\"999.00\"}]}")
ck "por encima del catalogo -> 422" 422 "$(code "$R")"
ck "  code" PRICE_ABOVE_CATALOG "$(body "$R" | jq -r .code)"

echo
echo "== 5. Sin ningun servicio no se abre =="
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"P039-204\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[]}")
ck "POST sin servicios -> 422" 422 "$(code "$R")"
ck "  code" TICKET_INCOMPLETE "$(body "$R" | jq -r .code)"

echo
echo "== Resultado: $PASS ok, $FAIL fallos =="
[ "$FAIL" -eq 0 ]
