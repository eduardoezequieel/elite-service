#!/bin/bash
# Verificacion de la spec 026 (selector de fecha propio).
#
# Comprueba el contrato de fechas civiles, que no quede type=date/showPicker
# en el front, y que el paquete web compile y linteé.
#
# Uso (desde la raiz del monorepo):
#   bash scripts/verify-026.sh
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PASS=0
FAIL=0

ck() {
  if [ "$2" = "$3" ]; then echo "  OK   $1"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}

echo "== 1. Tests de fechas civiles =="
pnpm --filter @elite/web test
ck "pnpm --filter @elite/web test -> 0" "0" "$?"

echo "== 2. Nada de calendario nativo =="
HITS=$(grep -rn --include='*.tsx' --include='*.ts' -E 'type=["'\'']date["'\'']|showPicker' apps/web/src || true)
if [ -z "$HITS" ]; then
  echo "  OK   cero type=date / showPicker en apps/web/src"
  PASS=$((PASS+1))
else
  echo "  FALLA queda calendario nativo:"
  echo "$HITS"
  FAIL=$((FAIL+1))
fi

echo "== 3. La primitiva y el prototipo existen =="
[ -f apps/web/src/components/ui/date-field.tsx ]
ck "date-field.tsx" "0" "$?"
[ -f apps/web/src/lib/civil-date.ts ]
ck "civil-date.ts" "0" "$?"
[ -f docs/prototype/date-picker.html ]
ck "docs/prototype/date-picker.html" "0" "$?"

echo "== 4. lint web =="
pnpm --filter @elite/web lint
ck "pnpm --filter @elite/web lint -> 0" "0" "$?"

echo
echo "OK=$PASS FALLA=$FAIL"
if [ "$FAIL" -ne 0 ]; then exit 1; fi
