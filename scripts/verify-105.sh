#!/bin/bash
# Verificacion end-to-end de la spec 105 (motos en el lavado).
#
# Lo que prueba y `pnpm test` no puede: que el seed deje `moto` en la base como
# cuarto tipo, que oficina y pista lo lean en su orden, que un lavado con placa
# nueva y tipo moto cobre el base del servicio (el seed no le pone matriz) y que
# el RN-2 de la 104 contra la base exija el precio fijo de la moto en un combo.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-105.sh
#
# Al terminar el lavado queda anulado y el empleado de pista desactivado.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
# Cliente propio ante el freno de /floor/login (044 RN-6, que cuenta por
# X-Forwarded-For): los PIN fallidos de otro verify no dejan a este en 429.
FLOOR_CLIENT="X-Forwarded-For: verify-105-$$"
S=$(mktemp -d)
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
PASS=0; FAIL=0
RUN=$(date +%H%M%S)
TICKET=""; EMPLOYEE=""; COMBO=""

ck() {
  if [ "$2" = "$3" ]; then echo "  OK   $1  ($3)"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}
req() {
  local jar=$1 m=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -H "$FLOOR_CLIENT" -b "$jar" -c "$jar" -X "$m" "$API$path" -H 'Content-Type: application/json' -d "$body" -w '\n%{http_code}'
  else
    curl -s -H "$FLOOR_CLIENT" -b "$jar" -c "$jar" -X "$m" "$API$path" -w '\n%{http_code}'
  fi
}
code() { echo "$1" | tail -1; }
body() { echo "$1" | sed '$d'; }
# El monto como numero de dos decimales, para comparar "8.00" con "8".
money() { printf '%.2f' "$1"; }

OFF=$S/office.jar; FLR=$S/floor.jar

cleanup() {
  local rc=$?
  [ -n "$TICKET" ] && req $OFF POST /carwash/tickets/$TICKET/void "{\"reason\":\"VIS105\",$AUTH}" >/dev/null
  [ -n "$COMBO" ] && req $OFF PATCH /combos/$COMBO '{"isActive":false}' >/dev/null
  [ -n "$EMPLOYEE" ] && req $OFF PATCH /employees/$EMPLOYEE '{"isActive":false}' >/dev/null
  rm -rf "$S"
  exit $rc
}
trap cleanup EXIT

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

# PIN al azar: si choca con uno que ya existe, se prueba otro.
for _ in 1 2 3 4 5; do
  PIN=$(printf '%06d' $(( (RANDOM * 32768 + RANDOM) % 1000000 )))
  R=$(req $OFF POST /employees "{\"fullName\":\"Moto VIS105 $RUN\",\"username\":\"moto.vis105.$RUN\",\"pin\":\"$PIN\"}")
  [ "$(code "$R")" = 201 ] && break
done
ck "empleado de pista -> 201" 201 "$(code "$R")"
EMPLOYEE=$(body "$R" | jq -r '.id // empty')
R=$(req $FLR POST /floor/login "{\"pin\":\"$PIN\"}")
ck "login de pista -> 200" 200 "$(code "$R")"

echo
echo "== 1. La moto es el cuarto tipo, en oficina y en pista =="
R=$(req $OFF GET /vehicle-body-types)
ck "GET /vehicle-body-types -> 200" 200 "$(code "$R")"
OFFICE_TYPES=$(body "$R")
ck "  moto en cuarto lugar, sortOrder 4" "moto Moto 4" "$(echo "$OFFICE_TYPES" | jq -r '.[3]|[.key, .name, (.sortOrder|tostring)]|join(" ")')"
ck "  los tres de antes no se movieron" "sedan suv pickup" "$(echo "$OFFICE_TYPES" | jq -r '[.[0:3][].key]|join(" ")')"
MOTO=$(echo "$OFFICE_TYPES" | jq -r '.[]|select(.key=="moto").id')

R=$(req $FLR GET /floor/vehicle-body-types)
ck "GET /floor/vehicle-body-types -> 200" 200 "$(code "$R")"
ck "  moto en cuarto lugar, mismo id" "moto $MOTO" "$(body "$R" | jq -r '.[3]|[.key, .id]|join(" ")')"

echo
echo "== 2. Lavado de moto con placa nueva: cobra el base =="
SERVICES=$(body "$(req $OFF GET "/services?pageSize=100")")
SRV1=$(echo "$SERVICES" | jq -c '.items[]|select(.code=="SRV-0001")')
SRV1_ID=$(echo "$SRV1" | jq -r .id)
SRV1_BASE=$(echo "$SRV1" | jq -r .defaultPrice)
ck "SRV-0001 en el catalogo" true "$([ -n "$SRV1_ID" ] && [ "$SRV1_ID" != null ] && echo true || echo false)"
ck "  el seed no le puso precio de moto" 0 "$(echo "$SRV1" | jq --arg id "$MOTO" '[.prices[]|select(.bodyTypeId==$id)]|length')"

PLATE="M105$RUN"
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"$PLATE\",\"bodyTypeId\":\"$MOTO\"},\"items\":[{\"serviceId\":\"$SRV1_ID\"}]}")
ck "alta del lavado -> 201" 201 "$(code "$R")"
TICKET=$(body "$R" | jq -r '.id // empty')
ck "  tipo moto guardado" "$MOTO" "$(body "$R" | jq -r '.bodyType.id')"
LINE=$(body "$R" | jq -c '.items[]|select(.code=="SRV-0001")')
ck "  linea de SRV-0001: catalogo = base" "$(money "$SRV1_BASE")" "$(money "$(echo "$LINE" | jq -r .catalogPrice)")"
ck "  linea de SRV-0001: cobra el base" "$(money "$SRV1_BASE")" "$(money "$(echo "$LINE" | jq -r .unitPrice)")"
ck "  total = base" "$(money "$SRV1_BASE")" "$(money "$(body "$R" | jq -r .total)")"

echo
echo "== 3. Combo FIXED sin precio de moto (104 RN-2) =="
SRV101_ID=$(echo "$SERVICES" | jq -r '.items[]|select(.code=="SRV-0101").id')
PRICES=$(echo "$OFFICE_TYPES" | jq -c '[.[]|select(.key!="moto")|{bodyTypeId: .id, price: "1.00"}]')
COMBO_BODY=$(jq -nc --arg name "Combo VIS105 $RUN" --arg a "$SRV1_ID" --arg b "$SRV101_ID" \
  --arg today "$(TZ=America/El_Salvador date +%F)" --argjson prices "$PRICES" '
  { name: $name,
    items: [ { serviceId: $a }, { serviceId: $b } ],
    pricingMode: "FIXED", prices: $prices,
    validFrom: $today, weekdays: [0,1,2,3,4,5,6] }')
R=$(req $OFF POST /combos "$COMBO_BODY")
[ "$(code "$R")" = 201 ] && COMBO=$(body "$R" | jq -r .id)
ck "alta sin precio de moto -> 422" 422 "$(code "$R")"
ck "  details nombra a la moto" "prices $MOTO" "$(body "$R" | jq -r '[.details.field, (.details.bodyTypeIds // []|join(","))]|join(" ")')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
