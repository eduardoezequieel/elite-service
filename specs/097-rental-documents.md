# 097 — Contrato e inspección imprimibles

**Estado:** Aprobada (por chat, 1 oct 2026, misma nota que la 095)
**Módulo:** features/rental-documents (web) | **Depende de:** 095, 096

## Contexto

La rentadora firma un contrato físico: anverso con los datos de la renta, reverso con la
introducción y las 17 cláusulas, más una «hoja de golpes» (inspección) con el diagrama del carro,
accesorios, combustible, llantas y daños. Se imprime en tamaño carta en juego **ORIGINAL
(arrendante)** y **COPIA (arrendatario)**, con opción de doble cara. El prototipo lo arma en
`docContrato`, `docHoja` y `docsHTML` (líneas 1682–1820 de `/Users/elopez/Downloads/index.html`):
leerlas para respetar el contenido y el orden de los campos; el diseño se rehace con los tokens del
`DESIGN.md` en versión impresa (blanco y negro, tipografía legible). Si el prototipo incluye un
pagaré con monto y fecha en blanco, se incluye igual.

## Historias

- Como recepción, quiero imprimir el contrato y la hoja de inspección de una renta con un clic,
  para que el cliente firme antes de llevarse el carro.
- Como dueño, quiero que el número de contrato siga la numeración del talonario (desde 0733), para
  no mezclar la contabilidad.

## Criterios de aceptación

- **Dado** una renta `RESERVED` sin número, **cuando** abro «Imprimir», **entonces** primero llama
  `POST /rentals/agreements/:id/contract-number` y el documento sale con ese número en formato
  `0733` (4 dígitos con ceros).
- **Dado** la vista de impresión, **entonces** muestra en el anverso: encabezado con logo, nombre,
  NIT/NRC, dirección, teléfonos y correo de ajustes; número de contrato; datos del cliente
  (nombre, documento, licencia y vencimiento, nacimiento, país, teléfono, dirección, profesión,
  trabajo, dirección y teléfono permanente, representante); conductor adicional; carro (marca,
  modelo, año, color, placa, km de salida); sale / regresa con lugar; tarifa, días, CDW,
  deducible, cobertura, cargos, descuento, total, depósito y forma de garantía; observaciones;
  firmas de ARRENDANTE (nombre de ajustes) y ARRENDATARIO. Reverso: intro y cláusulas numeradas.
- **Dado** la hoja de inspección, **entonces** muestra el diagrama del carro con las zonas marcadas
  y numeradas, la lista de daños, la tabla de accesorios con columnas Salida (Sí/No) y Entrada
  (Sí/No), combustible en octavos, llantas y batería, km, y firmas.
- **Dado** las opciones, **cuando** elijo «Original y copia» y «Doble cara», **entonces** el orden
  de páginas deja el reverso al dorso de cada anverso; con «Una cara» se imprimen todas las caras
  en secuencia. El rótulo ORIGINAL / COPIA aparece en cada juego.
- **Dado** una renta con inspección de regreso, **entonces** la hoja muestra también la columna
  Entrada llena y los daños nuevos marcados distinto.
- **Dado** la pantalla, **cuando** la abro en el navegador, **entonces** es una ruta propia fuera
  del riel (`/rentals/agreements/[id]/print`) con `@page { size: letter }`, sin barra de
  navegación, con botón «Imprimir» (`window.print()`) y «Volver» visibles solo en pantalla
  (`print:hidden`).

## Reglas de negocio

- **RN-1:** Los textos del contrato salen **siempre** de `GET /rental-settings` (intro, cláusulas,
  accesorios, empresa, arrendante). Nada hardcodeado.
- **RN-2:** El número se formatea con `padStart(4, '0')`; el valor guardado es entero.
- **RN-3:** Fechas en `dd/mm/aaaa` y horas `h:mm a. m./p. m.` en `America/El_Salvador`
  (`cash-format.ts` / `civil-date.ts` como referencia).
- **RN-4:** Las opciones de impresión (juegos, doble cara) se recuerdan en `localStorage` del
  navegador, no en el servidor.
- **RN-5:** Nada de fotos en el impreso.

## Permisos

`rentals.read` para ver la vista; `rentals.manage` para asignar número (lo exige el endpoint de la
096). Sin claves nuevas.

## Datos / API

Ninguno nuevo.

## UI

- `app/(print)/rentals/agreements/[id]/print/page.tsx` en un grupo de rutas `(print)` con su propio
  `layout.tsx` (fondo blanco, sin `AppShell`, con `SessionGuard`).
- `features/rental-documents/components/`: `agreement-documents-actions.tsx` (**reemplaza el stub**
  de la 096: botón «Imprimir contrato» con popover de opciones: juegos ORIGINAL+COPIA / solo
  original, doble cara, incluir hoja de inspección), `contract-sheet.tsx` (anverso + reverso),
  `inspection-sheet.tsx` (diagrama: reutilizar el SVG de zonas de `features/rentals` en modo solo
  lectura), `print-screen.tsx` (arma el orden de páginas).
- Estilos de impresión en el propio componente (clases `print:` de Tailwind y un bloque
  `@media print` con `@page { size: letter; margin: 12mm }`, saltos con `break-after: page`).

## Fuera de alcance

- PDF generado en servidor; envío por correo o WhatsApp del documento.
- Edición de cláusulas (es de Ajustes, 095).

## Tareas

- [ ] Grupo `(print)` con layout y página.
- [ ] Componentes de contrato, inspección y acciones; reemplazar el stub.
- [ ] Helpers puros con tests: `formatContractNumber`, `pageOrder(options)` (juegos × caras).
- [ ] `apps/web/AGENTS.md`: una línea sobre el grupo `(print)`.

## Verificación

```bash
pnpm build && pnpm lint && pnpm test
```

Sin script propio: no agrega endpoints. La prueba de impresión la hace el usuario.
