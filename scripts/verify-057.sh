#!/bin/bash
# Verificacion end-to-end de la spec 057 (el ultimo lavado, desglosado en la
# ficha «Ya lo conocemos»). Lo que se prueba es lo que sale del lookup de placa:
# `lastWash` deja de traer un solo servicio y pasa a traer la factura resumida
# —numero, quien lavo, una linea por servicio con su precio, el total y como se
# pago—, igual desde oficina que desde pista. Un lavado listo pero sin cobrar
# viaja con `payment: null`.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-057.sh
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
WASHER='Carlos VIS057'
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

R=$(req $OFF POST /employees "{\"fullName\":\"$WASHER\",\"username\":\"carlos.vis057\",\"pin\":\"570001\"}")
if [ "$(code "$R")" = "201" ]; then
  ck "alta de empleado de pista -> 201" 201 201
else
  ck "reutiliza empleado de pista" 200 200
fi
R=$(req $FLR POST /floor/login '{"pin":"570001"}')
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
SERVICES=$(body "$R")
# Dos servicios de rubros distintos: el alta acepta uno por categoria (039), asi
# que un ticket de dos lineas necesita dos categorias. Salen del catalogo y no
# de codigos fijos: el seed trae «Lavado premium» y «Pulido de silvines», pero
# el taller puede renombrarlos.
SRV1=$(echo "$SERVICES" | jq -r '[.[]|select(.isActive)][0].id')
CAT1=$(echo "$SERVICES" | jq -r '[.[]|select(.isActive)][0].category.id')
SRV2=$(echo "$SERVICES" | jq -r --arg c "$CAT1" '[.[]|select(.isActive and .category.id != $c)][0].id')
ck "hay un segundo rubro con servicios" true "$([ -n "$SRV2" ] && [ "$SRV2" != "null" ] && echo true || echo false)"

echo
echo "== 1. Un lavado de pista con dos servicios, cobrado en efectivo =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P057-201\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"},{\"serviceId\":\"$SRV2\"}],\"notes\":\"$NOTE\"}")
ck "POST pista con dos servicios -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r '.id')
NUMBER=$(body "$R" | jq -r '.number')
ck "  dos lineas en el ticket" 2 "$(body "$R" | jq -r '.items|length')"
ck "  lo lava quien lo abrio" "$WASHER" "$(body "$R" | jq -r '.washers[0].fullName')"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "T1 -> READY -> 200" 200 "$(code "$R")"
R=$(req $OFF GET /carwash/tickets/$T1)
TICKET=$(body "$R")
TOTAL=$(echo "$TICKET" | jq -r '.total')
NAME1=$(echo "$TICKET" | jq -r '.items[0].serviceName')
PRICE1=$(echo "$TICKET" | jq -r '.items[0].unitPrice')
NAME2=$(echo "$TICKET" | jq -r '.items[1].serviceName')
PRICE2=$(echo "$TICKET" | jq -r '.items[1].unitPrice')
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobro T1 en efectivo -> 200" 200 "$(code "$R")"
ck "  PAID" PAID "$(body "$R" | jq -r '.status')"

echo
echo "== 2. El lookup de placa trae el desglose (oficina y pista) =="
# El mismo bloque de aserciones para los dos lados: si uno trajera media
# factura, la ficha mostraria cosas distintas segun de donde se abrio.
last_wash_ok() {
  local label=$1 json=$2
  ck "$label number" "$NUMBER" "$(echo "$json" | jq -r '.number')"
  ck "$label dos items" 2 "$(echo "$json" | jq -r '.items|length')"
  ck "$label primer servicio" "$NAME1" "$(echo "$json" | jq -r '.items[0].serviceName')"
  ck "$label primer precio" "$PRICE1" "$(echo "$json" | jq -r '.items[0].unitPrice')"
  ck "$label segundo servicio" "$NAME2" "$(echo "$json" | jq -r '.items[1].serviceName')"
  ck "$label segundo precio" "$PRICE2" "$(echo "$json" | jq -r '.items[1].unitPrice')"
  ck "$label total = suma de las lineas" true \
    "$(echo "$json" | jq -r '(.items|map(.unitPrice|tonumber)|add) == (.total|tonumber)')"
  ck "$label total = total del ticket" "$TOTAL" "$(echo "$json" | jq -r '.total')"
  ck "$label pago en efectivo" CASH "$(echo "$json" | jq -r '.payment.method')"
  ck "$label tiene fecha de cobro" true "$(echo "$json" | jq -r '.payment.paidAt != null')"
  ck "$label lo lavo la pista" "$WASHER" "$(echo "$json" | jq -r '.washers[0]')"
  ck "$label la nota sigue viajando" "$NOTE" "$(echo "$json" | jq -r '.notes')"
}

R=$(req $OFF GET "/vehicles?q=P057-201")
ck "GET oficina vehicles -> 200" 200 "$(code "$R")"
last_wash_ok "  oficina:" "$(body "$R" | jq -r '[.[]|select(.plate=="P057-201")][0].lastWash')"

R=$(req $FLR GET "/floor/vehicles?q=P057-201")
ck "GET pista vehicles -> 200" 200 "$(code "$R")"
last_wash_ok "  pista:  " "$(body "$R" | jq -r '[.[]|select(.plate=="P057-201")][0].lastWash')"

echo
echo "== 3. Un lavado listo y sin cobrar viaja sin pago =="
R=$(req $FLR POST /floor/tickets "{\"vehicle\":{\"plate\":\"P057-202\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}]}")
ck "POST pista carro nuevo -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r '.id')
NUMBER2=$(body "$R" | jq -r '.number')
R=$(req $OFF POST /carwash/tickets/$T2/status '{"status":"READY"}')
ck "T2 -> READY -> 200" 200 "$(code "$R")"

R=$(req $OFF GET "/vehicles?q=P057-202")
ck "GET oficina vehicles -> 200" 200 "$(code "$R")"
LW2=$(body "$R" | jq -r '[.[]|select(.plate=="P057-202")][0].lastWash')
ck "  es ese ticket" "$NUMBER2" "$(echo "$LW2" | jq -r '.number')"
ck "  una linea" 1 "$(echo "$LW2" | jq -r '.items|length')"
ck "  sin cobrar" true "$(echo "$LW2" | jq -r '.payment == null')"
ck "  sin nota" true "$(echo "$LW2" | jq -r '.notes == null')"

R=$(req $FLR GET "/floor/vehicles?q=P057-202")
ck "GET pista vehicles -> 200" 200 "$(code "$R")"
ck "  sin cobrar (pista)" true \
  "$(body "$R" | jq -r '[.[]|select(.plate=="P057-202")][0].lastWash.payment == null')"

echo
echo "== 4. Un carro sin lavados no tiene ultimo lavado =="
R=$(req $OFF POST /vehicles "{\"plate\":\"P057-203\",\"bodyTypeId\":\"$SEDAN\"}")
ck "alta de carro sin lavados -> 201" 201 "$(code "$R")"
R=$(req $OFF GET "/vehicles?q=P057-203")
ck "  lastWash null" true \
  "$(body "$R" | jq -r '[.[]|select(.plate=="P057-203")][0].lastWash == null')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from work_order_status_events where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P057-%$$));
        delete from commission_entries where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P057-%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P057-%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P057-%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "vehicleId" in (select id from vehicles where plate like $$P057-%$$));
        delete from work_orders where "vehicleId" in (select id from vehicles where plate like $$P057-%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P057-%$$);
        delete from vehicles where plate like $$P057-%$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (placas P057-)."
fi

[ "$FAIL" -eq 0 ] || exit 1
