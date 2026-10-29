#!/usr/bin/env bash
# Crea o actualiza el usuario de solo lectura para DBeaver (spec 130).
# Uso, en el VPS: bash deploy/readonly-user.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
ENV_FILE="deploy/.env.production"

fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# Lee KEY=valor del archivo de secretos sin ejecutarlo (quita comillas y \r).
env_get() {
  local v
  v="$(grep -E "^[[:space:]]*$1=" "$ENV_FILE" | tail -n 1 || true)"
  v="${v#*=}"
  v="${v%$'\r'}"
  v="${v%\"}"; v="${v#\"}"
  v="${v%\'}"; v="${v#\'}"
  printf '%s' "$v"
}

sql_quote() {
  local v="$1"
  v="${v//\'/\'\'}"
  printf "'%s'" "$v"
}

[ -f "$ENV_FILE" ] || fail "No existe $ENV_FILE."

RO_USER="$(env_get POSTGRES_READONLY_USER)"
RO_PASS="$(env_get POSTGRES_READONLY_PASSWORD)"
DB="$(env_get POSTGRES_DB)"
APP_USER="$(env_get POSTGRES_USER)"

[ -n "$RO_USER" ] || RO_USER=elite_ro
[ -n "$RO_PASS" ] || fail "Falta POSTGRES_READONLY_PASSWORD en $ENV_FILE."
[ -n "$DB" ] || fail "Falta POSTGRES_DB en $ENV_FILE."
[ -n "$APP_USER" ] || fail "Falta POSTGRES_USER en $ENV_FILE."
[[ "$RO_PASS" == change_me* ]] && fail "POSTGRES_READONLY_PASSWORD sigue siendo el valor de ejemplo."
[[ "$RO_USER" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || fail "POSTGRES_READONLY_USER inválido."
[[ "$APP_USER" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || fail "POSTGRES_USER inválido."
[[ "$DB" =~ ^[a-z_][a-z0-9_]{0,62}$ ]] || fail "POSTGRES_DB inválido."
[ "$RO_USER" != "$APP_USER" ] || fail "El usuario de lectura no puede ser el de la app."

dc() { docker compose -p elite --env-file "$ENV_FILE" -f deploy/compose.yml "$@"; }

# Identificadores ya validados. La contraseña entra entre comillas, no como identificador.
quoted_pass="$(sql_quote "$RO_PASS")"

dc exec -T postgres sh -c 'psql -v ON_ERROR_STOP=1 -q -U "$POSTGRES_USER" -d "$POSTGRES_DB"' <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${RO_USER}') THEN
    EXECUTE format(
      'CREATE ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
      '${RO_USER}',
      ${quoted_pass}
    );
  ELSE
    EXECUTE format(
      'ALTER ROLE %I WITH LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
      '${RO_USER}',
      ${quoted_pass}
    );
  END IF;
END
\$\$;
REVOKE pg_read_all_data FROM ${RO_USER};
REVOKE pg_write_all_data FROM ${RO_USER};
GRANT USAGE ON SCHEMA public TO ${RO_USER};
GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${RO_USER};
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM ${RO_USER};
DO \$\$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'm'
  LOOP
    EXECUTE format('GRANT SELECT ON TABLE public.%I TO ${RO_USER}', r.relname);
  END LOOP;
END
\$\$;
ALTER DEFAULT PRIVILEGES FOR ROLE ${APP_USER} IN SCHEMA public
  GRANT SELECT ON TABLES TO ${RO_USER};
GRANT CONNECT ON DATABASE ${DB} TO ${RO_USER};
SQL

# TCP, no el socket local: el socket confía en cualquiera y no prueba la contraseña.
dc exec -T -e PGPASSWORD="$RO_PASS" postgres \
  psql -h 127.0.0.1 -U "$RO_USER" -d "$DB" -v ON_ERROR_STOP=1 -q -c \
  "DO \$\$
   DECLARE r name;
   BEGIN
     SELECT c.relname INTO r
     FROM pg_class c
     JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v')
     LIMIT 1;
     IF r IS NULL THEN
       RAISE EXCEPTION 'no hay tablas en public';
     END IF;
     EXECUTE format('SELECT 1 FROM public.%I LIMIT 1', r);
   END
   \$\$;" >/dev/null

set +e
write_out="$(dc exec -T -e PGPASSWORD="$RO_PASS" postgres \
  psql -h 127.0.0.1 -U "$RO_USER" -d "$DB" -c \
  'CREATE TABLE public._ro_should_fail(id int)' 2>&1)"
write_status=$?
auth_out="$(dc exec -T -e PGPASSWORD="$RO_PASS" postgres \
  psql -h 127.0.0.1 -U "$RO_USER" -d "$DB" -c \
  'SELECT rolpassword FROM pg_authid LIMIT 1' 2>&1)"
auth_status=$?
set -e

[ "$write_status" -ne 0 ] || fail "elite_ro pudo crear una tabla."
printf '%s\n' "$write_out" | grep -Eq 'permission denied|permiso denegado' ||
  fail "CREATE TABLE no devolvió permission denied."
[ "$auth_status" -ne 0 ] || fail "elite_ro pudo leer pg_authid."
printf '%s\n' "$auth_out" | grep -Eq 'permission denied|permiso denegado' ||
  fail "pg_authid no devolvió permission denied."

printf 'elite_ro listo: SELECT ok, CREATE y pg_authid denegados.\n'
