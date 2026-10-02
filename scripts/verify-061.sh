#!/bin/bash
# Verificacion end-to-end de la spec 061 (detalle de comisiones por empleado).
#
# Uso:
#   docker compose up -d && pnpm dev
#   bash scripts/verify-061.sh
#
# Solo lee: no crea ni borra nada. Usa el mes en curso.
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
sql() {
  docker exec elite-service-postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tA -c "$1" 2>/dev/null | tr -d '\r'
}

OFF=$S/office.jar; ANON=$S/anon.jar
FROM=$(TZ=America/El_Salvador date +%Y-%m-01)
TO=$(TZ=America/El_Salvador date +%Y-%m-%d)
Q="from=$FROM&to=$TO"

echo "== 0. Sesión =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

echo "== 1. Errores =="
R=$(req $ANON GET "/carwash/commissions/00000000-0000-4000-8000-000000000000?$Q")
ck "sin sesión -> 401" 401 "$(code "$R")"
R=$(req $OFF GET "/carwash/commissions/00000000-0000-4000-8000-000000000000?$Q")
ck "empleado inexistente -> 404" 404 "$(code "$R")"
ck "  code NOT_FOUND" NOT_FOUND "$(body "$R" | jq -r .code)"
R=$(req $OFF GET "/carwash/commissions/no-es-uuid?$Q")
ck "id no-UUID -> 404" 404 "$(code "$R")"
R=$(req $OFF GET "/carwash/commissions/00000000-0000-4000-8000-000000000000?from=abc")
ck "fecha mal formada -> 422" 422 "$(code "$R")"

echo "== 2. Detalle contra el reporte ($FROM → $TO) =="
R=$(req $OFF GET "/carwash/commissions?$Q&pageSize=100")
ck "GET /carwash/commissions -> 200" 200 "$(code "$R")"
REPORT=$(body "$R")
EMP=$(echo "$REPORT" | jq -r '.employees.items[0].employeeId // empty')
if [ -z "$EMP" ]; then
  EMP=$(sql "select id from employees order by \"createdAt\" limit 1;")
  R=$(req $OFF GET "/carwash/commissions/$EMP?$Q&pageSize=100")
  ck "empleado sin lavados en el rango -> 200" 200 "$(code "$R")"
  ck "  lista vacía" 0 "$(body "$R" | jq '.washes.total')"
  ck "  comisión 0.00" '"0.00"' "$(body "$R" | jq -c .commission)"
else
  ROW=$(echo "$REPORT" | jq -c --arg id "$EMP" '.employees.items[] | select(.employeeId==$id)')
  R=$(req $OFF GET "/carwash/commissions/$EMP?$Q&pageSize=100")
  ck "GET detalle -> 200" 200 "$(code "$R")"
  D=$(body "$R")
  ck "  mismo rango" "$FROM/$TO" "$(echo "$D" | jq -r '.from + "/" + .to')"
  ck "  mismo empleado" "$EMP" "$(echo "$D" | jq -r .employee.id)"
  ck "  misma comisión que el reporte" "$(echo "$ROW" | jq -r .commission)" "$(echo "$D" | jq -r .commission)"
  ck "  mismas ventas atribuidas" "$(echo "$ROW" | jq -r .salesAttributed)" "$(echo "$D" | jq -r .salesAttributed)"
  ck "  mismos lavados" "$(echo "$ROW" | jq -r .ticketCount)" "$(echo "$D" | jq -r .ticketCount)"
  SUM=$(echo "$D" | jq -r '[.washes.items[].commission | tonumber * 100 | round] | add // 0')
  TOTAL=$(echo "$D" | jq -r '.commission | tonumber * 100 | round')
  ck "  las líneas suman la comisión" "$TOTAL" "$SUM"
  SORTED=$(echo "$D" | jq -r '[.washes.items[].chargedAt] as $a | ($a == ($a | sort | reverse))')
  ck "  más reciente arriba" true "$SORTED"
  ck "  la página dice cuántos son (102)" "$(echo "$D" | jq -r .ticketCount)" "$(echo "$D" | jq -r .washes.total)"
fi

echo
echo "Resultado: $PASS OK, $FAIL fallas"
[ "$FAIL" -eq 0 ]
