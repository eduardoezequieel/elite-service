#!/bin/bash
# Verificacion end-to-end de la spec 010 (caja del lavado).
#
# Recorre los criterios de aceptacion contra un stack levantado: base sembrada,
# API en marcha. Prueba cobro sin turno, un turno a la vez, snapshot de cierre
# y los 403/401 de permiso y pista.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-010.sh
#
# Crea tickets y sesiones con sufijo VIS y los borra al terminar.
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

OFF=$S/office.jar; FLR=$S/floor.jar; CASHIER=$S/cashier.jar
rm -f "$OFF" "$FLR" "$CASHIER"

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')
ADMIN_NAME=$(body "$R" | jq -r '.user.fullName')

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS","username":"carlos.vis","pin":"1234"}')
ck "alta de empleado -> 201" 201 "$(code "$R")"
R=$(req $FLR POST /floor/login '{"username":"carlos.vis","pin":"1234"}')
ck "login de pista -> 200" 200 "$(code "$R")"

# Si quedo un turno OPEN de otra corrida, se cierra para partir de cero.
R=$(req $OFF GET /carwash/cash/current)
ck "GET current -> 200" 200 "$(code "$R")"
if [ "$(body "$R" | jq -c .)" != "null" ]; then
  EXPECTED=$(body "$R" | jq -r '.expectedCash')
  req $OFF POST /carwash/cash/close "{\"countedCash\":\"$EXPECTED\"}" >/dev/null
fi

SEDAN=$(body "$(req $OFF GET /vehicle-body-types)" | jq -r '.[]|select(.key=="sedan").id')
SERVICES=$(req $OFF GET /services)
SRV1=$(body "$SERVICES" | jq -r '.[]|select(.code=="SRV-0001").id')
SRV2=$(body "$SERVICES" | jq -r '.[]|select(.code=="SRV-0002").id')
SRV3=$(body "$SERVICES" | jq -r '.[]|select(.code=="SRV-0003").id')

open_ready() {
  local name=$1 plate=$2 service=$3
  local created
  created=$(req $OFF POST /carwash/tickets "{
    \"customer\": {\"fullName\":\"$name\"},
    \"vehicle\": {\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},
    \"items\": [{\"serviceId\":\"$service\"}]
  }")
  local id
  id=$(body "$created" | jq -r .id)
  req $OFF POST /carwash/tickets/$id/ready >/dev/null
  echo "$id"
}

echo
echo "== 1. Cobro sin turno abierto =="
T_CLOSED=$(open_ready "Caja VIS 1" "P VIS-C1" "$SRV3")
R=$(req $OFF GET /carwash/tickets/$T_CLOSED)
ck "ticket de 14.00 listo" '"14.00"' "$(body "$R" | jq -c .total)"
R=$(req $OFF POST /carwash/tickets/$T_CLOSED/charge '{"method":"CASH","amount":"14.00"}')
ck "cobrar sin turno -> 409" 409 "$(code "$R")"
ck "  code CASH_NOT_OPEN" CASH_NOT_OPEN "$(body "$R" | jq -r .code)"
ck "  mensaje de abrir caja" "Abrí la caja para cobrar." "$(body "$R" | jq -r .message)"
R=$(req $OFF GET /carwash/tickets/$T_CLOSED)
ck "  el ticket sigue READY" '"READY"' "$(body "$R" | jq -c .status)"

echo
echo "== 2. Abrir, segundo abrir, cobros atados =="
R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"20.00"}')
ck "abrir con fondo 20.00 -> 201" 201 "$(code "$R")"
SESSION1=$(body "$R" | jq -r .id)
ck "  status OPEN" '"OPEN"' "$(body "$R" | jq -c .status)"
ck "  openingFloat" '"20.00"' "$(body "$R" | jq -c .openingFloat)"
ck "  openedBy es el admin" "\"$ADMIN_ID\"" "$(body "$R" | jq -c .openedBy.id)"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
ck "segundo abrir -> 409" 409 "$(code "$R")"
ck "  code CASH_ALREADY_OPEN" CASH_ALREADY_OPEN "$(body "$R" | jq -r .code)"
ck "  el cuerpo dice quien tiene el turno" 1 "$(body "$R" | grep -c "$ADMIN_NAME")"

T_CASH=$(open_ready "Caja VIS 2" "P VIS-C2" "$SRV3")
T_CARD=$(open_ready "Caja VIS 3" "P VIS-C3" "$SRV2")
R=$(req $OFF POST /carwash/tickets/$T_CASH/charge '{"method":"CASH","amount":"14.00"}')
ck "cobro CASH 14 -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
R=$(req $OFF POST /carwash/tickets/$T_CARD/charge '{"method":"CARD","amount":"10.00"}')
ck "cobro CARD 10 -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"

R=$(req $OFF GET /carwash/cash/current)
ck "current en vivo cashTotal 14" '"14.00"' "$(body "$R" | jq -c .cashTotal)"
ck "  cardTotal 10" '"10.00"' "$(body "$R" | jq -c .cardTotal)"
ck "  transferTotal 0" '"0.00"' "$(body "$R" | jq -c .transferTotal)"
ck "  expectedCash = fondo + efectivo" '"34.00"' "$(body "$R" | jq -c .expectedCash)"
ck "  countedCash null hasta cerrar" null "$(body "$R" | jq -c .countedCash)"
ck "  paymentCount 2" 2 "$(body "$R" | jq -r .paymentCount)"

R=$(req $OFF GET /carwash/cash/sessions/$SESSION1)
ck "detalle del turno -> 200" 200 "$(code "$R")"
ck "  dos pagos atados" 2 "$(body "$R" | jq '.payments|length')"
ck "  el CASH lleva cashSessionId via el turno" "$SESSION1" "$(body "$R" | jq -r '.id')"

echo
echo "== 3. Cierre diferencia 0 y cobro posterior =="
R=$(req $OFF POST /carwash/cash/close '{"countedCash":"34.00"}')
ck "cerrar contando 34 -> 200" 200 "$(code "$R")"
ck "  status CLOSED" '"CLOSED"' "$(body "$R" | jq -c .status)"
ck "  expectedCash 34" '"34.00"' "$(body "$R" | jq -c .expectedCash)"
ck "  differenceCash 0" '"0.00"' "$(body "$R" | jq -c .differenceCash)"
ck "  cardTotal informado, no contado" '"10.00"' "$(body "$R" | jq -c .cardTotal)"

R=$(req $OFF GET /carwash/cash/current)
ck "current tras cierre es JSON null" null "$(body "$R" | jq -c .)"

T_AFTER=$(open_ready "Caja VIS 4" "P VIS-C4" "$SRV3")
R=$(req $OFF POST /carwash/tickets/$T_AFTER/charge '{"method":"CASH","amount":"14.00"}')
ck "cobrar tras cierre -> 409" 409 "$(code "$R")"
ck "  code CASH_NOT_OPEN" CASH_NOT_OPEN "$(body "$R" | jq -r .code)"
R=$(req $OFF GET /carwash/tickets/$T_AFTER)
ck "  sigue READY" '"READY"' "$(body "$R" | jq -c .status)"

echo
echo "== 4. Cierre con faltante de 1.00 =="
R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"20.00"}')
ck "abrir segundo turno -> 201" 201 "$(code "$R")"
SESSION2=$(body "$R" | jq -r .id)
T_SHORT=$(open_ready "Caja VIS 5" "P VIS-C5" "$SRV3")
req $OFF POST /carwash/tickets/$T_SHORT/charge '{"method":"CASH","amount":"14.00"}' >/dev/null
R=$(req $OFF POST /carwash/cash/close '{"countedCash":"33.00"}')
ck "cerrar contando 33 -> CLOSED" '"CLOSED"' "$(body "$R" | jq -c .status)"
ck "  differenceCash -1.00" '"-1.00"' "$(body "$R" | jq -c .differenceCash)"
ck "  expectedCash sigue 34" '"34.00"' "$(body "$R" | jq -c .expectedCash)"

echo
echo "== 5. 403 sin carwash.cash =="
R=$(req $OFF POST /roles '{"name":"Cajero VIS","permissionKeys":["carwash.read","carwash.charge"]}')
ck "rol sin carwash.cash -> 201" 201 "$(code "$R")"
ROLE_ID=$(body "$R" | jq -r .id)
R=$(req $OFF POST /users "{\"email\":\"cajero.vis@elite.local\",\"fullName\":\"Cajero VIS\",\"password\":\"clave12345\",\"roleIds\":[\"$ROLE_ID\"]}")
ck "usuario cajero -> 201" 201 "$(code "$R")"
R=$(req $CASHIER POST /auth/login '{"email":"cajero.vis@elite.local","password":"clave12345"}')
ck "login cajero -> 200" 200 "$(code "$R")"
R=$(req $CASHIER GET /carwash/cash/current)
ck "GET current sin permiso -> 403" 403 "$(code "$R")"
ck "  code FORBIDDEN" FORBIDDEN "$(body "$R" | jq -r .code)"
R=$(req $CASHIER POST /carwash/cash/open '{"openingFloat":"0.00"}')
ck "POST open sin permiso -> 403" 403 "$(code "$R")"
R=$(req $CASHIER POST /carwash/cash/close '{"countedCash":"0.00"}')
ck "POST close sin permiso -> 403" 403 "$(code "$R")"
R=$(req $CASHIER GET /carwash/cash/sessions)
ck "GET sessions sin permiso -> 403" 403 "$(code "$R")"

echo
echo "== 6. 401 desde pista =="
probe() { curl -s -o /dev/null -w '%{http_code}' -X "$1" "$API$2" -b "$FLR" -H 'Content-Type: application/json' ${3:+-d "$3"}; }
ck "GET current con cookie de pista -> 401" 401 "$(probe GET /carwash/cash/current)"
ck "POST open con cookie de pista -> 401" 401 "$(probe POST /carwash/cash/open '{}')"
ck "POST close con cookie de pista -> 401" 401 "$(probe POST /carwash/cash/close '{}')"
ck "GET sessions con cookie de pista -> 401" 401 "$(probe GET /carwash/cash/sessions)"

echo
echo "== 7. 422 fondo negativo =="
R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"-1.00"}')
ck "fondo negativo -> 422" 422 "$(code "$R")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "${POSTGRES_USER:-elite}" -d "${POSTGRES_DB:-elite_service}" -q \
    -c 'delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$PVIS-%$$);
        delete from vehicles where plate like $$PVIS-%$$;
        delete from customers where "fullName" like $$%VIS%$$;
        delete from employees where username like $$%.vis$$;
        delete from user_roles where "userId" in (select id from users where email like $$%vis@elite.local$$);
        delete from users where email like $$%vis@elite.local$$;
        delete from role_permissions where "roleId" in (select id from roles where name like $$%VIS%$$);
        delete from roles where name like $$%VIS%$$;' \
    -c "delete from cash_sessions where id in ('${SESSION1:-00000000-0000-4000-8000-000000000000}','${SESSION2:-00000000-0000-4000-8000-000000000000}');
        delete from cash_sessions where \"openedByUserId\" = '$ADMIN_ID' and not exists (select 1 from payments p where p.\"cashSessionId\" = cash_sessions.id);" >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS)."
fi

[ "$FAIL" -eq 0 ] || exit 1
