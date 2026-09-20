#!/bin/bash
# Verificacion end-to-end de la spec 052 (la nota del ultimo lavado, a la vista
# de quien lava). El unico cambio de API es de donde sale `vehicle.lastWash` de
# un Ticket: el ultimo lavado no anulado **distinto del propio ticket**, para
# que un ticket recien abierto no se traiga su propia nota vacia.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-052.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
POSTGRES_USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
POSTGRES_DB=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)
POSTGRES_USER=${POSTGRES_USER:-elite}
POSTGRES_DB=${POSTGRES_DB:-elite_service}
NOTE='Pidio cera. No silicona.'
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

echo "== 0. Sesiones, caja y catalogo =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS052","username":"carlos.vis052","pin":"520001"}')
if [ "$(code "$R")" = "201" ]; then
  ck "alta de empleado de pista -> 201" 201 201
else
  ck "reutiliza empleado de pista" 200 200
fi
R=$(req $FLR POST /floor/login '{"pin":"520001"}')
ck "login de pista -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
CASH_CODE=$(code "$R")
if [ "$CASH_CODE" = "200" ] || [ "$CASH_CODE" = "201" ] || [ "$CASH_CODE" = "409" ]; then
  echo "  caja lista ($CASH_CODE)"
else
  echo "  AVISO: abrir caja devolvio $CASH_CODE"
fi

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET /services)
SRV1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").id')

echo
echo "== 1. Un lavado cobrado con nota =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P052-201\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}],\"notes\":\"$NOTE\"}")
ck "POST pista con nota -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r '.id')
VEHICLE=$(body "$R" | jq -r '.vehicle.id')
ck "  el primer ticket del carro no tiene anterior" true "$(body "$R" | jq -r '.vehicle.lastWash == null')"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "T1 -> READY -> 200" 200 "$(code "$R")"
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T1)" | jq -r '.total')
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobro T1 -> 200" 200 "$(code "$R")"
ck "  PAID" PAID "$(body "$R" | jq -r '.status')"

echo
echo "== 2. El lookup de placa sigue trayendo la nota (041) =="
# Va antes de abrir el ticket nuevo, que es cuando el mostrador consulta la
# placa: el lookup devuelve el ultimo lavado no anulado del carro, y en cuanto
# exista un ticket abierto ese ultimo pasa a ser el abierto. Esa es justamente
# la confusion que la 052 arregla **dentro del ticket**, no en el lookup.
R=$(req $OFF GET "/vehicles?q=P052-201")
ck "GET oficina vehicles -> 200" 200 "$(code "$R")"
ck "  lastWash.notes" "$NOTE" "$(body "$R" | jq -r '.[0].lastWash.notes')"
R=$(req $FLR GET "/floor/vehicles?q=P052-201")
ck "GET pista vehicles -> 200" 200 "$(code "$R")"
ck "  lastWash.notes (pista)" "$NOTE" "$(body "$R" | jq -r '.[0].lastWash.notes')"

echo
echo "== 3. El ticket nuevo del mismo carro trae la nota del anterior =="
R=$(req $FLR POST /floor/tickets "{\"vehicleId\":\"$VEHICLE\",\"items\":[{\"serviceId\":\"$SRV1\"}]}")
ck "POST pista del mismo carro -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r '.id')
ck "  el ticket nuevo no tiene nota propia" true "$(body "$R" | jq -r '.notes == null')"

R=$(req $OFF GET /carwash/tickets/$T2)
ck "GET de oficina -> 200" 200 "$(code "$R")"
ck "  vehicle.lastWash.notes" "$NOTE" "$(body "$R" | jq -r '.vehicle.lastWash.notes')"
ck "  y no es el propio ticket" false "$(body "$R" | jq -r '.vehicle.lastWash.createdAt == .createdAt')"

R=$(req $FLR GET /floor/tickets/$T2)
ck "GET de pista -> 200" 200 "$(code "$R")"
ck "  vehicle.lastWash.notes (pista)" "$NOTE" "$(body "$R" | jq -r '.vehicle.lastWash.notes')"

R=$(req $OFF GET /carwash/tickets)
ck "la fila de hoy -> 200" 200 "$(code "$R")"
ck "  tambien en la lista" "$NOTE" "$(body "$R" | jq -r --arg id "$T2" '[.[]|select(.id==$id)][0].vehicle.lastWash.notes')"

echo
echo "== 4. Un anulado en el medio no presta su nota =="
R=$(req $OFF PATCH /carwash/tickets/$T2/notes '{"notes":"Anotado en el carro equivocado."}')
ck "nota en T2 -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /carwash/tickets/$T2/void "{\"reason\":\"Carro equivocado.\",\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}}")
ck "anular T2 -> 200" 200 "$(code "$R")"
ck "  VOID" VOID "$(body "$R" | jq -r '.status')"

R=$(req $FLR POST /floor/tickets "{\"vehicleId\":\"$VEHICLE\",\"items\":[{\"serviceId\":\"$SRV1\"}]}")
ck "POST pista tercer lavado -> 201" 201 "$(code "$R")"
T3=$(body "$R" | jq -r '.id')
R=$(req $OFF GET /carwash/tickets/$T3)
ck "GET de oficina -> 200" 200 "$(code "$R")"
ck "  se salta el VOID y queda la de T1" "$NOTE" "$(body "$R" | jq -r '.vehicle.lastWash.notes')"

echo
echo "== 5. El primer ticket de un carro nuevo no tiene ultimo lavado =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P052-202\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}],\"notes\":\"Primera vez.\"}")
ck "POST pista carro nuevo -> 201" 201 "$(code "$R")"
T4=$(body "$R" | jq -r '.id')
R=$(req $OFF GET /carwash/tickets/$T4)
ck "GET de oficina -> 200" 200 "$(code "$R")"
ck "  lastWash null" true "$(body "$R" | jq -r '.vehicle.lastWash == null')"
R=$(req $FLR GET /floor/tickets/$T4)
ck "GET de pista -> 200" 200 "$(code "$R")"
ck "  lastWash null (pista)" true "$(body "$R" | jq -r '.vehicle.lastWash == null')"
ck "  su propia nota sigue en el ticket" "Primera vez." "$(body "$R" | jq -r '.notes')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from work_order_status_events where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P052-%$$));
        delete from commission_entries where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P052-%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P052-%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P052-%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P052-%$$));
        delete from work_orders where "vehicleId" in (select id from vehicles where plate like $$P052-%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P052-%$$);
        delete from vehicles where plate like $$P052-%$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (placas P052-)."
fi

[ "$FAIL" -eq 0 ] || exit 1
