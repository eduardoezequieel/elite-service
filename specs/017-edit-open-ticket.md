# 017 — Editar un lavado abierto

**Estado:** Terminada
**Módulo:** carwash | **Depende de:** 003-carwash

## Task

En `/carwash/[id]`, con el lavado `OPEN` y `carwash.manage`, se pueden cambiar
servicios, tipo de carro y nota. `PATCH /carwash/tickets/:id` ya existe y solo
acepta `OPEN`. Evidencia: hallazgo 08. Cierra la frase del alta de pista:
«en caja lo confirmamos».

## Done

- [x] Con `OPEN` y `carwash.manage`, la ficha tiene `Editar`.
- [x] El diálogo arranca con tipo, servicios y nota actuales.
- [x] Guardar manda `bodyTypeId`, `items: [{ serviceId }]`, `notes`.
- [x] Sin al menos un servicio, no se manda el PATCH.
- [x] `READY` / `PAID` / `VOID` no muestran Editar.
- [x] La pista no gana este diálogo: lo confirma caja.

## Always

- El precio de cada línea lo resuelve el API con el catálogo (RN-2, RN-4).
- Errores en el diálogo, `role="alert"`.

## Ask first

- (Cerrado) No se edita placa, cliente ni vehículo acá.

## Never

- Nunca editar un lavado que no está `OPEN`.
- Nunca mandar `unitPrice` desde este diálogo.

## Verify

`pnpm lint && pnpm test && pnpm build`
