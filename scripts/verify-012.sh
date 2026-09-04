#!/bin/bash
# Verificacion end-to-end de la spec 012 (integridad del vehiculo en el alta).
#
# Recorre los criterios de aceptacion contra un stack levantado: base sembrada,
# API en marcha. Prueba el sistema armado —Prisma, los dos guards, las dos
# cookies, el HTTP— que es lo que `pnpm test` no puede hacer con repositorios en
# memoria.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-012.sh
#
# Crea empleado, clientes, vehiculos y tickets con sufijo VIS y los borra al
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

OFF=$S/office.jar; FLR=$S/floor.jar; ANON=$S/anon.jar
rm -f "$OFF" "$FLR" "$ANON"

echo "== 0. Preparacion =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

# Empleado de pista
R=$(req $OFF POST /employees '{"fullName":"Lavador VIS 12","username":"lavador12.vis","pin":"1234"}')
if [ "$(code "$R")" = "201" ]; then
  ck "alta de empleado de pista -> 201" 201 201
else
  ck "reutiliza empleado de pista" 200 200
fi

R=$(req $FLR POST /floor/login '{"username":"lavador12.vis","pin":"1234"}')
ck "login de pista -> 200" 200 "$(code "$R")"

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
SUV=$(body "$R" | jq -r '.[]|select(.key=="suv").id')
R=$(req $OFF GET /services)
SRV1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").id')

R=$(req $OFF POST /customers '{"fullName":"Dueno Original VIS","phone":"7777-1201"}')
ck "alta dueno original -> 201" 201 "$(code "$R")"
CUST1_ID=$(body "$R" | jq -r .id)

R=$(req $OFF POST /customers '{"fullName":"Dueno Nuevo VIS","phone":"7777-1202"}')
ck "alta dueno nuevo -> 201" 201 "$(code "$R")"
CUST2_ID=$(body "$R" | jq -r .id)

echo
echo "== 1. Camino 1: Alta con placa nueva =="
R=$(req $FLR POST /floor/tickets "{
  \"customerId\": \"$CUST1_ID\",
  \"vehicle\": {
    \"plate\": \"P VIS-912\",
    \"bodyTypeId\": \"$SEDAN\",
    \"make\": \"Toyota\",
    \"color\": \"Rojo\"
  },
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "alta con placa nueva -> 201" 201 "$(code "$R")"
T1_ID=$(body "$R" | jq -r .id)
VEHICLE_ID=$(body "$R" | jq -r .vehicle.id)
ck "  placa normalizada" '"PVIS-912"' "$(body "$R" | jq -c .vehicle.plate)"

R=$(req $OFF GET "/vehicles?q=PVIS-912")
ck "  vehiculo registrado en catalogo" 1 "$(body "$R" | jq 'length')"
ck "  marca guardada" '"Toyota"' "$(body "$R" | jq -c '.[0].make')"
ck "  color guardado" '"Rojo"' "$(body "$R" | jq -c '.[0].color')"
ck "  tipo de carro guardado" "\"$SEDAN\"" "$(body "$R" | jq -c '.[0].bodyType.id')"
ck "  dueno actual es el original" "\"$CUST1_ID\"" "$(body "$R" | jq -c '.[0].currentOwner.id')"

echo
echo "== 2. Camino 3: Placa conocida sin vehicleId -> 409 VEHICLE_PLATE_EXISTS =="
R=$(req $FLR POST /floor/tickets "{
  \"customerId\": \"$CUST2_ID\",
  \"vehicle\": {
    \"plate\": \"PVIS-912\",
    \"bodyTypeId\": \"$SUV\",
    \"make\": \"Nissan\",
    \"color\": \"Azul\"
  },
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "pista: placa conocida sin vehicleId -> 409" 409 "$(code "$R")"
ck "  code VEHICLE_PLATE_EXISTS" VEHICLE_PLATE_EXISTS "$(body "$R" | jq -r .code)"
ck "  details incluye el vehiculo existente" "\"$VEHICLE_ID\"" "$(body "$R" | jq -c .details.vehicle.id)"

R=$(req $OFF POST /carwash/tickets "{
  \"customerId\": \"$CUST2_ID\",
  \"vehicle\": {
    \"plate\": \"PVIS-912\",
    \"bodyTypeId\": \"$SUV\",
    \"make\": \"Nissan\",
    \"color\": \"Azul\"
  },
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "oficina: placa conocida sin vehicleId -> 409" 409 "$(code "$R")"
ck "  code VEHICLE_PLATE_EXISTS" VEHICLE_PLATE_EXISTS "$(body "$R" | jq -r .code)"
ck "  details incluye el vehiculo existente" "\"$VEHICLE_ID\"" "$(body "$R" | jq -c .details.vehicle.id)"

# Verificar que la ficha y el dueno NO cambiaron
R=$(req $OFF GET "/vehicles?q=PVIS-912")
ck "  ficha intacta: marca sigue siendo Toyota" '"Toyota"' "$(body "$R" | jq -c '.[0].make')"
ck "  ficha intacta: color sigue siendo Rojo" '"Rojo"' "$(body "$R" | jq -c '.[0].color')"
ck "  ficha intacta: tipo sigue siendo sedan" "\"$SEDAN\"" "$(body "$R" | jq -c '.[0].bodyType.id')"
ck "  dueno intacto: sigue siendo el original" "\"$CUST1_ID\"" "$(body "$R" | jq -c '.[0].currentOwner.id')"

echo
echo "== 3. Camino 2: Placa conocida con vehicleId =="
R=$(req $FLR POST /floor/tickets "{
  \"customerId\": \"$CUST2_ID\",
  \"vehicleId\": \"$VEHICLE_ID\",
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "pista: alta mandando vehicleId -> 201" 201 "$(code "$R")"
ck "  ticket usa el vehiculo conocido" "\"$VEHICLE_ID\"" "$(body "$R" | jq -c .vehicle.id)"
ck "  tipo de carro resuelto de la ficha conocida" "\"$SEDAN\"" "$(body "$R" | jq -c .bodyType.id)"

R=$(req $OFF POST /carwash/tickets "{
  \"customerId\": \"$CUST1_ID\",
  \"vehicleId\": \"$VEHICLE_ID\",
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "oficina: alta mandando vehicleId -> 201" 201 "$(code "$R")"
ck "  ticket usa el vehiculo conocido" "\"$VEHICLE_ID\"" "$(body "$R" | jq -c .vehicle.id)"

# Ficha del vehiculo sigue intacta (no fue sobreescrita por el ticket)
R=$(req $OFF GET "/vehicles?q=PVIS-912")
ck "  ficha del vehiculo no fue alterada: marca Toyota" '"Toyota"' "$(body "$R" | jq -c '.[0].make')"
ck "  ficha del vehiculo no fue alterada: color Rojo" '"Rojo"' "$(body "$R" | jq -c '.[0].color')"
ck "  ficha del vehiculo no fue alterada: tipo sedan" "\"$SEDAN\"" "$(body "$R" | jq -c '.[0].bodyType.id')"
ck "  dueno del vehiculo no fue alterado" "\"$CUST1_ID\"" "$(body "$R" | jq -c '.[0].currentOwner.id')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

# Limpieza: nada con sufijo VIS debe quedar en la base.
if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "${POSTGRES_USER:-elite}" -d "${POSTGRES_DB:-elite_service}" -q \
    -c 'delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$PVIS-%$$);
        delete from vehicles where plate like $$PVIS-%$$;
        delete from customers where "fullName" like $$%VIS%$$;
        delete from employees where username like $$%.vis$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS)."
fi

[ "$FAIL" -eq 0 ] || exit 1
