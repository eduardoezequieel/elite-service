#!/bin/bash
# Verificacion end-to-end de la spec 049 (tablero de pista): el unico cambio de
# API es que el Ticket viaje con `readyAt`, la hora de la ultima entrada a READY
# segun el historial de la 046.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-049.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
POSTGRES_USER=$(grep '^POSTGRES_USER=' .env | cut -d= -f2-)
POSTGRES_DB=$(grep '^POSTGRES_DB=' .env | cut -d= -f2-)
POSTGRES_USER=${POSTGRES_USER:-elite}
POSTGRES_DB=${POSTGRES_DB:-elite_service}
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
# ISO con milisegundos y Z, que es lo que `toISOString()` produce.
is_iso() {
  case "$1" in
    [0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T[0-9][0-9]:[0-9][0-9]:[0-9][0-9].[0-9][0-9][0-9]Z) echo true ;;
    *) echo false ;;
  esac
}

OFF=$S/office.jar
rm -f "$OFF"

echo "== 0. Sesion de oficina =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET /services)
SRV3=$(body "$R" | jq -r '.[]|select(.code=="SRV-0003").id')

echo
echo "== 1. Un lavado recien abierto no tiene hora de listo =="
R=$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Tablero VIS049\"},\"vehicle\":{\"plate\":\"P049-001\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV3\"}]}")
ck "POST oficina -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r '.id')
ck "  el alta ya trae el campo" true "$(body "$R" | jq -r 'has("readyAt")')"
ck "  y viene en null" true "$(body "$R" | jq -r '.readyAt == null')"

R=$(req $OFF GET /carwash/tickets/$T1)
ck "GET del OPEN -> 200" 200 "$(code "$R")"
ck "  readyAt null" true "$(body "$R" | jq -r '.readyAt == null')"

R=$(req $OFF GET /carwash/tickets)
ck "la fila de hoy -> 200" 200 "$(code "$R")"
ck "  lo lista con readyAt null" true "$(body "$R" | jq -r --arg id "$T1" '[.[]|select(.id==$id)][0].readyAt == null')"

echo
echo "== 2. WASHING tampoco la pone =="
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"WASHING"}')
ck "OPEN -> WASHING -> 200" 200 "$(code "$R")"
ck "  readyAt sigue null" true "$(body "$R" | jq -r '.readyAt == null')"
R=$(req $OFF GET /carwash/tickets/$T1)
ck "  y el GET tambien" true "$(body "$R" | jq -r '.readyAt == null')"

echo
echo "== 3. Al pasar a READY la hora sale en la misma respuesta =="
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "WASHING -> READY -> 200" 200 "$(code "$R")"
READY_AT=$(body "$R" | jq -r '.readyAt')
ck "  la respuesta del cambio la trae (null?)" false "$([ "$READY_AT" = "null" ] && echo true || echo false)"
ck "  con formato ISO" true "$(is_iso "$READY_AT")"

R=$(req $OFF GET /carwash/tickets/$T1)
ck "GET del READY -> 200" 200 "$(code "$R")"
GOT=$(body "$R" | jq -r '.readyAt')
ck "  el GET la trae (null?)" false "$([ "$GOT" = "null" ] && echo true || echo false)"
ck "  con formato ISO" true "$(is_iso "$GOT")"
ck "  la misma hora que devolvio el cambio" "$READY_AT" "$GOT"
ck "  el lavado conserva su inicio" true "$(body "$R" | jq -r '.washingStartedAt != null')"

R=$(req $OFF GET /carwash/tickets)
ck "  la fila de hoy lo lista con la misma hora" "$READY_AT" "$(body "$R" | jq -r --arg id "$T1" '[.[]|select(.id==$id)][0].readyAt')"

echo
echo "== 4. El historial es de solo agregar: volver a la pista no la borra =="
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"WASHING"}')
ck "READY -> WASHING -> 200" 200 "$(code "$R")"
ck "  conserva el ultimo READY" "$READY_AT" "$(body "$R" | jq -r '.readyAt')"

# Un segundo de por medio: las dos entradas a READY tienen que distinguirse con
# la precision de milisegundos que sobrevive al ISO.
sleep 1
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "WASHING -> READY otra vez -> 200" 200 "$(code "$R")"
AGAIN=$(body "$R" | jq -r '.readyAt')
ck "  ahora manda la entrada nueva (igual a la vieja?)" false "$([ "$AGAIN" = "$READY_AT" ] && echo true || echo false)"
ck "  y es posterior a la anterior" true "$([ "$AGAIN" \> "$READY_AT" ] && echo true || echo false)"

echo
echo "== 5. Un lavado anterior al historial de la 046 no tiene hora =="
if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c "delete from work_order_status_events where \"workOrderId\" = '$T1'" >/dev/null 2>&1
  R=$(req $OFF GET /carwash/tickets/$T1)
  ck "sin filas de historial -> 200" 200 "$(code "$R")"
  ck "  readyAt null aunque este READY" true "$(body "$R" | jq -r '.status == "READY" and .readyAt == null')"
else
  echo "  AVISO: sin docker, no se puede simular un lavado anterior a la 046."
fi

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from work_order_status_events where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS049%$$));
        delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS049%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS049%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS049%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS049%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS049%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P049-%$$);
        delete from vehicles where plate like $$P049-%$$;
        delete from customers where "fullName" like $$%VIS049%$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS049)."
fi

[ "$FAIL" -eq 0 ] || exit 1
