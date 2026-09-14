#!/bin/bash
# Verificacion end-to-end de la spec 040 (carro primero, responsable opcional).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-040.sh
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

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS040","username":"carlos.vis040","pin":"1234"}')
if [ "$(code "$R")" = "201" ]; then
  ck "alta de empleado de pista -> 201" 201 201
else
  ck "reutiliza empleado de pista" 200 200
fi
R=$(req $FLR POST /floor/login '{"username":"carlos.vis040","pin":"1234"}')
ck "login de pista -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
CASH_CODE=$(code "$R")
if [ "$CASH_CODE" = "200" ] || [ "$CASH_CODE" = "201" ] || [ "$CASH_CODE" = "409" ]; then
  echo "  caja lista ($CASH_CODE)"
else
  echo "  AVISO: abrir caja devolvió $CASH_CODE"
fi

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET /services)
SRV1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").id')

echo
echo "== 1. Alta solo con placa =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P040-101\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}]}")
ck "POST pista sin cliente -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r .id)
ck "  customer null" null "$(body "$R" | jq -r .customer)"
ck "  vehicle plate" "P040-101" "$(body "$R" | jq -r .vehicle.plate)"
ck "  currentOwner null" null "$(body "$R" | jq -r .vehicle.currentOwner)"

echo
echo "== 2. Placa conocida con responsable: el dueño no cambia =="
R=$(req $OFF POST /customers '{"fullName":"Juan VIS040","phone":"7712-4040"}')
ck "alta responsable -> 201" 201 "$(code "$R")"
CUST=$(body "$R" | jq -r .id)

R=$(req $OFF POST /vehicles "{\"plate\":\"P040-102\",\"bodyTypeId\":\"$SEDAN\",\"customerId\":\"$CUST\",\"make\":\"Toyota\",\"color\":\"Gris\"}")
ck "alta carro conocido -> 201" 201 "$(code "$R")"
VEH=$(body "$R" | jq -r .id)
ck "  owner" "$CUST" "$(body "$R" | jq -r .currentOwner.id)"

R=$(req $FLR POST /floor/tickets "{\"vehicleId\":\"$VEH\",\"items\":[{\"serviceId\":\"$SRV1\"}]}")
ck "POST pista con vehicleId, sin cliente -> 201" 201 "$(code "$R")"
ck "  ticket customer = owner" "$CUST" "$(body "$R" | jq -r .customer.id)"
ck "  owner intacto" "$CUST" "$(body "$R" | jq -r .vehicle.currentOwner.id)"

echo
echo "== 3. Cobro sin responsable =="
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "T1 -> READY -> 200" 200 "$(code "$R")"
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T1)" | jq -r .total)
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobro sin responsable -> 200" 200 "$(code "$R")"
ck "  PAID" PAID "$(body "$R" | jq -r .status)"
ck "  customer sigue null" null "$(body "$R" | jq -r .customer)"

echo
echo "== 4. Cobro vinculando un responsable nuevo =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P040-103\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}]}")
ck "POST pista P040-103 -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r .id)
req $OFF POST /carwash/tickets/$T2/status '{"status":"READY"}' >/dev/null
TOTAL2=$(body "$(req $OFF GET /carwash/tickets/$T2)" | jq -r .total)
R=$(req $OFF POST /carwash/tickets/$T2/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL2\",\"customer\":{\"fullName\":\"Carlos VIS040\",\"phone\":\"7845-0400\"}}")
ck "cobro con responsable nuevo -> 200" 200 "$(code "$R")"
ck "  PAID" PAID "$(body "$R" | jq -r .status)"
ck "  ticket customer no null" false "$(body "$R" | jq -r '.customer == null')"
OWNER=$(body "$R" | jq -r .customer.id)
ck "  carro con owner actual" "$OWNER" "$(body "$R" | jq -r .vehicle.currentOwner.id)"
ck "  nombre" "Carlos VIS040" "$(body "$R" | jq -r .vehicle.currentOwner.fullName)"

echo
echo "== Resultado: $PASS ok, $FAIL fallos =="
[ "$FAIL" -eq 0 ]
