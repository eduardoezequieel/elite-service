#!/usr/bin/env bash
# Prepara un Ubuntu 24.04 recién creado para correr la producción (spec 093).
# Uso: sudo bash deploy/setup-vps.sh   (desde tu usuario, no como root directo)
# Es idempotente: correrlo dos veces no duplica nada.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DEBIAN_FRONTEND=noninteractive

say() { printf '\n==> %s\n' "$*"; }
fail() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || fail "Corré este script con sudo: sudo bash deploy/setup-vps.sh"
RUN_USER="${SUDO_USER:-}"
[ -n "$RUN_USER" ] && [ "$RUN_USER" != "root" ] ||
  fail "Corrélo con sudo desde tu usuario (por ejemplo 'ubuntu'), no como root directo."

say "Actualizando paquetes"
apt-get update -y
apt-get install -y ca-certificates curl git ufw

# --- Docker Engine + Compose desde el repo oficial de Docker ---
if docker compose version >/dev/null 2>&1; then
  say "Docker y Compose ya están instalados"
else
  say "Instalando Docker Engine y el plugin de Compose"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  codename="$(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}")"
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" \
    >/etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi
systemctl enable --now docker

if id -nG "$RUN_USER" | tr ' ' '\n' | grep -qx docker; then
  say "$RUN_USER ya está en el grupo docker"
else
  say "Agregando $RUN_USER al grupo docker"
  usermod -aG docker "$RUN_USER"
fi

# --- Firewall: solo SSH, 80 y 443 ---
# Ojo: Docker escribe sus propias reglas de iptables y los puertos que publica un
# contenedor saltan ufw. No es problema acá: en deploy/compose.yml solo caddy
# publica (80/443); postgres, api y web no publican nada al host.
say "Configurando el firewall (22, 80, 443)"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

# --- Swap de 2 GB si hay menos de 4 GB de RAM y no hay swap activa ---
mem_kb="$(awk '/^MemTotal:/ {print $2}' /proc/meminfo)"
if [ "$mem_kb" -lt $((4 * 1024 * 1024)) ] && [ -z "$(swapon --show --noheadings)" ]; then
  say "Creando 2 GB de swap en /swapfile"
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
  fi
  swapon /swapfile
else
  say "Swap: no hace falta o ya existe"
fi
if [ -f /swapfile ] && ! grep -qE '^/swapfile[[:space:]]' /etc/fstab; then
  echo '/swapfile none swap sw 0 0' >>/etc/fstab
fi

# --- Actualizaciones de seguridad automáticas ---
say "Activando actualizaciones de seguridad automáticas"
apt-get install -y unattended-upgrades
cat >/etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now unattended-upgrades

# --- Hora de El Salvador (el cron del respaldo corre a las 03:00 de acá) ---
say "Poniendo la zona horaria America/El_Salvador"
timedatectl set-timezone America/El_Salvador

# --- Cron del respaldo diario ---
say "Instalando el respaldo diario (03:00)"
install -d -o "$RUN_USER" -g "$RUN_USER" "$ROOT/deploy/backups"
touch /var/log/elite-backup.log
chown "$RUN_USER":"$RUN_USER" /var/log/elite-backup.log
chmod 640 /var/log/elite-backup.log
cat >/etc/cron.d/elite-backup <<EOF
# Respaldo diario de la base (spec 093). Lo instala deploy/setup-vps.sh.
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
0 3 * * * ${RUN_USER} bash ${ROOT}/deploy/backup.sh >>/var/log/elite-backup.log 2>&1
EOF
chmod 644 /etc/cron.d/elite-backup
# cron lee la zona horaria al arrancar
systemctl restart cron

say "Listo."
cat <<EOF

IMPORTANTE: cerrá la sesión SSH y volvé a entrar para que '$RUN_USER' pueda usar
docker sin sudo. Después seguí con deploy/README.md (paso 2: el archivo de secretos).
EOF
