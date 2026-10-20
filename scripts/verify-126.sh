#!/bin/bash
# Verificacion end-to-end de la spec 126 (combustible y danos al recibir).
#
# Una renta con cobertura aceptada, deducible 500 y garantia 200 se recibe con
# combustible 25 y danos por 650: damageCharge queda en el deducible, el
# combustible no toca extraCharges, el total suma los dos y la garantia sigue
# retenida. Otra con la cobertura declinada cobra los 650. Un monto negativo es
# 422 y sin sesion es 401.
#
# Uso:
#   API_BASE_URL=http://localhost:3200/api bash scripts/verify-126.sh
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
TAG="VIS126 $RUN"

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

eval "$(node -e "
const now = Date.now();
const iso = (hours) => new Date(now + hours * 3600000).toISOString();
console.log('PICKUP_AT='+iso(-48));
console.log('PLANNED_BACK='+iso(24));
console.log('RETURN_AT='+iso(-1));
")"

OFF=$S/office.jar; ANON=$S/anon.jar
rm -f "$OFF" "$ANON"

echo "== 0. Sesion, carros y cliente =="
R=$(req "$OFF" POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
if [ "$(code "$R")" != 200 ]; then
  echo "  API no disponible o credenciales locales inválidas en $API; se detiene sin crear datos."
  exit 1
fi

car() {
  body "$(req "$OFF" POST /fleet/vehicles "{\"plate\":\"V126$1$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"35.00\",\"odometerKm\":10000}")" | jq -r .id
}
CAR_A=$(car A); CAR_B=$(car B); CAR_C=$(car C)
RENTER=$(body "$(req "$OFF" POST /renters "{\"fullName\":\"Ana $TAG\"}")" | jq -r .id)
ck "tres carros y un cliente" true "$([ "$CAR_A" != null ] && [ "$CAR_B" != null ] && [ "$CAR_C" != null ] && [ "$RENTER" != null ] && echo true)"

# Una renta entregada hace dos días, sin IVA ni CDW, con su cobertura y garantía.
handed() {
  req "$OFF" POST /rentals/agreements "$(jq -nc --arg c "$RENTER" --arg v "$1" --arg p "$PICKUP_AT" --arg r "$PLANNED_BACK" --arg cov "$2" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r,includesVat:false,cdwPerDay:"0.00",coverage:$cov,deductible:"500.00",deposit:"200.00",depositMethod:"CASH",checkoutNow:true,checkout:{actualPickupAt:$p,inspection:{odometerKm:10000,fuelEighths:8}}}')"
}
DAMAGES='[{"zone":"hood","part":"Capó","amount":"400.00"},{"part":"Tapicería","amount":"250.00"}]'
checkin_body() {
  jq -nc --arg t "$RETURN_AT" --arg fuel "$1" --argjson lines "$2" '{actualReturnAt:$t,inspection:{odometerKm:10100,fuelEighths:4},fuelCharge:$fuel,damageLines:$lines,damageCharge:"1.00"}'
}

echo
echo "== 1. Cobertura aceptada: daños topados al deducible =="
R=$(handed "$CAR_A" ACCEPTED)
ck "renta ACCEPTED entregada -> 201" 201 "$(code "$R")"
A_ID=$(body "$R" | jq -r .id)
ck "  garantía retenida 200.00" "200.00" "$(body "$R" | jq -r .depositHeld)"
R=$(req "$OFF" POST "/rentals/agreements/$A_ID/checkin" "$(checkin_body 25.00 "$DAMAGES")")
ck "recibir con combustible 25 y daños 650 -> 200" 200 "$(code "$R")"
ck "  damageCharge 500.00 (el body no lo fija)" "500.00" "$(body "$R" | jq -r .damageCharge)"
ck "  fuelCharge 25.00" "25.00" "$(body "$R" | jq -r .fuelCharge)"
ck "  extraCharges sin cambio" "0.00" "$(body "$R" | jq -r .extraCharges)"
ck "  dos líneas con su monto original" "400.00 250.00" "$(body "$R" | jq -r '[.damageLines[].amount]|join(" ")')"
ck "  la línea libre queda sin zona" null "$(body "$R" | jq -r '.damageLines[1].zone')"
ck "  total = renta + km extra + 25 + 500" true "$(body "$R" | jq '(.totals.total|tonumber) == ((.totals.rental|tonumber) + (.extraKmCharge|tonumber) + 525)')"
ck "  la garantía no baja el saldo" true "$(body "$R" | jq '.totals.balance == .totals.total')"
ck "  depositHeld sigue en 200.00" "200.00" "$(body "$R" | jq -r .depositHeld)"
R=$(req "$OFF" GET "/rentals/agreements/$A_ID")
ck "  GET la devuelve igual" "500.00 25.00" "$(body "$R" | jq -r '"\(.damageCharge) \(.fuelCharge)"')"

echo
echo "== 2. Cobertura declinada: daños completos =="
R=$(handed "$CAR_B" DECLINED)
ck "renta DECLINED entregada -> 201" 201 "$(code "$R")"
B_ID=$(body "$R" | jq -r .id)
R=$(req "$OFF" POST "/rentals/agreements/$B_ID/checkin" "$(checkin_body 0 "$DAMAGES")")
ck "recibir con daños 650 -> 200" 200 "$(code "$R")"
ck "  damageCharge 650.00" "650.00" "$(body "$R" | jq -r .damageCharge)"
ck "  fuelCharge 0.00" "0.00" "$(body "$R" | jq -r .fuelCharge)"

echo
echo "== 3. Montos inválidos =="
R=$(handed "$CAR_C" ACCEPTED)
C_ID=$(body "$R" | jq -r .id)
R=$(req "$OFF" POST "/rentals/agreements/$C_ID/checkin" "$(checkin_body 0 '[{"part":"Capó","amount":"-5.00"}]')")
ck "daño negativo -> 422" 422 "$(code "$R")"
R=$(req "$OFF" POST "/rentals/agreements/$C_ID/checkin" "$(checkin_body -5 '[]')")
ck "combustible negativo -> 422" 422 "$(code "$R")"
ck "  la renta sigue en curso" IN_PROGRESS "$(body "$(req "$OFF" GET "/rentals/agreements/$C_ID")" | jq -r .status)"

echo
echo "== 4. Sin sesión =="
ck "POST checkin sin sesión -> 401" 401 "$(code "$(req "$ANON" POST "/rentals/agreements/$C_ID/checkin" "$(checkin_body 0 '[]')")")"

echo
echo "== 5. Limpieza =="
req "$OFF" POST "/rentals/agreements/$C_ID/cancel" '{"reason":"Fin de verify-126"}' >/dev/null
for id in "$CAR_A" "$CAR_B" "$CAR_C"; do req "$OFF" PATCH "/fleet/vehicles/$id" '{"status":"RETIRED"}' >/dev/null; done
req "$OFF" PATCH "/renters/$RENTER" '{"isActive":false}' >/dev/null
echo "  renta en curso cancelada, carros retirados y cliente desactivado"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
