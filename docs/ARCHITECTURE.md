# Elite Service — Decisiones de arquitectura

> ADRs ligeros: contexto, decisión y consecuencias. Una decisión por sección.
> Formato: aceptada salvo que se indique lo contrario. Si una decisión cambia, se agrega un
> ADR nuevo que la supersede — no se reescribe el anterior.

---

## ADR-001 — Monorepo con pnpm workspaces

**Contexto.** El frontend (Next.js) y el backend (NestJS) comparten tipos de DTOs, schemas de
validación y claves de permisos. En repositorios separados esos contratos se duplican y se
desincronizan; publicar un paquete versionado a un registry es demasiada ceremonia para un
equipo de este tamaño.

**Decisión.** Un solo repositorio con `pnpm workspaces`: `apps/web`, `apps/api` y
`packages/shared`. Configuración transversal única en la raíz (`tsconfig.base.json`,
`eslint.config.mjs`, `.prettierrc`). `pnpm -r build` respeta el orden topológico, así que
`@elite/shared` se compila antes que las apps.

**Consecuencias.** Un cambio de contrato se hace en un solo commit y rompe la compilación de
inmediato si algo queda inconsistente. A cambio, las apps dependen de `packages/shared/dist`:
hay que correr `pnpm build` una vez antes del primer `pnpm dev`. La raíz queda como territorio
compartido: cambiar configuración global afecta a todos los paquetes.

---

## ADR-002 — Clean architecture pragmática en el backend

**Contexto.** El taller tiene reglas de negocio propias (órdenes de trabajo, inventario,
facturación) que deben poder testearse sin base de datos y sobrevivir a un cambio de ORM. Una
clean architecture completa (con capas de mapeo en cada frontera) sería excesiva para el
tamaño del proyecto.

**Decisión.** Cada módulo de NestJS se organiza en cuatro capas:
`domain/` (entidades y reglas puras, sin NestJS ni ORM), `application/` (casos de uso y puertos
en `application/ports/`), `infrastructure/` (implementaciones concretas: ORM, servicios
externos) y `presentation/` (controllers y DTOs). La **regla de dependencia** es
`presentation → application → domain`; `infrastructure` implementa los puertos de
`application`; el dominio no importa nada de afuera. Sin capas de mapeo obligatorias donde no
aportan valor.

**Consecuencias.** Los casos de uso reciben repositorios por interfaz, así que los tests
inyectan implementaciones en memoria (`InMemoryUserRepository`) y corren sin Postgres. El costo
es más archivos por módulo y la disciplina de no importar el ORM desde el dominio; esa regla se
verifica en revisión de código.

---

## ADR-003 — RBAC dinámico por permisos

**Contexto.** El taller necesita ajustar quién puede hacer qué sin esperar un despliegue.
Roles fijos en el código (`admin`, `recepcion`, `mecanico`) obligan a tocar y desplegar el
backend cada vez que cambia la organización.

**Decisión.** Los roles se crean a demanda desde la administración. La unidad de autorización
es el **permiso** `module.action` (`users.read`, `roles.manage`). Un rol agrupa permisos, un
usuario tiene uno o más roles. El backend autoriza siempre por permiso en guards, **nunca por
nombre de rol**; el frontend muestra u oculta pantallas y acciones con los permisos del usuario.
Lo único sembrado es un usuario administrador inicial con un rol que agrupa todos los permisos.

**Consecuencias.** Agregar un módulo implica agregar sus claves de permiso al catálogo
compartido y asignarlas a los roles existentes. Un `if (user.role === 'admin')` es un bug, no
un atajo. El catálogo de permisos vive en `@elite/shared` para que front y back usen las mismas
claves. El diseño de datos concreto se define en la spec 001 (auth + RBAC), no aquí.

---

## ADR-004 — Todo el código en inglés

**Contexto.** Mezclar español e inglés en identificadores produce híbridos ilegibles
(`getClienteById`, `orden_de_trabajo_id`) y rompe las convenciones de las librerías del stack,
que son en inglés.

**Decisión.** Todo el código es en inglés sin excepción: variables, funciones, clases, enums,
tablas, columnas, endpoints, claves de permiso y nombres de archivo. El español se usa solo en
el texto visible al usuario, los mensajes de commit y la documentación (incluidos los
`AGENTS.md` y las specs).

**Consecuencias.** La traducción se concentra en la capa de presentación del frontend, lo que
deja el camino abierto a i18n si alguna vez hace falta. Los mensajes de error del API viajan
como códigos estables en inglés (`ApiErrorResponse.code`) y el frontend decide cómo mostrarlos.

---

## ADR-005 — Zod compartido como fuente única de validación

**Contexto.** La misma regla de validación se necesita en el formulario del frontend y en el
DTO del backend. Escribirla dos veces garantiza que en algún momento diverjan.

**Decisión.** Los schemas de validación se escriben una sola vez con **Zod v4** en
`@elite/shared`. El tipo TypeScript se deriva del schema con `z.infer`, nunca al revés. El
backend valida los DTOs de entrada con esos schemas; el frontend los usa en react-hook-form.
`@elite/shared` no depende de Next ni de NestJS: solo TypeScript y Zod.

**Consecuencias.** Una regla de validación cambia en un solo lugar y ambos lados quedan
alineados en el mismo commit. Zod pasa a ser una dependencia de runtime compartida, así que su
versión se sube de forma coordinada. Los errores de validación se serializan en `details` del
formato único de error `{ code, message, details? }`.


---

## ADR-006 — `next-themes` para el conmutador de tema

**Contexto.** `apps/web/DESIGN.md` define el modo claro como la página impresa del catálogo y el
modo oscuro como la microficha: los dos son de primera clase, no hay uno principal y otro
secundario. Eso obliga a tres cosas a la vez: seguir `prefers-color-scheme` cuando el usuario no
eligió nada, persistir la elección explícita entre recargas, y aplicar la clase `.dark` **antes de
la primera pintura**. En Next.js con App Router, el HTML se sirve desde el servidor sin saber qué
guardó el navegador, así que sin un script bloqueante en el `<head>` la página se pinta en claro y
salta a oscuro — el parpadeo que la spec 002 prohíbe explícitamente.

**Decisión.** Se agrega la dependencia **`next-themes`** en `apps/web` y se monta su proveedor en
el layout raíz junto a los `Providers` existentes, con los tres estados `system | light | dark`. Él
inyecta el script bloqueante, escribe la clase `.dark` en el elemento raíz, persiste la elección en
`localStorage` y se sincroniza con `prefers-color-scheme` cuando el modo es `system`.

**Alternativa descartada:** implementación propia sobre `localStorage`. Es poco código, pero
obliga a mantener a mano el script anti-parpadeo inyectado en el `<head>`, más la escucha del
`matchMedia` y la sincronización entre pestañas; es exactamente el problema resuelto que no aporta
nada propio del taller.

**Consecuencias.** El árbol de React queda con un proveedor más y el layout raíz necesita
`suppressHydrationWarning`, porque el atributo del tema lo escribe el script antes de que React
hidrate. A cambio, ningún componente decide el tema: todos leen tokens que ya están resueltos, lo
que sostiene la regla de que todo color existe en `:root` y `.dark` solo redefine valores. Es la
única dependencia de UI que esta spec agrega fuera de shadcn/ui.

---

## ADR-007 — Tipografías: Atkinson Hyperlegible con `next/font/google`

**Contexto.** El producto es denso por diseño: la tabla de órdenes se lee a 13px y el mostrador
quiere ver quince filas de un vistazo. La familia tipográfica no es decoración, es la que decide si
esa tabla se puede leer. Además, `DESIGN.md` cierra el terreno: en *La Regla de la Fuente
Prohibida* descarta de antemano Inter, DM Sans, Space Grotesk, IBM Plex, Poppins, Outfit y Plus
Jakarta Sans, por ser las familias que producen el panel de administración genérico que este
sistema rechaza.

**Decisión.** Dos familias, cargadas con **`next/font/google`** desde `src/app/layout.tsx` y
expuestas como variables CSS enlazadas en `@theme inline`:

- **Atkinson Hyperlegible Next** (variable, pesos 200–800) para cuerpo e interfaz. La dibujó el
  Braille Institute con un objetivo explícito: que las letras que se confunden entre sí no se
  confundan. Ese es el problema real de la bahía —mala luz, mirada de reojo, pantalla sucia— y
  también el de una tabla a 13px.
- **Atkinson Hyperlegible Mono** **solo** para cadenas de máquina: VIN, número de parte, folio de
  factura y código de error. No es la fuente de "lo técnico" en general; es la de lo que se
  transcribe carácter por carácter. Al ser de la misma familia, esas cadenas hablan con la misma
  voz que el resto de la interfaz en vez de sonar como un injerto.

**Consecuencias.** `next/font/google` descarga y autoaloja las fuentes en tiempo de build, así que
no hay petición a un dominio externo en runtime ni salto de layout al cargarlas. Las dos familias
viajan en el bundle, lo que fija un costo de peso que se acepta a cambio de la legibilidad en
densidad. Next no trae métricas de respaldo para esta familia, así que ambas se cargan con
`adjustFontFallback: false` y una lista de respaldo declarada a mano. La lista de fuentes
prohibidas queda como regla viva: si Atkinson no resuelve un caso, se rediseña el caso — no se
agrega una tercera familia.

**Historial.** La primera implementación usó **Archivo** y **JetBrains Mono**. El usuario las
rechazó al ver el sistema construido, y el reemplazo se eligió por una razón de producto —la
legibilidad bajo malas condiciones de la bahía— y no por gusto.

---

## ADR-008 — Prisma 7 con adaptador de driver

**Contexto.** La spec 001 introduce la persistencia, y con ella la primera decisión de ORM. En
Prisma 7 cambió de lugar algo básico: la URL de la base **ya no vive en `schema.prisma`**. El
bloque `datasource` declara únicamente el `provider`; la URL la consumen dos caminos distintos —
el CLI de migraciones por un lado y el cliente en runtime por el otro— y cada uno hay que
alimentarlo aparte.

**Decisión.** Se adopta **Prisma 7** con adaptador de driver. Las migraciones, el seed y Studio
leen la URL de **`apps/api/prisma.config.ts`**; el `PrismaClient` la recibe en runtime a través de
**`@prisma/adapter-pg`** (`PrismaPg`), construido en `common/prisma/prisma.service.ts` con
`DATABASE_URL` leída por `ConfigService`.

**Alternativa descartada:** quedarse en Prisma 6, que todavía aceptaba la URL dentro del esquema y
habría evitado por completo este cableado. Se descarta por ser la versión anterior: se entra al
proyecto con la línea vigente, no con la que ya quedó atrás.

**Consecuencias.** `prisma.config.ts` carga a mano el `.env` con `dotenv`
(`path.resolve(__dirname, '../../.env')`), porque el `.env` canónico del monorepo está en la raíz
y no en `apps/api`: el CLI de Prisma no lo encontraría solo. Aparecen dos dependencias más (`pg` y
`@prisma/adapter-pg`) y un punto único donde se arma la conexión. A cambio, la URL deja de estar
duplicada en un archivo versionado y la regla de leer configuración sólo con `ConfigService` se
sostiene también para la base.

**Nota de instalación.** pnpm bloquea por defecto los scripts de instalación de las dependencias,
y sin ellos el CLI de Prisma no corre: no baja su motor de consultas. Por eso `pnpm-workspace.yaml`
habilita explícitamente `prisma`, `@prisma/engines` y `esbuild` en `allowBuilds`. Es una lista de
excepciones, no una puerta abierta: se agrega un paquete sólo cuando se comprueba que sin su script
no funciona.

---

## ADR-009 — `bcryptjs` en vez de `bcrypt`

**Contexto.** RN-7 fija bcrypt con factor de costo 12 para las contraseñas. La implementación
habitual en Node es `bcrypt`, un módulo nativo: exige compilación con node-gyp al instalar, que en
Windows —la máquina de desarrollo de este proyecto— falla con frecuencia por herramientas de build
ausentes o desalineadas.

**Decisión.** Se usa **`bcryptjs`**, JavaScript puro y sin compilación nativa. Es el mismo
algoritmo bcrypt y el mismo factor 12 (`BCRYPT_COST_FACTOR` en
`auth/infrastructure/bcrypt-password-hasher.ts`, y el mismo valor en `prisma/seed.ts`), así que los
hashes son intercambiables con los de `bcrypt`.

**Consecuencias.** `pnpm install` deja de depender del toolchain nativo de cada máquina. El costo
es que `bcryptjs` hashea y verifica más lento que el binding nativo; para el volumen del taller
—decenas de usuarios, un login por jornada— no se nota. Si alguna vez el login pasara a ser un
cuello de botella, cambiar a `bcrypt` es reemplazar la implementación del puerto `PasswordHasher`
sin tocar los casos de uso.

---

## ADR-010 — JWT propio con `@nestjs/jwt` y cookie httpOnly, sin Passport

**Contexto.** La sesión del sistema es **una sola estrategia**: correo y contraseña contra la base
propia. No hay OAuth, ni SSO, ni proveedores externos, ni previsión de agregarlos en v1. Passport
es la opción por defecto en NestJS, pero su valor está en abstraer muchas estrategias detrás de una
interfaz común; con una sola, agrega capas (estrategia, guard de Passport, serialización) sin
resolver nada.

**Decisión.** Autenticación propia con **`@nestjs/jwt`** y sin Passport. El token se firma con
`JWT_SECRET`, dura **8 horas** (una jornada laboral) y viaja en una cookie **`httpOnly` +
`SameSite=Lax`** (`secure` sólo en producción, porque en desarrollo el API no corre sobre HTTPS).
El JWT lleva **únicamente `sub`, `iat` y `exp`**: los permisos **no viajan firmados**. `JwtAuthGuard`
verifica el token y resuelve contra la base el usuario con sus roles y sus permisos efectivos;
`PermissionsGuard` los compara con lo que exige `@RequirePermissions`. Ambos se registran como
guards globales en `app.module.ts`, y lo público se marca con `@Public()`.

**Alternativa descartada:** `@nestjs/passport` con `passport-jwt`. Es el camino trillado y estaría
justificado el día que entre un segundo proveedor de identidad; hoy sería una indirección más entre
la cookie y el usuario del request.

**Consecuencias.** Resolver los permisos en cada request es exactamente lo que hace posible
**RN-6b**: cambiar los permisos de un rol aplica a todos sus usuarios en su siguiente request, sin
volver a iniciar sesión; y por el mismo camino se verifican `isActive` (RN-4) y `passwordChangedAt`
contra el `iat` del token (RN-10), de modo que desactivar a alguien o reemplazarle la contraseña
corta sus sesiones abiertas. El precio es una consulta de usuario + roles + permisos por request
autenticado, declarado y aceptado en **RN-6c** de la spec 001, sin caché en v1. Si algún día se
cachea, la invalidación tiene que ser inmediata o esas tres reglas se rompen a la vez. Que el token
sea mínimo también implica que no hay revocación por lista negra: la sesión se corta por los
chequeos contra la base, no por invalidar el JWT.
