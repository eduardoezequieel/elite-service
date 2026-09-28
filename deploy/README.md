# Producción en el VPS

Cómo poner y mantener el sistema del lavado en el VPS de OVH (spec 093). Todo se hace por SSH
con cuatro scripts de esta carpeta. Render/Vercel siguen siendo el entorno de pruebas.

En los ejemplos, `203.0.113.10` es la IP de tu VPS y `ubuntu` tu usuario: cambialos por los tuyos.

## 1. Crear el lugar de los respaldos (Cloudflare R2)

Una sola vez, desde el navegador:

1. Entrá a [dash.cloudflare.com](https://dash.cloudflare.com) → **R2 Object Storage**. Si es la
   primera vez, activá R2 (pide tarjeta, pero el plan gratis alcanza de sobra).
2. **Create bucket** → nombre `elite-backups` (o el que quieras) → crear.
3. En la página de R2, a la derecha, copiá el **Account ID**. Va en `R2_ACCOUNT_ID`.
4. **Manage R2 API Tokens** → **Create API token**:
   - Permisos: **Object Read & Write**.
   - Alcance: **Apply to specific buckets only** → elegí `elite-backups`.
   - Crear. Copiá el **Access Key ID** y el **Secret Access Key** (el secreto se ve una sola
     vez). Van en `R2_ACCESS_KEY_ID` y `R2_SECRET_ACCESS_KEY`.

Guardá esos cuatro datos en tu gestor de contraseñas.

## 2. Primer arranque en el VPS

```bash
ssh ubuntu@203.0.113.10
git clone https://github.com/eduardoezequieel/elite-service.git
cd elite-service
sudo bash deploy/setup-vps.sh
exit
```

El `exit` es a propósito: hay que volver a entrar para que tu usuario pueda usar Docker.

Volvé a entrar y armá el archivo de secretos, copiando la sección de producción de `.env.example`:

```bash
ssh ubuntu@203.0.113.10
cd elite-service
sed -n '/^# Produccion en VPS/,$p' .env.example | grep -E '^# [A-Z0-9_]+=' | sed 's/^# //' > deploy/.env.production
chmod 600 deploy/.env.production
nano deploy/.env.production
```

Qué poner en cada línea:

- `DOMAIN`: la IP del VPS con guiones + `.sslip.io`. Para `203.0.113.10` es
  `203-0-113-10.sslip.io`. Esa será la dirección del sistema.
- `POSTGRES_PASSWORD`, `JWT_SECRET`, `PIN_PEPPER`: un valor distinto para cada uno, generado con
  `openssl rand -hex 32` (corrélo tres veces y pegá cada resultado).
- `ADMIN_EMAIL` y `ADMIN_PASSWORD`: tu usuario para entrar la primera vez.
- `R2_*`: los cuatro datos del paso 1.

Nada puede quedar con `change_me`: el deploy se niega a arrancar si ve uno. Guardá una copia de
este archivo en tu gestor de contraseñas; si se pierde `PIN_PEPPER`, hay que reasignar todos los
PINs de pista.

Publicá:

```bash
bash deploy/deploy.sh
```

La primera vez tarda (compila todo y pide el certificado HTTPS). Termina con
`Listo: https://203-0-113-10.sslip.io está arriba`. Entrá a esa dirección con `ADMIN_EMAIL` y
`ADMIN_PASSWORD`.

## 3. Actualizar a lo último de `main`

```bash
ssh ubuntu@203.0.113.10
cd elite-service
bash deploy/deploy.sh
```

Si al final dice `ERROR`, el sitio no respondió: el mismo script imprime los últimos logs.

## 4. Respaldos

Corren solos todos los días a las 03:00 (hora de El Salvador): quedan 14 días en el VPS y 30 en R2.

```bash
bash deploy/backup.sh               # respaldo ahora mismo
tail -n 30 /var/log/elite-backup.log # cómo salieron los últimos
bash deploy/restore.sh --list       # qué respaldos hay (VPS y R2)
```

Corré `bash deploy/backup.sh` una vez apenas termines el paso 2: si dice `Respaldo OK`, R2 quedó
bien configurado.

Para bajarte uno a tu computadora (desde tu computadora, no desde el VPS):

```bash
scp ubuntu@203.0.113.10:elite-service/deploy/backups/elite-20260928-030000.dump .
```

## 5. Restaurar

Borra lo que hay en la base y pone el respaldo. Antes guarda una copia de lo actual en
`deploy/backups/pre-restore-*.dump`, y pide escribir `RESTAURAR` para seguir.

```bash
bash deploy/restore.sh deploy/backups/elite-20260928-030000.dump  # uno del VPS
bash deploy/restore.sh r2:elite-20260928-030000.dump              # uno de R2
```

Mientras restaura, el sistema no responde (uno o dos minutos).

## 6. Pasar a un dominio propio

1. En tu proveedor de dominio, creá un registro **A** que apunte a la IP del VPS (por ejemplo
   `lavado.tudominio.com` → `203.0.113.10`) y esperá a que resuelva.
2. En `deploy/.env.production`, cambiá `DOMAIN=lavado.tudominio.com`.
3. `bash deploy/deploy.sh`. Caddy saca el certificado nuevo solo.

Las sesiones abiertas se pierden (la cookie era del nombre viejo): hay que volver a entrar.

## 7. Si algo falla

```bash
cd elite-service
docker compose --env-file deploy/.env.production -f deploy/compose.yml ps
docker compose --env-file deploy/.env.production -f deploy/compose.yml logs --tail 100 api
docker compose --env-file deploy/.env.production -f deploy/compose.yml logs --tail 100 caddy
```

- `api` reiniciándose: casi siempre un secreto mal copiado en `deploy/.env.production`.
- `caddy` con errores de certificado: revisá que `DOMAIN` tenga la IP correcta y que los puertos
  80 y 443 estén abiertos también en el panel de OVH (si activaste su firewall de red).

**Nunca** apagues con `down` más la opción de volúmenes (`-v`): borra la base entera. Para apagar
todo sin perder datos, `docker compose ... stop`.
