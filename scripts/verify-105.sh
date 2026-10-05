#!/bin/bash
# Verificacion end-to-end de la spec 105 (cuentas abiertas: lo que alguien se
# lleva y paga despues).
#
# Lo que prueba y `pnpm test` no puede: la migracion (tablas, CHECKs, indices
# unicos parciales, `payments_one_owner` con tres duenos), que el kardex saque
# el producto con `SALE` + `tabLineId` y lo devuelva con `SALE_RETURN` que apunta
# al original, que el precio se congele desde la fila bloqueada, que dos
# anotaciones simultaneas a alguien sin cuenta no le abran dos, que el abono
# caiga en el turno de caja abierto y en «Ventas del dia», que los guards
# rechacen la sesion de pista y que las rutas de la 070 ya no existan.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-105.sh
#
# Corre sobre una base con datos: abre la caja si no hay turno (no la cierra) y
# mira solo las cuentas de los titulares que crea esta corrida.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
# Cliente propio ante el freno de /floor/login (044 RN-6, que cuenta por
# X-Forwarded-For): los PIN fallidos de otro verify no dejan a este en 429.
FLOOR_CLIENT="X-Forwarded-For: verify-105-$$"
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
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
# PIN fijo del empleado de pista de esta verificacion. Los PINs son unicos en
# todo el taller (044 RN-3): no repite los de los otros verify-*.sh.
FLOOR_PIN=700105
NO_UUID=00000000-0000-4000-8000-000000000000

ck() {
  if [ "$2" = "$3" ]; then echo "  OK   $1  ($3)"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}
req() {
  local jar=$1 m=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -H "$FLOOR_CLIENT" -b "$jar" -c "$jar" -X "$m" "$API$path" -H 'Content-Type: application/json' -d "$body" -w '\n%{http_code}'
  else
    curl -s -H "$FLOOR_CLIENT" -b "$jar" -c "$jar" -X "$m" "$API$path" -w '\n%{http_code}'
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
tab_of() { body "$(req $OFF GET /tabs/$1)"; }
anotar() { req $OFF POST /tabs/lines "{\"holder\":{\"kind\":\"$1\",\"id\":\"$2\"},\"items\":$3}"; }
line_of() { echo "$1" | jq -r --arg i "$2" '[.lines[]|select(.inventoryItemId==$i and .voided==null)][0].id'; }
cash_total() { body "$(req $OFF GET /carwash/cash/current)" | jq -r .cashTotal; }

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
ck "migracion 20261005120000_open_tabs aplicada" 1 \
  "$(sql "SELECT count(*) FROM _prisma_migrations WHERE migration_name = '20261005120000_open_tabs' AND finished_at IS NOT NULL")"
ck "  tablas tabs y tab_lines" 2 \
  "$(sql "SELECT count(*) FROM information_schema.tables WHERE table_name IN ('tabs','tab_lines')")"
ck "  columnas payments.tabId e inventory_movements.tabLineId" 2 \
  "$(sql "SELECT count(*) FROM information_schema.columns WHERE (table_name = 'payments' AND column_name = 'tabId') OR (table_name = 'inventory_movements' AND column_name = 'tabLineId')")"
ck "  CHECKs tabs_one_holder y tabs_balance_consistent" 2 \
  "$(sql "SELECT count(*) FROM pg_constraint WHERE conname IN ('tabs_one_holder','tabs_balance_consistent')")"
ck "  payments_one_owner cuenta tres duenos" 1 \
  "$(sql "SELECT count(*) FROM pg_constraint WHERE conname = 'payments_one_owner' AND pg_get_constraintdef(oid) LIKE '%tabId%'")"
ck "  unicos parciales: una abierta por titular" 2 \
  "$(sql "SELECT count(*) FROM pg_indexes WHERE tablename = 'tabs' AND indexname IN ('tabs_one_open_per_employee','tabs_one_open_per_customer') AND indexdef LIKE 'CREATE UNIQUE%'")"
ck "  el enum conserva CONSUMPTION (historia de la 070)" 2 \
  "$(sql "SELECT count(*) FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'InventoryMovementType' AND e.enumlabel IN ('CONSUMPTION','CONSUMPTION_RETURN')")"

R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
case "$(code "$R")" in 200|201|409) echo "  caja lista ($(code "$R"))";; *) echo "  AVISO: abrir caja devolvio $(code "$R")";; esac
CASH_ID=$(body "$(req $OFF GET /carwash/cash/current)" | jq -r '.id')

echo
echo "== 1. Titulares, productos y cuentas bancarias =="
JUAN=$(new_employee "Juan VIS105 $RUN" "juan105$RUN")
ANA=$(new_employee "Ana VIS105 $RUN" "ana105$RUN")
PEDRO=$(new_employee "Pedro VIS105 $RUN" "pedro105$RUN")
BAJA=$(new_employee "Baja VIS105 $RUN" "baja105$RUN")
ck "cuatro empleados nuevos" true "$([ -n "$JUAN" ] && [ -n "$ANA" ] && [ -n "$PEDRO" ] && [ -n "$BAJA" ] && echo true || echo false)"
req $OFF PATCH /employees/$BAJA '{"isActive":false}' >/dev/null
R=$(req $OFF POST /customers "{\"fullName\":\"Roberto VIS105 $RUN\",\"phone\":\"7105-$RUN\"}")
ck "cliente nuevo -> 201" 201 "$(code "$R")"
ROBERTO=$(body "$R" | jq -r .id)

SODA=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Soda VIS105 $RUN\",\"price\":\"1.25\"}")" | jq -r .id)
AGUA=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Agua VIS105 $RUN\",\"price\":\"0.75\"}")" | jq -r .id)
JUGO=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Jugo VIS105 $RUN\",\"price\":\"1.00\"}")" | jq -r .id)
SUP=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Franela VIS105 $RUN\"}")" | jq -r .id)
req $OFF POST /inventory/items/$SODA/entries '{"quantity":"10"}' >/dev/null
req $OFF POST /inventory/items/$AGUA/entries '{"quantity":"10"}' >/dev/null
req $OFF POST /inventory/items/$JUGO/entries '{"quantity":"5"}' >/dev/null
req $OFF POST /inventory/items/$SUP/entries '{"quantity":"5"}' >/dev/null
req $OFF PATCH /inventory/items/$JUGO '{"isActive":false}' >/dev/null
ck "existencias 10 / 10 / 5 / 5" "10.000 10.000 5.000 5.000" "$(stock_of $SODA) $(stock_of $AGUA) $(stock_of $JUGO) $(stock_of $SUP)"

ACC=$(body "$(req $OFF POST /banking/accounts "{\"bank\":\"BAC\",\"type\":\"SAVINGS\",\"number\":\"105$RUN\",\"holderName\":\"Elite Service\"}")" | jq -r .id)
OFF_ACC=$(body "$(req $OFF POST /banking/accounts "{\"bank\":\"AGRICOLA\",\"type\":\"SAVINGS\",\"number\":\"1050$RUN\",\"holderName\":\"Elite Service\"}")" | jq -r .id)
req $OFF PATCH /banking/accounts/$OFF_ACC '{"active":false}' >/dev/null
ck "cuenta bancaria activa e inactiva" true "$([ -n "$ACC" ] && [ "$ACC" != null ] && [ -n "$OFF_ACC" ] && echo true || echo false)"

echo
echo "== 2. Anotar abre la cuenta y saca del inventario (RN-1 a RN-4) =="
PAYMENTS_BEFORE=$(sql "SELECT count(*) FROM payments")
R=$(anotar EMPLOYEE "$JUAN" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"2\"},{\"inventoryItemId\":\"$AGUA\",\"quantity\":\"1\"}]")
ck "2 sodas + 1 agua a Juan -> 201" 201 "$(code "$R")"
TAB=$(body "$R" | jq -r .id)
TAB_NUMBER=$(body "$R" | jq -r .number)
ck "  numero C-NNNN" true "$(echo "$TAB_NUMBER" | grep -Eq '^C-[0-9]{4,}$' && echo true || echo false)"
ck "  abierta, de Juan, debe 3.25" "OPEN EMPLOYEE $JUAN 3.25 0.00 3.25 3.000" \
  "$(body "$R" | jq -r '.status + " " + .holder.kind + " " + .holder.id + " " + .total + " " + .paid + " " + .balance + " " + .units')"
ck "  quien abrio y quien anoto" "$ADMIN_ID $ADMIN_ID" "$(body "$R" | jq -r '.openedBy.id + " " + .lines[0].createdBy.id')"
ck "  existencias 8 y 9" "8.000 9.000" "$(stock_of $SODA) $(stock_of $AGUA)"
ck "  anotar no escribe pagos" "$PAYMENTS_BEFORE" "$(sql "SELECT count(*) FROM payments")"
R=$(req $OFF GET "/inventory/items/$SODA/movements?pageSize=5")
ck "  kardex: SALE -2 de la cuenta, con titular y precio" "SALE -2.000 $TAB_NUMBER Juan VIS105 $RUN 1.25" \
  "$(body "$R" | jq -r '.items[0]|.type + " " + .quantity + " " + .tabNumber + " " + .tabHolderName + " " + .unitPrice')"
R=$(req $OFF GET "/inventory/movements?type=SALE,SALE_RETURN&itemId=$SODA")
ck "  el filtro «Ventas» del kardex la trae" "1 $TAB" "$(body "$R" | jq -r '(.total|tostring) + " " + .items[0].tabId')"

R=$(anotar EMPLOYEE "$JUAN" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"}]")
ck "anotar otra vez a Juan -> misma cuenta, debe 4.50" "201 $TAB 4.50" "$(code "$R") $(body "$R" | jq -r '.id + " " + .balance')"
R=$(anotar CUSTOMER "$ROBERTO" "[{\"inventoryItemId\":\"$AGUA\",\"quantity\":\"2\"}]")
ck "anotar a un cliente -> otra cuenta" "201 CUSTOMER 1.50" "$(code "$R") $(body "$R" | jq -r '.holder.kind + " " + .balance')"
CTAB=$(body "$R" | jq -r .id)
ck "  numeros distintos" true "$([ "$(body "$R" | jq -r .number)" != "$TAB_NUMBER" ] && echo true || echo false)"

# Dos cajas anotan a la vez a Ana, que no tiene cuenta: una sola abierta (RN-2).
anotar EMPLOYEE "$ANA" "[{\"inventoryItemId\":\"$AGUA\",\"quantity\":\"1\"}]" > "$S/a1" &
anotar EMPLOYEE "$ANA" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"}]" > "$S/a2" &
wait
ck "dos anotaciones simultaneas a Ana -> 201 y 201" "201 201" "$(tail -1 "$S/a1") $(tail -1 "$S/a2")"
ck "  una sola cuenta abierta de Ana" 1 "$(sql "SELECT count(*) FROM tabs WHERE \"employeeId\" = '$ANA' AND \"closedAt\" IS NULL")"
ANA_TAB=$(sed '$d' "$S/a1" | jq -r .id)
ck "  con las dos lineas, debe 2.00" "2 2.00" "$(tab_of $ANA_TAB | jq -r '(.lines|length|tostring) + " " + .balance')"

echo
echo "== 3. Lo que no se puede anotar =="
R=$(anotar EMPLOYEE "$PEDRO" "[{\"inventoryItemId\":\"$SUP\",\"quantity\":\"1\"}]")
ck "un insumo -> 409 ITEM_NOT_SELLABLE" "409 ITEM_NOT_SELLABLE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(anotar EMPLOYEE "$PEDRO" "[{\"inventoryItemId\":\"$JUGO\",\"quantity\":\"1\"}]")
ck "un producto inactivo -> 409 ITEM_INACTIVE" "409 ITEM_INACTIVE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(anotar EMPLOYEE "$PEDRO" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"},{\"inventoryItemId\":\"$AGUA\",\"quantity\":\"99\"}]")
ck "sin existencia -> 409 INSUFFICIENT_STOCK con su itemId" "409 INSUFFICIENT_STOCK $AGUA" "$(code "$R") $(body "$R" | jq -r '.code + " " + .details.itemId')"
ck "  a Pedro no se le abrio cuenta" 0 "$(sql "SELECT count(*) FROM tabs WHERE \"employeeId\" = '$PEDRO'")"
ck "  y la soda no salio" "6.000" "$(stock_of $SODA)"
R=$(anotar EMPLOYEE "$BAJA" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"}]")
ck "empleado inactivo -> 404 EMPLOYEE_NOT_FOUND" "404 EMPLOYEE_NOT_FOUND" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(anotar CUSTOMER "$NO_UUID" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"}]")
ck "cliente inexistente -> 404 NOT_FOUND" "404 NOT_FOUND" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(anotar EMPLOYEE "$PEDRO" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"},{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"}]")
ck "producto repetido -> 422" 422 "$(code "$R")"
R=$(anotar EMPLOYEE "$PEDRO" "[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\",\"unitPrice\":\"0.10\"}]")
ck "precio manual: se ignora, sale el del articulo" "201 1.25" "$(code "$R") $(body "$R" | jq -r '.lines[0].unitPrice')"
PEDRO_TAB=$(body "$R" | jq -r .id)

echo
echo "== 4. La pista no entra (RN-9) =="
R=$(req $OFF POST /employees "{\"fullName\":\"Pista VIS105\",\"username\":\"pista.vis105\",\"pin\":\"$FLOOR_PIN\"}")
case "$(code "$R")" in 201|409) echo "  empleado de pista listo ($(code "$R"))";; *) echo "  AVISO: alta de pista devolvio $(code "$R")";; esac
R=$(req $FLR POST /floor/login "{\"pin\":\"$FLOOR_PIN\"}")
ck "login de pista con PIN -> 200" 200 "$(code "$R")"
floor_rejected() { case "$(code "$1")" in 401|403) echo rechazada;; *) echo "$(code "$1")";; esac; }
ck "  pista: lista" rechazada "$(floor_rejected "$(req $FLR GET /tabs)")"
ck "  pista: detalle" rechazada "$(floor_rejected "$(req $FLR GET /tabs/$TAB)")"
ck "  pista: titulares" rechazada "$(floor_rejected "$(req $FLR GET /tabs/holders)")"
ck "  pista: anotar" rechazada "$(floor_rejected "$(req $FLR POST /tabs/lines "{\"holder\":{\"kind\":\"EMPLOYEE\",\"id\":\"$JUAN\"},\"items\":[{\"inventoryItemId\":\"$SODA\",\"quantity\":\"1\"}]}")")"
ck "  pista: abonar" rechazada "$(floor_rejected "$(req $FLR POST /tabs/$TAB/payments '{"method":"CASH","amount":"1.00"}')")"
ck "  pista: ventas del dia" rechazada "$(floor_rejected "$(req $FLR GET /sales/feed)")"
ck "  la cuenta de Juan sigue en 4.50" "4.50" "$(tab_of $TAB | jq -r .balance)"

echo
echo "== 5. Precio congelado (RN-4) =="
req $OFF PATCH /inventory/items/$SODA '{"price":"2.00"}' >/dev/null
ck "la soda sube a \$2.00: las lineas siguen a 1.25 y Juan debe 4.50" "1.25 4.50" \
  "$(tab_of $TAB | jq -r --arg s "$SODA" '([.lines[]|select(.inventoryItemId==$s)][0].unitPrice) + " " + .balance')"

echo
echo "== 6. Quitar una linea (RN-5) =="
DETAIL=$(tab_of $TAB)
AGUA_LINE=$(line_of "$DETAIL" "$AGUA")
R=$(req $OFF POST /tabs/$TAB/lines/$AGUA_LINE/void '{}')
ck "sin motivo -> 422" 422 "$(code "$R")"
R=$(req $OFF POST /tabs/$TAB/lines/$AGUA_LINE/void '{"reason":"Era de Luis VIS105"}')
ck "quitar el agua -> 200, debe 3.75" "200 3.75" "$(code "$R") $(body "$R" | jq -r .balance)"
ck "  tachada con motivo y quien" "Era de Luis VIS105 $ADMIN_ID false" \
  "$(body "$R" | jq -r --arg l "$AGUA_LINE" '.lines[]|select(.id==$l)|.voided.reason + " " + .voided.by.id + " " + (.isVoidable|tostring)')"
ck "  el agua vuelve al inventario" "7.000" "$(stock_of $AGUA)"
SALE_ID=$(sql "SELECT id FROM inventory_movements WHERE \"tabLineId\" = '$AGUA_LINE' AND type = 'SALE'")
ck "  SALE_RETURN +1 que apunta al SALE" "SALE_RETURN 1.000 $SALE_ID" \
  "$(sql "SELECT type || ' ' || quantity::text || ' ' || \"reversesMovementId\" FROM inventory_movements WHERE \"tabLineId\" = '$AGUA_LINE' AND type = 'SALE_RETURN'")"
R=$(req $OFF POST /tabs/$TAB/lines/$AGUA_LINE/void '{"reason":"Otra vez"}')
ck "quitar otra vez -> 409 TAB_LINE_ALREADY_VOIDED" "409 TAB_LINE_ALREADY_VOIDED" "$(code "$R") $(body "$R" | jq -r .code)"
CLINE=$(tab_of $CTAB | jq -r '.lines[0].id')
R=$(req $OFF POST /tabs/$TAB/lines/$CLINE/void '{"reason":"Cruzada"}')
ck "una linea de otra cuenta -> 404" 404 "$(code "$R")"
R=$(req $OFF POST /tabs/$NO_UUID/lines/$CLINE/void '{"reason":"No existe"}')
ck "una cuenta que no existe -> 404" 404 "$(code "$R")"
R=$(req $OFF POST /tabs/no-es-uuid/lines/$CLINE/void '{"reason":"No existe"}')
ck "id no-UUID -> 404" 404 "$(code "$R")"

echo
echo "== 7. Cobrar abonos (RN-6 a RN-8) =="
CASH_BEFORE=$(cash_total)
R=$(req $OFF POST /tabs/$TAB/payments '{"method":"CASH","amount":"3.76"}')
ck "mas que el saldo -> 422 PAYMENT_EXCEEDS_BALANCE" "422 PAYMENT_EXCEEDS_BALANCE 3.75" "$(code "$R") $(body "$R" | jq -r '.code + " " + .details.balance')"
R=$(req $OFF POST /tabs/$TAB/payments '{"method":"CASH","amount":"0"}')
ck "cero -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /tabs/$TAB/payments "{\"method\":\"TRANSFER\",\"amount\":\"1.00\",\"bankAccountId\":\"$OFF_ACC\",\"reference\":\"VIS105\"}")
ck "transferencia a cuenta inactiva -> 422 BANK_ACCOUNT_UNAVAILABLE" "422 BANK_ACCOUNT_UNAVAILABLE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /tabs/$TAB/payments '{"method":"TRANSFER","amount":"1.00"}')
ck "transferencia sin cuenta -> 422" 422 "$(code "$R")"
R=$(req $OFF POST /tabs/$TAB/payments '{"method":"CASH","amount":"2.50"}')
ck "abono de 2.50 en efectivo -> 201, debe 1.25 y sigue abierta" "201 OPEN 2.50 1.25" "$(code "$R") $(body "$R" | jq -r '.status + " " + .paid + " " + .balance')"
PAY1=$(body "$R" | jq -r '.payments[0].id')
ck "  quien cobro" "$ADMIN_ID" "$(body "$R" | jq -r '.payments[0].recordedBy.id')"
ck "  el pago es del turno abierto y no tiene cobro de la 059" "$CASH_ID|$TAB|" \
  "$(sql "SELECT \"cashSessionId\" || '|' || \"tabId\" || '|' || coalesce(\"chargeId\"::text, '') FROM payments WHERE id = '$PAY1'")"
ck "  el efectivo del turno sube 2.50" true \
  "$(echo "$CASH_BEFORE $(cash_total)" | awk '{ printf (($2 - $1) > 2.495 && ($2 - $1) < 2.505) ? "true" : "false" }')"
R=$(req $OFF GET "/carwash/cash/sessions/$CASH_ID?pageSize=100")
ck "  el detalle del turno lo nombra por la cuenta" "$TAB_NUMBER" "$(body "$R" | jq -r --arg p "$PAY1" '.payments.items[]|select(.id==$p)|.tabNumber')"

SODA_LINE=$(tab_of $TAB | jq -r --arg i "$SODA" '[.lines[]|select(.inventoryItemId==$i and .quantity=="2.000")][0].id')
R=$(req $OFF POST /tabs/$TAB/lines/$SODA_LINE/void '{"reason":"Dejaria saldo negativo"}')
ck "quitar 2.50 con 1.25 de saldo -> 409 TAB_LINE_NOT_VOIDABLE" "409 TAB_LINE_NOT_VOIDABLE" "$(code "$R") $(body "$R" | jq -r .code)"

R=$(req $OFF POST /tabs/$TAB/payments "{\"method\":\"TRANSFER\",\"amount\":\"1.25\",\"bankAccountId\":\"$ACC\",\"reference\":\"VIS105-$RUN\"}")
ck "transferencia por el resto -> 201 y se cierra sola" "201 CLOSED 0.00" "$(code "$R") $(body "$R" | jq -r '.status + " " + .balance')"
ck "  closedAt puesto" true "$(body "$R" | jq '.closedAt != null')"
ck "  con su cuenta y referencia" "$ACC VIS105-$RUN" "$(body "$R" | jq -r '.payments[0].bankAccount.id + " " + .payments[0].reference')"
R=$(req $OFF POST /tabs/$TAB/payments '{"method":"CASH","amount":"0.50"}')
ck "abonar a una cerrada -> 409 TAB_CLOSED" "409 TAB_CLOSED" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /tabs/$TAB/lines/$SODA_LINE/void '{"reason":"Cerrada"}')
ck "quitar en una cerrada -> 409 TAB_CLOSED" "409 TAB_CLOSED" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(anotar EMPLOYEE "$JUAN" "[{\"inventoryItemId\":\"$AGUA\",\"quantity\":\"1\"}]")
ck "anotar a Juan despues -> cuenta nueva" true "$([ "$(body "$R" | jq -r .id)" != "$TAB" ] && echo true || echo false)"

R=$(req $OFF GET /sales/feed)
ck "«Ventas del dia» trae los dos abonos como De cuenta" 2 \
  "$(body "$R" | jq --arg t "$TAB" '[.items[]|select(.kind=="TAB_PAYMENT" and .tabPayment.tab.id==$t)]|length')"
ck "  con numero y titular" "$TAB_NUMBER Juan VIS105 $RUN" \
  "$(body "$R" | jq -r --arg t "$TAB" '[.items[]|select(.kind=="TAB_PAYMENT" and .tabPayment.tab.id==$t)][0].tabPayment.tab|.number + " " + .holder.fullName')"
ck "  lo mas nuevo arriba" true "$(body "$R" | jq '[.items[].at] as $a | $a == ($a|sort|reverse)')"
R=$(req $OFF GET "/sales/feed?status=VOID")
ck "  con status=VOID no salen abonos" 0 "$(body "$R" | jq '[.items[]|select(.kind=="TAB_PAYMENT")]|length')"

echo
echo "== 8. Lecturas: lista, totales y titulares =="
R=$(req $OFF GET "/tabs?search=VIS105%20$RUN&pageSize=100")
ck "abiertas de esta corrida (Ana, Pedro, Roberto, Juan nueva)" "200 4" "$(code "$R") $(body "$R" | jq -r '.tabs.total')"
ck "  por saldo, de mayor a menor" true "$(body "$R" | jq '[.tabs.items[].balance|tonumber] as $b | $b == ($b|sort|reverse)')"
ck "  los totales son de todas las abiertas" true \
  "$(body "$R" | jq '.summary as $s | (($s.owedByEmployees|tonumber) + ($s.owedByCustomers|tonumber) - ($s.owed|tonumber) | if . < 0 then -. else . end) < 0.001 and $s.openCount == $s.employeeCount + $s.customerCount')"
R=$(req $OFF GET "/tabs?search=VIS105%20$RUN&holder=CUSTOMER")
ck "  solo clientes -> Roberto" "1 $CTAB" "$(body "$R" | jq -r '(.tabs.total|tostring) + " " + .tabs.items[0].id')"
R=$(req $OFF GET "/tabs?status=CLOSED&search=$TAB_NUMBER")
ck "  cerradas, por numero -> la de Juan" "1 $TAB CLOSED" "$(body "$R" | jq -r '(.tabs.total|tostring) + " " + .tabs.items[0].id + " " + .tabs.items[0].status')"
R=$(req $OFF GET "/tabs?status=NOPE")
ck "  estado invalido -> 422" 422 "$(code "$R")"
R=$(req $OFF GET "/tabs/holders?search=VIS105%20$RUN")
ck "titulares: empleados activos de esta corrida (sin Baja)" 3 "$(body "$R" | jq '.employees|length')"
ck "  Ana con su cuenta abierta" "$ANA_TAB" "$(body "$R" | jq -r --arg a "$ANA" '.employees[]|select(.id==$a)|.openTab.id')"
ck "  Roberto con su cuenta y su telefono" "$CTAB 7105-$RUN" "$(body "$R" | jq -r --arg c "$ROBERTO" '.customers[]|select(.id==$c)|.openTab.id + " " + .detail')"
R=$(req $OFF GET /tabs/$NO_UUID)
ck "detalle de una cuenta que no existe -> 404" 404 "$(code "$R")"
ck "  Pedro debe 1.25 (precio del articulo, no el manual)" "1.25" "$(tab_of $PEDRO_TAB | jq -r .balance)"

echo
echo "== 9. La 070 ya no anota consumos =="
R=$(req $OFF POST /inventory/items/$SODA/consumptions "{\"quantity\":\"1\",\"employeeId\":\"$JUAN\"}")
ck "POST /inventory/items/:id/consumptions -> 404" 404 "$(code "$R")"
R=$(req $OFF GET /inventory/consumptions)
ck "GET /inventory/consumptions -> 404" 404 "$(code "$R")"
R=$(req $OFF POST /inventory/deliveries "{\"employeeId\":\"$JUAN\",\"lines\":[{\"itemId\":\"$SODA\",\"quantity\":\"1\"}]}")
ck "entregar un producto -> 409 ITEM_NOT_DISPATCHABLE" "409 ITEM_NOT_DISPATCHABLE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/deliveries "{\"employeeId\":\"$JUAN\",\"lines\":[{\"itemId\":\"$SUP\",\"quantity\":\"1\"}]}")
ck "el despacho de insumos sigue igual -> 201 DISPATCH" "201 DISPATCH" "$(code "$R") $(body "$R" | jq -r '.results[0].movement.type')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
