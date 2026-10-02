#!/bin/bash
# Verificacion end-to-end de la spec 073 (correlativos que no se rompen en el 9999).
#
# Lo que prueba y `pnpm test` no puede: que el ultimo correlativo se elija en
# Postgres por largo y despues por texto. Se siembran a mano `X-9999` y
# `X-10000` en cada serie —lavado, cobro, venta, servicio y articulo— y el alta
# por HTTP tiene que dar `X-10001`: ordenando solo por texto daria `X-10000`,
# chocaria con el unique y responderia 500.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-073.sh
#
# Al salir (pase o falle) borra las filas sembradas y saca de la serie lo que
# creo esta corrida —anula cobros y lavados, desactiva servicio y articulo y
# les cambia el folio a `VIS073-...`—, para que la serie real siga donde estaba.
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

ADMIN_AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
OFF=$S/office.jar
rm -f "$OFF"

# Lo que hay que limpiar al salir. Los ids se van llenando a medida que se crean.
# Las filas sembradas van a un archivo ("tabla id" por linea) y no a una
# variable: se siembran dentro de `$(...)`, que es un subshell.
SEEDED=$S/seeded
: > "$SEEDED"
PRIMER=""; TICKET=""; CHARGE=""; SALE=""; SALE_CHARGE=""; SRV=""; ITEM=""

cleanup() {
  local rc=$? table id
  [ -n "$CHARGE" ] && req $OFF POST /carwash/charges/$CHARGE/void "{\"reason\":\"Limpieza VIS073\",$ADMIN_AUTH}" >/dev/null
  [ -n "$SALE" ] && req $OFF POST /sales/$SALE/void "{\"reason\":\"Limpieza VIS073\",$ADMIN_AUTH}" >/dev/null
  for id in $TICKET $PRIMER; do
    req $OFF POST /carwash/tickets/$id/void "{\"reason\":\"Limpieza VIS073\",$ADMIN_AUTH}" >/dev/null
  done
  [ -n "$SRV" ] && req $OFF PATCH /services/$SRV '{"isActive":false}' >/dev/null
  [ -n "$ITEM" ] && req $OFF PATCH /inventory/items/$ITEM '{"isActive":false}' >/dev/null

  while read -r table id; do
    sql "DELETE FROM $table WHERE id = '$id'" >/dev/null
  done < "$SEEDED"
  # Fuera de la serie: el siguiente alta real vuelve a salir de donde estaba.
  [ -n "$TICKET" ] && sql "UPDATE work_orders SET number = 'VIS073-$RUN-CW' WHERE id = '$TICKET'" >/dev/null
  [ -n "$SALE" ] && sql "UPDATE counter_sales SET number = 'VIS073-$RUN-V' WHERE id = '$SALE'" >/dev/null
  [ -n "$SRV" ] && sql "UPDATE services SET code = 'VIS073-$RUN-SRV' WHERE id = '$SRV'" >/dev/null
  [ -n "$ITEM" ] && sql "UPDATE inventory_items SET code = 'VIS073-$RUN-INV' WHERE id = '$ITEM'" >/dev/null
  # Un cobro anulado se borra (066 RN-22); si alguno quedo, tambien sale de la serie.
  for id in $CHARGE $SALE_CHARGE; do
    sql "UPDATE charges SET number = 'VIS073-$RUN-' || number WHERE id = '$id'" >/dev/null
  done
  rm -rf "$S"
  exit $rc
}
trap cleanup EXIT

# Siembra una fila y la anota para borrarla al salir. $1 tabla, $2 INSERT ... RETURNING id.
seed() {
  local id
  id=$(sql "$2" | head -1)
  [ -n "$id" ] && echo "$1 $id" >> "$SEEDED"
  echo "$id"
}
# Siembra X-9999 y X-10000 en una serie; imprime cuantas filas entraron.
seed_pair() {
  local table=$1 insert=$2 prefix=$3 n=0 value
  for value in "$prefix-9999" "$prefix-10000"; do
    [ -n "$(seed "$table" "${insert//@@/$value}")" ] && n=$((n+1))
  done
  echo $n
}

echo "== 0. Sesion, caja y series sin restos de otra corrida =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
case "$(code "$R")" in 200|201|409) echo "  caja lista";; *) echo "  AVISO: abrir caja devolvio $(code "$R")";; esac
CASH_ID=$(body "$(req $OFF GET /carwash/cash/current)" | jq -r '.id')

ck "ningun folio de 5+ digitos en las cinco series" 0 "$(sql "SELECT
  (SELECT count(*) FROM work_orders WHERE number ~ '^CW-[0-9]{5,}$')
  + (SELECT count(*) FROM charges WHERE number ~ '^C-[0-9]{5,}$')
  + (SELECT count(*) FROM counter_sales WHERE number ~ '^V-[0-9]{5,}$')
  + (SELECT count(*) FROM services WHERE code ~ '^SRV-[0-9]{5,}$')
  + (SELECT count(*) FROM inventory_items WHERE code ~ '^INV-[0-9]{5,}$')")"

SEDAN=$(body "$(req $OFF GET /vehicle-body-types)" | jq -r '.[]|select(.key=="sedan").id')
SRV_CAT=$(body "$(req $OFF GET "/service-categories?pageSize=100")" | jq -r '.items[0].id')

echo
echo "== 1. Servicio: SRV-9999 y SRV-10000 sembrados -> SRV-10001 =="
ck "  sembrados" 2 "$(seed_pair services "INSERT INTO services (id, code, name, \"categoryId\", area, \"defaultPrice\", \"isActive\", \"updatedAt\") VALUES (gen_random_uuid(), '@@', 'Semilla VIS073 $RUN @@', '$SRV_CAT', 'CARWASH', 0, false, now()) RETURNING id" SRV)"
R=$(req $OFF POST /services "{\"name\":\"Lavado VIS073 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"10.00\"}")
ck "alta de servicio -> 201 SRV-10001" "201 SRV-10001" "$(code "$R") $(body "$R" | jq -r .code)"
SRV=$(body "$R" | jq -r '.id // empty')

echo
echo "== 2. Articulo: INV-9999 y INV-10000 sembrados -> INV-10001 =="
ck "  sembrados" 2 "$(seed_pair inventory_items "INSERT INTO inventory_items (id, code, name, kind, \"isActive\", \"updatedAt\") VALUES (gen_random_uuid(), '@@', 'Semilla VIS073 $RUN @@', 'PRODUCT', false, now()) RETURNING id" INV)"
R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Cera VIS073 $RUN\",\"price\":\"3.00\"}")
ck "alta de articulo -> 201 INV-10001" "201 INV-10001" "$(code "$R") $(body "$R" | jq -r .code)"
ITEM=$(body "$R" | jq -r '.id // empty')
req $OFF POST /inventory/items/$ITEM/entries '{"quantity":"5"}' >/dev/null

echo
echo "== 3. Lavado: CW-9999 y CW-10000 sembrados -> CW-10001 =="
ticket_body() { echo "{\"customer\":{\"fullName\":\"Cliente VIS073\"},\"vehicle\":{\"plate\":\"P73$RUN$1\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}"; }
# Un lavado normal primero: deja el carro del que cuelgan las filas sembradas.
R=$(req $OFF POST /carwash/tickets "$(ticket_body 0)")
ck "lavado previo -> 201" 201 "$(code "$R")"
PRIMER=$(body "$R" | jq -r '.id // empty')
ck "  sembrados (en VOID, fuera del tablero)" 2 "$(seed_pair work_orders "INSERT INTO work_orders (id, number, area, status, \"vehicleId\", \"bodyTypeId\", \"updatedAt\") SELECT gen_random_uuid(), '@@', area, 'VOID', \"vehicleId\", \"bodyTypeId\", now() FROM work_orders WHERE id = '$PRIMER' RETURNING id" CW)"
R=$(req $OFF POST /carwash/tickets "$(ticket_body 1)")
ck "alta de lavado -> 201 CW-10001" "201 CW-10001" "$(code "$R") $(body "$R" | jq -r .number)"
TICKET=$(body "$R" | jq -r '.id // empty')
R=$(req $OFF POST /carwash/tickets/$TICKET/status '{"status":"READY"}')
ck "  listo para cobrar -> 200" 200 "$(code "$R")"

echo
echo "== 4. Cobro: C-9999 y C-10000 sembrados -> C-10001 =="
ck "  sembrados" 2 "$(seed_pair charges "INSERT INTO charges (id, number, total, \"chargedByUserId\", \"cashSessionId\") VALUES (gen_random_uuid(), '@@', 0, '$ADMIN_ID', '$CASH_ID') RETURNING id" C)"
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$TICKET\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"10.00\"}]}")
ck "cobrar el lavado -> 201 C-10001" "201 C-10001" "$(code "$R") $(body "$R" | jq -r .number)"
CHARGE=$(body "$R" | jq -r '.id // empty')

echo
echo "== 5. Venta: V-9999 y V-10000 sembrados -> V-10001 (y su cuenta C-10002) =="
ck "  sembrados (en VOID)" 2 "$(seed_pair counter_sales "INSERT INTO counter_sales (id, number, status, total, \"createdByUserId\") VALUES (gen_random_uuid(), '@@', 'VOID', 0, '$ADMIN_ID') RETURNING id" V)"
R=$(req $OFF POST /sales "{\"items\":[{\"inventoryItemId\":\"$ITEM\",\"quantity\":\"1\"}],\"payments\":[{\"method\":\"CASH\",\"amount\":\"3.00\"}]}")
ck "venta suelta -> 201 V-10001" "201 V-10001" "$(code "$R") $(body "$R" | jq -r .number)"
SALE=$(body "$R" | jq -r '.id // empty')
SALE_CHARGE=$(sql "SELECT \"chargeId\" FROM counter_sales WHERE id = '$SALE'")
ck "  su cuenta sigue la serie de cobros" "C-10002" "$(sql "SELECT number FROM charges WHERE id = '$SALE_CHARGE'")"

echo
echo "== 6. Los folios sembrados siguen tal cual (Always: no se renumera) =="
ck "  las ocho filas sembradas intactas" 8 "$(sql "SELECT
  (SELECT count(*) FROM work_orders WHERE number IN ('CW-9999','CW-10000'))
  + (SELECT count(*) FROM charges WHERE number IN ('C-9999','C-10000'))
  + (SELECT count(*) FROM counter_sales WHERE number IN ('V-9999','V-10000'))
  + (SELECT count(*) FROM services WHERE code IN ('SRV-9999','SRV-10000'))")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
