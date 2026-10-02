#!/bin/bash
# Verificacion end-to-end de la spec 067 (Rendimiento del lavado).
#
# Uso:
#   docker compose up -d && pnpm dev
#   bash scripts/verify-067.sh
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
  local jar=$1 m=$2 path=$3
  curl -s -b "$jar" -c "$jar" -X "$m" "$API$path" -w '\n%{http_code}'
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
NIL=00000000-0000-4000-8000-000000000000

# Las claves de PerformanceFigures, ordenadas, como las devuelve `jq keys`.
FIGURES='["avgMinutes","avgReturnDays","byBodyType","commission","extras","extrasTotal","measuredCount","minutesVsTeam","returnedCount","salesAttributed","timedCount","untimedCount","washCount","withExtrasCount"]'

echo "== 0. Sesión =="
R=$(curl -s -c $OFF -X POST "$API/auth/login" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}" -w '\n%{http_code}')
ck "login de oficina -> 200" 200 "$(code "$R")"

echo "== 1. Errores =="
R=$(req $ANON GET "/carwash/performance?$Q")
ck "reporte sin sesión -> 401" 401 "$(code "$R")"
R=$(req $ANON GET "/carwash/performance/$NIL?$Q")
ck "detalle sin sesión -> 401" 401 "$(code "$R")"
R=$(req $OFF GET "/carwash/performance/$NIL?$Q")
ck "empleado inexistente -> 404" 404 "$(code "$R")"
ck "  code NOT_FOUND" NOT_FOUND "$(body "$R" | jq -r .code)"
R=$(req $OFF GET "/carwash/performance/no-es-uuid?$Q")
ck "id no-UUID -> 404" 404 "$(code "$R")"
ck "  code NOT_FOUND" NOT_FOUND "$(body "$R" | jq -r .code)"
R=$(req $OFF GET "/carwash/performance?from=abc")
ck "fecha mal formada -> 422" 422 "$(code "$R")"
INACTIVE=$(sql "select id from employees where \"isActive\" = false limit 1;")
if [ -n "$INACTIVE" ]; then
  R=$(req $OFF GET "/carwash/performance/$INACTIVE?$Q")
  ck "empleado inactivo -> 404 (RN-8)" 404 "$(code "$R")"
else
  echo "  --   no hay empleados inactivos: se salta el 404 de inactivo"
fi

echo "== 2. Reporte ($FROM → $TO) =="
R=$(req $OFF GET "/carwash/performance?$Q&pageSize=100")
ck "GET /carwash/performance -> 200" 200 "$(code "$R")"
REPORT=$(body "$R")
ck "  mismo rango" "$FROM/$TO" "$(echo "$REPORT" | jq -r '.from + "/" + .to')"
ck "  trae el rango de fieles" true "$(echo "$REPORT" | jq '(.returnsFrom|type=="string") and (.returnsTo|type=="string") and (.returnsShifted|type=="boolean")')"
ck "  fieles no pasa de hoy − 30" true "$(echo "$REPORT" | jq --arg cut "$(TZ=America/El_Salvador date -v-30d +%Y-%m-%d 2>/dev/null || TZ=America/El_Salvador date -d '-30 days' +%Y-%m-%d)" '.returnsTo <= $cut')"
ck "  team con todas las cifras" "$FIGURES" "$(echo "$REPORT" | jq -c '.team | keys')"
ck "  team.minutesVsTeam = null" null "$(echo "$REPORT" | jq -c '.team.minutesVsTeam')"
ck "  dinero con 2 decimales" true "$(echo "$REPORT" | jq '[.team.salesAttributed, .team.commission, .team.extrasTotal] | all(test("^-?[0-9]+\\.[0-9]{2}$"))')"
ACTIVE_DB=$(sql "select count(*) from employees where \"isActive\" = true;")
ck "  activeEmployees = activos de la base" "$ACTIVE_DB" "$(echo "$REPORT" | jq '.activeEmployees | length')"
ck "  filas solo de activos" true "$(echo "$REPORT" | jq '[.activeEmployees[].id] as $ids | all(.employees.items[]; .employeeId as $e | $ids | index($e) != null)')"
ck "  filas con todas las cifras" true "$(echo "$REPORT" | jq --argjson f "$FIGURES" 'all(.employees.items[]; (del(.employeeId, .fullName) | keys) == $f)')"
ck "  sin tiempo + con tiempo = lavados" true "$(echo "$REPORT" | jq '.team.timedCount + .team.untimedCount == .team.washCount')"

echo "== 3. Detalle =="
EMP=$(echo "$REPORT" | jq -r '.employees.items[0].employeeId // .activeEmployees[0].id // empty')
if [ -z "$EMP" ]; then
  echo "  --   no hay empleados activos: se salta el detalle"
else
  R=$(req $OFF GET "/carwash/performance/$EMP?$Q&pageSize=100")
  ck "GET detalle -> 200" 200 "$(code "$R")"
  D=$(body "$R")
  ck "  mismo rango" "$FROM/$TO" "$(echo "$D" | jq -r '.from + "/" + .to')"
  ck "  mismo empleado" "$EMP" "$(echo "$D" | jq -r .employee.id)"
  ck "  figures con todas las cifras" "$FIGURES" "$(echo "$D" | jq -c '.figures | keys')"
  ck "  team igual al del reporte" "$(echo "$REPORT" | jq -cS .team)" "$(echo "$D" | jq -cS .team)"
  ROW=$(echo "$REPORT" | jq -c --arg id "$EMP" '.employees.items[] | select(.employeeId==$id) | del(.employeeId, .fullName)' | jq -cS .)
  if [ -n "$ROW" ]; then
    ck "  figures igual a su fila" "$ROW" "$(echo "$D" | jq -cS .figures)"
  fi
  ck "  una línea por lavado" "$(echo "$D" | jq .figures.washCount)" "$(echo "$D" | jq '.washes.total')"
  ck "  una línea por lavado de fieles" "$(echo "$D" | jq .figures.measuredCount)" "$(echo "$D" | jq '.returns.total')"
  ck "  extraWashes son los que llevan extra (102)" "$(echo "$D" | jq .figures.withExtrasCount)" "$(echo "$D" | jq '.extraWashes.total')"
  ck "  lavados más reciente arriba" true "$(echo "$D" | jq '[.washes.items[].chargedAt] as $a | ($a == ($a | sort | reverse))')"
fi

echo "== 4. Catálogo: isExtra =="
R=$(req $OFF GET "/service-categories?pageSize=100")
ck "GET /service-categories -> 200" 200 "$(code "$R")"
ck "  todas traen isExtra booleano" true "$(body "$R" | jq '(.items|length) > 0 and all(.items[]; .isExtra | type == "boolean")')"
PREMIUM=$(body "$R" | jq -r '.items[] | select(.name=="Lavado premium") | .isExtra')
if [ -n "$PREMIUM" ]; then
  ck "  «Lavado premium» no es extra" false "$PREMIUM"
fi

echo
echo "Resultado: $PASS OK, $FAIL fallas"
[ "$FAIL" -eq 0 ]
