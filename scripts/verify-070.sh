#!/bin/bash
# Verificacion end-to-end de la spec 070 (consumo de empleados: lo que toman de
# la refrigeradora, sin cobrarse).
#
# Lo que prueba y `pnpm test` no puede: la migracion (tipos nuevos del enum,
# `unitPrice`, `reversesMovementId` unico), que el precio se congele desde la
# fila bloqueada, que el indice unico frene la segunda anulacion, que los guards
# rechacen la sesion de pista, que no se escriba ningun cobro ni pago, y el
# reporte del mes agrupado en hora de El Salvador contra la base.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-070.sh
#
# Corre sobre una base con datos: el reporte del mes trae tambien a quien
# consumio en otras corridas, asi que se miran las filas de los empleados que
# crea esta corrida, no el total general.
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
RUN=$(date +%H%M%S)
# PIN fijo del empleado de pista de esta verificacion. Los PINs son unicos en
# todo el taller (044 RN-3): no repite los de los otros verify-*.sh.
FLOOR_PIN=700070
NO_UUID=00000000-0000-4000-8000-000000000000

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

OFF=$S/office.jar; FLR=$S/floor.jar
rm -f "$OFF" "$FLR"

stock_of() { body "$(req $OFF GET /inventory/items/$1)" | jq -r .stockOnHand; }
# Fila de un empleado en el reporte del mes: "unidades total" o "none".
row_of() { echo "$1" | jq -r --arg e "$2" '[.rows[]|select(.employee.id==$e)][0] // {} | if .units then .units + " " + .total else "none" end'; }

# Crea un empleado con un PIN al azar (reintenta si choca) e imprime su id.
new_employee() {
  local name=$1 user=$2 i pin R
  for i in 1 2 3 4 5; do
    pin=$(printf '%06d' $(( (RANDOM * 32768 + RANDOM) % 1000000 )))
    R=$(req $OFF POST /employees "{\"fullName\":\"$name\",\"username\":\"$user\",\"pin\":\"$pin\"}")
    if [ "$(code "$R")" = "201" ]; then body "$R" | jq -r .id; return; fi
  done
  echo ""
}

echo "== 0. Migracion y sesion de oficina =="
ck "migracion 20260926220000_employee_consumption aplicada" 1 \
  "$(sql "SELECT count(*) FROM _prisma_migrations WHERE migration_name = '20260926220000_employee_consumption' AND finished_at IS NOT NULL")"
ck "  enum con CONSUMPTION y CONSUMPTION_RETURN" 2 \
  "$(sql "SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'InventoryMovementType' AND e.enumlabel IN ('CONSUMPTION','CONSUMPTION_RETURN')")"
ck "  columnas unitPrice y reversesMovementId" 2 \
  "$(sql "SELECT count(*) FROM information_schema.columns WHERE table_name = 'inventory_movements' AND column_name IN ('unitPrice','reversesMovementId')")"
ck "  reversesMovementId es unico" 1 \
  "$(sql "SELECT count(*) FROM pg_indexes WHERE tablename = 'inventory_movements' AND indexname = 'inventory_movements_reversesMovementId_key' AND indexdef LIKE 'CREATE UNIQUE%'")"

R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')

echo
echo "== 1. Empleados, bebidas e insumo =="
JUAN=$(new_employee "Juan VIS070 $RUN" "juan070$RUN")
ANA=$(new_employee "Ana VIS070 $RUN" "ana070$RUN")
BAJA=$(new_employee "Baja VIS070 $RUN" "baja070$RUN")
BORDE=$(new_employee "Borde VIS070 $RUN" "borde070$RUN")
ck "cuatro empleados nuevos" true "$([ -n "$JUAN" ] && [ -n "$ANA" ] && [ -n "$BAJA" ] && [ -n "$BORDE" ] && echo true || echo false)"
R=$(req $OFF PATCH /employees/$BAJA '{"isActive":false}')
ck "desactivar a Baja -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Soda VIS070 $RUN\",\"price\":\"1.25\"}")
ck "soda de \$1.25 -> 201" 201 "$(code "$R")"
SODA=$(body "$R" | jq -r .id)
R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Agua VIS070 $RUN\",\"price\":\"0.75\"}")
AGUA=$(body "$R" | jq -r .id)
R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Jugo VIS070 $RUN\",\"price\":\"1.00\"}")
JUGO=$(body "$R" | jq -r .id)
R=$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Franela VIS070 $RUN\"}")
SUP=$(body "$R" | jq -r .id)
req $OFF POST /inventory/items/$SODA/entries '{"quantity":"10"}' >/dev/null
req $OFF POST /inventory/items/$AGUA/entries '{"quantity":"10"}' >/dev/null
req $OFF POST /inventory/items/$JUGO/entries '{"quantity":"1"}' >/dev/null
req $OFF POST /inventory/items/$SUP/entries '{"quantity":"5"}' >/dev/null
ck "existencias 10 / 10 / 1 / 5" "10.000 10.000 1.000 5.000" "$(stock_of $SODA) $(stock_of $AGUA) $(stock_of $JUGO) $(stock_of $SUP)"

echo
echo "== 2. Anotar un consumo (RN-1 a RN-4) =="
CHARGES_BEFORE=$(sql "SELECT count(*) FROM charges")
PAYMENTS_BEFORE=$(sql "SELECT count(*) FROM payments")
R=$(req $OFF POST /inventory/items/$SODA/consumptions "{\"quantity\":\"2\",\"employeeId\":\"$JUAN\",\"note\":\"VIS070\"}")
ck "2 sodas a Juan -> 201" 201 "$(code "$R")"
C1=$(body "$R" | jq -r .movement.id)
ck "  CONSUMPTION -2 a \$1.25" "CONSUMPTION -2.000 1.25" "$(body "$R" | jq -r '.movement.type + " " + .movement.quantity + " " + .movement.unitPrice')"
ck "  quien tomo" "$JUAN" "$(body "$R" | jq -r .movement.employee.id)"
ck "  quien anoto" "user $ADMIN_ID" "$(body "$R" | jq -r '.movement.createdBy.kind + " " + .movement.createdBy.id')"
ck "  la nota" "VIS070" "$(body "$R" | jq -r .movement.reason)"
ck "  existencia 8" "8.000" "$(stock_of $SODA)"
ck "  no se creo ningun cobro" "$CHARGES_BEFORE" "$(sql "SELECT count(*) FROM charges")"
ck "  ni ningun pago" "$PAYMENTS_BEFORE" "$(sql "SELECT count(*) FROM payments")"
ck "  en la base: unitPrice 1.25 y employeeId" "1.25|$JUAN" "$(sql "SELECT \"unitPrice\"::text || '|' || \"employeeId\" FROM inventory_movements WHERE id = '$C1'")"

R=$(req $OFF POST /inventory/items/$AGUA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")
ck "1 agua a Juan -> 201" 201 "$(code "$R")"
R=$(req $OFF POST /inventory/items/$SODA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$ANA\"}")
ck "1 soda a Ana -> 201" 201 "$(code "$R")"

echo
echo "== 3. Lo que no se puede anotar =="
R=$(req $OFF POST /inventory/items/$JUGO/consumptions "{\"quantity\":\"2\",\"employeeId\":\"$JUAN\"}")
ck "2 jugos con 1 -> 409 INSUFFICIENT_STOCK" "409 INSUFFICIENT_STOCK" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  details.available = 1" "1.000" "$(body "$R" | jq -r .details.available)"
ck "  la existencia no cambio" "1.000" "$(stock_of $JUGO)"
R=$(req $OFF POST /inventory/items/$SUP/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")
ck "un insumo -> 409 ITEM_NOT_SELLABLE" "409 ITEM_NOT_SELLABLE" "$(code "$R") $(body "$R" | jq -r .code)"
req $OFF PATCH /inventory/items/$JUGO '{"isActive":false}' >/dev/null
R=$(req $OFF POST /inventory/items/$JUGO/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")
ck "un producto inactivo -> 409 ITEM_INACTIVE" "409 ITEM_INACTIVE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items/$SODA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$BAJA\"}")
ck "empleado inactivo -> 404 EMPLOYEE_NOT_FOUND" "404 EMPLOYEE_NOT_FOUND" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items/$SODA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$NO_UUID\"}")
ck "empleado inexistente -> 404 EMPLOYEE_NOT_FOUND" "404 EMPLOYEE_NOT_FOUND" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items/$NO_UUID/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")
ck "articulo inexistente -> 404" 404 "$(code "$R")"
R=$(req $OFF POST /inventory/items/no-es-uuid/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")
ck "id de articulo no-UUID -> 404" 404 "$(code "$R")"
R=$(req $OFF POST /inventory/items/$SODA/consumptions "{\"employeeId\":\"$JUAN\"}")
ck "sin cantidad -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  la soda sigue en 7" "7.000" "$(stock_of $SODA)"

echo
echo "== 4. La pista no anota ni mira consumos (RN-3) =="
R=$(req $OFF POST /employees "{\"fullName\":\"Pista VIS070\",\"username\":\"pista.vis070\",\"pin\":\"$FLOOR_PIN\"}")
case "$(code "$R")" in 201|409) echo "  empleado de pista listo ($(code "$R"))";; *) echo "  AVISO: alta de pista devolvio $(code "$R")";; esac
R=$(req $FLR POST /floor/login "{\"pin\":\"$FLOOR_PIN\"}")
ck "login de pista con PIN -> 200" 200 "$(code "$R")"
floor_rejected() { case "$(code "$1")" in 401|403) echo rechazada;; *) echo "$(code "$1")";; esac; }
ck "  pista: anotar" rechazada "$(floor_rejected "$(req $FLR POST /inventory/items/$SODA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")")"
ck "  pista: anular" rechazada "$(floor_rejected "$(req $FLR POST /inventory/consumptions/$C1/reverse '{"reason":"Desde la pista"}')")"
ck "  pista: reporte" rechazada "$(floor_rejected "$(req $FLR GET /inventory/consumptions)")"
ck "  pista: detalle" rechazada "$(floor_rejected "$(req $FLR GET /inventory/consumptions/$JUAN)")"
ck "  la soda sigue en 7" "7.000" "$(stock_of $SODA)"

echo
echo "== 5. Anular una sola vez (RN-6) =="
R=$(req $OFF POST /inventory/items/$SODA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")
C4=$(body "$R" | jq -r .movement.id)
ck "otra soda a Juan (para anular) -> existencia 6" "201 6.000" "$(code "$R") $(body "$R" | jq -r .item.stockOnHand)"
R=$(req $OFF POST /inventory/consumptions/$C4/reverse '{}')
ck "anular sin motivo -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/consumptions/$C4/reverse '{"reason":"Mal anotado VIS070"}')
ck "anular con motivo -> 201" 201 "$(code "$R")"
ck "  CONSUMPTION_RETURN +1 que apunta al original" "CONSUMPTION_RETURN 1.000 $C4" "$(body "$R" | jq -r '.movement.type + " " + .movement.quantity + " " + .movement.reversesMovementId')"
ck "  copia precio y empleado" "1.25 $JUAN" "$(body "$R" | jq -r '.movement.unitPrice + " " + .movement.employee.id')"
ck "  existencia vuelve a 7" "7.000" "$(stock_of $SODA)"
R=$(req $OFF POST /inventory/consumptions/$C4/reverse '{"reason":"Otra vez VIS070"}')
ck "anular otra vez -> 409 CONSUMPTION_ALREADY_REVERSED" "409 CONSUMPTION_ALREADY_REVERSED" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  una sola devolucion en la base" 1 "$(sql "SELECT count(*) FROM inventory_movements WHERE \"reversesMovementId\" = '$C4'")"
ck "  la existencia no se movio" "7.000" "$(stock_of $SODA)"
R=$(req $OFF POST /inventory/consumptions/$NO_UUID/reverse '{"reason":"No existe"}')
ck "anular algo que no existe -> 404" 404 "$(code "$R")"
R=$(req $OFF POST /inventory/consumptions/no-es-uuid/reverse '{"reason":"No existe"}')
ck "anular con id no-UUID -> 404" 404 "$(code "$R")"
DISPATCH=$(body "$(req $OFF POST /inventory/items/$SUP/dispatches "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")" | jq -r .movement.id)
R=$(req $OFF POST /inventory/consumptions/$DISPATCH/reverse '{"reason":"No es consumo"}')
ck "anular un despacho -> 404" 404 "$(code "$R")"

echo
echo "== 6. Precio congelado (RN-4) =="
R=$(req $OFF PATCH /inventory/items/$SODA '{"price":"1.50"}')
ck "la soda sube a \$1.50 -> 200" "200 1.50" "$(code "$R") $(body "$R" | jq -r .price)"

echo
echo "== 7. Reporte por rango (091 RN-4) =="
MONTH=$(TZ=America/El_Salvador date +%Y-%m)
TODAY=$(TZ=America/El_Salvador date +%F)
CUR="from=$MONTH-01&to=$TODAY"
R=$(req $OFF GET /inventory/consumptions)
ck "sin rango -> 200 del 1 del mes en curso a hoy, en El Salvador" "200 $MONTH-01 $TODAY" "$(code "$R") $(body "$R" | jq -r '.from + " " + .to')"
R=$(req $OFF GET "/inventory/consumptions?$CUR")
ck "con rango -> 200 y lo devuelve" "200 $MONTH-01 $TODAY" "$(code "$R") $(body "$R" | jq -r '.from + " " + .to')"
REPORT=$(body "$R")
ck "Juan: 3 unidades, \$3.25 (2 × 1.25 + 0.75, sin el anulado ni el precio nuevo)" "3.000 3.25" "$(row_of "$REPORT" "$JUAN")"
ck "Ana: 1 unidad, \$1.25" "1.000 1.25" "$(row_of "$REPORT" "$ANA")"
ck "  entre los dos suman \$4.50" 450 "$(echo "$REPORT" | jq --arg j "$JUAN" --arg a "$ANA" '[.rows[]|select(.employee.id==$j or .employee.id==$a)|.total|tonumber*100]|add|round')"
ck "  Juan va antes que Ana" true "$(echo "$REPORT" | jq --arg j "$JUAN" --arg a "$ANA" '([.rows[].employee.id]|index($j)) < ([.rows[].employee.id]|index($a))')"
ck "  filas de mayor a menor total" true "$(echo "$REPORT" | jq '[.rows[].total|tonumber] as $t | $t == ($t|sort|reverse)')"
ck "  el total general es la suma de las filas" true "$(echo "$REPORT" | jq '(.total|tonumber*100|round) == ([.rows[].total|tonumber*100]|add // 0|round)')"
R=$(req $OFF GET "/inventory/consumptions?from=2026-13-01")
ck "fecha invalida -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF GET "/inventory/consumptions?from=2026-09-27&to=2026-09-26")
ck "desde despues de hasta -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"

R=$(req $OFF GET "/inventory/movements?type=CONSUMPTION&employeeId=$JUAN")
ck "reporte plano filtra CONSUMPTION del empleado" "3 true" "$(body "$R" | jq -r '(.total|tostring) + " " + ([.items[].unitPrice != null]|all|tostring)')"

echo
echo "== 8. Detalle de Juan =="
R=$(req $OFF GET "/inventory/consumptions/$JUAN?$CUR")
DETAIL=$(body "$R")
ck "detalle -> 200" 200 "$(code "$R")"
ck "  cifras sin el anulado" "3.000 3.25" "$(echo "$DETAIL" | jq -r '.units + " " + .total')"
ck "  trae los tres consumos, el anulado incluido" 3 "$(echo "$DETAIL" | jq '.entries|length')"
ck "  el anulado, marcado con su motivo" "Mal anotado VIS070" "$(echo "$DETAIL" | jq -r --arg m "$C4" '.entries[]|select(.movementId==$m)|.reversal.reason')"
ck "  mas reciente arriba" "$C4" "$(echo "$DETAIL" | jq -r '.entries[0].movementId')"
ck "  las 2 sodas siguen a \$1.25 = \$2.50" "2.000 1.25 2.50 VIS070" "$(echo "$DETAIL" | jq -r --arg m "$C1" '.entries[]|select(.movementId==$m)|.quantity + " " + .unitPrice + " " + .total + " " + .note')"
ck "  quien anoto" "$ADMIN_ID" "$(echo "$DETAIL" | jq -r --arg m "$C1" '.entries[]|select(.movementId==$m)|.createdBy.id')"
R=$(req $OFF GET "/inventory/consumptions/$BAJA?$CUR")
ck "empleado inactivo sin consumos -> 200 vacio" "200 false 0" "$(code "$R") $(body "$R" | jq -r '(.employee.isActive|tostring) + " " + (.entries|length|tostring)')"
R=$(req $OFF GET "/inventory/consumptions/$NO_UUID")
ck "empleado inexistente -> 404 EMPLOYEE_NOT_FOUND" "404 EMPLOYEE_NOT_FOUND" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF GET "/inventory/consumptions/no-es-uuid")
ck "id no-UUID -> 404" 404 "$(code "$R")"

echo
echo "== 9. Borde de mes en hora de El Salvador (091 RN-4) =="
# El API no deja elegir la hora de un consumo: se anotan dos y se corre su
# createdAt en la base al ultimo minuto del mes anterior y a la medianoche
# del mes en curso, las dos en hora de El Salvador.
Y=${MONTH%-*}; M=$((10#${MONTH#*-} - 1))
if [ "$M" -eq 0 ]; then Y=$((Y - 1)); M=12; fi
PREV=$(printf '%04d-%02d' "$Y" "$M")
PREVR="from=$PREV-01&to=$(date -d "$MONTH-01 -1 day" +%F)"
B1=$(body "$(req $OFF POST /inventory/items/$AGUA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$BORDE\"}")" | jq -r .movement.id)
B2=$(body "$(req $OFF POST /inventory/items/$AGUA/consumptions "{\"quantity\":\"2\",\"employeeId\":\"$BORDE\"}")" | jq -r .movement.id)
sql "UPDATE inventory_movements SET \"createdAt\" = ((timestamp '$MONTH-01 00:00:00' AT TIME ZONE 'America/El_Salvador') - interval '1 minute') AT TIME ZONE 'UTC' WHERE id = '$B1'" >/dev/null
sql "UPDATE inventory_movements SET \"createdAt\" = (timestamp '$MONTH-01 00:00:00' AT TIME ZONE 'America/El_Salvador') AT TIME ZONE 'UTC' WHERE id = '$B2'" >/dev/null
ck "  23:59 del ultimo dia cuenta en $PREV" "1.000 0.75" "$(row_of "$(body "$(req $OFF GET "/inventory/consumptions?$PREVR")")" "$BORDE")"
ck "  00:00 del dia 1 cuenta en $MONTH" "2.000 1.50" "$(row_of "$(body "$(req $OFF GET "/inventory/consumptions?$CUR")")" "$BORDE")"
R=$(req $OFF POST /inventory/consumptions/$B1/reverse '{"reason":"Borde VIS070"}')
ck "anular hoy el del mes anterior -> 201" 201 "$(code "$R")"
ck "  sale del mes del consumo, no del de hoy" "none 2.000 1.50" "$(row_of "$(body "$(req $OFF GET "/inventory/consumptions?$PREVR")")" "$BORDE") $(row_of "$(body "$(req $OFF GET "/inventory/consumptions?$CUR")")" "$BORDE")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
