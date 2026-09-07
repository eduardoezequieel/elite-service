# 034 — Rediseño de permisos Master-Detail

**Estado:** Terminada
**Módulo:** web | **Depende de:** 001, 002, 005

## Task

1. Reemplazar la matriz rígida módulo × acción en `PermissionMatrix` por una vista Master-Detail (Propuesta B).
2. Columna izquierda (Master): lista de módulos con número de referencia (`#01`), nombre y badge contador (`X/Y`). Selección con clic y navegación por teclado.
3. Columna derecha (Detail): encabezado del módulo activo con acción «Marcar todo» / «Desmarcar todo» y lista de acciones reales de ese módulo con checkbox, etiqueta y descripción de negocio. Cero guiones (`—`) ni columnas vacías.
4. Soporte responsive y táctil: en pantallas angostas (`< md`), layout vertical fluido con select o acordeón/tabs sin scroll horizontal.
5. Mantener soporte `readOnly`: visualización accesible en texto plano cuando no se tiene permiso de edición.
6. Ajustar el ancho del diálogo en `role-form-dialog.tsx` a `md:max-w-3xl` o `md:max-w-4xl` para acomodar el panel dividido.

## Done

- [x] `PermissionMatrix` renderiza panel Master-Detail en pantallas de escritorio y tablet.
- [x] La columna izquierda lista los módulos con su referencia (`#01`), nombre y badge con contador de permisos concedidos vs totales.
- [x] La columna derecha muestra solo las acciones reales del módulo seleccionado, con nombre y descripción de negocio.
- [x] Botón de módulo para «Marcar todo» / «Desmarcar todo» funcional en el panel de detalle.
- [x] En pantallas angostas (`< md`), colapsa a vista apilada/acordeón sin desborde horizontal.
- [x] Modo `readOnly` mantenido sin casillas muertas.
- [x] `RoleFormDialog` ajusta su ancho para visualización ergonómica del Master-Detail.
- [x] `pnpm build && pnpm lint` pasan sin errores.

## Always

- Solo renderizar las acciones que realmente pertenecen a cada módulo; nunca generar columnas ficticias ni celdas con guiones (`—`).
- Respetar los tokens de `DESIGN.md` para fondos, líneas, tipografía, badges y radios.
- Mantener las áreas táctiles en densidad bahía (mínimo 44px de altura).

## Ask first

- ¿Ajustar el diálogo de edición de rol a `md:max-w-3xl` para que el panel Master-Detail respire mejor? (Sí, 768px da el ancho ideal para 260px lista + 500px detalle).

## Never

- Nunca forzar una tabla con scroll horizontal en un modal.
- Nunca mostrar casillas deshabilitadas o muertas si el usuario no tiene permisos (`readOnly`).

## Verify

`pnpm build && pnpm lint`
