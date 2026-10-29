# 130 — Usuario de solo lectura para DBeaver

**Estado:** Aprobada
**Módulo:** infra | **Depende de:** 093

## Task

Postgres de producción escucha solo en `127.0.0.1:5432` del VPS. El rol `elite_ro` puede leer el schema `public` y nada más. DBeaver entra por túnel SSH con la llave que ya existe.

## Done

- [ ] `deploy/compose.yml` publica `127.0.0.1:5432:5432`
- [ ] `deploy/readonly-user.sh` crea o actualiza `elite_ro` con `SELECT` en `public` y en las tablas futuras del usuario de la app
- [ ] El script comprueba que un `SELECT` funciona, que `CREATE TABLE` no, y que `pg_authid` no se lee
- [ ] `deploy/README.md` y `.env.example` documentan el túnel, sin la contraseña
- [ ] En el VPS el rol existe, `ss` muestra solo `127.0.0.1:5432` y `/api/health` responde 200

## Always

- La contraseña vive solo en `deploy/.env.production` del VPS.
- El bind lleva `127.0.0.1`. Sin esa IP, Docker salta ufw y el puerto queda en internet.
- El rol no es superuser y no tiene `INSERT`, `UPDATE`, `DELETE` ni `CREATE` en `public`.

## Ask first

- Borrar el rol, rotar la contraseña o cambiar el puerto.
- Entrar al VPS para otra cosa que no sea este usuario y este puerto.

## Never

- Publicar `5432:5432` en todas las interfaces.
- `docker compose down -v`, `prisma migrate dev` o `db push` en el VPS.
- Poner la contraseña en el repo, la spec o el README.

## Verify

En el VPS, con el `compose.yml` ya actualizado:

```bash
bash deploy/readonly-user.sh
ss -ltn | grep 5432
curl -fsS -o /dev/null -w '%{http_code}\n' https://148-113-255-27.sslip.io/api/health
```

El script termina en 0. `ss` muestra `127.0.0.1:5432` y no `0.0.0.0:5432`. Health responde 200.
