#!/bin/bash
# Verificacion end-to-end de la spec 069 (cuentas bancarias del negocio y metodo
# de pago «Otro»).
#
# Lo que prueba y `pnpm test` no puede: la migracion (tabla `bank_accounts`,
# enum con OTHER, columnas nuevas de `payments`), el indice unico `(bank,
# number)` que da el 409, el permiso `banking.manage` sincronizado por el seed y
# resuelto por los guards, que el cobro valide la cuenta contra la base y la
# guarde en cada fila de pago, y que el turno desglose las transferencias por
# cuenta y sume «Otro» aparte sin tocar el efectivo esperado.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-069.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
CASHIER_EMAIL=cajero.vis069@elite.local
CASHIER_PASSWORD=Cajero069!
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
# Centavos de una cadena decimal ("12.50" -> 1250).
cents() { echo "$1" | jq -r 'tonumber*100|round'; }

ADMIN_AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
OFF=$S/office.jar; CAJ=$S/cashier.jar
rm -f "$OFF" "$CAJ"

ticket() { body "$(req $OFF GET /carwash/tickets/$1)"; }
current() { body "$(req $OFF GET /carwash/cash/current)"; }

echo "== 0. Sesiones, cajero sin banking.manage, caja y servicio de \$10 =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ck "  el admin tiene banking.manage (seed)" 1 "$(body "$R" | jq '[.permissions[]|select(.=="banking.manage")]|length')"

R=$(req $OFF POST /roles '{"name":"Caja VIS069","permissionKeys":["carwash.read","carwash.manage","carwash.charge","carwash.cash","customers.read","vehicles.read","services.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?search=Caja%20VIS069")" | jq -r '.items[]|select(.name=="Caja VIS069").id');;
esac
req $OFF POST /users "{\"email\":\"$CASHIER_EMAIL\",\"fullName\":\"Cajero VIS069\",\"password\":\"$CASHIER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
R=$(req $CAJ POST /auth/login "{\"email\":\"$CASHIER_EMAIL\",\"password\":\"$CASHIER_PASSWORD\"}")
ck "login del cajero -> 200" 200 "$(code "$R")"
ck "  no tiene banking.manage" 0 "$(body "$R" | jq '[.permissions[]|select(.=="banking.manage")]|length')"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
case "$(code "$R")" in 200|201|409) echo "  caja lista";; *) echo "  AVISO: abrir caja devolvio $(code "$R")";; esac

SEDAN=$(body "$(req $OFF GET /vehicle-body-types)" | jq -r '.[]|select(.key=="sedan").id')
SRV_CAT=$(body "$(req $OFF GET /service-categories)" | jq -r '.items[0].id')
R=$(req $OFF POST /services "{\"name\":\"Lavado VIS069 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"10.00\"}")
ck "servicio de \$10 -> 201" 201 "$(code "$R")"
SRV=$(body "$R" | jq -r .id)

n=0
ready_ticket() {
  # Abre un lavado de un servicio de $10 y lo deja listo; imprime su id.
  n=$((n+1))
  local id
  id=$(body "$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS069\"},\"vehicle\":{\"plate\":\"P69$RUN$n\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")" | jq -r .id)
  req $OFF POST /carwash/tickets/$id/status '{"status":"READY"}' >/dev/null
  echo "$id"
}

echo
echo "== 1. Cuentas del negocio (RN-1, RN-2, RN-3) =="
NUM_A="0012$RUN"
R=$(req $OFF POST /banking/accounts "{\"bank\":\"AGRICOLA\",\"type\":\"CHECKING\",\"number\":\"00-12-$RUN\",\"holderName\":\"Elite Service S.A. de C.V.\"}")
ck "crear Agricola corriente -> 201" 201 "$(code "$R")"
ACC_A=$(body "$R" | jq -r .id)
ck "  activa, sin guiones y con el nombre del banco" "true $NUM_A Banco Agrícola" "$(body "$R" | jq -r '(.active|tostring) + " " + .number + " " + .bankName')"
R=$(req $OFF POST /banking/accounts "{\"bank\":\"AGRICOLA\",\"type\":\"SAVINGS\",\"number\":\"$NUM_A\",\"holderName\":\"Otro titular\"}")
ck "mismo banco y numero -> 409 BANK_ACCOUNT_DUPLICATE" "409 BANK_ACCOUNT_DUPLICATE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /banking/accounts "{\"bank\":\"NO_EXISTE\",\"type\":\"SAVINGS\",\"number\":\"$NUM_A\",\"holderName\":\"Elite\"}")
ck "banco fuera de la lista -> 422" 422 "$(code "$R")"
R=$(req $OFF POST /banking/accounts "{\"bank\":\"BAC\",\"type\":\"SAVINGS\",\"number\":\"77$RUN\",\"holderName\":\"Elite Service S.A. de C.V.\"}")
ck "crear BAC ahorro -> 201" 201 "$(code "$R")"
ACC_B=$(body "$R" | jq -r .id)
R=$(req $OFF POST /banking/accounts "{\"bank\":\"CUSCATLAN\",\"type\":\"SAVINGS\",\"number\":\"55$RUN\",\"holderName\":\"Elite Service S.A. de C.V.\"}")
ck "crear Cuscatlan -> 201" 201 "$(code "$R")"
ACC_C=$(body "$R" | jq -r .id)
R=$(req $OFF PATCH /banking/accounts/$ACC_C '{"active":false}')
ck "desactivar Cuscatlan -> 200 inactiva" "200 false" "$(code "$R") $(body "$R" | jq -r .active)"

echo
echo "== 2. Permisos: el cajero cobra pero no administra cuentas =="
R=$(req $CAJ POST /banking/accounts "{\"bank\":\"BAC\",\"type\":\"CHECKING\",\"number\":\"88$RUN\",\"holderName\":\"Elite\"}")
ck "crear sin banking.manage -> 403" 403 "$(code "$R")"
R=$(req $CAJ PATCH /banking/accounts/$ACC_A '{"active":false}')
ck "desactivar sin banking.manage -> 403" 403 "$(code "$R")"
R=$(req $CAJ GET /banking/accounts)
ck "listar todas sin banking.manage -> 403" 403 "$(code "$R")"
R=$(req $CAJ GET "/banking/accounts?active=true&pageSize=100")
ck "listar activas con carwash.charge -> 200" 200 "$(code "$R")"
ck "  sale Agricola, no la inactiva" "1 0" "$(body "$R" | jq --arg a "$ACC_A" --arg c "$ACC_C" '([.items[]|select(.id==$a)]|length|tostring) + " " + ([.items[]|select(.id==$c)]|length|tostring)' -r)"
R=$(req $OFF GET "/banking/accounts?pageSize=100")
ck "el admin ve tambien la inactiva" 1 "$(body "$R" | jq --arg c "$ACC_C" '[.items[]|select(.id==$c)]|length')"
R=$(req $CAJ GET "/banking/accounts?active=false")
ck "listar solo inactivas sin banking.manage -> 403" 403 "$(code "$R")"
R=$(req $OFF GET "/banking/accounts?active=false&pageSize=100")
ck "?active=false trae la inactiva y no la activa" "1 0" "$(body "$R" | jq --arg a "$ACC_A" --arg c "$ACC_C" '([.items[]|select(.id==$c)]|length|tostring) + " " + ([.items[]|select(.id==$a)]|length|tostring)' -r)"
R=$(req $OFF GET "/banking/accounts?page=1&pageSize=1")
ck "  pagina en servidor (102): una fila y el total de todas" true "$(body "$R" | jq '(.items|length) == 1 and .total >= 2 and .page == 1 and .pageSize == 1')"

BEFORE=$(current)
OTHER0=$(cents "$(echo "$BEFORE" | jq -r '.otherTotal // "0"')")
EXPECTED0=$(cents "$(echo "$BEFORE" | jq -r .expectedCash)")
TRANSFER0=$(cents "$(echo "$BEFORE" | jq -r .transferTotal)")

echo
echo "== 3. Transferencia: cuenta activa + referencia (RN-4, RN-8) =="
T1=$(ready_ticket)
R=$(req $CAJ POST /carwash/tickets/$T1/charge "{\"method\":\"TRANSFER\",\"amount\":\"10.00\",\"bankAccountId\":\"$ACC_A\"}")
ck "sin referencia -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $CAJ POST /carwash/tickets/$T1/charge '{"method":"TRANSFER","amount":"10.00","reference":"998877"}')
ck "sin cuenta -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $CAJ POST /carwash/tickets/$T1/charge "{\"method\":\"TRANSFER\",\"amount\":\"10.00\",\"bankAccountId\":\"$ACC_C\",\"reference\":\"998877\"}")
ck "cuenta inactiva -> 422 BANK_ACCOUNT_UNAVAILABLE" "422 BANK_ACCOUNT_UNAVAILABLE" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  y no se cobro nada" "READY 0" "$(ticket $T1 | jq -r '.status + " " + (.payments|length|tostring)')"
R=$(req $CAJ POST /carwash/tickets/$T1/charge "{\"method\":\"TRANSFER\",\"amount\":\"10.00\",\"bankAccountId\":\"$ACC_A\",\"reference\":\"998877\"}")
ck "cuenta activa y referencia -> 200 PAID" "200 PAID" "$(code "$R") $(body "$R" | jq -r .status)"
ck "  el pago guarda cuenta y referencia" "$ACC_A 998877" "$(ticket $T1 | jq -r '.payments[0].bankAccount.id + " " + .payments[0].reference')"

T3=$(ready_ticket)
R=$(req $CAJ POST /carwash/charges "{\"workOrderIds\":[\"$T3\"],\"payments\":[{\"method\":\"TRANSFER\",\"amount\":\"10.00\",\"bankAccountId\":\"$ACC_B\",\"reference\":\"BAC-1\"}]}")
ck "la cuenta de cobro (059) tambien: BAC -> 201" 201 "$(code "$R")"
ck "  el renglon trae la cuenta" "$ACC_B BAC-1" "$(body "$R" | jq -r '.payments[0].bankAccount.id + " " + .payments[0].reference')"

echo
echo "== 4. «Otro»: texto libre (RN-5, RN-6) =="
T2=$(ready_ticket)
R=$(req $CAJ POST /carwash/charges "{\"workOrderIds\":[\"$T2\"],\"payments\":[{\"method\":\"OTHER\",\"amount\":\"10.00\"}]}")
ck "sin descripcion -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
LONG=$(printf 'x%.0s' $(seq 1 61))
R=$(req $CAJ POST /carwash/charges "{\"workOrderIds\":[\"$T2\"],\"payments\":[{\"method\":\"OTHER\",\"amount\":\"10.00\",\"description\":\"$LONG\"}]}")
ck "descripcion de 61 -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $CAJ POST /carwash/charges "{\"workOrderIds\":[\"$T2\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"10.00\",\"reference\":\"1\"}]}")
ck "efectivo con referencia -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $CAJ POST /carwash/charges "{\"workOrderIds\":[\"$T2\"],\"payments\":[{\"method\":\"OTHER\",\"amount\":\"10.00\",\"description\":\"cheque\"}]}")
ck "«Otro: cheque» -> 201" 201 "$(code "$R")"
ck "  el renglon guarda la descripcion" "OTHER cheque" "$(body "$R" | jq -r '.payments[0].method + " " + .payments[0].description')"

echo
echo "== 5. El turno desglosa (RN-7) =="
AFTER=$(current)
ck "  transferencias +20.00" 2000 "$(( $(cents "$(echo "$AFTER" | jq -r .transferTotal)") - TRANSFER0 ))"
ck "  otherTotal +10.00" 1000 "$(( $(cents "$(echo "$AFTER" | jq -r .otherTotal)") - OTHER0 ))"
ck "  el efectivo esperado no cambia" 0 "$(( $(cents "$(echo "$AFTER" | jq -r .expectedCash)") - EXPECTED0 ))"
ck "  Agricola con su total y etiqueta" "10.00 Banco Agrícola · Corriente · ···${NUM_A: -4}" "$(echo "$AFTER" | jq -r --arg a "$ACC_A" '.transferByAccount[]|select(.bankAccountId==$a)|.total + " " + .label')"
ck "  BAC con su total" "10.00" "$(echo "$AFTER" | jq -r --arg b "$ACC_B" '.transferByAccount[]|select(.bankAccountId==$b)|.total')"
ck "  el desglose suma transferTotal" "$(cents "$(echo "$AFTER" | jq -r .transferTotal)")" "$(echo "$AFTER" | jq '[.transferByAccount[].total|tonumber*100|round]|add // 0')"
CASH_ID=$(echo "$AFTER" | jq -r .id)
DETAIL=$(body "$(req $OFF GET "/carwash/cash/sessions/$CASH_ID?pageSize=100")")
ck "  el detalle del turno trae el «Otro» con su texto" "cheque" "$(echo "$DETAIL" | jq -r --arg t "$T2" '.payments.items[]|select(.workOrderId==$t)|.description')"

echo
echo "== 6. Una cuenta con pagos se desactiva, no se borra, y el pago la conserva =="
R=$(req $OFF PATCH /banking/accounts/$ACC_A '{"active":false}')
ck "desactivar Agricola -> 200" 200 "$(code "$R")"
ck "  el pago viejo la sigue mostrando" "$ACC_A" "$(ticket $T1 | jq -r '.payments[0].bankAccount.id')"
R=$(req $OFF DELETE /banking/accounts/$ACC_A)
ck "no existe borrar -> 404" 404 "$(code "$R")"

echo
echo "== 7. Limpieza: deshacer los cobros de prueba =="
for T in $T1 $T2 $T3; do
  R=$(req $OFF POST /carwash/tickets/$T/reverse "{\"reason\":\"Limpieza VIS069\",$ADMIN_AUTH}")
  ck "  deshacer $(ticket $T | jq -r .number) -> 200" 200 "$(code "$R")"
done
req $OFF PATCH /banking/accounts/$ACC_B '{"active":false}' >/dev/null

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
