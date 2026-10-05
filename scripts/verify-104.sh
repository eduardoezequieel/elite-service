#!/bin/bash
# Verificacion end-to-end de la spec 104 (combos del lavado).
#
# Lo que prueba y `pnpm test` no puede: la migracion `carwash_combos`, el
# correlativo `CMB-NNNN` contra la base, el filtro de estado calculado en la
# consulta de Postgres, los guards de `combos.read` / `combos.manage`, y que un
# lavado creado por HTTP con un combo guarde una linea por componente con
# `comboName` y sume exacto el precio del combo.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-104.sh
#
# Al terminar el lavado queda anulado (repone el producto), el combo pausado y el
# producto desactivado: los combos no se borran (RN-4).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
READER_EMAIL=combos.vis104@elite.local
READER_PASSWORD=Combos104!
PASS=0; FAIL=0
RUN=$(date +%H%M%S)
TODAY=$(TZ=America/El_Salvador date +%F)
ITEM=""; COMBO=""; TICKET=""; SRV_CREATED=""

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

OFF=$S/office.jar; RDR=$S/reader.jar; ANON=$S/anon.jar

cleanup() {
  local rc=$?
  [ -n "$TICKET" ] && req $OFF POST /carwash/tickets/$TICKET/void "{\"reason\":\"VIS104\",$AUTH}" >/dev/null
  [ -n "$COMBO" ] && req $OFF PATCH /combos/$COMBO '{"isActive":false}' >/dev/null
  [ -n "$ITEM" ] && req $OFF PATCH /inventory/items/$ITEM '{"isActive":false}' >/dev/null
  [ -n "$SRV_CREATED" ] && req $OFF PATCH /services/$SRV_CREATED '{"isActive":false}' >/dev/null
  rm -rf "$S"
  exit $rc
}
trap cleanup EXIT

echo "== 0. Sesiones, tipos de carro, servicio y producto =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /roles '{"name":"Combos VIS104","permissionKeys":["combos.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET "/roles?pageSize=100")" | jq -r '.items[]|select(.name=="Combos VIS104").id');;
esac
req $OFF POST /users "{\"email\":\"$READER_EMAIL\",\"fullName\":\"Combos VIS104\",\"password\":\"$READER_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
R=$(req $RDR POST /auth/login "{\"email\":\"$READER_EMAIL\",\"password\":\"$READER_PASSWORD\"}")
ck "login con combos.read sin combos.manage -> 200" 200 "$(code "$R")"

BODY_TYPES=$(body "$(req $OFF GET /vehicle-body-types)")
SEDAN=$(echo "$BODY_TYPES" | jq -r '.[]|select(.key=="sedan").id')
ck "hay tipo sedan" true "$([ -n "$SEDAN" ] && echo true || echo false)"

SERVICES=$(body "$(req $OFF GET "/services?pageSize=100")")
SRV=$(echo "$SERVICES" | jq -r '[.items[]|select(.isActive)][0].id // empty')
if [ -z "$SRV" ]; then
  SRV_CAT=$(body "$(req $OFF GET "/service-categories?pageSize=100")" | jq -r '.items[0].id')
  SRV=$(body "$(req $OFF POST /services "{\"name\":\"Lavado VIS104 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"10.00\"}")" | jq -r .id)
  SRV_CREATED=$SRV
  SERVICES=$(body "$(req $OFF GET "/services?pageSize=100")")
fi
ck "hay un servicio activo" true "$([ -n "$SRV" ] && [ "$SRV" != null ] && echo true || echo false)"
SERVICE=$(echo "$SERVICES" | jq -c --arg id "$SRV" '.items[]|select(.id==$id)')

R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Cera VIS104 $RUN\",\"price\":\"3.00\"}")
ck "producto nuevo -> 201" 201 "$(code "$R")"
ITEM=$(body "$R" | jq -r .id)
R=$(req $OFF POST /inventory/items/$ITEM/entries '{"quantity":"5","unitCost":"1.50"}')
ck "  entrada de 5 -> 201" 201 "$(code "$R")"

# Precio fijo por cada tipo activo: la suma por separado (servicio + 1 cera) menos $1.
PRICES=$(jq -nc --argjson bt "$BODY_TYPES" --argjson s "$SERVICE" '
  [ $bt[] as $b
    | (([$s.prices[] | select(.bodyTypeId == $b.id) | .price][0] // $s.defaultPrice) | tonumber) as $list
    | { bodyTypeId: $b.id, price: ((($list + 3 - 1) * 100 | round) / 100) } ]')
SEDAN_PRICE=$(echo "$PRICES" | jq -r --arg id "$SEDAN" '.[]|select(.bodyTypeId==$id).price')
NAME="Combo VIS104 $RUN"
COMBO_BODY=$(jq -nc --arg name "$NAME" --arg srv "$SRV" --arg item "$ITEM" --arg today "$TODAY" --argjson prices "$PRICES" '
  { name: $name,
    items: [ { serviceId: $srv }, { inventoryItemId: $item, quantity: 1 } ],
    pricingMode: "FIXED", prices: $prices,
    validFrom: $today, weekdays: [0,1,2,3,4,5,6] }')

echo
echo "== 1. Alta del combo (criterio 1, RN-4) =="
R=$(req $RDR POST /combos "$COMBO_BODY")
ck "sin combos.manage: POST /combos -> 403" 403 "$(code "$R")"
R=$(req $OFF POST /combos "$COMBO_BODY")
ck "alta -> 201" 201 "$(code "$R")"
COMBO=$(body "$R" | jq -r .id)
ck "  codigo CMB-NNNN y vigente" "true LIVE" "$(body "$R" | jq -r '[(.code|test("^CMB-[0-9]{4,}$")), .status]|map(tostring)|join(" ")')"
ck "  un precio por tipo activo" "$(echo "$BODY_TYPES" | jq length)" "$(body "$R" | jq '.prices|length')"
R=$(req $OFF POST /combos "$(echo "$COMBO_BODY" | jq -c '.name |= ascii_upcase')")
ck "mismo nombre en mayusculas -> 409 COMBO_NAME_TAKEN" "409 COMBO_NAME_TAKEN" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /combos "$(echo "$COMBO_BODY" | jq -c --arg n "$NAME b" '.name = $n | .prices = (.prices | map(.price = 9999))')")
ck "precio fijo sobre la suma -> 422" 422 "$(code "$R")"

echo
echo "== 2. Lista, detalle y combos de hoy =="
R=$(req $RDR GET "/combos?status=LIVE&search=VIS104%20$RUN")
ck "combos.read: lista vigente -> 200 con forma Page" "200 true" "$(code "$R") $(body "$R" | jq -r 'has("items") and has("total") and has("page") and has("pageSize")')"
ck "  el combo esta en Vigentes" 1 "$(body "$R" | jq --arg id "$COMBO" '[.items[]|select(.id==$id)]|length')"
R=$(req $OFF GET "/combos?status=PAUSED&search=VIS104%20$RUN")
ck "  y no en Pausados" 0 "$(body "$R" | jq --arg id "$COMBO" '[.items[]|select(.id==$id)]|length')"
R=$(req $RDR GET /combos/$COMBO)
ck "detalle -> 200" "200 $NAME" "$(code "$R") $(body "$R" | jq -r .name)"
R=$(req $OFF GET /combos/no-es-un-uuid)
ck "detalle con id invalido -> 404" 404 "$(code "$R")"
R=$(req $OFF GET /carwash/combos)
ck "GET /carwash/combos lo incluye" "200 1" "$(code "$R") $(body "$R" | jq --arg id "$COMBO" '[.[]|select(.id==$id)]|length')"
R=$(req $ANON GET /floor/combos)
ck "GET /floor/combos sin sesion de pista -> 401" 401 "$(code "$R")"

echo
echo "== 3. Lavado con el combo (criterios 4 y 6) =="
PLATE="P104$RUN"
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"$PLATE\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[],\"combos\":[{\"comboId\":\"$COMBO\"}]}")
ck "alta solo con el combo -> 201" 201 "$(code "$R")"
TICKET=$(body "$R" | jq -r '.id // empty')
ck "  dos lineas, ambas con comboName" "2 2" "$(body "$R" | jq -r --arg n "$NAME" '[(.items|length), ([.items[]|select(.comboName==$n)]|length)]|map(tostring)|join(" ")')"
ck "  las lineas suman el precio del combo" "$(printf '%.2f' "$SEDAN_PRICE")" "$(body "$R" | jq -r '[.items[].total|tonumber]|add*100|round/100' | xargs printf '%.2f')"
ck "  total del lavado = precio del combo" "$(printf '%.2f' "$SEDAN_PRICE")" "$(body "$R" | jq -r .total)"
ck "  la cera salio del inventario" "4.000" "$(body "$(req $OFF GET /inventory/items/$ITEM)" | jq -r .stockOnHand)"
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"Q104$RUN\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[],\"combos\":[{\"comboId\":\"$COMBO\"},{\"comboId\":\"$COMBO\"}]}")
ck "el mismo combo dos veces -> 422 DUPLICATE_COMBO" "422 DUPLICATE_COMBO" "$(code "$R") $(body "$R" | jq -r .code)"

echo
echo "== 4. Pausado (criterio 3) =="
R=$(req $RDR PATCH /combos/$COMBO '{"isActive":false}')
ck "sin combos.manage: PATCH -> 403" 403 "$(code "$R")"
R=$(req $OFF PATCH /combos/$COMBO '{"isActive":false}')
ck "pausar -> 200 PAUSED" "200 PAUSED" "$(code "$R") $(body "$R" | jq -r .status)"
R=$(req $OFF GET /carwash/combos)
ck "  ya no esta en /carwash/combos" 0 "$(body "$R" | jq --arg id "$COMBO" '[.[]|select(.id==$id)]|length')"
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"R104$RUN\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[],\"combos\":[{\"comboId\":\"$COMBO\"}]}")
ck "  lavado nuevo con el combo -> 422 COMBO_NOT_AVAILABLE" "422 COMBO_NOT_AVAILABLE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF GET /carwash/tickets/$TICKET)
ck "  el lavado ya guardado conserva sus lineas" "2 $(printf '%.2f' "$SEDAN_PRICE")" "$(body "$R" | jq -r '[(.items|length), .total]|map(tostring)|join(" ")')"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
