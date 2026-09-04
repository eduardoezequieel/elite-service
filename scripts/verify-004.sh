#!/bin/bash
# Verificacion end-to-end de la spec 004 (clientes: buscarlos al vuelo y verlos
# despues).
#
# Recorre los criterios de aceptacion contra un stack levantado: base sembrada,
# API en marcha. Prueba el sistema armado —Prisma, los dos guards, las dos
# cookies, el HTTP— que es lo que `pnpm test` no puede hacer con repositorios en
# memoria.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-004.sh
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
# `null` viaja como cuerpo vacio: es la respuesta normal de `match` cuando no
# hay nadie parecido.
empty() { [ -z "$(body "$1" | tr -d '[:space:]')" ] && echo vacio || echo "$(body "$1")"; }

OFF=$S/office.jar; FLR=$S/floor.jar; ANON=$S/anon.jar
rm -f "$OFF" "$FLR" "$ANON"

echo "== 0. Preparacion =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /employees '{"fullName":"Lavador VIS","username":"lavador.vis","pin":"1234"}')
ck "alta de empleado de pista -> 201" 201 "$(code "$R")"
R=$(req $FLR POST /floor/login '{"username":"lavador.vis","pin":"1234"}')
ck "login de pista -> 200" 200 "$(code "$R")"

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET /services)
SRV1=$(body "$R" | jq -r '.[]|select(.code=="SRV-0001").id')

# Juan lleva acento y el telefono con guion a proposito: asi se escribe en el
# mostrador, y asi tiene que encontrarse escrito de cualquier otra forma.
R=$(req $OFF POST /customers '{"fullName":"Juan Pérez VIS","phone":"7777-0104"}')
ck "alta de cliente -> 201" 201 "$(code "$R")"
JUAN=$(body "$R" | jq -r .id)
R=$(req $OFF POST /customers '{"fullName":"Baja VIS","phone":"3333-0104"}')
BAJA=$(body "$R" | jq -r .id)
req $OFF PATCH /customers/$BAJA '{"isActive":false}' >/dev/null

echo
echo "== 1. Coincidencia por nombre (RN-1) =="
R=$(req $OFF GET "/customers/match?fullName=juan%20perez%20vis")
ck "sin acentos, en minusculas y con otro espaciado -> 200" 200 "$(code "$R")"
ck "  encuentra a Juan" "\"$JUAN\"" "$(body "$R" | jq -c .customer.id)"
ck "  y dice por que: nombre" '"name"' "$(body "$R" | jq -c .on)"
R=$(req $OFF GET "/customers/match?fullName=JUAN%20%20PEREZ%20VIS")
ck "en mayusculas y con espacio de sobra -> mismo cliente" "\"$JUAN\"" "$(body "$R" | jq -c .customer.id)"

echo
echo "== 2. Coincidencia por telefono, que pesa mas (RN-1) =="
R=$(req $OFF GET "/customers/match?fullName=Otro%20Nombre%20VIS&phone=7777%200104")
ck "telefono con espacio en vez de guion -> 200" 200 "$(code "$R")"
ck "  encuentra a Juan aunque el nombre sea otro" "\"$JUAN\"" "$(body "$R" | jq -c .customer.id)"
ck "  y dice por que: telefono" '"phone"' "$(body "$R" | jq -c .on)"
R=$(req $OFF GET "/customers/match?fullName=Otro%20Nombre%20VIS&phone=77770104")
ck "telefono sin puntuacion -> mismo cliente" "\"$JUAN\"" "$(body "$R" | jq -c .customer.id)"
R=$(req $OFF GET "/customers/match?fullName=Juan%20P%C3%A9rez%20VIS&phone=7777-0104")
ck "coincidiendo las dos cosas, gana el telefono" '"phone"' "$(body "$R" | jq -c .on)"

echo
echo "== 3. Cuando no hay nadie parecido =="
R=$(req $OFF GET "/customers/match?fullName=Nadie%20Se%20Llama%20Asi%20VIS")
ck "sin coincidencia -> 200" 200 "$(code "$R")"
ck "  y el cuerpo es null" vacio "$(empty "$R")"
R=$(req $OFF GET "/customers/match?fullName=Sin%20Telefono%20VIS&phone=")
ck "un telefono vacio no coincide con otro vacio" vacio "$(empty "$R")"
R=$(req $OFF GET "/customers/match")
# 422 y no 400: en este API el 400 queda para el request malformado y los datos
# malos son 422 (apps/api/AGENTS.md, convencion 5).
ck "sin nombre -> 422" 422 "$(code "$R")"
ck "  code VALIDATION_ERROR" VALIDATION_ERROR "$(body "$R" | jq -r .code)"

echo
echo "== 4. Un desactivado no se sugiere ni se propone (RN-4) =="
R=$(req $OFF GET "/customers?q=Baja%20VIS")
ck "la busqueda por omision no lo trae" 0 "$(body "$R" | jq 'length')"
R=$(req $OFF GET "/customers?q=Baja%20VIS&activeOnly=false")
ck "con activeOnly=false si aparece" 1 "$(body "$R" | jq 'length')"
R=$(req $OFF GET "/customers/match?fullName=Baja%20VIS&phone=3333-0104")
ck "y no se propone como «el mismo»" vacio "$(empty "$R")"
R=$(req $FLR GET "/floor/customers?q=Baja%20VIS")
ck "la pista tampoco lo sugiere" 0 "$(body "$R" | jq 'length')"

echo
echo "== 5. Elegir un cliente NO crea otro =="
ANTES=$(body "$(req $OFF GET "/customers?activeOnly=false")" | jq 'length')
R=$(req $OFF POST /carwash/tickets "{
  \"customerId\": \"$JUAN\",
  \"vehicle\": {\"plate\":\"P VIS-104\",\"bodyTypeId\":\"$SEDAN\",\"make\":\"Nissan\",\"color\":\"Azul\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "abrir lavado con customerId -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r .id)
ck "  el lavado queda a nombre del cliente elegido" "\"$JUAN\"" "$(body "$R" | jq -c .customer.id)"
DESPUES=$(body "$(req $OFF GET "/customers?activeOnly=false")" | jq 'length')
ck "  el total de clientes no cambia" "$ANTES" "$DESPUES"

R=$(req $FLR POST /floor/tickets "{
  \"customerId\": \"$JUAN\",
  \"vehicle\": {\"plate\":\"P VIS-105\",\"bodyTypeId\":\"$SEDAN\"},
  \"items\": [{\"serviceId\":\"$SRV1\"}]
}")
ck "la pista tambien abre con customerId -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r .id)
ck "  y tampoco crea clientes" "$ANTES" "$(body "$(req $OFF GET "/customers?activeOnly=false")" | jq 'length')"

echo
echo "== 6. La ficha del cliente =="
R=$(req $OFF GET "/customers/$JUAN")
ck "GET /customers/:id -> 200" 200 "$(code "$R")"
ck "  con su nombre" '"Juan Pérez VIS"' "$(body "$R" | jq -c .fullName)"
R=$(req $OFF GET "/customers/00000000-0000-4000-8000-000000000000")
ck "un id que no existe -> 404" 404 "$(code "$R")"
ck "  code NOT_FOUND" NOT_FOUND "$(body "$R" | jq -r .code)"

R=$(req $OFF GET "/vehicles?customerId=$JUAN")
ck "sus carros -> 200" 200 "$(code "$R")"
ck "  son los dos que entraron a su nombre" 2 "$(body "$R" | jq 'length')"
ck "  y todos son suyos" 2 "$(body "$R" | jq "[.[]|select(.currentOwner.id==\"$JUAN\")]|length")"

# El historial no se recorta por dia ni por estado: un lavado anulado sigue
# siendo algo que le pasó a este cliente.
req $OFF POST /carwash/tickets/$T2/void >/dev/null
R=$(req $OFF GET "/carwash/tickets?customerId=$JUAN")
ck "sus lavados -> 200" 200 "$(code "$R")"
ck "  estan los dos" 2 "$(body "$R" | jq 'length')"
ck "  incluido el anulado (cualquier estado)" 1 "$(body "$R" | jq '[.[]|select(.status=="VOID")]|length')"
ck "  y ninguno es de otro cliente" 2 "$(body "$R" | jq "[.[]|select(.customer.id==\"$JUAN\")]|length")"
ck "  como mucho 20" true "$(body "$R" | jq 'length <= 20')"

echo
echo "== 7. La pista busca y da de alta, pero no administra (RN-5) =="
R=$(req $FLR GET "/floor/customers?q=Juan")
ck "la pista busca clientes -> 200" 200 "$(code "$R")"
ck "  y encuentra a Juan" 1 "$(body "$R" | jq "[.[]|select(.id==\"$JUAN\")]|length")"
R=$(req $FLR GET "/floor/customers/match?fullName=juan%20perez%20vis")
ck "la pista pregunta si ya existe -> 200" 200 "$(code "$R")"
ck "  y encuentra a Juan" "\"$JUAN\"" "$(body "$R" | jq -c .customer.id)"

FLOOR_TOKEN=$(grep elite_floor_session $FLR | awk '{print $NF}')
OFFICE_TOKEN=$(grep -E 'elite_session' $OFF | awk '{print $NF}')
probe() { curl -s -o /dev/null -w '%{http_code}' "$API$1" -H "Cookie: $2"; }
ck "la pista NO lista clientes de oficina" 401 "$(probe /customers "elite_session=$FLOOR_TOKEN")"
ck "la pista NO abre la ficha de un cliente" 401 "$(probe /customers/$JUAN "elite_session=$FLOOR_TOKEN")"
ck "la pista NO pregunta por /customers/match" 401 "$(probe "/customers/match?fullName=Juan" "elite_session=$FLOOR_TOKEN")"
ck "la oficina NO entra por la puerta de la pista" 401 "$(probe "/floor/customers/match?fullName=Juan" "elite_floor_session=$OFFICE_TOKEN")"
ck "sin sesion, /customers -> 401" 401 "$(curl -s -o /dev/null -w '%{http_code}' "$API/customers")"

echo
echo "== 8. Corregir y desactivar desde la oficina =="
R=$(req $OFF PATCH /customers/$JUAN '{"phone":"7777-9999"}')
ck "corregir el telefono -> 200" 200 "$(code "$R")"
ck "  queda guardado" '"7777-9999"' "$(body "$R" | jq -c .phone)"
R=$(req $OFF GET "/customers/match?fullName=Otro%20VIS&phone=77779999")
ck "y el nuevo telefono ya coincide" "\"$JUAN\"" "$(body "$R" | jq -c .customer.id)"
req $OFF PATCH /customers/$JUAN '{"isActive":false}' >/dev/null
R=$(req $FLR GET "/floor/customers?q=Juan%20P")
ck "desactivado, deja de sugerirse en la pista" 0 "$(body "$R" | jq "[.[]|select(.id==\"$JUAN\")]|length")"
R=$(req $OFF GET "/carwash/tickets/$T1")
ck "pero sus lavados viejos lo siguen mostrando (003 RN-13)" '"Juan Pérez VIS"' "$(body "$R" | jq -c .customer.fullName)"
req $OFF PATCH /customers/$JUAN '{"isActive":true}' >/dev/null
R=$(req $FLR GET "/floor/customers?q=Juan%20P")
ck "reactivado, vuelve a sugerirse" 1 "$(body "$R" | jq "[.[]|select(.id==\"$JUAN\")]|length")"

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
