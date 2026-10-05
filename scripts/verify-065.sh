#!/bin/bash
# Verificacion end-to-end de la spec 065 (inventario: productos que se venden
# en el lavado y en la venta suelta, e insumos que se despachan).
#
# Lo que prueba y `pnpm test` no puede: que la existencia y el kardex se
# escriban en la misma transaccion que el lavado, la anulacion o la venta; que
# el bloqueo de fila no deje la existencia bajo cero; que el aviso de minimo
# salga una sola vez por el stream de la 042; y que los pagos de una venta
# suelta entren y salgan del turno.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-065.sh
#
# Nota: los errores de validacion del API son 422 VALIDATION_ERROR
# (apps/api/AGENTS.md, convencion 5), tambien el del ajuste sin motivo.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'kill $(jobs -p) 2>/dev/null; rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
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

ADMIN_AUTH="\"authorization\":{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}"
OFF=$S/office.jar
rm -f "$OFF"

stock_of() { body "$(req $OFF GET /inventory/items/$1)" | jq -r .stockOnHand; }
last_move() { body "$(req $OFF GET "/inventory/items/$1/movements?pageSize=1")" | jq -c '.items[0]'; }
ticket() { body "$(req $OFF GET /carwash/tickets/$1)"; }
product_line() { ticket "$1" | jq -r --arg i "$2" '[.items[]|select(.inventoryItemId==$i)][0].quantity // "none"'; }

echo "== 0. Sesion, caja, empleado y un servicio de \$10 =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ADMIN_ID=$(body "$R" | jq -r '.user.id')

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
case "$(code "$R")" in 200|201|409) echo "  caja lista";; *) echo "  AVISO: abrir caja devolvio $(code "$R")";; esac
CASH_ID=$(body "$(req $OFF GET /carwash/cash/current)" | jq -r '.id')

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')

SRV_CAT=$(body "$(req $OFF GET /service-categories)" | jq -r '.items[0].id')
R=$(req $OFF POST /services "{\"name\":\"Lavado VIS065 $RUN\",\"categoryId\":\"$SRV_CAT\",\"defaultPrice\":\"10.00\"}")
ck "servicio de \$10 -> 201" 201 "$(code "$R")"
SRV=$(body "$R" | jq -r .id)

EMP=$(body "$(req $OFF GET "/employees?pageSize=100")" | jq -r '[.items[]|select(.isActive)][0].id // empty')
if [ -z "$EMP" ]; then
  PIN=$(printf '%06d' $(( (RANDOM * 32768 + RANDOM) % 1000000 )))
  EMP=$(body "$(req $OFF POST /employees "{\"fullName\":\"Empleado VIS065\",\"username\":\"vis065$RUN\",\"pin\":\"$PIN\"}")" | jq -r .id)
fi
ck "hay un empleado activo" true "$([ -n "$EMP" ] && [ "$EMP" != null ] && echo true || echo false)"

# El contador vive en un archivo: la funcion corre en un subshell `$(...)` y una
# variable no sobreviviria la llamada (cada lavado repetiria la placa, RN-12).
echo 0 > "$S/n"
open_ticket() {
  # $1 = items JSON; imprime la respuesta completa (cuerpo + codigo)
  local n; n=$(( $(cat "$S/n") + 1 )); echo "$n" > "$S/n"
  req $OFF POST /carwash/tickets "{\"customer\":{\"fullName\":\"Cliente VIS065\"},\"vehicle\":{\"plate\":\"P65$RUN$n\",\"bodyTypeId\":\"$SEDAN\"},\"items\":$1,\"employeeId\":\"$EMP\"}"
}

echo
echo "== 1. Categoria, producto e insumo =="
R=$(req $OFF POST /inventory/categories "{\"kind\":\"PRODUCT\",\"name\":\"Ceras VIS065 $RUN\"}")
ck "categoria de productos -> 201" "201 PRODUCT" "$(code "$R") $(body "$R" | jq -r .kind)"
CAT=$(body "$R" | jq -r .id)
R=$(req $OFF POST /inventory/categories "{\"kind\":\"PRODUCT\",\"name\":\"ceras vis065 $RUN\"}")
ck "categoria repetida en el mismo tipo -> 409 CATEGORY_NAME_TAKEN" "409 CATEGORY_NAME_TAKEN" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/categories "{\"name\":\"Sin tipo VIS065 $RUN\"}")
ck "categoria sin kind -> 422 (072)" 422 "$(code "$R")"
R=$(req $OFF POST /inventory/categories "{\"kind\":\"SUPPLY\",\"name\":\"Ceras VIS065 $RUN\"}")
ck "mismo nombre en insumos -> 201 SUPPLY (072)" "201 SUPPLY" "$(code "$R") $(body "$R" | jq -r .kind)"
SUP_CAT=$(body "$R" | jq -r .id)
R=$(req $OFF GET "/inventory/categories?kind=SUPPLY&pageSize=100")
ck "  ?kind=SUPPLY trae la de insumos y no la de productos" "true false" "$(body "$R" | jq -r --arg s "$SUP_CAT" --arg p "$CAT" '(any(.items[]; .id == $s)|tostring) + " " + (any(.items[]; .id == $p)|tostring)')"
R=$(req $OFF PATCH /inventory/categories/$SUP_CAT '{"kind":"PRODUCT"}')
ck "  PATCH ignora kind" "200 SUPPLY" "$(code "$R") $(body "$R" | jq -r .kind)"

R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Cera VIS065 $RUN\",\"categoryId\":\"$CAT\",\"price\":\"3.00\",\"barcode\":\"VIS065-$RUN\"}")
ck "producto -> 201" 201 "$(code "$R")"
P1=$(body "$R" | jq -r .id)
ck "  codigo INV-NNNN" true "$(body "$R" | jq -r '.code|test("^INV-[0-9]{4,}$")')"
ck "  nace sin existencia" "0.000" "$(body "$R" | jq -r .stockOnHand)"
R=$(req $OFF GET "/carwash/inventory-items?search=VIS065-$RUN")
ck "  el selector del lavado trae su categoria (085)" "200 $CAT Ceras VIS065 $RUN" \
  "$(code "$R") $(body "$R" | jq -r --arg p "$P1" '.[]|select(.id==$p)|.category.id + " " + .category.name')"

R=$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Franela VIS065 $RUN\",\"price\":\"2.00\"}")
ck "insumo con precio -> 400 SUPPLY_HAS_PRICE" "400 SUPPLY_HAS_PRICE" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Franela VIS065 $RUN\",\"categoryId\":\"$CAT\"}")
ck "insumo con categoria de productos -> 422 CATEGORY_KIND_MISMATCH (072)" "422 CATEGORY_KIND_MISMATCH" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Franela VIS065 $RUN\",\"categoryId\":\"$SUP_CAT\"}")
ck "insumo -> 201" 201 "$(code "$R")"
SUP=$(body "$R" | jq -r .id)
ck "  precio 0" "0.00" "$(body "$R" | jq -r .price)"
R=$(req $OFF PATCH /inventory/items/$P1 "{\"categoryId\":\"$SUP_CAT\"}")
ck "producto a categoria de insumos -> 422 CATEGORY_KIND_MISMATCH (072)" "422 CATEGORY_KIND_MISMATCH" "$(code "$R") $(body "$R" | jq -r .code)"

R=$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Otro VIS065\",\"barcode\":\"VIS065-$RUN\"}")
ck "barcode repetido -> 409 BARCODE_TAKEN" "409 BARCODE_TAKEN" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF PATCH /inventory/items/$SUP '{"kind":"PRODUCT","unit":"par"}')
ck "PATCH ignora kind (RN-1)" "200 SUPPLY par" "$(code "$R") $(body "$R" | jq -r '.kind + " " + .unit')"

echo
echo "== 2. Entradas: 3 al producto, 10 al insumo =="
R=$(req $OFF POST /inventory/items/$P1/entries '{"quantity":"3","unitCost":"2.00","reference":"Factura VIS065"}')
ck "entrada del producto -> 201" 201 "$(code "$R")"
ck "  existencia 3" "3.000" "$(body "$R" | jq -r .item.stockOnHand)"
ck "  costo promedio" "2.00" "$(body "$R" | jq -r .item.averageCost)"
ck "  ENTRY +3" "ENTRY 3.000" "$(body "$R" | jq -r '.movement.type + " " + .movement.quantity')"
R=$(req $OFF POST /inventory/items/$SUP/entries '{"quantity":"10"}')
ck "entrada del insumo -> 201" 201 "$(code "$R")"

echo
echo "== 3. Producto en el lavado: sale al agregarlo (RN-4) =="
R=$(open_ticket "[{\"serviceId\":\"$SRV\"},{\"inventoryItemId\":\"$P1\",\"quantity\":\"2\"}]")
ck "lavado con 2 del producto -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r .id)
ck "  linea PRODUCT x2" "PRODUCT 2.000" "$(body "$R" | jq -r --arg i "$P1" '.items[]|select(.inventoryItemId==$i)|.kind + " " + .quantity')"
ck "  existencia 1" "1.000" "$(stock_of $P1)"
M=$(last_move $P1)
ck "  SALE -2 con el lavado" "SALE -2.000 $T1" "$(echo "$M" | jq -r '.type + " " + .quantity + " " + .workOrderId')"

R=$(req $OFF PATCH /carwash/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV\"},{\"inventoryItemId\":\"$P1\",\"quantity\":\"4\"}]}")
ck "agregar 2 mas con 1 en existencia -> 409 INSUFFICIENT_STOCK" "409 INSUFFICIENT_STOCK" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  details.available = 1" "1.000" "$(body "$R" | jq -r .details.available)"
ck "  el ticket no cambio" "2.000" "$(product_line $T1 $P1)"
ck "  la existencia no cambio" "1.000" "$(stock_of $P1)"

R=$(req $OFF PATCH /carwash/tickets/$T1 "{\"items\":[{\"serviceId\":\"$SRV\"},{\"inventoryItemId\":\"$P1\",\"quantity\":\"1\"}]}")
ck "bajar a 1 -> 200" 200 "$(code "$R")"
ck "  existencia 2" "2.000" "$(stock_of $P1)"
ck "  SALE_RETURN +1" "SALE_RETURN 1.000" "$(last_move $P1 | jq -r '.type + " " + .quantity')"

R=$(req $OFF POST /carwash/tickets/$T1/void "{\"reason\":\"Prueba VIS065\",$ADMIN_AUTH}")
ck "anular el lavado -> 200" 200 "$(code "$R")"
ck "  existencia 3" "3.000" "$(stock_of $P1)"
ck "  SALE_RETURN al lavado" "SALE_RETURN 1.000 $T1" "$(last_move $P1 | jq -r '.type + " " + .quantity + " " + .workOrderId')"

echo
echo "== 4. Despacho del insumo a un empleado (RN-10) =="
R=$(req $OFF GET /inventory/employees)
ck "empleados para despachar -> 200 con el activo" "200 true" "$(code "$R") $(body "$R" | jq -r --arg id "$EMP" 'any(.[]; .id == $id)')"
R=$(req $OFF POST /inventory/items/$SUP/dispatches "{\"quantity\":\"4\",\"employeeId\":\"$EMP\",\"note\":\"VIS065\"}")
ck "despachar 4 -> 201" 201 "$(code "$R")"
ck "  existencia 6" "6.000" "$(body "$R" | jq -r .item.stockOnHand)"
ck "  DISPATCH -4" "DISPATCH -4.000" "$(body "$R" | jq -r '.movement.type + " " + .movement.quantity')"
ck "  a quien" "$EMP" "$(body "$R" | jq -r .movement.employee.id)"
ck "  quien despacho" "user $ADMIN_ID" "$(body "$R" | jq -r '.movement.createdBy.kind + " " + .movement.createdBy.id')"
R=$(req $OFF POST /inventory/items/$SUP/dispatches "{\"quantity\":\"7\",\"employeeId\":\"$EMP\"}")
ck "despachar 7 con 6 -> 409 INSUFFICIENT_STOCK" "409 INSUFFICIENT_STOCK" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items/$SUP/dispatches '{"quantity":"1","employeeId":"00000000-0000-4000-8000-000000000000"}')
ck "empleado inexistente -> 404 EMPLOYEE_NOT_FOUND" "404 EMPLOYEE_NOT_FOUND" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items/$P1/dispatches "{\"quantity\":\"1\",\"employeeId\":\"$EMP\"}")
ck "despachar un producto -> 409 ITEM_NOT_DISPATCHABLE (072)" "409 ITEM_NOT_DISPATCHABLE" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  la existencia del producto no cambio" "3.000" "$(stock_of $P1)"
R=$(req $OFF GET "/inventory/movements?type=DISPATCH&employeeId=$EMP&itemId=$SUP")
ck "reporte: el despacho sale filtrado por empleado" 1 "$(body "$R" | jq -r .total)"

echo
echo "== 5. Ajuste (RN-12) =="
R=$(req $OFF POST /inventory/items/$SUP/adjustments '{"quantity":"-1"}')
ck "ajuste sin motivo -> 422 VALIDATION_ERROR" "422 VALIDATION_ERROR" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items/$SUP/adjustments '{"quantity":"-7","reason":"Conteo VIS065"}')
ck "ajuste -7 con 6 -> 409 INSUFFICIENT_STOCK" "409 INSUFFICIENT_STOCK" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /inventory/items/$SUP/adjustments '{"quantity":"-1","reason":"Conteo VIS065"}')
ck "ajuste -1 con motivo -> 201" "201 5.000" "$(code "$R") $(body "$R" | jq -r .item.stockOnHand)"

echo
echo "== 6. Un insumo no se vende (RN-1) =="
R=$(open_ticket "[{\"serviceId\":\"$SRV\"},{\"inventoryItemId\":\"$SUP\",\"quantity\":\"1\"}]")
ck "insumo en un lavado -> 409 ITEM_NOT_SELLABLE" "409 ITEM_NOT_SELLABLE" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  el insumo no se movio" "5.000" "$(stock_of $SUP)"

echo
echo "== 7. Cobro: servicio \$10 + producto 2 x \$3 = \$16, comision sobre \$10 (RN-8) =="
R=$(open_ticket "[{\"serviceId\":\"$SRV\"},{\"inventoryItemId\":\"$P1\",\"quantity\":\"2\"}]")
ck "lavado con servicio y producto -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r .id)
ck "  total 16.00" "16.00" "$(body "$R" | jq -r .total)"
ck "  existencia del producto 1" "1.000" "$(stock_of $P1)"
req $OFF POST /carwash/tickets/$T2/status '{"status":"READY"}' >/dev/null
R=$(req $OFF POST /carwash/charges "{\"workOrderIds\":[\"$T2\"],\"payments\":[{\"method\":\"CASH\",\"amount\":\"16.00\"}]}")
ck "cobrar 16.00 -> 201" 201 "$(code "$R")"
# commissionFor($10) = $0 y commissionFor($16) = $1: si la base sumara el
# producto, la comision seria 1.00.
ck "  comision sobre los \$10 del servicio" "0.00" "$(ticket $T2 | jq -r .commissionTotal)"
ck "  cobrar no toca el inventario" "1.000" "$(stock_of $P1)"

echo
echo "== 8. Aviso de minimo una sola vez por cruce (RN-13) =="
R=$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Guantes VIS065 $RUN\",\"minStock\":\"2\"}")
LOW=$(body "$R" | jq -r .id)
req $OFF POST /inventory/items/$LOW/entries '{"quantity":"4"}' >/dev/null
SSE=$S/office.sse
curl -s -N -m 15 -b "$OFF" "$API/carwash/stream" > "$SSE" &
SSE_PID=$!
sleep 2
R=$(req $OFF POST /inventory/items/$LOW/dispatches "{\"quantity\":\"2\",\"employeeId\":\"$EMP\"}")
ck "bajar al minimo (4 -> 2) -> 201" 201 "$(code "$R")"
R=$(req $OFF POST /inventory/items/$LOW/dispatches "{\"quantity\":\"1\",\"employeeId\":\"$EMP\"}")
ck "seguir bajando (2 -> 1) -> 201" 201 "$(code "$R")"
ck "  el articulo figura bajo minimo" true "$(body "$R" | jq -r .item.isLowStock)"
sleep 2
kill $SSE_PID 2>/dev/null
wait $SSE_PID 2>/dev/null
ck "  un solo inventory.low_stock en dos movimientos" 1 "$(grep '"type":"inventory.low_stock"' "$SSE" | grep -c "$LOW")"
R=$(req $OFF GET "/inventory/items?kind=SUPPLY&lowStock=true&search=Guantes%20VIS065%20$RUN")
ck "  y sale en el filtro lowStock" 1 "$(body "$R" | jq -r .total)"

echo
echo "== 9. Venta suelta con pago partido (RN-18 a RN-20) =="
req $OFF POST /inventory/items/$P1/entries '{"quantity":"5"}' >/dev/null
R=$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Aromatizante VIS065 $RUN\",\"price\":\"5.00\"}")
P2=$(body "$R" | jq -r .id)
req $OFF POST /inventory/items/$P2/entries '{"quantity":"4"}' >/dev/null
ck "existencias antes: 6 y 4" "6.000 4.000" "$(stock_of $P1) $(stock_of $P2)"

R=$(req $OFF POST /sales "{\"customerName\":\"Cliente VIS065\",\"items\":[{\"inventoryItemId\":\"$P1\",\"quantity\":\"2\"},{\"inventoryItemId\":\"$P2\",\"quantity\":\"1\"}],\"payments\":[{\"method\":\"CARD\",\"amount\":\"5.00\"},{\"method\":\"CASH\",\"amount\":\"6.00\"}],\"cashTendered\":\"10.00\"}")
ck "venta de 2 productos -> 201" 201 "$(code "$R")"
SALE=$(body "$R" | jq -r .id)
ck "  total 11.00 y PAID" "11.00 PAID" "$(body "$R" | jq -r '.total + " " + .status')"
ck "  vuelto 4.00" "4.00" "$(body "$R" | jq -r .changeGiven)"
ck "  existencias 4 y 3" "4.000 3.000" "$(stock_of $P1) $(stock_of $P2)"
ck "  SALE con counterSaleId" "SALE -2.000 $SALE" "$(last_move $P1 | jq -r '.type + " " + .quantity + " " + .counterSaleId')"
ck "  los dos pagos estan en el turno" 2 "$(body "$(req $OFF GET "/carwash/cash/sessions/$CASH_ID?pageSize=100")" | jq --arg s "$SALE" '[.payments.items[]|select(.counterSaleId==$s)]|length')"

R=$(req $OFF POST /sales "{\"items\":[{\"inventoryItemId\":\"$P2\",\"quantity\":\"10\"}],\"payments\":[{\"method\":\"CASH\",\"amount\":\"50.00\"}]}")
ck "vender mas de lo que hay -> 409 INSUFFICIENT_STOCK" "409 INSUFFICIENT_STOCK" "$(code "$R") $(body "$R" | jq -r .code)"
ck "  no se movio nada" "3.000" "$(stock_of $P2)"

echo
echo "== 10. Anular la venta devuelve todo (RN-22) =="
R=$(req $OFF POST /sales/$SALE/void "{\"reason\":\"Prueba VIS065\",$ADMIN_AUTH}")
ck "anular la venta -> 200" 200 "$(code "$R")"
ck "  queda VOID" VOID "$(body "$R" | jq -r .status)"
ck "  existencias vuelven a 6 y 4" "6.000 4.000" "$(stock_of $P1) $(stock_of $P2)"
ck "  SALE_RETURN con counterSaleId" "SALE_RETURN 2.000 $SALE" "$(last_move $P1 | jq -r '.type + " " + .quantity + " " + .counterSaleId')"
ck "  los pagos salieron del turno" 0 "$(body "$(req $OFF GET "/carwash/cash/sessions/$CASH_ID?pageSize=100")" | jq --arg s "$SALE" '[.payments.items[]|select(.counterSaleId==$s)]|length')"
R=$(req $OFF POST /sales/$SALE/void "{\"reason\":\"Otra vez\",$ADMIN_AUTH}")
ck "anular dos veces -> 409 SALE_ALREADY_VOID" "409 SALE_ALREADY_VOID" "$(code "$R") $(body "$R" | jq -r .code)"

echo
echo "== 11. Varios articulos a la vez: entrada y entrega, todo o nada (091) =="
BP=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"PRODUCT\",\"name\":\"Soda VIS091 $RUN\",\"price\":\"1.25\"}")" | jq -r .id)
BS=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Esponja VIS091 $RUN\"}")" | jq -r .id)
BX=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Baja VIS091 $RUN\"}")" | jq -r .id)
req $OFF PATCH /inventory/items/$BX '{"isActive":false}' >/dev/null
R=$(req $OFF POST /inventory/entries "{\"reference\":\"Factura VIS091\",\"lines\":[{\"itemId\":\"$BP\",\"quantity\":\"6\",\"unitCost\":\"0.70\"},{\"itemId\":\"$BS\",\"quantity\":\"4\"}]}")
ck "entrada de dos lineas -> 201" 201 "$(code "$R")"
ck "  suben las dos existencias" "6.000 4.000" "$(stock_of $BP) $(stock_of $BS)"
ck "  misma referencia en las dos" "Factura VIS091 Factura VIS091" "$(body "$R" | jq -r '[.results[].movement.reference]|join(" ")')"
R=$(req $OFF POST /inventory/entries "{\"lines\":[{\"itemId\":\"$BP\",\"quantity\":\"1\"},{\"itemId\":\"$BX\",\"quantity\":\"1\"}]}")
ck "entrada con una linea inactiva -> 409 ITEM_INACTIVE con su itemId" "409 ITEM_INACTIVE $BX" "$(code "$R") $(body "$R" | jq -r '.code + " " + .details.itemId')"
ck "  no entro ninguna" "6.000 0.000" "$(stock_of $BP) $(stock_of $BX)"
R=$(req $OFF POST /inventory/entries "{\"lines\":[{\"itemId\":\"$BP\",\"quantity\":\"1\"},{\"itemId\":\"$BP\",\"quantity\":\"2\"}]}")
ck "un articulo repetido -> 422" 422 "$(code "$R")"
BS2=$(body "$(req $OFF POST /inventory/items "{\"kind\":\"SUPPLY\",\"name\":\"Guantes VIS091 $RUN\"}")" | jq -r .id)
req $OFF POST /inventory/items/$BS2/entries '{"quantity":"4"}' >/dev/null
R=$(req $OFF POST /inventory/deliveries "{\"employeeId\":\"$EMP\",\"lines\":[{\"itemId\":\"$BS\",\"quantity\":\"1\"},{\"itemId\":\"$BP\",\"quantity\":\"2\"}]}")
ck "entrega con un producto -> 409 ITEM_NOT_DISPATCHABLE con su itemId (105)" "409 ITEM_NOT_DISPATCHABLE $BP" "$(code "$R") $(body "$R" | jq -r '.code + " " + .details.itemId')"
ck "  no salio ninguna" "6.000 4.000" "$(stock_of $BP) $(stock_of $BS)"
R=$(req $OFF POST /inventory/deliveries "{\"employeeId\":\"$EMP\",\"note\":\"VIS091\",\"lines\":[{\"itemId\":\"$BS\",\"quantity\":\"1\"},{\"itemId\":\"$BS2\",\"quantity\":\"2\"}]}")
ck "entrega de dos insumos -> 201" 201 "$(code "$R")"
ck "  los dos como DISPATCH" "DISPATCH DISPATCH" "$(body "$R" | jq -r '[.results[].movement.type]|join(" ")')"
ck "  bajan los dos" "3.000 2.000" "$(stock_of $BS) $(stock_of $BS2)"
R=$(req $OFF POST /inventory/deliveries "{\"employeeId\":\"$EMP\",\"lines\":[{\"itemId\":\"$BS2\",\"quantity\":\"1\"},{\"itemId\":\"$BS\",\"quantity\":\"99\"}]}")
ck "entrega que no alcanza -> 409 INSUFFICIENT_STOCK con su itemId" "409 INSUFFICIENT_STOCK $BS" "$(code "$R") $(body "$R" | jq -r '.code + " " + .details.itemId')"
ck "  no salio ninguna" "3.000 2.000" "$(stock_of $BS) $(stock_of $BS2)"
R=$(req $OFF GET "/inventory/movements?itemId=$BS&type=DISPATCH,ADJUSTMENT&pageSize=50")
ck "movimientos con varios tipos -> 200, solo el despacho" "200 1" "$(code "$R") $(body "$R" | jq -r .total)"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
