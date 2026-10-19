#!/bin/bash
# Verificacion end-to-end de la spec 118 (nueva renta en cuatro pasos).
#
# Comprueba las cifras de cada cliente en GET /renters (rentalsCount y
# lastRentalAt), el orden sort=recent, el tope del descuento (RN-1) en el alta y
# en la edicion, y que sin sesion todo responde 401.
#
# Uso:
#   API_BASE_URL=http://localhost:3218/api bash scripts/verify-118.sh
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
TAG="VIS118 $RUN"

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
urlq() { node -e "console.log(encodeURIComponent(process.argv[1]))" "$1"; }

eval "$(node -e "
const fmt = new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador',year:'numeric',month:'2-digit',day:'2-digit'});
const today = fmt.format(new Date());
const day = (n) => fmt.format(new Date(Date.parse(today+'T12:00:00-06:00') + n*86400000));
const iso = (n, time) => new Date(day(n)+'T'+time+':00-06:00').toISOString();
console.log('ANA_OUT='+iso(-10,'09:00'));
console.log('BETO_OUT='+iso(-3,'09:00'));
console.log('BACK_LATER='+iso(5,'09:00'));
console.log('RES_FROM='+iso(10,'09:00'));
console.log('RES_TO='+iso(12,'09:00'));
console.log('CANCEL_FROM='+iso(20,'09:00'));
console.log('CANCEL_TO='+iso(21,'09:00'));
console.log('DISC_FROM='+iso(30,'09:00'));
console.log('DISC_TO='+iso(32,'09:00'));
")"

OFF=$S/office.jar; ANON=$S/anon.jar
rm -f "$OFF" "$ANON"

echo "== 0. Sesion, carros y clientes =="
R=$(req "$OFF" POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
if [ "$(code "$R")" != 200 ]; then
  echo "  API no disponible o credenciales locales inválidas en $API; se detiene sin crear datos."
  exit 1
fi

car() {
  body "$(req "$OFF" POST /fleet/vehicles "{\"plate\":\"V118$1$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"35.00\",\"odometerKm\":10000}")" | jq -r .id
}
renter() {
  body "$(req "$OFF" POST /renters "{\"fullName\":\"$1 $TAG\"${2:-}}")" | jq -r .id
}
CAR_A=$(car A); CAR_B=$(car B); CAR_C=$(car C)
ANA=$(renter Ana); BETO=$(renter Beto)
CARLA=$(renter Carla ",\"documentId\":\"${RUN}45-6\",\"mobilePhone\":\"7${RUN:0:3}-${RUN:3:3}0\"")
ck "tres carros y tres clientes" true "$([ "$CAR_A" != null ] && [ "$CAR_B" != null ] && [ "$CAR_C" != null ] && [ "$ANA" != null ] && [ "$BETO" != null ] && [ "$CARLA" != null ] && echo true)"

agreement() {
  local extra=${5:-'{}'}
  req "$OFF" POST /rentals/agreements "$(jq -nc --arg c "$1" --arg v "$2" --arg p "$3" --arg r "$4" --argjson extra "$extra" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r,includesVat:false,cdwPerDay:"0.00"} + $extra')"
}
checkout_extra() {
  jq -nc --arg at "$1" '{checkoutNow:true,checkout:{actualPickupAt:$at,inspection:{odometerKm:10000,fuelEighths:8}}}'
}

echo
echo "== 1. Cifras de cada cliente en GET /renters =="
R=$(agreement "$ANA" "$CAR_A" "$ANA_OUT" "$BACK_LATER" "$(checkout_extra "$ANA_OUT")")
ck "Ana se llevó un carro hace 10 días -> 201" 201 "$(code "$R")"
ANA_OUT_ID=$(body "$R" | jq -r .id)
R=$(agreement "$BETO" "$CAR_B" "$BETO_OUT" "$BACK_LATER" "$(checkout_extra "$BETO_OUT")")
ck "Beto se llevó un carro hace 3 días -> 201" 201 "$(code "$R")"
BETO_OUT_ID=$(body "$R" | jq -r .id)
R=$(agreement "$ANA" "$CAR_C" "$RES_FROM" "$RES_TO")
ck "Ana reserva para dentro de 10 días -> 201" 201 "$(code "$R")"
ANA_RES_ID=$(body "$R" | jq -r .id)
R=$(agreement "$ANA" "$CAR_C" "$CANCEL_FROM" "$CANCEL_TO")
ANA_CANCEL_ID=$(body "$R" | jq -r .id)
ck "Ana cancela otra reserva -> 200" 200 "$(code "$(req "$OFF" POST "/rentals/agreements/$ANA_CANCEL_ID/cancel" '{"reason":"verify-118"}')")"

Q=$(urlq "$TAG")
R=$(req "$OFF" GET "/renters?q=$Q")
ck "GET /renters?q -> 200" 200 "$(code "$R")"
ck "  cada ítem trae rentalsCount y lastRentalAt" true "$(body "$R" | jq '[.items[]|has("rentalsCount") and has("lastRentalAt")]|all and length==3')"
ck "  Ana: 2 rentas (la cancelada no cuenta)" 2 "$(body "$R" | jq --arg id "$ANA" '.items[]|select(.id==$id).rentalsCount')"
ck "  Ana: la última es la salida de hace 10 días" "$ANA_OUT" "$(body "$R" | jq -r --arg id "$ANA" '.items[]|select(.id==$id).lastRentalAt')"
ck "  Beto: 1 renta, hace 3 días" "1 $BETO_OUT" "$(body "$R" | jq -r --arg id "$BETO" '.items[]|select(.id==$id)|"\(.rentalsCount) \(.lastRentalAt)"')"
ck "  Carla: cliente nuevo" "0 null" "$(body "$R" | jq -r --arg id "$CARLA" '.items[]|select(.id==$id)|"\(.rentalsCount) \(.lastRentalAt)"')"
ck "  sin sort: por nombre" "Ana Beto Carla" "$(body "$R" | jq -r '[.items[].fullName|split(" ")[0]]|join(" ")')"

R=$(req "$OFF" GET "/renters?q=$Q&sort=recent")
ck "GET /renters?sort=recent -> 200" 200 "$(code "$R")"
ck "  la renta más reciente primero; sin rentas al final" "Beto Ana Carla" "$(body "$R" | jq -r '[.items[].fullName|split(" ")[0]]|join(" ")')"
ck "GET /renters?sort=otro -> 422" 422 "$(code "$(req "$OFF" GET "/renters?sort=otro")")"
R=$(req "$OFF" GET "/renters?q=$(urlq "beto $RUN")")
ck "  todas las palabras en el nombre, en cualquier orden" true "$(body "$R" | jq --arg b "$BETO" --arg a "$ANA" '(.items|map(.id)) as $ids | ($ids|index($b)) != null and ($ids|index($a)) == null')"
R=$(req "$OFF" GET "/renters?q=${RUN}456")
ck "  el DUI sin guion encuentra al cliente" "$CARLA" "$(body "$R" | jq -r '.items|map(.id)|join(",")')"
R=$(req "$OFF" GET "/renters?q=7${RUN}0")
ck "  el celular sin guion encuentra al cliente" "$CARLA" "$(body "$R" | jq -r '.items|map(.id)|join(",")')"

echo
echo "== 2. RN-1: el descuento no pasa del subtotal =="
R=$(agreement "$CARLA" "$CAR_C" "$DISC_FROM" "$DISC_TO" '{"discount":"70.01"}')
ck "alta con descuento > (35 × 2) -> 422" 422 "$(code "$R")"
ck "  code DISCOUNT_EXCEEDS_SUBTOTAL" DISCOUNT_EXCEEDS_SUBTOTAL "$(body "$R" | jq -r .code)"
ck "  trae message" true "$(body "$R" | jq '(.message|type)=="string" and (.message|length)>0')"
R=$(agreement "$CARLA" "$CAR_C" "$DISC_FROM" "$DISC_TO" '{"discount":"70.00","extraCharges":"0.00"}')
ck "alta con descuento igual al subtotal -> 201" 201 "$(code "$R")"
DISC_ID=$(body "$R" | jq -r .id)
ck "  total en cero" "0.00" "$(body "$R" | jq -r .totals.total)"
R=$(req "$OFF" PATCH "/rentals/agreements/$DISC_ID" '{"discount":"70.01"}')
ck "edición con descuento > subtotal -> 422" 422 "$(code "$R")"
ck "  code DISCOUNT_EXCEEDS_SUBTOTAL" DISCOUNT_EXCEEDS_SUBTOTAL "$(body "$R" | jq -r .code)"
R=$(req "$OFF" PATCH "/rentals/agreements/$DISC_ID" '{"discount":"60.00"}')
ck "edición con descuento válido -> 200" 200 "$(code "$R")"
ck "  total 10.00" "10.00" "$(body "$R" | jq -r .totals.total)"

echo
echo "== 3. Sin sesión =="
ck "GET /renters sin sesión -> 401" 401 "$(code "$(req "$ANON" GET "/renters?sort=recent")")"
ck "POST /rentals/agreements sin sesión -> 401" 401 "$(code "$(req "$ANON" POST /rentals/agreements '{}')")"
ck "PATCH /rentals/agreements/:id sin sesión -> 401" 401 "$(code "$(req "$ANON" PATCH "/rentals/agreements/$DISC_ID" '{"discount":"1.00"}')")"

echo
echo "== 4. Limpieza =="
for id in "$ANA_RES_ID" "$DISC_ID"; do req "$OFF" POST "/rentals/agreements/$id/cancel" '{"reason":"Fin de verify-118"}' >/dev/null; done
RETURN_NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
for id in "$ANA_OUT_ID" "$BETO_OUT_ID"; do
  req "$OFF" POST "/rentals/agreements/$id/checkin" "$(jq -nc --arg t "$RETURN_NOW" '{actualReturnAt:$t,inspection:{odometerKm:10100,fuelEighths:8}}')" >/dev/null
done
for id in "$CAR_A" "$CAR_B" "$CAR_C"; do req "$OFF" PATCH "/fleet/vehicles/$id" '{"status":"RETIRED"}' >/dev/null; done
for id in "$ANA" "$BETO" "$CARLA"; do req "$OFF" PATCH "/renters/$id" '{"isActive":false}' >/dev/null; done
echo "  rentas cerradas, carros retirados y clientes desactivados"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
