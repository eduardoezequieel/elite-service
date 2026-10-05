#!/bin/bash
# Verificacion end-to-end de la spec 107 (Hoy).
#
# Lo que prueba y `pnpm test` no puede: el dia civil de El Salvador contra la
# base, una salida de hoy, un atraso de ayer una sola vez, el cobro del dia y
# los guards. El tablero ya no existe.
#
# Uso:
#   API_BASE_URL=http://localhost:3207/api bash scripts/verify-107.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3207/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
READER_EMAIL=sin.renta.vis107@elite.local
READER_PASSWORD=SinRenta107!
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
const yesterday = fmt.format(new Date(Date.parse(today+'T12:00:00-06:00') - 86400000));
const iso = (day, time) => new Date(day+'T'+time+':00-06:00').toISOString();
const later = fmt.format(new Date(Date.parse(today+'T12:00:00-06:00') + 2*86400000));
const before = fmt.format(new Date(Date.parse(today+'T12:00:00-06:00') - 3*86400000));
console.log('TODAY='+today);
console.log('YESTERDAY='+yesterday);
console.log('PICK_TODAY='+iso(today,'15:00'));
console.log('BACK_LATER='+iso(later,'15:00'));
console.log('PICK_OLD='+iso(before,'09:00'));
console.log('BACK_YDAY='+iso(yesterday,'18:00'));
")"

OFF=$S/office.jar; RD=$S/reader.jar
rm -f "$OFF" "$RD"

echo "== 0. Sesion, carros y cliente =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

car() {
  body "$(req $OFF POST /fleet/vehicles "{\"plate\":\"H07$1$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"35.00\",\"odometerKm\":10000}")" | jq -r .id
}
LEAVE=$(car A); LATE=$(car B)
ANA=$(body "$(req $OFF POST /renters "{\"fullName\":\"Ana VIS107 $RUN\"}")" | jq -r .id)
ck "dos carros y un cliente" "true" "$([ "$LEAVE" != null ] && [ "$LATE" != null ] && [ "$ANA" != null ] && echo true)"

agreement() {
  local extra=${4:-'{}'}
  req $OFF POST /rentals/agreements "$(jq -nc --arg c "$ANA" --arg v "$1" --arg p "$2" --arg r "$3" --argjson extra "$extra" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r,includesVat:false} + $extra')"
}

echo
echo "== 1. Hoy: sale hoy, atraso de ayer, cobrado =="
D=$(body "$(agreement "$LEAVE" "$PICK_TODAY" "$BACK_LATER")" | jq -r .id)
L=$(body "$(agreement "$LATE" "$PICK_OLD" "$BACK_YDAY" "$(jq -nc --arg t "$PICK_OLD" '{checkoutNow:true,checkout:{actualPickupAt:$t,inspection:{odometerKm:10000,fuelEighths:8}}}')")" | jq -r .id)
BEFORE=$(body "$(req $OFF GET /rentals/reports/today)" | jq -r .collected.total)
R=$(req $OFF POST /rentals/agreements/$L/payments '{"amount":"30.00","method":"CASH"}')
ck "pago de hoy -> 201" 201 "$(code "$R")"
R=$(req $OFF GET /rentals/reports/today)
ck "GET /rentals/reports/today -> 200" 200 "$(code "$R")"
ck "  el dia es hoy" "$TODAY" "$(body "$R" | jq -r .date)"
ck "  la que sale hoy esta en departures" 1 "$(body "$R" | jq --arg id "$D" '[.departures[]|select(.agreementId==$id)]|length')"
ck "  el atraso de ayer esta una vez en overdue" 1 "$(body "$R" | jq --arg id "$L" '[.overdue[]|select(.agreementId==$id)]|length')"
ck "  y no esta en returns" 0 "$(body "$R" | jq --arg id "$L" '[.returns[]|select(.agreementId==$id)]|length')"
LATE_AT=$(body "$R" | jq -r --arg id "$L" '.overdue[]|select(.agreementId==$id)|.at')
ck "  con la fecha de ayer" "$YESTERDAY" "$(civil_of "$LATE_AT")"
AFTER=$(body "$R" | jq -r .collected.total)
ck "  el pago de hoy suma 30.00" "30.00" "$(node -e "const a=Number(process.argv[1]), b=Number(process.argv[2]); console.log((a-b).toFixed(2))" "$AFTER" "$BEFORE")"

echo
echo "== 2. Permisos y tablero borrado =="
ck "dashboard -> 404" 404 "$(code "$(req $OFF GET /rentals/reports/dashboard)")"
R=$(req $OFF POST /roles '{"name":"Sin renta VIS107","permissionKeys":["fleet.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?pageSize=100")" | jq -r '.items[]|select(.name=="Sin renta VIS107").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Sin renta VIS107\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
req $RD POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}" >/dev/null
ck "sin rentals.read: hoy -> 403" 403 "$(code "$(req $RD GET /rentals/reports/today)")"

echo
echo "== Limpieza =="
req $OFF POST /rentals/agreements/$D/cancel '{"reason":"Fin de verify-107"}' >/dev/null
req $OFF POST /rentals/agreements/$L/checkin "$(jq -nc --arg t "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" '{actualReturnAt:$t,inspection:{odometerKm:10100,fuelEighths:8}}')" >/dev/null
for id in $LEAVE $LATE; do req $OFF PATCH /fleet/vehicles/$id '{"status":"RETIRED"}' >/dev/null; done
echo "  rentas de prueba cerradas y carros retirados"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
