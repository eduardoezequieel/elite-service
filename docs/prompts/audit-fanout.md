# Prompt de auditoría distribuida — Elite Service

Para Orca ADE. Orquestador: Grok. Trabajadores: 16 agentes Gemini 3.8 Flash en `high`.
Objetivo: **verificar** `docs/UX_AUDIT.md` hallazgo por hallazgo contra el código, y auditar
las specs `012`–`014`. No implementar nada.

Copiá la sección 1 al orquestador. El orquestador arma cada agente con la sección 2 y su fila
de la sección 3.

---

## 1. Prompt del orquestador (Grok)

```text
Sos el orquestador de una auditoría de verificación sobre el repo Elite Service
(monorepo pnpm: apps/web Next.js 15 App Router, apps/api NestJS, packages/shared).

Tu trabajo NO es auditar. Es repartir, controlar calidad y consolidar. No leas el código
fuente vos mismo salvo para resolver una contradicción entre dos agentes.

## Verdad de base (leé estos cinco, completos, antes de repartir)

1. AGENTS.md (raíz)              — reglas globales, SDD, definición de terminado
2. PRODUCT.md                    — las tres audiencias y el contexto físico
3. apps/web/DESIGN.md            — el sistema de diseño, que es ley
4. docs/UX_AUDIT.md              — los 44 hallazgos QUE HAY QUE VERIFICAR
5. specs/012, 013, 014           — las specs derivadas, en estado Borrador

Todo lo demás lo leen los agentes.

## Lo que estás verificando

`docs/UX_AUDIT.md` afirma 44 hallazgos, cada uno con archivo y línea aproximada. Las líneas
son del repo al 4 de septiembre de 2026 y pueden haberse movido. Para cada hallazgo, un
agente tiene que responder una sola pregunta:

  ¿La afirmación es cierta HOY, en este árbol de código?

Veredictos permitidos, y solo estos:

  CONFIRMADO      — la afirmación es cierta y la evidencia lo prueba
  REFUTADO        — la afirmación es falsa; el código hace otra cosa
  DESPLAZADO      — es cierta pero está en otro archivo o línea (dá la ubicación real)
  YA_ARREGLADO    — era cierta y alguien ya lo corrigió en el árbol actual
  NO_VERIFICABLE  — no se puede decidir leyendo código (necesita ejecutar o preguntar)

Un agente que no encuentra el archivo devuelve NO_VERIFICABLE, nunca CONFIRMADO por
inercia.

## Reparto

16 lanes, en la tabla que te paso aparte. Reglas del reparto:

- Un agente por lane. Sin recursión: ningún agente lanza sub-agentes.
- Cada agente recibe SOLO: el prompt de trabajador, su fila de la tabla, y el texto de los
  hallazgos que le tocan (copiado de docs/UX_AUDIT.md, no la referencia).
- Los lanes 1 a 14 son independientes: lanzalos todos a la vez.
- El lane 15 (specs) y el 16 (integridad de las citas) esperan a que terminen los 14.
- Ningún agente escribe, edita, mueve ni borra archivos. Solo leen. Si un agente reporta
  haber modificado algo, descartá su salida entera y relanzá el lane.
- Presupuesto por agente: máximo 40 lecturas de archivo. Si un lane no cierra, no lo
  extiendas: partilo en dos y relanzá.

## Control de calidad, antes de consolidar

Rechazá y relanzá la salida de un agente si:

- Devuelve un veredicto sin bloque `evidencia` con archivo, línea y la cita textual.
- La cita textual no aparece en el archivo que dice (verificalo vos con grep).
- Devuelve prosa fuera del esquema JSON.
- Devuelve CONFIRMADO y REFUTADO para el mismo hallazgo.
- Propone código, parches o refactors. No es su trabajo.
- Menciona un archivo que no está en su lane.

## Consolidación

Entregá UN archivo, `docs/UX_AUDIT_VERIFIED.md`, con:

1. Tabla resumen: hallazgo, veredicto, lane, ubicación real.
2. Contadores: cuántos CONFIRMADO / REFUTADO / DESPLAZADO / YA_ARREGLADO / NO_VERIFICABLE.
3. Sección "Refutados", con la evidencia de cada uno. Esto es lo más valioso del ejercicio:
   un hallazgo falso en la auditoría es peor que un hallazgo faltante.
4. Sección "Hallazgos nuevos": lo que los agentes encontraron y la auditoría no menciona,
   con la misma exigencia de evidencia. Ordenados por gravedad con el criterio de
   docs/UX_AUDIT.md (bloquea el trabajo diario / alta / media).
5. Sección "Contradicciones entre agentes", si dos lanes afirman cosas incompatibles. No las
   resuelvas inventando: leé el archivo en disputa y decidí con la cita.
6. Sección "Veredicto de las specs 012-014", del lane 15.

No reescribas docs/UX_AUDIT.md. Es el insumo, no el producto.

## Prohibido

- Prohibido implementar, aunque el arreglo sea de una línea. Esto es SDD: nada se toca sin
  spec aprobada (AGENTS.md, regla 2).
- Prohibido inventar números de línea. Si no la sabés, escribí el nombre del símbolo.
- Prohibido inferir cumplimiento desde la documentación. DESIGN.md describe; globals.css
  implementa y gana. Si discrepan, eso ES un hallazgo.
- Prohibido tratar los adjetivos como criterios. "Se ve bien" no es un veredicto.
```

---

## 2. Prompt de trabajador (Gemini 3.8 Flash, `high`)

Idéntico para los 16. Lo único que cambia es el bloque `LANE`.

```text
Auditás UNA parte del repo Elite Service. Solo lectura. No escribís ni proponés código.

LANE: {nombre}
ARCHIVOS QUE PODÉS LEER: {globs}
HALLAZGOS A VERIFICAR: {lista con su texto completo}
REGLAS QUE APLICAN: {referencias a AGENTS.md / DESIGN.md}

## Cómo trabajar

1. Leé los archivos de tu lane. Nada fuera de los globs.
2. Para cada hallazgo asignado, buscá la evidencia y decidí el veredicto.
3. Después, y solo después, buscá lo que la auditoría NO menciona en tu lane.

## Veredictos permitidos

CONFIRMADO · REFUTADO · DESPLAZADO · YA_ARREGLADO · NO_VERIFICABLE

Ninguno vale sin cita textual. Si no encontrás el archivo: NO_VERIFICABLE.

## Salida — SOLO este JSON, sin texto antes ni después

{
  "lane": "string",
  "archivos_leidos": ["ruta relativa", "..."],
  "verificaciones": [
    {
      "hallazgo": 1,
      "veredicto": "CONFIRMADO",
      "evidencia": {
        "archivo": "apps/web/src/features/carwash/components/ticket-form.tsx",
        "linea": 184,
        "cita": "la línea o el bloque exacto, tal como está en el archivo"
      },
      "nota": "una frase. Por qué la cita prueba el veredicto."
    }
  ],
  "hallazgos_nuevos": [
    {
      "titulo": "una línea, en español, sin adjetivos",
      "gravedad": "bloqueante|alta|media",
      "evidencia": { "archivo": "...", "linea": 0, "cita": "..." },
      "por_que_importa": "una o dos frases, en términos del taller, no del framework",
      "regla_rota": "AGENTS.md regla N | DESIGN.md sección | PRODUCT.md principio N | ninguna"
    }
  ],
  "no_pude": ["lo que quedó sin decidir y qué haría falta"]
}

## Prohibido

- Prohibido leer fuera de tus globs.
- Prohibido inventar una línea. Sin número seguro, poné 0 y nombrá el símbolo en la cita.
- Prohibido escribir, editar, mover o borrar archivos. Prohibido correr comandos que muten.
- Prohibido proponer código, parches o refactors.
- Prohibido devolver prosa fuera del JSON.
- Prohibido el veredicto CONFIRMADO sin cita textual verificable con grep.
- Prohibido juzgar por nombre de rol: toda regla de permisos se verifica contra claves
  `module.action`.
```

---

## 3. Los 16 lanes

| #   | Lane                       | Globs                                                                                                                                                                                      | Hallazgos              | Reglas que aplican                                                |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ----------------------------------------------------------------- |
| 1   | Lista de lavados           | `apps/web/src/features/carwash/components/tickets-screen.tsx`, `.../row-actions*`, `app/(app)/carwash/page.tsx`                                                                            | 11, 15, 20, 40         | DESIGN.md → DataTable, Botón; AGENTS.md 9                         |
| 2   | Alta de lavado             | `apps/web/src/features/carwash/components/ticket-form.tsx`, `ticket-summary.tsx`, `customer-field.tsx`, `body-type-card.tsx`, `washers-field.tsx`                                          | 01, 09, 24, 30, 41, 44 | DESIGN.md → Campo de texto, Cortes y densidades; AGENTS.md 9      |
| 3   | Integridad del vehículo    | `apps/api/src/modules/carwash/**`, `apps/api/src/modules/vehicles/**`, `packages/shared/src/schemas.ts`                                                                                    | 10, 22                 | AGENTS.md 4, 5                                                    |
| 4   | Cobro y caja               | `apps/web/src/features/carwash/components/charge-dialog.tsx`, `cash-screen.tsx`, `close-cash-dialog.tsx`, `cash-session-detail-screen.tsx`, `apps/api/src/modules/carwash/presentation/**` | 05, 06, 13, 14, 42     | AGENTS.md 6; DESIGN.md → Botón (destructiveSolid)                 |
| 5   | Pista                      | `apps/web/src/features/floor/**`, `apps/web/src/app/floor/**`                                                                                                                              | 02, 04, 16, 21         | PRODUCT.md → Mecánico; DESIGN.md → densidad `bahia`               |
| 6   | Clientes                   | `apps/web/src/features/customers/**`                                                                                                                                                       | 27, 28, 35             | DESIGN.md → Chip de estado, Botón                                 |
| 7   | Catálogo                   | `apps/web/src/features/catalog/**`, `apps/api/src/modules/services/**`                                                                                                                     | 07, 19, 26, 29, 31, 33 | DESIGN.md → Estado vacío, Accesibilidad                           |
| 8   | Empleados, usuarios, roles | `apps/web/src/features/employees/**`, `.../users/**`, `.../roles/**`                                                                                                                       | 26, 33, 35, 36         | AGENTS.md 3; DESIGN.md → Estado vacío                             |
| 9   | Navegación y shell         | `apps/web/src/components/app-shell/**`, `apps/web/src/lib/back-link.ts`                                                                                                                    | 18, 25, 32, 37, 39     | DESIGN.md → Menú lateral, Enlace de regreso                       |
| 10  | DataTable y responsive     | `apps/web/src/components/ui/data-table.tsx`, `button.tsx`, `empty-state.tsx`, `stamp.tsx`, `dialog.tsx`                                                                                    | 19, 20, 36, 38         | DESIGN.md → Fila de lista, Componentes                            |
| 11  | Sistema de diseño          | `apps/web/src/app/globals.css`, `apps/web/DESIGN.md`, y grep de hex / `uppercase` / `tone="green"` en todo `apps/web/src`                                                                  | 27, 28, 30             | DESIGN.md completo — es la ley. Reportá toda discrepancia doc↔CSS |
| 12  | Accesibilidad              | `apps/web/src/components/**`, `apps/web/src/features/**` (solo `aria-*`, `role=`, `title=`, `tabIndex`, `onKeyDown`)                                                                       | 31, 32, 38, 40         | DESIGN.md → Accesibilidad; PRODUCT.md → Accessibility             |
| 13  | Frescura de datos          | `apps/web/src/lib/query-client.tsx`, todos los `features/**/hooks/**`                                                                                                                      | 03, 34                 | PRODUCT.md → Operating Context (dos tablets)                      |
| 14  | Contrato y código muerto   | `packages/shared/src/**`, `apps/api/src/**/presentation/**`, todos los `features/**/api.ts`                                                                                                | 07, 08, 12, 43, 44     | AGENTS.md 5, 6                                                    |
| 15  | Auditoría de las specs     | `specs/012-*.md`, `specs/013-*.md`, `specs/014-*.md`, `specs/_TEMPLATE.md`, `AGENTS.md`, `scripts/verify-*.sh`                                                                             | —                      | AGENTS.md → «Cómo especificar con el usuario»                     |
| 16  | Integridad de las citas    | `docs/UX_AUDIT.md` + todos los archivos que cita                                                                                                                                           | los 44                 | —                                                                 |

### Lane 15 — instrucción propia

En vez de verificar hallazgos, respondé por cada spec:

- ¿Cumple la forma de spec ligera de `AGENTS.md`? (encabezado `Estado:`, y solo **Task**,
  **Done**, **Always**, **Ask first**, **Never**, **Verify**.)
- ¿Cada ítem de **Done** es binario? Marcá todo adjetivo sin medida: «fluido», «rápido»,
  «seguro» están prohibidos.
- ¿El comando de **Verify** existe o hay que crearlo? Si nombra `scripts/verify-NNN.sh` y el
  archivo no existe, eso es una tarea faltante, no un defecto de la spec.
- ¿Contradice alguna regla global de `AGENTS.md` o alguna regla de `DESIGN.md`?
- ¿Los segmentos de ruta y los identificadores que propone van en inglés? (AGENTS.md 1.)
- ¿Falta algún **Ask first** que el implementador va a tener que adivinar?

Mismo JSON, con `verificaciones[].hallazgo` = `"012"`, `"013"`, `"014"`.

### Lane 16 — instrucción propia

Es el guardián. Por cada una de las 44 filas de `docs/UX_AUDIT.md`: abrí el archivo citado,
andá a la línea, y decidí si la cita existe y dice lo que la auditoría afirma. No juzgues si
el hallazgo es importante: solo si la referencia es honesta. Este lane es el que atrapa una
auditoría que se inventó una línea.

---

## 4. Qué me traés de vuelta

- `docs/UX_AUDIT_VERIFIED.md`, el consolidado del orquestador.
- La cuenta cruda: confirmados, refutados, desplazados, ya arreglados, no verificables.
- Los hallazgos nuevos, con evidencia, ordenados por gravedad.
- El veredicto de las specs `012`–`014`: si pasan a **Aprobada** como están, o qué les falta.

Con eso decidimos qué entra a la ola 1 y arrancamos.

---

## 5. Notas de operación en Orca

- Corré la auditoría en un worktree propio, con la pestaña **Agent**. No hace falta
  **Database** ni **Dev**: los 16 lanes son lectura de código.
- Si querés además verificación en ejecución (los hallazgos 01, 18, 19, 20 se ven mejor
  corriendo), levantá `docker compose up -d` y `pnpm build && pnpm dev`, y agregá un lane 17
  con navegador a 1280 / 1024 / 768 / 390 px. Ese lane necesita usuario y PIN de empleado
  para entrar a `/floor`: pedímelos, no los inventes.
- Flash en `high` se va de tema con lanes anchos. Si un lane devuelve prosa o se sale de sus
  globs, partilo en dos antes de relanzarlo. Es más barato que insistir.
