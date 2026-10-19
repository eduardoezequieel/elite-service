#!/bin/bash
# Verificacion end-to-end de la spec 116 (Hoy: flujo y carros afuera).
#
# Comprueba salidas de hoy, rentas activas con regreso futuro/de hoy/atrasado,
# exclusión de reservas vencidas no retiradas, respuesta sin campos viejos y guards.
#
# Uso:
#   API_BASE_URL=http://localhost:3207/api bash scripts/verify-116.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3207/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
READER_EMAIL=sin.renta.vis116@elite.local
READER_PASSWORD=SinRenta116!
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
civil_of() {
  node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador'}).format(new Date(process.argv[1])))" "$1"
}

eval "$(node -e "
const fmt = new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador',year:'numeric',month:'2-digit',day:'2-digit'});
const today = fmt.format(new Date());
const day = (n) => fmt.format(new Date(Date.parse(today+'T12:00:00-06:00') + n*86400000));
const iso = (date, time) => new Date(date+'T'+time+':00-06:00').toISOString();
console.log('TODAY='+today);
console.log('YESTERDAY='+day(-1));
console.log('PICK_TODAY='+iso(today,'15:00'));
console.log('PICK_OLD='+iso(day(-3),'09:00'));
console.log('RETURN_TODAY='+iso(today,'23:45'));
console.log('RETURN_FUTURE='+iso(day(2),'15:00'));
console.log('RETURN_LATE='+iso(day(-1),'18:00'));
")"

OFF=$S/office.jar; RD=$S/reader.jar
rm -f "$OFF" "$RD"

echo "== 0. Sesion, carros y cliente =="
R=$(req "$OFF" POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
if [ "$(code "$R")" != 200 ]; then
  echo "  API no disponible o credenciales locales inválidas en $API; se detiene sin crear datos."
  exit 1
fi

car() {
  body "$(req "$OFF" POST /fleet/vehicles "{\"plate\":\"H116$1$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"35.00\",\"odometerKm\":10000}")" | jq -r .id
}
DEPARTURE_CAR=$(car A)
TODAY_CAR=$(car B)
FUTURE_CAR=$(car C)
LATE_CAR=$(car D)
MISSED_CAR=$(car E)
CUSTOMER=$(body "$(req "$OFF" POST /renters "{\"fullName\":\"Ana VIS116 $RUN\"}")" | jq -r .id)
ck "cinco carros y un cliente" true "$([ "$DEPARTURE_CAR" != null ] && [ "$TODAY_CAR" != null ] && [ "$FUTURE_CAR" != null ] && [ "$LATE_CAR" != null ] && [ "$MISSED_CAR" != null ] && [ "$CUSTOMER" != null ] && echo true)"

agreement() {
  local extra=${4:-'{}'}
  req "$OFF" POST /rentals/agreements "$(jq -nc --arg c "$CUSTOMER" --arg v "$1" --arg p "$2" --arg r "$3" --argjson extra "$extra" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r,includesVat:false} + $extra')"
}
checkout_extra() {
  jq -nc --arg at "$1" '{checkoutNow:true,checkout:{actualPickupAt:$at,inspection:{odometerKm:10000,fuelEighths:8}}}'
}

echo
echo "== 1. Hoy: salidas y carros afuera =="
DEPARTURE=$(body "$(agreement "$DEPARTURE_CAR" "$PICK_TODAY" "$RETURN_FUTURE")" | jq -r .id)
OUT_TODAY=$(body "$(agreement "$TODAY_CAR" "$PICK_OLD" "$RETURN_TODAY" "$(checkout_extra "$PICK_OLD")")" | jq -r .id)
OUT_FUTURE=$(body "$(agreement "$FUTURE_CAR" "$PICK_OLD" "$RETURN_FUTURE" "$(checkout_extra "$PICK_OLD")")" | jq -r .id)
OUT_LATE=$(body "$(agreement "$LATE_CAR" "$PICK_OLD" "$RETURN_LATE" "$(checkout_extra "$PICK_OLD")")" | jq -r .id)
MISSED=$(body "$(agreement "$MISSED_CAR" "$PICK_OLD" "$RETURN_FUTURE")" | jq -r .id)
R=$(req "$OFF" GET /rentals/reports/today)
ck "GET /rentals/reports/today -> 200" 200 "$(code "$R")"
ck "  la salida de hoy aparece una vez" 1 "$(body "$R" | jq --arg id "$DEPARTURE" '[.departures[]|select(.agreementId==$id)]|length')"
ck "  regreso de hoy aparece en out" TODAY "$(body "$R" | jq -r --arg id "$OUT_TODAY" '.out[]|select(.agreementId==$id)|.returnStatus')"
ck "  regreso futuro aparece en out" UPCOMING "$(body "$R" | jq -r --arg id "$OUT_FUTURE" '.out[]|select(.agreementId==$id)|.returnStatus')"
ck "  regreso vencido aparece en out" OVERDUE "$(body "$R" | jq -r --arg id "$OUT_LATE" '.out[]|select(.agreementId==$id)|.returnStatus')"
ck "  cada renta activa aparece una vez" 3 "$(body "$R" | jq --arg a "$OUT_TODAY" --arg b "$OUT_FUTURE" --arg c "$OUT_LATE" '[.out[].agreementId | select(.==$a or .==$b or .==$c)]|length')"
ck "  reserva vencida sin retirar no aparece en Hoy" 0 "$(body "$R" | jq --arg id "$MISSED" '[.departures[],.out[]|select(.agreementId==$id)]|length')"
ck "  ya no devuelve returns, overdue ni fleet" false "$(body "$R" | jq 'has("returns") or has("overdue") or has("fleet")')"

echo
echo "== 2. Permisos =="
R=$(req "$OFF" POST /roles '{"name":"Sin renta VIS116","permissionKeys":["fleet.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req "$OFF" GET "/roles?pageSize=100")" | jq -r '.items[]|select(.name=="Sin renta VIS116").id');;
esac
req "$OFF" POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Sin renta VIS116\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
req "$RD" POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}" >/dev/null
ck "sin rentals.read: hoy -> 403" 403 "$(code "$(req "$RD" GET /rentals/reports/today)")"

echo
echo "== 3. Limpieza =="
for id in "$DEPARTURE" "$MISSED"; do req "$OFF" POST "/rentals/agreements/$id/cancel" '{"reason":"Fin de verify-116"}' >/dev/null; done
RETURN_NOW=$(date -u +%Y-%m-%dT%H:%M:%S.000Z)
for id in "$OUT_TODAY" "$OUT_FUTURE" "$OUT_LATE"; do
  req "$OFF" POST "/rentals/agreements/$id/checkin" "$(jq -nc --arg t "$RETURN_NOW" '{actualReturnAt:$t,inspection:{odometerKm:10100,fuelEighths:8}}')" >/dev/null
done
for id in "$DEPARTURE_CAR" "$TODAY_CAR" "$FUTURE_CAR" "$LATE_CAR" "$MISSED_CAR"; do
  req "$OFF" PATCH "/fleet/vehicles/$id" '{"status":"RETIRED"}' >/dev/null
done
echo "  rentas cerradas y carros retirados"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
