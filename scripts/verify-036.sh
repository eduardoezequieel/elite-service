#!/bin/bash
# Verificacion end-to-end de la spec 036 (pista: solo mis lavados).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-036.sh
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
has_id() { body "$1" | jq -r --arg id "$2" 'any(.[]; .id == $id)'; }

OFF=$S/office.jar; FLR=$S/floor.jar; FLR2=$S/floor2.jar
rm -f "$OFF" "$FLR" "$FLR2"

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS036","username":"carlos.vis036","pin":"1234"}')
ck "alta Carlos -> 201" 201 "$(code "$R")"
CARLOS=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /employees '{"fullName":"Jose VIS036","username":"jose.vis036","pin":"5678"}')
JOSE=$(body "$R" | jq -r '.id')

R=$(req $FLR POST /floor/login '{"username":"carlos.vis036","pin":"1234"}')
ck "login pista Carlos -> 200" 200 "$(code "$R")"
R=$(req $FLR2 POST /floor/login '{"username":"jose.vis036","pin":"5678"}')
ck "login pista José -> 200" 200 "$(code "$R")"

R=$(req $FLR GET /floor/vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $FLR GET /floor/services)
SRV3=$(body "$R" | jq -r '.[]|select(.code=="SRV-0003").id')

floor_ticket() {
  local jar=$1 name=$2 plate=$3
  req $jar POST /floor/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]}"
}
office_ticket() {
  local name=$1 plate=$2 extra=${3:-}
  req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]$extra}"
}

echo
echo "== 1. Altas =="
R=$(floor_ticket $FLR "Carlos VIS036" "P036-001")
ck "POST pista Carlos -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r '.id')
R=$(floor_ticket $FLR2 "Jose VIS036" "P036-002")
ck "POST pista José -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r '.id')
R=$(office_ticket "Sin asignar VIS036" "P036-003")
ck "POST oficina sin asignar -> 201" 201 "$(code "$R")"
T3=$(body "$R" | jq -r '.id')
ck "  washers 0" 0 "$(body "$R" | jq '.washers | length')"
R=$(office_ticket "Asignado Jose VIS036" "P036-004" ",\"employeeId\":\"$JOSE\"")
ck "POST oficina a José -> 201" 201 "$(code "$R")"
T4=$(body "$R" | jq -r '.id')

echo
echo "== 2. La fila de pista es la de cada uno =="
R=$(req $FLR GET /floor/tickets)
ck "GET pista Carlos -> 200" 200 "$(code "$R")"
ck "  ve el suyo" true "$(has_id "$R" "$T1")"
ck "  no ve el de José" false "$(has_id "$R" "$T2")"
ck "  no ve el sin asignar" false "$(has_id "$R" "$T3")"
ck "  no ve el asignado a José" false "$(has_id "$R" "$T4")"

R=$(req $FLR2 GET /floor/tickets)
ck "GET pista José -> 200" 200 "$(code "$R")"
ck "  ve el suyo" true "$(has_id "$R" "$T2")"
ck "  ve el que oficina le asignó" true "$(has_id "$R" "$T4")"
ck "  no ve el de Carlos" false "$(has_id "$R" "$T1")"
ck "  no ve el sin asignar" false "$(has_id "$R" "$T3")"

R=$(req $OFF GET /carwash/tickets)
ck "oficina ve el de Carlos" true "$(has_id "$R" "$T1")"
ck "oficina ve el sin asignar" true "$(has_id "$R" "$T3")"
ck "oficina ve el de José" true "$(has_id "$R" "$T2")"

echo
echo "== 3. GET y mutaciones ajenas -> 404 =="
R=$(req $FLR GET /floor/tickets/$T2)
ck "Carlos GET el de José -> 404" 404 "$(code "$R")"
ck "  code NOT_FOUND" NOT_FOUND "$(body "$R" | jq -r .code)"
R=$(req $FLR GET /floor/tickets/$T3)
ck "Carlos GET sin asignar -> 404" 404 "$(code "$R")"
R=$(req $FLR GET /floor/tickets/$T1)
ck "Carlos GET el suyo -> 200" 200 "$(code "$R")"

R=$(req $FLR POST /floor/tickets/$T2/start)
ck "Carlos start el de José -> 404" 404 "$(code "$R")"
R=$(req $FLR POST /floor/tickets/$T3/start)
ck "Carlos start sin asignar -> 404" 404 "$(code "$R")"
R=$(req $FLR PATCH /floor/tickets/$T2 "{\"notes\":\"no\"}")
ck "Carlos PATCH el de José -> 404" 404 "$(code "$R")"
R=$(req $FLR PUT /floor/tickets/$T2/washers "{\"employeeIds\":[\"$CARLOS\"]}")
ck "Carlos PUT washers el de José -> 404" 404 "$(code "$R")"

echo
echo "== 4. El dueño sí mueve el suyo =="
R=$(req $FLR POST /floor/tickets/$T1/start)
ck "Carlos start el suyo -> 200" 200 "$(code "$R")"
ck "  WASHING" '"WASHING"' "$(body "$R" | jq -c .status)"
R=$(req $FLR2 POST /floor/tickets/$T1/ready)
ck "José ready el de Carlos -> 404" 404 "$(code "$R")"
R=$(req $FLR POST /floor/tickets/$T1/ready)
ck "Carlos ready el suyo -> 200" 200 "$(code "$R")"
ck "  READY" '"READY"' "$(body "$R" | jq -c .status)"
R=$(req $FLR2 POST /floor/tickets/$T1/reopen)
ck "José reopen el de Carlos -> 404" 404 "$(code "$R")"
R=$(req $FLR POST /floor/tickets/$T1/reopen)
ck "Carlos reopen el suyo -> 200" 200 "$(code "$R")"
ck "  OPEN" '"OPEN"' "$(body "$R" | jq -c .status)"

R=$(req $OFF GET /carwash/tickets/$T3)
ck "oficina GET sin asignar -> 200" 200 "$(code "$R")"

echo
echo "== 5. UI de pista =="
if grep -R -q 'Todos los empleados' apps/web/src/features/floor; then
  echo "  FALLA quedó 'Todos los empleados' en pista"
  FAIL=$((FAIL+1))
else
  echo "  OK   sin filtro Todos los empleados en pista"
  PASS=$((PASS+1))
fi
if grep -q "washerId" apps/web/src/features/floor/components/floor-queue.tsx; then
  echo "  FALLA floor-queue.tsx todavía filtra por washerId"
  FAIL=$((FAIL+1))
else
  echo "  OK   floor-queue sin washerId"
  PASS=$((PASS+1))
fi
if grep -q "No tenés carros en la fila" apps/web/src/features/floor/components/floor-queue.tsx; then
  echo "  OK   vacío propio"
  PASS=$((PASS+1))
else
  echo "  FALLA falta el vacío propio"
  FAIL=$((FAIL+1))
fi
if grep -q "¿Empezar este lavado?" apps/web/src/features/floor/components/floor-status-confirm.tsx \
  && grep -q "¿Marcar listo este lavado?" apps/web/src/features/floor/components/floor-status-confirm.tsx \
  && grep -q "¿Reabrir este lavado?" apps/web/src/features/floor/components/floor-status-confirm.tsx; then
  echo "  OK   diálogo de confirmación"
  PASS=$((PASS+1))
else
  echo "  FALLA falta el diálogo de estado"
  FAIL=$((FAIL+1))
fi

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS036%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS036%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS036%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS036%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS036%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P036-%$$);
        delete from vehicles where plate like $$P036-%$$;
        delete from customers where "fullName" like $$%VIS036%$$;
        delete from employees where username like $$%.vis036$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS036)."
fi

[ "$FAIL" -eq 0 ] || exit 1
