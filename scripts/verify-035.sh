#!/bin/bash
# Verificacion end-to-end de la spec 035 (un solo asignado).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-035.sh
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

OFF=$S/office.jar; FLR=$S/floor.jar; FLR2=$S/floor2.jar
rm -f "$OFF" "$FLR" "$FLR2"

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS035","username":"carlos.vis035","pin":"1234"}')
ck "alta Carlos -> 201" 201 "$(code "$R")"
CARLOS=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /employees '{"fullName":"Jose VIS035","username":"jose.vis035","pin":"5678"}')
JOSE=$(body "$R" | jq -r '.id')

R=$(req $FLR POST /floor/login '{"username":"carlos.vis035","pin":"1234"}')
ck "login pista Carlos -> 200" 200 "$(code "$R")"
R=$(req $FLR2 POST /floor/login '{"username":"jose.vis035","pin":"5678"}')
ck "login pista José -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
CASH_CODE=$(code "$R")
if [ "$CASH_CODE" = "200" ] || [ "$CASH_CODE" = "201" ] || [ "$CASH_CODE" = "409" ]; then
  echo "  caja lista ($CASH_CODE)"
else
  echo "  AVISO: abrir caja devolvió $CASH_CODE"
fi

R=$(req $FLR GET /floor/vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $FLR GET /floor/services)
SRV3=$(body "$R" | jq -r '.[]|select(.code=="SRV-0003").id')

floor_ticket() {
  local jar=$1 name=$2 plate=$3 extra=${4:-}
  req $jar POST /floor/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]$extra}"
}
office_ticket() {
  local name=$1 plate=$2 extra=${3:-}
  req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]$extra}"
}

echo
echo "== 1. Pista asigna al que registra =="
R=$(floor_ticket $FLR "Pista VIS035" "P035-001")
ck "POST floor -> 201" 201 "$(code "$R")"
TFL=$(body "$R" | jq -r '.id')
ck "  washers 1" 1 "$(body "$R" | jq '.washers | length')"
ck "  asignado Carlos" "$CARLOS" "$(body "$R" | jq -r '.washers[0].id')"

echo
echo "== 2. extras en POST de pista se ignoran =="
R=$(floor_ticket $FLR "Extras VIS035" "P035-002" ",\"washerIds\":[\"$JOSE\"]")
ck "POST con washerIds -> 201" 201 "$(code "$R")"
ck "  washers 1" 1 "$(body "$R" | jq '.washers | length')"
ck "  sigue Carlos" "$CARLOS" "$(body "$R" | jq -r '.washers[0].id')"

echo
echo "== 3. Oficina sin employeeId queda vacía =="
R=$(office_ticket "Oficina VIS035" "P035-003")
ck "POST office -> 201" 201 "$(code "$R")"
TOFF=$(body "$R" | jq -r '.id')
ck "  washer null" null "$(body "$R" | jq -c .washer)"
ck "  washers 0" 0 "$(body "$R" | jq '.washers | length')"

echo
echo "== 4. Oficina con employeeId =="
R=$(office_ticket "Asignado VIS035" "P035-004" ",\"employeeId\":\"$JOSE\"")
ck "POST office con employeeId -> 201" 201 "$(code "$R")"
ck "  washers 1" 1 "$(body "$R" | jq '.washers | length')"
ck "  asignado José" "$JOSE" "$(body "$R" | jq -r '.washers[0].id')"

echo
echo "== 5. PUT max 1 =="
R=$(req $OFF PUT /carwash/tickets/$TOFF/washers "{\"employeeIds\":[\"$CARLOS\",\"$JOSE\"]}")
ck "PUT oficina 2 ids -> 422" 422 "$(code "$R")"
R=$(req $OFF PUT /carwash/tickets/$TOFF/washers '{"employeeIds":[]}')
ck "PUT oficina vacío -> 200" 200 "$(code "$R")"
ck "  washers 0" 0 "$(body "$R" | jq '.washers | length')"
R=$(req $OFF PUT /carwash/tickets/$TOFF/washers "{\"employeeIds\":[\"$JOSE\"]}")
ck "PUT oficina 1 id -> 200" 200 "$(code "$R")"
ck "  asignado José" "$JOSE" "$(body "$R" | jq -r '.washers[0].id')"
R=$(req $FLR PUT /floor/tickets/$TFL/washers '{"employeeIds":[]}')
ck "PUT pista vacío -> 422" 422 "$(code "$R")"

echo
echo "== 6. start en pista solo si es suyo (036) =="
R=$(office_ticket "Start vacio VIS035" "P035-006")
TEMPTY=$(body "$R" | jq -r '.id')
R=$(req $FLR POST /floor/tickets/$TEMPTY/start)
ck "start de vacío -> 404" 404 "$(code "$R")"

R=$(floor_ticket $FLR "Start lleno VIS035" "P035-007")
TFULL=$(body "$R" | jq -r '.id')
R=$(req $FLR2 POST /floor/tickets/$TFULL/start)
ck "start de ajeno -> 404" 404 "$(code "$R")"
R=$(req $FLR GET /floor/tickets/$TFULL)
ck "  GET del dueño -> 200" 200 "$(code "$R")"
ck "  sigue Carlos" "$CARLOS" "$(body "$R" | jq -r '.washers[0].id')"
R=$(req $FLR POST /floor/tickets/$TFULL/start)
ck "start propio -> 200" 200 "$(code "$R")"
ck "  washers 1" 1 "$(body "$R" | jq '.washers | length')"
ck "  sigue Carlos" "$CARLOS" "$(body "$R" | jq -r '.washers[0].id')"

echo
echo "== 7. cobro 100% al asignado y vacío a unassigned =="
req $FLR POST /floor/tickets/$TFL/ready >/dev/null
R=$(req $OFF POST /carwash/tickets/$TFL/charge '{"method":"CASH","amount":"14.00"}')
ck "cobrar asignado -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
ck "  commissionTotal 1.00" '"1.00"' "$(body "$R" | jq -c .commissionTotal)"

R=$(office_ticket "Unassigned VIS035" "P035-008")
TUN=$(body "$R" | jq -r '.id')
req $OFF POST /carwash/tickets/$TUN/ready >/dev/null
R=$(req $OFF POST /carwash/tickets/$TUN/charge '{"method":"CASH","amount":"14.00"}')
ck "cobrar vacío -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
UN_ENTRIES=$(body "$R" | jq '.commissionTotal')
ck "  commissionTotal 1.00" '"1.00"' "$UN_ENTRIES"

echo
echo "== 8. UI sin WashersField =="
if [ -f apps/web/src/features/carwash/components/washers-field.tsx ]; then
  echo "  FALLA washers-field.tsx todavía existe"
  FAIL=$((FAIL+1))
else
  echo "  OK   washers-field.tsx borrado"
  PASS=$((PASS+1))
fi
HITS=$(grep -n 'Sumá a quien más lavó' apps/web/src --include='*.tsx' || true)
if [ -z "$HITS" ]; then
  echo "  OK   sin copy de equipo"
  PASS=$((PASS+1))
else
  echo "  FALLA quedó copy de equipo"
  FAIL=$((FAIL+1))
fi

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS035%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS035%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS035%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS035%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS035%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P035-%$$);
        delete from vehicles where plate like $$P035-%$$;
        delete from customers where "fullName" like $$%VIS035%$$;
        delete from employees where username like $$%.vis035$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS035)."
fi

[ "$FAIL" -eq 0 ] || exit 1
