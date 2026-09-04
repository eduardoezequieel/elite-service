#!/bin/bash
# Verificacion end-to-end de la spec 009 (comisiones del lavado y varios lavadores).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-009.sh
#
# Crea empleados, clientes, vehiculos y tickets con sufijo VIS009 y los borra al
# terminar. Si 010 ya esta viva, abre caja antes de cobrar.
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
sql() {
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$1" 2>/dev/null | tr -d '\r'
}

OFF=$S/office.jar; FLR=$S/floor.jar; CASHIER=$S/cashier.jar
rm -f "$OFF" "$FLR" "$CASHIER"

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
# El seed concede la clave nueva al rol llamado Administrator. En esta base el
# admin puede tener otro nombre (p. ej. Administrador): se la sumamos a su rol.
ROLE_ID=$(body "$R" | jq -r '.user.roles[0].id // .roles[0].id')
if [ -n "$ROLE_ID" ] && [ "$ROLE_ID" != "null" ]; then
  R=$(req $OFF GET /roles)
  KEYS=$(body "$R" | jq -c --arg id "$ROLE_ID" '.[] | select(.id==$id) | (.permissionKeys + ["carwash.commissions","carwash.cash"]) | unique')
  if [ -n "$KEYS" ] && [ "$KEYS" != "null" ]; then
    req $OFF PATCH /roles/$ROLE_ID "{\"permissionKeys\":$KEYS}" >/dev/null
  fi
fi

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS009","username":"carlos.vis009","pin":"1234"}')
ck "alta Carlos -> 201" 201 "$(code "$R")"
CARLOS=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /employees '{"fullName":"Jose VIS009","username":"jose.vis009","pin":"5678"}')
JOSE=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /employees '{"fullName":"Ana VIS009","username":"ana.vis009","pin":"4321"}')
ANA=$(body "$R" | jq -r '.id')

R=$(req $FLR POST /floor/login '{"username":"carlos.vis009","pin":"1234"}')
ck "login de pista -> 200" 200 "$(code "$R")"

R=$(req $FLR GET /floor/employees)
ck "GET /floor/employees -> 200" 200 "$(code "$R")"
ck "  no trae username" "false" "$(body "$R" | jq 'map(has("username")) | any')"
ck "  no trae pinHash" 0 "$(body "$R" | grep -c pinHash)"

# Si 010 ya esta viva, hay que abrir caja antes de cobrar.
R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
CASH_CODE=$(code "$R")
if [ "$CASH_CODE" = "404" ]; then
  echo "  caja 010 no está en este stack: se cobra como 003"
elif [ "$CASH_CODE" = "200" ] || [ "$CASH_CODE" = "201" ] || [ "$CASH_CODE" = "409" ]; then
  echo "  caja lista ($CASH_CODE)"
else
  echo "  AVISO: abrir caja devolvió $CASH_CODE"
fi

R=$(req $FLR GET /floor/vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
PICKUP=$(body "$R" | jq -r '.[]|select(.key=="pickup").id')
R=$(req $FLR GET /floor/services)
SRV1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").id')
SRV2=$(body "$R" | jq -r '.[]|select(.code=="SRV-0002").id')
SRV3=$(body "$R" | jq -r '.[]|select(.code=="SRV-0003").id')

floor_ticket() {
  local name=$1 plate=$2 bodyType=$3 items=$4 extra=${5:-}
  req $FLR POST /floor/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$bodyType\"},\"items\":$items$extra}"
}
office_ticket() {
  local name=$1 plate=$2 bodyType=$3 items=$4 extra=${5:-}
  req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"$name\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$bodyType\"},\"items\":$items$extra}"
}
ready_and_charge() {
  local id=$1 amount=$2
  req $FLR POST /floor/tickets/$id/ready >/dev/null
  req $OFF POST /carwash/tickets/$id/charge "{\"method\":\"CASH\",\"amount\":\"$amount\"}"
}

echo
echo "== 1. washer de 003 intacto (RN-9) =="
R=$(floor_ticket "Maria VIS009" "P009-001" "$SEDAN" "[{\"serviceId\":\"$SRV3\"}]")
ck "abre ticket de pista -> 201" 201 "$(code "$R")"
T003=$(body "$R" | jq -r '.id')
ck "  washer es quien abrio" '"Carlos VIS009"' "$(body "$R" | jq -c .washer.fullName)"
ck "  washers length 1" 1 "$(body "$R" | jq '.washers | length')"
ck "  washers[0] es el opener" "$CARLOS" "$(body "$R" | jq -r '.washers[0].id')"
ck "  commissionTotal null hasta cobrar" null "$(body "$R" | jq -c .commissionTotal)"

echo
echo "== 2. OPEN/READY no comisionan =="
R=$(req $FLR POST /floor/tickets/$T003/ready)
ck "marcar listo -> READY" '"READY"' "$(body "$R" | jq -c .status)"
ck "  sigue sin commissionTotal" null "$(body "$R" | jq -c .commissionTotal)"
ENTRIES=$(sql "select count(*) from commission_entries where \"workOrderId\"='$T003';")
ck "  sin CommissionEntry" "0" "$ENTRIES"
req $FLR POST /floor/tickets/$T003/reopen >/dev/null

echo
echo "== 3. \$8 → 0 =="
R=$(floor_ticket "Ocho VIS009" "P009-008" "$SEDAN" "[{\"serviceId\":\"$SRV1\"}]")
T8=$(body "$R" | jq -r '.id')
R=$(ready_and_charge "$T8" "8.00")
ck "cobrar \$8 -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
ck "  commissionTotal 0.00" '"0.00"' "$(body "$R" | jq -c .commissionTotal)"

echo
echo "== 4. \$14 → 1.00 =="
R=$(floor_ticket "Catorce VIS009" "P009-014" "$SEDAN" "[{\"serviceId\":\"$SRV3\"}]")
T14=$(body "$R" | jq -r '.id')
R=$(ready_and_charge "$T14" "14.00")
ck "cobrar \$14 -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
ck "  commissionTotal 1.00" '"1.00"' "$(body "$R" | jq -c .commissionTotal)"
AMT=$(sql "select amount::text from commission_entries where \"workOrderId\"='$T14';")
ck "  una entrada de 1.00" "1.00" "$AMT"

echo
echo "== 5. \$14 con 2 lavadores → 0.50/0.50 =="
R=$(floor_ticket "Dos VIS009" "P009-015" "$SEDAN" "[{\"serviceId\":\"$SRV3\"}]" ",\"washerIds\":[\"$JOSE\"]")
T14B=$(body "$R" | jq -r '.id')
ck "  washer sigue siendo Carlos" '"Carlos VIS009"' "$(body "$R" | jq -c .washer.fullName)"
ck "  washers son 2" 2 "$(body "$R" | jq '.washers | length')"
R=$(ready_and_charge "$T14B" "14.00")
ck "cobrar \$14 / 2 -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
ck "  commissionTotal 1.00" '"1.00"' "$(body "$R" | jq -c .commissionTotal)"
AMTS=$(sql "select string_agg(amount::text, ',' order by amount) from commission_entries where \"workOrderId\"='$T14B';")
ck "  partes 0.50,0.50" "0.50,0.50" "$AMTS"

echo
echo "== 6. \$40 → 4.80 =="
R=$(floor_ticket "Cuarenta VIS009" "P009-040" "$PICKUP" "[{\"serviceId\":\"$SRV1\"},{\"serviceId\":\"$SRV2\"},{\"serviceId\":\"$SRV3\",\"unitPrice\":\"16.00\"}]")
T40=$(body "$R" | jq -r '.id')
ck "  total 40.00" '"40.00"' "$(body "$R" | jq -c .total)"
R=$(ready_and_charge "$T40" "40.00")
ck "cobrar \$40 -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
ck "  commissionTotal 4.80" '"4.80"' "$(body "$R" | jq -c .commissionTotal)"

echo
echo "== 7. \$1.00 / 3 lavadores suma 1.00 =="
R=$(floor_ticket "Tres VIS009" "P009-016" "$SEDAN" "[{\"serviceId\":\"$SRV3\"}]" ",\"washerIds\":[\"$JOSE\",\"$ANA\"]")
T3=$(body "$R" | jq -r '.id')
ck "  washers son 3" 3 "$(body "$R" | jq '.washers | length')"
R=$(ready_and_charge "$T3" "14.00")
ck "cobrar \$14 / 3 -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
SUM=$(sql "select sum(amount)::text from commission_entries where \"workOrderId\"='$T3';")
ck "  la suma de las partes es 1.00" "1.00" "$SUM"

echo
echo "== 8. Oficina sin lavador no paga =="
R=$(office_ticket "Oficina VIS009" "P009-090" "$SEDAN" "[{\"serviceId\":\"$SRV3\"}]")
TOFF=$(body "$R" | jq -r '.id')
ck "alta oficina sin lavador" 201 "$(code "$R")"
ck "  washer null" null "$(body "$R" | jq -c .washer)"
ck "  washers vacio" 0 "$(body "$R" | jq '.washers | length')"
req $OFF POST /carwash/tickets/$TOFF/ready >/dev/null
R=$(req $OFF POST /carwash/tickets/$TOFF/charge '{"method":"CASH","amount":"14.00"}')
ck "cobrar oficina -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
ck "  commissionTotal 1.00" '"1.00"' "$(body "$R" | jq -c .commissionTotal)"
OFF_ENTRIES=$(sql "select count(*) from commission_entries where \"workOrderId\"='$TOFF';")
ck "  sin entradas" "0" "$OFF_ENTRIES"

R=$(req $OFF GET /carwash/commissions)
ck "GET /carwash/commissions -> 200" 200 "$(code "$R")"
ck "  unassigned cuenta el de oficina" 1 "$(body "$R" | jq -r '.unassigned.ticketCount | if . >= 1 then 1 else 0 end')"
PAYABLE=$(body "$R" | jq -r '.totalPayable')
UNASSIGNED=$(body "$R" | jq -r '.unassigned.commission')
echo "  totalPayable=$PAYABLE unassigned.commission=$UNASSIGNED"

echo
echo "== 9. PUT lavadores y WASHERS_LOCKED =="
R=$(floor_ticket "Lock VIS009" "P009-070" "$SEDAN" "[{\"serviceId\":\"$SRV3\"}]")
TLOCK=$(body "$R" | jq -r '.id')
R=$(req $FLR PUT /floor/tickets/$TLOCK/washers "{\"employeeIds\":[\"$CARLOS\",\"$JOSE\"]}")
ck "PUT washers en OPEN -> 200" 200 "$(code "$R")"
ck "  washers 2" 2 "$(body "$R" | jq '.washers | length')"
ck "  washer no cambio" '"Carlos VIS009"' "$(body "$R" | jq -c .washer.fullName)"
R=$(req $FLR PUT /floor/tickets/$TLOCK/washers '{"employeeIds":[]}')
ck "PUT vacio en pista -> 422" 422 "$(code "$R")"
req $FLR POST /floor/tickets/$TLOCK/ready >/dev/null
R=$(req $OFF POST /carwash/tickets/$TLOCK/charge '{"method":"CASH","amount":"14.00"}')
ck "cobrar lock -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
R=$(req $OFF PUT /carwash/tickets/$TLOCK/washers "{\"employeeIds\":[\"$ANA\"]}")
ck "PUT en PAID -> 409" 409 "$(code "$R")"
ck "  code WASHERS_LOCKED" WASHERS_LOCKED "$(body "$R" | jq -r .code)"

R=$(office_ticket "Void VIS009" "P009-080" "$SEDAN" "[{\"serviceId\":\"$SRV1\"}]")
TVOID=$(body "$R" | jq -r '.id')
req $OFF POST /carwash/tickets/$TVOID/void >/dev/null
R=$(req $OFF PUT /carwash/tickets/$TVOID/washers "{\"employeeIds\":[\"$CARLOS\"]}")
ck "PUT en VOID -> 409" 409 "$(code "$R")"
ck "  code WASHERS_LOCKED" WASHERS_LOCKED "$(body "$R" | jq -r .code)"

echo
echo "== 10. 403 sin permiso y 401 desde pista =="
R=$(req $OFF POST /roles '{"name":"Cajero VIS009","permissionKeys":["carwash.read","carwash.charge"]}')
ck "rol sin commissions -> 201" 201 "$(code "$R")"
ROLE=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /users "{\"email\":\"cajero.vis009@elite.local\",\"fullName\":\"Cajero VIS009\",\"password\":\"clave12345\",\"roleIds\":[\"$ROLE\"]}")
ck "usuario cajero -> 201" 201 "$(code "$R")"
R=$(req $CASHIER POST /auth/login '{"email":"cajero.vis009@elite.local","password":"clave12345"}')
ck "login cajero -> 200" 200 "$(code "$R")"
R=$(req $CASHIER GET /carwash/commissions)
ck "GET commissions sin permiso -> 403" 403 "$(code "$R")"
R=$(req $FLR GET /carwash/commissions)
ck "GET commissions desde pista -> 401" 401 "$(code "$R")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS009%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS009%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS009%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS009%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS009%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P009-%$$);
        delete from vehicles where plate like $$P009-%$$;
        delete from customers where "fullName" like $$%VIS009%$$;
        delete from employees where username like $$%.vis009$$;
        delete from user_roles where "userId" in (select id from users where email like $$%vis009%$$);
        delete from users where email like $$%vis009%$$;
        delete from role_permissions where "roleId" in (select id from roles where name like $$%VIS009%$$);
        delete from roles where name like $$%VIS009%$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS009)."
fi

[ "$FAIL" -eq 0 ] || exit 1
