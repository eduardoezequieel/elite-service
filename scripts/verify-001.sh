#!/bin/bash
# Verificacion end-to-end de la spec 001 (auth + RBAC dinamico).
#
# Recorre los criterios de aceptacion contra un stack levantado de verdad:
# base sembrada, API en marcha. No toca la UI (para eso esta la checklist visual
# al pie de specs/001-auth.md); prueba el contrato del API y las reglas RN-4 a RN-11.
#
# Uso:
#   docker compose up -d && pnpm --filter @elite/api db:seed && pnpm dev
#   bash scripts/verify-001.sh
#
# Crea un rol y un usuario de prueba con el sufijo E2E y los borra al terminar.
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API=${API_BASE_URL:-http://localhost:3200/api}
S=$(mktemp -d)
trap 'rm -rf "$S"' EXIT
ADMIN_EMAIL=$(grep '^ADMIN_EMAIL=' .env | cut -d= -f2-)
ADMIN_PASSWORD=$(grep '^ADMIN_PASSWORD=' .env | cut -d= -f2-)
PASS=0; FAIL=0
ck() { # ck <descripcion> <esperado> <obtenido>
  if [ "$2" = "$3" ]; then echo "  OK   $1  ($3)"; PASS=$((PASS+1));
  else echo "  FALLA $1  esperado=$2 obtenido=$3"; FAIL=$((FAIL+1)); fi
}
req() { # req <jar> <metodo> <ruta> [body] -> imprime "HTTP\nbody"
  local jar=$1 m=$2 path=$3 body=${4:-}
  if [ -n "$body" ]; then
    curl -s -b "$jar" -c "$jar" -X "$m" "$API$path" -H 'Content-Type: application/json' -d "$body" -w '\n%{http_code}'
  else
    curl -s -b "$jar" -c "$jar" -X "$m" "$API$path" -w '\n%{http_code}'
  fi
}
code() { echo "$1" | tail -1; }
body() { echo "$1" | sed '$d'; }

rm -f $S/admin.jar $S/nuevo.jar $S/anon.jar

echo "== 1. Login y sesion =="
R=$(req $S/anon.jar POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"noesesta\"}")
ck "login con password mala -> 401" 401 "$(code "$R")"
ck "  code INVALID_CREDENTIALS" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"
R=$(req $S/anon.jar POST /auth/login "{\"email\":\"nadie@elite.local\",\"password\":\"loquesea1\"}")
ck "login con email inexistente -> 401" 401 "$(code "$R")"
ck "  mismo code (no revela cual fallo)" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"
R=$(req $S/anon.jar GET /users)
ck "GET /users sin sesion -> 401" 401 "$(code "$R")"

R=$(req $S/admin.jar POST /auth/login "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASSWORD\"}")
ck "login admin -> 200" 200 "$(code "$R")"
ck "  cookie httpOnly presente" 1 "$(grep -c 'elite_session\|token\|session' $S/admin.jar)"
echo "  permisos del admin: $(body "$R" | jq -c '.permissions')"
ADMIN_ID=$(body "$R" | jq -r '.user.id')

R=$(req $S/admin.jar GET /auth/me)
ck "GET /auth/me -> 200" 200 "$(code "$R")"
ADMIN_ROLE_ID=$(body "$R" | jq -r '.roles[0].id')
echo "  rol admin: $(body "$R" | jq -r '.roles[0].name') ($ADMIN_ROLE_ID)"

echo
echo "== 2. Crear rol con permisos a medida (RN-6b) =="
R=$(req $S/admin.jar POST /roles '{"name":"Recepcion E2E","description":"prueba e2e","permissionKeys":["users.read"]}')
ck "POST /roles -> 201" 201 "$(code "$R")"
ROLE_ID=$(body "$R" | jq -r '.id')
R=$(req $S/admin.jar POST /roles '{"name":"Rol Vacio E2E","permissionKeys":[]}')
ck "rol sin permisos se crea igual -> 201" 201 "$(code "$R")"
EMPTY_ROLE_ID=$(body "$R" | jq -r '.id')
R=$(req $S/admin.jar POST /roles '{"name":"Recepcion E2E","permissionKeys":[]}')
ck "nombre repetido -> 409" 409 "$(code "$R")"
ck "  code NAME_TAKEN" NAME_TAKEN "$(body "$R" | jq -r .code)"
R=$(req $S/admin.jar POST /roles '{"name":"Rol Invalido E2E","permissionKeys":["cosas.inventadas"]}')
ck "permiso inexistente -> 422" 422 "$(code "$R")"

echo
echo "== 3. Crear usuario con ese rol =="
R=$(req $S/admin.jar POST /users "{\"email\":\"recepcion.e2e@elite.local\",\"fullName\":\"Recepcion E2E\",\"password\":\"clave12345\",\"roleIds\":[\"$ROLE_ID\"]}")
ck "POST /users -> 201" 201 "$(code "$R")"
NEW_ID=$(body "$R" | jq -r '.id')
ck "  no devuelve passwordHash (RN-7)" 0 "$(body "$R" | grep -c passwordHash)"
R=$(req $S/admin.jar POST /users "{\"email\":\"recepcion.e2e@elite.local\",\"fullName\":\"Otro\",\"password\":\"clave12345\",\"roleIds\":[]}")
ck "email repetido -> 409" 409 "$(code "$R")"
ck "  code EMAIL_TAKEN" EMAIL_TAKEN "$(body "$R" | jq -r .code)"
R=$(req $S/admin.jar POST /users '{"email":"otro.e2e@elite.local","fullName":"Otro","password":"clave12345","roleIds":["00000000-0000-4000-8000-000000000000"]}')
ck "roleId inexistente -> 422" 422 "$(code "$R")"
ck "  code INVALID_ROLE" INVALID_ROLE "$(body "$R" | jq -r .code)"
echo "  details: $(body "$R" | jq -c '.details')"

echo
echo "== 4. Login del usuario nuevo: ve solo lo permitido =="
R=$(req $S/nuevo.jar POST /auth/login '{"email":"recepcion.e2e@elite.local","password":"clave12345"}')
ck "login usuario nuevo -> 200" 200 "$(code "$R")"
ck "  permisos = [users.read]" '["users.read"]' "$(body "$R" | jq -c '.permissions')"
R=$(req $S/nuevo.jar GET /users)
ck "GET /users con users.read -> 200" 200 "$(code "$R")"
R=$(req $S/nuevo.jar GET /roles)
ck "GET /roles sin roles.read -> 403" 403 "$(code "$R")"
ck "  code FORBIDDEN" FORBIDDEN "$(body "$R" | jq -r .code)"
R=$(req $S/nuevo.jar POST /users '{"email":"x.e2e@elite.local","fullName":"X","password":"clave12345","roleIds":[]}')
ck "POST /users sin users.manage -> 403" 403 "$(code "$R")"

echo
echo "== 5. RN-6b: permisos frescos sin volver a iniciar sesion =="
R=$(req $S/admin.jar PATCH /roles/$ROLE_ID '{"permissionKeys":["users.read","roles.read"]}')
ck "admin agrega roles.read al rol -> 200" 200 "$(code "$R")"
R=$(req $S/nuevo.jar GET /roles)
ck "MISMA sesion del usuario ya puede GET /roles -> 200" 200 "$(code "$R")"
R=$(req $S/nuevo.jar GET /auth/me)
ck "  /auth/me refleja los 2 permisos" '["roles.read","users.read"]' "$(body "$R" | jq -c '.permissions|sort')"
R=$(req $S/admin.jar PATCH /roles/$ROLE_ID '{"permissionKeys":["users.read"]}')
ck "admin quita roles.read -> 200" 200 "$(code "$R")"
R=$(req $S/nuevo.jar GET /roles)
ck "MISMA sesion vuelve a 403" 403 "$(code "$R")"

echo
echo "== 6. RN-6: rol en uso no se borra =="
R=$(req $S/admin.jar DELETE /roles/$ROLE_ID)
ck "DELETE rol con usuarios -> 409" 409 "$(code "$R")"
ck "  code ROLE_IN_USE" ROLE_IN_USE "$(body "$R" | jq -r .code)"
R=$(req $S/admin.jar DELETE /roles/$EMPTY_ROLE_ID)
ck "DELETE rol sin usuarios -> 204" 204 "$(code "$R")"

echo
echo "== 7. RN-5 anti-lockout, las dos puertas =="
R=$(req $S/admin.jar PATCH /users/$ADMIN_ID '{"roleIds":[]}')
ck "puerta (a) quitarse todos los roles -> 409" 409 "$(code "$R")"
ck "  code SELF_LOCKOUT" SELF_LOCKOUT "$(body "$R" | jq -r .code)"
R=$(req $S/admin.jar PATCH /users/$ADMIN_ID '{"isActive":false}')
ck "puerta (a) desactivarse a si mismo -> 409" 409 "$(code "$R")"
R=$(req $S/admin.jar PATCH /roles/$ADMIN_ROLE_ID '{"permissionKeys":["users.read","users.manage","roles.read"]}')
ck "puerta (b) quitar roles.manage a su propio rol -> 409" 409 "$(code "$R")"
ck "  code SELF_LOCKOUT" SELF_LOCKOUT "$(body "$R" | jq -r .code)"
R=$(req $S/admin.jar GET /auth/me)
ck "  nada cambio: admin sigue con roles.manage" true "$(body "$R" | jq -c '.permissions|index("roles.manage")!=null')"
ck "  admin sigue activo" true "$(body "$R" | jq -r '.user.isActive')"

echo
echo "== 8. RN-10: reemplazar password invalida sesiones vigentes =="
R=$(req $S/admin.jar PATCH /users/$NEW_ID '{"password":"nuevaclave123"}')
ck "admin reemplaza password del usuario -> 200" 200 "$(code "$R")"
R=$(req $S/nuevo.jar GET /auth/me)
ck "sesion vieja del usuario -> 401" 401 "$(code "$R")"
R=$(req $S/nuevo.jar POST /auth/login '{"email":"recepcion.e2e@elite.local","password":"nuevaclave123"}')
ck "login con la clave nueva -> 200" 200 "$(code "$R")"

echo
echo "== 9. RN-4: desactivar corta el acceso =="
R=$(req $S/admin.jar PATCH /users/$NEW_ID '{"isActive":false}')
ck "admin desactiva al usuario -> 200" 200 "$(code "$R")"
R=$(req $S/nuevo.jar GET /auth/me)
ck "sesion vigente del desactivado -> 401" 401 "$(code "$R")"
R=$(req $S/nuevo.jar POST /auth/login '{"email":"recepcion.e2e@elite.local","password":"nuevaclave123"}')
ck "login de usuario desactivado -> 401" 401 "$(code "$R")"
ck "  code INVALID_CREDENTIALS (no revela)" INVALID_CREDENTIALS "$(body "$R" | jq -r .code)"

echo
echo "== 10. Logout =="
R=$(req $S/admin.jar POST /auth/logout)
ck "POST /auth/logout -> 204" 204 "$(code "$R")"
R=$(req $S/admin.jar GET /users)
ck "request protegido despues del logout -> 401" 401 "$(code "$R")"

echo
echo "======================================"
echo "  PASARON: $PASS   FALLARON: $FAIL"
echo "======================================"
echo "IDS: admin=$ADMIN_ID rolAdmin=$ADMIN_ROLE_ID rolE2E=$ROLE_ID usuarioE2E=$NEW_ID"

# Limpieza: el rol y el usuario de prueba no deben quedar en la base.
if command -v docker >/dev/null 2>&1; then
  docker exec elite-service-postgres psql -U "${POSTGRES_USER:-elite}" -d "${POSTGRES_DB:-elite_service}" -q \
    -c 'delete from user_roles where "userId" in (select id from users where email like $$%e2e%$$); delete from users where email like $$%e2e%$$; delete from role_permissions where "roleId" in (select id from roles where name like $$%E2E%$$); delete from roles where name like $$%E2E%$$;' >/dev/null 2>&1 \
    && echo "Datos de prueba borrados." || echo "AVISO: no se pudieron borrar los datos de prueba (rol/usuario con sufijo E2E)."
fi

[ "$FAIL" -eq 0 ] || exit 1
