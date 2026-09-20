#!/bin/bash
# Verificacion end-to-end de la spec 042 (lavados en vivo por SSE).
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-042.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"; kill $(jobs -p) 2>/dev/null' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
PASS=0; FAIL=0
# Una placa es un vehiculo (RN-12): con placas fijas la segunda corrida daria 409.
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

OFF=$S/office.jar; CARLOS=$S/carlos.jar; ANA=$S/ana.jar
rm -f "$OFF" "$CARLOS" "$ANA"

echo "== 0. Sesiones =="
R=$(req $OFF POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login de oficina -> 200" 200 "$(code "$R")"

# Un PIN por empleado: es unico en todo el taller (044 RN-3).
for who in carlos:420001 ana:420002; do
  name=${who%%:*}; pin=${who##*:}
  R=$(req $OFF POST /employees "{\"fullName\":\"${name} VIS042\",\"username\":\"${name}.vis042\",\"pin\":\"${pin}\"}")
  C=$(code "$R")
  if [ "$C" = "201" ] || [ "$C" = "409" ] || [ "$C" = "422" ]; then
    echo "  empleado ${name} listo ($C)"
  else
    echo "  AVISO: alta de ${name} devolvio $C"
  fi
done

R=$(req $OFF GET /employees)
CARLOS_ID=$(body "$R" | jq -r '.[]|select(.username=="carlos.vis042").id')
ANA_ID=$(body "$R" | jq -r '.[]|select(.username=="ana.vis042").id')
ck "id de carlos resuelto" true "$([ -n "$CARLOS_ID" ] && [ "$CARLOS_ID" != "null" ] && echo true || echo false)"
ck "id de ana resuelto" true "$([ -n "$ANA_ID" ] && [ "$ANA_ID" != "null" ] && echo true || echo false)"

R=$(req $CARLOS POST /floor/login '{"pin":"420001"}')
ck "login de pista (carlos) -> 200" 200 "$(code "$R")"

R=$(req $OFF POST /carwash/cash/open '{"openingFloat":"0.00"}')
C=$(code "$R")
if [ "$C" = "200" ] || [ "$C" = "201" ] || [ "$C" = "409" ]; then echo "  caja lista ($C)"; else echo "  AVISO: abrir caja devolvio $C"; fi

R=$(req $OFF GET /vehicle-body-types)
SEDAN=$(body "$R" | jq -r '.[]|select(.key=="sedan").id')
R=$(req $OFF GET /services)
SRV1=$(body "$R" | jq -r '.[0].id')

echo
echo "== 1. Sin sesion no hay stream =="
ANON=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$API/carwash/stream")
ck "GET /carwash/stream sin cookie -> 401" 401 "$ANON"
ANON=$(curl -s -o /dev/null -w '%{http_code}' -m 5 "$API/floor/stream")
ck "GET /floor/stream sin cookie -> 401" 401 "$ANON"

echo
echo "== 2. Oficina recibe el ciclo completo =="
OFF_SSE=$S/office.sse
curl -s -N -m 25 -b "$OFF" "$API/carwash/stream" > "$OFF_SSE" &
CARLOS_SSE=$S/carlos.sse
curl -s -N -m 25 -b "$CARLOS" "$API/floor/stream" > "$CARLOS_SSE" &
sleep 2

R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"P$RUN-A\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}],\"employeeId\":\"$CARLOS_ID\"}")
ck "alta de oficina asignada a carlos -> 201" 201 "$(code "$R")"
T1=$(body "$R" | jq -r .id)
N1=$(body "$R" | jq -r .number)

R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"WASHING"}')
ck "T1 -> WASHING -> 200" 200 "$(code "$R")"
R=$(req $OFF POST /carwash/tickets/$T1/status '{"status":"READY"}')
ck "T1 -> READY -> 200" 200 "$(code "$R")"
TOTAL=$(body "$(req $OFF GET /carwash/tickets/$T1)" | jq -r .total)
R=$(req $OFF POST /carwash/tickets/$T1/charge "{\"method\":\"CASH\",\"amount\":\"$TOTAL\"}")
ck "cobro de T1 -> 200" 200 "$(code "$R")"

echo
echo "== 3. Un lavado de otro empleado no llega a la pista de carlos =="
R=$(req $OFF POST /carwash/tickets "{\"vehicle\":{\"plate\":\"P$RUN-B\",\"bodyTypeId\":\"$SEDAN\"},\"items\":[{\"serviceId\":\"$SRV1\"}],\"employeeId\":\"$ANA_ID\"}")
ck "alta asignada a ana -> 201" 201 "$(code "$R")"
T2=$(body "$R" | jq -r .id)
N2=$(body "$R" | jq -r .number)

sleep 3
kill %1 %2 2>/dev/null
wait 2>/dev/null

echo
echo "== 4. Lo que quedo en cada hilo =="
# Oficina ve las dos altas: la de carlos y la de ana. No recorta por empleado.
ck "oficina: las dos altas" 2 "$(grep -c "\"type\":\"ticket.created\"" "$OFF_SSE" | head -1)"
ck "oficina: dos cambios de estado" 2 "$(grep -c "\"type\":\"ticket.status.changed\"" "$OFF_SSE" | head -1)"
ck "oficina: cobro" 1 "$(grep -c "\"type\":\"ticket.charged\"" "$OFF_SSE" | head -1)"
ck "oficina: el evento trae el ticket entero" true "$(grep -q "$N1" "$OFF_SSE" && echo true || echo false)"
ck "oficina: el evento dice quien lo hizo" true "$(grep -q '"actor":{"kind":"user"' "$OFF_SSE" && echo true || echo false)"

ck "pista: ve su propio lavado" true "$(grep -q "$N1" "$CARLOS_SSE" && echo true || echo false)"
ck "pista: NO ve el de ana (036)" false "$(grep -q "$N2" "$CARLOS_SSE" && echo true || echo false)"
ck "pista: NO recibe el cobro" 0 "$(grep -c "\"type\":\"ticket.charged\"" "$CARLOS_SSE" | head -1)"

echo
echo "== Resultado: $PASS ok, $FAIL fallos =="
[ "$FAIL" -eq 0 ]
