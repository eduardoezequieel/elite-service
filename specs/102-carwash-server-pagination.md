# 102 — Paginación en servidor en todas las listas del lavado

**Estado:** Aprobada (por chat, 1 oct 2026: «preferiría que todo fue por el servidor, no perdemos
nada pienso yo»)
**Módulo:** customers, vehicles, employees, users, roles, services, banking, carwash, inventory
(api) · sus features (web) · `@elite/shared` | **Depende de:** 101 (mismo patrón)

## Task

En el lavado solo paginan en servidor Inventario (existencias y movimientos, 065) y Ventas. El
resto de los `GET` de lista devuelve todas las filas y la tabla, como mucho, pagina en cliente.
Decisión del usuario: **toda lista pagina en servidor**, con el patrón del repo (`Page<T>` +
`pageQuerySchema`, `?page&pageSize`, página en la URL, paginador de `DataTable` «1–25 de N», en
`bahia` las tarjetas igual). Nada queda paginado solo en cliente.

| Lista (pantalla)                                           | Endpoint                                   | Filas |
| ---------------------------------------------------------- | ------------------------------------------ | ----- |
| Lavados (`/carwash`, lista de oficina con filtros)         | `GET /carwash/tickets`                     | 25    |
| Clientes y su ficha (vehículos e historial de lavados)     | `GET /customers`, `GET /customers/:id/...` | 25    |
| Vehículos (listas y búsquedas del mostrador)               | `GET /vehicles`                            | 25 (el combobox pide `q` + página 1) |
| Caja: pagos del turno y lista de turnos                    | `GET /carwash/cash/...`                    | 25; los totales del turno siguen siendo del turno completo |
| Rendimiento y comisiones (todas las tablas)                | `GET /carwash/performance/...`             | 25; los resúmenes siguen siendo del periodo completo |
| Empleados                                                  | `GET /employees`                           | 25    |
| Usuarios                                                   | `GET /users`                               | 25    |
| Roles                                                      | `GET /roles`                               | 25    |
| Catálogo: categorías y servicios                           | `GET /services/...`                        | 25    |
| Inventario: categorías, consumo por empleado, reporte de consumo, kardex | `GET /inventory/...` (las que aún no son `Page<T>`) | 25 |
| Cuentas bancarias                                          | `GET /banking/accounts`                    | 25 (el selector de cobro pide página 1 con `pageSize` 100) |

Las vistas acotadas por naturaleza quedan fuera: tablero de pista/kanban (089), pantallas de la
pista, notificaciones, catálogo de permisos (`GET /permissions`), opciones de un `select`.

## Done

- [ ] Shared: cada schema de query de lista extiende `pageQueryShape`; respuesta `Page<T>` (o
      objeto con `Page<T>` adentro más los totales globales, donde hay resumen).
- [ ] API: repos con `skip/take` + `count` en una transacción; orden estable (fecha desc + `id`).
      Casos de uso con tests de `page`/`pageSize`/`total`.
- [ ] Web: hooks y pantallas leen `items`/`total`, página en `?page=` (`pageParam`,
      `replaceQuery`), vuelven a 1 al cambiar filtro o búsqueda, y muestran el paginador.
- [ ] Todos los consumidores de los endpoints cambiados siguen funcionando (comboboxes de cliente
      y vehículo del formulario de lavado, selector de cuenta en el cobro, asignación de roles a
      usuarios, tablero de pista si lee alguna de estas listas, `use-nav-counts`).
- [ ] Los `scripts/verify-NNN.sh` que leen esas listas con `jq` pasan a `.items`; cada uno sigue
      en verde.
- [ ] `apps/api/AGENTS.md`: una línea con la convención «toda lista es `Page<T>`».

## Always

- Mismo contrato de página que el resto del repo; nada nuevo en shared para paginar.
- Los contadores y totales (pendientes del riel, totales del turno, resúmenes de rendimiento) se
  calculan sobre todas las filas, nunca sobre la página.

## Ask first

- Nada.

## Never

- No tocar `schema.prisma`, `DataTable` ni `data-table-page.ts`.
- No tocar nada de la rentadora (specs 094–101): eso lo hace la 101 en paralelo.
- No paginar las vistas acotadas listadas arriba.

## Verify

```bash
pnpm build && pnpm lint && pnpm test
for s in scripts/verify-*.sh; do bash "$s"; done   # contra docker compose + API en 3200
```
