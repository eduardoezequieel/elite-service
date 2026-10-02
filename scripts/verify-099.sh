#!/bin/bash
# Verificacion end-to-end de la spec 099 (mantenimiento de la flota y gastos
# por carro).
#
# Lo que prueba y `pnpm test` no puede: las 8 tareas del seed en la base, el
# 409 del nombre duplicado, el estado DUE/SOON/NO_DATA con fechas civiles
# reales, el gasto ligado que escribe la transaccion del servicio, el odometro
# que sube, el lavado PAID del carwash que aparece como gasto CARWASH por placa
# (la del lavado con guion, la de la flota sin), el .ics con text/calendar y los
# guards con fleet.read / fleet.manage.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-099.sh
#
# Deja un carro de prueba retirado, una tarea de plan desactivada y un lavado
# cobrado en la caja abierta: datos de prueba con el sufijo VIS099.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
READER_EMAIL=flota.vis099@elite.local
READER_PASSWORD=Flota099!
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
# Dia civil en la zona del taller, corrido N dias (N con signo: -40, +5).
day() {
  local n=$1
  case "$n" in -*|+*) ;; *) n="+$n" ;; esac   # macOS: `-v0d` no es un corrimiento; `-v+0d` sí
  TZ=America/El_Salvador date -v"${n}"d +%F 2>/dev/null || TZ=America/El_Salvador date -d "${n} days" +%F
}

OFF=$S/office.jar; RDR=$S/reader.jar
rm -f "$OFF" "$RDR"

echo "== 0. Sesion y lector con solo fleet.read =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /roles '{"name":"Flota lectura VIS099","permissionKeys":["fleet.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET /roles)" | jq -r '.items[]|select(.name=="Flota lectura VIS099").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Flota VIS099\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
R=$(req $RDR POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}")
ck "login con solo fleet.read -> 200" 200 "$(code "$R")"

echo
echo "== 1. Plan (seed de la 095, 409, desactivar) =="
R=$(req $OFF GET /fleet/maintenance/plan)
ck "GET /fleet/maintenance/plan -> 200" 200 "$(code "$R")"
ck "  estan las 8 tareas del seed" 8 "$(body "$R" | jq '[.[]|select(.key|IN("oil","general","tires","alignment","brakes","air_filter","battery","coolant"))]|length')"
OIL=$(body "$R" | jq -r '.[]|select(.key=="oil").id')
GENERAL=$(body "$R" | jq -r '.[]|select(.key=="general").id')
BRAKES=$(body "$R" | jq -r '.[]|select(.key=="brakes").id')
ck "  aceite cada 5000 km o 90 dias, activo" "5000 90 true" "$(body "$R" | jq -r '.[]|select(.key=="oil")|"\(.intervalKm) \(.intervalDays) \(.isActive)"')"
R=$(req $OFF POST /fleet/maintenance/plan "{\"name\":\"Lavado de motor VIS099 $RUN\",\"intervalDays\":60}")
ck "agregar tarea -> 201" 201 "$(code "$R")"
TASK=$(body "$R" | jq -r .id)
R=$(req $OFF POST /fleet/maintenance/plan "{\"name\":\"lavado de MOTOR vis099 $RUN\",\"intervalKm\":1000}")
ck "mismo nombre -> 409 DUPLICATE_MAINTENANCE_TASK" "409 DUPLICATE_MAINTENANCE_TASK" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /fleet/maintenance/plan '{"name":"Sin intervalo VIS099"}')
ck "sin km ni dias -> 422" 422 "$(code "$R")"
R=$(req $OFF PATCH /fleet/maintenance/plan/$TASK '{"intervalKm":3000,"intervalDays":45}')
ck "cambiar km y dias -> 200" "200 3000 45" "$(code "$R") $(body "$R" | jq -r '"\(.intervalKm) \(.intervalDays)"')"
R=$(req $OFF PATCH /fleet/maintenance/plan/$TASK '{"isActive":false}')
ck "desactivar -> 200 inactiva" "200 false" "$(code "$R") $(body "$R" | jq -r .isActive)"
ck "sin fleet.manage: POST plan -> 403" 403 "$(code "$(req $RDR POST /fleet/maintenance/plan '{"name":"X","intervalDays":1}')")"
ck "con fleet.read: GET plan -> 200" 200 "$(code "$(req $RDR GET /fleet/maintenance/plan)")"

echo
echo "== 2. Un carro con odometro 12300, seguro en 5 dias y tarjeta vencida =="
PLATE="P99$RUN"
R=$(req $OFF POST /fleet/vehicles "{\"plate\":\"$PLATE\",\"make\":\"Toyota\",\"model\":\"Yaris VIS099\",\"dailyRate\":\"35\",\"odometerKm\":12300,\"insuranceExpiresAt\":\"$(day +5)\",\"registrationExpiresAt\":\"$(day -1)\"}")
ck "crear carro -> 201" 201 "$(code "$R")"
CAR=$(body "$R" | jq -r .id)

echo
echo "== 3. Estado (RN-1, RN-6) =="
R=$(req $OFF POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskId\":\"$OIL\",\"performedAt\":\"$(day -40)\",\"odometerKm\":7000}")
ck "aceite a los 7000 km hace 40 dias -> 201, sin gasto" "201 null" "$(code "$R") $(body "$R" | jq -r '.[0].expenseId')"
R=$(req $OFF GET "/fleet/maintenance/status?vehicleId=$CAR")
ck "GET status?vehicleId -> 200 con un carro" "200 1" "$(code "$R") $(body "$R" | jq '.total')"
ck "  aceite DUE: -300 km, 50 dias" "DUE -300 50" "$(body "$R" | jq -r '.items[0].tasks[]|select(.task.key=="oil")|"\(.status) \(.kmLeft) \(.daysLeft)"')"
ck "  revision general NO_DATA" NO_DATA "$(body "$R" | jq -r '.items[0].tasks[]|select(.task.key=="general").status')"
ck "  la tarea desactivada no entra" 0 "$(body "$R" | jq --arg t "$TASK" '[.items[0].tasks[]|select(.task.id==$t)]|length')"
ck "  seguro SOON en 5 dias, tarjeta DUE" "INSURANCE:SOON:5 REGISTRATION:DUE:-1" "$(body "$R" | jq -r '[.items[0].documents[]|"\(.kind):\(.status):\(.daysLeft)"]|join(" ")')"
R=$(req $OFF POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskIds\":[\"$GENERAL\"],\"performedAt\":\"$(day -25)\"}")
ck "revision general hace 25 dias -> 201" 201 "$(code "$R")"
R=$(req $OFF GET "/fleet/maintenance/status?vehicleId=$CAR&days=3")
ck "  revision general SOON con 5 dias" "SOON 5" "$(body "$R" | jq -r '.items[0].tasks[]|select(.task.key=="general")|"\(.status) \(.daysLeft)"')"
ck "  ?days=3 marca la que vence en la renta" "true" "$(body "$R" | jq -r '.items[0].tasks[]|select(.task.key=="oil").dueWithinDays')"
ck "sin vehicleId lista la flota -> 200" 200 "$(code "$(req $OFF GET /fleet/maintenance/status)")"
R=$(req $OFF GET '/fleet/maintenance/status?view=no_data&page=2&pageSize=1')
ck "  ?view=no_data&page=2&pageSize=1 -> una página con las cifras de la flota (101)" "200 2 1 true" "$(code "$R") $(body "$R" | jq -r '"\(.page) \(.pageSize) \((.items|length) <= 1 and (.summary|has("due")))"')"
ck "carro que no existe -> 404" 404 "$(code "$(req $OFF GET '/fleet/maintenance/status?vehicleId=00000000-0000-4000-8000-000000000000')")"
ck "con fleet.read: GET status -> 200" 200 "$(code "$(req $RDR GET "/fleet/maintenance/status?vehicleId=$CAR")")"

echo
echo "== 4. Servicio con costo: gasto ligado y odometro =="
R=$(req $OFF POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskId\":\"$OIL\",\"performedAt\":\"$(day -10)\",\"odometerKm\":12000,\"cost\":\"45.50\",\"shop\":\"Elite Service\"}")
ck "aceite a los 12000 km hace 10 dias con \$45.50 -> 201" "201 45.50" "$(code "$R") $(body "$R" | jq -r '.[0].cost')"
LOG=$(body "$R" | jq -r '.[0].id')
EXPENSE=$(body "$R" | jq -r '.[0].expenseId')
R=$(req $OFF GET "/fleet/maintenance/status?vehicleId=$CAR")
ck "  aceite OK: 4700 km, 80 dias" "OK 4700 80" "$(body "$R" | jq -r '.items[0].tasks[]|select(.task.key=="oil")|"\(.status) \(.kmLeft) \(.daysLeft)"')"
R=$(req $OFF GET "/fleet/expenses?vehicleId=$CAR")
ck "  el gasto MAINTENANCE ligado, mismo monto y fecha" "MAINTENANCE 45.50 $(day -10) $LOG false" "$(body "$R" | jq -r --arg e "$EXPENSE" '.items[]|select(.id==$e)|"\(.type) \(.amount) \(.incurredAt) \(.maintenanceLogId) \(.editable)"')"
ck "  editar el gasto ligado -> 409" 409 "$(code "$(req $OFF PATCH /fleet/expenses/$EXPENSE '{"amount":"1.00"}')")"
ck "  borrar el gasto ligado -> 409" 409 "$(code "$(req $OFF DELETE /fleet/expenses/$EXPENSE)")"
R=$(req $OFF POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskId\":\"$BRAKES\",\"performedAt\":\"$(day 0)\",\"odometerKm\":12800}")
ck "frenos a los 12800 km -> 201" 201 "$(code "$R")"
ck "  el carro sube a 12800 km" 12800 "$(body "$(req $OFF GET /fleet/vehicles/$CAR)" | jq -r .odometerKm)"
R=$(req $OFF POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskId\":\"$BRAKES\",\"performedAt\":\"$(day -2)\",\"odometerKm\":9000}")
ck "  un servicio viejo no lo baja" 12800 "$(body "$(req $OFF GET /fleet/vehicles/$CAR)" | jq -r .odometerKm)"
ck "fecha futura -> 422" 422 "$(code "$(req $OFF POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskId\":\"$OIL\",\"performedAt\":\"$(day +1)\"}")")"
ck "tarea desactivada -> 422" 422 "$(code "$(req $OFF POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskId\":\"$TASK\",\"performedAt\":\"$(day 0)\"}")")"
ck "historial del carro: 5 servicios" 5 "$(body "$(req $OFF GET "/fleet/maintenance/logs?vehicleId=$CAR")" | jq '.total')"
R=$(req $OFF GET "/fleet/maintenance/logs?vehicleId=$CAR&page=2&pageSize=2")
ck "  ?page=2&pageSize=2 -> dos de cinco (101)" "200 2 2 2 5" "$(code "$R") $(body "$R" | jq -r '"\(.page) \(.pageSize) \(.items|length) \(.total)"')"
ck "sin fleet.manage: POST logs -> 403" 403 "$(code "$(req $RDR POST /fleet/maintenance/logs "{\"vehicleId\":\"$CAR\",\"taskId\":\"$OIL\",\"performedAt\":\"$(day 0)\"}")")"

echo
echo "== 5. Gastos manuales (RN-3) =="
R=$(req $OFF POST /fleet/expenses "{\"vehicleId\":\"$CAR\",\"type\":\"FUEL\",\"amount\":\"30\",\"incurredAt\":\"$(day 0)\",\"description\":\"Tanque VIS099\"}")
ck "anotar combustible -> 201 editable" "201 MANUAL 30.00 true" "$(code "$R") $(body "$R" | jq -r '"\(.source) \(.amount) \(.editable)"')"
FUEL=$(body "$R" | jq -r .id)
ck "monto cero -> 422" 422 "$(code "$(req $OFF POST /fleet/expenses "{\"vehicleId\":\"$CAR\",\"type\":\"FUEL\",\"amount\":\"0\",\"incurredAt\":\"$(day 0)\"}")")"
R=$(req $OFF PATCH /fleet/expenses/$FUEL '{"amount":"28.75"}')
ck "editar -> 200" "200 28.75" "$(code "$R") $(body "$R" | jq -r .amount)"
ck "borrar -> 204" 204 "$(code "$(req $OFF DELETE /fleet/expenses/$FUEL)")"
ck "  ya no existe -> 404" 404 "$(code "$(req $OFF PATCH /fleet/expenses/$FUEL '{"amount":"1.00"}')")"
ck "sin fleet.manage: POST gasto -> 403" 403 "$(code "$(req $RDR POST /fleet/expenses "{\"vehicleId\":\"$CAR\",\"type\":\"FUEL\",\"amount\":\"1\",\"incurredAt\":\"$(day 0)\"}")")"

echo
echo "== 6. Lavado pagado del carwash con la misma placa (RN-4) =="
R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
case "$(code "$R")" in 200|201|409) echo "  caja lista";; *) echo "  AVISO: abrir caja devolvio $(code "$R")";; esac
SEDAN=$(body "$(req $OFF GET /vehicle-body-types)" | jq -r '.[]|select(.key=="sedan").id')
SRV_CAT=$(body "$(req $OFF GET /service-categories)" | jq -r '.items[0].id')
R=$(req $OFF POST /services "{\"name\":\"Lavado VIS099 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"12.00\"}")
ck "servicio de \$12 -> 201" 201 "$(code "$R")"
SRV=$(body "$R" | jq -r .id)
# La mascara del mostrador guarda la placa con guion: P99-123456.
WASH_PLATE="${PLATE:0:3}-${PLATE:3}"
R=$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Riveras VIS099\"},\"vehicle\":{\"plate\":\"$WASH_PLATE\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")
ck "lavado con la placa $WASH_PLATE -> 201" 201 "$(code "$R")"
TICKET=$(body "$R" | jq -r .id)
NUMBER=$(body "$R" | jq -r .number)
req $OFF POST /carwash/tickets/$TICKET/status '{"status":"READY"}' >/dev/null
R=$(req $OFF POST /carwash/tickets/$TICKET/charge '{"method":"CASH","amount":"12.00"}')
ck "cobrarlo -> 200/201" true "$(case "$(code "$R")" in 200|201) echo true;; *) echo false;; esac)"
R=$(req $OFF GET "/fleet/expenses?vehicleId=$CAR")
ck "  aparece como CARWASH / WASH por \$12.00 hoy" "CARWASH WASH 12.00 $(day 0) false" "$(body "$R" | jq -r --arg t "$TICKET" '.items[]|select(.id==$t)|"\(.source) \(.type) \(.amount) \(.incurredAt) \(.editable)"')"
ck "  con el folio del lavado" "$NUMBER" "$(body "$R" | jq -r --arg t "$TICKET" '.items[]|select(.id==$t).reference')"
ck "  sin fila en fleet_expenses: no se edita (404)" 404 "$(code "$(req $OFF PATCH /fleet/expenses/$TICKET '{"amount":"1.00"}')")"
ck "  ?type=WASH lo trae" 1 "$(body "$(req $OFF GET "/fleet/expenses?vehicleId=$CAR&type=WASH")" | jq --arg t "$TICKET" '[.items[]|select(.id==$t)]|length')"
ck "  ?type=FUEL no" 0 "$(body "$(req $OFF GET "/fleet/expenses?vehicleId=$CAR&type=FUEL")" | jq --arg t "$TICKET" '[.items[]|select(.id==$t)]|length')"
ck "  total del carro: 45.50 + 12.00" "57.50" "$(body "$(req $OFF GET "/fleet/expenses?vehicleId=$CAR")" | jq -r .totalAmount)"
R=$(req $OFF GET "/fleet/expenses?vehicleId=$CAR&page=2&pageSize=1")
ck "  ?page=2&pageSize=1 -> la segunda fila y el total de todas (101)" "200 2 1 1 2 57.50" "$(code "$R") $(body "$R" | jq -r '"\(.page) \(.pageSize) \(.items|length) \(.total) \(.totalAmount)"')"

echo
echo "== 7. Lista para el taller y recordatorios =="
R=$(req $OFF GET /fleet/maintenance/whatsapp-text)
ck "GET whatsapp-text -> 200" 200 "$(code "$R")"
ck "  nombra el carro con su placa" true "$(body "$R" | jq -r --arg p "$PLATE" '.text|contains($p)')"
curl -s -b "$OFF" -D "$S/ics-headers" -o "$S/reminders.ics" "$API/fleet/maintenance/reminders.ics"
ck "GET reminders.ics -> text/calendar" "text/calendar" "$(grep -i '^content-type:' "$S/ics-headers" | tr -d '\r' | awk '{print $2}' | cut -d';' -f1)"
ck "  empieza con BEGIN:VCALENDAR" "BEGIN:VCALENDAR" "$(head -1 "$S/reminders.ics" | tr -d '\r')"
ck "  trae eventos del carro" true "$([ "$(tr -d '\r\n ' < "$S/reminders.ics" | grep -o "$PLATE" | wc -l | tr -d ' ')" -gt 0 ] && echo true || echo false)"
ck "sin sesion: reminders.ics -> 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$API/fleet/maintenance/reminders.ics")"

echo
echo "== 8. Limpieza: retirar el carro de prueba =="
ck "retirar el carro -> 200" 200 "$(code "$(req $OFF PATCH /fleet/vehicles/$CAR '{"status":"RETIRED"}')")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
