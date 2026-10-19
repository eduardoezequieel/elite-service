#!/bin/sh
# Starts the public dev stack. process-compose is not on PATH on this Mac:
# tutoria keeps its own binary at ../tutoria/local/bin/process-compose.
set -e
root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
cd "$root"

if command -v process-compose >/dev/null 2>&1; then
  exe=$(command -v process-compose)
elif [ -x "$root/../tutoria/local/bin/process-compose" ]; then
  exe="$root/../tutoria/local/bin/process-compose"
else
  echo "No está process-compose en el PATH ni en ../tutoria/local/bin/process-compose" >&2
  exit 1
fi

# Tutoria already listens on 8080. This instance needs its own port.
exec "$exe" --port 8091 -f process-compose.public.yaml up
