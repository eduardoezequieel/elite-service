#!/bin/bash
# Verificacion end-to-end de la spec 046 (linea de tiempo de estados del lavado).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-046.sh
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
psql_do() {
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q -c "$1" >/dev/null 2>&1
}

OFF=$S/office.jar; FLR=$S/floor.jar; READER=$S/reader.jar
rm -f "$OFF" "$FLR" "$READER"

echo "== 0. Sesiones y caja =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS046","username":"carlos.vis046","pin":"460001"}')
ck "alta Carlos -> 201" 201 "$(code "$R")"
R=$(req $FLR POST /floor/login '{"pin":"460001"}')
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
  local name=$1 plate=$2
  req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]}"
}

echo
echo "== 1. OPEN -> WASHING -> READY -> PAID deja cuatro tramos en orden =="
R=$(office_ticket "Linea VIS046" "P046-001")
ck "POST oficina -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r '.id')

R=$(req $OFF GET /carwash/tickets/$T1/timeline)
ck "timeline recién abierto -> 200" 200 "$(code "$R")"
ck "  recorded" true "$(body "$R" | jq -r .recorded)"
ck "  un solo tramo" 1 "$(body "$R" | jq '.segments | length')"
ck "  tramo OPEN" OPEN "$(body "$R" | jq -r '.segments[0].status')"
ck "  abierto: leftAt null" true "$(body "$R" | jq -r '.segments[0].leftAt == null')"
ck "  abierto: sin duración" true "$(body "$R" | jq -r '.segments[0].durationSeconds == null')"
ck "  actor de oficina" user "$(body "$R" | jq -r '.segments[0].actor.kind')"

sleep 1
req $OFF POST /carwash/tickets/$T1/status '{"status":"WASHING"}' >/dev/null
sleep 1
req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}' >/dev/null
sleep 1
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T1)" | jq -r .total)
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobro -> 200" 200 "$(code "$R")"

R=$(req $OFF GET /carwash/tickets/$T1/timeline)
ck "timeline del cobrado -> 200" 200 "$(code "$R")"
ck "  cuatro tramos" 4 "$(body "$R" | jq '.segments | length')"
ck "  en orden" '["OPEN","WASHING","READY","PAID"]' "$(body "$R" | jq -c '[.segments[].status]')"
ck "  los tres primeros cerrados" 0 "$(body "$R" | jq '[.segments[0,1,2] | select(.durationSeconds == null)] | length')"
ck "  duraciones ≥ 1s" 0 "$(body "$R" | jq '[.segments[0,1,2] | select(.durationSeconds < 1)] | length')"
ck "  cada leftAt es el enteredAt del siguiente" true "$(body "$R" | jq -r '[range(0;3) as $i | .segments[$i].leftAt == .segments[$i+1].enteredAt] | all')"
ck "  el último queda abierto" true "$(body "$R" | jq -r '.segments[3].leftAt == null')"
ck "  todos con actor" 0 "$(body "$R" | jq '[.segments[] | select(.actor == null)] | length')"

echo
echo "== 2. Un estado repetido da dos tramos propios =="
R=$(office_ticket "Vuelta VIS046" "P046-002")
T2=$(body "$R" | jq -r '.id')
sleep 1
req $OFF POST /carwash/tickets/$T2/status '{"status":"WASHING"}' >/dev/null
sleep 1
req $OFF POST /carwash/tickets/$T2/status '{"status":"OPEN"}' >/dev/null
R=$(req $OFF GET /carwash/tickets/$T2/timeline)
ck "tres tramos" 3 "$(body "$R" | jq '.segments | length')"
ck "  OPEN aparece dos veces" 2 "$(body "$R" | jq '[.segments[] | select(.status == "OPEN")] | length')"
ck "  el primer OPEN quedó cerrado" false "$(body "$R" | jq -r '.segments[0].durationSeconds == null')"

echo
echo "== 3. La pista firma con el empleado =="
R=$(req $FLR POST /floor/tickets "{\"customer\":{\"fullName\":\"Pista VIS046\"},\"vehicle\":{\"plate\":\"P046-003\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]}")
ck "POST pista -> 201" 201 "$(code "$R")"
T3=$(body "$R" | jq -r '.id')
req $FLR POST /floor/tickets/$T3/start >/dev/null
R=$(req $OFF GET /carwash/tickets/$T3/timeline)
ck "dos tramos" 2 "$(body "$R" | jq '.segments | length')"
ck "  apertura de pista" employee "$(body "$R" | jq -r '.segments[0].actor.kind')"
ck "  nombre del empleado" "Carlos VIS046" "$(body "$R" | jq -r '.segments[1].actor.name')"
ck "  WASHING" WASHING "$(body "$R" | jq -r '.segments[1].status')"

echo
echo "== 4. Un lavado anterior a la spec no tiene historia =="
if command -v docker >/dev/null 2>&1; then
  psql_do "delete from work_order_status_events where \"workOrderId\" = '$T2'"
  R=$(req $OFF GET /carwash/tickets/$T2/timeline)
  ck "sin filas -> 200" 200 "$(code "$R")"
  ck "  recorded false" false "$(body "$R" | jq -r .recorded)"
  ck "  sin tramos" 0 "$(body "$R" | jq '.segments | length')"
else
  echo "  AVISO: sin docker, no se puede simular un lavado anterior a la spec."
fi

echo
echo "== 5. Permiso y errores =="
R=$(req $OFF POST /roles '{"name":"Mirón VIS046","permissionKeys":["carwash.read"]}')
ck "rol sin carwash.audit -> 201" 201 "$(code "$R")"
ROLE_ID=$(body "$R" | jq -r .id)
R=$(req $OFF POST /users "{\"email\":\"miron.vis046@elite.local\",\"fullName\":\"Mirón VIS046\",\"password\":\"clave12345\",\"roleIds\":[\"$ROLE_ID\"]}")
ck "usuario sin permiso -> 201" 201 "$(code "$R")"
R=$(req $READER POST /auth/login '{"email":"miron.vis046@elite.local","password":"clave12345"}')
ck "login del mirón -> 200" 200 "$(code "$R")"
R=$(req $READER GET /carwash/tickets/$T1)
ck "ve el detalle del lavado -> 200" 200 "$(code "$R")"
R=$(req $READER GET /carwash/tickets/$T1/timeline)
ck "timeline sin carwash.audit -> 403" 403 "$(code "$R")"
ck "  code FORBIDDEN" FORBIDDEN "$(body "$R" | jq -r .code)"

R=$(req $OFF GET /carwash/tickets/00000000-0000-4000-8000-000000000000/timeline)
ck "lavado inexistente -> 404" 404 "$(code "$R")"
R=$(req $OFF GET /carwash/tickets/no-es-uuid/timeline)
ck "id inválido -> 404" 404 "$(code "$R")"

FLR_CODE=$(curl -s -o /dev/null -w '%{http_code}' -b "$FLR" "$API/carwash/tickets/$T1/timeline")
if [ "$FLR_CODE" = "401" ] || [ "$FLR_CODE" = "403" ]; then
  echo "  OK   la pista no ve la línea de tiempo  ($FLR_CODE)"
  PASS=$((PASS+1))
else
  echo "  FALLA la pista no ve la línea de tiempo  esperado=401|403 obtenido=$FLR_CODE"
  FAIL=$((FAIL+1))
fi

echo
echo "== 6. UI =="
if grep -q "TicketTimeline" apps/web/src/features/carwash/components/ticket-detail-screen.tsx; then
  echo "  OK   el detalle monta la línea de tiempo"
  PASS=$((PASS+1))
else
  echo "  FALLA el detalle no monta la línea de tiempo"
  FAIL=$((FAIL+1))
fi
if grep -q "carwash.actions.audit.key" apps/web/src/features/carwash/components/ticket-detail-screen.tsx; then
  echo "  OK   la monta detrás del permiso"
  PASS=$((PASS+1))
else
  echo "  FALLA la línea de tiempo no está detrás de carwash.audit"
  FAIL=$((FAIL+1))
fi
if grep -q "density === 'bahia'" apps/web/src/features/carwash/components/ticket-timeline.tsx; then
  echo "  OK   la fila distingue las dos densidades"
  PASS=$((PASS+1))
else
  echo "  FALLA la fila se ve igual en las dos densidades"
  FAIL=$((FAIL+1))
fi

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from work_order_status_events where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS046%$$));
        delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS046%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS046%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS046%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS046%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS046%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P046-%$$);
        delete from vehicles where plate like $$P046-%$$;
        delete from customers where "fullName" like $$%VIS046%$$;
        delete from employees where username like $$%.vis046$$;
        delete from user_roles where "userId" in (select id from users where email like $$%vis046%$$);
        delete from users where email like $$%vis046%$$;
        delete from role_permissions where "roleId" in (select id from roles where name like $$%VIS046%$$);
        delete from roles where name like $$%VIS046%$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS046)."
fi

[ "$FAIL" -eq 0 ] || exit 1
