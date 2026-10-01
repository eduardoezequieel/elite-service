# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Tres audiencias internas, todas autenticadas, con permisos distintos sobre los mismos datos:

- **Recepción (escritorio).** De pie o sentada en mostrador, con el cliente enfrente y el
  teléfono sonando. Registra vehículos, abre lavados, cobra. Trabaja con teclado,
  monitor grande y prisa: necesita densidad, tablas y formularios que se llenen sin pensar.
- **Personal de bahía (tablet o celular).** De pie, manos mojadas o sucias, luz irregular, a
  veces con guantes. Consulta qué lavados le tocan y marca avances. Pantalla chica, sesiones
  cortas, objetivos táctiles grandes y estados legibles de un vistazo.
- **Dueño / administrador (escritorio).** Revisa carga de trabajo, dinero y configuración. Crea
  roles y asigna permisos. Necesita resúmenes y pantallas de administración, no captura masiva.

No hay usuario cliente final: por ahora el sistema es 100% interno. Cualquier superficie pública
(portal del cliente, consulta de estado) es una decisión futura, no un hecho del producto.

## Product Purpose

Sistema de gestión para el lavado (carwash) de Elite Service: llevar cada lavado desde que
entra el vehículo hasta que se cobra, en un solo lugar, sustituyendo cuadernos y hojas de
cálculo. Éxito = el lavado opera el día completo dentro del sistema sin registro paralelo en
papel.

Desde la spec 094 el sistema atiende **dos negocios de la familia**: el lavado y la renta de carros
(Riveras Rent a Car), cada uno en su espacio de trabajo. Son empresas distintas: clientes, caja,
cuentas bancarias y reportes van **separados por negocio**; solo se comparten el login, los usuarios
y los roles.

El taller mecánico vive en **otro sistema**, fuera de este repo. Acá no se construyen órdenes de
taller, cotizaciones ni inventario de repuestos.

## Positioning

**Autorización por permiso, nunca por nombre de rol.** No existen roles fijos en el código; se
crean a demanda desde la administración y cada uno declara permisos `module.action`
(`users.read`, `roles.manage`). Un taller puede modelar su propia jerarquía —jefe de bahía,
cajero de fin de semana, aprendiz sin acceso a precios— sin tocar código ni pedir un release.
Esto obliga a que la UI sea _permission-aware_: toda pantalla, botón y acción existe o no según
los permisos del usuario, y ningún diseño puede asumir un organigrama fijo.

## Operating Context

- Un lavado físico. Recepción con escritorio y mostrador; bahías con tablets o celulares
  personales. Iluminación mixta: luz de día fuerte en la bahía, interior en recepción.
- El trabajo se organiza alrededor del **lavado**: entra un vehículo, se eligen los servicios,
  se lava, queda listo y se cobra. Hueco vs el legado en `docs/LEGACY_BUSINESS_LOGIC.md` §2.
- Idioma de la interfaz: español. El código, los identificadores y los endpoints van en inglés.

## Capabilities and Constraints

- **Estado real.** Monorepo pnpm en pie (`apps/web` Next.js 15 App Router + Tailwind v4 +
  shadcn/ui new-york, `apps/api` NestJS, `packages/shared` contrato compartido), con PostgreSQL
  vía Prisma, auth por cookie httpOnly y RBAC dinámico por permisos. Los módulos de negocio
  vivos son el lavado (`carwash`), su catálogo, clientes y vehículos.
- **SDD obligatorio.** Nada se implementa sin una spec aprobada en `specs/`. Hoy:
  `001-auth.md` a `008-back-navigation.md` terminadas (auth, sistema de diseño,
  carwash, clientes, rediseño visual, cambio de contraseña propia, tabla unificada
  y navegación de regreso).
- Los errores del API viajan siempre como `{ code, message, details? }` (`ApiErrorResponse` de
  `@elite/shared`): la UI de error se diseña contra ese único formato.
- shadcn/ui es la base de componentes acordada; el sistema visual debe expresarse en sus tokens
  CSS (`--background`, `--primary`, …) y no en colores literales.
- **Sin decidir:** una sede o varias, si habrá uso offline en la bahía.

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
- Lógica de negocio de los prototipos de los primos (taller Next.js + ERP HTML del lavado):
  `docs/LEGACY_BUSINESS_LOGIC.md`. No es spec; no autoriza implementar.

## Product Principles

1. **El lavado es el centro.** Toda pantalla se justifica por cómo acerca o aleja a alguien de
   cerrar un lavado.
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
