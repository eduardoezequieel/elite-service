#!/bin/bash
# Verificacion end-to-end de la spec 041 (notas del último lavado).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-041.sh
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

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS041","username":"carlos.vis041","pin":"410001"}')
if [ "$(code "$R")" = "201" ]; then
  ck "alta de empleado de pista -> 201" 201 201
else
  ck "reutiliza empleado de pista" 200 200
fi
R=$(req $FLR POST /floor/login '{"pin":"410001"}')
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
SRVNAME=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").name')

echo
echo "== 1. Lookup de placa conocida con lastWash.notes =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P041-201\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}],\"notes\":\"Pidió cera. No silicona.\"}")
ck "POST pista con nota -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r .id)
ck "  notes en el ticket" "Pidió cera. No silicona." "$(body "$R" | jq -r .notes)"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "T1 -> READY -> 200" 200 "$(code "$R")"
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T1)" | jq -r .total)
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobro T1 -> 200" 200 "$(code "$R")"
ck "  PAID" PAID "$(body "$R" | jq -r .status)"

R=$(req $OFF GET "/vehicles?q=P041-201")
ck "GET oficina vehicles -> 200" 200 "$(code "$R")"
ck "  lastWash.notes" "Pidió cera. No silicona." "$(body "$R" | jq -r '.[0].lastWash.notes')"
ck "  lastWash.serviceName" "$SRVNAME" "$(body "$R" | jq -r '.[0].lastWash.serviceName')"

R=$(req $FLR GET "/floor/vehicles?q=P041-201")
ck "GET pista vehicles -> 200" 200 "$(code "$R")"
ck "  lastWash.notes (pista)" "Pidió cera. No silicona." "$(body "$R" | jq -r '.[0].lastWash.notes')"

echo
echo "== 2. Último VOID no presta su nota =="
R=$(req $FLR POST /floor/tickets "{\"vehicleId\":\"$(body "$(req $OFF GET "/vehicles?q=P041-201")" | jq -r '.[0].id')\",\"items\":[{\"serviceId\":\"$SRV1\"}],\"notes\":\"Anotado en el carro equivocado.\"}")
ck "POST segundo lavado -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r .id)
R=$(req $OFF POST /carwash/tickets/$T2/void "{\"reason\":\"Carro equivocado.\",\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}}")
ck "anular T2 -> 200" 200 "$(code "$R")"
ck "  VOID" VOID "$(body "$R" | jq -r .status)"

R=$(req $OFF GET "/vehicles?q=P041-201")
ck "  lastWash sigue siendo T1" "Pidió cera. No silicona." "$(body "$R" | jq -r '.[0].lastWash.notes')"

echo
echo "== 3. PATCH de pista persiste notes =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P041-202\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}]}")
ck "POST pista P041-202 -> 201" 201 "$(code "$R")"
T3=$(body "$R" | jq -r .id)
ck "  notes iniciales null" null "$(body "$R" | jq -r .notes)"
R=$(req $FLR PATCH /floor/tickets/$T3 '{"notes":"El interior se moja poco."}')
ck "PATCH pista notes -> 200" 200 "$(code "$R")"
ck "  notes guardadas" "El interior se moja poco." "$(body "$R" | jq -r .notes)"

echo
echo "== 4. PATCH de oficina /notes persiste en READY =="
R=$(req $OFF POST /carwash/tickets/$T3/status '{"status":"READY"}')
ck "T3 -> READY -> 200" 200 "$(code "$R")"
R=$(req $OFF PATCH /carwash/tickets/$T3/notes '{"notes":"Prefiere que no mojen el interior."}')
ck "PATCH oficina notes -> 200" 200 "$(code "$R")"
ck "  notes de cobro" "Prefiere que no mojen el interior." "$(body "$R" | jq -r .notes)"
ck "  sigue READY" READY "$(body "$R" | jq -r .status)"

echo
echo "== Resultado: $PASS ok, $FAIL fallos =="
[ "$FAIL" -eq 0 ]
