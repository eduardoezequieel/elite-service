#!/bin/bash
# Verificacion end-to-end de la spec 100 (inicio de la rentadora y
# rentabilidad por carro).
#
# Lo que prueba y `pnpm test` no puede: la lectura real de flota, rentas,
# pagos y multas con Prisma, los gastos por el puerto de la 099, el IVA de
# ajustes, las fechas en America/El_Salvador contra la base y los guards de
# `rentals.read` / `rentals.reports`.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-100.sh
#
# Crea carros y clientes propios con sufijo de corrida (no toca los reales) y
# al final cancela lo que queda abierto y retira los carros de prueba. Supone
# los ajustes por defecto: IVA 0, margen 1 h y gracia 1 h.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
READER_EMAIL=rentas.vis100@elite.local
READER_PASSWORD=Rentas100!
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
# Un instante ISO a N horas de ahora, redondeado al minuto.
at() { node -e "const d=new Date(Date.now()+($1)*3600e3);d.setUTCSeconds(0,0);console.log(d.toISOString())"; }
# Los meses del taller: M-1 y M-2 (primer y ultimo dia) y el corte entre los dos.
eval "$(node -e "
const sv=new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador'}).format(new Date());
const [y,m]=sv.split('-').map(Number);
const civ=(yy,mm,dd)=>new Date(Date.UTC(yy,mm-1,dd)).toISOString().slice(0,10);
const p1=civ(y,m-1,1), l1=civ(y,m,0), p2=civ(y,m-2,1), l2=civ(y,m-1,0);
// El corte es el 1 de M-1 a las 00:00 en El Salvador (UTC-6).
const cut=Date.parse(p1+'T06:00:00Z');
console.log('M1_FROM='+p1+' M1_TO='+l1+' M2_FROM='+p2+' M2_TO='+l2);
console.log('PICK='+new Date(cut-62*3600e3).toISOString()+' BACK='+new Date(cut+58*3600e3).toISOString());
console.log('M1_YEAR='+p1.slice(0,4)+' M1_INDEX='+(Number(p1.slice(5,7))-1));
")"

OFF=$S/office.jar; RD=$S/reader.jar
rm -f "$OFF" "$RD"

echo "== 0. Sesion, carros y clientes de prueba =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

car() {
  body "$(req $OFF POST /fleet/vehicles "{\"plate\":\"V10$1$RUN\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"60.00\",\"odometerKm\":10000}")" | jq -r .id
}
FREE=$(car A); OUT=$(car B); LATE=$(car C); BOOKED=$(car D); SHOP=$(car E); PRO=$(car F)
req $OFF PATCH /fleet/vehicles/$SHOP '{"status":"IN_SHOP"}' >/dev/null
ck "seis carros de prueba" 6 "$(for id in $FREE $OUT $LATE $BOOKED $SHOP $PRO; do [ "$id" != null ] && echo x; done | wc -l | tr -d ' ')"
ANA=$(body "$(req $OFF POST /renters "{\"fullName\":\"Ana VIS100 $RUN\"}")" | jq -r .id)

agreement() {
  # agreement <carro> <sale ISO> <regresa ISO> [json extra]
  local extra=${4:-'{}'}
  req $OFF POST /rentals/agreements "$(jq -nc --arg c "$ANA" --arg v "$1" --arg p "$2" --arg r "$3" --argjson extra "$extra" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r,includesVat:false} + $extra')"
}
checkout_now() { jq -nc --arg t "$1" '{checkoutNow:true,checkout:{actualPickupAt:$t,inspection:{odometerKm:10000,fuelEighths:8}}}'; }

echo
echo "== 1. Tablero: los cinco estados (criterio 1) =="
O=$(body "$(agreement "$OUT" "$(at -1)" "$(at 47)" "$(checkout_now "$(at -1)")")" | jq -r .id)
L=$(body "$(agreement "$LATE" "$(at -50)" "$(at -2)" "$(checkout_now "$(at -50)")")" | jq -r .id)
B=$(body "$(agreement "$BOOKED" "$(at 10)" "$(at 58)")" | jq -r .id)
F=$(body "$(agreement "$FREE" "$(at 100)" "$(at 148)")" | jq -r .id)
R=$(req $OFF GET /rentals/reports/dashboard)
ck "GET /rentals/reports/dashboard -> 200" 200 "$(code "$R")"
state() { body "$R" | jq -r --arg id "$1" '.fleet[]|select(.vehicle.id==$id)|.state'; }
ck "  libre con reserva lejana -> FREE" FREE "$(state "$FREE")"
ck "  en curso -> OUT" OUT "$(state "$OUT")"
ck "  en curso con el regreso pasado -> LATE" LATE "$(state "$LATE")"
ck "  reserva que sale en menos de 48 h -> BOOKED" BOOKED "$(state "$BOOKED")"
ck "  en taller -> IN_SHOP" IN_SHOP "$(state "$SHOP")"
ck "  FREE trae la proxima reserva" "$F" "$(body "$R" | jq -r --arg id "$FREE" '.fleet[]|select(.vehicle.id==$id)|.agreement.id')"
ck "  OUT trae quien lo tiene" "$O" "$(body "$R" | jq -r --arg id "$OUT" '.fleet[]|select(.vehicle.id==$id)|.agreement.id')"
ck "  la atrasada esta en pendientes" 1 "$(body "$R" | jq --arg id "$L" '[.pending.late[]|select(.agreementId==$id)]|length')"
ck "  next7Days trae 7 dias" 7 "$(body "$R" | jq '.next7Days|length')"
ck "  forma del contrato" "true true true true" "$(body "$R" | jq -r '"\(.today|has("pickups")) \(.tomorrow|has("returns")) \(.month|has("occupancy")) \(.pending|has("documentsDue"))"')"

echo
echo "== 2. Rentabilidad: prorrateo entre meses (criterio 2) =="
# 62 h en M-2 y 58 h en M-1: 5 dias x 60 = 300 -> 155.00 y 145.00.
P=$(body "$(agreement "$PRO" "$PICK" "$BACK" '{"dailyRate":"60.00","billableDays":5}')" | jq -r .id)
R=$(req $OFF POST /rentals/agreements/$P/checkout "$(jq -nc --arg t "$PICK" '{actualPickupAt:$t,inspection:{odometerKm:10000,fuelEighths:8}}')")
ck "entrega en el pasado -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /rentals/agreements/$P/checkin "$(jq -nc --arg t "$BACK" '{actualReturnAt:$t,billableDays:5,billableDaysNote:"verify-100",inspection:{odometerKm:10300,fuelEighths:8}}')")
ck "recepcion -> 200 FINISHED total 300.00" "200 FINISHED 300.00" "$(code "$R") $(body "$R" | jq -r '"\(.status) \(.totals.total)"')"
# Las filas vienen de a una página (101): se recorren todas para hallar el carro.
profit_rows() {
  local p=1 out='[]' page
  while :; do
    page=$(body "$(req $OFF GET "/rentals/reports/profitability?from=$1&to=$2&page=$p&pageSize=100")")
    out=$(jq -c --argjson acc "$out" '$acc + .rows.items' <<<"$page")
    [ "$(jq '.rows.page * .rows.pageSize >= .rows.total' <<<"$page")" = true ] && break
    p=$((p+1))
  done
  echo "$out"
}
R=$(req $OFF GET "/rentals/reports/profitability?from=$M1_FROM&to=$M1_TO")
ck "GET profitability M-1 -> 200" 200 "$(code "$R")"
ck "  M-1: 300 x 58/120 = 145.00" "145.00" "$(profit_rows "$M1_FROM" "$M1_TO" | jq -r --arg id "$PRO" '.[]|select(.vehicle.id==$id)|.income')"
R=$(req $OFF GET "/rentals/reports/profitability?from=$M2_FROM&to=$M2_TO")
ck "  M-2: 300 x 62/120 = 155.00" "155.00" "$(profit_rows "$M2_FROM" "$M2_TO" | jq -r --arg id "$PRO" '.[]|select(.vehicle.id==$id)|.income')"
ck "  totales y veredicto presentes" "true true" "$(body "$R" | jq -r '"\(.totals|has("net")) \(.rows.items[0]|has("verdict"))"')"
R=$(req $OFF GET "/rentals/reports/profitability?from=$M2_FROM&to=$M2_TO&page=2&pageSize=1")
ck "  ?page=2&pageSize=1 -> una fila y los totales de toda la flota (101)" "200 2 1 1 true" "$(code "$R") $(body "$R" | jq -r '"\(.rows.page) \(.rows.pageSize) \(.rows.items|length) \(.rows.total >= 2)"')"
ck "periodo al reves -> 422" 422 "$(code "$(req $OFF GET "/rentals/reports/profitability?from=$M1_TO&to=$M1_FROM")")"

echo
echo "== 3. Meses del carro (criterio 6) =="
R=$(req $OFF GET "/fleet/vehicles/$PRO/months?year=$M1_YEAR")
ck "GET /fleet/vehicles/:id/months -> 200 con 12 filas" "200 12" "$(code "$R") $(body "$R" | jq '.rows|length')"
ck "  el mes M-1 trae su parte" "145.00" "$(body "$R" | jq -r --argjson i "$M1_INDEX" '.rows[$i].income')"
ck "  cada fila con neto, dias y ocupacion" true "$(body "$R" | jq '[.rows[]|has("net") and has("rentedDays") and has("occupancy")]|all')"
ck "carro que no existe -> 404" 404 "$(code "$(req $OFF GET /fleet/vehicles/00000000-0000-4000-8000-000000000000/months)")"
ck "anio invalido -> 422" 422 "$(code "$(req $OFF GET "/fleet/vehicles/$PRO/months?year=abc")")"

echo
echo "== 4. Permisos (criterio 7) =="
R=$(req $OFF POST /roles '{"name":"Rentas lectura VIS100","permissionKeys":["rentals.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET /roles)" | jq -r '.[]|select(.name=="Rentas lectura VIS100").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Rentas VIS100\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
req $RD POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}" >/dev/null
ck "con rentals.read: tablero -> 200" 200 "$(code "$(req $RD GET /rentals/reports/dashboard)")"
ck "sin rentals.reports: rentabilidad -> 403" 403 "$(code "$(req $RD GET "/rentals/reports/profitability?from=$M1_FROM&to=$M1_TO")")"
ck "sin rentals.reports: meses -> 403" 403 "$(code "$(req $RD GET "/fleet/vehicles/$PRO/months")")"

echo
echo "== Limpieza =="
for id in $B $F; do req $OFF POST /rentals/agreements/$id/cancel '{"reason":"Fin de verify-100"}' >/dev/null; done
for id in $O $L; do
  req $OFF POST /rentals/agreements/$id/checkin "$(jq -nc --arg t "$(at 0)" '{actualReturnAt:$t,inspection:{odometerKm:10000,fuelEighths:8}}')" >/dev/null
done
for id in $FREE $OUT $LATE $BOOKED $SHOP $PRO; do req $OFF PATCH /fleet/vehicles/$id '{"status":"RETIRED"}' >/dev/null; done
echo "  rentas de prueba cerradas y carros retirados"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
