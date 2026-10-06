#!/bin/bash
# Verificacion end-to-end de la spec 110 (flota simplificada).
#
# Disponibilidad del dia, avisos, un servicio con costo que deja un solo gasto
# y al borrarse se lo lleva, retirados fuera de la lista, 403 sin fleet.read,
# rentabilidad sin ocupacion, y el relleno idempotente de gastos de servicio.
#
# Uso (base elite_verify_110, API en 3210):
#   API_BASE_URL=http://localhost:3210/api bash scripts/verify-110.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3210/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
READER_EMAIL=sin.flota.vis110@elite.local
READER_PASSWORD=SinFlota110!
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
day() {
  local n=$1
  case "$n" in -*|+*) ;; *) n="+$n" ;; esac
  TZ=America/El_Salvador date -v"${n}"d +%F 2>/dev/null || TZ=America/El_Salvador date -d "${n} days" +%F
}

DB_URL=${DATABASE_URL:-$(grep '^DATABASE_URL=' .env | cut -d= -f2- | sed 's#/elite_service?#/elite_verify_110?#')}
case "$DB_URL" in
  *elite_verify_110*) ;;
  *) echo "verify-110 solo corre contra elite_verify_110"; exit 1 ;;
esac
# psql no acepta el ?schema= de Prisma.
psql_url() {
  node -e 'const u = new URL(process.argv[1]); u.searchParams.delete("schema"); process.stdout.write(u.href);' "$1"
}
sql() { psql "$(psql_url "$DB_URL")" -q -v ON_ERROR_STOP=1 -tA -c "$1"; }

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
INSPECT='{"odometerKm":10000,"fuelEighths":8}'

echo "== 0. Sesion, carros y cliente =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

car() {
  local extra=${2:-'{}'}
  body "$(req $OFF POST /fleet/vehicles "$(jq -nc --arg plate "V110$1$RUN" --argjson extra "$extra" '{plate:$plate,make:"Kia",model:"Rio",dailyRate:"35.00",odometerKm:10000} + $extra')")" | jq -r .id
}
FREE=$(car F)
RESERVED=$(car R)
RENTED=$(car E)
OVERDUE=$(car O)
SHOP=$(car S)
RETIRED=$(car X)
ALERT=$(car A "{\"odometerKm\":51200,\"insuranceExpiresAt\":\"$(day +3)\"}")
ck "siete carros" true "$([ "$FREE" != null ] && [ "$ALERT" != null ] && echo true)"

ANA=$(body "$(req $OFF POST /renters "{\"fullName\":\"Ana VIS110 $RUN\"}")" | jq -r .id)
ck "un cliente" true "$([ "$ANA" != null ] && [ "$ANA" != "" ] && echo true)"

agree() {
  local extra=${4:-'{}'}
  req $OFF POST /rentals/agreements "$(jq -nc --arg c "$ANA" --arg v "$1" --arg p "$2" --arg r "$3" --argjson extra "$extra" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r,includesVat:false} + $extra')"
}

echo
echo "== 1. Disponibilidad del dia =="
DRES=$(body "$(agree "$RESERVED" "$PICK_TODAY" "$BACK_LATER")" | jq -r .id)
DRENT=$(body "$(agree "$RENTED" "$PICK_OLD" "$BACK_LATER" "$(jq -nc --arg t "$PICK_OLD" --argjson i "$INSPECT" '{checkoutNow:true,checkout:{actualPickupAt:$t,inspection:$i}}')")" | jq -r .id)
DLATE=$(body "$(agree "$OVERDUE" "$PICK_OLD" "$BACK_YDAY" "$(jq -nc --arg t "$PICK_OLD" --argjson i "$INSPECT" '{checkoutNow:true,checkout:{actualPickupAt:$t,inspection:$i}}')")" | jq -r .id)
req $OFF PATCH /fleet/vehicles/$SHOP '{"status":"IN_SHOP"}' >/dev/null
req $OFF PATCH /fleet/vehicles/$RETIRED '{"status":"RETIRED"}' >/dev/null

avail() { body "$(req $OFF GET /fleet/vehicles/$1)" | jq -r .availability; }
ck "libre" FREE "$(avail "$FREE")"
ck "reservado hoy" RESERVED "$(avail "$RESERVED")"
ck "en renta" RENTED "$(avail "$RENTED")"
ck "atrasado" OVERDUE "$(avail "$OVERDUE")"
ck "taller" WORKSHOP "$(avail "$SHOP")"
ck "retirado no tiene dia" null "$(avail "$RETIRED")"
ck "la lista no trae al retirado" 0 "$(body "$(req $OFF GET "/fleet/vehicles?q=V110X$RUN&pageSize=100")" | jq --arg id "$RETIRED" '[.items[]|select(.id==$id)]|length')"
ck "con ?status=RETIRED si" 1 "$(body "$(req $OFF GET "/fleet/vehicles?status=RETIRED&q=V110X$RUN&pageSize=100")" | jq --arg id "$RETIRED" '[.items[]|select(.id==$id)]|length')"

echo
echo "== 2. Avisos y linea de servicio =="
OIL=$(body "$(req $OFF GET /fleet/maintenance/plan)" | jq -r '.[]|select(.key=="oil").id')
R=$(req $OFF POST /fleet/maintenance/logs "$(jq -nc --arg v "$ALERT" --arg t "$OIL" --arg d "$(day -40)" '{vehicleId:$v,taskId:$t,performedAt:$d,odometerKm:45000}')")
ck "servicio de aceite -> 201" 201 "$(code "$R")"
R=$(req $OFF GET /fleet/vehicles/$ALERT)
ck "aviso de seguro" true "$(body "$R" | jq '[.alerts[]|select(.kind=="DOCUMENT" and (.text|test("Seguro vence en")))]|length > 0')"
ck "aviso de servicio vencido" true "$(body "$R" | jq '[.alerts[]|select(.kind=="SERVICE" and .level=="DUE" and (.text|test("^Se pasó:")))]|length > 0')"
R=$(req $OFF GET "/fleet/maintenance/status?vehicleId=$ALERT")
ck "la linea la arma el API" "Le toca a los 50.000 km" "$(body "$R" | jq -r '.items[0].tasks[]|select(.task.key=="oil")|.line')"

echo
echo "== 3. Un servicio con costo, un gasto, y se borran juntos =="
R=$(req $OFF POST /fleet/maintenance/logs "$(jq -nc --arg v "$FREE" --arg t "$OIL" --arg d "$TODAY" '{vehicleId:$v,taskId:$t,performedAt:$d,odometerKm:10000,cost:"25.00"}')")
ck "anotar servicio con costo -> 201" 201 "$(code "$R")"
LOG=$(body "$R" | jq -r '.[0].id')
EXP=$(body "$R" | jq -r '.[0].expenseId')
ck "un gasto ligado" true "$([ "$EXP" != null ] && [ "$EXP" != "" ] && echo true)"
ck "un solo gasto de ese servicio" 1 "$(body "$(req $OFF GET "/fleet/expenses?vehicleId=$FREE&pageSize=100")" | jq --arg id "$EXP" '[.items[]|select(.id==$id and .maintenanceLogId!=null)]|length')"
R=$(req $OFF DELETE /fleet/maintenance/logs/$LOG)
ck "borrar el servicio -> 204" 204 "$(code "$R")"
ck "el gasto ya no esta" 0 "$(body "$(req $OFF GET "/fleet/expenses?vehicleId=$FREE&pageSize=100")" | jq --arg id "$EXP" '[.items[]|select(.id==$id)]|length')"

R=$(req $OFF POST /fleet/expenses "$(jq -nc --arg v "$FREE" --arg d "$TODAY" '{vehicleId:$v,amount:"12.00",incurredAt:$d,description:"Combustible VIS110"}')")
ck "gasto sin categoria -> 201 combustible" "201 FUEL" "$(code "$R") $(body "$R" | jq -r .type)"

echo
echo "== 4. Permisos y rentabilidad sin ocupacion =="
R=$(req $OFF POST /roles '{"name":"Sin flota VIS110","permissionKeys":["rentals.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?pageSize=100")" | jq -r '.items[]|select(.name=="Sin flota VIS110").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Sin flota VIS110\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
req $RD POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}" >/dev/null
ck "sin fleet.read -> 403" 403 "$(code "$(req $RD GET /fleet/vehicles)")"
R=$(req $OFF GET "/rentals/reports/profitability?from=$YESTERDAY&to=$TODAY")
ck "rentabilidad -> 200" 200 "$(code "$R")"
ck "sin occupancy" false "$(body "$R" | jq '[.totals|has("occupancy"), (.rows.items[]?|has("occupancy"))] | any')"

echo
echo "== 5. Relleno idempotente de un servicio con costo y sin gasto =="
ADMIN_ID=$(sql "SELECT id FROM users WHERE email = '$ADMIN_EMAIL' LIMIT 1")
ORPHAN=$(sql "INSERT INTO maintenance_logs (id, \"vehicleId\", \"performedAt\", \"odometerKm\", cost, notes, \"createdByUserId\") VALUES (gen_random_uuid(), '$FREE', '$TODAY', 10000, 12.50, 'Hojalateria', '$ADMIN_ID') RETURNING id")
BACKFILL="INSERT INTO fleet_expenses (id, \"vehicleId\", type, amount, \"incurredAt\", \"odometerKm\", description, \"maintenanceLogId\", \"createdByUserId\") SELECT gen_random_uuid(), l.\"vehicleId\", 'MAINTENANCE', l.cost, l.\"performedAt\", l.\"odometerKm\", COALESCE(t.name, NULLIF(split_part(COALESCE(l.notes, ''), E'\\n', 1), ''), 'Servicio'), l.id, l.\"createdByUserId\" FROM maintenance_logs l LEFT JOIN maintenance_plan_tasks t ON t.id = l.\"taskId\" WHERE l.cost > 0 AND NOT EXISTS (SELECT 1 FROM fleet_expenses e WHERE e.\"maintenanceLogId\" = l.id)"
sql "$BACKFILL" >/dev/null
ck "el huerfano deja un gasto" 1 "$(sql "SELECT count(*) FROM fleet_expenses WHERE \"maintenanceLogId\" = '$ORPHAN'")"
sql "$BACKFILL" >/dev/null
ck "correrlo otra vez no duplica" 1 "$(sql "SELECT count(*) FROM fleet_expenses WHERE \"maintenanceLogId\" = '$ORPHAN'")"
sql "DELETE FROM fleet_expenses WHERE \"maintenanceLogId\" = '$ORPHAN'" >/dev/null
sql "DELETE FROM maintenance_logs WHERE id = '$ORPHAN'" >/dev/null

echo
echo "== Limpieza =="
req $OFF POST /rentals/agreements/$DRES/cancel '{"reason":"Fin de verify-110"}' >/dev/null
for id in $DRENT $DLATE; do
  req $OFF POST /rentals/agreements/$id/checkin "$(jq -nc --arg t "$(date -u +%Y-%m-%dT%H:%M:%S.000Z)" '{actualReturnAt:$t,inspection:{odometerKm:10100,fuelEighths:8}}')" >/dev/null
done
for id in $FREE $RESERVED $RENTED $OVERDUE $SHOP $ALERT; do
  req $OFF PATCH /fleet/vehicles/$id '{"status":"RETIRED"}' >/dev/null
done
echo "  rentas cerradas y carros retirados"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
