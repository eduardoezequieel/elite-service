#!/bin/bash
# Verificacion end-to-end de la spec 098 (dinero de la rentadora: pagos,
# anulacion, deposito, multas, cuentas por cobrar y caja del dia).
#
# Lo que prueba y `pnpm test` no puede: los guards con `rentals.charge` contra
# un usuario real (403), el bloqueo `FOR UPDATE` que revalida el saldo, el
# Decimal de Postgres ida y vuelta, el dia civil de `America/El_Salvador` en la
# caja y la renta resuelta por quien tenia el carro.
#
# La renta de prueba se crea con `POST /rentals/agreements` (spec 096,
# entregada en el mismo paso con `checkoutNow`). Si ese endpoint todavia no
# existe (404: la 096 no mergeo), el script la inserta con `psql` via
# `docker compose exec postgres`, ya `IN_PROGRESS`, con las credenciales
# `POSTGRES_USER` / `POSTGRES_DB` del `.env`.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-098.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
envv() { grep "^$1=" .env | cut -d= -f2-; }
ADMIN_EMAIL=$(envv ADMIN_EMAIL)
ADMIN_PASSWORD=$(envv ADMIN_PASSWORD)
READER_EMAIL=renta.vis098@elite.local
READER_PASSWORD=Renta098!
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
# Centavos de un monto "12.50" (jq), para comparar sumas sin flotantes.
cents() { jq -r "($1 | tonumber * 100 | round)"; }
iso() { date -u -v"$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "$2" +%Y-%m-%dT%H:%M:%SZ; }

OFF=$S/office.jar; RDR=$S/reader.jar
rm -f "$OFF" "$RDR"

echo "== 0. Sesion y permisos =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')

R=$(req $OFF POST /roles '{"name":"Renta lectura VIS098","permissionKeys":["rentals.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET /roles)" | jq -r '.[]|select(.name=="Renta lectura VIS098").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Lectura VIS098\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
R=$(req $RDR POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}")
ck "login con solo rentals.read -> 200" 200 "$(code "$R")"
ck "sin rentals.charge: GET /rentals/cash -> 403" 403 "$(code "$(req $RDR GET /rentals/cash)")"
ck "sin rentals.charge: GET /rentals/receivables -> 403" 403 "$(code "$(req $RDR GET /rentals/receivables)")"
ck "con rentals.read: GET /rentals/fines -> 200" 200 "$(code "$(req $RDR GET /rentals/fines)")"

echo
echo "== 1. Carro, cliente y renta en curso =="
R=$(req $OFF POST /fleet/vehicles "{\"plate\":\"P98$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"25.00\"}")
ck "crear carro -> 201" 201 "$(code "$R")"
CAR=$(body "$R" | jq -r .id)
R=$(req $OFF POST /renters "{\"fullName\":\"Cliente VIS098 $RUN\"}")
ck "crear cliente -> 201" 201 "$(code "$R")"
RENTER=$(body "$R" | jq -r .id)

PICKUP=$(iso -2H '2 hours ago')
RETURN=$(iso +46H '46 hours')
INSPECTION='{"odometerKm":1000,"fuelEighths":8,"damages":[],"accessories":{},"tires":{},"photoIds":[]}'
R=$(req $OFF POST /rentals/agreements "$(jq -nc \
  --arg c "$RENTER" --arg v "$CAR" --arg p "$PICKUP" --arg r "$RETURN" --argjson i "$INSPECTION" \
  '{customerId:$c, vehicleId:$v, plannedPickupAt:$p, plannedReturnAt:$r,
    pickupLocation:"Oficina", returnLocation:"Oficina", dailyRate:"25.00", billableDays:2,
    coverage:"UNDEFINED", includesVat:true, extraCharges:"0", extraChargesNote:null,
    discount:"0", deposit:"100.00", depositMethod:"CASH",
    checkoutNow:true, checkout:{actualPickupAt:$p, inspection:$i}}')")
if [ "$(code "$R")" = 404 ]; then
  echo "  (POST /rentals/agreements no existe todavia: inserto la renta con psql)"
  AGR=$(docker compose exec -T postgres psql -U "$(envv POSTGRES_USER)" -d "$(envv POSTGRES_DB)" -qtA -c "
    INSERT INTO rental_agreements (id, status, \"customerId\", \"vehicleId\", \"plannedPickupAt\",
      \"plannedReturnAt\", \"actualPickupAt\", \"dailyRate\", \"billableDays\", deposit,
      \"depositMethod\", \"createdByUserId\", \"updatedAt\")
    VALUES (gen_random_uuid(), 'IN_PROGRESS', '$RENTER', '$CAR', '$PICKUP', '$RETURN', '$PICKUP',
      25.00, 2, 100.00, 'CASH', '$ADMIN_ID', now())
    RETURNING id;" | head -1 | tr -d '[:space:]')
else
  ck "crear renta entregada -> 201" 201 "$(code "$R")"
  AGR=$(body "$R" | jq -r '.id // .opened.id')
fi
ck "  la renta tiene id" 36 "${#AGR}"

# Las listas vienen de a una página (101): `all_items RUTA [jq-de-la-página]`
# recorre todas y devuelve un solo arreglo con las filas.
all_items() {
  local path=$1 sel=${2:-.} p=1 out='[]' page sep
  case "$path" in *\?*) sep='&';; *) sep='?';; esac
  while :; do
    page=$(body "$(req $OFF GET "$path${sep}page=$p&pageSize=100")" | jq -c "$sel")
    out=$(jq -c --argjson acc "$out" '$acc + .items' <<<"$page")
    [ "$(jq '.page * .pageSize >= .total' <<<"$page")" = true ] && break
    p=$((p+1))
  done
  echo "$out"
}
BALANCE=$(all_items /rentals/receivables | jq -r --arg id "$AGR" '.[]|select(.agreementId==$id).balance')
ck "  aparece en cuentas por cobrar con saldo > 30" true "$(echo "\"${BALANCE:-0}\"" | jq '(tonumber) > 30')"
B=$(echo "\"$BALANCE\"" | cents .)

echo
echo "== 2. Pagos (RN-1) =="
CASH_BEFORE=$(body "$(req $OFF GET /rentals/cash)" | cents .byMethod.CASH)
R=$(req $OFF POST /rentals/agreements/$AGR/payments '{"amount":"30","method":"CASH","reference":"VIS098"}')
ck "pago de 30 en efectivo -> 201" 201 "$(code "$R")"
PAY=$(body "$R" | jq -r .id)
ck "  receivedByUserId es el de la sesion" "$ADMIN_ID 30.00" "$(body "$R" | jq -r '.receivedByUserId + " " + .amount')"
ck "  el saldo bajo 30" $((B - 3000)) "$(all_items /rentals/receivables | jq -r --arg id "$AGR" '.[]|select(.agreementId==$id).balance' | jq -R '. | tonumber * 100 | round')"
R=$(req $OFF POST /rentals/agreements/$AGR/payments "{\"amount\":\"$BALANCE\",\"method\":\"CARD\"}")
ck "pagar el saldo original (de mas) -> 409 PAYMENT_EXCEEDS_BALANCE" "409 PAYMENT_EXCEEDS_BALANCE" "$(code "$R") $(body "$R" | jq -r .code)"
ck "pago de 0 -> 422" 422 "$(code "$(req $OFF POST /rentals/agreements/$AGR/payments '{"amount":"0","method":"CASH"}')")"
ck "sin rentals.charge: pagar -> 403" 403 "$(code "$(req $RDR POST /rentals/agreements/$AGR/payments '{"amount":"1","method":"CASH"}')")"
ck "renta que no existe -> 404" 404 "$(code "$(req $OFF POST /rentals/agreements/00000000-0000-4000-8000-000000000000/payments '{"amount":"1","method":"CASH"}')")"

echo
echo "== 3. Caja del dia =="
R=$(req $OFF GET /rentals/cash)
ck "GET /rentals/cash -> 200" 200 "$(code "$R")"
ck "  byMethod.CASH subio 30" $((CASH_BEFORE + 3000)) "$(body "$R" | cents .byMethod.CASH)"
ck "  byMethod trae las 4 formas" "CARD,CASH,OTHER,TRANSFER" "$(body "$R" | jq -r '.byMethod|keys|join(",")')"
ck "  el pago esta en payments" 1 "$(all_items /rentals/cash .payments | jq --arg id "$PAY" '[.[]|select(.id==$id)]|length')"
ck "  payments es una página (101)" "1 50 true" "$(body "$R" | jq -r '"\(.payments.page) \(.payments.pageSize) \(.payments.total >= 1)"')"
R=$(req $OFF GET '/rentals/cash?page=2&pageSize=1')
ck "  ?page=2&pageSize=1 -> los totales siguen siendo del día" "200 2 1 $((CASH_BEFORE + 3000))" "$(code "$R") $(body "$R" | jq -r '"\(.payments.page) \(.payments.pageSize)"') $(body "$R" | cents .byMethod.CASH)"
ck "  el deposito esta en custodia" "100.00" "$(all_items /rentals/deposits-held | jq -r --arg id "$AGR" '.[]|select(.agreementId==$id).amount')"
R=$(req $OFF GET '/rentals/deposits-held?page=2&pageSize=1')
ck "  deposits-held?page=2&pageSize=1 -> una fila como mucho y el total en dinero" "200 2 1 true true" "$(code "$R") $(body "$R" | jq -r '"\(.page) \(.pageSize) \((.items|length) <= 1) \(has("totalAmount"))"')"
ck "  ?date en otro dia no lo trae" 0 "$(all_items '/rentals/cash?date=2000-01-01' .payments | jq --arg id "$PAY" '[.[]|select(.id==$id)]|length')"

echo
echo "== 4. Anulacion (RN-1) =="
R=$(req $OFF POST /rentals/payments/$PAY/void '{"reason":"Error de digitacion"}')
ck "anular con motivo -> 200 con voidedAt" "200 true" "$(code "$R") $(body "$R" | jq '.voidedAt != null')"
ck "  anular otra vez -> 409" 409 "$(code "$(req $OFF POST /rentals/payments/$PAY/void '{"reason":"Otra vez"}')")"
R=$(req $OFF GET /rentals/cash)
ck "  deja de sumar en la caja" "$CASH_BEFORE" "$(body "$R" | cents .byMethod.CASH)"
ck "  aparece aparte en voided" 1 "$(body "$R" | jq --arg id "$PAY" '[.voided[]|select(.id==$id)]|length')"
ck "  el saldo volvio" "$B" "$(all_items /rentals/receivables | jq -r --arg id "$AGR" '.[]|select(.agreementId==$id).balance' | jq -R '. | tonumber * 100 | round')"

echo
echo "== 5. Multas (RN-4) =="
DURING=$(iso -1H '1 hour ago')
R=$(req $OFF GET "/rentals/fines/resolve?vehicleId=$CAR&occurredAt=$DURING")
ck "resolve en la renta -> esa renta" "$AGR" "$(body "$R" | jq -r '.agreement.id')"
R=$(req $OFF POST /rentals/fines "{\"vehicleId\":\"$CAR\",\"occurredAt\":\"$DURING\",\"amount\":\"10.00\",\"description\":\"Mal estacionado VIS098\",\"chargeToCustomer\":true}")
ck "multa cargada al cliente -> 201 ligada a la renta" "201 $AGR true" "$(code "$R") $(body "$R" | jq -r '"\(.agreementId) \(.chargedToCustomer)"')"
ck "  sube el saldo 10" $((B + 1000)) "$(all_items /rentals/receivables | jq -r --arg id "$AGR" '.[]|select(.agreementId==$id).balance' | jq -R '. | tonumber * 100 | round')"
R=$(req $OFF POST /rentals/fines "{\"vehicleId\":\"$CAR\",\"occurredAt\":\"2020-01-01T12:00:00Z\",\"amount\":\"5.00\",\"description\":\"Vieja VIS098\",\"chargeToCustomer\":true}")
ck "sin renta en esa fecha y cargada al cliente -> 422" 422 "$(code "$R")"
R=$(req $OFF POST /rentals/fines "{\"vehicleId\":\"$CAR\",\"occurredAt\":\"2020-01-01T12:00:00Z\",\"amount\":\"5.00\",\"description\":\"Vieja VIS098\",\"chargeToCustomer\":false}")
ck "sin renta, como gasto del carro -> 201 sin renta" "201 null false" "$(code "$R") $(body "$R" | jq -r '"\(.agreementId) \(.chargedToCustomer)"')"
ck "GET /rentals/fines?vehicleId trae las dos" 2 "$(body "$(req $OFF GET "/rentals/fines?vehicleId=$CAR")" | jq '.total')"
R=$(req $OFF GET "/rentals/fines?vehicleId=$CAR&page=2&pageSize=1")
ck "  ?page=2&pageSize=1 -> la vieja, segunda de dos (101)" "200 2 1 1 2 Vieja VIS098" "$(code "$R") $(body "$R" | jq -r '"\(.page) \(.pageSize) \(.items|length) \(.total) \(.items[0].description)"')"
ck "GET /rentals/fines?agreementId trae la ligada" 1 "$(body "$(req $OFF GET "/rentals/fines?agreementId=$AGR")" | jq '.total')"
R=$(req $OFF GET "/rentals/agreements/$AGR/payments?pageSize=1")
ck "GET /rentals/agreements/:id/payments -> página con el anulado (101)" "200 1 1 true" "$(code "$R") $(body "$R" | jq -r '"\(.pageSize) \(.items|length) \(.total >= 1)"')"
ck "  con rentals.read alcanza" 200 "$(code "$(req $RDR GET "/rentals/agreements/$AGR/payments")")"
ck "sin rentals.charge: registrar multa -> 403" 403 "$(code "$(req $RDR POST /rentals/fines "{\"vehicleId\":\"$CAR\",\"occurredAt\":\"$DURING\",\"amount\":\"1\",\"description\":\"x\",\"chargeToCustomer\":false}")")"

echo
echo "== 6. Deposito (RN-2) =="
ck "devolver 120 de 100 -> 409 DEPOSIT_EXCEEDS_HELD" "409 DEPOSIT_EXCEEDS_HELD" "$(R=$(req $OFF POST /rentals/agreements/$AGR/deposit-return '{"amount":"120"}'); echo "$(code "$R") $(body "$R" | jq -r .code)")"
ck "retener sin nota -> 422" 422 "$(code "$(req $OFF POST /rentals/agreements/$AGR/deposit-return '{"amount":"80"}')")"
R=$(req $OFF POST /rentals/agreements/$AGR/deposit-return '{"amount":"80","note":"Rayon en la puerta"}')
ck "devolver 80 con nota -> 200" "200 80.00" "$(code "$R") $(body "$R" | jq -r .depositReturnedAmount)"
R=$(req $OFF POST /rentals/agreements/$AGR/deposit-return '{"amount":"10","note":"Otra vez"}')
ck "devolver dos veces -> 409 DEPOSIT_EXCEEDS_HELD" "409 DEPOSIT_EXCEEDS_HELD" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  ya no esta en custodia" 0 "$(all_items /rentals/deposits-held | jq --arg id "$AGR" '[.[]|select(.agreementId==$id)]|length')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
