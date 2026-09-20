#!/bin/bash
# Verificacion end-to-end de la spec 045 (anular y deshacer cobro piden la
# autorizacion de alguien con el permiso).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-045.sh
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

# Cajero de prueba: ve el modulo pero NO puede anular ni deshacer cobros.
CASHIER_EMAIL=cajero.vis045@elite.local
CASHIER_PASSWORD=Cajero045!

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

echo "== 0. Sesiones y datos =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_NAME=$(body "$R" | jq -r '.user.fullName')

# Rol sin carwash.void ni carwash.reverse: ve la fila, cobra y abre caja.
R=$(req $OFF POST /roles '{"name":"Caja VIS045","permissionKeys":["carwash.read","carwash.charge","carwash.cash","customers.read","vehicles.read","services.read"]}')
ck "rol sin void/reverse -> 201" 201 "$(code "$R")"
ROLE=$(body "$R" | jq -r '.id')

R=$(req $OFF POST /users "{\"email\":\"$CASHIER_EMAIL\",\"fullName\":\"Cajero VIS045\",\"password\":\"$CASHIER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}")
ck "alta del cajero -> 201" 201 "$(code "$R")"

R=$(req $CAJ POST /auth/login "{\"email\":\"$CASHIER_EMAIL\",\"password\":\"$CASHIER_PASSWORD\"}")
ck "login del cajero -> 200" 200 "$(code "$R")"
ck "  no tiene carwash.void" 0 "$(body "$R" | jq '[.permissions[]|select(.=="carwash.void")]|length')"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
CASH_CODE=$(code "$R")
if [ "$CASH_CODE" = "200" ] || [ "$CASH_CODE" = "201" ] || [ "$CASH_CODE" = "409" ]; then
  echo "  caja lista ($CASH_CODE)"
else
  echo "  AVISO: abrir caja devolvió $CASH_CODE"
fi

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET /services)
SRV=$(body "$R" | jq -r '.[]|select(.code=="SRV-0003").id')

n=0
office_ticket() {
  n=$((n+1))
  local plate
  plate=$(printf 'P045-%03d' "$n")
  req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS045\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}"
}

echo
echo "== 1. Anular sin autorización no pasa =="
T=$(body "$(office_ticket)" | jq -r '.id')
R=$(req $OFF POST /carwash/tickets/$T/void '{"reason":"Sin firma"}')
ck "void sin el bloque authorization -> 422" 422 "$(code "$R")"
ck "  VALIDATION_ERROR" VALIDATION_ERROR "$(body "$R" | jq -r .code)"
ck "  el lavado no cambió" OPEN "$(body "$(req $OFF GET /carwash/tickets/$T)" | jq -r .status)"

echo
echo "== 2. Credenciales que no autorizan =="
R=$(req $OFF POST /carwash/tickets/$T/void "{\"reason\":\"Contraseña mala\",\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"no-es-esta\"}}")
ck "contraseña incorrecta -> 403" 403 "$(code "$R")"
ck "  AUTHORIZATION_FAILED" AUTHORIZATION_FAILED "$(body "$R" | jq -r .code)"

R=$(req $OFF POST /carwash/tickets/$T/void "{\"reason\":\"Correo que no existe\",\"authorization\":{\"email\":\"nadie.vis045@elite.local\",\"password\":\"$ADMIN_PASSWORD\"}}")
ck "correo inexistente -> 403" 403 "$(code "$R")"
ck "  AUTHORIZATION_FAILED" AUTHORIZATION_FAILED "$(body "$R" | jq -r .code)"

R=$(req $OFF POST /carwash/tickets/$T/void "{\"reason\":\"Firma sin permiso\",$CASHIER_AUTH}")
ck "firma de un usuario sin carwash.void -> 403" 403 "$(code "$R")"
ck "  AUTHORIZATION_FAILED" AUTHORIZATION_FAILED "$(body "$R" | jq -r .code)"
ck "  mismo mensaje que los otros dos (RN-2)" "Esas credenciales no autorizan esta acción." "$(body "$R" | jq -r .message)"
ck "  el lavado sigue intacto" OPEN "$(body "$(req $OFF GET /carwash/tickets/$T)" | jq -r .status)"

echo
echo "== 3. El cajero anula con la firma del administrador =="
R=$(req $CAJ POST /carwash/tickets/$T/void "{\"reason\":\"Cliente se arrepintió\",$ADMIN_AUTH}")
ck "cajero + firma del admin -> 200" 200 "$(code "$R")"
ck "  VOID" VOID "$(body "$R" | jq -r .status)"
ckc "  la nota deja quién autorizó" "(autorizó: $ADMIN_NAME)" "$(body "$R" | jq -r .notes)"
ckc "  y el motivo" "Cliente se arrepintió" "$(body "$R" | jq -r .notes)"

echo
echo "== 4. El admin también tiene que firmar (RN-3) =="
T2=$(body "$(office_ticket)" | jq -r '.id')
R=$(req $OFF POST /carwash/tickets/$T2/void '{"reason":"Sin firma, con permiso"}')
ck "admin sin el bloque -> 422" 422 "$(code "$R")"
ck "  el lavado no cambió" OPEN "$(body "$(req $OFF GET /carwash/tickets/$T2)" | jq -r .status)"
R=$(req $OFF POST /carwash/tickets/$T2/void "{\"reason\":\"Prueba VIS045\",$ADMIN_AUTH}")
ck "admin firmando -> 200" 200 "$(code "$R")"

echo
echo "== 5. Deshacer cobro, lo mismo contra carwash.reverse =="
T3=$(body "$(office_ticket)" | jq -r '.id')
req $OFF POST /carwash/tickets/$T3/status '{"status":"READY"}' >/dev/null
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T3)" | jq -r .total)
R=$(req $CAJ POST /carwash/tickets/$T3/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "el cajero cobra -> 200" 200 "$(code "$R")"

R=$(req $CAJ POST /carwash/tickets/$T3/reverse "{\"reason\":\"Firma sin permiso\",$CASHIER_AUTH}")
ck "reverse firmado por quien no puede -> 403" 403 "$(code "$R")"
ck "  AUTHORIZATION_FAILED" AUTHORIZATION_FAILED "$(body "$R" | jq -r .code)"
ck "  sigue cobrado" PAID "$(body "$(req $OFF GET /carwash/tickets/$T3)" | jq -r .status)"

R=$(req $CAJ POST /carwash/tickets/$T3/reverse "{\"reason\":\"Cobró de más\",$ADMIN_AUTH}")
ck "reverse con la firma del admin -> 200" 200 "$(code "$R")"
ck "  vuelve a READY" READY "$(body "$R" | jq -r .status)"
ckc "  la nota deja quién autorizó" "(autorizó: $ADMIN_NAME)" "$(body "$R" | jq -r .notes)"

echo
echo "== 6. Autorizar no abre sesión (RN-4) =="
R=$(req $CAJ GET /auth/me)
ck "la sesión sigue siendo la del cajero" "$CASHIER_EMAIL" "$(body "$R" | jq -r '.user.email')"

echo
echo "== 7. La UI pide los dos campos =="
for f in void-ticket-dialog reverse-ticket-dialog; do
  if grep -q "AuthorizationFields" apps/web/src/features/carwash/components/$f.tsx; then
    echo "  OK   $f pide autorización"; PASS=$((PASS+1))
  else
    echo "  FALLA $f no pide autorización"; FAIL=$((FAIL+1))
  fi
done
if grep -q "carwash.actions.read.key" apps/web/src/features/carwash/components/ticket-detail-screen.tsx; then
  echo "  OK   los botones se ven con carwash.read"; PASS=$((PASS+1))
else
  echo "  FALLA los botones siguen atados a void/reverse"; FAIL=$((FAIL+1))
fi

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"

if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -q \
    -c 'delete from commission_entries where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS045%$$));
        delete from payments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS045%$$));
        delete from work_order_assignments where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS045%$$));
        delete from work_order_items where "workOrderId" in (select id from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS045%$$));
        delete from work_orders where "customerId" in (select id from customers where "fullName" like $$%VIS045%$$);
        delete from vehicle_owners where "vehicleId" in (select id from vehicles where plate like $$P045-%$$);
        delete from vehicles where plate like $$P045-%$$;
        delete from customers where "fullName" like $$%VIS045%$$;
        delete from user_roles where "userId" in (select id from users where email like $$%.vis045@elite.local$$);
        delete from users where email like $$%.vis045@elite.local$$;
        delete from role_permissions where "roleId" in (select id from roles where name like $$%VIS045%$$);
        delete from roles where name like $$%VIS045%$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (sufijo VIS045)."
fi

[ "$FAIL" -eq 0 ] || exit 1
