#!/bin/bash
# Verificacion end-to-end de la spec 103 (ficha del carro: alta corta y
# edicion por tarjeta).
#
# Lo que prueba y `pnpm test` no puede: la migracion `fleet_vehicle_card_edit`
# (aseguradora, poliza y la bandera de la cuota), el PATCH por seccion contra la
# base, el 422 de `odometerKm` en el pipe real, el enmascarado de costos del
# interceptor sobre la ficha y la lista, y el 403 de costos con un usuario sin
# `rentals.reports` resuelto por los guards.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-103.sh
#
# Los carros que crea quedan retirados al terminar.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
DESK_EMAIL=flota.vis103@elite.local
DESK_PASSWORD=Flota103!
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
# La lista es un arreglo hoy y una pagina `{ items }` con la 101: se leen igual.
rows() { jq '(if type == "array" then . else .items end)'; }

OFF=$S/office.jar; DSK=$S/desk.jar
rm -f "$OFF" "$DSK"

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /roles '{"name":"Flota VIS103","permissionKeys":["fleet.read","fleet.manage"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?pageSize=100")" | jq -r '.items[]|select(.name=="Flota VIS103").id');;
esac
req $OFF POST /users "{\"email\":\"$DESK_EMAIL\",\"fullName\":\"Flota VIS103\",\"password\":\"$DESK_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
R=$(req $DSK POST /auth/login "{\"email\":\"$DESK_EMAIL\",\"password\":\"$DESK_PASSWORD\"}")
ck "login con fleet.read + fleet.manage, sin rentals.reports -> 200" 200 "$(code "$R")"
ck "  no tiene rentals.reports" 0 "$(body "$R" | jq '[.permissions[]|select(.=="rentals.reports")]|length')"

echo
echo "== 1. Alta corta =="
PLATE="P103$RUN"
R=$(req $OFF POST /fleet/vehicles "{\"plate\":\"$PLATE\",\"make\":\"Kia\",\"model\":\"Rio\",\"year\":2023,\"color\":\"Gris\",\"category\":\"SEDAN\",\"dailyRate\":\"30\",\"odometerKm\":48000}")
ck "crear con km al recibirlo -> 201" 201 "$(code "$R")"
CAR=$(body "$R" | jq -r .id)
ck "  km, campos nuevos y costsHidden" "48000|null|null|false|false" "$(body "$R" | jq -r '[.odometerKm,.insurer,.policyNumber,.installmentIncludesExtras,.costsHidden]|map(tostring)|join("|")')"

echo
echo "== 2. PATCH por tarjeta =="
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"color":"Rojo","year":2024}')
ck "identificacion -> 200" "200 Rojo 2024 48000" "$(code "$R") $(body "$R" | jq -r '[.color,.year,.odometerKm]|map(tostring)|join(" ")')"
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"dailyRate":"32","weeklyRate":null,"monthlyRate":null,"freeKmPerDay":null,"extraKmPrice":null}')
ck "tarifas con km libre -> 200" "200 32.00 null null" "$(code "$R") $(body "$R" | jq -r '[.dailyRate,.freeKmPerDay,.extraKmPrice]|map(tostring)|join(" ")')"
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"insurer":"Seguros del Pacifico","policyNumber":"AU-103","insuranceExpiresAt":"2027-03-05","registrationExpiresAt":null}')
ck "seguro y circulacion -> 200" "200 Seguros del Pacifico|AU-103|2027-03-05" "$(code "$R") $(body "$R" | jq -r '[.insurer,.policyNumber,.insuranceExpiresAt]|join("|")')"
R=$(req $OFF PATCH /fleet/vehicles/$CAR "{\"policyNumber\":\"$(printf 'x%.0s' $(seq 1 41))\"}")
ck "poliza de 41 caracteres -> 422" 422 "$(code "$R")"
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"purchasePrice":"15000","purchasedAt":"2026-01-15","financed":true,"downPayment":"3000","installment":"350","termMonths":48,"financingStartedAt":"2026-02-01","installmentIncludesExtras":true}')
ck "compra financiada con la cuota que incluye extras -> 200" "200 true true" "$(code "$R") $(body "$R" | jq -r '[.financed,.installmentIncludesExtras]|map(tostring)|join(" ")')"
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"insuranceMonthly":"40","gpsMonthly":"15","otherFixedMonthly":"10"}')
ck "costos fijos -> 200" "200 40.00 15.00 10.00" "$(code "$R") $(body "$R" | jq -r '[.insuranceMonthly,.gpsMonthly,.otherFixedMonthly]|join(" ")')"
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"notes":"Golpe en la puerta trasera"}')
ck "notas -> 200" 200 "$(code "$R")"

echo
echo "== 3. Kilometraje (RN-3) =="
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"odometerKm":50000}')
ck "PATCH con odometerKm -> 422 en su campo" "422 VALIDATION_ERROR true" "$(code "$R") $(body "$R" | jq -r '.code + " " + (.details|has("odometerKm")|tostring)')"
ck "  el km no cambio" 48000 "$(body "$(req $OFF GET /fleet/vehicles/$CAR)" | jq -r .odometerKm)"

echo
echo "== 4. Enmascarado y 403 de costos (RN-1) =="
R=$(req $DSK GET /fleet/vehicles/$CAR)
ck "sin rentals.reports: GET ficha -> 200" 200 "$(code "$R")"
ck "  costos en null, financed y bandera en false, costsHidden" "null|null|null|null|false|false|true" "$(body "$R" | jq -r '[.purchasePrice,.installment,.insuranceMonthly,.otherFixedMonthly,.financed,.installmentIncludesExtras,.costsHidden]|map(tostring)|join("|")')"
ck "  aseguradora, poliza y tarifas se ven" "Seguros del Pacifico|AU-103|32.00" "$(body "$R" | jq -r '[.insurer,.policyNumber,.dailyRate]|join("|")')"
R=$(req $DSK GET "/fleet/vehicles?q=$PLATE")
ck "  la lista tambien viene enmascarada" "null true" "$(body "$R" | rows | jq -r '.[0] | [.purchasePrice,.costsHidden]|map(tostring)|join(" ")')"
R=$(req $DSK PATCH /fleet/vehicles/$CAR '{"insuranceMonthly":"50"}')
ck "sin rentals.reports: PATCH con costo -> 403 FORBIDDEN" "403 FORBIDDEN" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $DSK PATCH /fleet/vehicles/$CAR '{"financed":false}')
ck "sin rentals.reports: PATCH financed -> 403" 403 "$(code "$R")"
R=$(req $DSK PATCH /fleet/vehicles/$CAR '{"insurer":"Aseguradora Agricola"}')
ck "sin rentals.reports: PATCH aseguradora -> 200 enmascarado" "200 Aseguradora Agricola true" "$(code "$R") $(body "$R" | jq -r '.insurer + " " + (.costsHidden|tostring)')"
R=$(req $DSK POST /fleet/vehicles '{"make":"Kia","model":"Picanto","dailyRate":"25","purchasePrice":"9000"}')
ck "sin rentals.reports: alta con precio -> 403" 403 "$(code "$R")"
R=$(req $DSK POST /fleet/vehicles '{"make":"Kia","model":"Picanto","dailyRate":"25","odometerKm":1000}')
ck "sin rentals.reports: alta corta -> 201" "201 true" "$(code "$R") $(body "$R" | jq -r '.costsHidden|tostring')"
DESKCAR=$(body "$R" | jq -r .id)
R=$(req $OFF GET /fleet/vehicles/$CAR)
ck "con rentals.reports: los costos siguen ahi" "15000.00 40.00 false" "$(body "$R" | jq -r '[.purchasePrice,.insuranceMonthly,.costsHidden]|map(tostring)|join(" ")')"

echo
echo "== 5. La bandera sin financiamiento (RN-2) =="
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"financed":false}')
ck "financed pasa a false -> la bandera tambien" "200 false false" "$(code "$R") $(body "$R" | jq -r '[.financed,.installmentIncludesExtras]|map(tostring)|join(" ")')"

req $OFF PATCH /fleet/vehicles/$CAR '{"status":"RETIRED"}' >/dev/null
[ -n "$DESKCAR" ] && [ "$DESKCAR" != "null" ] && req $OFF PATCH /fleet/vehicles/$DESKCAR '{"status":"RETIRED"}' >/dev/null

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
