<!-- Extracto del legado. Fuente: zips elite-service-taller.zip y elite-service-erp.zip (sep 2026). Índice: ../LEGACY_BUSINESS_LOGIC.md. No es una spec: no autoriza implementar. -->

# 05 · ERP Carwash (prototipo legado) — lógica de negocio extraída

Fuente: `scratchpad/erp/elite-service-erp/index.html` (1059 líneas; HTML+CSS líneas 1–131, JavaScript líneas 132–1057), `README.md` y `CLAUDE.md` de la misma carpeta. Todo lo que sigue está tomado del código; cuando el `CLAUDE.md` del prototipo dice algo distinto al código, se anota en la sección **Discrepancias**.

Convenciones del prototipo: un solo archivo, JS puro, sin dependencias, persistencia en `localStorage['elite_erp_state']`. Moneda USD. Locale `es-SV` para fechas. Fuentes Space Grotesk + Inter (Google Fonts). Identificadores en español tal cual en el código.

---

## 0. Utilidades globales (para entender el resto)

```js
const uid=()=>Math.random().toString(36).slice(2,9);                 // id aleatorio de 7 chars base36
const money=n=>'$'+(Math.round(n*100)/100).toFixed(2);              // redondeo a 2 decimales SOLO al mostrar
const todayStr=()=>new Date().toISOString().slice(0,10);            // 'YYYY-MM-DD' en UTC
const fmtDate=iso=>{const d=new Date(iso);return d.toLocaleDateString('es-SV',{day:'2-digit',month:'short'})+' '+d.toLocaleTimeString('es-SV',{hour:'2-digit',minute:'2-digit'});};
function esFecha(iso,f){return iso && iso.slice(0,10)===(f||todayStr());}   // compara el prefijo de fecha del ISO (UTC) con f o con hoy
function bajos(){return state.insumos.filter(i=>i.stock<=i.min);}          // insumos bajo mínimo (<=, inclusive)
```

- `todayStr()` y `esFecha()` usan `toISOString()`, es decir **fecha UTC**, no la fecha local de El Salvador (UTC-6). Una orden creada a las 19:00 hora local cae en el "día" siguiente para tablero/cierre/comisiones.
- `money()` es la única redondeo del sistema; internamente los montos se guardan sin redondear salvo `comision()` en el tramo del 12 %.

Persistencia:

```js
async function loadState(){ try{const v=localStorage.getItem('elite_erp_state');if(v)return JSON.parse(v);}catch(e){} return null; }
async function saveState(){ try{localStorage.setItem('elite_erp_state',JSON.stringify(state));}catch(e){} }
```

`init()`: pinta la fecha de hoy, construye el nav (`buildNav`), carga el state; si no hay nada → `state=seed(); seedOrdenes(state); saveState()`; si hay → `migrate(state)`. Luego `render()`.

Estado en memoria (no persistido, se pierde al recargar): `active` (vista actual, arranca en `'tablero'`), `unlocked` (secciones desbloqueadas), `authCtx` (contexto del modal de PIN), `cobroId` (orden que se está cobrando), `cart` (carrito de tienda), `clienteQuery`, `comRango` (`'hoy'`), `cierreFecha` (`todayStr()`), `editServId`.

---

## 1. Modelo de datos completo del `state`

Todas las colecciones son arrays de objetos planos. Los `id` son `uid()`. Las fechas con hora son ISO 8601 (`new Date().toISOString()`); las de mantenimiento son `'YYYY-MM-DD'`.

### 1.1 `empleados` — quienes lavan (reciben comisión)

| Campo    | Tipo    | Valores / notas                                                        |
| -------- | ------- | ---------------------------------------------------------------------- |
| `id`     | string  | `uid()`                                                                |
| `nombre` | string  | Nombre completo. En tablas de órdenes se muestra solo la primera palabra (`nombresEmp`). |
| `activo` | boolean | `true` al crear (`addEmp`). `toggleEmp` lo alterna. Solo los activos aparecen como checkbox al crear una orden. |

### 1.2 `usuarios` — quienes autorizan con PIN

| Campo   | Tipo   | Valores / notas                                                         |
| ------- | ------ | ----------------------------------------------------------------------- |
| `id`    | string | `uid()`                                                                 |
| `nombre`| string | Se guarda como `cobradoPor` / `autorizadoPor`.                           |
| `rol`   | string | `'Encargado'` \| `'Vendedor'` \| `'Otro'` (select de Config). **Etiqueta informativa; nunca se usa para autorizar.** |
| `pin`   | string | Código de autorización. Comparación exacta de string (`u.pin===pin`). Único entre usuarios (validado en `addUsuario` y `cambiarPin`). Se muestra en claro en la tabla de Config. Placeholder "4 dígitos" pero no se valida longitud ni que sea numérico. |
| `perm`  | object | 9 booleanos: `inventario`, `mantenimiento`, `cobrar`, `anular`, `tablero`, `clientes`, `comisiones`, `cierre`, `config`. |

Semántica de cada permiso (dónde se consulta):

| Permiso         | Qué habilita                                                                  | Dónde se pide |
| --------------- | ----------------------------------------------------------------------------- | ------------- |
| `inventario`    | Entrar a la sección Inventario e insumos, y a la tarjeta "Productos de tienda" dentro de Tienda | `LOCK_INFO.inventario`, `vTienda` (`unlocked.inventario`) |
| `mantenimiento` | Entrar a la sección Máquinas y mantenimiento                                  | `LOCK_INFO.maquinas.permiso='mantenimiento'` |
| `cobrar`        | Confirmar cobro de orden (`confirmCobro`) y cobro de tienda (`cobrarTienda`)  | `usuarioPorPin(pin,'cobrar')` / `requireAuth('cobrar')` |
| `anular`        | Anular orden (`eliminarOrden`) y anular venta (`delVenta`)                    | `requireAuth('anular')` |
| `tablero`       | Entrar al Tablero                                                             | `LOCK_INFO.tablero` |
| `clientes`      | Entrar a Clientes                                                             | `LOCK_INFO.clientes` |
| `comisiones`    | Entrar a Comisiones                                                           | `LOCK_INFO.comisiones` |
| `cierre`        | Entrar a Cierre de caja                                                       | `LOCK_INFO.cierre` |
| `config`        | Entrar a Configuración                                                        | `LOCK_INFO.config` |

### 1.3 `bitacora` — registro de autorizaciones

| Campo          | Tipo   | Notas                                                                 |
| -------------- | ------ | --------------------------------------------------------------------- |
| `id`           | string | `uid()`                                                               |
| `fecha`        | string | ISO con hora                                                          |
| `accion`       | string | `'Cobro de orden'` \| `'Anulación de orden'` \| `'Cobro de tienda'` \| `'Anulación de venta'` (únicas cuatro acciones que se registran) |
| `detalle`      | string | Texto libre construido por cada acción (ver §11)                       |
| `autorizadoPor`| string | `u.nombre` del usuario cuyo PIN autorizó                               |

Se inserta con `unshift` (más reciente primero). Config muestra solo las 15 primeras. Nunca se borra salvo `resetDatos`/`vaciarDatos`.

### 1.4 `servicios` — catálogo de carwash

| Campo    | Tipo   | Notas                                                     |
| -------- | ------ | --------------------------------------------------------- |
| `id`     | string | `uid()`                                                   |
| `nombre` | string | Se usa como valor del datalist y para autocompletar precio (match case-insensitive exacto). |
| `precio` | number | USD. Config muestra al lado `comision(s.precio)` como referencia. |

La orden **no referencia** el servicio por `id`: guarda el texto `servicio` y el `monto`. Cambiar el catálogo no afecta órdenes existentes.

### 1.5 `insumos` — consumibles de bodega (no se venden)

| Campo    | Tipo   | Notas                                                          |
| -------- | ------ | -------------------------------------------------------------- |
| `id`     | string | `uid()`                                                        |
| `codigo` | string | Ej. `SH-001`. Clave de búsqueda en "Movimiento de bodega" (case-insensitive). Puede quedar vacío; no se valida unicidad. `migrate` pone `''` si falta. |
| `nombre` | string | Obligatorio                                                    |
| `unidad` | string | Texto libre, default `'u'`. Seed usa `'L'` y `'u'`.            |
| `stock`  | number | Redondeado a 1 decimal en cada movimiento; nunca negativo (`Math.max(0,…)`). |
| `min`    | number | Stock mínimo; alerta cuando `stock<=min`.                      |
| `costo`  | number | Costo unitario USD. "Valor" en tabla = `stock*costo`.          |

### 1.6 `movimientos` — kardex de insumos

| Campo      | Tipo   | Notas                                                        |
| ---------- | ------ | ------------------------------------------------------------ |
| `id`       | string | `uid()`                                                      |
| `insumoId` | string | FK a `insumos.id`. Si el insumo se borra, la fila muestra `(eliminado)`. |
| `fecha`    | string | ISO con hora                                                 |
| `tipo`     | string | `'entrada'` \| `'salida'`                                    |
| `cantidad` | number | Cantidad **solicitada** (positiva). No es la cantidad efectiva si el stock se clampó a 0. |
| `nota`     | string | Libre; `'ajuste rápido'` cuando viene de los botones −/+.    |

Solo existen movimientos para insumos. Los productos de tienda no tienen kardex.

### 1.7 `productos` — artículos de tienda (POS)

| Campo    | Tipo   | Notas                                                       |
| -------- | ------ | ----------------------------------------------------------- |
| `id`     | string | `uid()`                                                     |
| `codigo` | string | Ej. `T-001`. Sin validación de unicidad. Puede quedar vacío. |
| `nombre` | string | Obligatorio                                                 |
| `precio` | number | Precio de venta USD                                         |
| `stock`  | number | Entero (step 1). Se descuenta al cobrar venta, clamp a 0. No tiene `min`, `unidad`, `costo` ni movimientos. |

### 1.8 `ventasTienda`

| Campo             | Tipo    | Notas                                                                   |
| ----------------- | ------- | ----------------------------------------------------------------------- |
| `id`              | string  | `uid()`                                                                 |
| `fecha`           | string  | ISO con hora (momento del cobro; la venta nace cobrada)                 |
| `items`           | array   | `{ productoId, nombre, precio, cantidad }` — copia del precio al momento de la venta |
| `total`           | number  | `Σ precio*cantidad`                                                     |
| `pago`            | string  | `'Efectivo'` \| `'Tarjeta'` \| `'Transferencia'`. **Se guarda aunque `facturaExterna` sea true** (a diferencia de órdenes). |
| `facturaExterna`  | boolean | Marca "Facturado en otro sistema (DTE)"                                 |
| `cobradoPor`      | string  | `u.nombre` del autorizador                                              |

No tiene `estado`: una venta anulada se **elimina** del array.

### 1.9 `maquinas`

| Campo    | Tipo   |
| -------- | ------ |
| `id`     | string |
| `nombre` | string |

### 1.10 `mantenimientos`

| Campo       | Tipo   | Notas                                                  |
| ----------- | ------ | ------------------------------------------------------ |
| `id`        | string | `uid()`                                                |
| `maquinaId` | string | FK a `maquinas.id`. Se borran en cascada con `delMaquina`. |
| `fecha`     | string | `'YYYY-MM-DD'` del input date (default `todayStr()`). Sin hora. |
| `tipo`      | string | `'Preventivo'` \| `'Correctivo'`                       |
| `desc`      | string | Descripción libre                                      |
| `costo`     | number | USD. **No impacta caja, cierre ni tablero.**           |

### 1.11 `clientes` (existe en el código; el `CLAUDE.md` del prototipo no lo documenta)

| Campo      | Tipo     | Notas                                                                    |
| ---------- | -------- | ------------------------------------------------------------------------ |
| `id`       | string   | `uid()`                                                                  |
| `nombre`   | string   | `'Cliente sin nombre'` si se dio solo teléfono                           |
| `telefono` | string   | Segunda clave de match (exacta, con trim)                                |
| `placas`   | string[] | Placas en MAYÚSCULAS vinculadas. Primera clave de match.                 |
| `creadoEn` | string   | ISO                                                                      |

### 1.12 `ordenes` — órdenes de trabajo de carwash

| Campo            | Tipo          | Valores / notas                                                                 |
| ---------------- | ------------- | ------------------------------------------------------------------------------- |
| `id`             | string        | `uid()`                                                                         |
| `fecha`          | string ISO    | Momento de creación. **Es la fecha que usan comisiones, "Órdenes de hoy" y "Comisiones del día".** |
| `placa`          | string        | Opcional, trim, sin normalizar mayúsculas al guardar                            |
| `tipo`           | string        | `'Sedán'` \| `'SUV'` \| `'Pickup'` \| `'Moto'` \| `'Otro'`                      |
| `marca`          | string        | "Marca / modelo", opcional                                                      |
| `color`          | string        | Opcional                                                                        |
| `servicio`       | string        | Texto libre (obligatorio); datalist con `servicios.nombre`                       |
| `monto`          | number        | "Monto factura ($)", obligatorio `>0`. Editable aunque se autocompletó del catálogo. |
| `empleados`      | string[]      | ids de `empleados`; mínimo 1                                                    |
| `comisionTotal`  | number        | `comision(monto)` **congelado al crear**                                        |
| `estado`         | string        | `'En proceso'` \| `'Cobrado'` (legado `'Terminado'` → migrado a `'Cobrado'`)     |
| `pago`           | string        | `''` mientras En proceso o si `facturaExterna`; si no `'Efectivo'`\|`'Tarjeta'`\|`'Transferencia'` |
| `facturaExterna` | boolean       | Marcado al cobrar                                                               |
| `fechaCobro`     | string\|null  | ISO del cobro; `null` mientras En proceso. **Es la fecha que usan caja y cierre.** |
| `cobradoPor`     | string        | `u.nombre` del autorizador de cobro; `''` antes                                  |
| `clienteId`      | string\|null  | FK a `clientes.id`, asignado al cobrar                                          |

### 1.13 `migrate(s)` — literal

```js
function migrate(s){
  s.productos=s.productos||[]; s.movimientos=s.movimientos||[]; s.ventasTienda=s.ventasTienda||[]; s.bitacora=s.bitacora||[]; s.clientes=s.clientes||[];
  if(!s.usuarios||!s.usuarios.length) s.usuarios=defaultUsuarios();
  s.usuarios.forEach(u=>{
    u.perm=u.perm||{inventario:false,mantenimiento:false,cobrar:false,anular:false};
    const full=!!u.perm.anular;
    ['tablero','clientes','comisiones','cierre','config'].forEach(k=>{ if(u.perm[k]===undefined) u.perm[k]=full; });
  });
  s.insumos.forEach(i=>{if(i.codigo===undefined)i.codigo='';});
  s.clientes.forEach(c=>{c.placas=c.placas||[];});
  s.ordenes.forEach(o=>{
    if(o.marca===undefined)o.marca='';
    if(o.color===undefined)o.color='';
    if(o.facturaExterna===undefined)o.facturaExterna=false;
    if(o.cobradoPor===undefined)o.cobradoPor='';
    if(o.clienteId===undefined)o.clienteId=null;
    if(o.estado==='Terminado'){o.estado='Cobrado';if(!o.fechaCobro)o.fechaCobro=o.fecha;}
    if(o.fechaCobro===undefined){o.fechaCobro=o.estado==='Cobrado'?o.fecha:null;}
    if(o.estado!=='Cobrado'){o.pago='';o.fechaCobro=null;}
  });
  return s;
}
```

Reglas de migración que revelan historia del producto:
- Colecciones `productos`, `movimientos`, `ventasTienda`, `bitacora`, `clientes` se agregaron después de la primera versión.
- Si no hay usuarios, se crean los dos por defecto (Ana/Pedro).
- Los 5 permisos de sección (`tablero`, `clientes`, `comisiones`, `cierre`, `config`) se agregaron después: a quien ya tenía `anular` (encargado) se le dan todos; al resto ninguno.
- El estado `'Terminado'` existió antes y equivale hoy a `'Cobrado'`; su `fechaCobro` se toma de `fecha`.
- Toda orden no cobrada se normaliza a `pago=''`, `fechaCobro=null`.
- No migra `empleados`, `servicios`, `maquinas`, `mantenimientos` (se asumen presentes; si `s.insumos` u `s.ordenes` faltan, `migrate` lanza error).

---

## 2. Datos de ejemplo (seed)

### 2.1 `defaultUsuarios()`

| Usuario           | rol        | pin    | inventario | mantenimiento | cobrar | anular | tablero | clientes | comisiones | cierre | config |
| ----------------- | ---------- | ------ | ---------- | ------------- | ------ | ------ | ------- | -------- | ---------- | ------ | ------ |
| Ana (Encargada)   | Encargado  | `1234` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Pedro (Vendedor)  | Vendedor   | `5678` | ✔ | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |

### 2.2 `seed()`

**empleados** (todos `activo:true`): Carlos Méndez, José Ramírez, María López, Luis Gómez.

**servicios**

| nombre                    | precio | `comision(precio)` |
| ------------------------- | -----: | -----------------: |
| Lavado básico             |  8.00  | 0.00 |
| Lavado premium            | 15.00  | 1.00 |
| Detallado interior        | 25.00  | 3.00 |
| Encerado                  | 35.00  | 4.00 |
| Full: lavado + encerado   | 45.00  | 5.40 (12 %) |

**insumos**

| codigo | nombre                 | unidad | stock | min | costo | Estado seed (`stock<=min`) |
| ------ | ---------------------- | ------ | ----: | --: | ----: | -------------------------- |
| SH-001 | Shampoo para autos     | L      | 20    | 5   | 4.00  | OK |
| CE-001 | Cera líquida           | L      | 4     | 3   | 6.00  | OK |
| SI-001 | Silicón para llantas   | L      | 8     | 2   | 5.00  | OK |
| TM-001 | Toalla de microfibra   | u      | 40    | 10  | 2.00  | OK |
| AR-001 | Aromatizante           | u      | 9     | 10  | 1.00  | **Reponer** (9 ≤ 10) |

**productos** (tienda)

| codigo | nombre               | precio | stock |
| ------ | -------------------- | -----: | ----: |
| T-001  | Agua embotellada     | 0.75   | 48 |
| T-002  | Bebida gaseosa       | 1.25   | 36 |
| T-003  | Ambientador de pino  | 3.50   | 20 |
| T-004  | Paño de microfibra   | 4.00   | 15 |

**maquinas**: Hidrolavadora 1, Hidrolavadora 2, Aspiradora industrial, Compresor.

`mantenimientos`, `movimientos`, `ventasTienda`, `clientes`, `ordenes`, `bitacora`: vacíos (los clientes y órdenes los llena `seedOrdenes`).

### 2.3 `seedOrdenes(s)`

Clientes:
- Roberto Hernández, tel `7000-1111`, placas `['P123-456','P456-789']`, creado hace 180 min.
- Ana Martínez, tel `7000-2222`, placas `['M789-012']`, creada hace 95 min.

Órdenes (relativas a `Date.now()`):

| # | creada hace | placa    | tipo   | marca         | color  | servicio                 | monto | empleados        | comisionTotal | estado     | pago     | facturaExterna | fechaCobro        | cobradoPor      | cliente |
| - | ----------- | -------- | ------ | ------------- | ------ | ------------------------ | ----: | ---------------- | ------------: | ---------- | -------- | -------------- | ----------------- | --------------- | ------- |
| 1 | 180 min     | P123-456 | Sedán  | Toyota Corolla| Gris   | Lavado básico            | 8     | Carlos           | 0.00 | Cobrado    | Efectivo | false | hace 170 min | Ana (Encargada) | Roberto |
| 2 | 95 min      | M789-012 | SUV    | Honda CR-V    | Negro  | Detallado interior       | 22    | José, María      | 2.00 (1.00 c/u) | Cobrado | Tarjeta  | false | hace 80 min  | Ana (Encargada) | Ana M. |
| 3 | 30 min      | P456-789 | Pickup | Ford Ranger   | Blanco | Full: lavado + encerado  | 45    | Carlos, Luis     | 5.40 (2.70 c/u) | En proceso | `''`  | false | `null`       | `''`            | Roberto |

Nota: la orden 2 usa "Detallado interior" con monto 22 aunque el catálogo dice 25: el seed ilustra que `monto` es libre y no está atado al precio del catálogo.

### 2.4 `vaciarDatos()` — segundo "seed" mínimo

Deja todas las colecciones vacías salvo `usuarios` con dos encargados con **todos** los permisos: Kevin (`pin '1111'`) y Fausto (`pin '0000'`). Estos parecen ser los usuarios reales del negocio (el botón dice "Vaciar todo (dejar solo Kevin y Fausto)").

---

## 3. COMISIONES

### 3.1 `comision(monto)` — literal

```js
function comision(monto){
  monto=+monto||0;
  if(monto<14) return 0;
  if(monto<20) return 1;
  if(monto<25) return 2;
  if(monto<35) return 3;
  if(monto<40) return 4;
  return Math.round(monto*0.12*100)/100;
}
```

### 3.2 Tabla de tramos (según el código, límites reales)

| Condición en código  | Rango de la factura (USD)   | Comisión                          |
| -------------------- | --------------------------- | --------------------------------- |
| `monto<14`           | 0.00 – 13.99…               | $0                                |
| `14<=monto<20`       | 14.00 – 19.99…              | $1 fijo                           |
| `20<=monto<25`       | 20.00 – 24.99…              | $2 fijo                           |
| `25<=monto<35`       | 25.00 – 34.99…              | $3 fijo                           |
| `35<=monto<40`       | 35.00 – 39.99…              | $4 fijo                           |
| `monto>=40`          | 40.00 en adelante           | 12 % del monto, redondeado a 2 decimales (`Math.round(x*100)/100`) |

- Entrada no numérica o vacía → `+monto||0` → 0 → comisión 0.
- Los tramos son **por orden individual** (la función recibe el monto de una sola orden). No hay acumulación por día ni por empleado.
- Ejemplos: 13.99→0; 14→1; 19.99→1; 20→2; 24.99→2; 25→3; 34.99→3; 35→4; 39.99→4; 40→4.80; 45→5.40; 100→12.00.
- Nota: hay un salto no monótono en 40: una factura de 39.99 comisiona $4 y una de 40 comisiona $4.80; pero 35→$4 vs 33.34→$3, etc. Solo el último tramo es porcentual.

### 3.3 Dónde se calcula y se congela

- `crearOrden`: `comisionTotal: comision(monto)` — se guarda en la orden al generarla. No se recalcula nunca (no hay edición de órdenes).
- `bindOrdenForm`: muestra "Comisión estimada" en vivo mientras se escribe el monto: `money(comision(monto.value))` y, si hay `n>1` empleados marcados, `· money(c/n) c/u (n)`.
- `vConfig`: en el catálogo de servicios muestra `comision(s.precio)` de referencia.

### 3.4 Reparto entre varios empleados

En `vComisiones`:

```js
list.forEach(o=>{const c=o.comisionTotal/o.empleados.length;o.empleados.forEach(id=>{if(!map[id])map[id]={n:0,ventas:0,com:0};map[id].n++;map[id].ventas+=(+o.monto)/o.empleados.length;map[id].com+=c;});});
```

- La comisión de la orden se divide **en partes iguales** entre los `empleados` de la orden: `comisionTotal / empleados.length`.
- El monto de la venta también se reparte igual para "Ventas atribuidas": `monto / empleados.length`.
- **No hay redondeo por parte**: $5.40 entre 4 → 1.35 exacto; $2 entre 3 → 0.6666… acumulado sin redondear; solo se redondea al mostrar con `money()`. La suma de las partes mostradas puede diferir por centavos del total mostrado.
- Si `empleados.length===0` la división da `NaN`/`Infinity` (no está guardado; `crearOrden` exige ≥1 empleado, pero datos migrados podrían tenerlo).
- Empleados eliminados de `state.empleados` no aparecen en el resumen (`rows` se construye desde `state.empleados`), y su parte **desaparece del "Total a pagar"** de esa pantalla, aunque `comisionTotal` de la orden sigue contando en Tablero y Cierre.

### 3.5 Resumen por empleado y por período (`vComisiones`)

- Filtro `comRango`:
  - `'hoy'`: `esFecha(o.fecha, todayStr())` — órdenes **creadas** hoy (UTC).
  - `'semana'`: `o.fecha.slice(0,10) >= (hoy − 7 días)` — creadas en los últimos 7 días.
  - `'todo'`: todas.
- La fecha usada es siempre **`o.fecha` (creación)**, nunca `fechaCobro`.
- Columnas por empleado: `Órdenes` (n en las que participó), `Ventas atribuidas` (Σ monto/n_emps), `Comisión a pagar` (Σ comisionTotal/n_emps). Solo empleados con `n>0`. Orden descendente por comisión.
- `Total a pagar en comisiones` = Σ de las filas.
- Texto explicativo en pantalla: "Por cada factura: menos de $14 sin comisión · $14–19.99 → $1 · $20–24.99 → $2 · $25–34.99 → $3 · $35–39.99 → $4 · $40 o más → 12% del valor. Cuando varios empleados atienden un vehículo, la comisión se divide en partes iguales. La comisión se cuenta por el trabajo realizado, aunque la factura se cobre en el sistema externo."

### 3.6 Qué comisiona y qué no

| Fuente                          | ¿Comisiona? | Evidencia |
| ------------------------------- | ----------- | --------- |
| Orden carwash En proceso        | **Sí** (ya cuenta desde que se genera) | `vComisiones`, `vTablero` y `vCierre` filtran por `o.fecha` sin mirar `estado`. |
| Orden carwash Cobrada local     | Sí          | ídem |
| Orden carwash Cobrada DTE externo | **Sí**    | Ningún filtro mira `facturaExterna` para comisión. Texto en pantalla lo confirma. |
| Orden anulada                   | No          | Se elimina físicamente del array. |
| Venta de tienda (`ventasTienda`)| **No**      | `ventasTienda` no tiene campo de comisión ni empleados; `vComisiones` solo recorre `state.ordenes`. |
| Mantenimientos / insumos        | No          | — |

### 3.7 Otros lugares donde aparece la comisión

- Tablero "Comisiones de hoy" = Σ `comisionTotal` de órdenes con `esFecha(o.fecha)` (creadas hoy, cualquier estado).
- Cierre "Comisiones del día" = Σ `comisionTotal` de órdenes con `esFecha(o.fecha, cierreFecha)`.
- Tabla de órdenes: columna "Comisión" con `money(o.comisionTotal)` (total, no repartida).
- Ticket: **no** imprime comisión.

---

## 4. ÓRDENES DE TRABAJO (carwash)

### 4.1 Formulario "Nueva orden" (`vOrdenes` + `bindOrdenForm`)

Campos: Placa (`o_placa`, placeholder `P123-456`), Tipo (`o_tipo`: Sedán/SUV/Pickup/Moto/Otro), Marca / modelo (`o_marca`), Color (`o_color`), Servicio realizado (`o_serv`, input con `datalist` de `servicios.nombre`, "elige o escribe"), Monto factura ($) (`o_monto`, number min 0 step 0.01), Empleados que atendieron (`o_emps`, checkboxes de `empleados.filter(e=>e.activo)`).

Comportamiento del formulario:
- Al escribir en Servicio, si el texto coincide (trim + lowercase) exactamente con un `servicios.nombre`, se rellena `o_monto` con su `precio`. El monto sigue editable.
- "Comisión estimada" se recalcula en vivo (`comision(monto)`), con desglose por empleado si hay más de uno.
- Si no hay empleados activos: mensaje "Agrega empleados en Configuración."
- Subtítulo: "el pago se registra después, al cobrar".

### 4.2 `crearOrden()` — validaciones y resultado

Validaciones (en este orden, con `alert`):
1. `serv` vacío → "Escribe o elige el servicio realizado."
2. `!(monto>0)` → "Ingresa un monto de factura válido."
3. Sin empleados marcados → "Selecciona al menos un empleado."

Placa, tipo, marca y color **no** se validan (pueden ir vacíos). No se verifica que el servicio exista en el catálogo. No se verifica que los empleados sigan activos (solo se muestran activos).

Objeto creado:

```js
{ id:uid(), fecha:new Date().toISOString(), placa, tipo, marca, color, servicio:serv, monto, empleados:ids,
  comisionTotal:comision(monto), estado:'En proceso', pago:'', facturaExterna:false, fechaCobro:null, cobradoPor:'', clienteId:null }
```

Sin PIN: **cualquiera puede generar una orden** (la sección Órdenes no tiene lock).

### 4.3 Estados y transiciones

```
[crearOrden] ──> 'En proceso' ──[confirmCobro con PIN cobrar]──> 'Cobrado'
                     │                                              │
                     └────────[eliminarOrden con PIN anular]────────┴──> (eliminada del array)
```

- Solo dos estados: `'En proceso'` y `'Cobrado'`. No hay "Terminado sin cobrar", "Anulada" ni "Pagado parcial".
- No hay transición inversa (no se puede "des-cobrar").
- No existe ninguna función de **edición** de una orden (ni monto, ni empleados, ni servicio). La única corrección posible es anular y volver a crear.

### 4.4 Historial (`tblOrdenes(list,true)`)

Ordenado por `fecha` descendente. Columnas: Fecha (creación), Placa, Servicio, Monto, Empleados (primer nombre), Comisión (`comisionTotal`), Estado / pago (badge `En proceso`; o `Cobrado` + método; o `Cobrado` + badge `DTE ext.`), acciones.

Acciones por fila:
- **Cobrar** (`openCobro`) — solo si `estado!=='Cobrado'`.
- **Ticket** (`printOrden`) — siempre, incluso en proceso (imprime "** PENDIENTE DE PAGO **").
- **Anular** (`eliminarOrden`) — **siempre, incluso cobrada**.

Encabezado: "N en total · M pendientes de cobro" (pendientes = todas las `estado!=='Cobrado'`, sin filtro de fecha).

### 4.5 Anulación (`eliminarOrden(id)`) — literal

```js
function eliminarOrden(id){
  const o=state.ordenes.find(x=>x.id===id); if(!o) return;
  requireAuth('anular','Anular orden','Anular una orden requiere autorización de un encargado.',(u)=>{
    logBitacora('Anulación de orden',`${o.servicio||'—'} · ${money(o.monto)} · placa ${o.placa||'—'}`,u.nombre);
    state.ordenes=state.ordenes.filter(x=>x.id!==id);
    saveState();render();
  });
}
```

- Requiere PIN de un usuario con `perm.anular` (modal `requireAuth`).
- Bitácora: acción `'Anulación de orden'`, detalle `"<servicio> · $monto · placa <placa>"`, `autorizadoPor` = nombre del usuario.
- La orden se **borra físicamente**: desaparece de caja, cierre, comisiones, clientes e historial. No queda copia, solo la línea de bitácora (que no guarda id, fecha original, empleados ni método de pago).
- Si la orden ya estaba cobrada, se anula igual y la caja del día del cobro baja retroactivamente.
- No hay confirmación adicional ni motivo de anulación.

---

## 5. COBRO de orden

### 5.1 Modal `openCobro(id)`

Muestra: vehículo (`placa · tipo · marca`), `servicio · $monto`. Campos:
- **Método de pago** `cb_pago`: `Efectivo` | `Tarjeta` | `Transferencia`. Se **deshabilita** cuando se marca DTE externo.
- **Cliente**: `cb_cli_nom` (nombre), `cb_cli_tel` (teléfono). Opcional. Si `clientePorPlaca(o.placa)` encuentra un cliente, se prellenan y se muestra badge "registrado · N visita(s)" (N = órdenes con ese `clienteId`).
- **Código de autorización (cobro)** `cb_pin`: PIN inline (no usa el modal genérico `requireAuth`).
- Checkbox `cb_ext` "Facturado en otro sistema (DTE)".
- Checkbox `cb_print` "Imprimir ticket al cobrar" — **marcado por defecto**.

Abrir el modal no exige PIN; el PIN se valida al confirmar.

### 5.2 `confirmCobro()` — literal

```js
function confirmCobro(){
  const o=state.ordenes.find(x=>x.id===cobroId); if(!o) return;
  const pin=(document.getElementById('cb_pin').value||'').trim();
  const u=usuarioPorPin(pin,'cobrar');
  if(!u){document.getElementById('cb_err').textContent='Código de autorización inválido o sin permiso de cobro.';return;}
  const ext=document.getElementById('cb_ext').checked;
  o.estado='Cobrado';
  o.facturaExterna=ext;
  o.pago=ext?'':document.getElementById('cb_pago').value;
  o.fechaCobro=new Date().toISOString();
  o.cobradoPor=u.nombre;
  const cli=resolverCliente(document.getElementById('cb_cli_nom').value,document.getElementById('cb_cli_tel').value,o.placa);
  o.clienteId=cli?cli.id:null;
  const doPrint=document.getElementById('cb_print').checked;
  const id=o.id;
  logBitacora('Cobro de orden',`${o.servicio||'—'} · ${money(o.monto)}${ext?' · DTE externo':''}`,u.nombre);
  saveState();closeModal();render();
  if(doPrint) printOrden(id);
}
```

Reglas:
- Quien cobra = usuario con `perm.cobrar` cuyo PIN coincide. Se guarda su nombre en `cobradoPor`.
- Si DTE externo: `pago=''` (no se registra método), `facturaExterna=true`.
- `fechaCobro` = ahora. Es la fecha que decide en qué día entra a caja.
- El monto cobrado es `o.monto` tal como se generó; **no se puede cambiar el monto al cobrar** ni aplicar descuento/propina.
- No se registra "monto recibido" ni "cambio".
- Se vincula/crea cliente (§5.4).
- Bitácora `'Cobro de orden'` con `"<servicio> · $monto[ · DTE externo]"`.
- Se imprime el ticket si `cb_print` sigue marcado.

### 5.3 Qué entra a caja y qué no

| Caso                                             | Caja (tablero / cierre)        | Comisión | Bitácora |
| ------------------------------------------------ | ------------------------------ | -------- | -------- |
| Orden En proceso                                 | No                             | Sí       | No |
| Orden Cobrada, `facturaExterna=false`            | Sí, en el día de `fechaCobro`, bajo el método `pago` | Sí | Sí |
| Orden Cobrada, `facturaExterna=true`             | **No**; se lista aparte en "Facturado en sistema externo (DTE)" del cierre | Sí | Sí, con " · DTE externo" |

### 5.4 Clientes al cobrar (`clientePorPlaca`, `resolverCliente`)

```js
function clientePorPlaca(placa){ const p=(placa||'').trim().toUpperCase(); if(!p) return null;
  return state.clientes.find(c=>(c.placas||[]).some(x=>x.toUpperCase()===p))||null; }
function resolverCliente(nombre,telefono,placa){
  nombre=(nombre||'').trim(); telefono=(telefono||'').trim();
  const p=(placa||'').trim().toUpperCase();
  if(!nombre && !telefono) return null;
  let c=clientePorPlaca(placa);
  if(!c && telefono) c=state.clientes.find(x=>x.telefono && x.telefono.trim()===telefono);
  if(!c){ c={id:uid(),nombre:nombre||'Cliente sin nombre',telefono,placas:[],creadoEn:new Date().toISOString()}; state.clientes.push(c); }
  else { if(nombre) c.nombre=nombre; if(telefono) c.telefono=telefono; }
  if(p && !c.placas.includes(p)) c.placas.push(p);
  return c;
}
```

- Si nombre y teléfono van vacíos → la orden queda sin cliente (`clienteId=null`) aunque la placa ya esté vinculada a alguien (el prellenado del modal normalmente evita esto).
- Match 1: placa (mayúsculas). Match 2: teléfono exacto. Si no hay match, se crea.
- Al hacer match se **sobrescriben** nombre y teléfono con lo tecleado (si no van vacíos) y se agrega la placa al cliente.
- Un cliente puede tener varias placas; una placa puede quedar en varios clientes si se vinculó por teléfono distinto (no se valida exclusividad).

---

## 6. TIENDA / POS

### 6.1 Carrito (memoria, `cart=[{id,cant}]`)

- `addCart(id)`: si ya está, `cant++`; si no, agrega con `cant:1`. Se dispara tocando la tarjeta del producto (`pos-grid`). **No valida stock** (se puede agregar más que el stock disponible; la tarjeta muestra "stock N" solo informativo).
- `cartQty(id,±1)`: si queda `<=0`, se quita.
- `cartDel(id)`: quita.
- Total = Σ `productos.precio * cant` usando el precio actual del catálogo.
- El carrito se pierde al recargar la página (no está en `state`).

### 6.2 `cobrarTienda()` — literal

```js
function cobrarTienda(){
  if(!cart.length) return;
  const pago=document.getElementById('v_pago').value;
  const ext=document.getElementById('v_ext').checked;
  requireAuth('cobrar','Autorizar cobro de tienda','Cobrar requiere código de autorización.',(u)=>{
    const items=cart.map(c=>{const p=state.productos.find(x=>x.id===c.id);return{productoId:p.id,nombre:p.nombre,precio:p.precio,cantidad:c.cant};});
    const total=items.reduce((a,i)=>a+i.precio*i.cantidad,0);
    cart.forEach(c=>{const p=state.productos.find(x=>x.id===c.id);if(p)p.stock=Math.max(0,p.stock-c.cant);});
    const venta={id:uid(),fecha:new Date().toISOString(),items,total,pago,facturaExterna:ext,cobradoPor:u.nombre};
    state.ventasTienda.push(venta);
    logBitacora('Cobro de tienda',`${money(total)}${ext?' · DTE externo':''}`,u.nombre);
    cart=[];saveState();render();
    printVenta(venta.id);
  });
}
```

Reglas:
- Método de pago `v_pago` (Efectivo/Tarjeta/Transferencia) y checkbox `v_ext` "Facturado en otro sistema (DTE)" se eligen **antes** de pedir PIN. A diferencia de órdenes, el select **no se deshabilita** al marcar DTE y `pago` **sí se guarda** aunque sea DTE (pero el cierre lo ignora: suma en `tExt`).
- PIN con `perm.cobrar` vía `requireAuth`.
- La venta nace cobrada: no existe estado "pendiente" en tienda.
- **Descuento de stock**: `stock = max(0, stock − cant)`. Si se vende más de lo que hay, el stock queda en 0 y la venta se registra completa igual (sobreventa silenciosa). No se genera movimiento de kardex.
- `items` copia `precio` y `nombre` al momento de la venta.
- Bitácora `'Cobro de tienda'` con `"$total[ · DTE externo]"`.
- Ticket se imprime **siempre** (`printVenta`), sin checkbox.
- Bug latente: si un producto del carrito fue eliminado del catálogo antes de cobrar, `p.id` sobre `undefined` lanza `TypeError` (el render del carrito lo omite, pero el cobro no lo filtra).

### 6.3 Anulación de venta (`delVenta`) — literal

```js
function delVenta(id){
  const v=state.ventasTienda.find(x=>x.id===id); if(!v) return;
  requireAuth('anular','Anular venta','Anular una venta requiere autorización de un encargado.',(u)=>{
    logBitacora('Anulación de venta',`${money(v.total)}`,u.nombre);
    state.ventasTienda=state.ventasTienda.filter(x=>x.id!==id);
    saveState();render();
  });
}
```

- PIN con `perm.anular`. Bitácora `'Anulación de venta'` con solo el total.
- Se elimina físicamente. **No se devuelve el stock** de los productos vendidos.
- Solo se muestran (y por tanto solo se pueden anular desde la UI) las ventas de **hoy** ("Ventas de tienda de hoy"). Ventas de días anteriores no son visibles ni anulables.

### 6.4 Gestión de productos (dentro de Tienda, requiere `unlocked.inventario`)

- Tarjeta "Productos de tienda" se muestra solo si `unlocked.inventario`; si no, aparece `lockScreen('inventario','Productos de tienda')` con botón "Ingresar código" (permiso `inventario`). Tiene su propio botón "Bloquear sección".
- `addProducto()`: exige nombre; código, precio (default 0) y stock (default 0) libres. Sin unicidad de código.
- `delProducto(id)`: `confirm('¿Eliminar producto?')`, sin PIN, sin bitácora. Las ventas pasadas conservan `nombre`/`precio` copiados.
- No hay edición de producto ni entrada de stock de producto (solo se puede borrar y recrear).

---

## 7. INVENTARIO / INSUMOS

Sección bloqueada (`LOCK_INFO.inventario`, permiso `inventario`). Botón "Bloquear sección".

### 7.1 Movimiento de bodega por código (`movBodega`) — literal

```js
function movBodega(){
  const cod=document.getElementById('mb_cod').value.trim().toLowerCase();
  const cant=+document.getElementById('mb_cant').value;
  const tipo=document.getElementById('mb_tipo').value;
  const nota=document.getElementById('mb_nota').value.trim();
  if(!cod) return alert('Ingresa el código del insumo.');
  if(!(cant>0)) return alert('Ingresa una cantidad válida.');
  const i=state.insumos.find(x=>(x.codigo||'').toLowerCase()===cod);
  if(!i) return alert('No se encontró un insumo con el código "'+cod.toUpperCase()+'".');
  i.stock=Math.max(0,Math.round((i.stock+(tipo==='entrada'?cant:-cant))*10)/10);
  state.movimientos.push({id:uid(),insumoId:i.id,fecha:new Date().toISOString(),tipo,cantidad:cant,nota});
  saveState();render();
}
```

- Campos: Código del insumo (`mb_cod`), Movimiento (`mb_tipo`: `entrada` "Entrada (agregar)" / `salida` "Sacar"), Cantidad (`mb_cant`, step 0.5, default 1), Nota opcional (`mb_nota`, placeholder "Ej. compra, uso del día").
- Búsqueda por código case-insensitive, match exacto tras trim.
- Cantidad debe ser `>0`; se admiten decimales.
- Stock resultante: redondeado a **1 decimal**, nunca negativo. Una salida mayor al stock deja 0 sin avisar; el movimiento guarda la cantidad pedida, no la efectiva.
- No pide PIN adicional (ya se entró a la sección con permiso `inventario`).
- No se registra quién hizo el movimiento ni va a bitácora.

### 7.2 Alta de insumo (`addInsumo`)

Campos: Código (`i_cod`), Nombre (`i_nom`, obligatorio), Unidad (`i_uni`, default `'u'`), Stock (`i_stk`, step 0.5, default 0), Mínimo (`i_min`, default 0), Costo (`i_cos`, default 0). No genera movimiento inicial. Sin unicidad de código.

### 7.3 Ajuste rápido (`ajustar(id,±1)`)

```js
function ajustar(id,d){const i=state.insumos.find(x=>x.id===id);if(i){i.stock=Math.max(0,Math.round((i.stock+d)*10)/10);state.movimientos.push({id:uid(),insumoId:i.id,fecha:new Date().toISOString(),tipo:d>0?'entrada':'salida',cantidad:Math.abs(d),nota:'ajuste rápido'});saveState();render();}}
```

Botones −/+ en la tabla; genera movimiento con nota `'ajuste rápido'`.

### 7.4 Baja (`delInsumo`)

`confirm('¿Eliminar insumo?')`; sin PIN. Los movimientos quedan huérfanos y se muestran como `(eliminado)`.

### 7.5 Tabla de inventario

Columnas: Código, Insumo, Stock (`stock unidad`), Mínimo (`min unidad`), Costo (`money(costo)`), Valor (`money(stock*costo)`), Estado (`Reponer` si `stock<=min`, si no `OK`), acciones.

### 7.6 Historial

"Movimientos recientes de bodega": últimos **12** por fecha desc. Columnas: Fecha, Código, Insumo, Tipo (badge Entrada/Salida), Cantidad, Nota.

### 7.7 Alertas

- `bajos()` = `stock<=min` (inclusive).
- Tablero: métrica "Insumos bajo mínimo" (conteo) + tarjeta "Alertas de inventario" con tabla (Código, Insumo, Stock, Mínimo, badge Reponer) o "Todo el inventario está por encima del mínimo."
- No hay notificaciones fuera de la pantalla.

### 7.8 Insumo vs producto

| Aspecto            | Insumo (`insumos`)                       | Producto (`productos`)                  |
| ------------------ | ---------------------------------------- | --------------------------------------- |
| Propósito          | Consumible del servicio (shampoo, cera…) | Mercadería que se vende en tienda        |
| Campos             | codigo, nombre, unidad, stock, min, costo | codigo, nombre, precio, stock           |
| Precio de venta    | No                                       | Sí                                      |
| Costo              | Sí                                       | No                                      |
| Stock mínimo/alerta| Sí                                       | No                                      |
| Kardex             | `movimientos` (entrada/salida)           | No; solo decremento al vender           |
| Cómo baja el stock | Manual (movimiento/ajuste)               | Automático al cobrar venta              |
| Cómo sube          | Manual                                   | Solo al crear el producto               |
| Dónde se gestiona  | Sección Inventario                       | Tarjeta en Tienda (requiere `inventario`)|
| Consumo por orden  | **No existe** descuento automático por servicio (listado como "próximo paso") | — |

---

## 8. MÁQUINAS Y MANTENIMIENTO

Sección bloqueada (`LOCK_INFO.maquinas`, permiso **`mantenimiento`**). Botón "Bloquear sección".

### 8.1 Máquinas

- `addMaquina()`: solo nombre (obligatorio).
- `delMaquina(id)`: `confirm('¿Eliminar máquina y su historial?')` → borra la máquina **y todos sus mantenimientos** en cascada. Sin PIN ni bitácora.
- Tabla: Máquina, Nº mantenimientos, Último (`fecha` `YYYY-MM-DD` del más reciente o `—`).

### 8.2 Mantenimiento (`addMant`) — literal

```js
function addMant(){
  if(!state.maquinas.length) return alert('Primero agrega una máquina.');
  state.mantenimientos.push({id:uid(),maquinaId:document.getElementById('m_maq').value,
    fecha:document.getElementById('m_fec').value||todayStr(),tipo:document.getElementById('m_tipo').value,
    desc:document.getElementById('m_desc').value.trim(),costo:+document.getElementById('m_cos').value||0});
  saveState();render();
}
```

- Campos: Máquina (select), Fecha (date, default hoy; puede ser pasada o futura), Tipo (`Preventivo` | `Correctivo`), Descripción (libre, placeholder "Ej. cambio de aceite, revisión de boquillas"), Costo ($, default 0).
- Única validación: que exista al menos una máquina. Descripción y costo pueden ir vacíos/0.
- No hay edición ni eliminación individual de un mantenimiento (solo cascada al borrar máquina).
- No hay "próximo mantenimiento", frecuencia ni alerta.

### 8.3 Impacto económico

**Ninguno.** `costo` solo se muestra en la tabla "Historial de mantenimiento" (badge `Preventivo` info / `Correctivo` warn). No resta de caja, no aparece en cierre ni en tablero, no existe colección de gastos. Tampoco hay totalización de costos por máquina o período.

---

## 9. CIERRE DE CAJA (`vCierre`)

Sección bloqueada (permiso `cierre`). Selector `input type=date` → `cierreFecha` (default `todayStr()`, en memoria).

### 9.1 Cálculo — literal

```js
const f=cierreFecha;
const cobradas=state.ordenes.filter(o=>o.estado==='Cobrado'&&esFecha(o.fechaCobro,f));
const vts=state.ventasTienda.filter(v=>esFecha(v.fecha,f));
const metodos=['Efectivo','Tarjeta','Transferencia'];
const cwLocal={}, tLocal={}; metodos.forEach(m=>{cwLocal[m]=0;tLocal[m]=0;});
let cwExt=0, tExt=0;
cobradas.forEach(o=>{ if(o.facturaExterna) cwExt+=(+o.monto); else cwLocal[o.pago]=(cwLocal[o.pago]||0)+(+o.monto); });
vts.forEach(v=>{ if(v.facturaExterna) tExt+=v.total; else tLocal[v.pago]=(tLocal[v.pago]||0)+v.total; });
const cwLocalTot=metodos.reduce((a,m)=>a+cwLocal[m],0);
const tLocalTot=metodos.reduce((a,m)=>a+tLocal[m],0);
const cajaTot=cwLocalTot+tLocalTot;
const com=state.ordenes.filter(o=>esFecha(o.fecha,f)).reduce((a,o)=>a+o.comisionTotal,0);
const pendientes=state.ordenes.filter(o=>o.estado!=='Cobrado'&&esFecha(o.fecha,f)).length;
```

### 9.2 Qué suma y cómo

| Métrica                              | Fórmula                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------ |
| Órdenes del cierre                   | `estado==='Cobrado'` y **`fechaCobro`** cae en `f` (no la fecha de creación)         |
| Ventas del cierre                    | `ventasTienda` con `fecha` en `f`                                                    |
| Carwash (caja) por método            | Σ `monto` de órdenes locales agrupadas por `pago`                                    |
| Tienda (caja) por método             | Σ `total` de ventas locales agrupadas por `pago`                                     |
| `cwLocalTot` / `tLocalTot`           | Suma **solo** de las tres claves `Efectivo/Tarjeta/Transferencia`; si una orden local tuviera `pago` fuera de esas (p.ej. `''`), se acumula en una clave fantasma que **no** entra al total |
| **Total en caja** = "Total a entregar en caja" | `cwLocalTot + tLocalTot`                                                   |
| Carwash facturado afuera (`cwExt`)   | Σ `monto` de órdenes cobradas con `facturaExterna`                                   |
| Tienda facturada afuera (`tExt`)     | Σ `total` de ventas con `facturaExterna`                                             |
| Total en sistema externo             | `cwExt + tExt` — "no entra en el conteo de caja"                                     |
| Comisiones del día                   | Σ `comisionTotal` de órdenes **creadas** en `f` (cualquier estado, incluidas DTE)    |
| Aviso pendientes                     | "Hay N orden(es) de este día aún sin cobrar" = creadas en `f` y no cobradas          |

### 9.3 Lo que el cierre NO hace

- **No guarda nada**: no existe colección de cierres, no hay "conteo real", "diferencia", "fondo inicial", "retiros" ni "gastos". Lo "esperado" es simplemente `cajaTot` calculado al vuelo.
- No resta comisiones ni costos de mantenimiento del total en caja (se muestran como informativos).
- No bloquea el día ni impide cobrar/anular después de "cerrar".
- No distingue efectivo físico de tarjeta/transferencia en el "Total a entregar" (los suma todos, aunque desglosa por método).

---

## 10. TABLERO (`vTablero`)

Sección bloqueada (permiso `tablero`). Todas las métricas son de **hoy** (`todayStr()`, UTC).

```js
const creadasHoy=state.ordenes.filter(o=>esFecha(o.fecha));
const cobradasHoy=state.ordenes.filter(o=>o.estado==='Cobrado'&&!o.facturaExterna&&esFecha(o.fechaCobro));
const caja=cobradasHoy.reduce((a,o)=>a+(+o.monto),0);
const cajaTienda=state.ventasTienda.filter(v=>!v.facturaExterna&&esFecha(v.fecha)).reduce((a,v)=>a+v.total,0);
const porCobrar=state.ordenes.filter(o=>o.estado!=='Cobrado').length;
const com=creadasHoy.reduce((a,o)=>a+o.comisionTotal,0);
const low=bajos();
const recientes=[...state.ordenes].sort((a,b)=>b.fecha.localeCompare(a.fecha)).slice(0,5);
```

| Métrica                 | Fórmula exacta                                                                                     |
| ----------------------- | -------------------------------------------------------------------------------------------------- |
| **En caja hoy**         | `caja + cajaTienda` = Σ monto de órdenes `Cobrado`, no DTE, con `fechaCobro` hoy + Σ total de ventas de tienda no DTE con `fecha` hoy |
| **Órdenes de hoy**      | `creadasHoy.length` = órdenes con `fecha` (creación) hoy, cualquier estado                          |
| **Pendientes de cobro** | Nº de órdenes con `estado!=='Cobrado'` **de cualquier fecha** (no solo hoy)                        |
| **Comisiones de hoy**   | Σ `comisionTotal` de `creadasHoy` (incluye En proceso y DTE)                                       |
| **Insumos bajo mínimo** | `bajos().length` (`stock<=min`)                                                                    |
| Alertas de inventario   | Tabla de `bajos()`                                                                                 |
| Órdenes recientes       | 5 más recientes por `fecha` de creación, sin botones de acción (`tblOrdenes(recientes,false)`)     |

Coincide con el cierre para la fecha de hoy: "En caja hoy" del tablero = "Total en caja" del cierre con `cierreFecha=hoy`.

---

## 11. CONTROL DE ACCESO

### 11.1 Mecanismo

```js
function usuarioPorPin(pin,permiso){return state.usuarios.find(u=>u.pin===pin && u.perm && u.perm[permiso]);}
```

- No hay sesión ni login. Cada acción protegida pide un PIN en el momento; se busca el **primer** usuario cuyo PIN coincide **y** que tenga el permiso pedido. Un PIN correcto sin el permiso da el mismo error que un PIN inexistente ("Código inválido o sin permiso para esta acción.").
- Dos caminos: `requireAuth(permiso,titulo,sub,onOk)` (modal genérico, Enter confirma, `submitAuth`) y el PIN inline del modal de cobro de orden (`cb_pin` en `confirmCobro`).
- `closeModal()` limpia `authCtx` y `cobroId`; clic fuera del modal lo cierra.

### 11.2 Secciones bloqueadas (`VIEWS` + `LOCK_INFO` + `unlocked`)

| Vista (`VIEWS.id`) | `lock`        | Permiso requerido | Libre? |
| ------------------ | ------------- | ----------------- | ------ |
| tablero            | `tablero`     | `tablero`         | No |
| ordenes            | —             | —                 | **Sí** (crear órdenes, ver historial, abrir modal de cobro, imprimir tickets) |
| tienda             | —             | —                 | **Sí** (POS, carrito, ver ventas de hoy). La tarjeta "Productos de tienda" exige `unlocked.inventario` |
| clientes           | `clientes`    | `clientes`        | No |
| inventario         | `inventario`  | `inventario`      | No |
| maquinas           | `maquinas`    | **`mantenimiento`** | No |
| comisiones         | `comisiones`  | `comisiones`      | No |
| cierre             | `cierre`      | `cierre`          | No |
| config             | `config`      | `config`          | No |

- `render()`: si la vista tiene `lock` y `!unlocked[lock]` → pinta `lockScreen` ("Sección restringida. Ingresa el código de autorización para continuar." + botón "Ingresar código" → `unlockSection`).
- `unlockSection(sec)` → `requireAuth(info.permiso, 'Acceso a '+nombre, 'Solo personal autorizado puede entrar a esta sección.', ()=>{unlocked[sec]=true;render();})`.
- `lockSection(sec)` → `unlocked[sec]=false`. Botón "Bloquear sección" arriba a la derecha de cada sección bloqueable (y en la tarjeta de productos de Tienda).
- En el nav, las vistas con lock muestran `○` mientras están bloqueadas (`.lk`).
- **Desbloquear una sección no registra en bitácora** ni guarda quién la abrió.
- **Bloqueo al recargar**: `unlocked` es una variable en memoria inicializada toda en `false`; al recargar la página todo vuelve a bloqueado. `resetDatos` y `vaciarDatos` también reinician `unlocked`.
- Una vez desbloqueada, la sección queda abierta para cualquiera que use ese dispositivo hasta que alguien pulse "Bloquear sección" o recargue.

### 11.3 Acciones que piden PIN por acción (independiente de la sección)

| Acción                    | Permiso   | Función            | Vía |
| ------------------------- | --------- | ------------------ | --- |
| Confirmar cobro de orden  | `cobrar`  | `confirmCobro`     | PIN inline `cb_pin` |
| Cobrar venta de tienda    | `cobrar`  | `cobrarTienda`     | `requireAuth` |
| Anular orden              | `anular`  | `eliminarOrden`    | `requireAuth` |
| Anular venta              | `anular`  | `delVenta`         | `requireAuth` |

Acciones **sin** PIN (solo `confirm()` o nada): crear orden, agregar/borrar producto, insumo, máquina, mantenimiento, movimiento de bodega, ajuste rápido, agregar/desactivar/borrar empleado, agregar/editar/borrar servicio, agregar/borrar usuario, cambiar PIN, borrar cliente, reset/vaciar datos (estas últimas viven en secciones que a su vez sí tienen lock).

### 11.4 Bitácora (`logBitacora`)

```js
function logBitacora(accion,detalle,quien){state.bitacora=state.bitacora||[];state.bitacora.unshift({id:uid(),fecha:new Date().toISOString(),accion,detalle,autorizadoPor:quien});}
```

| `accion`              | `detalle`                                          | Disparador       |
| --------------------- | -------------------------------------------------- | ---------------- |
| `Cobro de orden`      | `"<servicio|—> · $monto[ · DTE externo]"`          | `confirmCobro`   |
| `Anulación de orden`  | `"<servicio|—> · $monto · placa <placa|—>"`        | `eliminarOrden`  |
| `Cobro de tienda`     | `"$total[ · DTE externo]"`                         | `cobrarTienda`   |
| `Anulación de venta`  | `"$total"`                                         | `delVenta`       |

- `autorizadoPor` siempre es `u.nombre` del usuario del PIN.
- No guarda ids de orden/venta, método de pago, empleados, cliente ni items.
- Se ve en Configuración → "Bitácora de autorizaciones" (subtítulo "cobros y anulaciones"), solo las **15** más recientes; sin filtro ni exportación.

### 11.5 Gestión de usuarios (en Config, requiere `config`)

- `addUsuario()`: nombre obligatorio, PIN obligatorio y **único** ("Ese código ya está en uso por otro usuario."), rol (Encargado/Vendedor/Otro), 9 checkboxes de permisos. Texto en UI: "Acceso a secciones (sin código, quedan libres para todos: Órdenes de trabajo y Tienda)".
- `cambiarPin(id)`: `prompt()` con el PIN actual visible; no vacío; único entre los demás.
- `delUsuario(id)`: `confirm`. No impide borrar al último usuario con `anular`/`config` (podría dejar el sistema sin acceso a Config hasta recargar y que `migrate` reponga defaults solo si la lista queda **vacía**).
- Tabla muestra el PIN en claro (`<td class="mono">${u.pin}</td>`).

---

## 12. IMPRESIÓN DE TICKET

Mecanismo: se inyecta HTML en `#ticket-print` y se llama `window.print()`. CSS `@media print` oculta todo salvo `#ticket-print`. Ticket de 300 px de ancho, `Courier New` 13 px, separadores de línea punteada (`dashRow`). Encabezado "ELITE SERVICE".

### 12.1 Ticket de orden (`printOrden`)

```
ELITE SERVICE
Carwash · Ticket de servicio
------------------------------
Fecha: <fmtDate(o.fecha)>          ← fecha de CREACIÓN, no de cobro
Placa: <placa|—>
Vehículo: <tipo · marca · color>
Servicio: <servicio|—>
Atendió: <primeros nombres de empleados>
------------------------------
TOTAL                    $monto
<pagoLine>
------------------------------
¡Gracias por su visita!
```

`pagoLine`:
- `estado!=='Cobrado'` → `** PENDIENTE DE PAGO **`
- Cobrado y `!facturaExterna` → `Pago: <Efectivo|Tarjeta|Transferencia>`
- Cobrado y `facturaExterna` → **nada** (línea vacía). El ticket sale "limpio", sin mención a DTE ni método.

Omite siempre: comisión, `cobradoPor`, cliente, `fechaCobro`, id de orden, número correlativo, NIT/dirección/teléfono del negocio, IVA.

Se dispara: al cobrar (si `cb_print`), o con el botón "Ticket" del historial (cualquier estado).

### 12.2 Ticket de venta (`printVenta`)

```
ELITE SERVICE
Tienda · Ticket de venta
------------------------------
Fecha: <fmtDate(v.fecha)>
------------------------------
<cantidad> × <nombre>        $subtotal   (por item)
------------------------------
TOTAL                    $total
<Pago: X | nada si facturaExterna>
------------------------------
¡Gracias por su compra!
```

Se imprime **siempre** al cobrar y desde el botón "Ticket" de ventas de hoy. Igual que la orden: si `facturaExterna`, no imprime método ni marca DTE.

---

## 13. CONFIGURACIÓN (`vConfig`, permiso `config`)

Tarjetas y operaciones:

1. **Usuarios y permisos** — §11.5. Hint visible: "códigos de autorización · prueba: Ana 1234 / Pedro 5678".
2. **Bitácora de autorizaciones** — 15 últimas, §11.4.
3. **Empleados** — `addEmp` (nombre), `toggleEmp` (Activar/Desactivar; los inactivos no aparecen al crear orden pero sí en comisiones históricas), `delEmp` (`confirm`; las órdenes conservan el id y muestran `—` en `nombresEmp`, y su comisión desaparece del resumen por empleado).
4. **Catálogo de servicios** — `addServ` (nombre obligatorio, precio default 0), edición inline `editServId` → `saveServEdit` (nombre no vacío, precio `+valor||0`), `delServ` (`confirm`). Columna "Comisión" con `comision(precio)`. Los cambios no afectan órdenes ya creadas.
5. **Datos**:
   - `resetDatos()`: `confirm` → `state=seed(); seedOrdenes(state); cart=[]; unlocked=all false; saveState(); render()`.
   - `vaciarDatos()`: `confirm` → estado vacío con usuarios Kevin (`1111`) y Fausto (`0000`), permisos totales; `cart=[]`, `unlocked` todo false.

No hay: exportar/importar datos, cambiar nombre del negocio, IVA, moneda, impresora, ni edición de la tabla de comisiones (está hardcodeada en `comision`).

---

## 14. CLIENTES (módulo presente en el código, no pedido pero forma parte del negocio)

Sección bloqueada (permiso `clientes`). Hint: "se registran al cobrar una orden". No hay alta manual de clientes: solo nacen en `confirmCobro` vía `resolverCliente`.

`vClientes`: búsqueda `clienteQuery` por nombre, teléfono o placa (contains, case-insensitive). Por cliente: Teléfono, Placas (badges), **Visitas** = nº de órdenes con `clienteId` (cualquier estado), **Último servicio** = orden más reciente (fecha, placa, servicio), **Servicio más frecuente** (`servicioFrecuente`: moda por `servicio`, con `(N×)`), **Total facturado** = Σ `monto` de órdenes **cobradas** (incluye DTE externo). Orden desc por visitas.

`verHistorialCliente(id)`: modal con tabla Fecha/Placa/Servicio/Monto/Estado.

`delCliente(id)`: `confirm('¿Eliminar este cliente? Las órdenes ya registradas se conservan, solo se quita el vínculo.')` → pone `clienteId=null` en sus órdenes y borra el cliente. Sin PIN ni bitácora.

---

## 15. Discrepancias entre `CLAUDE.md`/`README.md` del prototipo y el código

1. `CLAUDE.md` lista 4 permisos (`inventario, mantenimiento, cobrar, anular`); el código tiene **9** (agrega `tablero, clientes, comisiones, cierre, config`).
2. `CLAUDE.md` dice que solo Inventario y Máquinas están bloqueadas y que proteger Configuración está pendiente; el código ya bloquea **Tablero, Clientes, Comisiones, Cierre y Configuración**. Solo Órdenes y Tienda son libres.
3. `CLAUDE.md` no documenta la colección `clientes` ni el campo `ordenes.clienteId`; existen en el código.
4. `CLAUDE.md` dice `mantenimientos.tipo` sin valores; el código usa `'Preventivo'|'Correctivo'`.
5. `README.md` dice Pedro tiene "Inventario, mantenimiento, cobrar"; correcto, pero además no tiene acceso a ninguna sección bloqueada nueva.
6. `CLAUDE.md` dice "Solo al cobrar la venta entra a caja" — cierto para caja; pero la **comisión** entra desde la creación (tablero/cierre/comisiones filtran por `fecha`).
7. La tabla de comisiones del `CLAUDE.md` ("$14 – $19.99") es equivalente al código, pero el código admite centavos intermedios (19.995 → $1).
8. El botón "Vaciar todo (dejar solo Kevin y Fausto)" y esos dos usuarios no aparecen en ninguna documentación.

---

## 16. Reglas de negocio extraídas

### Órdenes
1. Una orden de carwash se crea en estado `En proceso` y solo puede pasar a `Cobrado`; no existe estado intermedio ni reverso.
2. Para crear una orden son obligatorios: servicio (texto no vacío), monto `> 0` y al menos un empleado; placa, tipo, marca y color son opcionales.
3. Al elegir un servicio del catálogo se autocompleta el monto con su precio, pero el monto queda editable y el guardado es el que se tecleó.
4. La orden guarda el nombre del servicio como texto y el monto como número; cambios posteriores al catálogo no afectan órdenes existentes.
5. `comisionTotal` se calcula con `comision(monto)` al crear la orden y nunca se recalcula.
6. Solo los empleados con `activo=true` pueden asignarse a una orden nueva.
7. No existe edición de una orden; corregir implica anularla y crear otra.
8. Anular una orden requiere PIN de un usuario con `perm.anular`, escribe en bitácora `Anulación de orden` con servicio, monto, placa y nombre del autorizador, y borra la orden del sistema.
9. Una orden ya cobrada puede anularse; al hacerlo su monto sale de la caja del día en que se cobró.
10. Cualquier persona sin PIN puede crear órdenes y abrir el modal de cobro; el PIN se exige al confirmar.

### Cobro
11. Cobrar una orden requiere PIN de un usuario con `perm.cobrar`; su nombre queda en `cobradoPor`.
12. El método de pago (`Efectivo`, `Tarjeta`, `Transferencia`) o la marca `facturaExterna` (DTE) se decide al cobrar, no al crear.
13. Si la orden se marca DTE externo, `pago` se guarda vacío y el select de método se deshabilita.
14. `fechaCobro` se fija al momento de confirmar y es la fecha que determina el día de caja de la orden.
15. El monto cobrado es exactamente `monto` de la orden; no hay descuentos, propinas, pagos parciales ni registro de efectivo recibido/cambio.
16. Cada cobro de orden escribe en bitácora `Cobro de orden` con servicio, monto y sufijo ` · DTE externo` cuando aplica.
17. Al cobrar se puede anotar nombre y/o teléfono del cliente; con al menos uno se crea o actualiza un cliente y se le vincula la placa.
18. La vinculación de cliente busca primero por placa (mayúsculas) y luego por teléfono exacto; si no hay match, crea uno nuevo.
19. Por defecto el ticket se imprime al cobrar una orden; se puede desmarcar antes de confirmar.

### Comisiones
20. La comisión de una orden se calcula sobre su `monto` con tramos: `<14 → 0`, `<20 → 1`, `<25 → 2`, `<35 → 3`, `<40 → 4`, `>=40 → round(monto*0.12, 2)`.
21. La comisión es por orden individual; nunca se acumulan montos de varias órdenes para determinar el tramo.
22. Con varios empleados en una orden, comisión y venta atribuida se dividen en partes iguales (`/ empleados.length`), sin redondeo por parte.
23. La comisión cuenta desde que la orden se crea (`fecha`), aunque siga `En proceso`.
24. Las órdenes marcadas DTE externo comisionan igual que las locales.
25. Las ventas de tienda no generan comisión.
26. Una orden anulada no comisiona (deja de existir).
27. El resumen de comisiones ofrece tres rangos por fecha de creación: hoy, últimos 7 días y todo.
28. Un empleado eliminado deja de aparecer en el resumen de comisiones aunque tenga órdenes; su parte no se muestra en "Total a pagar".

### Tienda
29. Una venta de tienda nace cobrada; no hay estado pendiente.
30. Cobrar en tienda requiere PIN con `perm.cobrar`; método de pago y marca DTE se eligen antes del PIN.
31. En ventas de tienda el método de pago se guarda aunque sea DTE externo, pero el cierre no lo cuenta en caja.
32. Al cobrar, el stock de cada producto baja `cantidad` con piso en 0; se permite vender sin stock suficiente.
33. Cada item de la venta copia nombre y precio vigentes al momento del cobro.
34. El cobro de tienda escribe en bitácora `Cobro de tienda` con el total y sufijo ` · DTE externo` cuando aplica, e imprime ticket siempre.
35. Anular una venta requiere PIN con `perm.anular`, escribe `Anulación de venta` con el total, borra la venta y **no** repone stock.
36. Solo se listan y anulan ventas del día actual.
37. Alta y baja de productos exigen tener desbloqueada la sección con permiso `inventario`; la baja solo pide `confirm`.

### Inventario
38. Un insumo se identifica por `codigo` (texto, comparado sin mayúsculas/minúsculas) y no se valida que sea único.
39. Los movimientos de bodega son `entrada` o `salida`, con cantidad `> 0` (decimales permitidos) y nota opcional.
40. El stock de insumos se redondea a 1 decimal y nunca baja de 0; una salida mayor al stock lo deja en 0 sin error.
41. El movimiento registra la cantidad solicitada, no la efectivamente descontada.
42. Los botones −/+ generan movimientos de 1 unidad con nota `ajuste rápido`.
43. Un insumo está "bajo mínimo" cuando `stock <= min`; se cuenta en tablero y se lista en "Alertas de inventario".
44. El valor de inventario de un insumo es `stock * costo`.
45. Los insumos no se descuentan automáticamente al realizar un servicio.
46. Los productos de tienda no tienen kardex, mínimo, costo ni unidad; su stock solo baja por ventas y solo sube al crearlos.
47. Borrar un insumo deja sus movimientos huérfanos (se muestran como "(eliminado)").

### Máquinas
48. Un mantenimiento pertenece a una máquina, tiene fecha (`YYYY-MM-DD`, editable), tipo `Preventivo` o `Correctivo`, descripción y costo.
49. Registrar mantenimiento solo exige que exista al menos una máquina.
50. El costo de mantenimiento no afecta caja, cierre ni tablero.
51. Borrar una máquina borra todo su historial de mantenimiento.

### Cierre y caja
52. La caja de un día suma órdenes `Cobrado` no DTE por `fechaCobro` más ventas de tienda no DTE por `fecha`, desglosadas por método.
53. Lo facturado en sistema externo (DTE) se totaliza aparte y no entra al "Total a entregar en caja".
54. El "Total a entregar en caja" solo suma las claves `Efectivo`, `Tarjeta` y `Transferencia`; suma tarjeta y transferencia junto con efectivo.
55. "Comisiones del día" en el cierre suma `comisionTotal` de órdenes creadas ese día, de cualquier estado.
56. El cierre avisa cuántas órdenes creadas ese día siguen sin cobrar.
57. El cierre no persiste ningún registro, no admite conteo real ni diferencia, y no bloquea operaciones posteriores.
58. Las fechas de "día" se comparan en UTC (`toISOString().slice(0,10)`), no en hora local.

### Tablero
59. "En caja hoy" = caja de órdenes cobradas hoy (no DTE) + ventas de tienda de hoy (no DTE).
60. "Órdenes de hoy" cuenta órdenes creadas hoy sin importar estado.
61. "Pendientes de cobro" cuenta todas las órdenes `En proceso` de cualquier fecha.
62. "Comisiones de hoy" suma `comisionTotal` de órdenes creadas hoy.
63. "Insumos bajo mínimo" cuenta insumos con `stock <= min`.
64. "Órdenes recientes" muestra las 5 más nuevas por fecha de creación, sin acciones.

### Acceso y bitácora
65. No hay sesión: cada acción protegida pide PIN y se acepta el primer usuario cuyo PIN coincida y tenga el permiso requerido.
66. El campo `rol` es solo etiqueta; la autorización se decide únicamente por las claves de `perm`.
67. Los PIN son únicos entre usuarios, se guardan y muestran en claro, sin restricción de formato.
68. Órdenes de trabajo y Tienda son libres; Tablero, Clientes, Inventario, Máquinas (permiso `mantenimiento`), Comisiones, Cierre y Configuración exigen PIN con el permiso homónimo para desbloquearse.
69. El desbloqueo de una sección es por dispositivo y en memoria: se pierde al recargar la página y puede cerrarse con "Bloquear sección"; no se registra en bitácora.
70. La tarjeta de gestión de productos dentro de Tienda comparte el desbloqueo de `inventario`.
71. La bitácora registra exactamente cuatro acciones: `Cobro de orden`, `Anulación de orden`, `Cobro de tienda`, `Anulación de venta`, con detalle textual y nombre del autorizador; nada más se audita.
72. La bitácora solo muestra las 15 entradas más recientes y no se puede filtrar ni exportar.

### Ticket
73. El ticket de orden imprime fecha de creación, placa, vehículo, servicio, primeros nombres de los empleados y total; nunca comisión, cobrador ni cliente.
74. Si la orden está `En proceso`, el ticket dice `** PENDIENTE DE PAGO **`; si se cobró localmente, `Pago: <método>`; si es DTE externo, no imprime ninguna línea de pago ni la marca DTE.
75. El ticket de venta imprime fecha, items (cantidad × nombre, subtotal), total y `Pago: <método>` salvo que sea DTE externo.

### Clientes
76. Los clientes solo se crean al cobrar una orden; no hay alta manual.
77. Un cliente puede tener varias placas; las visitas se cuentan por órdenes vinculadas y el total facturado suma solo órdenes cobradas (incluye DTE).
78. Borrar un cliente desvincula sus órdenes (`clienteId=null`) sin borrarlas.

### Configuración y datos
79. Empleados se pueden desactivar (dejan de aparecer al crear órdenes) o borrar (las órdenes conservan el id; su nombre se muestra como `—`).
80. Servicios se crean, editan (nombre y precio) y borran; el catálogo muestra la comisión de referencia por precio.
81. "Reiniciar con datos de ejemplo" reemplaza todo por `seed()` + `seedOrdenes()`; "Vaciar todo" deja solo los usuarios Kevin (`1111`) y Fausto (`0000`) con permisos totales.
82. Todos los datos viven en `localStorage['elite_erp_state']` de un solo dispositivo; `migrate` normaliza estados antiguos (`Terminado` → `Cobrado`, permisos de sección heredados de `anular`).
