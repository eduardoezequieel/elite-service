# 118 — Nueva renta en cuatro pasos

**Estado:** Aprobada — 19 oct 2026, en el chat: «A» (apruebo las dos specs)
**Módulo:** `features/rentals`, `features/renters` (web) · `rentals`, `renters` (api) · `@elite/shared` | **Depende de:** 108, 115, 117

## Contexto

La pantalla de nueva renta junta cliente, fechas, carro y contrato en un solo formulario largo, con
el contrato escondido en «Más datos del contrato». El prototipo aprobado
`docs/prototype/rentals-tabs.html` (19 oct 2026) la parte en cuatro pasos —**Carro → Cliente →
Contrato → Confirmar**— y rehace el paso Cliente según el prototipo «Paso 2 Cliente» que trajo el
dueño. Mínimo texto; trato de usted en lo nuevo.

## Historias

- Como dueño, quiero rentar paso a paso, para no ver todo junto.
- Como dueño, quiero encontrar o registrar al cliente rápido y sin duplicarlo.
- Como dueño, quiero saber antes de guardar si el carro sale ya o solo queda apartado.

## Criterios de aceptación

### Asistente

- **Dado** `/rentals/agreements/new`, **entonces** se ve como el modal del prototipo: título
  «Nueva renta», cuatro pasos arriba (hechos con ✓, el actual resaltado; se puede volver a uno ya
  alcanzado tocándolo) y un pie fijo con «Cerrar»/«Atrás», el **Total** (solo si ya hay carro) y un
  botón principal. En `bahia` ocupa todo el ancho.
- Prefill de siempre (`vehicleId`, `from`, `to`, `customerId`): con carro y fechas arranca en
  Cliente; con carro, fechas y cliente, en Contrato.

### 1 · Carro

- Fechas con `DateRangeField` sin atajos (flota sobre el contenido, no lo empuja) y dos campos
  lado a lado, también en `bahia`: «Hora de salida» y «Hora de regreso» (por defecto 11:00; un
  solo día regresa al siguiente).
- Lista de carros libres en el rango: miniatura 3D, placa, nombre y total del rango. Filtros en una
  fila: buscador «Placa o modelo» y chips por tipo con su cantidad (solo los tipos con carros
  libres; «Todos» primero). Sin resultados: «Sin resultados»; sin libres: «Nada libre».
- «Siguiente» exige fechas válidas y carro.

### 2 · Cliente

- **Buscar:** caja «Buscar por nombre, DUI o teléfono» con ✕ para borrar. Sin texto: «Recientes»
  (los 5 con renta más reciente); con texto: «N resultados» (todas las palabras en el nombre, o 3+
  dígitos del documento o el teléfono). Sin cliente elegido: «Elija un cliente para seguir».
- Tarjeta: iniciales, nombre, documento, teléfono, «N rentas, la última hace X» (o «Cliente
  nuevo») y sello de licencia: «Licencia vigente» (verde), «Licencia vence dd/mm» (≤30 días,
  ámbar) o «Licencia vencida» (rojo). Tocarla la marca (borde y ✓) sin avanzar; otra vez, la
  desmarca.
- Elegido con licencia vencida: aviso rojo «La licencia de X venció el dd/mm/aaaa. Pida la
  licencia nueva para seguir.» con «Actualizar licencia» (abre el formulario en modo edición) y
  «Siguiente» desactivado. Por vencer: aviso ámbar y deja seguir. Bloqueado: como hoy, no sigue.
- Sin resultados: «Nadie coincide con «…».» y «Crear cliente con «…»». Con resultados, abajo:
  «Cliente nuevo». Lo escrito pasa al campo que corresponde (8 dígitos → celular; otros dígitos →
  documento; texto → nombre).
- **Crear / actualizar:** botón «¿Ya es cliente? Búsquelo…» que vuelve a buscar; «Nombre
  completo»; documento con tipo **DUI** (máscara `00000000-0`, 9 dígitos) o **Pasaporte**
  (mayúsculas, 5+); celular con país **SV +503, GT +502, HN +504, US +1** y su máscara; «Número
  de licencia» con la casilla «Es el mismo número del DUI»; «La licencia vence el» con «Vigente»,
  «Vence en N días. Recuérdele renovarla.» o «Ya venció. No se puede rentar con esta licencia.»
- Avisos en vivo: nombre parecido a uno registrado («¿Es X? Ya está registrado.» + «Usar este
  cliente») y documento repetido («Este documento ya es de X.» + «Usar este cliente»), con
  `GET /renters?q=`. Abajo, «Para guardar falta: …». «Guardar y seguir» se activa solo con todo
  completo, licencia vigente y sin documento repetido; guarda (POST o PATCH) y pasa a Contrato.

### 3 · Contrato

- Seguro **Sí · $X/día** (CDW de ajustes) / **No**. «Deducible ($)» solo con Sí; «Descuento ($)»
  va al lado del deducible o a todo el ancho sin seguro. «Otro conductor» y «Notas» como hoy;
  «Garantía» y «Método» como hoy.
- «Revisar» valida: descuento numérico, ≥ 0 y **no mayor que el subtotal**; con seguro, deducible
  > 0.

### 4 · Confirmar

- Resumen: carro con su imagen 3D, y filas Fechas, Cliente, Seguro (y Conductor si hay), cada una
  con «Cambiar» a su paso; desglose (días × tarifa, seguro, descuento).
- Si la salida es **hoy**: «¿Se lleva el carro ahora?» con **Sí, ahora** (por defecto) / **No,
  solo apartar**. El botón dice **«Seguir a la entrega»** (crea y abre
  `/rentals/agreements/:id?action=deliver`) o **«Reservar»**. Si la salida es otro día: «Se aparta
  el carro · Sale …» y solo **«Reservar»**.

## Reglas de negocio

- **RN-1:** el descuento no puede pasar de `(tarifa + CDW) × días + cargos`. El API lo rechaza en
  alta y en edición con 422 `DISCOUNT_EXCEEDS_SUBTOTAL` (`{ code, message }`).
- **RN-2:** con licencia vencida no se avanza desde el paso Cliente (regla de la web; el API no
  cambia en esto).
- **RN-3:** el celular de otro país se guarda con su prefijo («+1 713 555 0142»); el de El Salvador,
  sin prefijo, como hoy.

## Permisos

Sin cambios: `rentals.manage` para rentar; `renters.create`/`renters.update` (los que ya existan)
para guardar el cliente.

## Datos

Sin cambios al schema.

## API

| Método | Ruta | Request | Response | Errores |
| ------ | ---- | ------- | -------- | ------- |
| GET | `/renters` | + `sort=recent` (por renta más reciente) | cada ítem + `rentalsCount`, `lastRentalAt` | sin cambio |
| POST | `/rentals/agreements` | sin cambio | sin cambio | + 422 `DISCOUNT_EXCEEDS_SUBTOTAL` |
| PATCH | `/rentals/agreements/:id` | sin cambio | sin cambio | + 422 `DISCOUNT_EXCEEDS_SUBTOTAL` |

`rentalsCount` cuenta rentas no canceladas; `lastRentalAt` es la salida más reciente ya ocurrida
(o `null`).

## UI

`agreement-form-screen.tsx` pasa a asistente (componentes por paso en `features/rentals`); el paso
Cliente reemplaza a `customer-field.tsx` / `QuickRenterForm` en esta pantalla. `bahia` y tablet
contemplados.

## Fuera de alcance

- Libre, Rentas, Historial (117); asistente de entrega/recepción; edición de una renta existente.

## Tareas

- [ ] Shared: `sort=recent`, `rentalsCount`, `lastRentalAt`; código `DISCOUNT_EXCEEDS_SUBTOTAL` (+ tests).
- [ ] API: estadísticas y orden en `/renters`; RN-1 en alta y edición (+ tests).
- [ ] Web: asistente, pasos 1–4, máscaras y avisos del cliente (+ tests de la lógica pura).
- [ ] `scripts/verify-118.sh`: `/renters` con `rentalsCount`/`lastRentalAt`/`sort=recent` y el
      422 del descuento, contra el stack.

## Verificación

`pnpm build && pnpm lint && pnpm test && bash scripts/verify-118.sh`
