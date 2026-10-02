#!/bin/bash
# Verificacion end-to-end de la spec 059 (cuenta de cobro: mancomunar lavados,
# partir el pago en varios metodos y el vuelto en efectivo).
#
# Lo que prueba y `pnpm test` no puede: que la cuenta se escriba entera o no se
# escriba, que la suma de los pagos sea el total al centavo, que el reparto por
# lavado no pierda ni invente centavos, y que anular una cuenta mancomunada
# mueva a todos sus lavados a la vez.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-059.sh
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

ADMIN_AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
OFF=$S/office.jar
rm -f "$OFF"

echo "== 0. Sesion, caja y lavados listos =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
CASH_CODE=$(code "$R")
case "$CASH_CODE" in
  200|201|409) echo "  caja lista ($CASH_CODE)";;
  *) echo "  AVISO: abrir caja devolvio $CASH_CODE";;
esac

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET "/services?pageSize=100")
SRV=$(body "$R" | jq -r '.items[0].id')

# Placas unicas por corrida: `ready_ticket` corre en un subshell `$(...)`, asi
# que el contador vive en un archivo (una variable no sobreviviria la llamada),
# y $RUN evita chocar con las placas de una corrida anterior (RN-12).
RUN=$(date +%H%M%S)
echo 0 > "$S/n"
# Abre un lavado de oficina y lo deja READY. Devuelve el id.
ready_ticket() {
  local n plate id
  n=$(( $(cat "$S/n") + 1 )); echo "$n" > "$S/n"
  plate=$(printf 'P059-%s-%02d' "$RUN" "$n")
  id=$(body "$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS059\"},\"vehicle\":{\"plate\":\"$plate\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")" | jq -r '.id')
  req $OFF POST /carwash/tickets/$id/status '{"status":"READY"}' >/dev/null
  echo "$id"
}
total_of() { body "$(req $OFF GET /carwash/tickets/$1)" | jq -r .total; }
status_of() { body "$(req $OFF GET /carwash/tickets/$1)" | jq -r .status; }
# Suma en centavos de dos montos con dos decimales, como texto.
sum2() { awk -v a="$1" -v b="$2" 'BEGIN{printf "%.2f", a+b}'; }

echo
echo "== 1. Un lavado, un pago: el caso normal pasa por la cuenta =="
T1=$(ready_ticket)
TOT1=$(total_of "$T1")
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$T1\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"$TOT1\"}]}")
ck "cobro de un lavado -> 201" 201 "$(code "$R")"
ck "  el total de la cuenta es el del lavado" "$TOT1" "$(body "$R" | jq -r .total)"
ck "  un solo pago" 1 "$(body "$R" | jq '.payments|length')"
ck "  el lavado quedo PAID" PAID "$(status_of "$T1")"
ck "  y trae su cuenta" 1 "$(body "$(req $OFF GET /carwash/tickets/$T1)" | jq -r '.charge.ticketCount')"

echo
echo "== 2. Tres lavados en una cuenta, un metodo =="
A=$(ready_ticket); B=$(ready_ticket); C=$(ready_ticket)
TA=$(total_of "$A"); TB=$(total_of "$B"); TC=$(total_of "$C")
SUM=$(sum2 "$(sum2 "$TA" "$TB")" "$TC")
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$A\",\"$B\",\"$C\"],\"payments\":[{\"method\":\"CARD\",\"amount\":\"$SUM\"}]}")
ck "cuenta mancomunada -> 201" 201 "$(code "$R")"
CHARGE=$(body "$R" | jq -r .id)
ck "  el total es la suma de los tres" "$SUM" "$(body "$R" | jq -r .total)"
ck "  los tres quedaron PAID" "PAID PAID PAID" "$(status_of "$A") $(status_of "$B") $(status_of "$C")"
ck "  la cuenta sabe que son tres" 3 "$(body "$(req $OFF GET /carwash/tickets/$A)" | jq -r '.charge.ticketCount')"
# El reparto no pierde ni inventa centavos: lo de cada lavado es su total.
for T in $A $B $C; do
  EXPECTED=$(total_of "$T")
  GOT=$(body "$(req $OFF GET /carwash/tickets/$T)" | jq -r '[.payments[].amount|tonumber]|add|.*100|round/100|tostring')
  ck "  al lavado le tocaron sus $EXPECTED" "$(awk -v v="$EXPECTED" 'BEGIN{printf "%.2f", v}')" "$(awk -v v="$GOT" 'BEGIN{printf "%.2f", v}')"
done

echo
echo "== 3. Pago partido: dos metodos que suman el total =="
D=$(ready_ticket)
TD=$(total_of "$D")
HALF=$(awk -v v="$TD" 'BEGIN{printf "%.2f", int(v*100/2)/100}')
REST=$(awk -v v="$TD" -v h="$HALF" 'BEGIN{printf "%.2f", v-h}')
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$D\"],\"payments\":[{\"method\":\"CARD\",\"amount\":\"$HALF\"},{\"method\":\"CASH\",\"amount\":\"$REST\"}],\"cashTendered\":\"$REST\"}")
ck "pago partido -> 201" 201 "$(code "$R")"
ck "  dos renglones" 2 "$(body "$R" | jq '.payments|length')"
ck "  el lavado guarda los dos" 2 "$(body "$(req $OFF GET /carwash/tickets/$D)" | jq '.payments|length')"
ck "  pago justo: sin vuelto" "0.00" "$(body "$R" | jq -r '.changeGiven // "0.00"')"

echo
echo "== 4. Los pagos tienen que sumar el total =="
E=$(ready_ticket)
TE=$(total_of "$E")
SHORT=$(awk -v v="$TE" 'BEGIN{printf "%.2f", v-1}')
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$E\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"$SHORT\"}]}")
ck "pagos que no cuadran -> 422" 422 "$(code "$R")"
ck "  PAYMENT_AMOUNT_MISMATCH" PAYMENT_AMOUNT_MISMATCH "$(body "$R" | jq -r .code)"
ck "  el lavado sigue READY" READY "$(status_of "$E")"

echo
echo "== 5. Efectivo: lo recibido no puede faltar, y el vuelto se calcula =="
TENDER_SHORT=$(awk -v v="$TE" 'BEGIN{printf "%.2f", v-0.50}')
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$E\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"$TE\"}],\"cashTendered\":\"$TENDER_SHORT\"}")
ck "recibido menor al efectivo -> 422" 422 "$(code "$R")"
ck "  CASH_TENDERED_SHORT" CASH_TENDERED_SHORT "$(body "$R" | jq -r .code)"
ck "  el lavado sigue READY" READY "$(status_of "$E")"

TENDER=$(awk -v v="$TE" 'BEGIN{printf "%.2f", v+7}')
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$E\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"$TE\"}],\"cashTendered\":\"$TENDER\"}")
ck "recibido de mas -> 201" 201 "$(code "$R")"
ck "  guarda lo recibido" "$TENDER" "$(body "$R" | jq -r .cashTendered)"
ck "  y el vuelto exacto" "7.00" "$(body "$R" | jq -r .changeGiven)"

echo
echo "== 6. Un lavado ya cobrado no entra a otra cuenta (y no arrastra al resto) =="
F=$(ready_ticket)
TF=$(total_of "$F")
SUM2=$(sum2 "$TF" "$TE")
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$F\",\"$E\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"$SUM2\"}]}")
ck "cuenta con un lavado ya cobrado -> 409" 409 "$(code "$R")"
ck "  TICKET_ALREADY_CHARGED" TICKET_ALREADY_CHARGED "$(body "$R" | jq -r .code)"
ck "  el otro lavado NO se cobro (atomicidad)" READY "$(status_of "$F")"

echo
echo "== 7. Un lavado que no esta listo tampoco =="
G=$(body "$(req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS059\"},\"vehicle\":{\"plate\":\"P059-$RUN-90\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV\"}]}")" | jq -r '.id')
TG=$(total_of "$G")
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$G\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"$TG\"}]}")
ck "lavado OPEN -> 409" 409 "$(code "$R")"
ck "  TICKET_NOT_READY" TICKET_NOT_READY "$(body "$R" | jq -r .code)"

echo
echo "== 8. Deshacer una cuenta mancomunada los mueve a los tres =="
R=$(req $OFF POST /carwash/tickets/$A/reverse "{\"reason\":\"Suelto de una cuenta de tres\",$ADMIN_AUTH}")
ck "deshacer un lavado suelto de la cuenta -> 409" 409 "$(code "$R")"
ck "  sigue PAID" PAID "$(status_of "$A")"

R=$(req $OFF POST /carwash/charges/$CHARGE/void "{\"reason\":\"Cobro equivocado\",$ADMIN_AUTH}")
ck "deshacer la cuenta entera -> 200" 200 "$(code "$R")"
ck "  los tres vuelven a READY" "READY READY READY" "$(status_of "$A") $(status_of "$B") $(status_of "$C")"

echo
echo "== 9. El endpoint viejo sigue cobrando (contrato de la 003) =="
H=$(ready_ticket)
TH=$(total_of "$H")
R=$(req $OFF POST /carwash/tickets/$H/charge "{\"method\":\"CASH\",\"amount\":\"$TH\"}")
ck "POST /tickets/:id/charge -> 200" 200 "$(code "$R")"
ck "  quedo PAID" PAID "$(status_of "$H")"
ck "  y creo su cuenta de uno" 1 "$(body "$(req $OFF GET /carwash/tickets/$H)" | jq -r '.charge.ticketCount')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
