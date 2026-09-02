#!/bin/bash
# Verificacion end-to-end de la spec 003 (carwash: catalogo, tickets y cobro).
#
# Recorre los criterios de aceptacion contra un stack levantado: base sembrada,
# API en marcha. Prueba el sistema armado —Prisma, los dos guards, las dos
# cookies, el HTTP— que es lo que `pnpm test` no puede hacer con repositorios en
# memoria.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-003.sh
#
# Crea empleado, clientes, vehiculos y tickets con sufijo VIS y los borra al
# terminar.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
PASS=0; FAIL=0

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

OFF=$S/office.jar; FLR=$S/floor.jar; ANON=$S/anon.jar
rm -f "$OFF" "$FLR" "$ANON"

echo "== 1. Dos mundos, dos sesiones (RN-0, RN-19) =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')

R=$(req $OFF POST /employees '{"fullName":"Carlos VIS","username":"carlos.vis","pin":"1234"}')
ck "alta de empleado -> 201" 201 "$(code "$R")"
EMP_ID=$(body "$R" | jq -r '.id')
ck "  no devuelve el hash del PIN (RN-18)" 0 "$(body "$R" | grep -c pinHash)"

R=$(req $ANON POST /floor/login '{"username":"carlos.vis","pin":"9999"}')
ck "PIN equivocado -> 401" 401 "$(code "$R")"
ck "  code INVALID_CREDENTIALS" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"
R=$(req $ANON POST /floor/login '{"username":"nadie.vis","pin":"1234"}')
ck "usuario inexistente -> mismo 401" 401 "$(code "$R")"
ck "  mismo code (no revela cual fallo)" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"

R=$(req $FLR POST /floor/login '{"username":"carlos.vis","pin":"1234"}')
ck "login de pista -> 200" 200 "$(code "$R")"
ck "  cookie de pista escrita" 1 "$(grep -c elite_floor_session $FLR)"

FLOOR_TOKEN=$(grep elite_floor_session $FLR | awk '{print $NF}')
OFFICE_TOKEN=$(grep -E 'elite_session' $OFF | awk '{print $NF}')
probe() { curl -s -o /dev/null -w '%{http_code}' "$API$1" -H "Cookie: $2"; }
ck "empleado NO alcanza /auth/me" 401 "$(probe /auth/me "elite_session=$FLOOR_TOKEN")"
ck "empleado NO alcanza /users" 401 "$(probe /users "elite_session=$FLOOR_TOKEN")"
ck "empleado NO alcanza /employees" 401 "$(probe /employees "elite_session=$FLOOR_TOKEN")"
ck "empleado NO alcanza el cobro" 401 "$(probe /carwash/tickets "elite_session=$FLOOR_TOKEN")"
ck "admin NO alcanza /floor/me" 401 "$(probe /floor/me "elite_floor_session=$OFFICE_TOKEN")"
ck "las dos cookies conviven: /auth/me" 200 "$(probe /auth/me "elite_session=$OFFICE_TOKEN; elite_floor_session=$FLOOR_TOKEN")"
ck "las dos cookies conviven: /floor/me" 200 "$(probe /floor/me "elite_session=$OFFICE_TOKEN; elite_floor_session=$FLOOR_TOKEN")"

echo
echo "== 2. Catalogo y precios (RN-2, RN-3) =="
R=$(req $FLR GET /floor/vehicle-body-types)
ck "la pista lee los tipos de carro -> 200" 200 "$(code "$R")"
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
SUV=$(body "$R" | jq -r '.[]|select(.key=="suv").id')
R=$(req $FLR GET /floor/services)
SRV1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").id')
SRV2=$(body "$R" | jq -r '.[]|select(.code=="SRV-0002").id')
ck "SRV-0001 base es 8.00 (sedan)" '"8.00"' "$(body "$R" | jq -c '.[]|select(.code=="SRV-0001").defaultPrice')"

echo
echo "== 3. Alta desde la pista (RN-7, RN-8, RN-12, RN-15) =="
R=$(req $FLR POST /floor/tickets "{
  \"customer\": {\"fullName\":\"Maria VIS\",\"phone\":\"7777-0001\"},
  \"vehicle\": {\"plate\":\"P VIS-001\",\"bodyTypeId\":\"$SUV\",\"make\":\"Toyota\"},
  \"items\": [{\"serviceId\":\"$SRV1\"},{\"serviceId\":\"$SRV2\"}]
}")
ck "abre ticket -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r '.id')
ck "  nace OPEN" '"OPEN"' "$(body "$R" | jq -c .status)"
ck "  numero correlativo con formato CW-" 1 "$(body "$R" | jq -r .number | grep -c '^CW-[0-9]\{4\}')"
ck "  el lavador es quien abrio (RN-8)" '"Carlos VIS"' "$(body "$R" | jq -c .washer.fullName)"
ck "  la placa se normaliza (RN-12)" '"PVIS-001"' "$(body "$R" | jq -c .vehicle.plate)"
# RN-2: camioneta cobra por matriz (10.00 + 12.00), no por base (8.00 + 10.00).
ck "  precio de camioneta por matriz, no base (RN-2)" '"22.00"' "$(body "$R" | jq -c .total)"
ck "  la linea copia el precio de catalogo (RN-4)" '"10.00"' "$(body "$R" | jq -c '.items[0].catalogPrice')"

R=$(req $FLR POST /floor/tickets "{\"customer\":{\"fullName\":\"Sin servicios VIS\"},\"vehicle\":{\"plate\":\"P VIS-404\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[]}")
ck "sin servicios -> 422" 422 "$(code "$R")"
ck "  code TICKET_INCOMPLETE (RN-7)" TICKET_INCOMPLETE "$(body "$R" | jq -r .code)"

echo
echo "== 4. Descuento: solo baja (RN-5) =="
R=$(req $FLR PATCH /floor/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV1\",\"unitPrice\":\"8.00\"},{\"serviceId\":\"$SRV2\"}]}")
ck "bajar el precio -> 200" 200 "$(code "$R")"
ck "  se guarda el descuento" '"8.00"' "$(body "$R" | jq -c '.items[0].unitPrice')"
ck "  el catalogo queda como referencia (RN-5)" '"10.00"' "$(body "$R" | jq -c '.items[0].catalogPrice')"
ck "  el total baja" '"20.00"' "$(body "$R" | jq -c .total)"
R=$(req $FLR PATCH /floor/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV1\",\"unitPrice\":\"12.00\"}]}")
ck "subir por encima del catalogo -> 422" 422 "$(code "$R")"
ck "  code PRICE_ABOVE_CATALOG" PRICE_ABOVE_CATALOG "$(body "$R" | jq -r .code)"
R=$(req $FLR GET /floor/tickets/$T1)
ck "  y el precio no cambio" '"8.00"' "$(body "$R" | jq -c '.items[0].unitPrice')"

echo
echo "== 5. Estados (RN-9) =="
R=$(req $FLR POST /floor/tickets/$T1/ready)
ck "la pista marca listo -> READY" '"READY"' "$(body "$R" | jq -c .status)"
R=$(req $FLR POST /floor/tickets/$T1/ready)
ck "marcar listo dos veces -> 409" 409 "$(code "$R")"
ck "  code TICKET_NOT_OPEN" TICKET_NOT_OPEN "$(body "$R" | jq -r .code)"
R=$(req $FLR POST /floor/tickets/$T1/reopen)
ck "la pista reabre -> OPEN" '"OPEN"' "$(body "$R" | jq -c .status)"
R=$(req $FLR POST /floor/tickets/$T1/ready)
ck "vuelve a listo -> READY" '"READY"' "$(body "$R" | jq -c .status)"
ck "la pista no tiene ruta de cobro" 404 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/floor/tickets/$T1/charge -b $FLR -H 'Content-Type: application/json' -d '{}')"
ck "la pista no tiene ruta de anular" 404 "$(curl -s -o /dev/null -w '%{http_code}' -X POST $API/floor/tickets/$T1/void -b $FLR)"

echo
echo "== 6. Cobro, solo en oficina (RN-10) =="
R=$(req $OFF GET /carwash/tickets/$T1)
ck "la oficina ve el ticket -> 200" 200 "$(code "$R")"
TOTAL=$(body "$R" | jq -r .total)
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"10.00\"}")
ck "cobrar de menos -> 422" 422 "$(code "$R")"
ck "  code PAYMENT_AMOUNT_MISMATCH" PAYMENT_AMOUNT_MISMATCH "$(body "$R" | jq -r .code)"
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"99.00\"}")
ck "cobrar de mas -> 422 (no hay vuelto)" 422 "$(code "$R")"
R=$(req $OFF GET /carwash/tickets/$T1)
ck "  y sigue READY" '"READY"' "$(body "$R" | jq -c .status)"
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobrar el monto exacto -> PAID" '"PAID"' "$(body "$R" | jq -c .status)"
ck "  queda el pago con su metodo" '"CASH"' "$(body "$R" | jq -c .payment.method)"
ck "  y su monto" "\"$TOTAL\"" "$(body "$R" | jq -c .payment.amount)"
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobrar dos veces -> 409" 409 "$(code "$R")"
R=$(req $OFF PATCH /carwash/tickets/$T1 '{"notes":"ya cobrado"}')
ck "editar un cobrado -> 409 (RN-9)" 409 "$(code "$R")"
R=$(req $OFF POST /carwash/tickets/$T1/void)
ck "anular un cobrado -> 409 (PAID es final)" 409 "$(code "$R")"
ck "  code TICKET_NOT_VOIDABLE" TICKET_NOT_VOIDABLE "$(body "$R" | jq -r .code)"

echo
echo "== 7. Alta de emergencia y anulacion desde oficina (RN-7, RN-8, RN-11) =="
R=$(req $OFF POST /carwash/tickets "{
  \"customer\": {\"fullName\":\"Oficina VIS\"},
  \"vehicle\": {\"plate\":\"P VIS-002\",\"bodyTypeId\":\"$SEDAN\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "alta sin lavador -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r '.id')
ck "  el lavador queda vacio: es «Oficina» (RN-8)" null "$(body "$R" | jq -c .washer)"
ck "  precio de sedan por matriz (RN-2)" '"8.00"' "$(body "$R" | jq -c .total)"
R=$(req $OFF POST /carwash/tickets "{
  \"customer\": {\"fullName\":\"Oficina VIS 2\"},
  \"vehicle\": {\"plate\":\"P VIS-003\",\"bodyTypeId\":\"$SEDAN\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}],
  \"employeeId\": \"$EMP_ID\"
}")
ck "alta eligiendo lavador -> 201" 201 "$(code "$R")"
ck "  ese empleado queda como lavador" '"Carlos VIS"' "$(body "$R" | jq -c .washer.fullName)"
T3=$(body "$R" | jq -r '.id')
R=$(req $OFF POST /carwash/tickets "{
  \"customer\": {\"fullName\":\"X VIS\"},
  \"vehicle\": {\"plate\":\"P VIS-009\",\"bodyTypeId\":\"$SEDAN\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}],
  \"employeeId\": \"00000000-0000-4000-8000-000000000000\"
}")
ck "lavador inexistente -> 422" 422 "$(code "$R")"
ck "  code INVALID_WASHER" INVALID_WASHER "$(body "$R" | jq -r .code)"
R=$(req $OFF POST /carwash/tickets/$T2/void)
ck "anular un OPEN -> VOID" '"VOID"' "$(body "$R" | jq -c .status)"
R=$(req $OFF POST /carwash/tickets/$T2/ready)
ck "  VOID es final" 409 "$(code "$R")"

echo
echo "== 8. Un empleado marca listo lo que anoto otro (RN-9) =="
R=$(req $OFF POST /employees '{"fullName":"Jose VIS","username":"jose.vis","pin":"5678"}')
EMP2=$(body "$R" | jq -r .id)
FLR2=$S/floor2.jar; rm -f $FLR2
req $FLR2 POST /floor/login '{"username":"jose.vis","pin":"5678"}' >/dev/null
R=$(req $FLR2 POST /floor/tickets/$T3/ready)
ck "José marca listo el ticket de Carlos -> READY" '"READY"' "$(body "$R" | jq -c .status)"
ck "  el lavador sigue siendo Carlos (RN-8)" '"Carlos VIS"' "$(body "$R" | jq -c .washer.fullName)"

echo
echo "== 9. Reemplazar el PIN cierra las sesiones (RN-18) =="
ck "la sesion de José vale" 200 "$(code "$(req $FLR2 GET /floor/me)")"
req $OFF PATCH /employees/$EMP2 '{"pin":"4444"}' >/dev/null
ck "tras reemplazarle el PIN -> 401" 401 "$(code "$(req $FLR2 GET /floor/me)")"
rm -f $FLR2
R=$(req $FLR2 POST /floor/login '{"username":"jose.vis","pin":"4444"}')
ck "entra con el PIN nuevo -> 200" 200 "$(code "$R")"

echo
echo "== 10. Desactivar corta el acceso a la pista (RN-13) =="
req $OFF PATCH /employees/$EMP2 '{"isActive":false}' >/dev/null
ck "la sesion del desactivado -> 401" 401 "$(code "$(req $FLR2 GET /floor/me)")"
R=$(req $FLR2 POST /floor/login '{"username":"jose.vis","pin":"4444"}')
ck "y no puede volver a entrar -> 401" 401 "$(code "$R")"

echo
echo "== 11. La placa se reutiliza (RN-12) =="
R=$(req $FLR POST /floor/tickets "{
  \"customer\": {\"fullName\":\"Otro dueno VIS\"},
  \"vehicle\": {\"plate\":\"PVIS-001\",\"bodyTypeId\":\"$SUV\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "misma placa, otro cliente -> 201" 201 "$(code "$R")"
R2=$(req $OFF GET "/vehicles?q=PVIS-001")
ck "  sigue habiendo UN solo vehiculo con esa placa" 1 "$(body "$R2" | jq 'length')"
ck "  y el dueno actual es el nuevo" '"Otro dueno VIS"' "$(body "$R2" | jq -c '.[0].currentOwner.fullName')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

# Limpieza: nada con sufijo VIS debe quedar en la base.
if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "${POSTGRES_USER:-elite}" -d "${POSTGRES_DB:-elite_service}" -q \
    -c 'delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$PVIS-%$$);
        delete from vehicles where plate like $$PVIS-%$$;
        delete from customers where "fullName" like $$%VIS%$$;
        delete from employees where username like $$%.vis$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS)."
fi

[ "$FAIL" -eq 0 ] || exit 1
