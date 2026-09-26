#!/bin/bash
# Verificacion end-to-end de la spec 066 (una sola cuenta: lavados y productos
# sueltos en el mismo cobro).
#
# Lo que prueba y `pnpm test` no puede: que la cuenta, los lavados en PAID, la
# venta suelta, su salida del kardex y los pagos repartidos se escriban en una
# sola transaccion contra Postgres; que los pagos de la venta cuelguen de la
# misma `Charge` con `counterSaleId`; y que anular desde un lavado o desde la
# venta deshaga la cuenta entera —lavados a READY, venta VOID, existencia
# repuesta y pagos fuera del turno—.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-066.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
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

ADMIN_AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
OFF=$S/office.jar
rm -f "$OFF"

stock_of() { body "$(req $OFF GET /inventory/items/$1)" | jq -r .stockOnHand; }
ticket() { body "$(req $OFF GET /carwash/tickets/$1)"; }
sale() { body "$(req $OFF GET /sales/$1)"; }
session() { body "$(req $OFF GET /carwash/cash/sessions/$CASH_ID)"; }
# Suma en centavos de los pagos del turno que cuelgan de un lavado o de una venta.
session_cents() {
  session | jq --arg k "$1" --arg v "$2" \
    '[.payments[]|select(.[$k]==$v)|.amount|tonumber*100|round]|add // 0'
}

echo "== 0. Sesion, caja, servicio de \$10 y un producto de \$3 con 5 en existencia =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
case "$(code "$R")" in 200|201|409) echo "  caja lista";; *) echo "  AVISO: abrir caja devolvio $(code "$R")";; esac
CASH_ID=$(body "$(req $OFF GET /carwash/cash/current)" | jq -r '.id')

SEDAN=$(body "$(req $OFF GET /vehicle-body-types)" | jq -r '.[]|select(.key=="sedan").id')
SRV_CAT=$(body "$(req $OFF GET /service-categories)" | jq -r '.[0].id')
R=$(req $OFF POST /services "{\"name\":\"Lavado VIS066 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"10.00\"}")
ck "servicio de \$10 -> 201" 201 "$(code "$R")"
SRV=$(body "$R" | jq -r .id)

R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Cera VIS066 $RUN\",\"price\":\"3.00\"}")
ck "producto de \$3 -> 201" 201 "$(code "$R")"
P1=$(body "$R" | jq -r .id)
req $OFF POST /inventory/items/$P1/entries '{"quantity":"5"}' >/dev/null
ck "  existencia 5" "5.000" "$(stock_of $P1)"

n=0
ready_ticket() {
  # Abre un lavado de un servicio de $10 y lo deja listo; imprime su id.
  n=$((n+1))
  local id
  id=$(body "$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS066\"},\"vehicle\":{\"plate\":\"P66$RUN$n\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")" | jq -r .id)
  req $OFF POST /carwash/tickets/$id/status '{"status":"READY"}' >/dev/null
  echo "$id"
}

echo
echo "== 1. Cuenta de 2 lavados + 1 producto con pago partido =="
T1=$(ready_ticket)
T2=$(ready_ticket)
ck "dos lavados listos" "READY READY" "$(ticket $T1 | jq -r .status) $(ticket $T2 | jq -r .status)"

R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$T1\",\"$T2\"],\"products\":[{\"inventoryItemId\":\"$P1\",\"quantity\":\"1\"}],\"payments\":[{\"method\":\"CARD\",\"amount\":\"20.00\"},{\"method\":\"CASH\",\"amount\":\"3.00\"}],\"cashTendered\":\"5.00\"}")
ck "cobrar la cuenta -> 201" 201 "$(code "$R")"
CHARGE=$(body "$R" | jq -r .id)
SALE=$(body "$R" | jq -r '.counterSale.id // empty')
ck "  total 23.00 y vuelto 2.00" "23.00 2.00" "$(body "$R" | jq -r '.total + " " + .changeGiven')"
ck "  la cuenta trae su venta V-NNNN de 3.00" "true 3.00" "$(body "$R" | jq -r '(.counterSale.number|test("^V-[0-9]{4,}$")|tostring) + " " + .counterSale.total')"
ck "  lavados PAID" "PAID PAID" "$(ticket $T1 | jq -r .status) $(ticket $T2 | jq -r .status)"
ck "  el lavado sabe de la venta de su cuenta" "$SALE" "$(ticket $T1 | jq -r '.charge.counterSale.id')"
ck "  y cuenta 2 lavados (los pagos de la venta no cuentan)" 2 "$(ticket $T1 | jq -r '.charge.ticketCount')"
ck "  venta PAID en la misma Charge" "PAID $CHARGE" "$(sale $SALE | jq -r '.status + " " + .charge.id')"
ck "  la venta dice con que lavados se cobro" 2 "$(sale $SALE | jq '.accountTickets|length')"
ck "  existencia baja a 4" "4.000" "$(stock_of $P1)"

echo
echo "== 2. Reparto al centavo (059 RN-5 con la venta como una parte mas) =="
C1=$(session_cents workOrderId "$T1")
C2=$(session_cents workOrderId "$T2")
CS=$(session_cents counterSaleId "$SALE")
ck "  lavados + venta = 2300 centavos" 2300 "$((C1 + C2 + CS))"
ck "  la venta tiene pagos en el turno" true "$([ "$CS" -gt 0 ] && echo true || echo false)"
CARD=$(session | jq --arg a "$T1" --arg b "$T2" --arg s "$SALE" \
  '[.payments[]|select((.workOrderId==$a or .workOrderId==$b or .counterSaleId==$s) and .method=="CARD")|.amount|tonumber*100|round]|add')
ck "  el renglon de tarjeta suma exacto" 2000 "$CARD"
ck "  la venta guarda un renglon por metodo" 2 "$(sale $SALE | jq '.payments|length')"

echo
echo "== 3. Una cuenta vacia no se cobra =="
R=$(req $OFF POST /carwash/charges '{"workOrderIds":[],"payments":[{"method":"CASH","amount":"1.00"}]}')
ck "sin lavados ni productos -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"

echo
echo "== 4. Anular desde un lavado deshace la cuenta entera (059 RN-8) =="
R=$(req $OFF POST /carwash/tickets/$T1/reverse "{\"reason\":\"Prueba VIS066\",$ADMIN_AUTH}")
ck "un lavado suelto de la cuenta -> 409 TICKET_NOT_REVERSIBLE" "409 TICKET_NOT_REVERSIBLE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /carwash/charges/$CHARGE/void "{\"reason\":\"Prueba VIS066\",$ADMIN_AUTH}")
ck "deshacer la cuenta -> 200" 200 "$(code "$R")"
ck "  lavados READY" "READY READY" "$(ticket $T1 | jq -r .status) $(ticket $T2 | jq -r .status)"
ck "  venta VOID" VOID "$(sale $SALE | jq -r .status)"
ck "  existencia repuesta a 5" "5.000" "$(stock_of $P1)"
ck "  SALE_RETURN con counterSaleId" "SALE_RETURN $SALE" "$(body "$(req $OFF GET "/inventory/items/$P1/movements?pageSize=1")" | jq -r '.items[0].type + " " + .items[0].counterSaleId')"
ck "  pagos fuera del turno" "0 0 0" "$(session_cents workOrderId "$T1") $(session_cents workOrderId "$T2") $(session_cents counterSaleId "$SALE")"

echo
echo "== 5. Anular desde la venta tambien deshace sus lavados =="
T3=$(ready_ticket)
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$T3\"],\"products\":[{\"inventoryItemId\":\"$P1\",\"quantity\":\"2\"}],\"payments\":[{\"method\":\"CASH\",\"amount\":\"16.00\"}]}")
ck "lavado + 2 productos -> 201" 201 "$(code "$R")"
SALE2=$(body "$R" | jq -r '.counterSale.id // empty')
ck "  existencia 3" "3.000" "$(stock_of $P1)"
R=$(req $OFF POST /sales/$SALE2/void "{\"reason\":\"Prueba VIS066\",$ADMIN_AUTH}")
ck "anular la venta -> 200 VOID" "200 VOID" "$(code "$R") $(body "$R" | jq -r .status)"
ck "  el lavado vuelve a READY" READY "$(ticket $T3 | jq -r .status)"
ck "  existencia repuesta a 5" "5.000" "$(stock_of $P1)"
ck "  pagos fuera del turno" "0 0" "$(session_cents workOrderId "$T3") $(session_cents counterSaleId "$SALE2")"

echo
echo "== 6. POST /sales sigue: una cuenta sin lavados =="
R=$(req $OFF POST /sales "{\"items\":[{\"inventoryItemId\":\"$P1\",\"quantity\":\"1\"}],\"payments\":[{\"method\":\"CASH\",\"amount\":\"3.00\"}]}")
ck "venta suelta -> 201 PAID sin lavados" "201 PAID 0" "$(code "$R") $(body "$R" | jq -r '.status + " " + (.accountTickets|length|tostring)')"
SALE3=$(body "$R" | jq -r .id)
req $OFF POST /sales/$SALE3/void "{\"reason\":\"Limpieza VIS066\",$ADMIN_AUTH}" >/dev/null
ck "  y se anula con su contrato" VOID "$(sale $SALE3 | jq -r .status)"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
