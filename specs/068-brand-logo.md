# 068 — Logo original del taller

**Estado:** Aprobada (por chat, 26 sept 2026)
**Módulo:** web | **Depende de:** 002, 067

## Task

El logo del sistema era una reconstrucción vectorial a la espera del archivo del taller. Llegó
(`logo_eliteService.png`, 1254 × 1254, fondo transparente): se recorta a su contorno, se guarda en
`components/brand/logo-elite-service.png` (640 px de ancho) y `Logo` pasa a servirlo con
`next/image`, con un solo prop `height`. Lo usan login de oficina y de pista, riel (desplegado y
plegado), encabezado de la pista, aviso de sesión y la referencia de diseño. Mientras se verifica la
sesión se muestra el `GaugeLoader`, que conserva el isotipo vectorial porque se anima.

## Done

- [x] Ninguna pantalla dibuja el logo reconstruido; todas usan `Logo`.
- [x] `alt="Elite Service"`; el login lo carga con `priority`.
- [x] Riel plegado (68 px) sin desborde.
- [x] `DESIGN.md` → Logo actualizado.

## Always

- La marca vive en un solo componente.

## Ask first

- Favicon e íconos de la app con el logo nuevo.

## Never

- Animar la imagen del logo o recolorearla con CSS.

## Verify

`pnpm lint && pnpm test && pnpm build`
