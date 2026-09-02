# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tres audiencias internas, todas autenticadas, con permisos distintos sobre los mismos datos:

- **Recepción (escritorio).** De pie o sentada en mostrador, con el cliente enfrente y el
  teléfono sonando. Registra vehículos, abre órdenes de trabajo, cobra. Trabaja con teclado,
  monitor grande y prisa: necesita densidad, tablas y formularios que se llenen sin pensar.
- **Mecánico (tablet o celular).** En la bahía, de pie, manos sucias, luz irregular, a veces con
  guantes. Consulta qué le toca, marca avances, anota hallazgos y repuestos usados. Pantalla
  chica, sesiones cortas, objetivos táctiles grandes y estados legibles de un vistazo.
- **Dueño / administrador (escritorio).** Revisa carga de trabajo, dinero y configuración. Crea
  roles y asigna permisos. Necesita resúmenes y pantallas de administración, no captura masiva.

No hay usuario cliente final: por ahora el sistema es 100% interno. Cualquier superficie pública
(portal del cliente, consulta de estado) es una decisión futura, no un hecho del producto.

## Product Purpose

Sistema de gestión para un taller mecánico: llevar el trabajo del taller desde que entra un
vehículo hasta que se factura, en un solo lugar, sustituyendo cuadernos y hojas de cálculo.
Éxito = el taller opera el día completo dentro del sistema sin registro paralelo en papel.

## Positioning

**Autorización por permiso, nunca por nombre de rol.** No existen roles fijos en el código; se
crean a demanda desde la administración y cada uno declara permisos `module.action`
(`users.read`, `roles.manage`). Un taller puede modelar su propia jerarquía —jefe de bahía,
cajero de fin de semana, aprendiz sin acceso a precios— sin tocar código ni pedir un release.
Esto obliga a que la UI sea _permission-aware_: toda pantalla, botón y acción existe o no según
los permisos del usuario, y ningún diseño puede asumir un organigrama fijo.

## Operating Context

- Un taller físico. Recepción con escritorio y mostrador; bahías con tablets o celulares
  personales. Iluminación mixta: luz de día fuerte en la bahía, interior en recepción.
- El trabajo se organiza alrededor de la **orden de trabajo**: entra un vehículo con un
  problema, se diagnostica, se aprueba, se ejecuta, se factura.
- Los módulos previstos (clientes, vehículos, órdenes de trabajo, inventario, facturación) aún
  **no están diseñados ni modelados**. No son verdad de producto todavía, son intención.
- Idioma de la interfaz: español. El código, los identificadores y los endpoints van en inglés.

## Capabilities and Constraints

- **Estado real.** Monorepo pnpm en pie (`apps/web` Next.js 15 App Router + Tailwind v4 +
  shadcn/ui new-york, `apps/api` NestJS, `packages/shared` contrato compartido), con PostgreSQL
  vía Prisma, auth por cookie httpOnly y RBAC dinámico por permisos. Los módulos de negocio
  vivos son los del lavado (`carwash`) y su catálogo.
- **SDD obligatorio.** Nada se implementa sin una spec aprobada en `specs/`. Hoy: `001-auth.md`
  y `002-design-system.md` terminadas, `003-carwash.md` aprobada y en implementación.
- Los errores del API viajan siempre como `{ code, message, details? }` (`ApiErrorResponse` de
  `@elite/shared`): la UI de error se diseña contra ese único formato.
- shadcn/ui es la base de componentes acordada; el sistema visual debe expresarse en sus tokens
  CSS (`--background`, `--primary`, …) y no en colores literales.
- **Sin decidir:** módulos de negocio, esquema de datos, multi-taller o taller único, si habrá
  uso offline en la bahía.

## Brand Commitments

- **Nombre:** Elite Service.
- **Logo:** marca automotriz existente — el wordmark ELITE en itálica con un arco de velocímetro
  y aguja, en rojo/naranja, sobre la palabra SERVICE. Es un compromiso de marca vinculante.
- **Claro y oscuro son ambos obligatorios**, no un extra: recepción trabaja en interior, la
  bahía a veces con luz directa. Ninguno de los dos es "el tema secundario".
- Las dos capturas de dashboard que aportó el usuario son **referencia de marca y de doble tema
  únicamente**. Su lenguaje de tablero automotriz (velocímetros, medidores, barras con brillo
  neón) queda explícitamente fuera: el usuario lo descartó por no corresponder a órdenes de
  trabajo, inventario y facturación.

## Evidence on Hand

- **No existe archivo de logo.** No hay SVG ni PNG en alta: solo imágenes generadas por IA que
  el usuario pegó como referencia. El logo real debe pedirse al taller antes de producción; lo
  que se use mientras tanto es una reconstrucción marcada como provisional.
- No hay datos reales de clientes, vehículos, órdenes ni precios. Todo dato mostrado en
  maquetas o ejemplos es sintético y debe rotularse como tal.
- No hay usuarios reales, métricas, testimonios ni benchmarks. No se inventan.
- Documentación de producto existente: `docs/ARCHITECTURE.md` (ADRs), `AGENTS.md` (raíz y por
  app), `apps/web/DESIGN.md`, las specs de `specs/` y `docs/PROPUESTA.md` (histórico).

## Product Principles

1. **La orden de trabajo es el centro.** Toda pantalla se justifica por cómo acerca o aleja a
   alguien de cerrar una orden.
2. **Los permisos son parte del diseño, no un filtro tardío.** Cada pantalla se diseña sabiendo
   que puede llegar recortada; nunca se muestra un control muerto ni un rol asumido.
3. **Dos contextos físicos, un solo sistema.** Mostrador con teclado y bahía con dedos sucios
   usan la misma información: cambia la densidad, no el vocabulario.
4. **Nada sin spec.** El diseño puede definir la línea completa, pero no adelanta módulos de
   negocio que ninguna spec aprobó.
5. **Español visible, inglés interno.** Todo texto que ve el usuario es español natural de
   taller, sin jerga de software.

## Accessibility & Inclusion

No hay un estándar formal comprometido todavía. Sí hay dos necesidades derivadas del contexto
físico y confirmadas por el usuario: uso táctil en la bahía (objetivos grandes, sin depender de
hover) y legibilidad bajo luz variable, que es la razón de que claro y oscuro sean ambos
obligatorios.
