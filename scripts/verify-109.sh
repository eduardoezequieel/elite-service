#!/bin/bash
# Verificacion end-to-end de la spec 109 (turno de caja de la renta).
#
# Lo que prueba y `pnpm test` no puede: el indice unico de un solo turno OPEN,
# el cobro que exige caja, el snapshot del cierre y el 403 de `rentals.charge`.
#
# Uso:
#   API_BASE_URL=http://localhost:3209/api bash scripts/verify-109.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3209/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
envv() { grep "^$1=" .env | cut -d= -f2-; }
ADMIN_EMAIL=$(envv ADMIN_EMAIL)
ADMIN_PASSWORD=$(envv ADMIN_PASSWORD)
READER_EMAIL=renta.vis109@elite.local
READER_PASSWORD=Renta109!
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
iso() { date -u -v"$1" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -d "$2" +%Y-%m-%dT%H:%M:%SZ; }

OFF=$S/office.jar; RDR=$S/reader.jar
rm -f "$OFF" "$RDR"

echo "== 0. Sesion =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /roles '{"name":"Renta lectura VIS109","permissionKeys":["rentals.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?pageSize=100")" | jq -r '.items[]|select(.name=="Renta lectura VIS109").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Lectura VIS109\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
R=$(req $RDR POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}")
ck "login con solo rentals.read -> 200" 200 "$(code "$R")"

echo
echo "== 1. Sin turno no se cobra =="
CURRENT=$(body "$(req $OFF GET /rentals/cash/current)")
if [ "$CURRENT" != "null" ]; then
  req $OFF POST /rentals/cash/close "$(jq -nc --arg c "$(echo "$CURRENT" | jq -r '.expectedCash // "0.00"')" '{countedCash:$c}')" >/dev/null
fi
ck "GET /rentals/cash/current sin turno -> null" null "$(body "$(req $OFF GET /rentals/cash/current)")"

R=$(req $OFF POST /fleet/vehicles "{\"plate\":\"P109$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"25.00\"}")
ck "crear carro -> 201" 201 "$(code "$R")"
CAR=$(body "$R" | jq -r .id)
PLATE=$(body "$R" | jq -r .plate)
R=$(req $OFF POST /renters "{\"fullName\":\"Cliente VIS109 $RUN\"}")
ck "crear cliente -> 201" 201 "$(code "$R")"
RENTER=$(body "$R" | jq -r .id)
CUSTOMER=$(body "$R" | jq -r .fullName)

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
ck "crear renta entregada -> 201" 201 "$(code "$R")"
AGR=$(body "$R" | jq -r '.id // .opened.id')
CONTRACT=$(body "$R" | jq -r '.contractNumber // .opened.contractNumber')

R=$(req $OFF POST /rentals/agreements/$AGR/payments '{"amount":"10.00","method":"CASH"}')
ck "pago sin turno -> 409 CASH_NOT_OPEN" "409 CASH_NOT_OPEN" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  el mensaje es el de la spec" "Abrí la caja para cobrar." "$(body "$R" | jq -r .message)"

R=$(req $OFF POST /fleet/vehicles "{\"plate\":\"P109B$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"25.00\"}")
CAR2=$(body "$R" | jq -r .id)
R=$(req $OFF POST /rentals/agreements "$(jq -nc \
  --arg c "$RENTER" --arg v "$CAR2" --arg p "$PICKUP" --arg r "$RETURN" --argjson i "$INSPECTION" \
  '{customerId:$c, vehicleId:$v, plannedPickupAt:$p, plannedReturnAt:$r,
    pickupLocation:"Oficina", returnLocation:"Oficina", dailyRate:"25.00", billableDays:2,
    coverage:"UNDEFINED", includesVat:true, extraCharges:"0", extraChargesNote:null,
    discount:"0", deposit:"0.00", depositMethod:null}')")
AGR2=$(body "$R" | jq -r '.id // .opened.id')
CHECKOUT=$(jq -nc --arg t "$PICKUP" --argjson i "$INSPECTION" \
  '{actualPickupAt:$t, inspection:$i, payment:{amount:"10.00", method:"CARD"}}')
R=$(req $OFF POST /rentals/agreements/$AGR2/checkout "$CHECKOUT")
ck "checkout sin turno -> 409 CASH_NOT_OPEN" "409 CASH_NOT_OPEN" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  el checkout dice que hay que abrir la caja" "Abrí la caja para cobrar." "$(body "$R" | jq -r .message)"

echo
echo "== 2. Abrir =="
ck "fondo negativo -> 422" 422 "$(code "$(req $OFF POST /rentals/cash/open '{"openingFloat":"-1"}')")"
R=$(req $OFF POST /rentals/cash/open '{"openingFloat":"20.00"}')
ck "abrir con fondo 20 -> 201 OPEN" "201 OPEN" "$(code "$R") $(body "$R" | jq -r .status)"
SID=$(body "$R" | jq -r .id)
R=$(req $OFF POST /rentals/cash/open '{"openingFloat":"0.00"}')
ck "segundo turno -> 409 CASH_ALREADY_OPEN" "409 CASH_ALREADY_OPEN" "$(code "$R") $(body "$R" | jq -r .code)"
ck "sin rentals.charge: current -> 403" 403 "$(code "$(req $RDR GET /rentals/cash/current)")"
ck "sin rentals.charge: sessions -> 403" 403 "$(code "$(req $RDR GET /rentals/cash/sessions)")"
ck "sin rentals.charge: open -> 403" 403 "$(code "$(req $RDR POST /rentals/cash/open '{"openingFloat":"0.00"}')")"
ck "sin rentals.charge: close -> 403" 403 "$(code "$(req $RDR POST /rentals/cash/close '{"countedCash":"0.00"}')")"
ck "sin rentals.charge: el turno -> 403" 403 "$(code "$(req $RDR GET /rentals/cash/sessions/$SID)")"
ck "turno que no existe -> 404" 404 "$(code "$(req $OFF GET /rentals/cash/sessions/00000000-0000-4000-8000-000000000099)")"
R=$(req $OFF POST /rentals/agreements/$AGR2/checkout "$CHECKOUT")
ck "checkout con turno -> 200" 200 "$(code "$R")"
ck "  el cobro de la entrega liga el turno" "$SID" "$(body "$R" | jq -r '.payments[0].cashSessionId')"

echo
echo "== 3. Cobros del turno =="
R=$(req $OFF POST /rentals/agreements/$AGR/payments '{"amount":"30.00","method":"CASH","reference":"VIS109"}')
ck "pago en efectivo -> 201" 201 "$(code "$R")"
PAY=$(body "$R" | jq -r .id)
ck "  cashSessionId es el turno abierto" "$SID" "$(body "$R" | jq -r .cashSessionId)"
ck "pago con tarjeta -> 201" 201 "$(code "$(req $OFF POST /rentals/agreements/$AGR/payments '{"amount":"10.00","method":"CARD"}')")"
R=$(req $OFF POST /rentals/agreements/$AGR/payments '{"amount":"5.00","method":"OTHER","note":"Ajuste"}')
ck "pago otro -> 201" 201 "$(code "$R")"
OTHER=$(body "$R" | jq -r .id)
ck "anular el otro con el turno abierto -> 200" 200 "$(code "$(req $OFF POST /rentals/payments/$OTHER/void '{"reason":"Error"}')")"
R=$(req $OFF POST /rentals/agreements/$AGR/payments '{"amount":"4.00","method":"OTHER","note":"Peaje"}')
ck "otro vigente -> 201" 201 "$(code "$R")"

R=$(req $OFF GET /rentals/cash/current)
ck "current: OTHER no entra al esperado" "20.00 30.00 20.00 4.00 50.00 4" "$(body "$R" | jq -r '"\(.openingFloat) \(.cashTotal) \(.cardTotal) \(.otherTotal) \(.expectedCash) \(.paymentCount)"')"
R=$(req $OFF GET "/rentals/cash/sessions/$SID?page=1&pageSize=1")
ck "cobros del turno paginan" "200 1 1 4" "$(code "$R") $(body "$R" | jq -r '"\(.payments.pageSize) \(.payments.items|length) \(.payments.total)"')"
R=$(req $OFF GET /rentals/cash/sessions/$SID)
ck "detalle: placa, cliente y referencia" "$PLATE|$CUSTOMER|VIS109" "$(body "$R" | jq -r --arg id "$PAY" '.payments.items[]|select(.id==$id)|"\(.detail.plate)|\(.detail.customerName)|\(.reference)"')"
ck "detalle: contractNumber" "$CONTRACT" "$(body "$R" | jq -r --arg id "$PAY" '.payments.items[]|select(.id==$id)|.detail.contractNumber')"

echo
echo "== 4. Cierre =="
R=$(req $OFF POST /rentals/cash/close '{"countedCash":"48.00"}')
ck "cerrar -> 200 CLOSED diferencia -2" "200 CLOSED -2.00 30.00 20.00 4.00 50.00" "$(code "$R") $(body "$R" | jq -r '"\(.status) \(.differenceCash) \(.cashTotal) \(.cardTotal) \(.otherTotal) \(.expectedCash)"')"
ck "anular un cobro del turno cerrado -> 409 CASH_SESSION_CLOSED" "409 CASH_SESSION_CLOSED" "$(R=$(req $OFF POST /rentals/payments/$PAY/void '{"reason":"Tarde"}'); echo "$(code "$R") $(body "$R" | jq -r .code)")"
ck "GET /rentals/cash -> 404" 404 "$(code "$(req $OFF GET /rentals/cash)")"
ck "GET /rentals/cash?date -> 404" 404 "$(code "$(req $OFF GET '/rentals/cash?date=2026-10-01')")"
R=$(req $OFF GET '/rentals/cash/sessions?page=1&pageSize=1')
ck "sessions es una Page" "200 1 1 1" "$(code "$R") $(body "$R" | jq -r '"\(.page) \(.pageSize) \(.items|length)"')"
ck "sessions guarda el total" true "$(body "$R" | jq -r '.total >= 1')"
ck "el cierre esta en el historial" 1 "$(body "$(req $OFF GET /rentals/cash/sessions)" | jq --arg id "$SID" '[.items[]|select(.id==$id)]|length')"
ck "cuentas por cobrar siguen -> 200" 200 "$(code "$(req $OFF GET /rentals/receivables)")"
ck "sin turno otra vez" null "$(body "$(req $OFF GET /rentals/cash/current)")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
