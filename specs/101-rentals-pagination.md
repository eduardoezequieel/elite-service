# 101 — Paginación en todas las listas de la rentadora

**Estado:** Terminada (aprobada por chat, 1 oct 2026: «todas deberían de estar correctamente paginadas, veo
algunas listas demasiado largas»)
**Módulo:** renters, rentals, rental-billing, fleet-maintenance (api) · features de la rentadora
(web) · `@elite/shared` rentals | **Depende de:** 095–100

## Task

Las listas de la rentadora salen enteras: el API no limita filas y la mayoría de los `DataTable`
no lleva `pageSize`. **Toda lista pagina en servidor** (decisión del usuario, 1 oct 2026), con el
patrón que ya existe en el repo: `Page<T>` + `pageQuerySchema` de shared (`?page&pageSize`), página
en la URL como Inventario, y el paginador de `DataTable` mostrando «1–25 de N». En `bahia` las
tarjetas paginan igual que la tabla. Nada pagina solo en cliente.

| Lista                                           | Endpoint paginado                                        | Filas |
| ----------------------------------------------- | -------------------------------------------------------- | ----- |
| Flota `/rentals/fleet`                          | `GET /fleet/vehicles`                                    | 25    |
| Clientes de renta `/rentals/customers`          | `GET /renters`                                           | 25    |
| Rentas `/rentals/agreements`, historial cliente | `GET /rentals/agreements` (historial: `?customerId`, 10) | 25    |
| Gastos `/rentals/expenses`, pestaña del carro   | `GET /fleet/expenses` (el `total` del filtro sigue siendo de **todas** las filas) | 25 |
| Multas (caja, panel de la renta)                | `GET /rentals/fines`                                     | 25    |
| Servicios (pestaña del carro)                   | `GET /fleet/maintenance/logs` (hoy `take: 500`)          | 25    |
| Pagos y multas del panel de cobros              | `GET /rentals/agreements/:id/payments` y `GET /rentals/fines?agreementId` (nuevo el primero; el DTO del detalle deja de embeber `payments[]`/`fines[]` **o** los embebe acotados a los 10 últimos con `paymentsTotal`/`finesTotal`; elegir lo que menos rompa a `agreementTotals`, que necesita **todos** los pagos para el saldo: el saldo lo calcula el API, no la UI) | 10 |
| Caja: pagos del día                             | `GET /rentals/cash` → `payments: Page<...>` con `?page`; los totales por método y por usuario siguen siendo del día completo | 25 |
| Caja: depósitos en custodia y cuentas por cobrar| `GET /rentals/deposits-held` y `GET /rentals/receivables` paginados | 25 |
| Mantenimiento: pendientes y sin datos           | `GET /fleet/maintenance/status` → `Page<VehicleMaintenanceStatus>` (por carro); los contadores de arriba siguen siendo de toda la flota | 25 |
| Rentabilidad por carro                          | `GET /rentals/reports/profitability` → `rows: Page<...>`; los totales del periodo siguen siendo de toda la flota | 25 |

## Done

- [x] Shared: todos los schemas de query de las listas de la tabla extienden `pageQueryShape`; las
      respuestas son `Page<T>` (o un objeto con `Page<T>` adentro más los totales globales).
- [x] API: repos con `skip/take` + `count` en una transacción; el `take: 500` desaparece.
- [x] Web: hooks y pantallas leen `items`/`total`, página en `?page=` (`pageParam`,
      `replaceQuery` de `lib/list-params.ts`, como Inventario), vuelven a la página 1 al cambiar
      filtro o búsqueda, y muestran el paginador de `DataTable` con «1–25 de N».
- [x] Todos los consumidores de esos endpoints siguen funcionando: combobox de cliente en Nueva
      renta, `RenterHistory`, `FineDialog`, pestañas del carro, tablero de inicio y rentabilidad
      (si piden listas, piden `pageSize` suficiente o usan su propio endpoint).
- [x] `scripts/verify-095.sh`, `096`, `098`, `099` y `100` actualizados a la forma `Page<T>` y
      con un chequeo de `?page=2&pageSize=1` en una lista cada uno.

## Always

- Mismo contrato de página que el resto del repo (`Page<T>`, `pageQuerySchema`,
  `DEFAULT_PAGE_SIZE`, `MAX_PAGE_SIZE`); nada nuevo en shared para paginar.
- Orden estable en cada lista (fecha desc + `id`), para que la página 2 no repita filas.
- Tests de los casos de uso cubren `page`/`pageSize` y `total`.

## Ask first

- Nada.

## Never

- No tocar `schema.prisma`.
- No cambiar el `DataTable` ni `data-table-page.ts`.
- No paginar el calendario, la disponibilidad ni el tablero de inicio: son vistas acotadas por
  rango o por flota.
- Nada de paginación solo en cliente: `pageSize` de `DataTable` se usa únicamente como ventana de
  la página que vino del servidor.

## Verify

```bash
pnpm build && pnpm lint && pnpm test
for n in 095 096 098 099 100; do bash scripts/verify-$n.sh; done
```
