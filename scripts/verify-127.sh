#!/bin/bash
# Verificacion end-to-end de la spec 127 (extender, multa y cambiar carro).
#
# Extender a 9 y a 31 dias deja la tarifa pactada; extender y cobrar deja el
# pago; una multa con agreementId fuera del tramo es 422; la del carro sin
# renta queda como gasto «Multa» en /fleet/expenses; el swap con el body viejo
# es 422; el swap completo cierra la vieja con su inspeccion y cargos, abre la
# nueva con contrato propio, km de salida y la garantia retenida, y pasa el
# excedente pagado sin mover la caja. Sin sesion, 401.
#
# Uso:
#   API_BASE_URL=http://localhost:3200/api bash scripts/verify-127.sh
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
TAG="VIS127 $RUN"

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

# Una renta de 5 días que salió hace dos, otra de 10 que salió hace 4 días
# (para el cambio el día 4) y una fecha de hace 30 días sin renta.
eval "$(node -e "
const now = Date.now();
const iso = (hours) => new Date(now + hours * 3600000).toISOString();
console.log('PICKUP_5='+iso(-48));
console.log('BACK_5='+iso(72));
console.log('BACK_9='+iso(168));
console.log('BACK_31='+iso(-48 + 31 * 24));
console.log('PICKUP_10='+iso(-96));
console.log('BACK_10='+iso(144));
console.log('SWAP_AT='+iso(-1));
console.log('OUTSIDE='+iso(-24 * 30));
console.log('INSIDE='+iso(-24));
")"

OFF=$S/office.jar; ANON=$S/anon.jar
rm -f "$OFF" "$ANON"

echo "== 0. Sesion, caja, carros y cliente =="
R=$(req "$OFF" POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
if [ "$(code "$R")" != 200 ]; then
  echo "  API no disponible o credenciales locales inválidas en $API; se detiene sin crear datos."
  exit 1
fi

# Se usa el turno abierto si hay; si no, se abre uno y se cierra al final.
OPENED_CASH=false
if [ "$(body "$(req "$OFF" GET /rentals/cash/current)")" = "null" ]; then
  ck "abrir la caja -> 201" 201 "$(code "$(req "$OFF" POST /rentals/cash/open '{"openingFloat":"0.00"}')")"
  OPENED_CASH=true
fi
cash_totals() {
  body "$(req "$OFF" GET /rentals/cash/current)" | jq -r '"\(.cashTotal) \(.cardTotal) \(.transferTotal) \(.otherTotal)"'
}

car() {
  body "$(req "$OFF" POST /fleet/vehicles "{\"plate\":\"V127$1$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"$2\",\"weeklyRate\":\"30.00\",\"monthlyRate\":\"25.00\",\"odometerKm\":$3}")" | jq -r .id
}
CAR_A=$(car A 35.00 10000); CAR_B=$(car B 40.00 10000); CAR_C=$(car C 45.00 5000); CAR_D=$(car D 35.00 1000)
RENTER=$(body "$(req "$OFF" POST /renters "{\"fullName\":\"Ana $TAG\"}")" | jq -r .id)
ck "cuatro carros y un cliente" true "$([ "$CAR_A" != null ] && [ "$CAR_B" != null ] && [ "$CAR_C" != null ] && [ "$CAR_D" != null ] && [ "$RENTER" != null ] && echo true)"

handed() {
  req "$OFF" POST /rentals/agreements "$(jq -nc --arg c "$RENTER" --arg v "$1" --arg p "$2" --arg r "$3" --arg rate "$4" --arg pay "$5" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r,dailyRate:$rate,includesVat:false,cdwPerDay:"0.00",coverage:"DECLINED",deposit:"200.00",depositMethod:"CASH",checkoutNow:true,checkout:({actualPickupAt:$p,inspection:{odometerKm:10000,fuelEighths:8}} + (if $pay == "" then {} else {payment:{amount:$pay,method:"CASH"}} end))}')"
}

echo
echo "== 1. Extender deja la tarifa pactada (RN-2) =="
R=$(handed "$CAR_A" "$PICKUP_5" "$BACK_5" 35.00 "")
ck "renta de 5 días a 35 -> 201" 201 "$(code "$R")"
A_ID=$(body "$R" | jq -r .id)
ck "  5 días a 35.00" "5 35.00" "$(body "$R" | jq -r '"\(.billableDays) \(.dailyRate)"')"
R=$(req "$OFF" POST "/rentals/agreements/$A_ID/extend" "$(jq -nc --arg t "$BACK_9" '{newReturnAt:$t}')")
ck "extender a 9 días -> 200" 200 "$(code "$R")"
ck "  9 días y la tarifa sigue en 35.00" "9 35.00" "$(body "$R" | jq -r '"\(.billableDays) \(.dailyRate)"')"
R=$(req "$OFF" POST "/rentals/agreements/$A_ID/extend" "$(jq -nc --arg t "$BACK_31" '{newReturnAt:$t}')")
ck "extender a 31 días -> 200" 200 "$(code "$R")"
ck "  31 días y la tarifa sigue en 35.00" "31 35.00" "$(body "$R" | jq -r '"\(.billableDays) \(.dailyRate)"')"

echo
echo "== 2. Extender y cobrar ahora (segundo pedido) =="
BEFORE=$(body "$(req "$OFF" GET "/rentals/agreements/$A_ID")" | jq -r .totals.paid)
R=$(req "$OFF" POST "/rentals/agreements/$A_ID/payments" '{"amount":"35.00","method":"CASH"}')
ck "cobro de lo agregado -> 201" 201 "$(code "$R")"
ck "  pagado sube 35.00" true "$(body "$(req "$OFF" GET "/rentals/agreements/$A_ID")" | jq --arg b "$BEFORE" '(.totals.paid|tonumber) == (($b|tonumber) + 35)')"

echo
echo "== 3. Multa desde la renta (RN-3) =="
R=$(req "$OFF" POST /rentals/fines "$(jq -nc --arg v "$CAR_A" --arg a "$A_ID" --arg t "$OUTSIDE" '{vehicleId:$v,agreementId:$a,occurredAt:$t,amount:"57.14",description:"Exceso de velocidad",chargeToCustomer:true}')")
ck "fecha fuera del tramo -> 422" 422 "$(code "$R")"
ck "  el error marca occurredAt" true "$(body "$R" | jq '.details.occurredAt != null')"
R=$(req "$OFF" POST /rentals/fines "$(jq -nc --arg v "$CAR_A" --arg a "$A_ID" --arg t "$INSIDE" '{vehicleId:$v,agreementId:$a,occurredAt:$t,amount:"57.14",description:"Exceso de velocidad",chargeToCustomer:true}')")
ck "dentro del tramo -> 201" 201 "$(code "$R")"
ck "  cargada a esa renta" "$A_ID true" "$(body "$R" | jq -r '"\(.agreementId) \(.chargedToCustomer)"')"

echo
echo "== 4. Multa desde el carro sin renta (RN-4) =="
R=$(req "$OFF" POST /rentals/fines "$(jq -nc --arg v "$CAR_D" --arg t "$OUTSIDE" '{vehicleId:$v,occurredAt:$t,amount:"40.00",description:"Mal estacionado",chargeToCustomer:false}')")
ck "multa del carro sin renta -> 201" 201 "$(code "$R")"
ck "  chargedToCustomer=false y sin renta" "false null" "$(body "$R" | jq -r '"\(.chargedToCustomer) \(.agreementId)"')"
R=$(req "$OFF" GET "/fleet/expenses?vehicleId=$CAR_D&type=FINE")
ck "  sale en /fleet/expenses como FINE" "FINE 40.00" "$(body "$R" | jq -r '.items[0] | "\(.type) \(.amount)"')"

echo
echo "== 5. Cambiar carro (RN-5) =="
R=$(handed "$CAR_B" "$PICKUP_10" "$BACK_10" 40.00 400.00)
ck "renta de 10 días a 40 pagada 400 -> 201" 201 "$(code "$R")"
B_ID=$(body "$R" | jq -r .id)
B_NO=$(body "$R" | jq -r .contractNumber)
R=$(req "$OFF" POST "/rentals/agreements/$B_ID/swap" "$(jq -nc --arg t "$SWAP_AT" --arg v "$CAR_C" '{at:$t,newVehicleId:$v,reason:"Falla"}')")
ck "body viejo -> 422" 422 "$(code "$R")"
CASH_BEFORE=$(cash_totals)
SWAP=$(jq -nc --arg t "$SWAP_AT" --arg v "$CAR_C" '{at:$t,newVehicleId:$v,reason:"Falla · frenos",returnInspection:{odometerKm:10300,fuelEighths:4},fuelCharge:"15.00",damageLines:[{zone:"hood",part:"Capó",amount:"25.00"}],pickupInspection:{odometerKm:5020,fuelEighths:8}}')
R=$(req "$OFF" POST "/rentals/agreements/$B_ID/swap" "$SWAP")
ck "swap completo -> 200" 200 "$(code "$R")"
OUT=$(body "$R")
ck "  vieja FINISHED con km de regreso" "FINISHED 10300" "$(echo "$OUT" | jq -r '.closed | "\(.status) \(.returnOdometerKm)"')"
ck "  vieja con combustible y daños" "15.00 25.00" "$(echo "$OUT" | jq -r '.closed | "\(.fuelCharge) \(.damageCharge)"')"
ck "  vieja 4 días: total 200, pagado 200, saldo 0" "4 200.00 200.00 0.00" "$(echo "$OUT" | jq -r '.closed | "\(.billableDays) \(.totals.total) \(.totals.paid) \(.totals.balance)"')"
ck "  nueva IN_PROGRESS con contrato nuevo" true "$(echo "$OUT" | jq --argjson n "$B_NO" '.opened.status == "IN_PROGRESS" and .opened.contractNumber != null and .opened.contractNumber != $n')"
ck "  nueva con km de salida 5020" 5020 "$(echo "$OUT" | jq -r .opened.pickupOdometerKm)"
ck "  nueva con la garantía retenida" "200.00 0.00" "$(echo "$OUT" | jq -r '"\(.opened.deposit) \(.closed.depositHeld)"')"
ck "  nueva con la tarifa de la vieja" "40.00" "$(echo "$OUT" | jq -r .opened.dailyRate)"
ck "  el excedente pasó a la nueva como pago" true "$(echo "$OUT" | jq '(.opened.totals.paid|tonumber) == 200 and (.opened.payments | length) == 1')"
ck "  la caja no cambió" "$CASH_BEFORE" "$(cash_totals)"
ck "  odómetro del carro nuevo en 5020" 5020 "$(body "$(req "$OFF" GET "/fleet/vehicles/$CAR_C")" | jq -r .odometerKm)"

echo
echo "== 6. Sin sesión =="
ck "POST swap sin sesión -> 401" 401 "$(code "$(req "$ANON" POST "/rentals/agreements/$B_ID/swap" "$SWAP")")"
ck "POST fines sin sesión -> 401" 401 "$(code "$(req "$ANON" POST /rentals/fines '{}')")"

echo
echo "== 7. Limpieza =="
NEW_ID=$(echo "$OUT" | jq -r .opened.id)
for id in "$A_ID" "$NEW_ID"; do
  req "$OFF" POST "/rentals/agreements/$id/checkin" "$(jq -nc --arg t "$(node -e 'console.log(new Date().toISOString())')" '{actualReturnAt:$t,inspection:{odometerKm:20000,fuelEighths:8},chargeExtraKm:false}')" >/dev/null
done
for id in "$CAR_A" "$CAR_B" "$CAR_C" "$CAR_D"; do req "$OFF" PATCH "/fleet/vehicles/$id" '{"status":"RETIRED"}' >/dev/null; done
req "$OFF" PATCH "/renters/$RENTER" '{"isActive":false}' >/dev/null
if [ "$OPENED_CASH" = true ]; then
  CURRENT=$(body "$(req "$OFF" GET /rentals/cash/current)")
  req "$OFF" POST /rentals/cash/close "$(jq -nc --arg c "$(echo "$CURRENT" | jq -r '.expectedCash // "0.00"')" '{countedCash:$c}')" >/dev/null
fi
echo "  rentas recibidas, carros retirados, cliente desactivado y caja como estaba"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
