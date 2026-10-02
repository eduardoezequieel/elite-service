#!/bin/bash
# Verificacion end-to-end de la spec 079 (alta de lavado atomica).
#
# Lo que prueba y `pnpm test` no puede: que cliente, vehiculo y lavado vivan en
# la misma transaccion de Postgres. Un alta con cliente nuevo, placa nueva y un
# producto sin existencia tiene que responder 409 y dejar las tablas de
# clientes y vehiculos exactamente como estaban.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-079.sh
#
# Crea un producto sin existencia (y un servicio si no hay ninguno activo) y
# los borra al salir: el alta que falla no los referencia.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
POSTGRES_USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
# Base del API bajo prueba: la de DATABASE_URL si esta exportada; si no, la del .env.
POSTGRES_DB=${DATABASE_URL:+$(echo "$DATABASE_URL" | sed -E 's#^[^/]*//[^/]*/([^?]*).*#\1#')}
POSTGRES_DB=${POSTGRES_DB:-$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)}
POSTGRES_USER=${POSTGRES_USER:-elite}
POSTGRES_DB=${POSTGRES_DB:-elite_service}
PASS=0; FAIL=0
RUN=$(date +%H%M%S)
ITEM=""; SRV_CREATED=""

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

cleanup() {
  local rc=$?
  [ -n "$ITEM" ] && sql "DELETE FROM inventory_items WHERE id = '$ITEM'" >/dev/null
  [ -n "$SRV_CREATED" ] && sql "DELETE FROM services WHERE id = '$SRV_CREATED'" >/dev/null
  rm -rf "$S"
  exit $rc
}
trap cleanup EXIT

OFF=$S/office.jar

echo "== 0. Sesion, tipo de carro, servicio y producto sin existencia =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

SEDAN=$(body "$(req $OFF GET /vehicle-body-types)" | jq -r '.[]|select(.key=="sedan").id')
ck "hay tipo sedan" true "$([ -n "$SEDAN" ] && echo true || echo false)"

SRV=$(body "$(req $OFF GET "/services?pageSize=100")" | jq -r '[.items[]|select(.isActive)][0].id // empty')
if [ -z "$SRV" ]; then
  SRV_CAT=$(body "$(req $OFF GET "/service-categories?pageSize=100")" | jq -r '.items[0].id')
  SRV=$(body "$(req $OFF POST /services "{\"name\":\"Lavado VIS079 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"10.00\"}")" | jq -r .id)
  SRV_CREATED=$SRV
fi
ck "hay un servicio activo" true "$([ -n "$SRV" ] && [ "$SRV" != null ] && echo true || echo false)"

R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Cera VIS079 $RUN\",\"price\":\"3.00\"}")
ck "producto nuevo -> 201" 201 "$(code "$R")"
ITEM=$(body "$R" | jq -r .id)
ck "  sin existencia" "0.000" "$(body "$(req $OFF GET /inventory/items/$ITEM)" | jq -r .stockOnHand)"

echo
echo "== 1. Alta con cliente y placa nuevos que el kardex rechaza =="
PLATE="P79$RUN"
CUSTOMERS_BEFORE=$(sql "SELECT count(*) FROM customers")
VEHICLES_BEFORE=$(sql "SELECT count(*) FROM vehicles")
OWNERS_BEFORE=$(sql "SELECT count(*) FROM vehicle_owners")
TICKETS_BEFORE=$(sql "SELECT count(*) FROM work_orders")

R=$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS079 $RUN\"},\"vehicle\":{\"plate\":\"$PLATE\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"},{\"inventoryItemId\":\"$ITEM\",\"quantity\":\"1\"}]}")
ck "alta -> 409 INSUFFICIENT_STOCK" "409 INSUFFICIENT_STOCK" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  clientes sin cambios" "$CUSTOMERS_BEFORE" "$(sql "SELECT count(*) FROM customers")"
ck "  vehiculos sin cambios" "$VEHICLES_BEFORE" "$(sql "SELECT count(*) FROM vehicles")"
ck "  filas de propiedad sin cambios" "$OWNERS_BEFORE" "$(sql "SELECT count(*) FROM vehicle_owners")"
ck "  lavados sin cambios" "$TICKETS_BEFORE" "$(sql "SELECT count(*) FROM work_orders")"
ck "  la placa no quedo tomada" 0 "$(sql "SELECT count(*) FROM vehicles WHERE plate = '$PLATE'")"
ck "  el cliente no quedo" 0 "$(sql "SELECT count(*) FROM customers WHERE \"fullName\" = 'Cliente VIS079 $RUN'")"
ck "  el producto no tiene movimientos" 0 "$(sql "SELECT count(*) FROM inventory_movements WHERE \"itemId\" = '$ITEM'")"

echo
echo "== 2. Datos faltantes: 422 antes de escribir =="
R=$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS079 $RUN\"},\"vehicle\":{\"plate\":\"$PLATE\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")
ck "placa sin tipo -> 422 TICKET_INCOMPLETE" "422 TICKET_INCOMPLETE" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  clientes sin cambios" "$CUSTOMERS_BEFORE" "$(sql "SELECT count(*) FROM customers")"
ck "  vehiculos sin cambios" "$VEHICLES_BEFORE" "$(sql "SELECT count(*) FROM vehicles")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
