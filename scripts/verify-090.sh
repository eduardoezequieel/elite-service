#!/bin/bash
# Verificacion end-to-end de la spec 090 (frenos del ciclo del lavado).
#
# Lo que prueba y `pnpm test` no puede: el unico parcial de la base (un lavado
# sin cobrar por carro) contra Postgres de verdad, y los 409 a traves de HTTP,
# guards y filtro de errores.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-090.sh
#
# Crea un empleado, un carro y dos lavados (los deja anulados) y, si no hay
# ninguno activo, un servicio. Al salir desactiva al empleado.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
POSTGRES_USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
POSTGRES_DB=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)
POSTGRES_USER=${POSTGRES_USER:-elite}
POSTGRES_DB=${POSTGRES_DB:-elite_service}
PASS=0; FAIL=0
RUN=$(date +%H%M%S)
AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
EMP=""

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
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$1" 2>&1 | tr -d '\r'
}

OFF=$S/office.jar

cleanup() {
  local rc=$?
  [ -n "$EMP" ] && req $OFF PATCH /employees/$EMP '{"isActive":false}' >/dev/null
  rm -rf "$S"
  exit $rc
}
trap cleanup EXIT

void_ticket() {
  req $OFF POST /carwash/tickets/$1/void "{\"reason\":\"VIS090\",$AUTH}"
}

echo "== 0. Sesion, tipo de carro, servicio y empleado =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

SEDAN=$(body "$(req $OFF GET /vehicle-body-types)" | jq -r '.[]|select(.key=="sedan").id')
SRV=$(body "$(req $OFF GET /services)" | jq -r '[.[]|select(.isActive)][0].id // empty')
if [ -z "$SRV" ]; then
  SRV_CAT=$(body "$(req $OFF GET /service-categories)" | jq -r '.[0].id')
  SRV=$(body "$(req $OFF POST /services "{\"name\":\"Lavado VIS090 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"10.00\"}")" | jq -r .id)
fi
ck "hay un servicio activo" true "$([ -n "$SRV" ] && [ "$SRV" != null ] && echo true || echo false)"

R=$(req $OFF POST /employees "{\"fullName\":\"Carlos VIS090\",\"username\":\"carlos.vis090.$RUN\",\"pin\":\"9$RUN\"}")
ck "empleado nuevo -> 201" 201 "$(code "$R")"
EMP=$(body "$R" | jq -r .id)

echo
echo "== 1. Un carro, un lavado sin cobrar =="
PLATE="P90$RUN"
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"$PLATE\",\"bodyTypeId\":\"$SEDAN\"},\"employeeId\":\"$EMP\",\"items\":[{\"serviceId\":\"$SRV\"}]}")
ck "primer lavado -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r .id)
VEH=$(body "$R" | jq -r .vehicle.id)

R=$(req $OFF POST /carwash/tickets "{\"vehicleId\":\"$VEH\",\"items\":[{\"serviceId\":\"$SRV\"}]}")
ck "segundo por vehicleId -> 409 VEHICLE_HAS_ACTIVE_TICKET" "409 VEHICLE_HAS_ACTIVE_TICKET" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  details.ticketId es el primero" "$T1" "$(body "$R" | jq -r .details.ticketId)"

R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"$PLATE\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")
ck "segundo por placa -> 409 VEHICLE_HAS_ACTIVE_TICKET" "409 VEHICLE_HAS_ACTIVE_TICKET" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  sigue habiendo uno solo" 1 "$(sql "SELECT count(*) FROM work_orders WHERE \"vehicleId\" = '$VEH'")"

OUT=$(sql "INSERT INTO work_orders (id, number, area, status, \"vehicleId\", \"bodyTypeId\", \"updatedAt\") VALUES (gen_random_uuid(), 'VIS090-$RUN', 'CARWASH', 'OPEN', '$VEH', '$SEDAN', now())")
ck "la base rechaza un segundo OPEN del mismo carro" true "$(echo "$OUT" | grep -q 'work_orders_one_active_per_vehicle' && echo true || echo false)"
sql "DELETE FROM work_orders WHERE number = 'VIS090-$RUN'" >/dev/null

echo
echo "== 4. Desactivar a quien tiene lavados sin terminar =="
R=$(req $OFF PATCH /employees/$EMP '{"isActive":false}')
ck "baja del empleado -> 409 EMPLOYEE_HAS_ACTIVE_TICKETS" "409 EMPLOYEE_HAS_ACTIVE_TICKETS" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  sigue activo" t "$(sql "SELECT \"isActive\" FROM employees WHERE id = '$EMP'")"

echo
echo "== 5. Desactivar un carro con lavado sin cobrar =="
R=$(req $OFF PATCH /vehicles/$VEH '{"isActive":false}')
ck "baja del carro -> 409 VEHICLE_HAS_ACTIVE_TICKET" "409 VEHICLE_HAS_ACTIVE_TICKET" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  sigue activo" t "$(sql "SELECT \"isActive\" FROM vehicles WHERE id = '$VEH'")"

echo
echo "== 3. Un lavado anulado ya no cambia de estado =="
R=$(void_ticket $T1)
ck "anular el primero -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"OPEN"}')
ck "pasarlo a cola -> 409 TICKET_STATUS_LOCKED" "409 TICKET_STATUS_LOCKED" "$(code "$R") $(body "$R" | jq -r .code)"

echo
echo "== 1b. Anulado el primero, el carro se vuelve a anotar =="
R=$(req $OFF POST /carwash/tickets "{\"vehicleId\":\"$VEH\",\"items\":[{\"serviceId\":\"$SRV\"}]}")
ck "otro lavado del mismo carro -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r .id)
R=$(void_ticket $T2)
ck "anular el segundo -> 200" 200 "$(code "$R")"

R=$(req $OFF PATCH /employees/$EMP '{"isActive":false}')
ck "sin lavados pendientes, el empleado se desactiva -> 200" 200 "$(code "$R")"
EMP=""

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
