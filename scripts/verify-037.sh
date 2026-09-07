#!/bin/bash
# Verificacion end-to-end de la spec 037 (oficina: cambiar estado operativo).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-037.sh
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

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS037","username":"carlos.vis037","pin":"1234"}')
ck "alta Carlos -> 201" 201 "$(code "$R")"
R=$(req $FLR POST /floor/login '{"username":"carlos.vis037","pin":"1234"}')
ck "login pista Carlos -> 200" 200 "$(code "$R")"

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
SRV3=$(body "$R" | jq -r '.[]|select(.code=="SRV-0003").id')

office_ticket() {
  local name=$1 plate=$2 extra=${3:-}
  req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]$extra}"
}

echo
echo "== 1. OPEN -> WASHING -> READY -> OPEN, sin inventar asignado =="
R=$(office_ticket "Hop VIS037" "P037-001")
ck "POST oficina -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r '.id')
ck "  nace OPEN" OPEN "$(body "$R" | jq -r .status)"
ck "  washers 0" 0 "$(body "$R" | jq '.washers | length')"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"WASHING"}')
ck "OPEN -> WASHING -> 200" 200 "$(code "$R")"
ck "  WASHING" WASHING "$(body "$R" | jq -r .status)"
ck "  washers sigue 0" 0 "$(body "$R" | jq '.washers | length')"
ck "  washingStartedAt" false "$(body "$R" | jq -r '.washingStartedAt == null')"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "WASHING -> READY -> 200" 200 "$(code "$R")"
ck "  READY" READY "$(body "$R" | jq -r .status)"
ck "  washingStartedAt se conserva" false "$(body "$R" | jq -r '.washingStartedAt == null')"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"OPEN"}')
ck "READY -> OPEN -> 200" 200 "$(code "$R")"
ck "  OPEN" OPEN "$(body "$R" | jq -r .status)"
ck "  washingStartedAt limpio" true "$(body "$R" | jq -r '.washingStartedAt == null')"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "OPEN -> READY (salto) -> 200" 200 "$(code "$R")"
ck "  READY" READY "$(body "$R" | jq -r .status)"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"WASHING"}')
ck "READY -> WASHING -> 200" 200 "$(code "$R")"
ck "  washingStartedAt reinicia" false "$(body "$R" | jq -r '.washingStartedAt == null')"

echo
echo "== 2. Mismo estado, PAID, VOID, body inválido =="
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"WASHING"}')
ck "mismo estado -> 409" 409 "$(code "$R")"
ck "  TICKET_ALREADY_IN_STATUS" TICKET_ALREADY_IN_STATUS "$(body "$R" | jq -r .code)"

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"PAID"}')
ck "body PAID -> 422" 422 "$(code "$R")"

R=$(office_ticket "Cobrado VIS037" "P037-002")
T2=$(body "$R" | jq -r '.id')
req $OFF POST /carwash/tickets/$T2/status '{"status":"READY"}' >/dev/null
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T2)" | jq -r .total)
R=$(req $OFF POST /carwash/tickets/$T2/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobro -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /carwash/tickets/$T2/status '{"status":"OPEN"}')
ck "PAID -> OPEN -> 409" 409 "$(code "$R")"
ck "  TICKET_STATUS_LOCKED" TICKET_STATUS_LOCKED "$(body "$R" | jq -r .code)"

R=$(office_ticket "Anulado VIS037" "P037-003")
T3=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /carwash/tickets/$T3/void '{"reason":"Prueba VIS037"}')
ck "anular -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /carwash/tickets/$T3/status '{"status":"READY"}')
ck "VOID -> READY -> 409" 409 "$(code "$R")"
ck "  TICKET_STATUS_LOCKED" TICKET_STATUS_LOCKED "$(body "$R" | jq -r .code)"

echo
echo "== 3. Endpoints viejos y pista intactos =="
R=$(office_ticket "Ready viejo VIS037" "P037-004")
T4=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /carwash/tickets/$T4/ready)
ck "POST /ready oficina sigue -> 200" 200 "$(code "$R")"
ck "  READY" READY "$(body "$R" | jq -r .status)"
R=$(req $OFF POST /carwash/tickets/$T4/reopen)
ck "POST /reopen oficina sigue -> 200" 200 "$(code "$R")"
ck "  OPEN" OPEN "$(body "$R" | jq -r .status)"

R=$(req $FLR POST /floor/tickets "{\"customer\":{\"fullName\":\"Pista VIS037\"},\"vehicle\":{\"plate\":\"P037-005\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]}")
ck "POST pista -> 201" 201 "$(code "$R")"
T5=$(body "$R" | jq -r '.id')
R=$(req $FLR POST /floor/tickets/$T5/start)
ck "pista start el suyo -> 200" 200 "$(code "$R")"
ck "  WASHING" WASHING "$(body "$R" | jq -r .status)"

R=$(req $FLR POST /carwash/tickets/$T1/status '{"status":"OPEN"}')
FLR_CODE=$(code "$R")
if [ "$FLR_CODE" = "401" ] || [ "$FLR_CODE" = "403" ]; then
  echo "  OK   pista no usa /carwash/.../status  ($FLR_CODE)"
  PASS=$((PASS+1))
else
  echo "  FALLA pista no usa /carwash/.../status  esperado=401|403 obtenido=$FLR_CODE"
  FAIL=$((FAIL+1))
fi

echo
echo "== 4. UI de oficina =="
if grep -q "Cambiar estado" apps/web/src/features/carwash/components/ticket-detail-screen.tsx; then
  echo "  OK   detalle tiene Cambiar estado"
  PASS=$((PASS+1))
else
  echo "  FALLA falta Cambiar estado en el detalle"
  FAIL=$((FAIL+1))
fi
if grep -q "Marcar listo" apps/web/src/features/carwash/components/ticket-detail-screen.tsx \
  || grep -q "Reabrir" apps/web/src/features/carwash/components/ticket-detail-screen.tsx; then
  echo "  FALLA el detalle de oficina todavía tiene Marcar listo o Reabrir"
  FAIL=$((FAIL+1))
else
  echo "  OK   detalle sin Marcar listo ni Reabrir"
  PASS=$((PASS+1))
fi
if grep -q "Marcar listo" apps/web/src/features/carwash/components/tickets-screen.tsx; then
  echo "  FALLA la fila todavía tiene Marcar listo"
  FAIL=$((FAIL+1))
else
  echo "  OK   fila sin Marcar listo"
  PASS=$((PASS+1))
fi
if grep -q "Marcar listo" apps/web/src/features/floor/components/floor-ticket-detail.tsx \
  && grep -q "Reabrir" apps/web/src/features/floor/components/floor-ticket-detail.tsx; then
  echo "  OK   pista conserva Marcar listo y Reabrir"
  PASS=$((PASS+1))
else
  echo "  FALLA la pista perdió Marcar listo o Reabrir"
  FAIL=$((FAIL+1))
fi
if grep -q "Se marca como lavando. El tiempo de lavado empieza ahora." \
  apps/web/src/features/carwash/status-change.ts \
  && grep -q "Vuelve a lavando. Deja de poder cobrarse. El tiempo de lavado se reinicia." \
  apps/web/src/features/carwash/status-change.ts; then
  echo "  OK   avisos del salto"
  PASS=$((PASS+1))
else
  echo "  FALLA faltan avisos del salto"
  FAIL=$((FAIL+1))
fi

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS037%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS037%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS037%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS037%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS037%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P037-%$$);
        delete from vehicles where plate like $$P037-%$$;
        delete from customers where "fullName" like $$%VIS037%$$;
        delete from employees where username like $$%.vis037$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS037)."
fi

[ "$FAIL" -eq 0 ] || exit 1
