#!/bin/bash
# Verificacion end-to-end de la spec 060 (cambiar un precio pide la firma de un
# administrador desde que el lavado esta listo).
#
# Lo que prueba y `pnpm test` no puede: que la puerta este cerrada de verdad
# —guard de autorizacion incluido— y que siga abierta mientras el lavado esta
# abierto, que es el limite que pidio el taller.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-060.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
PASS=0; FAIL=0

# Cajero de prueba: cobra, pero no puede autorizar precios.
CASHIER_EMAIL=cajero.vis060@elite.local
CASHIER_PASSWORD=Cajero060!

ck() {
  if [ "$2" = "$3" ]; then echo "  OK   $1  ($3)"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}
ckc() {
  case "$3" in
    *"$2"*) echo "  OK   $1"; PASS=$((PASS+1));;
    *) echo "  FALLA $1  esperado contener=$2 obtenido=$3"; FAIL=$((FAIL+1));;
  esac
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

ADMIN_AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
CASHIER_AUTH="\"authorization\":{\"email\":\"$CASHIER_EMAIL\",\"password\":\"$CASHIER_PASSWORD\"}"
OFF=$S/office.jar; CAJ=$S/cashier.jar
rm -f "$OFF" "$CAJ"

echo "== 0. Sesiones, caja y catalogo =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_NAME=$(body "$R" | jq -r '.user.fullName')

R=$(req $OFF POST /roles '{"name":"Caja VIS060","permissionKeys":["carwash.read","carwash.manage","carwash.charge","carwash.cash","carwash.audit","customers.read","vehicles.read","services.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?search=Caja%20VIS060")" | jq -r '.items[]|select(.name=="Caja VIS060").id');;
esac
req $OFF POST /users "{\"email\":\"$CASHIER_EMAIL\",\"fullName\":\"Cajero VIS060\",\"password\":\"$CASHIER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null

R=$(req $CAJ POST /auth/login "{\"email\":\"$CASHIER_EMAIL\",\"password\":\"$CASHIER_PASSWORD\"}")
ck "login del cajero -> 200" 200 "$(code "$R")"
ck "  no tiene carwash.discount" 0 "$(body "$R" | jq '[.permissions[]|select(.=="carwash.discount")]|length')"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
case "$(code "$R")" in 200|201|409) echo "  caja lista";; *) echo "  AVISO: abrir caja devolvio $(code "$R")";; esac

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET "/services?pageSize=100")
SRV=$(body "$R" | jq -r '.items[0].id')

n=0
open_ticket() {
  n=$((n+1))
  local plate
  plate=$(printf 'P060-%03d' "$n")
  body "$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS060\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")" | jq -r '.id'
}
item_of() { body "$(req $OFF GET /carwash/tickets/$1)" | jq -r '.items[0].id'; }
catalog_of() { body "$(req $OFF GET /carwash/tickets/$1)" | jq -r '.items[0].catalogPrice'; }
price_of() { body "$(req $OFF GET /carwash/tickets/$1)" | jq -r '.items[0].unitPrice'; }
status_of() { body "$(req $OFF GET /carwash/tickets/$1)" | jq -r .status; }

echo
echo "== 1. Con el lavado abierto, recepcion pone el precio sin pedir permiso =="
T=$(open_ticket)
CAT=$(catalog_of "$T")
LOWER=$(awk -v v="$CAT" 'BEGIN{printf "%.2f", v-1}')
R=$(req $OFF PATCH /carwash/tickets/$T "{\"items\":[{\"serviceId\":\"$SRV\",\"unitPrice\":\"$LOWER\"}]}")
ck "editar el precio de un lavado OPEN -> 200" 200 "$(code "$R")"
ck "  quedo el precio rebajado" "$LOWER" "$(price_of "$T")"

echo
echo "== 2. Desde READY, ese mismo camino se cierra =="
req $OFF POST /carwash/tickets/$T/status '{"status":"READY"}' >/dev/null
AGAIN=$(awk -v v="$CAT" 'BEGIN{printf "%.2f", v-2}')
R=$(req $OFF PATCH /carwash/tickets/$T "{\"items\":[{\"serviceId\":\"$SRV\",\"unitPrice\":\"$AGAIN\"}]}")
ck "editar el precio de un lavado READY -> 422" 422 "$(code "$R")"
ck "  PRICE_CHANGE_NOT_AUTHORIZED" PRICE_CHANGE_NOT_AUTHORIZED "$(body "$R" | jq -r .code)"
ck "  el precio no se movio" "$LOWER" "$(price_of "$T")"

echo
echo "== 3. El endpoint del precio exige la firma =="
ITEM=$(item_of "$T")
R=$(req $CAJ PATCH /carwash/tickets/$T/items/$ITEM/price "{\"unitPrice\":\"$AGAIN\",\"reason\":\"Sin firma\"}")
ck "sin el bloque authorization -> 422" 422 "$(code "$R")"
ck "  VALIDATION_ERROR" VALIDATION_ERROR "$(body "$R" | jq -r .code)"

R=$(req $CAJ PATCH /carwash/tickets/$T/items/$ITEM/price "{\"unitPrice\":\"$AGAIN\",\"reason\":\"Contrasena mala\",\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"no-es-esta\"}}")
ck "contrasena incorrecta -> 403" 403 "$(code "$R")"
ck "  AUTHORIZATION_FAILED" AUTHORIZATION_FAILED "$(body "$R" | jq -r .code)"

R=$(req $CAJ PATCH /carwash/tickets/$T/items/$ITEM/price "{\"unitPrice\":\"$AGAIN\",\"reason\":\"Firma sin permiso\",$CASHIER_AUTH}")
ck "firma de quien no tiene carwash.discount -> 403" 403 "$(code "$R")"
ck "  AUTHORIZATION_FAILED" AUTHORIZATION_FAILED "$(body "$R" | jq -r .code)"
ck "  el precio no se movio" "$LOWER" "$(price_of "$T")"

echo
echo "== 4. El cajero cambia el precio con la firma del administrador =="
R=$(req $CAJ PATCH /carwash/tickets/$T/items/$ITEM/price "{\"unitPrice\":\"$AGAIN\",\"reason\":\"Cobraron de mas en el catalogo\",$ADMIN_AUTH}")
ck "cajero + firma del admin -> 200" 200 "$(code "$R")"
ck "  el precio quedo" "$AGAIN" "$(price_of "$T")"
ck "  el catalogo no se toco (RN-7)" "$CAT" "$(catalog_of "$T")"
ck "  el total del lavado es el precio nuevo" "$AGAIN" "$(body "$R" | jq -r .total)"
ckc "  queda quien autorizo" "$ADMIN_NAME" "$(body "$R" | jq -r '.items[0].priceAuthorizedBy.fullName // ""')"

echo
echo "== 5. Un servicio tambien sube, con la misma firma (087) =="
ABOVE=$(awk -v v="$CAT" 'BEGIN{printf "%.2f", v+1}')
R=$(req $CAJ PATCH /carwash/tickets/$T/items/$ITEM/price "{\"unitPrice\":\"$ABOVE\",\"reason\":\"Arriba del catalogo\"}")
ck "subir sin firma -> 422" 422 "$(code "$R")"
ck "  el precio no se movio" "$AGAIN" "$(price_of "$T")"
R=$(req $CAJ PATCH /carwash/tickets/$T/items/$ITEM/price "{\"unitPrice\":\"$ABOVE\",\"reason\":\"Arriba del catalogo\",$ADMIN_AUTH}")
ck "subir con la firma del admin -> 200" 200 "$(code "$R")"
ck "  el precio quedo arriba del catalogo" "$ABOVE" "$(price_of "$T")"
ck "  el catalogo no se toco" "$CAT" "$(catalog_of "$T")"

echo
echo "== 6. La sesion del cajero sigue siendo la del cajero (RN-6) =="
ck "  /auth/me sigue en el cajero" "$CASHIER_EMAIL" "$(body "$(req $CAJ GET /auth/me)" | jq -r '.user.email')"

echo
echo "== 7. El historial lo cuenta (046) =="
ckc "  la linea de tiempo trae el cambio de precio" "PRICE" "$(body "$(req $OFF GET /carwash/tickets/$T/timeline)" | jq -r '[.events[].type]|join(",")')"

echo
echo "== 8. Un lavado cobrado no admite cambios =="
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T)" | jq -r .total)
req $CAJ POST /carwash/charges "{\"workOrderIds\":[\"$T\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}]}" >/dev/null
ck "  el lavado quedo PAID" PAID "$(status_of "$T")"
R=$(req $CAJ PATCH /carwash/tickets/$T/items/$ITEM/price "{\"unitPrice\":\"1.00\",\"reason\":\"Ya cobrado\",$ADMIN_AUTH}")
ck "cambiar el precio de un PAID -> 409" 409 "$(code "$R")"
ck "  TICKET_ALREADY_CHARGED" TICKET_ALREADY_CHARGED "$(body "$R" | jq -r .code)"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
