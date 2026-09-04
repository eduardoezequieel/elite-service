#!/bin/bash
# Verificacion end-to-end de la spec 014 (carwash: buscar lavado y ver otro dia).
#
# Recorre los criterios de aceptacion contra un stack levantado: base sembrada,
# API en marcha. Prueba el sistema armado —Prisma, guards, cookies, HTTP.
#
# Uso:
#   docker compose up -d && pnpm dev
#   bash scripts/verify-014.sh
#
# Crea empleado, clientes, vehiculos y tickets con sufijo V14 y los borra al
# terminar.
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

echo "== 0. Preparacion =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

# Asegurar permisos en el rol del admin
ROLE_ID=$(body "$R" | jq -r '.user.roles[0].id')
if [ -n "$ROLE_ID" ] && [ "$ROLE_ID" != "null" ]; then
  RR=$(req $OFF GET /roles)
  KEYS=$(body "$RR" | jq -c --arg id "$ROLE_ID" '.[] | select(.id==$id) | (.permissionKeys + ["carwash.read","carwash.manage","carwash.charge"]) | unique')
  if [ -n "$KEYS" ] && [ "$KEYS" != "null" ]; then
    req $OFF PATCH /roles/$ROLE_ID "{\"permissionKeys\":$KEYS}" >/dev/null
  fi
fi

R=$(req $OFF POST /employees '{"fullName":"Lavador V14","username":"lavador.v14","pin":"1234"}')
ck "alta de empleado -> 201" 201 "$(code "$R")"

R=$(req $FLR POST /floor/login '{"username":"lavador.v14","pin":"1234"}')
ck "login de pista -> 200" 200 "$(code "$R")"

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET /services)
SRV1=$(body "$R" | jq -r '.[0].id')

TODAY=$(node -e "console.log(new Date().toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' }))")
YESTERDAY=$(node -e "const d = new Date(); d.setDate(d.getDate() - 1); console.log(d.toLocaleDateString('en-CA', { timeZone: 'America/El_Salvador' }))")

echo
echo "== 1. Alta de tres lavados para la prueba (hoy: $TODAY) =="
R1=$(req $OFF POST /carwash/tickets "{
  \"customer\": {\"fullName\":\"Pedro V14\"},
  \"vehicle\": {\"plate\":\"P V14-101\",\"bodyTypeId\":\"$SEDAN\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "alta lavado 1 -> 201" 201 "$(code "$R1")"
T1_ID=$(body "$R1" | jq -r .id)
T1_NUM=$(body "$R1" | jq -r .number)

R2=$(req $OFF POST /carwash/tickets "{
  \"customer\": {\"fullName\":\"Luisa V14\"},
  \"vehicle\": {\"plate\":\"P V14-202\",\"bodyTypeId\":\"$SEDAN\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "alta lavado 2 -> 201" 201 "$(code "$R2")"
T2_ID=$(body "$R2" | jq -r .id)
T2_NUM=$(body "$R2" | jq -r .number)

R3=$(req $OFF POST /carwash/tickets "{
  \"customer\": {\"fullName\":\"Marcos V14\"},
  \"vehicle\": {\"plate\":\"P V14-303\",\"bodyTypeId\":\"$SEDAN\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "alta lavado 3 -> 201" 201 "$(code "$R3")"
T3_ID=$(body "$R3" | jq -r .id)
T3_NUM=$(body "$R3" | jq -r .number)

echo
echo "== 2. Busqueda en /carwash/tickets =="

# 2.1 Búsqueda por placa parcial
R=$(req $OFF GET "/carwash/tickets?q=101")
ck "GET /carwash/tickets?q=101 -> 200" 200 "$(code "$R")"
COUNT=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  encuentra solo el ticket de placa 101" 1 "$COUNT"
PLATE=$(body "$R" | jq -r '[.[] | select(.customer.fullName | contains("V14"))][0].vehicle.plate')
ck "  placa es PV14-101" "PV14-101" "$PLATE"

# 2.2 Búsqueda por número de referencia
R=$(req $OFF GET "/carwash/tickets?q=$T2_NUM")
ck "GET /carwash/tickets?q=$T2_NUM -> 200" 200 "$(code "$R")"
NUM_FOUND=$(body "$R" | jq -r '[.[] | select(.id=="'"$T2_ID"'")][0].number')
ck "  encuentra ticket por folio exacto" "$T2_NUM" "$NUM_FOUND"

# Búsqueda por número sin prefijo (ej: 0002 o correlativo)
T2_SEQ=$(node -e "const n = '$T2_NUM'; console.log(n.slice(n.indexOf('-') + 1));")
R=$(req $OFF GET "/carwash/tickets?q=$T2_SEQ")
ck "GET /carwash/tickets?q=$T2_SEQ -> 200" 200 "$(code "$R")"
HAS_T2=$(body "$R" | jq '[.[] | select(.id=="'"$T2_ID"'")] | length')
ck "  encuentra ticket por correlativo parcial" 1 "$HAS_T2"

# 2.3 Búsqueda por nombre de cliente
R=$(req $OFF GET "/carwash/tickets?q=Marcos")
ck "GET /carwash/tickets?q=Marcos -> 200" 200 "$(code "$R")"
COUNT=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  encuentra solo el ticket de Marcos" 1 "$COUNT"
NAME=$(body "$R" | jq -r '[.[] | select(.customer.fullName | contains("V14"))][0].customer.fullName')
ck "  nombre es Marcos V14" "Marcos V14" "$NAME"

# Case-insensitive
R=$(req $OFF GET "/carwash/tickets?q=marcos")
COUNT_CI=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  insensible a mayusculas (marcos)" 1 "$COUNT_CI"

echo
echo "== 3. Filtro de fecha en /carwash/tickets =="

# Ayer: debe devolver vacio para estos tickets
R=$(req $OFF GET "/carwash/tickets?date=$YESTERDAY")
ck "GET /carwash/tickets?date=$YESTERDAY -> 200" 200 "$(code "$R")"
Y_COUNT=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  ayer no tiene ningun ticket V14" 0 "$Y_COUNT"

# Hoy: debe devolver los tres
R=$(req $OFF GET "/carwash/tickets?date=$TODAY")
ck "GET /carwash/tickets?date=$TODAY -> 200" 200 "$(code "$R")"
T_COUNT=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  hoy devuelve los tres tickets V14" 3 "$T_COUNT"

# Fecha de hoy + q: debe combinarse
R=$(req $OFF GET "/carwash/tickets?date=$TODAY&q=Pedro")
ck "GET /carwash/tickets?date=$TODAY&q=Pedro -> 200" 200 "$(code "$R")"
COMBINED_COUNT=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  hoy + q=Pedro devuelve 1 ticket" 1 "$COMBINED_COUNT"

echo
echo "== 4. Busqueda en pista /floor/tickets?q= =="
R=$(req $FLR GET "/floor/tickets?q=101")
ck "GET /floor/tickets?q=101 -> 200" 200 "$(code "$R")"
FLR_COUNT=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  pista encuentra placa 101" 1 "$FLR_COUNT"

R=$(req $FLR GET "/floor/tickets?q=Luisa")
ck "GET /floor/tickets?q=Luisa -> 200" 200 "$(code "$R")"
FLR_LUISA=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  pista encuentra cliente Luisa" 1 "$FLR_LUISA"

R=$(req $FLR GET "/floor/tickets?q=InexistenteV14")
ck "GET /floor/tickets?q=InexistenteV14 -> 200" 200 "$(code "$R")"
FLR_NONE=$(body "$R" | jq '[.[] | select(.customer.fullName | contains("V14"))] | length')
ck "  pista busqueda sin coincidencias -> 0" 0 "$FLR_NONE"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

# Limpieza: nada con sufijo V14 debe quedar en la base.
if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "${POSTGRES_USER:-elite}" -d "${POSTGRES_DB:-elite_service}" -q \
    -c 'delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%V14%$$));
        delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%V14%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%V14%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%V14%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%V14%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$PV14-%$$);
        delete from vehicles where plate like $$PV14-%$$;
        delete from customers where "fullName" like $$%V14%$$;
        delete from employees where username like $$%.v14$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo V14)."
fi

[ "$FAIL" -eq 0 ] || exit 1
