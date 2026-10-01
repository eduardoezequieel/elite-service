# 095 — Rentadora: base de datos, contrato, flota, clientes de renta y ajustes

**Estado:** Aprobada (por chat, 1 oct 2026: «quiero que implementemos lo mismo [que el prototipo]
pero con el diseño de lo que tenemos del carwash … todas las demás cosas deberían de ser separadas»;
«Clientes separados me parece bien»)
**Módulo:** fleet, renters, rental-settings, rental-files (api) · features/fleet, renters,
rental-settings (web) · `@elite/shared` rentals | **Depende de:** 094

## Contexto

Riveras Rent a Car (empresa de la familia, NIT propio) se gestiona desde el espacio «Renta de
carros» de Elite Service. El prototipo de referencia es `/Users/elopez/Downloads/index.html`
(HTML + Supabase, 2.300 líneas): se reescribe entero con el diseño del carwash. Esta spec es la
**base** de la épica 094–100: deja la **migración completa** de todas las tablas de la rentadora
(aunque varias las use otra spec), el contrato compartido base, los permisos, las rutas del riel y
tres módulos funcionales: flota, clientes de renta y ajustes de la empresa. Las specs 096 (rentas),
098 (dinero), 099 (mantenimiento y gastos) y 100 (inicio y rentabilidad) corren **en paralelo**
sobre esta base y **no tocan el schema**: si les falta un campo lo reportan.

Nada se comparte con el lavado salvo sesión, usuarios, roles y el enum `PaymentMethod`. Los
clientes de renta son otra tabla (`rental_customers`), la flota es otra tabla (`fleet_vehicles`),
la caja es otra (098).

## Historias

- Como usuario con `fleet.manage`, quiero registrar cada carro con tarifas, km libres,
  financiamiento, seguro y GPS y vencimientos, para que rentas, mantenimiento y rentabilidad tengan
  de dónde calcular.
- Como usuario con `renters.manage`, quiero registrar al cliente con los datos que pide el contrato
  (DUI, licencia y vencimiento, nacimiento, país) y marcarlo «no rentar», para no volver a rentarle
  a quien dio problemas.
- Como usuario con `rentals.settings`, quiero editar los datos de la empresa, el logo, los valores
  por defecto del contrato, las cláusulas y la lista de accesorios, para que el contrato impreso
  salga con los datos reales.

## Criterios de aceptación

- **Dado** `fleet.manage`, **cuando** creo un carro con placa `P53DBC`, **entonces** queda
  `ACTIVE`, aparece en `GET /fleet/vehicles` y una segunda placa igual responde 409 `PLATE_TAKEN`.
  Sin placa (hay carros sin placa registrada) se acepta.
- **Dado** un carro, **cuando** lo paso a `IN_SHOP` o `RETIRED`, **entonces** la ficha lo muestra con
  su chip de estado y la lista lo filtra por estado.
- **Dado** `renters.manage`, **cuando** creo un cliente con `isBlocked: true` y motivo, **entonces**
  la lista lo marca «No rentar» y `GET /renters?blocked=true` lo devuelve.
- **Dado** `renters.manage`, **cuando** envío `POST /renters/import` con filas válidas e inválidas,
  **entonces** responde `{ created, skipped: [{ row, reason }] }` y no crea las inválidas.
- **Dado** `rentals.settings`, **cuando** abro Ajustes sin haber guardado nunca, **entonces** veo
  los valores por defecto del prototipo (empresa, NIT, dirección, teléfonos, correo, arrendante,
  número de contrato inicial 733, IVA 0, margen 1 h, edad mínima 21, 17 cláusulas, 28 accesorios).
- **Dado** `rentals.settings`, **cuando** subo un PNG como logo, **entonces** `POST /rental-files`
  responde `{ id, url }` y `GET /rental-files/:id` lo devuelve con su `Content-Type`; un archivo de
  6 MB responde 413 `FILE_TOO_LARGE`, un PDF responde 415 `FILE_TYPE_NOT_ALLOWED`; sin sesión, 401.
- **Dado** un usuario sin `fleet.read`, **cuando** pide `GET /fleet/vehicles`, **entonces** 403.
- **Dado** el seed, **cuando** corre, **entonces** sincroniza las claves nuevas, crea las 8 tareas
  del plan de mantenimiento por defecto si no existen y la fila de ajustes por defecto si no existe.

## Reglas de negocio

- **RN-1:** Separación total: ninguna tabla nueva referencia `customers`, `vehicles`, `work_orders`,
  `cash_sessions` ni `bank_accounts`. El único cruce es por **placa** (texto): la 099 lee lavados
  pagados cuya placa coincide con la de un carro de la flota.
- **RN-2:** La placa de flota es opcional y única cuando existe; se normaliza con la misma regla
  que el lavado (mayúsculas, sin espacios; ver `vehicles` del carwash).
- **RN-3:** Tarifas: `dailyRate` obligatoria; `weeklyRate` aplica desde 7 días y `monthlyRate`
  desde 30 (`rateForDays` en shared). Dinero en `Decimal(12,2)`.
- **RN-4:** Días a cobrar: `billableDays(pickup, return, graceHours)` =
  `max(1, ceil((return − pickup − grace) / 24 h))`; `graceHours` sale de ajustes (1 por defecto).
- **RN-5:** Totales de una renta (shared, pura): `total = max(0, (dailyRate + cdwPerDay) ×
  billableDays + extraCharges + extraKmCharge + finesCharged − discount)`; `paid = Σ payments no
  anulados`; `balance = total − paid`. Si `includesVat` y `vatRate > 0`, `net = total / (1 +
  vatRate/100)`; con IVA 0, `net = total`.
- **RN-6:** Un cliente bloqueado (`isBlocked`) no se elimina: la 096 lo rechaza con
  `RENTER_BLOCKED` al crear una renta. Clientes y carros se desactivan/retiran, nunca se borran.
- **RN-7:** Archivos: solo `image/jpeg`, `image/png`, `image/webp`, máximo 5 MB, nombre en disco =
  `id` + extensión, carpeta `FILES_DIR` (env, default `./data/files`, gitignoreada). Se sirven solo
  con sesión. El cliente reduce la foto a 1600 px antes de subirla (como el prototipo).
- **RN-8:** Ajustes es **una sola fila** (`key = 'default'`); `GET` crea la fila con los valores por
  defecto si no existe. Las cláusulas y accesorios son arreglos de texto editables.
- **RN-9:** Importación de clientes: CSV con encabezados (el usuario exporta su Excel a CSV). El
  cliente parsea y manda JSON; columnas reconocidas por nombre flexible (`nombre`, `dui`/`documento`,
  `licencia`, `celular`, `telefono`, `email`, `direccion`, `nacimiento`, `pais`). Sin `fullName` →
  fila omitida.

## Permisos

| Clave               | Descripción                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| `rentals.read`      | (094) Ver inicio, calendario, rentas y disponibilidad                  |
| `rentals.manage`    | Crear, editar, entregar, recibir, extender, cambiar y cancelar rentas  |
| `rentals.charge`    | Registrar cobros, devolver depósitos, multas y ver la caja de renta    |
| `rentals.reports`   | Ver rentabilidad e inversión recuperada                                |
| `rentals.settings`  | Editar datos de la empresa, contrato, cláusulas, accesorios y logo     |
| `fleet.read`        | Ver la flota, su mantenimiento y sus gastos                            |
| `fleet.manage`      | Crear y editar carros, registrar servicios, gastos y el plan           |
| `renters.read`      | Ver clientes de renta                                                  |
| `renters.manage`    | Crear, editar, bloquear e importar clientes de renta                   |

Todas se agregan **acá** (grupos `rentals`, `fleet`, `renters`); las specs siguientes no tocan
`permissions.ts`.

## Datos

Una sola migración `rentals_foundation` con **todo** esto. Nombres de tabla en `snake_case` con
`@@map`. Las secciones dicen qué spec las usa; igual se crean ahora.

```prisma
// ===================== spec 095: flota, clientes de renta, ajustes, archivos =====================
enum FleetVehicleCategory { SEDAN HATCHBACK SUV PICKUP VAN OTHER }
enum FleetVehicleStatus { ACTIVE IN_SHOP RETIRED }

model FleetVehicle {
  id                    String               @id @default(uuid()) @db.Uuid
  plate                 String?              @unique
  make                  String
  model                 String
  year                  Int?
  color                 String?
  category              FleetVehicleCategory @default(SEDAN)
  status                FleetVehicleStatus   @default(ACTIVE)
  dailyRate             Decimal              @db.Decimal(12, 2)
  weeklyRate            Decimal?             @db.Decimal(12, 2)
  monthlyRate           Decimal?             @db.Decimal(12, 2)
  freeKmPerDay          Int?
  extraKmPrice          Decimal?             @db.Decimal(12, 2)
  odometerKm            Int                  @default(0)
  purchasePrice         Decimal?             @db.Decimal(12, 2)
  purchasedAt           DateTime?            @db.Date
  financed              Boolean              @default(false)
  downPayment           Decimal?             @db.Decimal(12, 2)
  installment           Decimal?             @db.Decimal(12, 2)
  termMonths            Int?
  financingStartedAt    DateTime?            @db.Date
  insuranceMonthly      Decimal?             @db.Decimal(12, 2)
  gpsMonthly            Decimal?             @db.Decimal(12, 2)
  otherFixedMonthly     Decimal?             @db.Decimal(12, 2)
  insuranceExpiresAt    DateTime?            @db.Date
  registrationExpiresAt DateTime?            @db.Date
  notes                 String?
  createdAt             DateTime             @default(now())
  updatedAt             DateTime             @updatedAt

  agreements      RentalAgreement[]
  fines           RentalFine[]
  maintenanceLogs MaintenanceLog[]
  expenses        FleetExpense[]

  @@index([status])
  @@map("fleet_vehicles")
}

model RentalCustomer {
  id               String    @id @default(uuid()) @db.Uuid
  fullName         String
  documentId       String?
  licenseNumber    String?
  licenseExpiresAt DateTime? @db.Date
  birthDate        DateTime? @db.Date
  country          String?
  mobilePhone      String?
  phone            String?
  email            String?
  address          String?
  occupation       String?
  workplace        String?
  permanentAddress String?
  permanentPhone   String?
  representative   String?
  isActive         Boolean   @default(true)
  isBlocked        Boolean   @default(false)
  blockReason      String?
  notes            String?
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  agreements RentalAgreement[]

  @@index([fullName])
  @@index([documentId])
  @@map("rental_customers")
}

model RentalSettings {
  key                 String   @id @default("default")
  companyName         String
  taxId               String?
  nrc                 String?
  address             String?
  phones              String?
  email               String?
  lessorName          String
  city                String   @default("San Salvador")
  contractStartNumber Int      @default(733)
  vatRate             Decimal  @default(0) @db.Decimal(5, 2)
  defaultCdwPerDay    Decimal? @db.Decimal(12, 2)
  defaultDeductible   Decimal? @db.Decimal(12, 2)
  bufferHours         Int      @default(1)
  graceHours          Int      @default(1)
  minDriverAge        Int      @default(21)
  kmAlert             Int      @default(500)
  daysAlert           Int      @default(7)
  interestRate        Decimal? @db.Decimal(5, 2)
  lateInterestRate    Decimal? @db.Decimal(5, 2)
  contractIntro       String
  clauses             Json     // string[]
  accessories         Json     // string[]
  logoFileId          String?  @db.Uuid
  updatedAt           DateTime @updatedAt

  @@map("rental_settings")
}

enum StoredFileKind { INSPECTION_PHOTO LOGO }

model StoredFile {
  id              String         @id @default(uuid()) @db.Uuid
  kind            StoredFileKind
  mimeType        String
  sizeBytes       Int
  storedName      String
  createdByUserId String         @db.Uuid
  createdAt       DateTime       @default(now())

  @@map("stored_files")
}

// ===================== spec 096: rentas =====================
enum RentalAgreementStatus { RESERVED IN_PROGRESS FINISHED CANCELLED }
enum RentalCoverage { UNDEFINED ACCEPTED DECLINED }

model RentalAgreement {
  id                   String                @id @default(uuid()) @db.Uuid
  contractNumber       Int?                  @unique
  status               RentalAgreementStatus @default(RESERVED)
  customerId           String                @db.Uuid
  vehicleId            String                @db.Uuid
  plannedPickupAt      DateTime
  plannedReturnAt      DateTime
  actualPickupAt       DateTime?
  actualReturnAt       DateTime?
  pickupLocation       String                @default("Oficina")
  returnLocation       String                @default("Oficina")
  dailyRate            Decimal               @db.Decimal(12, 2)
  billableDays         Int
  cdwPerDay            Decimal               @default(0) @db.Decimal(12, 2)
  deductible           Decimal               @default(0) @db.Decimal(12, 2)
  coverage             RentalCoverage        @default(UNDEFINED)
  includesVat          Boolean               @default(true)
  extraCharges         Decimal               @default(0) @db.Decimal(12, 2)
  extraChargesNote     String?
  discount             Decimal               @default(0) @db.Decimal(12, 2)
  extraKmCharge        Decimal               @default(0) @db.Decimal(12, 2)
  deposit              Decimal               @default(0) @db.Decimal(12, 2)
  depositMethod        PaymentMethod?
  depositReturnedAmount Decimal?             @db.Decimal(12, 2)
  depositReturnedAt    DateTime?
  depositReturnNote    String?
  depositTransferredToId String?             @unique @db.Uuid
  cardLast4            String?
  authorizationCode    String?
  authorizationAmount  Decimal?              @db.Decimal(12, 2)
  authorizationDate    DateTime?             @db.Date
  additionalDriver     Json?                 // { name, licenseNumber, licenseExpiresAt, birthDate, country }
  pickupInspection     Json?                 // RentalInspection (shared)
  returnInspection     Json?
  pickupOdometerKm     Int?
  returnOdometerKm     Int?
  previousAgreementId  String?               @unique @db.Uuid
  swapReason           String?
  cancelReason         String?
  cancelledAt          DateTime?
  notes                String?
  createdByUserId      String                @db.Uuid
  createdAt            DateTime              @default(now())
  updatedAt            DateTime              @updatedAt

  customer   RentalCustomer    @relation(fields: [customerId], references: [id], onDelete: Restrict)
  vehicle    FleetVehicle      @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  previous   RentalAgreement?  @relation("AgreementSwap", fields: [previousAgreementId], references: [id], onDelete: Restrict)
  next       RentalAgreement?  @relation("AgreementSwap")
  extensions RentalExtension[]
  payments   RentalPayment[]
  fines      RentalFine[]

  @@index([status])
  @@index([vehicleId, status])
  @@index([customerId])
  @@index([plannedPickupAt])
  @@index([plannedReturnAt])
  @@map("rental_agreements")
}

model RentalExtension {
  id               String   @id @default(uuid()) @db.Uuid
  agreementId      String   @db.Uuid
  previousReturnAt DateTime
  newReturnAt      DateTime
  addedDays        Int
  note             String?
  createdByUserId  String   @db.Uuid
  createdAt        DateTime @default(now())

  agreement RentalAgreement @relation(fields: [agreementId], references: [id], onDelete: Cascade)

  @@index([agreementId])
  @@map("rental_extensions")
}

// ===================== spec 098: dinero =====================
model RentalPayment {
  id               String        @id @default(uuid()) @db.Uuid
  agreementId      String        @db.Uuid
  amount           Decimal       @db.Decimal(12, 2)
  method           PaymentMethod
  reference        String?
  paidAt           DateTime      @default(now())
  note             String?
  receivedByUserId String        @db.Uuid
  voidedAt         DateTime?
  voidReason       String?
  voidedByUserId   String?       @db.Uuid
  createdAt        DateTime      @default(now())

  agreement RentalAgreement @relation(fields: [agreementId], references: [id], onDelete: Restrict)

  @@index([agreementId])
  @@index([paidAt])
  @@map("rental_payments")
}

model RentalFine {
  id                String   @id @default(uuid()) @db.Uuid
  vehicleId         String   @db.Uuid
  agreementId       String?  @db.Uuid
  occurredAt        DateTime
  amount            Decimal  @db.Decimal(12, 2)
  description       String
  chargedToCustomer Boolean  @default(false)
  createdByUserId   String   @db.Uuid
  createdAt         DateTime @default(now())

  vehicle   FleetVehicle     @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  agreement RentalAgreement? @relation(fields: [agreementId], references: [id], onDelete: SetNull)

  @@index([vehicleId])
  @@index([agreementId])
  @@map("rental_fines")
}

// ===================== spec 099: mantenimiento y gastos =====================
model MaintenancePlanTask {
  id           String   @id @default(uuid()) @db.Uuid
  key          String   @unique
  name         String
  intervalKm   Int?
  intervalDays Int?
  sortOrder    Int      @default(0)
  isActive     Boolean  @default(true)

  logs MaintenanceLog[]

  @@map("maintenance_plan_tasks")
}

model MaintenanceLog {
  id              String    @id @default(uuid()) @db.Uuid
  vehicleId       String    @db.Uuid
  taskId          String?   @db.Uuid
  performedAt     DateTime  @db.Date
  odometerKm      Int?
  cost            Decimal?  @db.Decimal(12, 2)
  shop            String?
  notes           String?
  createdByUserId String    @db.Uuid
  createdAt       DateTime  @default(now())

  vehicle FleetVehicle         @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  task    MaintenancePlanTask? @relation(fields: [taskId], references: [id], onDelete: SetNull)
  expense FleetExpense?

  @@index([vehicleId, performedAt])
  @@map("maintenance_logs")
}

enum FleetExpenseType { MAINTENANCE TIRES REPAIR FINE FUEL INSURANCE GPS WASH OTHER }

model FleetExpense {
  id               String           @id @default(uuid()) @db.Uuid
  vehicleId        String           @db.Uuid
  type             FleetExpenseType
  amount           Decimal          @db.Decimal(12, 2)
  incurredAt       DateTime         @db.Date
  odometerKm       Int?
  description      String?
  maintenanceLogId String?          @unique @db.Uuid
  createdByUserId  String           @db.Uuid
  createdAt        DateTime         @default(now())

  vehicle        FleetVehicle    @relation(fields: [vehicleId], references: [id], onDelete: Restrict)
  maintenanceLog MaintenanceLog? @relation(fields: [maintenanceLogId], references: [id], onDelete: SetNull)

  @@index([vehicleId, incurredAt])
  @@map("fleet_expenses")
}
```

Seed (idempotente): tareas del plan por defecto — `oil` «Cambio de aceite y filtro» 5000 km / 90 d ·
`general` «Revisión general en taller» — / 30 d · `tires` «Rotación de llantas» 10000 km / — ·
`alignment` «Alineación y balanceo» 10000 / 180 · `brakes` «Revisión de frenos» 10000 / 180 ·
`air_filter` «Filtro de aire» 15000 / 365 · `battery` «Revisión de batería» — / 180 ·
`coolant` «Cambio de refrigerante» 40000 / 730 — y la fila `rental_settings` por defecto con los
textos **copiados textualmente** de `CFG_DEF` del prototipo (líneas 553–579 de
`/Users/elopez/Downloads/index.html`: `intro`, las 17 `clausulas` ya corregidas y los 28
`accesorios`).

## Contrato compartido (`packages/shared/src/rentals/`)

- `index.ts` re-exporta **todos** los archivos de abajo; `src/index.ts` agrega `export * from
  './rentals'`.
- `fleet.ts`: enums + labels en español (`FLEET_CATEGORY_LABELS`, `FLEET_STATUS_LABELS`), schemas
  `createFleetVehicleSchema`, `updateFleetVehicleSchema`, `fleetVehiclesQuerySchema`
  (`status?`, `q?`), tipo `FleetVehicle` (DTO con decimales como `string`, igual que el resto del
  repo).
- `renters.ts`: `createRenterSchema`, `updateRenterSchema`, `rentersQuerySchema` (`q?`,
  `blocked?`, `active?`), `importRentersSchema` (`rows: Record<string,string>[]`), tipos `Renter`,
  `RenterImportResult`.
- `settings.ts`: `rentalSettingsSchema` (update), tipo `RentalSettings`, `RENTAL_SETTINGS_DEFAULTS`
  (los valores por defecto, incluyendo intro, cláusulas y accesorios), `PICKUP_LOCATIONS =
  ['Oficina','Aeropuerto','Domicilio del cliente','Hotel']`.
- `files.ts`: `STORED_FILE_MAX_BYTES = 5 * 1024 * 1024`, `STORED_FILE_MIME_TYPES`, tipo
  `StoredFileRef { id, url }`, `storedFileUrl(id)` → `/rental-files/${id}` (ruta relativa al API).
- `money.ts`: `billableDays`, `rateForDays`, `agreementTotals`, `netOf` (RN-3/4/5) con tests.
- `agreements.ts`, `billing.ts`, `maintenance.ts`, `reports.ts`: **archivos vacíos con un
  comentario** «// spec 096/098/099/100: lo llena esa spec» para que las specs paralelas no toquen
  `index.ts`.
- `errors.ts` (shared, raíz): agregar **ahora** los códigos que usarán todas las specs:
  `RENTER_BLOCKED`, `VEHICLE_UNAVAILABLE`, `VEHICLE_NOT_RENTABLE`, `AGREEMENT_NOT_RESERVED`,
  `AGREEMENT_NOT_IN_PROGRESS`, `AGREEMENT_CLOSED`, `PAYMENT_EXCEEDS_BALANCE`,
  `DEPOSIT_EXCEEDS_HELD`, `FILE_TOO_LARGE`, `FILE_TYPE_NOT_ALLOWED`,
  `DUPLICATE_MAINTENANCE_TASK`. `PLATE_TAKEN` ya existe y se reutiliza.

## API

Prefijo `/api`. Todos exigen sesión. Decimales viajan como `string`.

| Método | Ruta                       | Permiso            | Request / Response                                      |
| ------ | -------------------------- | ------------------ | ------------------------------------------------------- |
| GET    | `/fleet/vehicles`          | `fleet.read`       | `?status&q` → `FleetVehicle[]`                          |
| GET    | `/fleet/vehicles/:id`      | `fleet.read`       | → `FleetVehicle`                                        |
| POST   | `/fleet/vehicles`          | `fleet.manage`     | `createFleetVehicleSchema` → 201; 409 `PLATE_TAKEN`     |
| PATCH  | `/fleet/vehicles/:id`      | `fleet.manage`     | `updateFleetVehicleSchema` (incluye `status`)           |
| GET    | `/renters`                 | `renters.read`     | `?q&blocked&active` → `Renter[]`                        |
| GET    | `/renters/:id`             | `renters.read`     | → `Renter`                                              |
| POST   | `/renters`                 | `renters.manage`   | → 201                                                   |
| PATCH  | `/renters/:id`             | `renters.manage`   | incluye `isBlocked`, `blockReason`, `isActive`          |
| POST   | `/renters/import`          | `renters.manage`   | `{ rows }` → `{ created, skipped[] }`                   |
| GET    | `/rental-settings`         | `rentals.read` o `rentals.settings` o `fleet.read` | → `RentalSettings` (crea la fila si falta) |
| PUT    | `/rental-settings`         | `rentals.settings` | `rentalSettingsSchema` → `RentalSettings`               |
| POST   | `/rental-files`            | `rentals.manage` o `rentals.settings` | multipart `file`, `kind` → 201 `{ id, url }`; 413 / 415 |
| GET    | `/rental-files/:id`        | sesión             | stream con `Content-Type` y `Cache-Control: private`    |

Módulos Nest nuevos: `fleet`, `renters`, `rental-settings`, `rental-files` (completos) y los
**cascarones** `rentals`, `rental-billing`, `fleet-maintenance`, `rental-reports` (un
`@Module({})` vacío cada uno, registrados en `app.module.ts`) para que las specs paralelas no editen
`app.module.ts`. Dependencia nueva: `multer` + `@types/multer` en `apps/api` → **ADR-014** en
`docs/ARCHITECTURE.md` («Archivos en disco del VPS, servidos por el API con sesión; sin S3»), con el
volumen `files` en `deploy/compose.yml` montado en `FILES_DIR` y la variable en `.env.example`.

## UI

Rutas del espacio «Renta de carros» (**todas** se agregan ahora a `nav-items.ts`, aunque la
pantalla llegue en otra spec):

| Grupo         | Pestaña          | Ruta                     | Permiso           | Spec |
| ------------- | ---------------- | ------------------------ | ----------------- | ---- |
| Operación     | Inicio           | `/rentals`               | `rentals.read`    | 094/100 |
| Operación     | Calendario       | `/rentals/calendar`      | `rentals.read`    | 096 |
| Operación     | Rentas           | `/rentals/agreements`    | `rentals.read`    | 096 |
| Operación     | ¿Qué hay libre?  | `/rentals/availability`  | `rentals.read`    | 096 |
| Operación     | Caja             | `/rentals/cash`          | `rentals.charge`  | 098 |
| Operación     | Clientes         | `/rentals/customers`     | `renters.read`    | 095 |
| Flota         | Flota            | `/rentals/fleet`         | `fleet.read`      | 095 |
| Flota         | Mantenimiento    | `/rentals/maintenance`   | `fleet.read`      | 099 |
| Flota         | Gastos           | `/rentals/expenses`      | `fleet.read`      | 099 |
| Flota         | Rentabilidad     | `/rentals/profitability` | `rentals.reports` | 100 |
| Configuración | Ajustes          | `/rentals/settings`      | `rentals.settings`| 095 |

Iconos lucide: CalendarDays, FileSignature, SearchCheck, Banknote, Contact, Car, Wrench, Receipt,
TrendingUp, Settings.

- **Flota** (`features/fleet`): lista `DataTable` (placa como `PlateChip`, marca/modelo/año,
  categoría, tarifa diaria, estado `Stamp`, vencimientos próximos marcados), filtro por estado,
  búsqueda, botón «Nuevo carro». Diálogo de alta/edición con grupos: Identificación, Tarifas y km,
  Compra y financiamiento (campos de financiamiento solo si `financed`), Costos fijos mensuales,
  Vencimientos, Estado y notas. **Ficha** `/rentals/fleet/[id]` con marco de pestañas compartido
  (patrón 092: `app/(app)/rentals/fleet/[id]/(tabs)/layout.tsx`) y **cuatro pestañas declaradas**:
  Ficha (`/rentals/fleet/[id]`, esta spec), Mantenimiento (`/maintenance`, 099), Gastos
  (`/expenses`, 099), Meses (`/months`, 100). Solo la primera página se crea ahora.
- **Clientes** (`features/renters`): lista con búsqueda, chips «No rentar» e «Inactivo», filtros,
  «Nuevo cliente», «Importar CSV» (diálogo: pegar/subir CSV, vista previa, resultado). Ficha
  `/rentals/customers/[id]` con `DetailField`s, alertas (licencia vencida, menor de edad mínima) y
  una sección «Historial» que renderiza `<RenterHistory customerId />` desde
  `features/rentals/components/renter-history.tsx` — **crear ese archivo como stub que devuelve
  `null`**; la 096 lo reemplaza.
- **Ajustes** (`features/rental-settings`): una pantalla con secciones en tarjetas: Empresa (con
  logo: vista previa + subir PNG/JPG), Contrato (número inicial, IVA, CDW y deducible por defecto,
  margen entre rentas, horas de gracia, edad mínima, intereses), Alertas (km y días), Texto del
  contrato (intro + lista de cláusulas editables: agregar, quitar, reordenar), Accesorios (lista
  editable). Guardar con `PUT`.
- Densidad `bahia` y ancho de tablet: diálogos en una columna, objetivos táctiles, tablas con
  columnas secundarias ocultas bajo 900px.
- Todo con `RequirePermission` en cada página y `PermissionDenied` como fallback.

## Fuera de alcance

- Rentas, calendario, disponibilidad (096), cobros y caja (098), mantenimiento y gastos (099),
  inicio y rentabilidad (100), impresión (097).
- Importar desde `.xlsx` directo (solo CSV).
- Realtime SSE para la rentadora.

## Tareas

- [ ] Permisos (todos los grupos de arriba) + tests en `permissions.spec.ts`.
- [ ] Códigos de error nuevos en `errors.ts`.
- [ ] `packages/shared/src/rentals/*` con tests de `money.ts` (días con gracia, tarifa por tramo,
      totales, saldo, neto con IVA 0 y con IVA 13).
- [ ] Schema completo + migración `rentals_foundation` + seed (tareas del plan y ajustes).
- [ ] Módulos `fleet`, `renters`, `rental-settings`, `rental-files` con casos de uso probados con
      repositorios en memoria; cascarones `rentals`, `rental-billing`, `fleet-maintenance`,
      `rental-reports` registrados.
- [ ] ADR-014 + `multer` + `FILES_DIR` en `.env.example` + volumen en `deploy/compose.yml` +
      `.gitignore` para `data/`.
- [ ] `nav-items.ts` con las 11 rutas del espacio; `nav-items.spec.ts` actualizado.
- [ ] Pantallas Flota (lista, diálogo, ficha con marco de pestañas), Clientes (lista, diálogo,
      importación, ficha con stub de historial), Ajustes.
- [ ] `apps/api/AGENTS.md`, `apps/web/AGENTS.md`, `packages/shared/AGENTS.md`: módulos y carpetas
      nuevas en una línea cada uno.
- [ ] `scripts/verify-095.sh`.

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
bash scripts/verify-095.sh   # contra docker compose + pnpm dev: permisos, 409 placa, import, settings por defecto, 413/415 de archivos
```
