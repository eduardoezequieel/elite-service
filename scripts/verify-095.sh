#!/bin/bash
# Verificacion end-to-end de la spec 095 (renta de carros: flota, clientes de
# renta, ajustes y archivos).
#
# Lo que prueba y `pnpm test` no puede: la migracion `rentals_foundation`, el
# indice unico de placa que da el 409, las claves nuevas sincronizadas por el
# seed y resueltas por los guards, la fila de ajustes por defecto, y la subida
# real de archivos con multer a FILES_DIR (413 / 415 / 401 / Content-Type).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:deploy && pnpm --filter @elite/api db:seed
#   pnpm --filter @elite/api dev        # o pnpm dev
#   bash scripts/verify-095.sh
#
# La revision de ajustes por defecto supone que nadie los edito todavia: el
# script guarda un cambio y deja la fila como la encontro.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
CLERK_EMAIL=renta.vis095@elite.local
CLERK_PASSWORD=Renta095!
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
upload() {
  # upload <jar> <archivo> <tipo declarado>
  curl -s -b "$1" -c "$1" -X POST "$API/rental-files" -F kind=LOGO -F "file=@$2;type=$3" -w '\n%{http_code}'
}
code() { echo "$1" | tail -1; }
body() { echo "$1" | sed '$d'; }

OFF=$S/office.jar; CLK=$S/clerk.jar; ANON=$S/anon.jar
rm -f "$OFF" "$CLK" "$ANON"

echo "== 0. Sesion y permisos (seed) =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"
ck "  el admin tiene las 9 claves de renta" 9 "$(body "$R" | jq '[.permissions[]|select(test("^(rentals|fleet|renters)\\."))]|length')"

R=$(req $OFF POST /roles '{"name":"Clientes VIS095","permissionKeys":["renters.read"]}')
case "$(code "$R")" in
  201) ROLE=$(body "$R" | jq -r '.id');;
  *) ROLE=$(body "$(req $OFF GET /roles)" | jq -r '.[]|select(.name=="Clientes VIS095").id');;
esac
req $OFF POST /users "{\"email\":\"$CLERK_EMAIL\",\"fullName\":\"Clientes VIS095\",\"password\":\"$CLERK_PASSWORD\",\"roleIds\":[\"$ROLE\"]}" >/dev/null
R=$(req $CLK POST /auth/login "{\"email\":\"$CLERK_EMAIL\",\"password\":\"$CLERK_PASSWORD\"}")
ck "login con solo renters.read -> 200" 200 "$(code "$R")"

echo
echo "== 1. Permisos y sesion =="
ck "sin fleet.read: GET /fleet/vehicles -> 403" 403 "$(code "$(req $CLK GET /fleet/vehicles)")"
ck "sin sesion: GET /fleet/vehicles -> 401" 401 "$(code "$(req $ANON GET /fleet/vehicles)")"
ck "sin renters.manage: POST /renters -> 403" 403 "$(code "$(req $CLK POST /renters '{"fullName":"X"}')")"
ck "con renters.read: GET /renters -> 200" 200 "$(code "$(req $CLK GET /renters)")"
ck "sin ninguna clave de lectura: GET /rental-settings -> 403" 403 "$(code "$(req $CLK GET /rental-settings)")"

echo
echo "== 2. Flota (RN-2, RN-6) =="
PLATE="P95$RUN"
R=$(req $OFF POST /fleet/vehicles "{\"plate\":\" $(echo "$PLATE" | tr "A-Z" "a-z") \",\"make\":\"Toyota\",\"model\":\"Yaris\",\"year\":2022,\"dailyRate\":\"35\"}")
ck "crear carro -> 201" 201 "$(code "$R")"
CAR=$(body "$R" | jq -r .id)
ck "  ACTIVE, placa normalizada y tarifa como cadena" "ACTIVE $PLATE 35.00" "$(body "$R" | jq -r '.status + " " + .plate + " " + .dailyRate')"
ck "  aparece en GET /fleet/vehicles" 1 "$(body "$(req $OFF GET /fleet/vehicles)" | jq --arg id "$CAR" '[.[]|select(.id==$id)]|length')"
R=$(req $OFF POST /fleet/vehicles "{\"plate\":\"$PLATE\",\"make\":\"Kia\",\"model\":\"Rio\",\"dailyRate\":\"30.00\"}")
ck "misma placa -> 409 PLATE_TAKEN" "409 PLATE_TAKEN" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(req $OFF POST /fleet/vehicles '{"make":"Kia","model":"Rio","dailyRate":"30.00"}')
ck "sin placa -> 201 con plate null" "201 null" "$(code "$R") $(body "$R" | jq -r .plate)"
NOPLATE=$(body "$R" | jq -r .id)
R=$(req $OFF POST /fleet/vehicles '{"make":"Kia","model":"Rio"}')
ck "sin tarifa diaria -> 422" 422 "$(code "$R")"
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"status":"IN_SHOP"}')
ck "a taller -> 200 IN_SHOP" "200 IN_SHOP" "$(code "$R") $(body "$R" | jq -r .status)"
ck "  ?status=IN_SHOP lo trae" 1 "$(body "$(req $OFF GET '/fleet/vehicles?status=IN_SHOP')" | jq --arg id "$CAR" '[.[]|select(.id==$id)]|length')"
ck "  ?status=ACTIVE no" 0 "$(body "$(req $OFF GET '/fleet/vehicles?status=ACTIVE')" | jq --arg id "$CAR" '[.[]|select(.id==$id)]|length')"
ck "  ?q busca por placa" 1 "$(body "$(req $OFF GET "/fleet/vehicles?q=$PLATE")" | jq 'length')"
R=$(req $OFF PATCH /fleet/vehicles/$CAR '{"status":"RETIRED","insuranceExpiresAt":"2027-03-05"}')
ck "retirar con vencimiento -> 200" "200 RETIRED 2027-03-05" "$(code "$R") $(body "$R" | jq -r '.status + " " + .insuranceExpiresAt')"
ck "GET /fleet/vehicles/:id -> 200" 200 "$(code "$(req $OFF GET /fleet/vehicles/$CAR)")"
ck "id que no existe -> 404" 404 "$(code "$(req $OFF GET /fleet/vehicles/00000000-0000-4000-8000-000000000000)")"
ck "no existe borrar -> 404" 404 "$(code "$(req $OFF DELETE /fleet/vehicles/$CAR)")"
req $OFF PATCH /fleet/vehicles/$NOPLATE '{"status":"RETIRED"}' >/dev/null

echo
echo "== 3. Clientes de renta (RN-6, RN-9) =="
R=$(req $OFF POST /renters "{\"fullName\":\"Bloqueado VIS095 $RUN\",\"isBlocked\":true,\"blockReason\":\"Devolvio chocado\",\"birthDate\":\"1990-03-05\"}")
ck "crear bloqueado -> 201" "201 true" "$(code "$R") $(body "$R" | jq -r .isBlocked)"
BLOCKED=$(body "$R" | jq -r .id)
ck "  ?blocked=true lo trae" 1 "$(body "$(req $OFF GET '/renters?blocked=true')" | jq --arg id "$BLOCKED" '[.[]|select(.id==$id)]|length')"
ck "  ?blocked=false no" 0 "$(body "$(req $OFF GET '/renters?blocked=false')" | jq --arg id "$BLOCKED" '[.[]|select(.id==$id)]|length')"
R=$(req $OFF POST /renters/import "{\"rows\":[{\"Nombre\":\"Import VIS095 A $RUN\",\"DUI\":\"0123\"},{\"Nombre\":\"\",\"DUI\":\"9\"},{\"nombre\":\"Import VIS095 B $RUN\",\"nacimiento\":\"31/02/1990\"},{\"nombre\":\"Import VIS095 C $RUN\",\"celular\":\"7777-8888\"}]}")
ck "importar 2 validas y 2 invalidas -> 200" 200 "$(code "$R")"
ck "  created 2, skipped en las filas 3 y 4" "2 3,4" "$(body "$R" | jq -r '(.created|tostring) + " " + ([.skipped[].row|tostring]|join(","))')"
ck "  las invalidas no se crearon" 2 "$(body "$(req $OFF GET "/renters?q=VIS095")" | jq --arg run "$RUN" '[.[]|select(.fullName|test("^Import VIS095 .* " + $run + "$"))]|length')"
R=$(req $OFF PATCH /renters/$BLOCKED '{"isActive":false}')
ck "desactivar -> 200" "200 false" "$(code "$R") $(body "$R" | jq -r .isActive)"

echo
echo "== 4. Ajustes por defecto (RN-8) =="
R=$(req $OFF GET /rental-settings)
ck "GET /rental-settings -> 200" 200 "$(code "$R")"
ORIGINAL=$(body "$R" | jq -c 'del(.logoUrl, .updatedAt)')
ck "  empresa, NIT y arrendante del prototipo" "RIVERA'S RENT A CARS|0614-070624-103-3|JOSUE ALEXANDER RIVERA" "$(body "$R" | jq -r '[.companyName,.taxId,.lessorName]|join("|")')"
ck "  contrato 733, IVA 0, margen 1 h, edad 21" "733 0.00 1 21" "$(body "$R" | jq -r '[.contractStartNumber,.vatRate,.bufferHours,.minDriverAge]|map(tostring)|join(" ")')"
ck "  17 clausulas y 28 accesorios" "17 28" "$(body "$R" | jq -r '"\(.clauses|length) \(.accessories|length)"')"
ck "  sin logo" null "$(body "$R" | jq -r .logoUrl)"

echo
echo "== 5. Archivos (RN-7) =="
printf '\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\x0aIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\x0d\x0a\x2d\xb4\x00\x00\x00\x00IEND\xaeB`\x82' > "$S/logo.png"
R=$(upload $OFF "$S/logo.png" image/png)
ck "subir PNG -> 201" 201 "$(code "$R")"
FILE=$(body "$R" | jq -r .id)
ck "  responde { id, url }" "/rental-files/$FILE" "$(body "$R" | jq -r .url)"
curl -s -b "$OFF" -D "$S/headers" -o "$S/back.png" "$API/rental-files/$FILE"
ck "GET /rental-files/:id -> Content-Type image/png" "image/png" "$(grep -i '^content-type:' "$S/headers" | tr -d '\r' | awk '{print $2}')"
ck "  Cache-Control private" 1 "$(grep -ci '^cache-control: private' "$S/headers")"
ck "  los mismos bytes" "$(shasum "$S/logo.png" | cut -d' ' -f1)" "$(shasum "$S/back.png" | cut -d' ' -f1)"
ck "  sin sesion -> 401" 401 "$(code "$(req $ANON GET /rental-files/$FILE)")"
{ cat "$S/logo.png"; head -c 6291456 /dev/zero; } > "$S/big.png"
R=$(upload $OFF "$S/big.png" image/png)
ck "6 MB -> 413 FILE_TOO_LARGE" "413 FILE_TOO_LARGE" "$(code "$R") $(body "$R" | jq -r .code)"
printf '%%PDF-1.7\n1 0 obj\n<<>>\nendobj\n' > "$S/doc.pdf"
R=$(upload $OFF "$S/doc.pdf" application/pdf)
ck "PDF -> 415 FILE_TYPE_NOT_ALLOWED" "415 FILE_TYPE_NOT_ALLOWED" "$(code "$R") $(body "$R" | jq -r .code)"
R=$(upload $OFF "$S/doc.pdf" image/png)
ck "PDF que dice ser PNG -> 415" 415 "$(code "$R")"
ck "subir sin sesion -> 401" 401 "$(code "$(upload $ANON "$S/logo.png" image/png)")"
ck "subir sin rentals.manage ni rentals.settings -> 403" 403 "$(code "$(upload $CLK "$S/logo.png" image/png)")"

echo
echo "== 6. Guardar ajustes con logo y dejarlos como estaban =="
R=$(req $OFF PUT /rental-settings "$(echo "$ORIGINAL" | jq -c --arg logo "$FILE" '.logoFileId=$logo | .vatRate="13" | .accessories=["Antena","Radio"]')")
ck "PUT con logo, IVA 13 y 2 accesorios -> 200" "200 13.00 2 /rental-files/$FILE" "$(code "$R") $(body "$R" | jq -r '"\(.vatRate) \(.accessories|length) \(.logoUrl)"')"
R=$(req $OFF PUT /rental-settings "$(echo "$ORIGINAL" | jq -c '.logoFileId="00000000-0000-4000-8000-000000000000"')")
ck "logo que no existe -> 422" 422 "$(code "$R")"
R=$(req $OFF PUT /rental-settings "$ORIGINAL")
ck "restaurar los ajustes -> 200" "200 28" "$(code "$R") $(body "$R" | jq -r '.accessories|length')"
ck "sin rentals.settings: PUT -> 403" 403 "$(code "$(req $CLK PUT /rental-settings "$ORIGINAL")")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
[ "$FAIL" -eq 0 ]
