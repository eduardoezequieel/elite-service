#!/bin/bash
# Verificacion end-to-end de la spec 096 (rentas: reserva, entrega, recepcion,
# extension, cambio de carro, reasignacion, disponibilidad y calendario).
#
# Lo que prueba y `pnpm test` no puede: las transacciones de Prisma con el
# carro bloqueado (choque con margen), el unico de `contractNumber`, el JSON
# de la inspeccion, el odometro del carro, los pagos y los guards de
# `rentals.read` / `rentals.manage`.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-096.sh
#
# Crea carros y clientes propios con sufijo de corrida (no toca los reales) y
# al final cancela lo que queda abierto y retira los carros de prueba. Supone
# los ajustes por defecto: margen 1 h y gracia 1 h.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
READER_EMAIL=rentas.vis096@elite.local
READER_PASSWORD=Rentas096!
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
# Un instante ISO a N horas de ahora, redondeado al minuto (N puede ser negativo o decimal).
at() { node -e "const d=new Date(Date.now()+($1)*3600e3);d.setUTCSeconds(0,0);console.log(d.toISOString())"; }
# El dia civil del taller a N dias de hoy.
day() { node -e "console.log(new Intl.DateTimeFormat('en-CA',{timeZone:'America/El_Salvador'}).format(new Date(Date.now()+($1)*864e5)))"; }

OFF=$S/office.jar; RD=$S/reader.jar
rm -f "$OFF" "$RD"

echo "== 0. Sesion, carros y clientes de prueba =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

car() {
  body "$(req $OFF POST /fleet/vehicles "{\"plate\":\"V96$1$RUN\",\"make\":\"Toyota\",\"model\":\"Yaris\",\"dailyRate\":\"35.00\",\"freeKmPerDay\":200,\"extraKmPrice\":\"0.25\",\"odometerKm\":10000}")" | jq -r .id
}
CAR1=$(car A); CAR2=$(car B); CAR3=$(car C); SHOP=$(car D)
req $OFF PATCH /fleet/vehicles/$SHOP '{"status":"IN_SHOP"}' >/dev/null
ck "cuatro carros de prueba" 4 "$(for id in $CAR1 $CAR2 $CAR3 $SHOP; do [ "$id" != null ] && echo x; done | wc -l | tr -d ' ')"
ANA=$(body "$(req $OFF POST /renters "{\"fullName\":\"Ana VIS096 $RUN\",\"mobilePhone\":\"7777-8888\"}")" | jq -r .id)
BETO=$(body "$(req $OFF POST /renters "{\"fullName\":\"Beto VIS096 $RUN\"}")" | jq -r .id)
BLOCKED=$(body "$(req $OFF POST /renters "{\"fullName\":\"Bloqueado VIS096 $RUN\",\"isBlocked\":true,\"blockReason\":\"Choco\"}")" | jq -r .id)

agreement() {
  # agreement <cliente> <carro> <sale en h> <regresa en h> [json extra]
  local extra=${5:-'{}'}
  req $OFF POST /rentals/agreements "$(jq -nc --arg c "$1" --arg v "$2" --arg p "$(at "$3")" --arg r "$(at "$4")" --argjson extra "$extra" '{customerId:$c,vehicleId:$v,plannedPickupAt:$p,plannedReturnAt:$r} + $extra')"
}

echo
echo "== 1. Alta (criterio 1) =="
R=$(agreement "$ANA" "$CAR1" 240 288)
ck "reservar -> 201" 201 "$(code "$R")"
A=$(body "$R" | jq -r .id)
ck "  RESERVED, 2 dias, tarifa 35.00, sin numero" "RESERVED 2 35.00 null" "$(body "$R" | jq -r '"\(.status) \(.billableDays) \(.dailyRate) \(.contractNumber)"')"
ck "  totales calculados por el API" "70.00 0.00 70.00" "$(body "$R" | jq -r '"\(.totals.total) \(.totals.paid) \(.totals.balance)"')"

echo
echo "== 2. Choque con margen de 1 h (RN-2) =="
R=$(agreement "$BETO" "$CAR1" 288.5 336)
ck "30 min despues del regreso -> 409 VEHICLE_UNAVAILABLE" "409 VEHICLE_UNAVAILABLE" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  details nombra la renta que choca" "$A" "$(body "$R" | jq -r .details.agreementId)"
R=$(agreement "$BETO" "$CAR1" 289 336)
ck "1 h despues del regreso -> 201" 201 "$(code "$R")"
B=$(body "$R" | jq -r .id)
ck "cancelar la reserva -> 200 CANCELLED" "200 CANCELLED" "$(code "$(req $OFF POST /rentals/agreements/$B/cancel '{"reason":"Prueba"}')") $(body "$(req $OFF GET /rentals/agreements/$B)" | jq -r .status)"

echo
echo "== 3. Bloqueado y carro no rentable =="
R=$(agreement "$BLOCKED" "$CAR3" 400 420)
ck "cliente bloqueado -> 409 RENTER_BLOCKED" "409 RENTER_BLOCKED" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(agreement "$ANA" "$SHOP" 400 420)
ck "carro en taller -> 409 VEHICLE_NOT_RENTABLE" "409 VEHICLE_NOT_RENTABLE" "$(code "$R") $(body "$R" | jq -r .code)"

echo
echo "== 4. Entrega con numero de contrato y atraso derivado =="
R=$(agreement "$ANA" "$CAR1" -50 -2)
C=$(body "$R" | jq -r .id)
ck "reserva en el pasado -> 201" 201 "$(code "$R")"
CURRENT=$(body "$(req $OFF GET /rentals/cash/current)")
OPENED=0
if [ "$CURRENT" = "null" ]; then
  req $OFF POST /rentals/cash/open '{"openingFloat":"0.00"}' >/dev/null
  OPENED=1
fi
R=$(req $OFF POST /rentals/agreements/$C/checkout "$(jq -nc --arg t "$(at -50)" '{actualPickupAt:$t,inspection:{odometerKm:10000,fuelEighths:6,damages:[{zone:"hood",description:"Rayon"}],accessories:{"Antena":true}},deposit:"200.00",depositMethod:"CASH",payment:{amount:"70.00",method:"CASH"}}')")
ck "checkout -> 200 IN_PROGRESS" "200 IN_PROGRESS" "$(code "$R") $(body "$R" | jq -r .status)"
ck "  numero de contrato asignado" true "$(body "$R" | jq -r '.contractNumber != null')"
ck "  inspeccion, km y deposito guardados" "10000 6 1 200.00" "$(body "$R" | jq -r '"\(.pickupOdometerKm) \(.pickupInspection.fuelEighths) \(.pickupInspection.damages|length) \(.depositHeld)"')"
ck "  pago inicial registrado" "70.00" "$(body "$R" | jq -r .totals.paid)"
NUM_C=$(body "$R" | jq -r .contractNumber)
ck "  checkout de nuevo -> 409 AGREEMENT_NOT_RESERVED" 409 "$(code "$(req $OFF POST /rentals/agreements/$C/checkout "$(jq -nc --arg t "$(at -50)" '{actualPickupAt:$t,inspection:{odometerKm:10000,fuelEighths:6}}')")")"
ck "GET -> derivedStatus LATE" LATE "$(body "$(req $OFF GET /rentals/agreements/$C)" | jq -r .derivedStatus)"
ck "  ?late=true la trae" 1 "$(body "$(req $OFF GET "/rentals/agreements?late=true&customerId=$ANA")" | jq --arg id "$C" '[.items[]|select(.id==$id)]|length')"

echo
echo "== 5. Disponibilidad (FREE_IF_RETURNED) =="
Q="from=$(at 2)&to=$(at 26)"
R=$(req $OFF GET "/rentals/availability?$Q")
ck "GET /rentals/availability -> 200" 200 "$(code "$R")"
ck "  el carro atrasado sale FREE_IF_RETURNED con su renta" "FREE_IF_RETURNED $C" "$(body "$R" | jq -r --arg id "$CAR1" '.[]|select(.vehicle.id==$id)|"\(.availability) \(.blocking.id)"')"
ck "  un carro sin rentas sale FREE" FREE "$(body "$R" | jq -r --arg id "$CAR3" '.[]|select(.vehicle.id==$id)|.availability')"
ck "  el carro en taller no aparece" 0 "$(body "$R" | jq --arg id "$SHOP" '[.[]|select(.vehicle.id==$id)]|length')"

echo
echo "== 6. Recepcion con km extra y deposito =="
CHECKIN() { jq -nc --arg t "$(at 0)" --arg dep "$1" '{actualReturnAt:$t,inspection:{odometerKm:10800,fuelEighths:8,damages:[{zone:"hood",description:"Rayon"},{zone:"rear_bumper",description:"Golpe"}]},payment:{amount:"20.00",method:"CARD"},depositReturn:{amount:$dep,method:"CASH"}}'; }
R=$(req $OFF POST /rentals/agreements/$C/checkin "$(CHECKIN 250.00)")
ck "devolver mas deposito del que hay -> 409 DEPOSIT_EXCEEDS_HELD" "409 DEPOSIT_EXCEEDS_HELD" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /rentals/agreements/$C/checkin "$(CHECKIN 150.00)")
ck "checkin -> 200 FINISHED" "200 FINISHED" "$(code "$R") $(body "$R" | jq -r .status)"
# 50 h - 1 h de gracia = 3 dias; 3 x 200 = 600 km libres; 800 recorridos -> 200 x 0.25.
ck "  3 dias y km extra 50.00" "3 50.00" "$(body "$R" | jq -r '"\(.billableDays) \(.extraKmCharge)"')"
ck "  devolucion de deposito y lo retenido" "150.00 50.00" "$(body "$R" | jq -r '"\(.depositReturnedAmount) \(.depositHeld)"')"
ck "  total 155.00, pagado 90.00, saldo 65.00" "155.00 90.00 65.00" "$(body "$R" | jq -r '"\(.totals.total) \(.totals.paid) \(.totals.balance)"')"
ck "  odometro del carro actualizado" 10800 "$(body "$(req $OFF GET /fleet/vehicles/$CAR1)" | jq -r .odometerKm)"
if [ "$OPENED" = "1" ]; then
  req $OFF POST /rentals/cash/close '{"countedCash":"70.00"}' >/dev/null
fi

echo
echo "== 7. Cerrada -> 409 AGREEMENT_CLOSED =="
ck "PATCH" "409 AGREEMENT_CLOSED" "$(R=$(req $OFF PATCH /rentals/agreements/$C '{"notes":"x"}'); echo "$(code "$R") $(body "$R" | jq -r .code)")"
ck "extend" "409 AGREEMENT_CLOSED" "$(R=$(req $OFF POST /rentals/agreements/$C/extend "{\"newReturnAt\":\"$(at 100)\"}"); echo "$(code "$R") $(body "$R" | jq -r .code)")"
ck "cancel" "409 AGREEMENT_CLOSED" "$(R=$(req $OFF POST /rentals/agreements/$C/cancel '{"reason":"x"}'); echo "$(code "$R") $(body "$R" | jq -r .code)")"
ck "contract-number de una cerrada con numero es idempotente" "200 $NUM_C" "$(R=$(req $OFF POST /rentals/agreements/$C/contract-number); echo "$(code "$R") $(body "$R" | jq -r .contractNumber)")"

echo
echo "== 8. Entregar en el alta y extender =="
R=$(agreement "$BETO" "$CAR2" -1 47 "$(jq -nc --arg t "$(at -1)" '{checkoutNow:true,deposit:"100.00",checkout:{actualPickupAt:$t,inspection:{odometerKm:10000,fuelEighths:8}}}')")
D=$(body "$R" | jq -r .id)
ck "checkoutNow -> 201 IN_PROGRESS con numero" "201 IN_PROGRESS true" "$(code "$R") $(body "$R" | jq -r '"\(.status) \(.contractNumber != null)"')"
R=$(req $OFF POST /rentals/agreements/$D/extend "{\"newReturnAt\":\"$(at 71)\",\"note\":\"Pidio un dia mas\"}")
ck "extend -> 200, 3 dias y una extension" "200 3 1" "$(code "$R") $(body "$R" | jq -r '"\(.billableDays) \(.extensions|length)"')"
E=$(body "$(agreement "$ANA" "$CAR2" 100 120)" | jq -r .id)
R=$(req $OFF POST /rentals/agreements/$D/extend "{\"newReturnAt\":\"$(at 99.5)\"}")
ck "extender contra la reserva siguiente -> 409 VEHICLE_UNAVAILABLE" "409 VEHICLE_UNAVAILABLE" "$(code "$R") $(body "$R" | jq -r .code)"

echo
echo "== 9. Cambio de carro =="
R=$(req $OFF POST /rentals/agreements/$D/swap "$(jq -nc --arg t "$(at 0)" --arg v "$CAR3" '{at:$t,newVehicleId:$v,reason:"Falla de frenos"}')")
ck "swap -> 200" 200 "$(code "$R")"
OPENED=$(body "$R" | jq -r .opened.id)
ck "  la actual FINISHED con el deposito transferido" "FINISHED $OPENED 0.00" "$(body "$R" | jq -r '"\(.closed.status) \(.closed.depositTransferredToId) \(.closed.depositHeld)"')"
ck "  la nueva IN_PROGRESS con el carro nuevo, ligada y con deposito" "IN_PROGRESS $CAR3 $D 100.00" "$(body "$R" | jq -r '"\(.opened.status) \(.opened.vehicleId) \(.opened.previousAgreementId) \(.opened.deposit)"')"
ck "  numero de contrato propio" true "$(body "$R" | jq -r '.opened.contractNumber != null and .opened.contractNumber != .closed.contractNumber')"

echo
echo "== 10. Reasignar y numero de contrato =="
R=$(req $OFF POST /rentals/agreements/$A/reassign "{\"vehicleId\":\"$CAR2\"}")
ck "reasignar una reserva -> 200 con el carro nuevo" "200 $CAR2" "$(code "$R") $(body "$R" | jq -r .vehicleId)"
R=$(req $OFF POST /rentals/agreements/$OPENED/reassign "{\"vehicleId\":\"$CAR1\"}")
ck "reasignar una en curso -> 409 AGREEMENT_NOT_RESERVED" "409 AGREEMENT_NOT_RESERVED" "$(code "$R") $(body "$R" | jq -r .code)"
N1=$(body "$(req $OFF POST /rentals/agreements/$A/contract-number)" | jq -r .contractNumber)
N2=$(body "$(req $OFF POST /rentals/agreements/$A/contract-number)" | jq -r .contractNumber)
ck "contract-number idempotente" "$N1" "$N2"

echo
echo "== 11. Calendario y lista =="
R=$(req $OFF GET "/rentals/calendar?from=$(day 0)&to=$(day 6)")
ck "GET /rentals/calendar -> 200" 200 "$(code "$R")"
ck "  fila del carro nuevo con la renta en curso" 1 "$(body "$R" | jq --arg v "$CAR3" --arg id "$OPENED" '[.[]|select(.vehicle.id==$v)|.agreements[]|select(.id==$id)]|length')"
ck "  sin canceladas" 0 "$(body "$R" | jq --arg id "$B" '[.[].agreements[]|select(.id==$id)]|length')"
ck "rango de mas de 42 dias -> 422" 422 "$(code "$(req $OFF GET "/rentals/calendar?from=$(day 0)&to=$(day 60)")")"
ck "lista por cliente (cancelada, cerrada por el cambio y la nueva)" 3 "$(body "$(req $OFF GET "/rentals/agreements?customerId=$BETO")" | jq '.total')"
R=$(req $OFF GET "/rentals/agreements?customerId=$BETO&page=2&pageSize=1")
ck "  ?page=2&pageSize=1 -> la segunda de las tres (101)" "200 2 1 1 3" "$(code "$R") $(body "$R" | jq -r '"\(.page) \(.pageSize) \(.items|length) \(.total)"')"
ck "  sin repetir filas entre páginas" 3 "$(for p in 1 2 3; do body "$(req $OFF GET "/rentals/agreements?customerId=$BETO&page=$p&pageSize=1")" | jq -r '.items[0].id'; done | sort -u | wc -l | tr -d ' ')"
ck "lista por estado" 0 "$(body "$(req $OFF GET "/rentals/agreements?status=RESERVED&customerId=$BETO")" | jq '.total')"

echo
echo "== 12. Permisos =="
R=$(req $OFF POST /roles '{"name":"Rentas lectura VIS096","permissionKeys":["rentals.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?pageSize=100")" | jq -r '.items[]|select(.name=="Rentas lectura VIS096").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Rentas VIS096\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
req $RD POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}" >/dev/null
ck "con rentals.read: GET /rentals/agreements -> 200" 200 "$(code "$(req $RD GET /rentals/agreements)")"
ck "sin rentals.manage: POST cancel -> 403" 403 "$(code "$(req $RD POST /rentals/agreements/$A/cancel '{"reason":"x"}')")"

echo
echo "== Limpieza =="
for id in $A $E $OPENED; do req $OFF POST /rentals/agreements/$id/cancel '{"reason":"Fin de verify-096"}' >/dev/null; done
for id in $CAR1 $CAR2 $CAR3 $SHOP; do req $OFF PATCH /fleet/vehicles/$id '{"status":"RETIRED"}' >/dev/null; done
echo "  rentas de prueba canceladas y carros retirados"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
