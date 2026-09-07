# 011 — Entorno remoto de desarrollo (Vercel + Render + Neon)

**Estado:** Borrador
**Módulo:** infra | **Depende de:** stack actual (specs 001–010)

## Task

Dejar el repo listo para un entorno remoto de **desarrollo** (no el taller en producción):
web en Vercel, API en Render (plan free), Postgres en Neon. El browser sigue pegando a
`/api` (same-origin); Vercel reescribe a Render con `API_UPSTREAM`. Las cookies no cambian.

## Done

- [ ] `vercel.json` en la raíz: pnpm, Node 22, build de `@elite/shared` y después `@elite/web`.
- [ ] `render.yaml` en la raíz: servicio web free, health `/api/health`, migrate+seed al arrancar.
- [ ] Nest escucha `PORT` (Render) con fallback a `API_PORT` y 3200.
- [ ] `.env.example` documenta `API_UPSTREAM`, `PORT`, `WEB_ORIGIN` y el uso de la URL **directa** de Neon (no el pooler).
- [ ] AGENTS.md raíz, web y api dicen cómo se despliega y qué variables van en cada dashboard.
- [ ] `scripts/verify-011.sh` comprueba los archivos, el bind de `PORT` y que no haya secretos.

## Always

- Browser same-origin `/api`. En Vercel **no** se setea `NEXT_PUBLIC_API_URL`.
- Secretos solo en los dashboards (Neon/Render/Vercel). Distintos a los del `.env` local.
- `prisma migrate deploy` + seed idempotente en el start de Render. Nunca `migrate dev` remoto.
- `DATABASE_URL` = connection string **directa** de Neon (`sslmode=require`), no la del pooler.
- Cookie sigue `httpOnly` + `SameSite=Lax` + `secure` en `NODE_ENV=production`.

## Ask first

- Nada: el destino (Vercel/Render/Neon) ya lo eligió el usuario.

## Never

- No Dockerfiles (Render corre Node nativo sobre el monorepo).
- No `SameSite=None` ni cookie `Domain`.
- No URL de Neon con `-pooler`.
- No secretos, JWT ni passwords reales en el repo.
- No tratar este entorno como producción del taller: el API free se duerme a los 15 min.

## Verify

```bash
bash scripts/verify-011.sh
```
