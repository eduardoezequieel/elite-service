# Rentadora Riveras — sistema HTML + Supabase

Handoff del sistema standalone de la rentadora (`index.html` + Supabase), entregado el 28/09/2026.
Igual que el resto de `docs/legacy/`: **no es una spec y no autoriza implementar**. Es la
referencia de reglas de negocio contra la que se pulen las specs 095–100 de este repo.

Se guarda tal cual lo entregaron. La clave publicable de Supabase es pública por diseño; la Secret
key y la contraseña de la base nunca van acá.

---

# Handoff: Sistema de control de Riveras Rent a Car

**Fecha:** 28/09/2026
**Responsable:** Daniel (dueño; no programa, necesita guía paso a paso en temas técnicos)
**Estado:** sistema funcionando y conectado al servidor propio (Supabase). Falta publicarlo en internet con Netlify.

---

## 1. Contexto del negocio

- **Empresa:** RIVERA'S RENT A CARS (Riveras Rent a Car), San Salvador. Arrendante en contratos y pagaré: **JOSUE ALEXANDER RIVERA**.
- **NIT en papelería:** 0614-070624-103-3. Dirección: Calle el Algodón y 75 Av. Norte, Col. Miralvalle #2, San Salvador. Tel. 7742-1900 y 6013-9922. Correo: riverasimportcars@gmail.com.
- **Flota inicial conocida (9 carros aprox.):** Kia Picanto 2024 blanco (P53DBC), Kia Picanto 2024 gris (P55B30), Kia Rio (78F74), Nissan Sentra (P9048B), Nissan Versa (P00000), Scion iA (P463C1), Kia Forte (sin placa registrada), Mazda BT-50 pick-up (sin placa registrada). Tipos: sedán, camioneta, pick-up.
- **Casi todos los carros están financiados** (cuota mensual; a veces incluye seguro y GPS).
- **La rentadora no está declarada en Hacienda:** IVA configurado en 0 % y el contrato no desglosa IVA.
- **Sistema anterior:** plataforma web pagada (riverasrentacar.invensv.com). No permite exportar clientes (solo muestra 10, sin paginación). Decisión: **empezar la lista de clientes desde cero** (opcional: pedir respaldo al proveedor o probar el reporte de clientes).
- Tienen taller propio (**Elite Service**) donde se hace el mantenimiento de la flota.
- Contrato físico actual: talonario con original (empresa) y copia en papel carbón (cliente), numeración en 0732, más "hoja de golpes" (inspección).

---

## 2. Qué hace el sistema

Aplicación web de una sola página (`index.html`) en español, formato centroamericano (dd/mm/aaaa, 12 h a.m./p.m.) y siempre con **hora de El Salvador (UTC-6)**.

| Módulo              | Funciones principales                                                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Inicio**          | Tablero de la flota (quién tiene cada carro y cuándo regresa), próximos 7 días de ocupación, resumen del mes, salidas y entregas de hoy y mañana, pendientes (atrasos, saldos, mantenimiento, respaldo). |
| **Calendario**      | Vista tipo Google Calendar: una fila por carro y barras por renta (reservada, en curso, atrasada, finalizada). Tocar un espacio vacío crea una renta.                                                    |
| **Rentas**          | Nueva renta, entrega y recepción con inspección, extensiones, cambio de carro, reasignar reservas, multas, pagos, mensajes de WhatsApp.                                                                  |
| **¿Qué hay libre?** | Busca disponibilidad por rango de fecha y hora, con 1 h de margen entre rentas; indica "libre si regresa a tiempo" y permite cotizar por WhatsApp.                                                       |
| **Caja**            | Cobros del día por forma de pago y por usuario, depósitos en custodia, cuentas por cobrar, cierre de caja imprimible.                                                                                    |
| **Clientes**        | Registro con datos de contrato (licencia y vencimiento, nacimiento, país, etc.), lista de "no rentar", historial, importación desde Excel o CSV.                                                         |
| **Flota**           | Ficha por carro: tarifas (diaria, 7+ días, 30+ días), km libres por día y costo por km extra, precio, financiamiento (prima, cuota, plazo), seguro y GPS mensuales, vencimiento de seguro y circulación. |
| **Mantenimiento**   | Plan por km o días (aceite 5,000 km o 90 días, revisión general cada 30 días, etc.), alertas, lista para el taller por WhatsApp, recordatorios exportables al calendario (.ics).                         |
| **Gastos**          | Gastos por carro (aceite, llantas, reparaciones, multas, etc.).                                                                                                                                          |
| **Rentabilidad**    | Por carro y periodo: ingresos, gastos, seguro, GPS, cuota, "lo que quedó", resultado (ganancia, cubrió su costo o pérdida), inversión recuperada, gráfica de 12 meses, vista mes a mes.                  |
| **Ajustes**         | Datos de la empresa, logo, valores del contrato, cláusulas editables, accesorios, respaldo y restauración, exportar a Excel, conexión al servidor.                                                       |

**Contrato e inspección imprimibles:** contrato (anverso y reverso con 17 cláusulas) y hoja de inspección con diagrama del carro, accesorios, combustible, llantas y daños. Se imprime en tamaño carta, en juego **ORIGINAL (arrendante)** y **COPIA (arrendatario)**, con opción de doble cara. Numeración correlativa desde **0733**.

**Correcciones hechas al texto de las cláusulas** (conviene que un abogado las revise, junto con el pagaré, que va con monto y fecha en blanco):

- Cláusula 3: "El Arrendatario se reserva…" se cambió a "El ARRENDANTE se reserva…".
- Cláusula 6: "cláusulas 2, 3, 4 y simplicará" quedó como "2, 3 y 4 implicará"; "asociados" quedó como "asonadas".
- Cláusula 7: "exclusión" quedó como "excusión".
- Cláusula 13: "previo arrendamiento" quedó como "previo requerimiento".
- Cláusula 15: "El arrendamiento no asume" quedó como "El ARRENDANTE no asume".
- Cláusula 16: "ausencia de ambas partes" quedó como "anuencia de ambas partes".

**Reglas de negocio clave:**

- Días a cobrar: se cobra un día extra cuando se pasan más de 1 hora de las 24 h (editable en cada renta).
- La renta que cruza meses reparte su ingreso según los días que cayeron en cada mes.
- La inversión recuperada compara la utilidad antes de cuotas contra lo desembolsado (prima más cuotas pagadas, o el precio si fue al contado).
- El cambio de carro cierra la renta actual y abre una nueva ligada (cada carro lleva sus propios días e ingresos; el depósito pasa a la renta nueva).
- Un carro solo cuenta como devuelto cuando se registra "Recibir carro".
- La tarjeta de garantía solo guarda los últimos 4 dígitos.

---

## 3. Arquitectura y servidor

- **Frontend:** un solo archivo `index.html` (HTML, CSS y JS sin frameworks). Carga `supabase-js@2` desde cdn.jsdelivr.net.
- **Backend:** **Supabase**, organización "Riveras Rent a Car" (plan Free), proyecto **riveras-rentas**, región East US (North Virginia).
  - URL: `https://pkcvkoqwdfpjssyipbor.supabase.co`
  - Clave publicable (va incluida en `index.html`; es pública por diseño): `sb_publishable_hvsbEvH0IjKzij3wYzRGtQ_HBwW9bDQ`
  - **Nunca compartir la Secret key ni la contraseña de la base de datos.**
- **Modelo de datos:** tabla única `public.registros (col, id, data jsonb, updated_at, updated_by)` con llave primaria `(col, id)`. Valores de `col`: `vehiculos`, `clientes`, `rentas`, `gastos`, `config` (id `empresa`) y `usuarios`.
- **Seguridad:** RLS activado; solo usuarios autenticados leen y escriben. Registro público de usuarios **desactivado** (pendiente confirmar que quedó apagado).
- **Tiempo real:** tabla agregada a `supabase_realtime`, con replica identity full.
- **Archivos:** bucket público `archivos` para fotos de inspección y logo (nombres aleatorios).
- **SQL ya ejecutado:** `supabase_configuracion.sql` más los permisos:
  ```sql
  grant usage on schema public to authenticated;
  grant select, insert, update, delete on public.registros to authenticated;
  ```
- **Usuario creado:** `administracion@eliteservice75.com` (su contraseña la conoce Daniel).
- **Prueba realizada:** inició sesión, agregó un carro, recargó la página y el carro persistió. Todo correcto.

**El archivo también funciona en otros modos:** dentro de Claude como artifact, o en modo local sin servidor (datos solo en ese navegador). Con `SUPA_URL` y `SUPA_KEY` llenos en el código, siempre usa el servidor.

---

## 4. Archivos

| Archivo                                                                                | Uso                                                                                    |
| -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `index.html` (carpeta **"sistema rentadora"** en el Escritorio de Daniel, en OneDrive) | Sistema ya conectado al servidor. Es lo que se sube a Netlify.                         |
| `supabase_configuracion.sql`                                                           | Script de base de datos (ya ejecutado).                                                |
| Artifact en Claude (`claude.ai/artifact/Usj8gu1aZENUsJP4uQyy8p`)                       | Versión anterior dentro de Claude. **No usar para operar**, para no dividir los datos. |

---

## 5. Pendientes (en orden)

1. **Publicar en Netlify:** app.netlify.com, registrarse con GitHub, "Add new project", "Deploy manually" y arrastrar la carpeta "sistema rentadora" (que solo contenga `index.html`). ← **Aquí se quedó.**
2. Renombrar el sitio de Netlify a algo fácil (por ejemplo `riveras-rentacar.netlify.app`). Opcional: dominio propio (~$12 al año).
3. Confirmar que "Allow new users to sign up" esté **apagado** en Supabase (Authentication → Sign In / Providers).
4. Crear usuarios para recepción (Authentication → Users → Add user → Create new user, con "Auto Confirm User").
5. Abrir la dirección en la computadora de recepción y en el celular ("Agregar a pantalla de inicio").
6. Cargar datos iniciales: flota completa (tarifas, fecha de compra, financiamiento, seguro, GPS, vencimientos, último servicio de cada mantenimiento), rentas activas, clientes al irlos atendiendo, logo en PNG.
7. Descargar el **primer respaldo** y luego hacer uno cada semana (Ajustes → Respaldo).
8. Hacer que un abogado revise las cláusulas y el pagaré.

**Cada vez que se actualice el sistema:** reemplazar `index.html` y volver a arrastrar la carpeta en Netlify (Deploys → arrastrar). Los datos no se pierden porque viven en Supabase.

---

## 6. Advertencias y siguientes mejoras sugeridas

- **Plan gratuito de Supabase:** pausa el proyecto tras 7 días sin uso y no incluye respaldos automáticos. Si el negocio depende del sistema, conviene el plan Pro (~$25 al mes).
- **Permisos por usuario:** hoy todos los usuarios con sesión pueden ver y editar todo. Sugerencia: roles (por ejemplo, que recepción no vea la rentabilidad ni pueda borrar).
- **Asistente "Pregúntale a Claude":** solo funciona dentro de Claude; en el servidor propio no aparece.
- **Integración futura** con el ERP de Elite Service (stack planeado: Next.js, TypeScript, PostgreSQL), para que los mantenimientos del taller se carguen solos como gasto de cada carro.
- **Fotos de inspección:** se guardan en el bucket público con nombres aleatorios; considerar hacerlo privado con URLs firmadas si se vuelve sensible.
