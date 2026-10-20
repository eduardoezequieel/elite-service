# Guía completa de la renta de carros de Elite Service (para pegar en una IA)

> **Instrucciones para la IA que lee esto.** Usted va a ayudar a personas que están probando la
> parte de **renta de carros** del sistema Elite Service. No son técnicas. Conteste en español, de
> usted, en frases cortas y con los nombres exactos de los botones, pantallas y mensajes que
> aparecen en esta guía (van entre «comillas»).
>
> - Use solo lo que dice esta guía. Si algo no está aquí, diga «Eso no lo sé, anótelo como duda en
>   el plan de pruebas» y no lo invente.
> - La **Parte 1** es un resumen; la **Parte 2** es el detalle pantalla por pantalla, sacado del
>   código. Si se contradicen, vale la Parte 2.
> - Si algo está en «Lo que todavía no existe», dígalo claro.
> - Si la persona describe algo distinto a lo que dice esta guía (otro texto, otro botón, otro
>   resultado), puede ser un error del sistema: dígale que lo marque como «Falla» en el plan de
>   pruebas, con lo que vio y los pasos que siguió.
> - Algunos textos de la pantalla todavía usan «vos» («Abrí la caja…»); son del sistema, cítelos tal
>   cual.

Guía al 20 de octubre de 2026.

## Índice

- **Parte 1 — Resumen:** qué es, dónde está cada cosa, flujos principales, cuentas, caja, lo que no
  existe y mensajes comunes.
- **Parte 2 — Detalle:**
  1. Hoy, Rentas (Libre, Rentas, Historial) y Nueva renta.
  2. Ficha de la renta: entrega, devolución, cuenta y contrato.
  3. Acciones de la renta: extender, multa, cambiar carro, editar, cancelar y cobrar.
  4. Caja y Clientes.
  5. Carros, Servicio y gastos, ¿Cuánto dejó? y Ajustes de renta (con permisos).

---

# Parte 1 — Resumen

## 1. Qué es

Elite Service tiene dos negocios en el mismo sistema: el **lavado** y la **renta de carros**. Cada
uno es un «espacio de trabajo» separado, con sus propios clientes, caja y cuentas. Se cambia de uno
a otro arriba a la izquierda, en **Espacio de trabajo → Renta de carros**. Esta guía cubre solo la
renta.

## 2. Dónde está cada cosa

**Menú lateral** (4 entradas):

| Entrada    | Qué tiene                                                                                                                                                                                           |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hoy**    | El resumen del día: «¿Qué hay libre?», «Nueva renta», los carros de la flota, «Próximos 7 días», «Dinero» (cobrado hoy y, para el dueño, lo del mes), «Salen y vuelven» y «Pendientes» (atrasadas). |
| **Rentas** | Pestañas **Libre** (qué carro hay en unas fechas), **Rentas** («Por salir», «En la calle», «Ya volvió») e **Historial** (cerradas y canceladas, por mes).                                           |
| **Caja**   | Abrir y cerrar la caja, lo cobrado, «Quién me debe» y «Garantías».                                                                                                                                  |
| **Carros** | La flota: «Nuevo carro», «Mandar al taller», «¿Cuánto dejó?» y la ficha de cada carro.                                                                                                              |

**Menú de la persona** (abajo a la izquierda, en su nombre): **Clientes** y **Ajustes de renta**.

## 3. Antes de empezar

1. **Ajustes de renta** tiene 5 pestañas:
   - **Empresa:** nombre, teléfono, logo.
   - **Cobros y reglas:** cargo de cobertura por día, deducible, horas de gracia, margen entre rentas, IVA.
   - **Contrato:** las cláusulas que salen impresas.
   - **Accesorios:** lo que se revisa al entregar (llanta de repuesto, gata, etc.).
   - **Servicio:** el plan de mantenimiento de la flota.

   Los cambios se guardan con la barra que aparece abajo. «Ver hoja» muestra cómo sale el contrato.

2. **Abrir la caja:** Caja → «Abrir caja» con el fondo (el efectivo con que se empieza). **Sin caja
   abierta no se puede cobrar nada.**

## 4. Carros

- **Dar de alta:** Carros → «Nuevo carro». Pide marca, modelo, placa, año, color, tarifa diaria y
  kilometraje. Lo demás se edita después en la **Ficha** del carro, con el lápiz de cada tarjeta:
  - **Precio de renta:** tarifa de 1 a 6 días, de 7 a 29 días y de 30 o más días; km libres por día y precio por km adicional.
  - **Compra y cuota:** si está financiado.
  - **Gasto fijo al mes:** seguro, GPS y otros.
  - **Seguro y circulación:** aseguradora, póliza y las fechas de vencimiento.
- **Estados del carro:** Libre, En renta, Atrasado, Reservado, Taller, Retirado.
- **Mandar a taller:** en la ficha del carro, «Mandar a taller». Mientras está en taller **no se
  puede rentar**. Para volver: «Cambiar estado…» → «Volver a la flota».
- **Ficha del carro**, 3 pestañas: **Ficha**, **Servicio y gastos** y **¿Cuánto dejó?**.

### Servicio y gastos

Es un tablero como el de un carro de verdad. Tiene un medidor con lo más urgente y el kilometraje, y
un **testigo** por cada servicio del plan, más dos por el **Seguro** y la **Tarjeta de circulación**.

- **Colores:** rojo = vencido, ámbar = pronto, apagado = bien, gris = sin dato (nunca se anotó).
- **Tocar un testigo de servicio** abre «Anotar lo que se hizo»: fecha, km, costo y nota. Con eso
  vuelve a contar desde cero.
- **Tocar Seguro o Tarjeta** abre «Ya se renovó»: cuánto costó, cuándo se pagó y la nueva fecha de
  vencimiento.
- **«Anotar un gasto»:** combustible, reparación, llantas, GPS, otro.
- **«Historial · $X este mes»:** servicios, gastos, lavados y multas, todo junto. Ahí se corrige
  o se borra.

### El plan de servicio

Está en **Ajustes de renta → Servicio**. Es **uno solo para toda la flota**, por ejemplo «Cambio de
aceite cada 5,000 km o 90 días». Cada carro cuenta desde **su** último servicio. «Avisar antes» dice
cuántos km o días antes se pone ámbar el testigo.

## 5. Clientes

- Menú de la persona → **Clientes** → «Nuevo cliente». Son obligatorios el nombre, el DUI o pasaporte
  y el celular. Lo demás va en «Más datos». También se pueden importar con «Importar CSV».
- **Licencia vencida:** no deja rentarle. Sale un aviso rojo con «Actualizar licencia».
- **Licencia que vence en 30 días o menos:** aviso ámbar, pero sí deja rentarle.
- **«No rentar»:** se marca en la ficha del cliente, con un motivo. Ese cliente sale deshabilitado al
  hacer una renta.

## 6. Hacer una renta

Desde Hoy o Rentas → «Nueva renta». Tiene 4 pasos:

1. **Carro:** fechas y horas de salida y regreso, y el carro. Aparecen los libres y también los que
   están rentados pero **vuelven antes** de la nueva salida.
2. **Cliente:** buscar por nombre, DUI o teléfono, o «Cliente nuevo».
3. **Contrato:**
   - **«Si choca el carro»:** «Paga hasta $X» (el cliente toma la cobertura: se cobra un cargo por
     día y, si choca, paga como máximo el deducible) o «Paga todos los daños» (sin cobertura). El
     cargo por día y el deducible vienen de Ajustes, pero se pueden cambiar en cada renta.
   - Descuento, **Garantía** (depósito) y su forma de pago, otro conductor y notas.
4. **Confirmar:**
   - Si sale hoy, pregunta «¿Se lleva el carro ahora?». Con **«Sí, ahora»** pasa directo a la entrega;
     con «No, solo apartar» queda como reserva.
   - Si sale otro día, el botón dice «Reservar».

**No se puede** poner una salida en el pasado.

## 7. Entregar el carro

En la ficha de la renta → **«Entregar»**. Son 3 pasos:

1. **Kilometraje:** fecha, km, combustible (Vacío / ¼ / ½ / ¾ / Lleno), nota.
2. **Golpes:** se marcan en el dibujo del carro. También los accesorios y las fotos.
3. **Cobro:** la garantía y lo que se cobra ahora. Se puede pagar una parte: lo que falta queda como
   **«Debe»**.

Si la caja está cerrada, la entrega se guarda igual, pero no se puede cobrar.

## 8. La ficha de una renta

Arriba están los botones de lo que se puede hacer según el estado.

**Renta en la calle (o atrasada):**

- **Recibir**
- **Extender**
- **Multa**
- **Cambiar carro**
- **Cobrar**, si debe algo

**Renta ya devuelta:**

- **Cobrar** o **Devolver garantía**
- **Multa**

**En «⋯»:** Editar, Cancelar, Imprimir contrato, Imprimir inspección.

El bloque **Cuenta** muestra el Total, lo Pagado y lo que Debe. Un pago mal hecho se anula en su «⋯»
→ «Anular».

## 9. Recibir el carro

**«Recibir»** tiene los mismos pasos que la entrega, más el cobro de lo que pasó.

- **Golpes:** los que ya tenía salen bloqueados; los nuevos salen en rojo y a cada uno se le pone un
  monto.
- **Daños:**
  - Con **«Paga hasta $X»** se cobra **como máximo el deducible**, aunque los daños sumen más.
  - Con **«Paga todos los daños»** se cobra todo.
- **Combustible:** si vuelve con menos, se pone cuánto cobrar.
- **Km de más:** se cobran solos. Fórmula: (km recorridos − km libres por día × días) × precio por
  km. Ejemplo: 3 días con 200 km libres = 600 km. Si recorrió 750, cobra 150 km.
- **Días:** se cuentan con la hora real de regreso:
  - **Fórmula:** días = (tiempo rentado − horas de gracia) ÷ 24 h, redondeado hacia arriba, mínimo 1.
  - **Si vuelve tarde**, se cobra el día extra.
  - **Si vuelve antes**, se cobran menos días que los pactados. Esto es distinto al sistema anterior
    (Riveras) y está pendiente de decisión del dueño.
- **Cobro:** el monto sugerido ya trae todo (días, km, combustible, daños). Al final, se devuelve la
  garantía completa o se retiene con una nota.

## 10. Otras acciones de la renta

- **Extender:**
  - Se elige el nuevo regreso, con atajos de +1, +2, +3 y +7 días.
  - **La tarifa pactada se mantiene** aunque la renta pase de 7 o 30 días; se puede cambiar a mano.
  - Con **«Cobrar ahora»** marcado se cobra lo agregado; sin marcar, solo sube lo que debe.
  - Si el carro ya está reservado después, avisa y ofrece «Cambiar carro».
- **Multa desde la renta:** fecha y hora, monto y motivo. La fecha tiene que caer dentro de la renta.
  Se suma a lo que debe el cliente.
- **Multa desde el carro:** en la ficha del carro → «Multa».
  - Si a esa hora el carro estaba rentado, se le carga a quien lo tenía.
  - Si no estaba rentado, queda como gasto «Multa» del carro.
- **Cambiar carro:** tiene 3 pasos.
  1. **Recibir** el carro actual, con km, combustible, daños y el motivo (Falla, Choque, Extendió,
     Pidió otro).
  2. **Entregar** el nuevo. La tarifa puede ser «La misma», «Del carro» u «Otra».
  3. **Listo**, con el resumen de las dos rentas.

  La renta vieja se cierra y la nueva abre con contrato nuevo. La garantía y lo pagado de más pasan a
  la nueva, y la caja no cambia. Ejemplo: pagó $400 por 10 días y cambia el día 4. La vieja queda en
  $160 y la nueva en $240, ya pagados.

- **Editar:** fechas, cobro, garantía, observaciones y «Cargos extra». Una renta cerrada ya no se
  puede editar.
- **Cancelar:** pide el motivo. La renta pasa a Historial → «Canceladas».
- **Imprimir contrato:** le asigna número. Hay opciones de «Incluir hoja de inspección» y «Doble
  cara».
- **Atrasada:** si pasó la hora de regreso y no se ha recibido. Sale en Hoy → «Pendientes» con
  «Llamar», y el número aparece en la pestaña Rentas.

## 11. Cuentas: cómo se calcula el total

**Total** = (tarifa por día + cargo de cobertura por día) × días + cargos extra + km de más +
combustible + daños + multas cargadas − descuento. Nunca baja de $0.

- **Tarifa:** al hacer la renta se toma la del tramo según los días: 30 o más, 7 o más, o la diaria.
  Si el tramo no tiene precio, se usa el anterior.
- **Garantía:** **no es ingreso.** Se guarda aparte y se devuelve al recibir, o desde Caja →
  «Garantías». No baja lo que debe el cliente.
- **IVA:** la tasa y si el precio ya lo incluye se configuran en Ajustes → Cobros y reglas.

## 12. Caja

- Funciona por **turnos**:
  1. «Abrir caja» con el fondo.
  2. Durante el turno se ve lo cobrado por forma de pago.
  3. «Cerrar caja» pide lo contado y muestra lo esperado.
- El **Historial** de cierres marca **Cuadra**, **Sobra** o **Falta**.
- **«Quién me debe»** muestra las rentas con saldo, cada una con su botón «Cobrar». **«Garantías»**
  muestra las que hay guardadas, con «Devolver».
- La caja **no** registra gastos: esos van en cada carro, en «Servicio y gastos».

## 13. ¿Cuánto dejó?

En Carros → «¿Cuánto dejó?» (toda la flota) o en la pestaña del mismo nombre en la ficha de cada carro,
mes a mes:

- **Entró:** lo rentado.
- **Se fue:** gastos, multas que no se cobraron, la cuota del carro (si está financiado), y el seguro,
  GPS y otros gastos fijos.
- **Quedó:** la diferencia.

Lo rentado se reparte por los días que cayeron en cada mes. Solo lo ve quien tiene permiso de reportes.

## 14. Tablet

El sistema tiene dos densidades:

- **Mostrador:** computadora con teclado.
- **Bahía:** tablet en la mano.

En bahía todo va en una columna, con botones más grandes, y la entrega y la devolución ocupan la
pantalla completa. Si algo no se puede tocar con el dedo o se sale de la pantalla, es una falla.

## 15. Lo que todavía no existe

Si preguntan por esto, la respuesta es «todavía no está»:

- Crear una renta con salida en el pasado, para cargar las que ya están en la calle.
- Importar los datos del sistema anterior (Riveras). Solo se pueden importar clientes por CSV.
- Calendario por carro y mensajes por WhatsApp. Se quitaron a propósito.
- Cierre de caja imprimible y totales por usuario.

## 16. Mensajes comunes y qué significan

| Mensaje o situación                      | Qué pasa                                                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Pide abrir la caja para cobrar           | La caja está cerrada. Caja → «Abrir caja».                                                                   |
| El carro no aparece para rentar          | Está en taller, retirado, o rentado o reservado en esas fechas (incluido el margen entre rentas de Ajustes). |
| No deja seguir con un cliente            | Licencia vencida o marcado «No rentar».                                                                      |
| El descuento no puede pasar del subtotal | El descuento es mayor que lo que cuesta la renta.                                                            |
| La multa no se guarda desde la renta     | La fecha de la multa está fuera de las fechas de la renta.                                                   |
| El km de regreso no puede ser menor      | Se escribió menos km de los que tenía al salir.                                                              |
| Una renta cerrada no se puede editar     | Ya se recibió. Las multas sí se pueden agregar después.                                                      |

---

# Parte 2 — Detalle pantalla por pantalla

## Hoy, las pestañas de Rentas y Nueva renta

Esta sección cubre la pantalla de inicio de la renta, el marco «Rentas» con sus tres pestañas («Libre», «Rentas» e «Historial») y el asistente «Nueva renta» de cuatro pasos, incluido el camino que parte de «Libre» con el carro y las fechas ya elegidos. Las horas de todas estas pantallas son las de El Salvador (UTC−6, sin cambio de horario), aunque la tablet esté en otra zona.

### Cómo se llega y quién ve cada cosa

El espacio de trabajo se llama «Renta de carros» (subtítulo «Flota, rentas y contratos»). Si la persona también tiene lavado u administración, lo elige en «Espacio de trabajo», arriba del menú. En la renta la barra de abajo muestra todas las pestañas, sin un botón «Más».

El grupo del menú se llama «Renta» y trae, en este orden, «Hoy», «Rentas», «Caja» y «Carros». «Caja» y «Carros» no se documentan aquí.

| Pantalla         | Camino                                                       | Permiso para abrirla                  |
| ---------------- | ------------------------------------------------------------ | ------------------------------------- |
| «Hoy»            | Menú «Renta» → «Hoy»                                         | Ver la renta (rentals.read)           |
| «Libre»          | Menú «Renta» → «Rentas», o el botón «¿Qué hay libre?» de Hoy | Ver la renta (rentals.read)           |
| Pestaña «Rentas» | Dentro de «Rentas», pestaña «Rentas»                         | Ver la renta (rentals.read)           |
| «Historial»      | Dentro de «Rentas», pestaña «Historial»                      | Ver la renta (rentals.read)           |
| «Nueva renta»    | Botón «Nueva renta» en Hoy o en el marco de «Rentas»         | Crear y mover rentas (rentals.manage) |

Sin el permiso, el menú no muestra la pestaña. Si igual se abre la dirección, el texto es exactamente:

> No tenés permiso para ver la renta.

En «Libre» dice «lo libre»; en la lista, «las rentas»; en el historial, «el historial de rentas»; en el alta, «la nueva renta». Debajo, siempre:

> Si debería ser tuyo, pedile el permiso a quien administra. El riel a la izquierda (o abajo) te saca de acá.

Otros permisos que cambian lo que se ve, sin ocultar la pantalla:

- Ver la flota (fleet.read): en Hoy aparecen las tarjetas de carros y los avisos vencidos. Sin él, Hoy no muestra la flota ni esos avisos. En Historial, el menú de carros queda vacío.
- Ver rentabilidad (rentals.reports): en Hoy aparecen las tres cifras del mes. Sin él, solo queda «Cobrado hoy».
- Cobrar (rentals.charge): la cifra «Cobrado hoy» se puede tocar y abre «Caja». Sin él, la cifra se ve y no es un enlace.
- Crear clientes de renta (renters.manage): en el paso Cliente aparecen «Cliente nuevo», «Crear cliente con «…»» y «Actualizar licencia». Sin él se puede buscar y elegir un cliente ya registrado, y no se puede dar de alta ni corregir la licencia desde el asistente.

Si una lista pide datos y la sesión no alcanza, el mensaje que se pinta en rojo es «No tenés permiso para hacer esto.». Si la sesión caducó: «Tu sesión no es válida. Iniciá sesión de nuevo.». Si no hay red: «No se pudo conectar con el servidor.». Si el servidor responde algo que no se entiende: «El servidor respondio con un error (N).», con el número del error.

En tablet estrecha y en densidad bahía, las listas de «Rentas» e «Historial» dejan la tabla y pasan a tarjetas. Los rótulos son los mismos. En bahía los filtros se reparten a lo ancho y bajan de fila si no caben, y las pestañas se leen más grandes.

### Hoy

Título: «Hoy, 5 de oct» (el día de hoy en El Salvador y el mes en tres letras, sin punto). Quien puede crear rentas ve a la derecha «Nueva renta». Todos los que entran ven «¿Qué hay libre?», que abre la pestaña «Libre».

La pantalla no tiene pestañas propias. De arriba abajo: flota (si hay permiso), «Próximos 7 días», «Dinero», y al final «Salen y vuelven» junto a «Pendientes».

#### Flota de Hoy

Solo con permiso de ver la flota. Son las mismas tarjetas de «Carros», sin buscador y sin carros retirados. Carga hasta 100 carros. Si la flota pasa de 100, el chip «Todos» muestra el total real y el resto de los chips cuenta solo los que cargaron.

Chips, en este orden, y solo si hay al menos un carro en ese estado. «Todos» va siempre, con el total:

| Chip        | Color del sello en la tarjeta                                                                | Qué significa ahora                                                                                      |
| ----------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| «Libre»     | Verde                                                                                        | Activo, sin renta que lo ocupe hoy                                                                       |
| «En renta»  | Llama (naranja de la marca); el punto late, salvo que el sistema tenga reducida la animación | Hay una renta en curso y la hora de regreso todavía no pasó                                              |
| «Atrasado»  | Rojo                                                                                         | La renta en curso ya debió volver, o hay una reserva cuya salida era un día anterior y el carro no salió |
| «Reservado» | Gris atenuado                                                                                | Hay una reserva que sale hoy y el carro no está en la calle                                              |
| «Taller»    | Ámbar                                                                                        | El carro está marcado en taller. Ese estado gana sobre las rentas                                        |

El orden de las tarjetas es el de urgencia: atrasados, en renta, reservados, libres y al final taller. Dentro del mismo estado se conserva el orden en que llegaron.

Cada tarjeta, de arriba abajo:

- Sello del estado, arriba a la derecha de la foto.
- Foto del carro.
- Nombre en cursiva: marca, modelo y año si tiene año. Ejemplo: «Toyota Yaris 2022». Sin año, «Toyota Yaris».
- Placa, o el texto «Sin placa».
- Una línea de lo que está pasando, solo si hay una renta que manda. El verbo va en gris y la hora en negrita. Si el sistema manda el nombre del cliente, se agrega « · » y el nombre.
  - Vuelve en el futuro: «Vuelve» y «hoy 5:00 p.m.», «mañana 9:00 a.m.», «el viernes» (si faltan de 2 a 6 días) o «el 21 oct» (si falta más).
  - Ya debió volver: «Debió volver» y «hoy a las 5:00 p.m.», «ayer» o «hace 3 días». El triángulo de esta línea va en rojo.
  - Sale en el futuro: «Sale» con las mismas formas de hora que «Vuelve».
  - Ya debió salir y no salió: «Debió salir» con las formas de «Debió volver».
- Avisos del carro, si los hay. El vencido va en rojo con triángulo. El que se acerca va en ámbar, con un documento o una llave según sea un papel o un servicio. Los textos salen tal cual:
  - Papel vencido: «Seguro venció hace 3 días» o «Tarjeta de circulación venció hace 1 día». Los papeles son solo «Seguro» y «Tarjeta de circulación».
  - Papel por vencer: «Seguro vence en 12 días» o «Seguro vence hoy».
  - Servicio vencido por kilómetros: «Se pasó: iba a los 50.000 y va en 51.200: aceite».
  - Servicio vencido por fecha: «Se pasó: iba el 4 oct: aceite».
  - Servicio próximo: «Le toca a los 50.000 km: aceite» o «Le toca el 12 oct: aceite».
- Tarifa del día, por ejemplo «$35.00» y al lado «/día». Es la tarifa diaria del carro, no la de la renta que tenga abierta.

Toda la tarjeta abre la ficha del carro. No hay otro botón.

Vacío sin filtro: «Nada todavía». Con un chip que no deja carros (el estado se quedó elegido y ya no hay ninguno): «Ningún carro coincide». Si la carga falla, el título es «No se pudo cargar» y debajo el mensaje de error del servidor, textual.

El sello de Hoy no es el mismo que el de «Libre». Hoy mira el día de hoy. «Libre» mira un rango de fechas.

#### Próximos 7 días

Título «Próximos 7 días». Siete columnas: hoy y los seis días que siguen. Hoy lleva filete naranja. En teléfono y en bahía la fila se desliza de lado; cada día ocupa un ancho fijo.

Cada día muestra:

- La etiqueta «Lun 19», «Mar 20», y así. Los nombres son «Dom», «Lun», «Mar», «Mié», «Jue», «Vie», «Sáb».
- Dos números: carros ocupados ese día, una barra, y el total de carros activos. Ejemplo: «4» y «/10».
- Una barra. El ancho es ocupados ÷ activos, con tope de 100 %. Sin carros activos, o con cero ocupados, la barra queda vacía.

Un carro cuenta como ocupado ese día si alguna renta no cancelada toca el día civil, de las 00:00 a las 24:00 de El Salvador. Una renta que cruza la medianoche cuenta los dos días. El mismo carro con dos rentas el mismo día cuenta una vez.

El total de abajo (el «/10») es, con permiso de flota, la cantidad de carros no retirados. Sin ese permiso, es la cantidad de filas del calendario de esos siete días (activos, en taller, y cualquiera que tenga una renta en la semana).

Mientras carga, el lector de pantalla oye «Cargando la semana». Si falla, el mensaje del servidor se muestra en rojo y no hay barras.

Ejemplo. Hoy hay 10 carros no retirados. El jueves 4 tienen alguna renta que toca ese día. La columna dice «Jue 22», «4/10», y la barra llega al 40 %.

#### Dinero

Título «Dinero». Hasta cuatro cifras.

«Cobrado hoy» va en verde. Es la suma de los pagos de renta registrados hoy en El Salvador que no están anulados, de cualquier método (efectivo, tarjeta, transferencia u otro). No es el total de los contratos que salen hoy: es lo que entró hoy a la caja de la renta. Los centavos se leen aparte: «$148» y «.50». Con permiso de cobrar, tocar la cifra abre «Caja». Sin ese permiso, la cifra no es un enlace.

Las otras tres solo aparecen con permiso de rentabilidad. El mes es el mes en curso, en minúscula: «Rentado en octubre», «Gastos de octubre», «Ganancia de octubre». El periodo es del día 1 de este mes hasta hoy, los dos incluidos. No llega al fin de mes.

Fórmulas, todas en centavos y mostradas con dos decimales:

- Rentado = suma, carro por carro, del ingreso de cada renta en curso o ya devuelta que toca el periodo. Una reserva y una cancelada no entran. El ingreso de una renta es su total. Si en ajustes el IVA es mayor que cero y la renta incluye IVA, el ingreso es total ÷ (1 + IVA/100), redondeado al centavo. De fábrica el IVA está en 0, así que el ingreso es el total. Si la renta empezó antes del mes o sigue después de hoy, entra solo la parte proporcional: ingreso × (horas del tramo que caen dentro del periodo ÷ horas de todo el tramo ocupado). El tramo ocupado va de la salida real (o la pactada, si todavía no salió) al regreso real si ya volvió; si sigue en la calle, al regreso pactado, o hasta ahora si ya va atrasada.
- Gastos = gastos anotados al carro con fecha dentro del periodo + fijos del carro (seguro, GPS y los demás fijos mensuales) + cuota de financiamiento. Fijos y cuota no entran el mes entero: entran la fracción de mes que ya pasó. Cada mes calendario que el periodo toca suma los días que caen dentro, partidos por los días de ese mes. Del 1 al 15 de octubre (hoy 15, octubre tiene 31 días) la fracción es 15/31.
- Ganancia = rentado − gastos (la suma de arriba). Si sale negativa, se ve completa con el signo delante del dólar, por ejemplo «-$20.00». Si sale en cero o positiva, los centavos van en el número chico, igual que «Cobrado hoy».

Ejemplo, hoy 15 de octubre, IVA en 0. Una renta ya devuelta, toda dentro del mes, total $100.00. Gastos del carro anotados: $20.00. Seguro y GPS del mes: $31.00, y la cuota también $31.00. Fracción 15/31, así que fijos $15.00 y cuota $15.00. En pantalla: «Rentado en octubre» $100.00, «Gastos de octubre» $50.00, «Ganancia de octubre» $50.00.

Otro ejemplo de prorrateo. La misma renta dura 10 días y solo 4 caen dentro del 1–15 de octubre. De los $100.00 entran $40.00 a «Rentado en octubre».

Si «Cobrado hoy» o el mes no cargan, la cifra no sale y el mensaje del servidor queda en rojo debajo. Un fallo del mes no borra «Cobrado hoy», ni al revés.

#### Salen y vuelven

Título «Salen y vuelven» y, cuando ya cargó, la cantidad. Junta dos listas, ordenadas por hora. A la misma hora, primero la salida y después el regreso.

- Sale hoy: reserva (el carro todavía no salió) cuya salida pactada cae en el día de hoy.
- Vuelve hoy: renta en curso cuyo regreso pactado cae en el día de hoy. Si la hora ya pasó pero el día sigue siendo hoy, sigue en esta lista. No se pone en rojo.

Cada fila: placa (si hay), nombre del carro, nombre del cliente, y la hora. La salida dice «Hoy · 9:42 a.m.». El regreso dice «Vuelve hoy · 9:42 a.m.». Si la salida ya debió ocurrir (la hora pactada es anterior a este momento), esa hora va en rojo. Tocar la fila abre la ficha de la renta.

Botones:

- «Entregar», en una salida. Abre la ficha con la acción de entrega. El cuadro de entrega se abre solo si además hay permiso de crear y mover rentas y la renta sigue reservada. Sin ese permiso se abre la ficha y el cuadro no.
- «Recibir», en un regreso de hoy. Igual, con la acción de recepción, y el cuadro solo si hay permiso de mover rentas y la renta sigue en curso.

Vacío: «Nada por hoy». Cargando: «Cargando salidas y regresos». Si falla, el mensaje del servidor en rojo y la cantidad no se muestra.

Una reserva que debía salir ayer y no salió no entra aquí. El carro queda «Atrasado» en la flota, con «Debió salir …», y la renta aparece en la pestaña «Rentas», filtro «Por salir».

#### Pendientes

Título «Pendientes» y la cantidad de filas (atrasos más carros con aviso vencido).

Primero las rentas en curso cuyo día de regreso pactado es anterior a hoy, de la que debió volver antes a la más reciente. La hora va en rojo: «Debió volver 5 de oct · 6:30 p.m.». Tocar la fila abre la ficha. Si el cliente tiene teléfono (celular, o el fijo si no hay celular), hay un botón «Llamar» que marca ese número. Si el teléfono está vacío, no hay botón.

Después, los carros con al menos un aviso vencido (nivel vencido, no el que apenas se acerca). El mismo orden que la flota. Se ve la placa, el nombre y los textos vencidos unidos con « · », en rojo. Tocar abre la ficha del carro. Los avisos que solo se acercan se ven en la tarjeta de la flota, en ámbar, y no entran a esta lista. Sin permiso de flota, esta mitad no se pide y no muestra error.

Vacío, sin errores: «Todo en orden». Cargando: «Cargando pendientes». Si una de las dos mitades falla, sus filas no salen, el mensaje va en rojo, y la otra mitad sí se muestra si cargó.

### Marco «Rentas»

Al entrar por el menú «Rentas» se abre «Libre». El marco, que no cambia al saltar de pestaña, tiene el título «Rentas», el botón «Nueva renta» (solo con permiso de crear y mover rentas) y tres pestañas: «Libre», «Rentas», «Historial».

La pestaña «Rentas» muestra un número al lado solo cuando hay al menos una renta en curso cuya hora de regreso pactada ya pasó. Ese número es la cantidad de esas atrasadas, no la cantidad del filtro que esté elegido. Una que vuelve hoy a las 9:00 cuenta aquí desde las 9:01, aunque en Hoy siga bajo «Salen y vuelven» y no en «Pendientes» (Pendientes mira el día, este número mira la hora).

La pestaña «Libre», la lista y el historial no dibujan enlace de regreso: ya son la pantalla. «Nueva renta» sí: arriba dice «Rentas» y vuelve a la pestaña «Rentas».

### Pestaña «Libre»

Sirve para ver qué carros están libres entre dos fechas y, con permiso, reservar.

Arriba hay un solo control de fechas. El botón resume el rango, por ejemplo «vie 16 oct → sáb 17 oct · 1 día». Los días de ese resumen se cuentan así: se redondea hacia arriba la duración partida en 24 horas, y nunca baja de 1. No usa la hora de gracia. Por eso el botón puede decir «2 días» y la tarjeta, más abajo, decir «1 día»: la tarjeta usa los días que se cobran.

Al abrir, el rango es mañana a las 09:00 hasta el día siguiente a las 09:00. No se guarda en la dirección: si se sale de la pestaña y se vuelve, regresa a ese rango. No hay atajos («Hoy», «7 días», «Este mes» no salen). Se pueden elegir días pasados.

El calendario es un panel. En el teléfono sube desde abajo. Textos, tal cual:

- «Tocá la fecha inicial.»
- «Desde 16/10/2026. Ahora la final.»
- «Desde 16/10/2026. Tocá la nueva final.»
- «De 16/10/2026 a 17/10/2026. Tocá la nueva inicial.»
- «Cancelar» cierra sin cambiar.
- «Aplicar» confirma. Está apagado hasta que hay fecha inicial y final válidas.

Si se escribe la fecha a mano y la inicial queda después de la final: «La fecha inicial es posterior a la final.». En «Libre» no hay día mínimo, así que no aparece «La fecha inicial ya pasó.».

Elegir un solo día en el calendario significa salir ese día y volver al día siguiente, los dos a las 09:00. Cualquier rango de «Libre» queda a las 09:00; no se elige otra hora en esta pestaña.

Si la vuelta no queda después de la salida, en rojo: «Revise las fechas», y no se pide la lista.

Con fechas válidas se piden solo los carros activos. En taller y retirados no salen. De los activos, esta pestaña muestra únicamente los libres de verdad. Un carro que sigue en la calle y volvería antes de la salida no sale aquí; sí sale en el paso Carro de «Nueva renta».

Orden: primero el más barato en el rango; a igual precio, por placa.

Encima de las tarjetas, el sello verde «Libre» y la cantidad.

Cada tarjeta:

- Foto.
- Nombre (marca, modelo y año).
- Debajo, año y tipo si hay año: «2022 · Sedán». Los tipos son «Sedán», «Camioneta» y «Pick up».
- Placa, o «Sin placa».
- Tarifa del rango y «/día». No siempre es la tarifa diaria del carro: desde 7 días cobrables se usa la tarifa semanal por día, si está cargada y es mayor que cero; desde 30, la mensual por día, con la misma regla. Si esa tarifa está vacía o en cero, se sigue con la diaria.
- «N días · $total». N son los días cobrables (con la gracia de ajustes; de fábrica, 1 hora). El total es tarifa × días, sin descuento ni cobertura. Ejemplo: $35.00 al día, del viernes 09:00 al sábado 09:40, gracia de 1 hora. La duración es 24 h 40 min. El botón del calendario dice «2 días» (24 h 40 min hacia arriba). Los días cobrables son 1, porque 24 h 40 min menos 1 hora de gracia no llegan a otro día. La tarjeta dice «1 día · $35.00».
- «Reservar», solo con permiso de crear rentas. Abre «Nueva renta» con ese carro y esas dos horas ya puestos, y el asistente arranca en el paso Cliente. Sin el permiso, la tarjeta se ve y no hay botón.

Vacío: «Nada libre». Cargando: «Cargando lo libre». Error: el mensaje del servidor en rojo.

El margen entre rentas (de fábrica, 1 hora) ya viene aplicado: un carro que se entrega a las 10:00 no sale como libre para una salida a las 10:30. Queda libre desde las 11:00.

### Pestaña «Rentas»

Lo que está pasando ahora. Lo cerrado hace más de unos días, y todo lo cancelado, viven en «Historial».

Arriba, el campo «Buscar», con el texto de ayuda «Placa o cliente». La lista espera un cuarto de segundo después de la última tecla. Busca, sin distinguir mayúsculas:

- el nombre del cliente;
- la placa, en mayúsculas y sin espacios;
- el número de contrato, si se escribe un número de hasta 9 dígitos, con o sin «#» delante.

No busca marca ni modelo. La búsqueda no sale del filtro que esté presionado: no encuentra una cancelada ni una devuelta de hace un mes.

Debajo, tres filtros. Cada uno trae su cantidad, que no cambia al buscar: la cantidad es del filtro entero.

| Filtro        | Qué lista                                                                   | Vacío               |
| ------------- | --------------------------------------------------------------------------- | ------------------- |
| «Por salir»   | Reservas: el carro todavía no salió, aunque la hora ya pasó                 | «Nada por salir»    |
| «En la calle» | Rentas en curso, incluidas las atrasadas. Es el filtro al entrar            | «Nadie en la calle» |
| «Ya volvió»   | Devueltas que tocan los últimos 7 días civiles: desde hoy menos 7 hasta hoy | «Nada devuelto»     |

Al buscar y no haber filas: «Sin resultados», en cualquiera de los tres. El filtro elegido queda en la dirección. «En la calle» no escribe estado en la dirección; los otros sí. Al volver desde una ficha se recupera el mismo filtro y la misma página.

La lista va de 25 en 25. Orden: la salida pactada más reciente primero. Columnas, y en tarjeta los mismos datos:

- «Ref.». Si la renta ya tiene número de contrato, se ve «#733» (el número tal cual, sin rellenar ceros). Una reserva no tiene número hasta que el carro sale, así que aquí se ve la posición de la fila en la página: «#1», «#2». No es un contrato.
- «Carro»: miniatura, placa si hay, y «Toyota Yaris 2022».
- «Cliente»: el nombre.
- «Cuándo»: arriba lo que pasa, en negrita; abajo la hora exacta. Si está atrasada, si no ha llegado o si debe dinero, la línea de arriba va en rojo.

Textos de «Cuándo», con la hora en formato «Hoy, 9:00», «Mañana, 9:00», «Ayer, 18:30» o «sáb 3 oct, 9:00» (sin a. m.):

| Situación                                  | Arriba                                               | Abajo                            |
| ------------------------------------------ | ---------------------------------------------------- | -------------------------------- |
| Reserva a tiempo                           | «Por entregar»                                       | la hora de salida                |
| Reserva cuya salida ya pasó                | «No ha llegado · 2 horas» o «No ha llegado · 1 día»  | «Debía salir: Hoy, 9:00»         |
| En la calle, a tiempo                      | «Regresa»                                            | la hora de regreso               |
| En la calle, hora de regreso ya pasada     | «Atrasado · 3 horas» o «Atrasado · 2 días»           | «Debía regresar: Ayer, 18:30»    |
| Devuelta y con saldo a favor de la empresa | «Debe $25» (sin centavos si son ,00; «$25.50» si no) | «Regresó: Hoy, 9:00»             |
| Devuelta y sin saldo                       | «Regresó»                                            | «Hoy, 9:00» o la forma que toque |

El atraso nunca dice menos de una hora: de 1 a 59 minutos se lee «1 hora». Desde 24 horas se habla en días, no en horas.

Tocar la fila abre la ficha. En bahía y en pantalla estrecha la tarjeta pone la referencia arriba, el carro como título, y «Cliente» y «Cuándo» con su rótulo.

El pie dice cuántas hay. Si caben en una página: «12 rentas» o «1 renta». Si no: «1–25 de 40 rentas», más «Anterior», «1 de 2» y «Siguiente». Esos botones se apagan en la primera y en la última página. Con cero filas el pie dice «0 rentas». Mientras carga se lee «Cargando la lista». Si falla, el mensaje del servidor reemplaza la tabla.

Estados que esta pestaña deja ver, y a dónde pasan:

- Reservada: está en «Por salir». Si la hora de salida ya pasó y nadie entregó el carro, sigue reservada. No pasa sola a cancelada ni a libre. El carro, en Hoy, queda «Atrasado» desde el día siguiente a la salida pactada; el mismo día de la salida queda «Reservado» aunque la hora ya pasó.
- En la calle: está en «En la calle». Cuando la hora de regreso pasa, el sello de la ficha dice «Atrasada» (rojo, con reloj), pero en esta lista sigue bajo «En la calle» con el renglón rojo «Atrasado · …». No hay un filtro aparte para atrasadas.
- Devuelta: los últimos 7 días civiles están en «Ya volvió». Más viejas, en «Historial».
- Cancelada: no aparece en esta pestaña.

### Pestaña «Historial»

Lo cerrado y lo cancelado, de un mes a la vez, de 15 en 15. Al entrar es el mes actual.

«Buscar», ayuda «Placa, cliente o contrato». Misma espera de un cuarto de segundo y la misma búsqueda que en «Rentas» (nombre, placa o número de contrato). Con texto escrito, el mes se ignora y se buscan todas las fechas; las flechas del mes se ocultan. El filtro de estado y el de carro siguen valiendo.

Filtros de estado, sin cantidad: «Todas» (cerradas y canceladas), «Cerradas», «Canceladas». Al entrar, «Todas».

Al lado, un filtro con icono de carro. Cerrado dice «Todos los carros». Abierto, otra vez «Todos los carros» y después cada carro: placa, si tiene, y «Toyota Yaris 2022». Elegir uno deja el chip presionado con el nombre del carro. Sin permiso de ver la flota, el menú solo ofrece «Todos los carros». Si la dirección ya traía un carro y no se puede cargar la lista, el chip sigue diciendo «Todos los carros» pero la lista sí queda filtrada por ese carro.

El mes se lee «octubre 2026». «Mes anterior» retrocede sin límite. «Mes siguiente» se apaga en el mes actual y no deja pasar de hoy. El mes, el estado, el carro y la página quedan en la dirección, así que la ficha abierta desde aquí vuelve al mismo sitio.

A la derecha del mes, cuando ya hay respuesta: «3 rentas» o «1 renta».

Columnas, y lo mismo en tarjeta:

- «Contrato». Con número: «#0733» (cuatro dígitos, con ceros a la izquierda). Sin número: «Sin contrato», en gris. No se usa la posición de la fila.
- «Carro»: miniatura, placa y nombre.
- «Cliente».
- «Fechas»: «sáb 3 oct → lun 5 oct». Si ya hubo salida o regreso real, se usan esos días; si no, los pactados.
- «Total»: el total del contrato, por ejemplo «$110.00». Si está cancelada, en vez del monto va el sello «Cancelada»: gris, con un icono de prohibido. No se muestra el saldo.

Tocar la fila abre la ficha. Vacío del mes: «Nada este mes». Buscando: «Sin resultados». Pie de página igual que en «Rentas», de 15 en 15. Orden: salida pactada más reciente primero.

Una devuelta de esta semana puede estar a la vez en «Ya volvió» y en el mes del historial. Una cancelada solo está aquí.

### «Nueva renta»

Título «Nueva renta». Arriba, el regreso «Rentas» lleva a la pestaña «Rentas» (filtro «En la calle»), no a Hoy ni a «Libre». El botón «Cerrar» del primer paso hace lo mismo.

Cuatro pasos, en una barra: «Carro», «Cliente», «Contrato», «Confirmar». El paso actual va resaltado y con filete naranja. Los ya pasados muestran una palomita y se pueden tocar para volver. Un paso al que todavía no se llegó está apagado. Si se toca uno de más adelante y un paso anterior no está listo, el asistente se queda en el que falla y muestra el aviso en rojo, al pie del formulario.

Abre en el paso Carro. Si la dirección trae un carro (y las fechas), abre en Cliente. Si trae carro y cliente, abre en Contrato. Eso es lo que hace «Reservar» desde «Libre»: carro y las dos horas, y arranca en Cliente. Si también llega un cliente (desde la ficha del cliente), arranca en Contrato.

En cuanto hay un carro elegido y las fechas sirven, el pie muestra «Total» y el monto, por ejemplo «$110.00». En bahía esa cifra pasa a su propio renglón, encima de los botones. La garantía no entra en ese total.

Botones del pie:

| Dónde                                               | Izquierda                      | Derecha                                                      |
| --------------------------------------------------- | ------------------------------ | ------------------------------------------------------------ |
| Paso Carro                                          | «Cerrar»                       | «Siguiente»                                                  |
| Paso Cliente, buscando                              | «Atrás»                        | «Siguiente» (apagado si no hay un cliente que se pueda usar) |
| Paso Cliente, creando o actualizando                | «Atrás» (vuelve a la búsqueda) | «Guardar y seguir»                                           |
| Paso Contrato                                       | «Atrás»                        | «Revisar»                                                    |
| Paso Confirmar, y la salida es hoy, con «Sí, ahora» | «Atrás»                        | «Seguir a la entrega»                                        |
| Paso Confirmar, en cualquier otro caso              | «Atrás»                        | «Reservar»                                                   |

«Atrás» baja un paso y borra el aviso rojo. No borra lo escrito.

El asistente no guarda un borrador. Si se sale, hay que empezar de nuevo.

Lo que no se pregunta, y queda grabado igual: el lugar de entrega y el de devolución salen los dos como «Oficina». La renta incluye IVA según el valor de fábrica (sí), pero el IVA de fábrica es 0.

Crear la reserva no exige caja abierta y no cobra. El número de contrato tampoco se asigna aquí: se asigna cuando el carro sale, en la pantalla de entrega. Hasta entonces la reserva no tiene número.

#### Paso 1 · Carro

Pregunta «Fechas». El botón del rango se lee igual que en «Libre» («vie 16 oct → sáb 17 oct · 1 día»), con la misma cuenta sin gracia. El calendario no tiene atajos. A diferencia de «Libre», no se puede elegir un día anterior a hoy: esos días están apagados. Si se escribe una inicial ya pasada: «La fecha inicial ya pasó.».

Al abrir, sin fechas en la dirección, la salida es hoy a las 11:00 y el regreso es mañana a las 11:00. Si esa hora de hoy ya pasó, la salida sube al cuarto de hora siguiente (10:07 pasa a 10:15; 10:00 en punto se queda) y, si el regreso quedó detrás, pasa a un día después de esa hora nueva.

Debajo, dos relojes: «Hora de salida» y «Hora de regreso». Se ven en 12 horas, por ejemplo «11:00 AM». El reloj ofrece horas del 1 al 12, minutos 00, 15, 30 y 45, y AM/PM. Cada toque cambia la hora; al elegir el minuto se cierra. Si la salida es hoy, las horas anteriores a ese cuarto de hora quedan apagadas, y una combinación que caiga antes salta al mínimo. El regreso no tiene mínimo de reloj. Una hora que no cae en un cuarto (llegó así en la dirección) se muestra tal cual y ningún minuto queda marcado.

Cambiar el día conserva las horas. Elegir un solo día hace que el regreso sea el día siguiente, a la hora de regreso que ya estaba.

Si el regreso no queda después de la salida, en rojo: «Revise las fechas», y no hay lista de carros. El mismo texto aparece al pulsar «Siguiente».

Con fechas válidas, pregunta «Carro». Entran carros activos que en ese rango están:

- libres, o
- en la calle, con el regreso pactado más el margen (de fábrica, 1 hora) en o antes de la salida nueva.

Ese segundo caso es «libre si regresa a tiempo». El carro sigue afuera. Se puede apartar. El sello es ámbar y dice «Vuelve sáb 17 oct» (el día pactado de regreso). Si el sistema no manda ese día, el sello dice «Libre si regresa a tiempo». Un carro ocupado de verdad (reserva que choca, o renta en curso cuyo regreso pactado más el margen cae después de la salida nueva) no se lista. Taller y retirados tampoco.

Primero van los libres y después los que vuelven antes. Dentro de cada grupo, del más barato al más caro, y a igual precio por placa.

Si hay al menos un carro elegible:

- «Buscar carro», ayuda «Placa o modelo». Busca en la placa y en el nombre (marca, modelo, año), sin acentos y sin distinguir mayúsculas. Con texto, una ✕ cuyo nombre para el lector es «Borrar búsqueda».
- Chips: «Todos» con la cantidad, y un chip por cada tipo presente («Sedán», «Camioneta», «Pick up»), también con su cantidad. Solo salen tipos que tienen algún carro en la lista.

Cada fila es un botón: un círculo (lleno y naranja si está elegido), la miniatura, la placa si hay, el sello ámbar si vuelve, el nombre y el total del rango en compacto («$70» o «$70.50»). Ese total es tarifa del tramo × días cobrables, todavía sin cobertura ni descuento. Elegir no avanza solo: hay que pulsar «Siguiente».

Sin carros: «Nada libre». Con carros pero el filtro no deja ninguno: «Sin resultados». Cargando: «Buscando lo libre». Error de red o de permiso: el mensaje, textual.

Si el carro elegido deja de estar disponible porque se movieron las fechas (también el que vino en la dirección), se suelta solo, el asistente vuelve al paso Carro y los pasos de más adelante se apagan.

Al pulsar «Siguiente» desde este paso, en rojo y sin avanzar:

- «Revise las fechas»
- «La salida ya pasó»
- «Elija un carro»

#### Paso 2 · Cliente

«Buscar cliente», ayuda «Buscar por nombre, DUI o teléfono». La lista espera un cuarto de segundo.

Sin texto, el rótulo es «Recientes» y se piden los 5 clientes con la renta más reciente. Con texto, «N resultados» o «1 resultado», hasta 30. Si hay filas y todavía no se eligió a nadie: «Elija un cliente para seguir».

La búsqueda mira el nombre (todas las palabras tienen que estar), el documento, la licencia y los teléfonos. Desde 3 dígitos también compara documento y teléfonos sin guiones.

Cada tarjeta: iniciales, nombre, tipo de documento y número («DUI» o «Pasaporte»), «Tel.» y el teléfono si hay, y una línea de historia: «Cliente nuevo», «3 rentas» o «3 rentas, la última hace 2 semanas». Esa línea usa «hoy», «ayer», «hace 3 días», «hace 2 semanas», «hace 4 meses» o «hace más de un año».

A la derecha, un sello:

- «No rentar», rojo, si está marcado así o si está inactivo. Este sello tapa el de la licencia.
- «Licencia vencida», rojo.
- «Licencia vence 02/11», ámbar, si vence en 30 días o menos (se muestran día y mes).
- «Licencia vigente», verde, si faltan más de 30 días.
- Sin fecha de vencimiento y sin bloqueo, no hay sello.

Tocar elige. Tocar otra vez el mismo, lo suelta. El elegido lleva un círculo naranja con palomita («Elegido» para el lector). Si el elegido no está en la página de resultados, su tarjeta se queda fija arriba.

Vacío, sin texto: «Sin clientes». Sin coincidencias: «Nadie coincide con «Ana».», con el texto escrito. Con permiso de clientes, el botón es «Cliente nuevo» o, si había búsqueda, «Crear cliente con «Ana»». Si ya hay resultados, el botón «Cliente nuevo» queda debajo de la lista. Sin permiso de crear clientes, esos botones no están.

Elegir no avanza solo.

Debajo del elegido pueden salir avisos:

- Bloqueado o inactivo, en rojo: «No rentar.» o, si hay motivo, «No rentar: no devolvió el carro». Esto impide seguir.
- Menor de la edad mínima, en ámbar: «Tiene 19 años: la edad mínima es 21.». La edad de fábrica es 21; si en ajustes es otra, el número es el de ajustes. Este aviso no impide seguir.
- Licencia vencida, en rojo: «La licencia de Ana venció el 02/11/2026. Pida la licencia nueva para seguir.». «Ana» es la primera palabra del nombre. Impide seguir. Con permiso de editar clientes hay «Actualizar licencia».
- Licencia por vencer, en ámbar: «La licencia de Ana vence el 02/11/2026. Puede rentar, pero recuérdele renovarla.». No impide seguir.

Al pulsar «Siguiente»:

- «Elija un cliente»
- «No rentar»
- «La licencia está vencida»

La edad no está en esa lista.

##### Crear o actualizar al cliente sin salir

«Actualizar licencia» abre el mismo formulario con los datos del elegido y el título «Actualizar cliente». «Cliente nuevo» abre «Cliente nuevo». Lo escrito en la búsqueda se reparte así: si son solo dígitos (se permiten espacios y guiones) y hay 8, van al celular de El Salvador; si son solo dígitos y no son 8, van al DUI; si hay letras, van al nombre.

Arriba, un botón largo: «¿Ya es cliente? Búsquelo por nombre, DUI o teléfono», y en pantalla ancha «Volver a buscar». «Atrás» hace lo mismo y, si era un alta, deja en el buscador el nombre, o si no el documento, o si no el teléfono.

Campos:

| Campo                                                   | Obligatorio para guardar       | Detalle                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «Nombre completo», ayuda «Como aparece en el documento» | Sí, al menos 3 caracteres      | Si falta, la lista de abajo dice «nombre»                                                                                                                                                                                                                                                                            |
| «Documento»                                             | Sí                             | A la izquierda el tipo: «DUI» o «Pasaporte» (el botón se llama «Tipo: DUI»). El DUI toma 9 dígitos y se escribe «01234567-8». El pasaporte se pasa a mayúsculas y pide al menos 5 caracteres                                                                                                                         |
| «Celular»                                               | Sí, con los dígitos de su país | El país arranca en El Salvador, máscara «0000-0000» (8 dígitos, se ve «7123-4567»). El botón del país abre un buscador «País, sigla o código». Arriba van El Salvador, Guatemala, Honduras y Estados Unidos; el resto, por nombre. Cambiar de país borra el número. Un celular de otro país se guarda con su prefijo |
| «Número de licencia»                                    | Sí                             | Si el documento es DUI, aparece la casilla «Es el mismo número del DUI». Marcada, la licencia copia el DUI y el campo queda apagado. En pasaporte esa casilla no está                                                                                                                                                |
| «La licencia vence el»                                  | Sí                             | Calendario. Vacío se lee «Sin fecha». El valor se ve «dd/mm/aaaa»                                                                                                                                                                                                                                                    |

No se piden aquí correo, dirección, nacimiento ni el motivo de «No rentar». Actualizar no quita el bloqueo: solo cambia estos cinco datos.

Avisos mientras se escribe:

- Nombre parecido ya registrado (solo al crear, cuando el nombre tiene al menos 3 letras y el documento no está repetido): «¿Es Ana López? Ya está registrado.» y «Usar este cliente». No impide guardar.
- Documento de otra persona: «Este documento ya es de Ana López.» y «Usar este cliente». Sí impide guardar. Mientras se comprueba, «Guardar y seguir» espera.
- Licencia ya vencida, bajo la fecha: «Ya venció. No se puede rentar con esta licencia.»
- Licencia vigente: «Vigente», en verde.
- Por vencer: «Vence en 12 días. Recuérdele renovarla.» o «Vence en 1 día. Recuérdele renovarla.». Se puede guardar.
- Falta algo: «Para guardar falta: nombre, documento, celular, licencia, vencimiento.». Solo se listan los que faltan, en ese orden.

«Guardar y seguir» está apagado hasta que no falta nada, la licencia no está vencida y el documento no está repetido. Al guardar bien, el aviso es «Cliente guardado» y debajo el nombre. El cliente queda elegido y el asistente pasa solo al paso Contrato.

Si el servidor rechaza el alta o la actualización, el mensaje va en rojo al pie y es el texto general, no el de cada campo. Los que esta pantalla muestra:

- «Revisá los datos: hay algo que no está bien.» cuando el dato no pasa el contrato. Pasa, por ejemplo, si el nombre supera 120 caracteres, o si el documento, la licencia o el celular superan 30. El aviso de cada campo («El nombre no puede pasar de 120 caracteres.», «El documento no puede pasar de 30 caracteres.», «La licencia no puede pasar de 30 caracteres.», «El celular no puede pasar de 30 caracteres.», «Escribí el nombre.») viaja en el detalle y esta pantalla no lo pinta.
- «Ese cliente no existe.» si se estaba actualizando y ya no está.
- «No tenés permiso para hacer esto.»
- «No se pudo conectar con el servidor.»

El parecido de nombre y el documento repetido los frena la pantalla antes de enviar. El servidor no tiene un mensaje propio de «documento duplicado» en esta alta.

#### Paso 3 · Contrato

Pregunta «Si choca el carro». Dos opciones grandes. La elegida lleva filete naranja. Al abrir está elegida la segunda.

- «Paga hasta $500» (o «Paga hasta el deducible» si todavía no hay un monto mayor que cero) y debajo «+ $5/día» en naranja, o «Sin cargo» si el cargo es cero. Aunque esta opción no esté elegida, el recuadro ya enseña el deducible y el cargo por día de los ajustes, para que se vea qué se va a copiar.
- «Paga todos los daños» y debajo «Sin cargo». Es la opción inicial. El cliente responde por los daños y no se suma un cargo diario.

Al elegir la primera, si los campos siguen vacíos se copian el cargo por día y el deducible de ajustes. De fábrica esos dos están vacíos, así que hay que escribirlos. Lo que ya se escribió no se pisa al volver a tocar la opción. Al volver a «Paga todos los daños» los campos se ocultan; lo escrito se conserva por si se regresa.

Con la cobertura elegida aparecen:

- «Cargo por día ($)». Opcional en el sentido de que vacío vale 0. No acepta negativo ni un texto que no sea monto. Ayuda «0.00». Se puede usar coma o punto.
- «Paga si choca ($)». Tiene que ser mayor que cero.

El resto del paso:

| Campo            | Obligatorio                           | Detalle                                                                                                                                                           |
| ---------------- | ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «Descuento ($)»  | No. Vacío es 0                        | No puede pasar del tope. Ver la fórmula más abajo                                                                                                                 |
| «Garantía»       | No. Vacío es 0                        | No se suma al total. Es un depósito que se devuelve o se aplica después, en otra pantalla                                                                         |
| «Método»         | Solo si la garantía es mayor que cero | Ayuda «Elija el método». Opciones, en este orden: «Efectivo», «Tarjeta», «Transferencia», «Otro». Si la garantía vuelve a cero, el método se oculta y no se envía |
| «Otro conductor» | No. Apagado al abrir                  | Interruptor. Al encenderlo salen los campos de abajo                                                                                                              |
| «Nombre»         | Sí, si hay otro conductor             | Hasta 120 caracteres                                                                                                                                              |
| «Licencia»       | No                                    | Hasta 30 caracteres                                                                                                                                               |
| «Vence»          | No                                    | Se escribe «dd/mm/aaaa». El campo pone las barras solo. Vacío está bien. Una fecha imposible no                                                                   |
| «Nacimiento»     | No                                    | Igual que «Vence»                                                                                                                                                 |
| «País»           | No                                    | Hasta 60 caracteres                                                                                                                                               |
| «Notas»          | No                                    | Hasta 2000 caracteres. No hay contador en pantalla                                                                                                                |

Avisos al pulsar «Revisar», en rojo, sin pasar a Confirmar:

- «Revise el cargo por día» (texto que no es un monto, o negativo)
- «Falta cuánto paga si choca» (vacío, cero o negativo)
- «Revise el descuento»
- «El descuento no puede pasar de $120» (el tope, sin centavos si son ,00; «$120.50» si no)
- «Revise la garantía»
- «Falta el método de la garantía»
- «Falta el nombre del conductor»
- «Revise las fechas del conductor»

Un monto no puede pasar de $99999.99. Si se pasa de los pasos y el dato igual no sirve, el pie muestra el primer aviso del contrato, por ejemplo «Escribí un monto válido, con hasta dos decimales.», «El monto no puede pasar de $99999.99.», «No puede pasar de 120 caracteres.», «La licencia no puede pasar de 30 caracteres.», «El país no puede pasar de 60 caracteres.», «La nota no puede pasar de 2000 caracteres.», «Escribí el nombre del conductor adicional.», «Escribí la fecha y la hora.» o «El regreso tiene que ser después de la salida.».

Tope del descuento, en esta alta (todavía no hay cargos extra, kilómetros, combustible, daños ni multas):

(tarifa del rango + cargo por día de la cobertura) × días cobrables

Sin cobertura, el cargo por día vale 0. El descuento puede ser igual al tope. Un peso más, no. El total nunca baja de cero.

Ejemplo. Tarifa $35.00, 3 días cobrables, cobertura de $5.00 al día, descuento $10.00, garantía $100.00 en efectivo.

- Tope = (35 + 5) × 3 = $120.00. El descuento de $10 cabe.
- Total del pie = 120 − 10 = $110.00.
- La garantía de $100 no se resta ni se suma. Queda anotada aparte.
- Días cobrables: se toma la salida y el regreso, se restan las horas de gracia (de fábrica, 1) y se redondea hacia arriba a días de 24 horas, con mínimo 1. Del viernes 11:00 al lunes 11:00 son 72 horas. Menos 1 hora de gracia siguen siendo 3 días.

La tarifa de esos 3 días es la diaria. Si los días cobrables fueran 7 o más y el carro tiene tarifa semanal mayor que cero, esa tarifa por día reemplaza a la diaria. Desde 30, la mensual, con la misma regla.

#### Paso 4 · Confirmar

Arriba, la foto, el nombre y la placa del carro.

Cada dato tiene «Cambiar», que vuelve a ese paso si los anteriores siguen válidos:

- «Fechas»: «vie 16 oct, 11:00 a. m. → lun 19 oct, 11:00 a. m.». El formato es el de El Salvador, con día corto, mes corto y hora. Los espacios finos del sistema se ven como espacio normal.
- «Cliente»: el nombre en negrita.
- «Si choca»: «Paga hasta $500» si hay cobertura, o «Paga todos los daños» si no.
- «Conductor»: solo si el interruptor está encendido y el nombre, ya sin espacios de más, no está vacío. Muestra ese nombre.

Debajo, el desglose. Solo salen las líneas que suman:

- «3 días × $35» y a la derecha «$105.00».
- «Cobertura, 3 × $5» y «$15.00», solo si el cargo por día es mayor que cero.
- «Descuento» y «−$10.00», solo si el descuento es mayor que cero.

El total grande del pie es la suma. En el ejemplo, $110.00. La garantía no tiene línea aquí.

Si la salida es hoy, la pregunta «¿Se lleva el carro ahora?»:

- «Sí, ahora», subtítulo «Entrega y cobro». Es la opción al llegar a este paso cuando la salida es hoy.
- «No, solo apartar», subtítulo «Se entrega después».

Si la salida es mañana o después, esa pregunta no está. En su lugar, un recuadro: «Se aparta el carro» y «Sale vie 16 oct, 11:00 a. m.». El botón de la derecha es «Reservar».

Qué pasa al confirmar:

- «Sí, ahora» (salida hoy): se crea la reserva, el aviso dice «Lista para entregar» y debajo el nombre del cliente, y se abre la ficha con el cuadro de entrega. El cobro y la inspección ocurren ahí, no en este asistente. Esta pantalla no abre la caja.
- «No, solo apartar», o una salida que no es hoy: aviso «Renta reservada» y el nombre, y se abre la ficha sin el cuadro de entrega. El estado queda reservado.

El botón muestra que está trabajando mientras guarda, y no hay que pulsarlo dos veces.

Si el servidor rechaza el alta, el aviso rojo es el mensaje del servidor y, según el caso, el asistente vuelve al paso que hay que corregir:

| Qué pasó                                              | Mensaje, textual                                                             | Vuelve a                                           |
| ----------------------------------------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------- |
| El cliente está marcado «No rentar», con motivo       | «Ana López está marcado «No rentar»: no devolvió el carro»                   | Cliente                                            |
| Igual, sin motivo                                     | «Ana López está marcado «No rentar».»                                        | Cliente                                            |
| El cliente ya no existe                               | «Ese cliente no existe.»                                                     | Se queda en Confirmar; el texto es el del servidor |
| El carro ya no existe                                 | «Ese carro no existe.»                                                       | Se queda en Confirmar                              |
| El carro pasó a taller                                | «Ese carro está en el taller: no se renta.»                                  | Carro                                              |
| El carro fue retirado                                 | «Ese carro está retirado: no se renta.»                                      | Carro                                              |
| Otra renta en curso choca, con el margen              | «El carro ya está rentado a Ana López en esas fechas (con 1 h de margen).»   | Carro                                              |
| Una reserva choca, con el margen                      | «El carro ya está reservado a Ana López en esas fechas (con 1 h de margen).» | Carro                                              |
| El descuento se pasó del tope que calculó el servidor | «El descuento no puede pasar de $120.00.»                                    | Contrato                                           |
| La vuelta no queda después de la salida               | «El regreso tiene que ser después de la salida.»                             | Se queda; el texto es ese                          |
| El cuerpo no pasa la validación del servidor          | «Revisá los datos: hay algo que no está bien.»                               | Se queda en Confirmar                              |
| Sin permiso de crear rentas                           | «No tenés permiso para hacer esto.»                                          | Se queda                                           |
| Sin red                                               | «No se pudo conectar con el servidor.»                                       | Se queda                                           |

El «1 h» del margen es el de ajustes en ese momento, no siempre 1. Un cliente inactivo (no bloqueado) lo frena la pantalla con «No rentar» antes de enviar; el servidor, en esta alta, solo repite el rechazo cuando el cliente está marcado «No rentar».

La licencia vencida también la frena la pantalla («La licencia está vencida»). El servidor no vuelve a mirar la fecha de la licencia al crear la reserva.

#### Casos que se cruzan

- Caja cerrada. Apartar no cobra y no pide turno de caja. «Sí, ahora» solo crea la reserva y abre la entrega. Si en la entrega se quiere cobrar y no hay caja abierta, esa otra pantalla dice «Abrí la caja para cobrar.». Este asistente no muestra ese texto.
- Pago parcial. Aquí no se cobra. El saldo nace igual al total. En la lista, una devuelta con saldo muestra «Debe $25» en rojo. Una reserva nueva no aparece como «Debe» porque sigue en «Por salir».
- Salida hoy, tarde. No se puede dejar una hora ya pasada: el reloj y el aviso «La salida ya pasó» la suben. «¿Se lleva el carro ahora?» sí aparece, porque el día es hoy.
- Salida en el futuro. No aparece la pregunta. El botón es «Reservar» y el recuadro dice «Se aparta el carro».
- Carro que vuelve antes. No está en la pestaña «Libre». Sí está en el paso Carro, con sello ámbar «Vuelve sáb 17 oct». Se puede reservar. Si al guardar el carro sigue en la calle y el margen ya no alcanza (la otra renta se alargó, o el margen cuenta hasta ahora), el servidor responde «El carro ya está rentado a … en esas fechas (con N h de margen).».
- Dos reservas del mismo carro. La segunda, si las fechas se cruzan dejando menos del margen, no se ofrece. Si alguien la fuerza, el servidor dice «El carro ya está reservado a …».
- Reserva que el cliente no recogió. Sigue en «Por salir» con «No ha llegado · …» en rojo. No se cancela sola. El carro no vuelve a «Libre» en Hoy: desde el día siguiente a la salida pactada el sello del carro es «Atrasado».
- Regreso el mismo día, hora ya pasada. En Hoy sigue en «Salen y vuelven» («Vuelve hoy · …», sin rojo). En la pestaña «Rentas» el número de atrasadas ya cuenta, y la fila dice «Atrasado · 1 hora».
- Regreso de un día anterior. Sale de «Salen y vuelven» y entra a «Pendientes», con «Llamar» si hay teléfono.
- Licencia por vencer o conductor joven. Se avisa y se deja continuar. Licencia vencida, «No rentar» o cliente inactivo: no.
- Descuento igual al tope. Se acepta y el total queda en $0.00. Un centavo más, no.
- Garantía en cero. No se pide método. Garantía escrita y método vacío: «Falta el método de la garantía».
- Otro conductor con el interruptor apagado. Esos campos no se envían, aunque se hayan llenado antes.
- Fechas del conductor a medias, por ejemplo «32/13/2026» o «12/10». «Revise las fechas del conductor». Vacías, están bien.
- Más de un carro el mismo día en «Próximos 7 días». Cuentan carros distintos, no contratos. Dos rentas del mismo carro el mismo día suman 1.
- Flota de más de 100 carros en Hoy. «Todos» muestra el total; las tarjetas y los otros chips, solo la primera página de 100.

---

## Ficha de la renta: entrega, recibo, cuenta y contrato

Esta sección describe la ficha de una renta ya creada: el encabezado y los sellos, los botones de cada estado, el menú «⋯», el bloque «Cuenta», los pagos y «Anular», la garantía, los asistentes «Entregar» y «Recibir», y la impresión del contrato y de la hoja de inspección. Los textos entre comillas son los de la pantalla, copiados tal cual.

### Cómo se llega y quién la ve

La ficha se abre solo con el permiso de ver rentas (rentals.read), el que en el catálogo se llama «Ver inicio, calendario, rentas y disponibilidad». Sin ese permiso la pantalla dice «No tenés permiso para ver la renta.» y debajo «Si debería ser tuyo, pedile el permiso a quien administra. El riel a la izquierda (o abajo) te saca de acá.»

Caminos que abren la misma ficha:

- Menú «Renta» → pestaña «Rentas» → pestaña interior «Rentas» → tocar la fila del carro.
- La misma pestaña «Rentas» → «Historial» → tocar la fila. En el historial la referencia es «#0733» (el número con cuatro dígitos) o, si todavía no tiene número, «Sin contrato» en gris.
- Menú «Renta» → «Hoy». La fila abre la ficha. El botón «Entregar» de una salida de hoy abre la ficha y, enseguida, el asistente de entrega. El botón «Recibir» abre la ficha y el asistente de recibo.
- «Caja» (hace falta el permiso de cobrar, rentals.charge) → un cobro del turno, una cuenta por cobrar o un depósito en custodia → la fila abre la ficha.
- La ficha del cliente de renta, si se tiene permiso de ver clientes (renters.read).
- Al guardar una renta nueva marcada para entregar en el momento, el sistema entra a la ficha y abre «Entregar» solo.

Mientras carga, el esqueleto dice «Cargando la renta». Si la renta no existe o la lectura falla, el texto rojo es el mensaje del servidor, o «No se pudo cargar la renta.» si no llegó ninguno. El caso típico del servidor es «Esa renta no existe.»

El número de contrato no aparece en el encabezado de la ficha. Aparece al imprimir, en el historial y en el aviso de un cambio de carro.

### Encabezado

Arriba, a la izquierda: la placa, si el carro tiene una, y el nombre del carro, armado como marca, modelo y año. Ejemplo: «Toyota Yaris 2022». Si no hay año, ese dato no se escribe. Debajo, el nombre del cliente. Con permiso de ver clientes (renters.read) el nombre es un enlace a la ficha de ese cliente. Sin ese permiso el nombre se lee igual y no se puede tocar.

Al lado del nombre hay una o dos pastillas de las otras rentas de ese cliente (también piden ver rentas):

- «Cliente nuevo», en azul, cuando esta es su única renta.
- «Debe $50.00», en rojo, cuando otras rentas ya devueltas tienen saldo a favor de la empresa. La suma usa solo rentas con estado devuelto y saldo mayor que cero. Tocarla baja a la sección «Otras rentas».
- «1 renta» o «5 rentas», en gris. El número es el total de las otras rentas, de cualquier estado. Tocarla baja a la misma sección.

La frase de fechas del encabezado usa la hora real cuando ya existe, y la planificada cuando todavía no. El formato es «sale jue 8, 9:00 → vuelve lun 12, 9:00»: día de la semana en minúscula, número del día y hora en 24 horas, hora de El Salvador. No lleva mes ni «a. m.».

A la derecha del encabezado está el sello del estado, grande. En la densidad de bahía los botones de al lado pasan a una fila de ancho completo, con alto táctil.

### Sellos y estados

El sello siempre lleva icono y palabra. El color refuerza la palabra; no la reemplaza. Ninguno parpadea.

| Sello         | Color   | Icono           | Cuándo                                                                |
| ------------- | ------- | --------------- | --------------------------------------------------------------------- |
| «Reservada»   | Azul    | Calendario      | La renta está reservada. El carro todavía no salió.                   |
| «En la calle» | Naranja | Llave           | El carro ya se entregó y la hora de regreso planificada no ha pasado. |
| «Atrasada»    | Rojo    | Reloj de alarma | El carro sigue afuera y la hora de regreso planificada ya pasó.       |
| «Devuelta»    | Verde   | Check           | El carro ya se recibió.                                               |
| «Cancelada»   | Gris    | Prohibido       | La reserva o la renta en curso se canceló.                            |

«Atrasada» no es un estado que se guarde. Por dentro la renta sigue «en curso». Por eso un botón que vale para una renta en curso también vale cuando el sello dice «Atrasada». La ficha no muestra «Atrasado · 2 días»; esa frase vive en la lista, no aquí.

Transiciones:

1. Reservada → en la calle, al completar «Entregar». El carro pasa a ocupado en las fechas de la renta.
2. En la calle → atrasada, solo, en el momento en que el reloj pasa la hora de regreso planificada. No hay un botón para marcarla atrasada.
3. En la calle o atrasada → devuelta, al completar «Recibir». El carro queda libre.
4. Reservada → cancelada, con «Cancelar». También en curso o atrasada → cancelada, solo si el pagado es cero.
5. Devuelta y cancelada no vuelven atrás. El servidor responde «La renta ya está cerrada (finalizada o cancelada): no se puede cambiar.»

Una renta reservada ocupa el carro en el tramo planificado. Una en curso lo ocupa desde la salida real hasta el regreso planificado, y si ya está atrasada lo sigue ocupando hasta que se reciba. Entre una renta y la siguiente el sistema deja las horas de margen de los ajustes (1 hora si no se cambió). Por eso entregar o mover fechas puede chocar con otra renta aunque las horas no se pisen: el mensaje es «El carro ya está rentado a María López en esas fechas (con 1 h de margen).» o «El carro ya está reservado a María López en esas fechas (con 1 h de margen).» El nombre y las horas son los reales.

La licencia vencida y la marca «No rentar» se controlan al crear la renta. Entregar o recibir desde esta ficha no vuelve a revisar la licencia ni el bloqueo del cliente.

### Botones, según estado y permiso

El botón relleno (el principal) es uno solo, y a veces no hay ninguno. Los demás son de contorno. Cada uno se esconde si falta el permiso, no queda gris: el menú «⋯» es la excepción, porque ahí algunas entradas se ven desactivadas.

Permisos, en palabras del catálogo:

- Gestionar rentas (rentals.manage): «Crear, editar, entregar, recibir, extender, cambiar y cancelar rentas».
- Cobrar (rentals.charge): «Registrar cobros, devolver depósitos, multas y ver la caja de renta».

| Botón                         | Se ve cuando                                                                                       | Qué abre y qué queda                                                                                                                                                                                                                                                                                 |
| ----------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| «Entregar» (relleno)          | Reservada, y hay permiso de gestionar.                                                             | El asistente «Entregar». Al terminar, el sello pasa a «En la calle» o a «Atrasada» si la hora de regreso planificada ya pasó. La cuenta se recalcula con la hora real de salida.                                                                                                                     |
| «Recibir» (relleno)           | En la calle o atrasada, y hay permiso de gestionar.                                                | El asistente «Recibir». Al terminar, el sello pasa a «Devuelta» y la cuenta queda con los días, los km extra, el combustible y los daños de ese recibo.                                                                                                                                              |
| «Cobrar» (relleno)            | Devuelta, con saldo mayor que cero, y hay permiso de cobrar.                                       | El diálogo «Registrar pago».                                                                                                                                                                                                                                                                         |
| «Devolver garantía» (relleno) | Devuelta, saldo cero o a favor del cliente, garantía todavía en custodia, y hay permiso de cobrar. | El diálogo «Devolver depósito».                                                                                                                                                                                                                                                                      |
| «Extender»                    | En la calle o atrasada, y hay permiso de gestionar.                                                | El diálogo «Extender». Al guardar, aviso «Renta extendida» y la descripción «Regresa …» con la hora nueva. La ficha agrega una línea en «Días» y vuelve a calcular los días a cobrar.                                                                                                                |
| «Multa»                       | En la calle, atrasada o devuelta, y hay permiso de cobrar. No sale en reservada ni en cancelada.   | El diálogo «Multa», con el carro y el cliente en el subtítulo. Al guardar, aviso «Multa registrada». Si se le carga al cliente, entra al renglón «Multas» de la cuenta.                                                                                                                              |
| «Cambiar carro»               | En la calle o atrasada, y hay permiso de gestionar.                                                | El diálogo «Cambiar carro». Cierra esta renta (como un recibo) y abre otra, ya en la calle, con el carro nuevo. Aviso «Carro cambiado». Si la nueva tiene número, la descripción es «Sigue en N° 734» (el número tal cual, sin ceros a la izquierda). La pantalla pasa a la ficha de la renta nueva. |
| «Cobrar» (contorno)           | En la calle o atrasada, hay saldo y hay permiso de cobrar.                                         | El mismo «Registrar pago». En una devuelta con saldo este contorno no está: el relleno ya es «Cobrar».                                                                                                                                                                                               |

Si no corresponde ninguno de los cuatro principales, no hay botón relleno. Una cancelada, o una devuelta ya pagada y con la garantía devuelta, queda solo con el menú «⋯».

Desde «Hoy», la dirección puede traer `action=deliver` o `action=return`. Con permiso de gestionar, «deliver» abre «Entregar» si sigue reservada, y «return» abre «Recibir» si sigue en curso (también si el sello ya dice «Atrasada»). El parámetro se quita de la dirección al usarse, y no se vuelve a abrir al recargar.

### Menú «⋯»

El botón es el icono de tres puntos. El nombre para el lector de pantalla es «Más». Siempre está, en cualquier estado. Las entradas:

- «Editar». Solo con permiso de gestionar. Activo en reservada, en la calle y atrasada. Desactivado en devuelta y cancelada. Abre «Editar la renta». Al guardar, aviso «Renta guardada» y el nombre del cliente. Si otra persona ya cerró la renta, «La renta ya está cerrada (finalizada o cancelada): no se puede cambiar.»
- «Cancelar». Solo con permiso de gestionar. Activo si está reservada, o si está en curso o atrasada y el pagado es exactamente cero (los pagos anulados no cuentan). Desactivado si ya hay un pago vivo, o si está devuelta o cancelada. Abre «Cancelar la renta».
  - Reservada: «La reserva se cancela y el carro queda libre en esas fechas.»
  - En curso: «Una renta en curso solo se cancela si no tiene pagos. El carro vuelve a quedar libre.»
  - Campo «Por qué se cancela», obligatorio. Vacío: «Escribí por qué se cancela.» Más de 300 caracteres: «No puede pasar de 300 caracteres.»
  - Botón rojo «Cancelar renta». Aviso «Renta cancelada» y el nombre del cliente. El sello pasa a «Cancelada» y la tarjeta de datos muestra «Cancelada» con ese motivo.
  - Si en ese instante ya había un pago: «La renta ya tiene pagos: recibí el carro o anulá los pagos antes de cancelarla.»
- «Imprimir contrato». Siempre se ve. Activo si la renta ya tiene número, o si hay permiso de gestionar y no está cancelada. Desactivado mientras se está pidiendo el número, y también en una cancelada sin número o en cualquier renta sin número cuando falta el permiso de gestionar. Si no hay número, primero se asigna y después se abre la vista de impresión. Si ya hay número, se abre directo. Un fallo de esa asignación se escribe en rojo bajo el encabezado, con el mensaje del servidor.
- «Imprimir inspección». Siempre activo, también sin número y también cancelada. Abre la misma vista de impresión, solo con la hoja de inspección.

### Datos bajo la cuenta

Una tarjeta, sin título, con estos campos:

- «Sale» y «Regresa»: las horas planificadas, no las reales. Formato «vie 12 oct, 10:00 a. m.», hora de El Salvador.
- «Seguro»: «Sí» si el cliente aceptó la cobertura, «No» si la declinó, «—» si quedó sin definir.
- «Golpe»: el deducible, en pesos. Cero se ve «$0». Este número es el tope de los daños cuando el seguro es «Sí».
- «Conductor»: solo si hay conductor adicional. Muestra el nombre, no la licencia.
- «Cancelada»: solo si hay motivo de cancelación. El texto es el motivo escrito.
- «Notas»: solo si la renta tiene notas. Incluye, si se escribió al recibir, la línea «Garantía retenida: …».

Si la renta se extendió, más abajo hay un bloque «Días». Cada línea es la hora anterior, una flecha y la hora nueva, en el formato «vie 12 oct, 10:00 a. m.». Si la extensión llevó nota, se agrega « · » y la nota. Sin extensiones el bloque no aparece.

### Inspecciones en la ficha

Siempre está el bloque «Salida». El bloque «Regreso» no se muestra mientras sigue reservada. En curso, atrasada, devuelta o cancelada sí se muestra. Si esa inspección no existe, el bloque dice «Todavía no se hizo.»

Cuando existe, el título lleva a la derecha el kilometraje, por ejemplo «48000 km». Adentro:

- «Kilometraje»: «48000 km».
- «Combustible»: «Vacío» en 0, «Lleno» en 8, y en los demás «4/8», «6/8», etc. Aquí no se usan los cuartos «¼» «½» «¾»; esos son del medidor del asistente.
- «Accesorios que faltan»: «Ninguno», o la lista separada por comas.
- «Llantas» y «Batería»: solo si se anotaron. El asistente de esta ficha no pide llantas ni batería, así que lo normal es que no salgan. Si salen, las llantas se leen «Delanteras: … · Traseras: …».
- «Daños»: «Sin daños.» o una línea por zona. El nombre de la zona va en negrita y, si había texto, el texto en gris. En «Regreso» cada zona lleva un sello: «Nuevo» en rojo si no estaba al salir, «Ya venía» en gris si ya estaba.
- Las fotos, en miniaturas. Tocar una abre la foto completa en otra pestaña. El texto alterno es «Foto 1», «Foto 2», y así. La hoja impresa no lleva fotos.

Zonas, con el nombre que se ve: «Capó», «Techo», «Baúl», «Bumper delantero», «Bumper trasero», «Parabrisas», «Vidrio trasero», «Guardafango delantero izquierdo», «Puerta delantera izquierda», «Puerta trasera izquierda», «Guardafango trasero izquierdo», «Guardafango delantero derecho», «Puerta delantera derecha», «Puerta trasera derecha», «Guardafango trasero derecho», «Espejo izquierdo», «Espejo derecho», «Llantas y aros».

### Otras rentas del cliente

Al final, si hay otras, el título es «Otras rentas» y el número al lado. La tabla muestra como máximo tres, las de salida planificada más reciente primero. Columnas: referencia («#0733» o «Sin contrato»), «Carro» (placa y nombre), «Sale / regresa» («Sale …» y «Regresa …» con la hora real si ya pasó), «Saldo» (en rojo y negrita si debe y no está cancelada) y «Estado» con el mismo sello de la ficha. Tocar la fila abre esa otra ficha.

Si hay más de tres y se tiene permiso de ver clientes, a la derecha está «Ver todas», enlace a la ficha del cliente. Si el cliente tiene más de 100 rentas, el número de la pastilla cuenta todas, y el «Debe» de la pastilla suma solo las de la primera página.

Sin otras rentas la sección no aparece. No hay una frase de vacío en la ficha.

### Bloque «Cuenta»

Siempre está, con el título «Cuenta». Arriba, tres cifras:

- «Total»: lo que se cobra, nunca menor que cero.
- «Pagado»: suma de los pagos que no están anulados.
- «Debe»: total menos pagado. Si el cliente debe, el número va en rojo. Cero se ve «$0» y no va en rojo. Si se cobró de más, el saldo es negativo y se ve como «$-10»; tampoco va en rojo. En el asistente de recibo ese caso cambia de palabra y dice «Devolver».

Los montos enteros se escriben sin centavos («$35»). Los que tienen centavos, con dos («$35.50»). Un menos delante de un renglón es un descuento.

Fórmula del total, en centavos, redondeada a dos decimales:

`Total = máximo(0, (tarifa por día + seguro por día) × días + cargos extra + km extra + combustible + daños cobrados + multas al cliente − descuento)`

`Pagado = suma de pagos con anulación vacía`

`Debe = Total − Pagado`

El seguro por día es el CDW guardado en la renta. En la pantalla el alquiler y el seguro van en renglones distintos, aunque por dentro se suman juntos.

Renglones, en este orden. Un renglón en cero no se muestra, salvo el de los días, que siempre está:

1. Días. Etiqueta «2 días × $25» o «1 día × $25». Importe = tarifa × días.
2. «Seguro», solo si el CDW por día es mayor que cero. Importe = CDW × días.
3. «Multas», solo la suma de las multas marcadas para cobrarle al cliente. Una multa cargada como gasto del carro no entra.
4. Cargos extra, con la nota que se escribió («Silla de bebé») o, si no hay nota, «Cargos».
5. «Km extra», solo si el cargo es mayor que cero.
6. «Combustible», solo si el monto escrito al recibir es mayor que cero.
7. «Daños», si la suma de las líneas o el cargo es mayor que cero. Si la cobertura topó el cobro, a la derecha de «Daños» dice «Tope», el total de las líneas va tachado y al lado queda lo que sí se cobra.
8. «Descuento», con un menos, solo si el descuento es mayor que cero.

Ejemplo, con 2 días, tarifa $25, seguro $5 por día, silla $10, km extra $7.50, combustible $8, daños cotizados en $400 con cobertura aceptada y deducible $250 (se cobran $250), multa al cliente $20, descuento $15 y un pago de $100:

- «2 días × $25» → $50
- «Seguro» → $10
- «Multas» → $20
- «Silla de bebé» → $10
- «Km extra» → $7.50
- «Combustible» → $8
- «Daños» con «Tope», $400 tachado, $250
- «Descuento» → −$15
- Total = 50 + 10 + 20 + 10 + 7.50 + 8 + 250 − 15 = $340.50
- Pagado = $100
- Debe = $240.50, en rojo

El IVA no se desglosa en esta cuenta. El total de la pantalla es el de la fórmula. En el papel, si la renta incluye IVA y la tasa de ajustes es mayor que cero, ese mismo total se parte en base e impuesto; no se suma otra vez.

Si el descuento alcanza o pasa la suma de lo demás, el total queda en $0 y el debe puede salir negativo. El tope del descuento se controla al editar la renta, no en esta cuenta: «El descuento no puede pasar de $80.00.», con el tope real.

Bajo los renglones, si hay saldo y la renta no está cancelada y hay permiso de cobrar, está el botón «Cobrar» (estilo secundario). Abre «Registrar pago». En una reservada con saldo este botón sí está, aunque el encabezado muestre «Entregar» y no un «Cobrar» de contorno. En una cancelada no está, aunque el número del debe sea mayor que cero.

### Lista de pagos y «Anular»

Si no hay pagos, no hay lista ni frase de vacío. Si hay, van del más antiguo al más nuevo, cada uno como «$100 · Efectivo». Los métodos son «Efectivo», «Tarjeta», «Transferencia» y «Otro». La lista no muestra fecha, referencia ni nota.

Un pago anulado se ve tachado. Para el lector de pantalla se agrega «anulado». No tiene menú.

En un pago vivo, con permiso de cobrar, el mismo icono «⋯» («Más») abre «Anular». Sin permiso de cobrar el icono no está.

«Anular» abre «Anular pago». El texto es el monto, el método y quién lo recibió: «$100.00 · Efectivo · recibió Ana López. Deja de sumar al pagado, pero queda escrito.» Campo «Motivo», obligatorio. Menos de 3 letras: «Escribí por qué se anula (al menos 3 letras).» Más de 300: «No puede pasar de 300 caracteres.» Botones «Cancelar» y «Anular pago» (rojo). Al guardar, aviso «Pago anulado» y el monto con centavos, por ejemplo «$100.00». El pago sigue en la lista, tachado. «Pagado» baja y «Debe» sube en esa misma cantidad.

Errores de anular:

- «Ese pago ya estaba anulado.»
- «Ese pago no existe.»
- «Ese turno ya cerró: el pago no se puede anular.» El pago quedó en un turno de caja que ya se cerró. Un pago viejo que no pertenece a ningún turno sí se puede anular con el turno de hoy cerrado.

### Garantía en la ficha

Bajo el botón de cobrar, una línea en negrita. Una sola de estas:

- «Sin garantía», si el depósito es cero y no se devolvió ni se pasó a otra renta.
- «Garantía $100 en efectivo», «en tarjeta», «en transferencia» o «en otro», si sigue en custodia. Sin método, se omite el «en …»: «Garantía $100».
- «Devuelta $80», con lo que se devolvió, no con lo que se había dejado. Si se devolvieron $80 de $100, la línea no dice que quedaron $20 retenidos.
- «Garantía $100 en otra renta», si el depósito se pasó al carro nuevo en un cambio. Ya no se puede devolver desde esta ficha.

La devolución es una sola vez. Después de devolver, aunque sea $0, la garantía deja de estar en custodia y el botón «Devolver garantía» no vuelve.

El botón relleno «Devolver garantía» sale solo con la renta devuelta, sin saldo a favor de la empresa, garantía en custodia y permiso de cobrar. Si todavía debe, el botón relleno es «Cobrar» y la garantía espera. La excepción es el asistente «Recibir», que puede devolver la garantía completa en el mismo paso aunque el cliente siga debiendo la renta.

Diálogo «Devolver depósito». Subtítulo: «En custodia: $100.00. Se devuelve una sola vez.» Campo «Monto a devolver ($)», precargado con todo lo que hay en custodia. Si se escribe menos, en ámbar: «Se retienen $20.00.» La nota se llama «Nota (opcional)» cuando se devuelve todo, y «Por qué se retiene» cuando se retiene algo. Botones «Cancelar» y «Devolver depósito». Aviso: «Depósito devuelto» y el monto, «$80.00».

Mensajes del monto y de la nota:

- «Escribí un monto válido, con hasta dos decimales.»
- «El monto no puede pasar de $99999.99.»
- «Si se retiene una parte del depósito, escribí por qué.» En el campo de la nota, además: «Escribí por qué se retiene una parte.»
- «No se puede devolver más que el depósito ($100.00).»
- «Esta renta no tiene depósito en custodia: ya se devolvió o no hubo.»
- «La nota no puede pasar de 500 caracteres.»

Devolver $0 es un monto válido. Retiene todo, exige la nota, y la línea de la ficha queda «Devuelta $0». No hay una segunda devolución.

Este diálogo no pide forma de pago. El método con el que se devuelve no se guarda como método; la línea de la ficha no lo muestra.

### Asistente «Entregar» y «Recibir»

Lo abren los botones rellenos «Entregar» y «Recibir», o los de «Hoy». El título del diálogo es «Entregar» o «Recibir». En el teléfono, y en densidad de bahía en cualquier ancho, ocupa la pantalla. En escritorio, «Recibir» es más ancho porque la cuenta va a la derecha.

Cerrar con la X (el nombre es «Cerrar») o tocar afuera no entrega ni recibe. Lo escrito queda en la sesión del navegador, por renta y por modo. Al volver a abrir, se recupera. Al completar con éxito, ese borrador se borra. En una ventana privada el navegador puede negarse a guardar; no sale un aviso, y el asistente sigue en blanco la próxima vez.

Tres pestañas, en píldoras: «Kilometraje», «Golpes» y «Cobro». La de cobro muestra a la derecha el debe actual, por ejemplo «$240.50». Las otras muestran un resumen cuando ya hay datos: «48,000 · ½» en kilometraje (el número con coma de millar), y en golpes «Sin golpes», «1 golpe», «2 golpes», y si falta un accesorio « · 1 falta» o « · 2 faltan». Una pestaña ya visitada y válida lleva un check verde. Una con error lleva una X y borde rojo. «Cobro» no recibe check. «Seguir» no deja avanzar si el paso actual falla: se queda ahí y muestra el error. «Atrás» vuelve sin esa traba. En el último paso el botón es «Entregar» o «Recibir», y mientras guarda queda en carga.

La hora de los dos asistentes arranca en «ahora», redondeada al cuarto de hora siguiente. Ejemplo: 10:07 se propone como 10:15. La zona es El Salvador, UTC−6, aunque la tablet esté en otra zona.

#### Paso «Kilometraje»

- «Fecha» y, al lado, «Hora». Elegir solo la fecha deja la hora en 09:00. Elegir solo la hora espera a que haya fecha. Vacío o incompleto, al seguir: «Elegí la hora.»
- «Km». Solo dígitos; una letra o un punto se borran al escribir. En «Entregar» viene precargado con el kilometraje del carro, si es mayor que cero. En «Recibir» viene vacío. Vacío: «Escribí el kilometraje del tablero.» En el recibo, si es menor que el de la salida: «El kilometraje no puede ser menor que el de salida (48000 km).» El número es el de la salida. Más de 2 000 000: «Ese kilometraje no es real.» El servidor, si lo alcanza, dice «El kilometraje de regreso no puede ser menor que el de salida (48000 km).»
- Medidor «Combustible». Semicírculo de E (vacío) a F (lleno), con marcas E, ¼, ½, ¾ y F. Esos cinco puntos son 0, 2, 4, 6 y 8 octavos. Se toca, se arrastra, o con el foco se usan flechas (saltan un cuarto), Inicio (vacío) y Fin (lleno). El número grande de abajo dice «—» hasta que se marca, y después «Vacío», «¼», «½», «¾» o «Lleno». Sin marcar, el borde pasa a rojo y el error es «Marcá cuánto combustible tiene.» En «Recibir», una aguja punteada y la palabra «Salió» marcan el nivel de la entrega. En «Entregar» esa aguja no está. El medidor no calcula dinero: solo anota el nivel.
- En «Recibir», al lado del medidor, «Combustible ($)», con placeholder «0.00». Es el monto que se cobra por la diferencia de tanque, escrito a mano. Vacío vale cero y no agrega renglón. Un texto que no es un monto: «Escribí un monto válido, con hasta dos decimales.» Por encima de $99999.99: «El monto no puede pasar de $99999.99.»
- «Nota», opcional. Más de 1000 caracteres: «La nota no puede pasar de 1000 caracteres.»

En «Entregar», la hora elegida tiene que ser anterior al regreso planificado. Si es igual o posterior, el servidor rechaza todo con «El regreso tiene que ser después de la salida.» En «Recibir», la hora tiene que ser posterior a la salida real (o a la planificada, si no hubiera salida real). Si no: el mismo mensaje.

#### Paso «Golpes»

En «Entregar» se marcan las zonas que ya trae el carro. Tocar una zona la pinta (naranja en el diagrama plano) y volver a tocarla la quita. No se escribe un monto: al entregar, el daño se anota y no se cobra.

En «Recibir» el visor distingue tres cosas:

- Lo que ya venía al salir: no se puede tocar. En la lista de abajo, un cuadrito ámbar, el nombre de la zona, y para el lector «ya venía». En el diagrama plano va punteado.
- Lo nuevo: tocar una zona sana agrega una línea de cobro con el nombre de la zona y el monto vacío, y la pinta en rojo. Tocarla otra vez quita la línea y la marca.
- El botón «Daño» agrega una línea libre, sin zona, para una pieza que no está en el dibujo.

El visor 3D, si el equipo lo puede dibujar, dice «Golpes · toque la pieza dañada» y tiene las vistas «Frontal», «Izquierda», «Derecha», «Trasera» y «Superior». Mientras carga: «Cargando…». Apuntar una línea ilumina esa pieza, y apuntar la pieza ilumina la línea (borde rojo). Si el visor 3D no arranca, queda el dibujo plano. El dibujo se anuncia como «Zonas del carro, vistas desde arriba. El frente está arriba.» El frente del dibujo es la parte de arriba.

Cada línea de daño tiene «Pieza» (en una zona, precargada con el nombre), «$0.00» y una X para quitarla. El nombre de la X es «Quitar» más la pieza, o «Quitar el daño 1» si la pieza está vacía. Una línea libre sin pieza y sin monto se descarta. Una con monto y sin pieza no pasa: «Escriba la pieza dañada.» Más de 120 caracteres en la pieza: «No puede pasar de 120 caracteres.» Un monto vacío se cobra como cero (el daño queda anotado). Más de 30 líneas: «No más de 30 daños.»

Si la suma de los montos es mayor que cero, bajo la lista:

- Con seguro «Sí»: «Paga hasta $250 · Cobra $200». El primero es el deducible («Golpe»). El segundo es lo que entra a la cuenta.
- Con seguro «No» o «—»: solo «Cobra $270», la suma entera, sin tope.

Fórmula del cargo por daños: con cobertura aceptada, el menor entre la suma de las líneas y el deducible; si el deducible es cero, se cobra cero aunque las líneas sumen. Con cobertura declinada o sin definir, se cobra la suma entera. Ejemplo: líneas de $180 y $90, suma $270. Deducible $200 y seguro «Sí» → se cobran $200, y en la cuenta «Daños» muestra $270 tachado, la palabra «Tope» y $200. El mismo caso con seguro «No» cobra $270 y no tacha nada.

Debajo, «Accesorios · toque lo que falta», solo si en ajustes hay accesorios. Cada uno es una pastilla. Al empezar están todos presentes (check verde). En un recibo, si la salida ya tenía accesorios anotados, se arranca con esos, incluidos los que ya faltaban. Tocar uno lo marca como faltante: X, texto tachado y borde rojo. El nombre para el lector es «Gato: está» o «Gato: falta». El resumen de la pestaña cuenta los faltantes. No se cobra un monto por el accesorio en este paso; queda anotado en «Accesorios que faltan» de la ficha y en la hoja impresa.

«Fotos». Abre la cámara o la galería (varias a la vez). Máximo 24 por inspección. Al llegar a 24 el botón se desactiva. Cada foto se reduce si el lado mayor pasa de 1600 píxeles y después se sube. Bajo el botón, las miniaturas; la X de cada una se llama «Quitar la foto 1». Errores, en rojo:

- «No se pudo subir una foto.» si el fallo no trae mensaje.
- «Elegí un archivo.»
- «Solo se aceptan imágenes JPG, PNG o WebP.»
- «El archivo pasa de 5 MB. Reducilo y probá de nuevo.»
- «No tenés permiso para hacer esto.» Subir pide permiso de gestionar rentas o de editar los ajustes de la renta. Quien entrega ya tiene el primero.
- Si el cuerpo trajera más de 24: «No más de 24 fotos.» La pantalla no deja elegir de más.
- «Esa foto no es válida.» si el identificador no sirve.

#### Paso «Cobro»

En «Recibir», la cuenta de la derecha (en escritorio ancho) y, en teléfono o en bahía, la misma cuenta dentro del paso, titula «Cuenta» y lista los renglones con la hora, los km, el combustible y los daños que se están escribiendo. Después una raya, «Total», «Pagado» en verde con un menos (es lo ya cobrado antes, no lo que se está tecleando) y al pie «Debe» o «Devolver». «Devolver» sale cuando el saldo de esa vista previa es negativo, en verde y sin el signo. Ejemplo: total $50, pagado $80 → «Pagado −$80» y «Devolver $30».

Lo que se escribe en «Monto» no baja ese «Debe» hasta que el recibo se guarda. La vista previa es el resultado de recibir, todavía sin este pago.

En «Entregar» no hay esa cuenta lateral. Hay una línea grande «Debe $50» con el saldo guardado de la reserva. Cambiar la hora de entrega no actualiza esa cifra, aunque el servidor, al guardar, sí vuelva a contar los días. El detalle está en la sección de días.

En «Entregar», dos campos más:

- «Garantía». Viene con el depósito de la renta, o vacío si era cero. Vacío se guarda como cero y reemplaza el depósito anterior. Formato de monto, con los mismos dos mensajes de dinero.
- «Método», con «Sin método», «Efectivo», «Tarjeta», «Transferencia» y «Otro». Arranca en el método que ya tenía la renta, o en «Sin método».

Cobro, en los dos modos, solo si hay permiso de cobrar y el debe de la pantalla es mayor que cero:

- «Monto», precargado con ese debe. Mientras nadie lo edite, sigue al debe (en el recibo, el debe cambia al mover la hora, el combustible o los daños). Si se borra o se deja en cero, no se registra pago: la entrega o el recibo sí se guardan y el saldo queda pendiente.
- «Método», precargado en «Efectivo». Las cuatro formas, sin «Sin método».

No hay campo de referencia ni de nota en el asistente. Esos existen en «Registrar pago», más abajo.

En «Recibir», si hay garantía en custodia y permiso de cobrar, un interruptor «Devolver garantía $100», encendido de entrada. Encendido: al guardar se devuelve todo, de una vez, sin monto parcial y sin nota. Apagado: aparece «Nota». Si la nota tiene texto, se agrega a las notas de la renta como una línea «Garantía retenida: rayón del bumper». La garantía sigue en custodia, y más adelante, cuando el saldo llegue a cero, el botón «Devolver garantía» la puede devolver. La nota vacía no exige nada: se puede retener sin escribir por qué. No hay, en este asistente, una devolución parcial. La parcial es el diálogo «Devolver depósito» de la ficha ya devuelta.

El asistente no muestra un campo para cambiar el número de días ni un interruptor para perdonar los km extra. Los días salen de la fórmula, y los km extra se cobran siempre que la fórmula dé más de cero.

#### Qué pasa al confirmar

Primero se guarda la entrega o el recibo, sin el pago. Si eso falla, nada cambió de estado y el error queda en el diálogo. Mensajes posibles, además de los del formulario:

- «El regreso tiene que ser después de la salida.»
- «El kilometraje de regreso no puede ser menor que el de salida (48000 km).»
- «Eso solo se puede con una renta reservada: el carro ya salió.» al intentar entregar algo que ya no está reservado.
- «Eso solo se puede con una renta en curso: el carro todavía no salió.» al intentar recibir algo que no está en la calle.
- «La renta ya está cerrada (finalizada o cancelada): no se puede cambiar.»
- «Ese carro está en el taller: no se renta.» y «Ese carro está retirado: no se renta.» al entregar.
- «Ese carro no existe.» y «Esa renta no existe.»
- «El carro ya está rentado a María López en esas fechas (con 1 h de margen).» o «reservado», con el nombre y las horas de margen de ajustes.
- «Revisá los datos.» si el servidor no manda un texto más claro.
- «No se pudo guardar.» si el fallo no es un error conocido del sistema.

Al entregar, el sistema asigna el número de contrato antes de cambiar el estado. El número es el mayor que ya exista más uno, y nunca menor que el número inicial de ajustes (de fábrica, 733, que en el papel se ve «0733»). Si la entrega falla después, la reserva puede quedarse ya con número. Una segunda entrega no pide otro número.

Si la entrega o el recibo se guardaron y después el pago falla, el carro ya cambió de estado, el botón «Entregar» o «Recibir» queda desactivado y el diálogo sigue abierto con el error. Hay que cerrarlo y cobrar desde la ficha. Lo mismo si falla la devolución de la garantía: el recibo ya quedó hecho. Mensajes de ese tramo:

- Monto mal escrito: «Escribí un monto válido, con hasta dos decimales.», «El monto tiene que ser mayor que cero.» o «El monto no puede pasar de $99999.99.» Si no hay texto, «Revisá el cobro.»
- Caja cerrada: «Abra la caja para cobrar.» y un enlace «Caja» hacia la caja de renta. El recibo o la entrega ya están guardados; el pago, no. La garantía tampoco se devuelve en ese intento. En otros cobros el servidor dice «Abrí la caja para cobrar.»; el asistente lo cambia por la frase «Abra…».
- «El pago pasa del saldo de la renta ($25.00).» El monto entre paréntesis es el saldo de después de guardar, que puede no ser el que el asistente mostraba. Ver el ejemplo de la entrega temprana o tardía.
- «Esta renta no tiene saldo pendiente.»
- «La renta está cancelada: no recibe pagos.»
- «No se pudo cobrar.»
- Al devolver la garantía desde el asistente, los mismos topes del diálogo de depósito. El asistente pide devolver el total en custodia, así que el caso normal no retiene.

No hay un aviso de éxito tipo «listo». El diálogo se cierra y la ficha muestra el estado nuevo.

### Días a cobrar y horas de gracia

Las horas de gracia están en ajustes, «Cobros y reglas», campo «Horas de gracia». De fábrica son 1. El rango permitido es de 0 a 24. Si la ficha no logra leer los ajustes, el asistente calcula con 1 hora; el servidor usa las horas guardadas. Si esas dos cifras no coinciden, la cuenta del asistente y la cuenta guardada pueden diferir.

Fórmula, con la hora de salida y la de regreso en la zona de El Salvador:

`días = máximo(1, redondeo hacia arriba de (regreso − salida − horas de gracia) ÷ 24 horas)`

Siempre se cobra al menos un día. Devolver el mismo día, o devolver antes de la hora, no baja de 1.

Ejemplos con 1 hora de gracia y salida el lunes 5 de octubre de 2026 a las 09:00:

- Regreso el miércoles 7 a las 09:00. Pasaron 48 horas; se restan 1; quedan 47. 47 ÷ 24 = 1.96, que sube a 2 días.
- Regreso el miércoles 7 a las 09:40. Las 40 minutos caben en la hora de gracia: siguen siendo 2 días. No se cobra un día extra.
- Regreso el miércoles 7 a las 10:01. Ya se pasó la gracia por un minuto: 3 días.
- Regreso el lunes 5 a las 15:00, el mismo día. Se cobra 1 día, el mínimo.
- Gracia en 0: el miércoles 7 a las 09:00 exacto sigue en 2 días (48 ÷ 24 = 2). Un minuto más, 09:01, sube a 3.

Al entregar, el servidor vuelve a contar desde la hora real de salida hasta el regreso planificado, no hasta una hora que se escriba en el asistente. El asistente, en cambio, sigue mostrando el saldo de la reserva.

Ejemplo. Reserva de lunes 09:00 a miércoles 09:00, 2 días × $25 = $50, sin pagos. El asistente dice «Debe $50» y precarga el monto en 50.

- Se entrega el martes 09:00 y se cobra $50. El servidor cuenta martes → miércoles = 1 día = $25. El pago de $50 pasa ese saldo: «El pago pasa del saldo de la renta ($25.00).» El carro ya está en la calle, con debe $25, y el pago no entró. Se cierra el diálogo y se usa «Cobrar».
- Se entrega el domingo 09:00 y se cobra $50. El servidor cuenta domingo → miércoles = 3 días = $75. El pago de $50 sí entra, como abono. Queda un debe de $25 y el botón «Cobrar».
- Se borra el monto. La entrega se guarda y no hay pago. El debe es el de los días nuevos.

Al recibir, la cuenta de la derecha sí usa la hora escrita: desde la salida real hasta esa hora, con la gracia. Mover la hora cambia los días, el tope de km y el debe, y el monto sugerido los sigue mientras no se haya editado «Monto».

### Kilómetros extra

Al recibir:

`recorridos = máximo(0, km de regreso − km de salida)`

`permitidos = km libres por día × días a cobrar`

Si el carro tiene km libres vacíos o en cero, el permitido es ilimitado, el extra es cero y no hay renglón. Si el precio por km extra está vacío, el cargo es cero aunque haya km de más, y tampoco hay renglón.

`extra = máximo(0, recorridos − permitidos)`

`cargo = extra × precio por km`

Ejemplo. 200 km libres por día, 2 días, permitidos 400. Salida 10 000, regreso 10 550, recorridos 550, extra 150. Precio $0.20 → «Km extra» $30. Si el regreso fuera 10 300, extra 0 y el renglón no aparece. El asistente no muestra los 550 ni los 400; solo el dinero, dentro de «Cuenta», cuando es mayor que cero.

En el papel, «Km libres por día» dice el número o «Ilimitado». «Km adicional» solo sale cuando hay un límite, y un precio cero se imprime «—».

### Cobrar desde la ficha («Registrar pago»)

Lo abren el «Cobrar» del encabezado, el «Cobrar» de la cuenta y, en una devuelta con saldo, el botón relleno. Antes de mostrar el formulario lee la caja:

- «Cargando…» con el título «Registrar pago».
- Si la lectura de la caja falla, el texto rojo es el mensaje del servidor, y el botón «Cancelar».
- Si no hay turno abierto, el título es «Sin caja abierta», un botón «Caja» que lleva a la caja de renta, y «Cancelar». No deja escribir el pago.
- Con turno abierto, título «Registrar pago» y subtítulo «Saldo pendiente: $240.50».

Campos:

- «Monto ($)», precargado con el saldo y nunca con un número negativo. Placeholder «0.00». Obligatorio y mayor que cero: «El monto tiene que ser mayor que cero.» Formato: «Escribí un monto válido, con hasta dos decimales.» Tope: «El monto no puede pasar de $99999.99.»
- «Forma de pago»: «Efectivo», «Tarjeta», «Transferencia», «Otro». Arranca en «Efectivo». Si faltara: «Elegí el método de pago.»
- «Referencia (transferencia, voucher)», opcional, máximo 60 caracteres: «La referencia no puede pasar de 60 caracteres.»
- «Nota (opcional)», máximo 500: «La nota no puede pasar de 500 caracteres.»

Botones «Cancelar» y «Registrar pago». Se puede cobrar una parte: saldo $240.50, monto $100, tarjeta. Aviso «Pago registrado» y «$100.00 · Tarjeta». El debe baja a $140.50. Si se cobra el total, el debe queda en $0 y, si había garantía en custodia, el botón relleno pasa a «Devolver garantía».

Un monto mayor que el saldo no se guarda. El campo muestra «El pago pasa del saldo de la renta ($240.50).» Con saldo ya en cero: «Esta renta no tiene saldo pendiente.» Si la caja se cierra entre abrir el diálogo y confirmar: «Abrí la caja para cobrar.» Una renta cancelada: «La renta está cancelada: no recibe pagos.»

El pago entra al turno de caja que está abierto. Por eso, cuando ese turno se cierre, «Anular» responderá «Ese turno ya cerró: el pago no se puede anular.»

### Contrato y hoja de inspección impresos

«Imprimir contrato» abre la vista de impresión. Mientras arma, «Armando el contrato». Si falla: el mensaje del servidor, o «No se pudo cargar la renta.» Sin permiso de ver rentas: «No tenés permiso para ver el contrato.» y la misma frase de pedir el permiso. Quien entra directo a la dirección, con permiso de gestionar y con una renta sin número que no esté cancelada, recibe el número en ese momento. Sin ese permiso el número queda en blanco para escribirlo a mano.

La barra, que no sale en el papel:

- «Volver», de regreso a la ficha.
- El título: «Contrato N° 0733», o «Contrato sin número», o «Inspección» si se entró por «Imprimir inspección».
- Debajo: «Tamaño carta · 6 hojas». Ese número cuenta caras, no hojas físicas cuando se imprime a doble cara.
- «Opciones».
- «Imprimir», desactivado hasta que la renta y los ajustes hayan cargado. Abre el diálogo de impresión del navegador. La hoja es carta, sin margen de navegador (la página no imprime la dirección ni el número de página). En pantalla el papel se ve en tema claro.

«Opciones», grupo «Juegos»:

- «Original y copia del cliente», de fábrica.
- «Solo el original».

Casillas:

- «Incluir hoja de inspección», de fábrica marcada.
- «Doble cara», de fábrica sin marcar.

Al pie del menú: «Tamaño carta · 6 hojas de papel». Aquí sí se cuentan hojas físicas: a doble cara, dos caras por hoja. Elegir una opción no cierra el menú. El navegador recuerda la elección en ese equipo.

Juego de fábrica, una cara, con inspección: para el original, anverso, reverso e inspección; después lo mismo para la copia. Seis caras y seis hojas. El anverso del original se marca «ORIGINAL · Arrendante». La copia, «COPIA · Arrendatario». A doble cara, el reverso cae al dorso del anverso. Si un juego queda con un número impar de caras y todavía viene otro juego, se inserta una cara en blanco para que el siguiente empiece en hoja nueva. Con original y copia, doble cara e inspección, son 7 caras (la blanca incluida) y 4 hojas de papel; la barra de arriba sigue diciendo «7 hojas» porque cuenta caras.

«Imprimir inspección» ignora «Doble cara» y «Incluir hoja de inspección». Solo obedece el juego: una hoja de inspección, o dos si están el original y la copia.

Cada hoja lleva el logo si hay, el nombre de la empresa, «NIT: …» y «NRC: …» si existen, la dirección, «Tel. …» y el correo, el sello de original o copia, el título («Contrato de arrendamiento» o «Hoja de inspección») y «N° 0733». Sin número, «N° ______».

Anverso del contrato, sección «Arrendatario»: «Nombre o razón social», «Representante legal», «DUI / Pasaporte», «País», «Licencia N°», «Vence», «Fecha de nacimiento», «Dirección local», «Tels.», «Dirección permanente», «Tels.», «Correo electrónico», «Lugar de trabajo», «Profesión u oficio». Lo que la ficha de la renta no trae (dirección, correo, trabajo) sale de la ficha del cliente, si se tiene permiso de ver clientes. Sin ese permiso esos campos quedan en blanco para escribir a mano. Los teléfonos del cliente juntan celular y teléfono con « / ».

Sección «Vehículo»: «Marca, modelo y año», «Placa», «Color», «Sale», «Hora», «Lugar de salida», «Regresa», «Hora», «Lugar de devolución», «Km al salir», «Tanque». La salida impresa es la real si ya se entregó; si no, la planificada. El regreso impreso es el planificado, no el real. «Km al salir» es el de la inspección de salida, o el del carro si todavía no hay inspección. «Tanque» usa «Vacío», «Lleno» o «4/8»; vacío si no hay inspección. Las fechas del papel son dd/mm/aaaa y la hora «9:00 a. m.» o «9:00 p. m.»

Sección «Garantía»: «Depósito», «Forma» («Efectivo», «Tarjeta», «Transferencia», «Otro»), «Tarjeta N°» (solo los cuatro dígitos, si se guardaron), «Autorización», «Fecha», «Monto». Un monto cero o vacío se imprime «—».

Sección «Conductor adicional»: «Nombre», «Licencia N°», «Vence», «Fecha de nacimiento», «País», y «Observaciones». Las observaciones juntan las notas de la renta y, por cada extensión, una frase «Prórroga acordada el dd/mm/aaaa: nuevo regreso dd/mm/aaaa h:mm a. m.»

Tabla izquierda de la cuenta del papel: «Tarifa diaria», «Días», «CDW por día», «Deducible», «Km libres por día» («Ilimitado» o el número), «Km adicional» solo si hay límite, «Pagado», «Pendiente» en negrita. Cero en CDW, deducible o km adicional se ve «—». «Pendiente» nunca es negativo: si se cobró de más, imprime $0.00. Los montos del papel llevan siempre dos decimales.

Tabla derecha: «Renta (2 días × $25.00)», «CDW (2 × $5.00)», un renglón único de lo demás, «Descuento» con menos solo si hay, y «Total». El renglón de lo demás se titula con la nota de cargos extra («Silla de bebé») o, si no hay nota, «Combustible, daños y otros cargos». Su importe es lo que falta para cerrar el total: cargos extra + km extra + combustible + daños cobrados + multas al cliente. No se desglosan. Por eso una silla de $10 y un combustible de $8 pueden verse juntos bajo el nombre de la silla. Si la renta incluye IVA y la tasa es mayor que cero, antes del total aparecen «Sub-total» e «IVA 13%» (el porcentaje es el de ajustes). Con la tasa de fábrica en cero, esas dos filas no salen. El IVA parte el total; no lo aumenta.

Recuadro de cobertura, texto fijo: «Cobertura de seguros por vuelco y colisión, por día o por fracción, con un deducible de $250.00. Esta cobertura es válida bajo las condiciones descritas en la cláusula 10 y no es válida bajo las condiciones descritas en la cláusula 6. El deducible por pérdida total o robo es del 25% sobre el valor del vehículo.» Si el deducible es cero, en vez del monto hay «$ ________». A la derecha, dos casillas: «Acepta · Firma ____________» marcada con X si el seguro de la ficha es «Sí», y «Declina · Firma ____________» marcada si es «No». Sin definir, ninguna lleva X.

Pagaré, texto fijo, con el nombre del arrendante y la ciudad de ajustes, y la fecha de salida ya puesta en el lugar y el día: «He leído los términos y condiciones en el anverso y reverso de este contrato y estoy de acuerdo en todas sus partes. Por este pagaré sin protesto me (nos) obligo (amos) incondicionalmente a pagar a … del domicilio de … el día … de … de … la cantidad de … más interés anual de …% sobre el vencimiento. Pagaremos además intereses moratorios de …% anual sobre el principal adeudado a partir de la fecha del vencimiento.» La cantidad queda en blanco para escribirla. Los dos porcentajes salen de ajustes; vacíos, la línea queda en blanco. Firmas: «Arrendatario» con el nombre del cliente y «Arrendante» con el nombre de ajustes.

Reverso, título «Términos y condiciones». El párrafo de introducción es el de ajustes, con el texto «{ARRENDANTE}» reemplazado por el nombre del arrendante. Después, las cláusulas numeradas, tal como estén guardadas en ajustes. Al pie: «Contrato N° 0733 · ORIGINAL · Arrendante» (o la copia, o «______» sin número).

Hoja de inspección, título «Hoja de inspección». Campos: «Placa», «Vehículo», «Cliente», «Salida: fecha», «Hora», «Entrada: fecha», «Hora». La entrada queda vacía si el carro no se ha recibido; no se imprime el regreso planificado en ese lugar.

«Golpes y rayones»: el dibujo plano con un número sobre cada zona dañada, y la leyenda. Sin recibo: «Marcado: daño anotado al salir.» Con recibo: «Punteado: ya estaba al salir. Lleno y con «Nuevo»: daño nuevo al regresar.» Tabla «#», «Parte», «Al salir», «Al regresar». Al salir, la descripción, o «Sí» si no había texto. Al regresar: vacío si no se marcó; «Igual» si ya venía y la descripción no cambió; la descripción nueva si ya venía y el texto cambió; «Nuevo» si es zona nueva sin texto; «Nuevo: rayón» si es zona nueva con texto, en negrita. Si hay menos de dos zonas, se completan filas en blanco hasta dos.

«Combustible y kilometraje»: una escala «Salida» y otra «Entrada», de E a F pasando por 1/8, 2/8, … 7/8. El nivel anotado va recuadrado. «Km inicial» y «Km final», vacíos si esa inspección no existe.

«Marca de llantas y batería»: columnas «Salida» y «Entrada», filas «Delanteras», «Traseras», «Batería». El asistente de la ficha no las llena.

«Revisión de accesorios»: columnas «Salida» (Sí / No) y «Entrada» (Sí / No). Una X en Sí o en No. Si esa inspección no anotó el accesorio, las dos casillas quedan en blanco.

«Daños al vehículo a cobrar»: columnas «Pieza dañada» y «Monto». Filas, solo si el monto es mayor que cero: «Combustible», «Daños» (el cargo ya topado, no la suma tachada) y la nota de cargos extra o «Otros cargos». Siempre hay al menos tres filas; las que faltan van en blanco. Los km extra y las multas no tienen fila propia aquí: van dentro del renglón agrupado del anverso.

«Observaciones al salir» y «Observaciones al regresar». Firmas, dos pares de «Firma del cliente» y «Firma del empleado», rotulados «Salida» y «Entrada».

---

## Acciones de la renta: extender, multa, cambiar carro, editar, cancelar y cobrar

Esta sección cubre lo que se le hace a una renta que ya existe, fuera de entregarla y de recibirla. La ficha se abre con permiso de ver la renta (`rentals.read`): menú **Renta**, **Hoy** o **Rentas**, y de ahí la fila del contrato. Sin ese permiso la pantalla dice «No tenés permiso para ver la renta.» y, debajo, «Si debería ser tuyo, pedile el permiso a quien administra. El riel a la izquierda (o abajo) te saca de acá.» Mientras carga dice «Cargando la renta». Si falla, «No se pudo cargar la renta.» o el mensaje que devolvió el servidor.

El título de la ficha es la placa (si tiene) y el carro como marca, modelo y año. Debajo, el nombre del cliente (un enlace a su ficha solo con permiso de ver clientes de renta, `renters.read`) y la frase «sale … → vuelve …». A la derecha está el sello del estado. Los botones de esta sección viven en esa misma cabecera. El menú **Más** (el botón con tres puntos, nombre accesible «Más») guarda «Editar», «Cancelar», «Imprimir contrato» e «Imprimir inspección».

### Estados que deciden qué se puede hacer

El sistema guarda cuatro estados. El quinto, atrasada, no se guarda: se calcula.

| Sello         | Color                                 | Cuándo                                                                                                                           |
| ------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| «Reservada»   | azul informativo, icono de calendario | Todavía no sale el carro.                                                                                                        |
| «En la calle» | naranja, icono de llave, sin latido   | Salió y el regreso planificado aún no pasó.                                                                                      |
| «Atrasada»    | rojo, icono de reloj despertador      | Sigue en curso y la hora de regreso planificada ya pasó. Un segundo después de esa hora ya es atrasada, aunque sea el mismo día. |
| «Devuelta»    | verde, icono de verificación          | Ya se recibió el carro.                                                                                                          |
| «Cancelada»   | gris, icono de prohibido              | Se canceló.                                                                                                                      |

En la lista **Rentas** (pestaña «En la calle», que es el filtro de entrada) no sale el sello: la columna «Cuándo» pone en rojo y en negrita «Atrasado · 2 días» o «Atrasado · 3 horas», y abajo «Debía regresar: Ayer, 18:30» (o «Hoy, 9:00», «Mañana, 9:00», «sáb 3 oct, 9:00»). Menos de un día se cuenta en horas, nunca menos de una hora. El número del tab «Rentas» es cuántas van atrasadas en este instante. No hay un filtro aparte para ellas: entran en «En la calle».

Una renta cerrada (devuelta o cancelada) no se extiende, no cambia de carro, no se edita y no se cancela. El servidor responde «La renta ya está cerrada (finalizada o cancelada): no se puede cambiar.» Extender y cambiar de carro, si la renta solo está reservada, responden «Eso solo se puede con una renta en curso: el carro todavía no salió.»

Los días a cobrar, en extender y en cambiar de carro, usan la misma cuenta. Se toma la salida real (si todavía no salió, la planificada) y el regreso, se restan las horas de gracia y se redondea hacia arriba a días enteros, con mínimo 1. La gracia sale de Ajustes; si no se pudieron cargar, el diálogo usa 1 hora. Devolver 40 minutos después de cumplir el día, con 1 hora de gracia, no suma otro día. Pasarse de esa hora, sí.

La cuenta de la ficha, sección «Cuenta», muestra «Total», «Pagado» y «Debe». «Debe» va en rojo si es mayor que cero. Los renglones son los días («5 días × $35»), «Seguro» si el CDW por día es mayor que cero, «Multas» si hay multas cargadas al cliente, los cargos extra (con su detalle, o «Cargos» si no hay detalle), «Km extra», «Combustible», «Daños» y «Descuento» (este último con signo menos). Cada uno aparece solo si suma. La fórmula del total es: se multiplica (tarifa por día + CDW por día) por los días, se suman cargos extra, km extra, combustible, daños y multas cargadas al cliente, se resta el descuento y el resultado no baja de cero. El saldo es ese total menos los pagos que no están anulados. Puede quedar negativo si se cobró de más: en pantalla es un saldo a favor, no una deuda.

### Qué botón se ve, y con qué permiso

«Extender» y «Cambiar carro» piden permiso de manejar rentas (`rentals.manage`) y solo aparecen si el sello es «En la calle» o «Atrasada». «Multa» pide permiso de cobrar (`rentals.charge`) y aparece en curso, atrasada o devuelta; no en una reserva ni en una cancelada. «Cobrar», el de la cabecera, pide el mismo permiso de cobrar, solo en curso o atrasada, y solo si «Debe» es mayor que cero. En la sección «Cuenta» hay otro «Cobrar» con las mismas reglas de permiso y de saldo, y además se esconde si la renta está cancelada: ahí sí puede verse en una reserva que ya deba, y en una devuelta que deba.

El botón grande de la cabecera, el primario, no es ninguno de esos mientras el carro está afuera: es «Recibir» (con permiso de manejar). En una reserva es «Entregar». Esos dos son otra sección. Cuando la renta ya está devuelta, el primario pasa a ser «Cobrar» si todavía debe, o «Devolver garantía» si no debe y queda depósito en custodia. Sin nada de eso, no hay botón primario.

En **Más**, «Editar» y «Cancelar» se ven con permiso de manejar. «Editar» está apagado si no es reserva ni renta en curso (una atrasada sí se edita, porque sigue en curso). «Cancelar» está apagado salvo en una reserva, o en una en curso cuyo pagado sea cero. Apagados no abren el diálogo.

## Extender

Se abre con «Extender» en la cabecera. El título del diálogo es «Extender». Debajo, el carro (marca, modelo y placa) y el nombre del cliente. «Volver» cierra sin guardar. El botón de confirmar dice «Extender» hasta que la fecha ya se guardó; si después falla el cobro, pasa a decir «Cobrar».

Arriba hay cuatro atajos: «+1 día», «+2 días», «+3 días» y «+7 días». Cada uno suma esos días de calendario a la hora de regreso que ya tenía la renta, a la misma hora. El de un día viene elegido. El campo «Regresaba» muestra la fecha vieja, solo para leer (formato «vie 15 oct, 10:00 a. m.»). «Regresa» es la fecha nueva, obligatoria.

La tarifa no cambia de tramo. Aunque la renta pase de 7 o de 30 días, no se aplica sola la tarifa semanal ni la mensual del carro. El campo «Tarifa por día ($)» viene lleno con la tarifa pactada y se puede reescribir. Si se reescribe, la tarifa nueva vale para todos los días de la renta, no solo para los agregados. «Nota» es opcional.

Con permiso de cobrar aparece el interruptor «Cobrar ahora», encendido. Sin ese permiso el interruptor no está y la extensión solo mueve la fecha y el saldo. Encendido, se ven «Monto ($)» y «Método». El método arranca en «Efectivo» y ofrece «Efectivo», «Tarjeta», «Transferencia» y «Otro». No pide referencia ni nota del pago. El monto, mientras usted no lo escriba, sigue a lo que la extensión agrega, sin pasar del saldo que va a quedar. Si ya se había cobrado de más, sugiere solo lo que todavía falta, no todo lo agregado.

El recuadro de en medio tiene tres cifras: «Días» («5 → 9», o «—» si la fecha no sirve), «Agrega» («+$140.00» o «−$5.00») y «Saldo» (lo que queda después de extender y de cobrar lo escrito). Al pie, «Total» con el total nuevo. Esos tres y el total se calculan así, con gracia de 1 hora y sin CDW, en el ejemplo que usa el propio sistema: la renta salió el 10 de octubre a las 10:00, regresaba el 15 a las 10:00, 5 días a $35, total $175, nada pagado. El atajo «+4 días» deja el regreso el 19 a las 10:00, 9 días. El total nuevo es 9 × $35 = $315. Agrega $315 − $175 = $140. Con «Cobrar ahora» el monto sugerido es $140 y el saldo que muestra el recuadro es $175 (los $175 viejos siguen debiendo; solo se propone cobrar lo nuevo). Si en ese mismo atajo de cuatro días se apaga «Cobrar ahora», no hay pago y el saldo queda en $315. Otro caso, el atajo de un solo día y el interruptor apagado: 6 × $35 = $210 de saldo y ningún pago.

Otro caso del mismo ejemplo: ya se pagaron $200 de esos $175 (saldo a favor de $25). Sumar un día deja el total en $210 y el saldo real en $10. «Agrega» dice +$35.00, pero el monto sugerido es $10.00, porque no puede pasar del saldo. Si en vez de alargar se baja la tarifa a $30 y se suma un día, lo agregado es 6 × $30 − 5 × $35 = $5. El CDW, los cargos extra, el km extra, el combustible, los daños, las multas ya cargadas y el descuento no se tocan: entran al total nuevo igual que estaban. El descuento es un monto fijo, no por día. Extender no vuelve a revisar el tope del descuento.

Si el primer intento de guardar tiene la fecha mal, la tarifa mal o el monto mal, no viaja nada y el campo muestra el aviso. Los textos son estos:

- Fecha vacía o ilegible: «Elija la fecha y la hora.»
- Fecha que no es posterior al regreso actual: «Tiene que ser después del regreso actual.» El servidor, si igual llega, dice «La nueva fecha de regreso tiene que ser después de la actual.»
- Tarifa vacía, ilegible o de cero o menos: «Escriba la tarifa por día.»
- Monto escrito que no se lee: «Escriba un monto válido.»
- Monto mayor que el saldo: «No puede pasar del saldo ($210.00).» El número es el saldo de esa renta, con dos decimales.
- Nota de más de 300 caracteres: «La nota no puede pasar de 300 caracteres.»
- Tarifa que no es un monto: «Escribí un monto válido, con hasta dos decimales.» Tope: «El monto no puede pasar de $99999.99.»

Un monto vacío, en cero o negativo, con el interruptor encendido, no cobra: la extensión igual se guarda. Se puede cobrar una parte, menor que lo agregado.

Si el carro choca con otra renta en las fechas nuevas (incluido el margen de horas de Ajustes; de fábrica es 1 hora), la extensión no se guarda. El aviso es «El carro ya está rentado a María López en esas fechas (con 1 h de margen).» o «reservado», con el nombre de esa otra renta. En ese caso aparece el botón «Cambiar carro», que cierra este diálogo y abre el asistente de cambio. El margen cuenta también el hueco entre una renta y la siguiente: terminar a las 10:00 con 1 hora de margen deja el carro libre desde las 11:00.

Si la extensión se guarda y el cobro falla, la fecha nueva ya quedó. Los campos de fecha, tarifa y nota se bloquean. El aviso del cobro queda al pie y el botón dice «Cobrar» para reintentar solo el pago. Si no hay turno de caja abierto, no se muestra el mensaje del servidor: se muestra «Abra la caja para cobrar.» con un enlace «Caja» que va a **Renta → Caja**. Cualquier otro fallo de cobro muestra el mensaje del servidor, o «No se pudo cobrar.» si no vino uno. Un fallo de la extensión que no trae mensaje muestra «No se pudo extender.»

Cuando todo sale bien, un aviso breve dice «Renta extendida» y «Regresa» más la fecha nueva. El diálogo se cierra. En la ficha, si la hora nueva ya es futura, el sello pasa de «Atrasada» a «En la calle». Si usted alargó pero la hora nueva sigue en el pasado (iba varios días tarde y sumó uno), sigue «Atrasada». La sección «Días» lista cada extensión como fecha vieja, flecha, fecha nueva, y la nota si se escribió. La «Cuenta» recalcula días, total y saldo. El pago, si se hizo, entra a la lista de pagos del turno de caja abierto.

## Multa

Hay dos entradas y un solo diálogo, título «Multa».

Desde la renta: el botón «Multa» de la cabecera, con permiso de cobrar, en curso, atrasada o devuelta. El subtítulo es el carro y el cliente. El botón de guardar dice «Cargar». La multa se le carga siempre a esa renta. La fecha tiene que caer dentro del tramo en que ese cliente tuvo el carro.

Desde el carro: menú **Renta → Carros**, se abre el carro (hace falta permiso de ver la flota, `fleet.read`; si no, «No tenés permiso para ver la flota.»). El botón «Multa» está en la cabecera de las tres pestañas («Ficha», «Servicio y gastos» y, si hay permiso de reportes, «¿Cuánto dejó?»). Pide permiso de cobrar; sin él no se ve. El subtítulo es el nombre del carro y la placa. El botón de guardar dice «Guardar». Aquí la fecha decide sola si se le carga a alguien o si queda como gasto del carro. No hay interruptor.

Los campos, en los dos modos:

- «Fecha y hora», obligatoria. Desde la renta, si el carro todavía no se devolvió, viene con la hora de ahora (hora de El Salvador). Si ya se devolvió, viene un minuto antes de la hora real de regreso, para caer dentro de la renta. Desde el carro, viene con ahora.
- «Monto ($)», obligatorio, mayor que cero, placeholder «0.00».
- «De qué es», obligatorio. Cuatro atajos lo llenan de un toque: «Exceso de velocidad», «Mal estacionado», «Semáforo en rojo» y «Sin cinturón». Se puede escribir otra cosa. Tope 300 caracteres.

«Volver» cierra sin guardar.

Desde la renta, un recuadro muestra «Saldo» (el de hoy) y «Queda» (ese saldo más el monto escrito). Ejemplo: saldo $175.00 y multa de $25 dejan «Queda» en $200.00. El aviso, al guardar bien, dice «Multa registrada» y «$25.00 a Juan Pérez» (el monto con dos decimales y el nombre). La «Cuenta» suma el renglón «Multas» y sube «Debe». Si la renta ya estaba devuelta y en cero, pasa a deber y aparecen los botones «Cobrar».

Desde el carro, debajo de los campos el sistema busca quién lo tenía. Mientras busca, dice «Buscando…» y «Guardar» está apagado. Si la fecha no se lee, ese recuadro no aparece. Si nadie tenía el carro: el texto «Sin renta» y un sello ámbar «Gasto «Multa»». Si alguien lo tenía: «Lo tenía» en negrita el nombre, y si hay número, « · N° 733», más un sello naranja «Se le carga» (sin latido). Al guardar, si se le carga, el aviso es el mismo «$25.00 a Juan Pérez». Si queda como gasto, «$25.00 · Gasto «Multa»». El gasto no entra al saldo de ninguna renta. La multa cargada sí entra al total de la renta de esa persona, aunque usted la haya anotado desde el carro.

A quién se le atribuye el carro, con los bordes incluidos:

- Una reserva y una cancelada nunca tuvieron el carro.
- En curso o devuelta: desde la salida real (o la planificada, si no hay real) hasta el regreso real, o el planificado si todavía no volvió.
- Si sigue en curso y ya se pasó de la hora, se considera que lo tiene hasta ahora. Una multa de hoy, en una renta atrasada, sí cae dentro.
- Si dos rentas se tocan en el mismo instante (el cambio de carro cierra una y abre la otra a la misma hora), gana la que empezó después: la nueva.

Mensajes, tal cual:

- Fecha vacía o incompleta: «Escribí la fecha y la hora de la multa.»
- Fecha que el servidor no acepta como instante: «La fecha y hora no es válida.»
- Sin descripción, o solo espacios: «Escribí de qué es la multa.»
- Descripción de más de 300 caracteres: «No puede pasar de 300 caracteres.»
- Monto vacío, cero o negativo: «El monto tiene que ser mayor que cero.»
- Monto ilegible: «Escribí un monto válido, con hasta dos decimales.»
- Monto por encima del tope: «El monto no puede pasar de $99999.99.»
- Desde la renta, la fecha fuera del tramo: «La fecha de la multa tiene que caer dentro de la renta.» Sale en el campo y también como aviso general.
- Si se pidiera cargar al cliente y nadie tenía el carro: «Nadie tenía rentado ese carro en esa fecha: la multa solo puede quedar como gasto del carro.» En el detalle del campo: «No hay renta en esa fecha.» Desde el carro el diálogo no manda a cargar cuando no hay titular, así que este texto aparece si las dos cosas se contradicen.
- «La multa de una renta se le carga al cliente.» si se intenta guardar una multa de renta sin cargarla.
- Carro que ya no existe: «Ese carro no existe.»
- Renta inválida en el pedido: «Esa renta no es válida.»

No se anula una multa desde este diálogo. Una multa cargada sigue en el total hasta que otra pantalla la trate; esta ficha no tiene botón de quitarla.

## Cambiar carro

Se abre con «Cambiar carro» en la cabecera (en curso o atrasada, permiso de manejar) o con el botón del mismo nombre cuando extender choca con otra renta. Título «Cambiar carro», subtítulo carro y cliente. Es un solo envío al final: hasta «Cambiar carro» del último paso no se cierra nada ni se abre nada.

Tres pasos, en píldoras: «1. Recibir», «2. Entregar», «3. Listo». Se puede volver a un paso anterior. Un paso de adelante está apagado hasta que el actual no tenga errores; si los tiene, se queda en el paso y muestra el aviso. En el primero, el botón izquierdo es «Volver» (cierra todo). Después es «Atrás». A la derecha, «Seguir», y en el último paso «Cambiar carro».

### Paso 1. Recibir

Es la recepción del carro que el cliente trae.

- «Cuándo se cambia», con la hora de ahora. Tiene que ser después de la salida.
- «Km que entra», o «Km que entra · desde 10000» si hay kilometraje de salida. Solo dígitos. No puede ser menor que el de salida.
- El indicador «Combustible»: semicírculo de E a F, marcas «E», «¼», «½», «¾» y «F». Los valores que se pueden dejar son vacío, ¼, ½, ¾ y lleno. Se toca, se arrastra o se mueve con las flechas. Si hay nivel de salida, una aguja punteada dice «Salió». El nivel no calcula dinero.
- «Combustible ($)», opcional, placeholder «0.00». Es el monto que usted escribe, no la diferencia del tablero. Vacío vale cero.
- El dibujo del carro. Lo que ya venía marcado en la salida queda trabado (no se quita) y, para el lector de pantalla, «ya venía». Tocar una zona nueva agrega una línea de daño con la pieza ya escrita (por ejemplo «Capó»). Volver a tocarla la quita. Las zonas son: «Capó», «Techo», «Baúl», «Bumper delantero», «Bumper trasero», «Parabrisas», «Vidrio trasero», «Guardafango delantero izquierdo», «Puerta delantera izquierda», «Puerta trasera izquierda», «Guardafango trasero izquierdo», y las mismas del lado derecho, más «Espejo izquierdo», «Espejo derecho» y «Llantas y aros».
- «Daños»: cada línea tiene «Pieza» y «Monto» (placeholder «$0.00»), y un botón de quitar («Quitar» más el nombre de la pieza, o «Quitar el daño 1»). «Daño» agrega una línea libre, sin zona. Una línea vacía de pieza y de monto se descarta. Un monto vacío cuenta cero (el daño queda anotado y no se cobra). Si la suma de daños es mayor que cero y la cobertura fue aceptada, se lee «Paga hasta $100 · Cobra $100»: cobra el menor entre la suma y el deducible. Si la cobertura se declinó o no se definió, solo «Cobra» y la suma entera, sin tope.
- «Por qué», obligatorio en conjunto con el detalle. Atajos, se apagan si se vuelven a tocar: «Falla», «Choque», «Extendió», «Pidió otro».
- «Detalle», opcional. Si hay atajo y detalle, se guardan unidos: «Falla · frenos». Si solo hay detalle, se guarda el detalle. Si no hay ninguno: «Diga por qué se cambia.»

Los km de más se cobran solos. No hay interruptor para apagarlos en este asistente. Kilómetros andados = km que entra − km de salida (no baja de cero). Permitidos = km libres por día del carro × días de esta parte; si el carro no tiene km libres, o los tiene en cero, no hay cargo. El exceso, si lo hay, se multiplica por el precio del km extra. Entra al total de la renta que se cierra. El paso «Listo» no lo muestra en un renglón propio; después, en la «Cuenta» de esa renta, el renglón se llama «Km extra». Ejemplo: 100 km libres por día, 4 días, permitido 400. De 10.000 a 10.300 no hay exceso. De 10.000 a 10.500 son 100 km de más; a $0.20 el km, el cargo es $20.00.

Para seguir, los avisos son: «Elija la fecha y la hora.», «El cambio tiene que ser después de la salida.», «Escriba el kilometraje del tablero.», «El kilometraje no puede ser menor que el de salida (10000 km).» (el número es el de esa salida), «Marque cuánto combustible tiene.» y «Diga por qué se cambia.»

### Paso 2. Entregar

El carro nuevo, solo entre los que están libres de verdad en el tramo (no ofrece «Libre si regresa a tiempo» ni «Ocupado»). El tramo va desde la hora del cambio hasta el regreso que va a quedar. El carro actual no sale en la lista. Si la fecha del paso anterior no sirve, dice «Elegí las fechas». Mientras busca, «Buscando…». Si no hay ninguno, «Nada libre». Cada fila muestra placa, nombre y «$45 por día» (la tarifa diaria del carro, no la del tramo).

Elegido el carro:

- «Km que sale · P222» (sin « · placa» si no tiene). Arranca con el kilometraje que tiene el carro en la flota. Solo dígitos.
- «Regresa», solo lectura: el regreso planificado de la renta vieja, si esa hora es posterior al cambio. Si el cambio es a la hora del regreso o después (la renta ya iba atrasada, o justo en la hora), el regreso nuevo es un día después del cambio.
- El mismo indicador de combustible, sin aguja «Salió». Hay que marcarlo.
- El dibujo, para anotar golpes que el carro nuevo ya trae. Esos golpes no se cobran: no tienen monto.
- «Accesorios · toque lo que falta», si en Ajustes hay accesorios. Empiezan todos presentes. Al tocar uno, queda tachado en rojo: falta. No suman dinero.
- «Fotos». Abre la cámara o el archivo. Tope 24. Al llegar al tope el botón se apaga. Cada foto se quita con «Quitar la foto 1». Si una no sube: «No se pudo subir una foto.» o el mensaje del envío. El servidor, si se pasan: «No más de 24 fotos.»
- «Tarifa por día», tres opciones como máximo. «La misma $40» viene elegida: es la tarifa pactada de la renta que se cierra, aunque el tramo nuevo pase de 7 o de 30 días. «Del carro $45» solo aparece si la tarifa del carro para esos días es distinta. Esa tarifa del carro sí usa tramo: la mensual desde 30 días si es mayor que cero, si no la semanal desde 7 días si es mayor que cero, si no la diaria. Con 6 días y semanal de $38, «Del carro» muestra la diaria ($45); con 7 días, muestra $38. «Otra» abre «Otra tarifa ($)», que tiene que ser mayor que cero.

Para seguir: «Elija el carro nuevo.», «Escriba el kilometraje del carro nuevo.», «Marque cuánto combustible lleva.», «Escriba la tarifa por día.»

### Paso 3. Listo

Dos tarjetas.

«Cierra», sello gris, el número viejo («N° 733») y la placa vieja. Renglones: el tramo y los días («4 d»), «Km» («10000 → 10300»), «Combustible» (en el resumen: «Vacío», «Lleno» o «4/8»; el indicador del paso anterior decía «½», aquí el mismo nivel se escribe en octavos), «Cargo combustible» si es mayor que cero, «Daños» si es mayor que cero, «Total», «Pagado» (en verde) y «Saldo».

«Abre», sello naranja sin latido, la placa nueva, sin número todavía. Renglones: el tramo y los días, «Km salida», «Combustible», «Tarifa», «Garantía de N° 733» (o «N° —» si la vieja no tiene número) con el depósito que sigue en custodia, «Total», y «Saldo». Si hay excedente de pago, también «Pagado en N° 733».

La cuenta, con el ejemplo del sistema. Diez días a $40, del 10 al 20 de octubre a las 10:00, contrato 733, depósito $200 en efectivo, pagados $400 (el total exacto). Se cambia el día 14 a las 10:00, gracia de 1 hora. La vieja queda en 4 días: 4 × $40 = $160. Sobran $240 de los $400. La nueva va del 14 al 20, 6 días a la misma tarifa: 6 × $40 = $240. En «Cierra»: total $160, pagado $160, saldo $0. En «Abre»: total $240, pagado $240, saldo $0, garantía $200. El CDW, si lo hubiera, entra en las dos: (tarifa + CDW) × días. La nueva no hereda cargos extra ni descuento: salen en cero. Las multas se quedan en la vieja y sí entran a su total.

Si solo se habían pagado $100, no hay excedente. «Cierra» queda pagado $100 y saldo $60. «Abre» queda pagado $0 y saldo $240. La deuda no salta de renta.

Combustible y daños, en la vieja: cobertura aceptada, deducible $100, combustible escrito $15, una línea de $250. Se cobra $100 de daños (el tope), no $250. Total de la vieja: 4 × $40 + $15 + $100 = $275, si no hay otros cargos.

Si la renta ya iba atrasada y se cambia el 22 a las 10:00, con regreso planificado el 20, la nueva regresa el 23 a las 10:00 y cuenta 1 día.

### Qué queda guardado

Un solo paso cierra la renta vieja y abre la nueva.

La vieja pasa a «Devuelta», con la hora del cambio como regreso real, los días de esa parte, el km, el combustible, los daños, el km extra y el motivo. El motivo se guarda en las dos rentas; la ficha no tiene un campo que lo muestre. El carro viejo deja de estar ocupado (una devuelta no lo retiene) y su kilometraje sube si el que se anotó es mayor. La garantía deja de estar en custodia ahí: la línea dice «Garantía $200 en otra renta».

La nueva nace «En la calle», ya entregada, con la misma hora como salida, el km y el combustible anotados, la tarifa elegida, el mismo CDW, la misma cobertura, el mismo deducible, los mismos lugares, el mismo conductor adicional y las mismas notas. Cargos extra y descuento en cero. Recibe el depósito que todavía estaba en custodia, con el mismo método y los mismos datos de tarjeta. Su línea de garantía es, por ejemplo, «Garantía $200 en efectivo». El número de contrato es el siguiente del talonario, no el de la renta que se cerró. El aviso dice «Carro cambiado» y, si el número se asignó, «Sigue en N° » más ese número. La pantalla pasa a la ficha de la renta nueva. La vieja se encuentra en «Otras rentas» del mismo cliente, o en **Rentas → Historial** / el filtro «Ya volvió» si el regreso cae en los últimos siete días.

El excedente se mueve de los pagos vivos, del más reciente al más viejo. Un pago anulado no se mueve. Si un pago hay que partirlo, la parte que se queda conserva el monto reducido y la parte que se va es un pago nuevo con el mismo método, la misma hora, la misma persona y el mismo turno de caja: la caja no cambia de total. La nota del que se va agrega «Excedente del contrato #733», o «Excedente de la renta anterior» si no había número. Si el pago se va entero, esa frase se suma a la nota que ya tenía («nota vieja · Excedente del contrato #733»).

El carro nuevo tiene que estar activo. Si está en el taller: «Ese carro está en el taller: no se renta.» Si está retirado: «Ese carro está retirado: no se renta.» Si en ese instante ya no está libre: «El carro ya está rentado a … en esas fechas (con 1 h de margen).» Esos tres devuelven el asistente al paso «Entregar». «Elija un carro distinto al que tiene.» si se mandara el mismo. «Ese carro no existe.» si ya no está. Un rechazo de la inspección de regreso devuelve al paso «Recibir». Otros textos del envío, si el paso dejó pasar algo: «Escriba por qué se cambia el carro.», «No puede pasar de 300 caracteres.», «Escriba la pieza dañada.», «No más de 30 daños.», «Escribí el kilometraje.», «El kilometraje es un número entero.», «El kilometraje no puede ser negativo.», «Ese kilometraje no es real.» (por encima de 2.000.000), «Marcá el combustible.», «El combustible va en octavos.», «El combustible va de 0 a 8 octavos.», «Demasiados daños.», «Esa foto no es válida.»

Este asistente no cobra un pago nuevo y no exige turno de caja abierto. El depósito no se devuelve aquí: viaja a la renta nueva.

## Editar

En **Más → Editar**, con permiso de manejar, en una reserva o en una renta en curso (también atrasada). En una devuelta o cancelada el ítem está apagado. Si igual se intentara, el servidor dice «La renta ya está cerrada (finalizada o cancelada): no se puede cambiar.»

Título «Editar la renta». Subtítulo: nombre del cliente, un punto medio, y la placa o «sin placa». «Cancelar» cierra sin guardar. «Guardar cambios» envía solo lo que cambió. Si no cambió nada, el diálogo se cierra y no hay aviso. Si guardó, el aviso es «Renta guardada» y el nombre del cliente.

Sección «Fechas y lugares». «Sale» solo se ve en una reserva; en curso el campo no está, porque el carro ya salió. Si se forzara el cambio de salida en curso: «El carro ya salió: la fecha de salida no se cambia.» «Regresa» se ve siempre. Los dos vienen con las fechas de la renta. «Lugar de entrega» y «Lugar de devolución» ofrecen «Oficina», «Aeropuerto», «Domicilio del cliente» y «Hotel», con el valor guardado elegido. Mover las fechas vuelve a revisar si el carro choca con otra renta, con el mismo margen.

Sección «Cobro». El texto de ayuda, tal cual, es «Si movés las fechas sin tocar los días, se recalculan.» Si usted cambia «Sale» o «Regresa» y no toca «Días a cobrar», el servidor recalcula los días con la gracia. Si usted escribe otros días, se quedan los escritos. Campos, todos precargados con lo que ya tiene la renta:

- «Tarifa por día ($)». Vacío no se envía y se conserva la de antes. Un texto que no es monto: «Escribí un monto válido, con hasta dos decimales.»
- «Días a cobrar». Vacío, si además se movieron las fechas, deja que se recalculen. «Escribí los días.», «Los días son un número entero.», «Al menos un día.», «Demasiados días.» (más de 3650).
- «CDW por día ($)».
- «Deducible ($)».
- «Cobertura»: «Sin definir», «Acepta la cobertura», «Declina la cobertura». Si el valor no fuera uno de esos: «Elegí la cobertura.»
- «Cargos extra ($)». Es un monto fijo, no por día. Vacío se guarda como cero. En la cuenta, si es mayor que cero, el renglón usa «Detalle de los cargos» o, si ese detalle está vacío, la palabra «Cargos».
- «Detalle de los cargos», opcional, tope 300: «El detalle de los cargos no puede pasar de 300 caracteres.»
- «Descuento ($)». Vacío se guarda como cero. No puede pasar del tope. El tope es (tarifa + CDW) × días + cargos extra + km extra + combustible + daños + multas cargadas al cliente. Igual al tope, se acepta. Si se pasa: «El descuento no puede pasar de $80.00.» (el número es el tope de esa renta). El aviso sale en el campo y también al pie.

Sección «Garantía»:

- «Depósito ($)». Vacío se guarda como cero. No es el botón de devolver: cambia el monto anotado.
- «Método del depósito»: «Sin método», «Efectivo», «Tarjeta», «Transferencia», «Otro».
- «Tarjeta, últimos 4», exactamente cuatro dígitos o vacío. Si no: «Solo los últimos 4 dígitos de la tarjeta.»
- «Código de autorización», opcional, tope 40: «El código de autorización no puede pasar de 40 caracteres.»
- «Monto autorizado ($)», opcional.

Sección «Observaciones»: «Notas», opcional, tope 2000: «La nota no puede pasar de 2000 caracteres.»

Lugares vacíos, si se llegaran a mandar: «Escribí dónde se entrega.» y «Escribí dónde se devuelve.», con tope «No puede pasar de 120 caracteres.» Fecha ilegible: «Escribí la fecha y la hora.» Regreso que no es posterior a la salida: «El regreso tiene que ser después de la salida.» Carro ocupado en las fechas nuevas: «El carro ya está rentado a … en esas fechas (con 1 h de margen).» o «reservado». Cualquier monto por encima del tope: «El monto no puede pasar de $99999.99.»

Este diálogo no cambia el cliente, el carro, el conductor adicional ni el kilometraje. Esos datos se quedan como estaban aunque no se vean.

## Cancelar

En **Más → Cancelar**, con permiso de manejar. En una reserva el ítem está activo aunque ya tenga pagos. En curso (o atrasada) solo está activo si el pagado es cero; un pago anulado no cuenta como pagado. En devuelta o cancelada está apagado.

Título «Cancelar la renta». Si está en curso, el texto es «Una renta en curso solo se cancela si no tiene pagos. El carro vuelve a quedar libre.» Si es reserva: «La reserva se cancela y el carro queda libre en esas fechas.» El campo «Por qué se cancela» es obligatorio. «Volver» cierra. «Cancelar renta» es el botón rojo.

Al guardar, el aviso es «Renta cancelada» y el nombre del cliente. El sello pasa a «Cancelada». En la ficha, el campo «Cancelada» muestra el motivo. El carro deja de estar ocupado en esas fechas. Los pagos no se borran ni se devuelven solos: siguen en la «Cuenta», y se pueden anular aparte si el turno lo permite. El botón «Cobrar» de la cuenta desaparece. El servidor, si alguien intenta cobrar después, dice «La renta está cancelada: no recibe pagos.»

Mensajes: «Escribí por qué se cancela.» Vacío no sirve. Más de 300 caracteres: «No puede pasar de 300 caracteres.» En curso con algún pago vivo, aunque el menú estuviera apagado y se forzara: «La renta ya tiene pagos: recibí el carro o anulá los pagos antes de cancelarla.» Ahí hay que recibir el carro o anular esos pagos primero. Renta ya cerrada: «La renta ya está cerrada (finalizada o cancelada): no se puede cambiar.»

## Cobrar

Tres entradas al mismo diálogo, todas con permiso de cobrar y solo si el saldo es mayor que cero y la renta no está cancelada:

- El botón de contorno «Cobrar» de la cabecera, en curso o atrasada.
- El botón primario «Cobrar», cuando la renta está devuelta y todavía debe.
- El botón «Cobrar» dentro de «Cuenta». Este también aparece en una reserva que deba.

Antes de mostrar el formulario el diálogo mira el turno de caja de la renta (no el del lavado). Mientras mira, el título es «Registrar pago» y el cuerpo «Cargando…». Si la consulta falla, muestra ese mensaje en rojo y «Cancelar». Si no hay turno abierto, el título cambia a «Sin caja abierta», hay un botón «Caja» hacia **Renta → Caja**, y «Cancelar». No se puede anotar el pago sin turno.

Con turno abierto, título «Registrar pago» y el texto «Saldo pendiente: $175.00» (dos decimales). Campos:

- «Monto ($)», obligatorio, arranca con el saldo entero. Se puede bajar para un abono. Placeholder «0.00».
- «Forma de pago»: «Efectivo», «Tarjeta», «Transferencia», «Otro». Arranca en «Efectivo». Si faltara: «Elegí el método de pago.»
- «Referencia (transferencia, voucher)», opcional, tope 60: «La referencia no puede pasar de 60 caracteres.»
- «Nota (opcional)», tope 500: «La nota no puede pasar de 500 caracteres.»

«Cancelar» cierra. «Registrar pago» guarda. El aviso es «Pago registrado» y, por ejemplo, «$50.00 · Efectivo». La «Cuenta» sube «Pagado», baja «Debe» y agrega el renglón «$50 · Efectivo». El pago entra al turno abierto. La renta no cambia de estado por cobrar: una atrasada sigue atrasada, una devuelta sigue devuelta. Si el abono deja saldo, «Cobrar» sigue. Si lo deja en cero, «Cobrar» se esconde; si además está devuelta y hay depósito en custodia, el botón primario pasa a «Devolver garantía».

Un abono de $50 sobre $175 deja debe $125. No se puede cobrar de más por este diálogo. Mensajes:

- Cero, negativo o vacío: «El monto tiene que ser mayor que cero.»
- Ilegible: «Escribí un monto válido, con hasta dos decimales.»
- Por encima de $99999.99: «El monto no puede pasar de $99999.99.»
- Mayor que el saldo: «El pago pasa del saldo de la renta ($175.00).» Sale en el campo «Monto ($)». El número es el saldo de esa renta.
- Saldo que ya es cero o a favor: «Esta renta no tiene saldo pendiente.»
- Renta cancelada: «La renta está cancelada: no recibe pagos.»
- El turno se cerró entre que se abrió el diálogo y se confirmó: «Abrí la caja para cobrar.»
- Renta que no existe: «Esa renta no existe.»

«Cobrar ahora» dentro de «Extender» es otro camino: no pide referencia ni nota, y el monto arranca en lo agregado, no en todo el saldo. Usa el mismo turno y los mismos cuatro métodos. Si la caja está cerrada, el texto de ese diálogo es «Abra la caja para cobrar.», no el del servidor.

### Anular un pago

En «Cuenta», cada pago vivo tiene un **Más** (nombre accesible «Más») con «Anular», solo con permiso de cobrar. Un pago ya anulado se ve tachado, el lector de pantalla dice «anulado», y no tiene menú. El motivo de la anulación se guarda, pero la línea de la cuenta no lo muestra.

Título «Anular pago». El texto es el monto, el método y quién lo recibió: «$50.00 · Efectivo · recibió Ana López. Deja de sumar al pagado, pero queda escrito.» Campo «Motivo», obligatorio. «Cancelar» cierra. «Anular pago» es el botón rojo.

Al confirmar, el aviso es «Pago anulado» y el monto. El renglón sigue en la lista, tachado, y deja de sumar a «Pagado». «Debe» sube otra vez. Si era el único pago de una renta en curso, «Cancelar» del menú de la renta vuelve a encenderse.

Mensajes: «Escribí por qué se anula (al menos 3 letras).» Más de 300 caracteres: «No puede pasar de 300 caracteres.» «Ese pago ya estaba anulado.» «Ese pago no existe.» Si el pago entró en un turno que ya no está abierto: «Ese turno ya cerró: el pago no se puede anular.» Un pago viejo que no quedó atado a ningún turno sí se puede anular con el turno de hoy cerrado.

## Devolver garantía

No es lo mismo que cobrar. El botón de la cabecera dice «Devolver garantía». Solo es el botón primario, con permiso de cobrar, cuando la renta está devuelta, el saldo no es mayor que cero y todavía hay depósito en custodia. En curso no está: ahí el primario es «Recibir». Si el depósito ya se devolvió o ya pasó a otra renta en un cambio de carro, el botón no está.

El diálogo se titula «Devolver depósito», no «Devolver garantía». El texto es «En custodia: $200.00. Se devuelve una sola vez.» No pide forma de devolución: no hay campo de efectivo, tarjeta ni transferencia, porque ese dato no se guarda.

- «Monto a devolver ($)», arranca con todo el depósito. Se puede bajar para una devolución parcial. Cero está permitido: se retiene todo, y entonces la nota es obligatoria.
- Si el monto es menor que lo que hay en custodia, aparece en ámbar «Se retienen $20.00.» y la etiqueta de la nota cambia de «Nota (opcional)» a «Por qué se retiene».
- «Cancelar» cierra. «Devolver depósito» confirma.

El aviso es «Depósito devuelto» y el monto devuelto, por ejemplo «$180.00». Se hace una sola vez. Después la línea de la cuenta dice «Devuelta $180» (el monto devuelto, no lo retenido). El botón desaparece. No hace falta turno de caja: este paso no revisa si la caja está abierta.

Ejemplo: depósito $200.00. Devolver $180 retiene $20. Hay que escribir por qué. Devolver $200 no pide nota. Devolver $0 retiene $200 y sí pide nota.

Mensajes:

- Monto ilegible: «Escribí un monto válido, con hasta dos decimales.»
- Monto negativo: el mismo aviso de monto válido, porque no acepta signo.
- Por encima del tope de cualquier monto: «El monto no puede pasar de $99999.99.»
- Más que el depósito: «No se puede devolver más que el depósito ($200.00).» El número es el depósito anotado en la renta. El aviso también se pone en el campo del monto.
- No queda nada en custodia (ya se devolvió, nunca hubo, o se transfirió en un cambio de carro): «Esta renta no tiene depósito en custodia: ya se devolvió o no hubo.»
- Retención sin nota: «Si se retiene una parte del depósito, escribí por qué.» En el campo: «Escribí por qué se retiene una parte.»
- Nota de más de 500 caracteres: «La nota no puede pasar de 500 caracteres.»
- Renta inexistente: «Esa renta no existe.»

En la «Cuenta», sin depósito, la línea es «Sin garantía». Con depósito todavía en custodia: «Garantía $200 en efectivo» (o «en tarjeta», «en transferencia», «en otro»; sin método, solo «Garantía $200»). Si pasó a la renta del cambio de carro: «Garantía $200 en otra renta».

## Rentas atrasadas y «Llamar»

Atrasada no es un estado que usted marque. En cuanto la hora de regreso planificada queda atrás y el carro no se ha recibido, el sello de la ficha es «Atrasada», en rojo. Extender a una hora futura lo vuelve «En la calle». Recibir el carro lo vuelve «Devuelta». Cancelar, solo si no tiene pagos vivos, lo vuelve «Cancelada» y libera el carro. Mientras está atrasada se puede extender, cambiar de carro, multar, cobrar, editar y, si el pagado es cero, cancelar. El botón primario es «Recibir».

En la lista **Rentas → En la calle**, la columna «Cuándo» dice «Atrasado · 1 día» o «Atrasado · 2 horas», en rojo, y debajo «Debía regresar: …». El número junto al tab «Rentas» cuenta esas rentas, incluidas las que se atrasaron hoy mismo, en cuanto pasó la hora.

En **Renta → Hoy** (el título es «Hoy, 20 de oct», con el día de hoy) hay dos listas. «Salen y vuelven» junta las salidas de hoy y los regresos cuyo día de regreso es hoy, aunque la hora ya haya pasado. El regreso de hoy dice «Vuelve hoy · 10:00 a.m.» y tiene el botón «Recibir», que abre la ficha con la recepción. Esa fila no se pone en rojo por ir tarde el mismo día: el rojo de esa lista es para una entrega de hoy cuya hora ya pasó.

«Pendientes» es otra cosa. Ahí entran las rentas en curso cuyo día de regreso es anterior a hoy, de la que debió volver antes a la más reciente. Cada fila muestra placa, carro, cliente y, en rojo, «Debió volver 18 de oct · 10:00 a.m.» Tocar la fila abre la ficha. Si el cliente tiene celular, o si no teléfono, aparece «Llamar». Es un enlace del teléfono: abre el marcador del aparato con ese número. No llama desde el sistema ni deja un registro. Si no hay ningún teléfono, «Llamar» no está. Con la lista vacía y sin error, el texto es «Todo en orden». «Salen y vuelven» vacío dice «Nada por hoy». Si la carga falla, se muestra el mensaje del servidor.

Una renta que se atrasó hoy, después de su hora pero en el mismo día, es «Atrasada» en su ficha y «Atrasado · N horas» en la lista de rentas, y suma en el número del tab. En Hoy no cae en «Pendientes» ni tiene «Llamar»: sigue en «Salen y vuelven» hasta que cambie el día. Al día siguiente, si nadie la recibió, pasa a «Pendientes» y, con teléfono, muestra «Llamar».

---

## Caja

La caja de la renta es un turno del negocio de renta, distinto del turno del lavado. Abrir una no abre la otra, y los cobros de una no entran en la otra. En todo el negocio de renta hay como máximo un turno abierto a la vez: lo comparte quien tenga permiso de cobrar, no es un cajón por persona.

### Cómo llegar y quién la ve

En el espacio de trabajo de renta, la pestaña del riel (y de la barra de abajo) se llama «Caja» y abre `/rentals/cash`. El título de la ventana es «Caja · Elite Service».

La ve solo quien tiene el permiso de cobrar (`rentals.charge`): «Registrar cobros, devolver depósitos, multas y ver la caja de renta». Sin ese permiso la pestaña no aparece. Si igual se abre la dirección, la pantalla dice «No tenés permiso para ver la caja de renta.» y debajo «Si debería ser tuyo, pedile el permiso a quien administra. El riel a la izquierda (o abajo) te saca de acá.»

Quien puede ver la caja puede abrirla, cerrarla, cobrar desde «Quién me debe» y devolver una garantía. El permiso de ver rentas (`rentals.read`) no alcanza para entrar aquí.

Mientras carga, el bloque del turno dice «Cargando la caja». Si esa consulta falla, ese bloque muestra el mensaje del servidor y no dibuja el historial. «Quién me debe» y «Garantías» siguen debajo, porque son listas aparte.

### Sin turno abierto: el fondo

Si no hay turno abierto, el encabezado dice «Caja» y no lleva subtítulo (en la renta no se escribe quién abrió). No aparece el botón «Cerrar caja».

El formulario es una tarjeta con un solo campo y un botón:

- «Fondo». Obligatorio en la práctica: el campo ya viene con `0.00`. Es el efectivo que ya estaba en el cajón antes de cobrar. No es un cobro. Acepta cero. Se escribe con punto y hasta dos decimales (`100`, `100.5` y `100.50` valen y quedan en dos decimales). El tope es $99999.99.
- «Abrir caja». Al guardar, el aviso es «Caja abierta», sin texto extra. La pantalla pasa al turno abierto.

Mensajes del campo, tal cual:

- «Escribí un monto válido, con hasta dos decimales.» Vacío, letras, coma, signo menos o tres decimales.
- «El monto no puede pasar de $99999.99.»

Si otra persona alcanzó a abrir mientras usted enviaba el formulario, el aviso bajo el formulario es «Ya hay un turno abierto por {nombre completo}.» El nombre es el de quien lo abrió. En ese caso la pantalla, al recargar, muestra ese turno y no deja abrir otro.

En la renta esa tarjeta no trae una frase de ayuda. (En el lavado sí dice «Sin caja abierta no se cobra.»; aquí no.)

### Qué se ve con el turno abierto

El encabezado sigue siendo «Caja», sin el nombre de quien abrió y sin la hora. A la derecha está «Cerrar caja», que abre el diálogo de cierre. No se deshabilita.

Debajo, el título «Cobrado» y cuatro tarjetas que salen siempre, aunque estén en `$0.00`:

| Tarjeta         | Color  | Qué suma                                |
| --------------- | ------ | --------------------------------------- |
| «Efectivo»      | verde  | Pagos en efectivo no anulados del turno |
| «Tarjeta»       | neutro | Pagos con tarjeta no anulados           |
| «Transferencia» | neutro | Pagos por transferencia no anulados     |
| «Otro»          | neutro | Pagos marcados «Otro» no anulados       |

Cada tarjeta parte el monto: el entero grande (`$180`) y los centavos (`.00`).

Solo el efectivo entra al cajón. Tarjeta, transferencia y «Otro» se informan y no se cuentan a mano.

Si hay al menos un pago «Otro», debajo aparece la tarjeta «Otro». A la derecha del título va el total de «Otro». Cada fila es la nota de ese pago y su monto. Una nota vacía se lista como «Sin descripción». La renta no arma la tarjeta «Transferencias por cuenta»: el desglose por cuenta bancaria llega vacío, así que esa tarjeta no se dibuja. En el detalle de un cobro por transferencia, si hay referencia, se lee «Ref {referencia}». No se muestra banco ni últimos dígitos.

Luego el título «Turno» y tres cifras:

- «Fondo»: lo que se escribió al abrir.
- «Esperado»: fondo más efectivo cobrado y no anulado. Se recalcula mientras el turno sigue abierto.
- «Cobros»: cuántos pagos no anulados lleva el turno (un pago partido en dos métodos cuenta dos). No dice «lavados».

### Cobros de este turno

Título «Cobros de este turno». Tabla de los pagos no anulados, 25 por página. Cada fila lleva a la izquierda el número de contrato de esa renta (si la renta no tiene número, la referencia queda en 0). Tocar la fila abre la renta. Tocar un botón no navega.

Columnas:

- «Método». Sello con icono y palabra:
  - «Efectivo», verde: está en el cajón.
  - «Tarjeta», azul: informativo.
  - «Transferencia», ámbar: no se cuenta a mano.
  - «Otro», neutro.
- «Monto», con signo de dólar y dos decimales (`$80.00`).
- «Detalle»: la placa (o «—» si el carro no tiene), el nombre del cliente y, si aplica, « · Ref {referencia}» en una transferencia o « · {nota}» en «Otro».
- «Hora»: día, mes corto y hora de El Salvador, con «a.m.» o «p.m.» (por ejemplo «20 oct, 8:05 a.m.»).

Sin cobros, el título vacío es «Todavía no hay cobros» y el texto de abajo queda en blanco. Si la página falla, se muestra el mensaje del servidor. El pie dice «N cobros», o «1–25 de 40 cobros» si hay más de una página, con «Anterior», «{página} de {páginas}» y «Siguiente».

Un pago anulado deja de sumar y desaparece de esta tabla y de las cuatro tarjetas. El anulado no se borra de la renta: queda escrito allí, con motivo.

### Quién me debe

Título «Quién me debe». A la derecha, la suma del saldo de todas las cuentas de la lista, no solo de la página visible (`$430.00`).

Entra una renta que está en la calle o ya devuelta y cuyo saldo es de al menos un centavo. No entra una reserva, ni una cancelada, ni una que ya quedó en cero o a favor del cliente (saldo negativo). El orden es de la que más debe a la que menos.

Saldo de cada fila:

`(tarifa por día + cargo de cobertura por día) × días a cobrar + cargos extra + kilómetros extra + combustible + daños + multas cargadas al cliente − descuento − pagos no anulados`

El total nunca baja de cero antes de restar los pagos. El saldo sí puede quedar negativo en la ficha de la renta si se cobró de más; esa renta no aparece en esta lista.

Ejemplo. Tarifa $25.00, cobertura $5.00, 3 días, cargos extra $10.00, descuento $0.00, sin km, combustible, daños ni multas, y un pago de $40.00:

- Renta = (25.00 + 5.00) × 3 = $90.00
- Total = 90.00 + 10.00 = $100.00
- Saldo = 100.00 − 40.00 = $60.00

Columnas: «Placa» (o «—»), «Cliente», «Monto» (el saldo, `$60.00`) y el botón «Cobrar». La fila abre la renta. «Cobrar» abre «Registrar pago» y no cambia de pantalla. 25 cuentas por página. El pie habla de «cuenta» / «cuentas». Vacío: título «Nadie» y mensaje en blanco.

#### Registrar pago

Si todavía se está mirando el turno, el diálogo se titula «Registrar pago» y el cuerpo dice «Cargando…». Si esa consulta falla, se ve el mensaje y «Cancelar». Si no hay turno, el título es «Sin caja abierta», el botón «Caja» lleva a la caja y cierra el diálogo, y «Cancelar» solo cierra.

Con turno abierto:

- Título «Registrar pago».
- Texto «Saldo pendiente: $60.00» (el saldo de esa fila).
- «Monto ($)». Obligatorio. Viene lleno con el saldo, para cobrarlo entero. Se puede bajar para un abono. Placeholder «0.00». Mayor que cero, hasta dos decimales, tope $99999.99.
- «Forma de pago». Obligatorio. Arranca en «Efectivo». Opciones, en este orden: «Efectivo», «Tarjeta», «Transferencia», «Otro». Si faltara: «Elegí el método de pago.»
- «Referencia (transferencia, voucher)». Opcional. Hasta 60 caracteres. Si se pasa: «La referencia no puede pasar de 60 caracteres.» Sirve para cualquier forma de pago; en la tabla de la caja, «Ref …» solo se muestra cuando la forma es transferencia.
- «Nota (opcional)». Opcional. Hasta 500 caracteres. Si se pasa: «La nota no puede pasar de 500 caracteres.» En un pago «Otro», esa nota es el texto de la fila de «Otro».
- «Cancelar» cierra sin cobrar. «Registrar pago» guarda.

El aviso de éxito es «Pago registrado» y, debajo, «$60.00 · Efectivo» (monto y forma). La fila de «Quién me debe» baja el saldo. Si el saldo queda en cero, la renta sale de la lista. El turno suma ese pago en la tarjeta de su forma. Si fue efectivo, sube «Esperado».

Mensajes del monto:

- «Escribí un monto válido, con hasta dos decimales.»
- «El monto no puede pasar de $99999.99.»
- «El monto tiene que ser mayor que cero.»

Mensajes del servidor, en el campo del monto o en el aviso del formulario:

- «El pago pasa del saldo de la renta ($60.00).» El monto supera lo que falta.
- «Esta renta no tiene saldo pendiente.» El saldo ya es cero o negativo.
- «La renta está cancelada: no recibe pagos.»
- «Abrí la caja para cobrar.» El turno se cerró entre que se abrió el diálogo y se guardó.
- «Esa renta no existe.»
- «No se pudo conectar con el servidor.» No hubo respuesta.
- «No tenés permiso para hacer esto.» La sesión ya no tiene permiso de cobrar.
- «Tu sesión no es válida. Iniciá sesión de nuevo.»

Un abono menor al saldo es válido. El resto sigue en «Quién me debe». No hay vuelto en este diálogo: no se escribe cuánto entregó el cliente ni cuánto se le devuelve de cambio.

### Garantías

Título «Garantías». A la derecha, la suma de lo que sigue en custodia en todas las filas, no solo en la página.

Entra una renta con depósito mayor que cero que todavía no se devolvió y que no pasó a otra renta (un cambio de carro puede trasladar el depósito). Da igual si la renta está reservada, en la calle o devuelta. El orden es por número de contrato; las que no tienen número van al final.

Lo que se lista es el depósito entero, no un saldo parcial. En cuanto se registra una devolución —aunque sea de una parte, o de $0.00— la renta sale de la lista. La parte retenida no queda como otra fila.

Columnas: «Placa» (o «—»), «Cliente», «Monto» y el botón «Devolver». La fila abre la renta. 25 por página. El pie habla de «garantía» / «garantías». Vacío: título «Ninguna» y mensaje en blanco.

El depósito anotado en el contrato no entra solo a «Efectivo» ni a «Esperado». Entra al turno solo si, además, se registró como pago (en «Registrar pago», en la entrega, en la recepción o en una extensión). La devolución tampoco resta del esperado: queda anotada en la renta y el cajón esperado sigue siendo fondo más efectivo cobrado. Si usted entrega ese efectivo al cliente, al cerrar el conteo va a quedar corto y el sello va a decir que falta.

#### Devolver depósito

- Título «Devolver depósito».
- Texto «En custodia: $200.00. Se devuelve una sola vez.»
- «Monto a devolver ($)». Viene lleno con todo lo que hay en custodia. Acepta cero y acepta una parte. Mismos mensajes de monto que el fondo, incluido el tope. Aquí el cero sí es válido.
- Si el monto escrito es menor que el depósito, en ámbar: «Se retienen $50.00.» (el ejemplo es devolver $150.00 de $200.00). La etiqueta de la nota pasa de «Nota (opcional)» a «Por qué se retiene».
- «Nota (opcional)» o «Por qué se retiene». Hasta 500 caracteres: «La nota no puede pasar de 500 caracteres.»
- «Cancelar» y «Devolver depósito».

No hay forma de pago en este diálogo. El sistema no guarda con qué se devolvió.

Éxito: «Depósito devuelto» y debajo el monto devuelto (`$150.00`). La fila desaparece de «Garantías» aunque se haya retenido una parte. El total de la derecha baja en todo el depósito, no solo en lo devuelto, porque la renta ya no está en custodia.

Si se retiene una parte y la nota va vacía, el servidor responde y se ven las dos frases:

- En el aviso del formulario: «Si se retiene una parte del depósito, escribí por qué.»
- En el campo de la nota: «Escribí por qué se retiene una parte.»

Otros mensajes, en el monto y en el aviso:

- «No se puede devolver más que el depósito ($200.00).»
- «Esta renta no tiene depósito en custodia: ya se devolvió o no hubo.» Alguien la devolvió antes, o el depósito era cero, o ya se pasó a otra renta.
- «Esa renta no existe.»

Devolver $0.00 con nota también cierra la garantía: sale de la lista y no se puede devolver después. Hace falta la nota, porque cero es menos que el depósito.

Esta devolución no pide turno abierto. Se puede hacer con la caja cerrada.

### Cerrar caja

«Cerrar caja» abre el diálogo del mismo nombre. El texto dice: «Contá solo el efectivo. Tarjeta, transferencias y «Otro» ya quedaron informados.»

- «Esperado». Solo lectura. Es el mismo número de la tarjeta «Esperado».
- «Contado». Obligatorio. Vacío al abrir. Lo que usted contó en el cajón, con las mismas reglas de monto (hasta dos decimales, tope $99999.99, cero permitido).
- Mientras el contado es un monto válido, una línea dice cómo queda:
  - «Cuadra», en verde, si contado = esperado.
  - «Sobra $10.00», en ámbar, si sobra.
  - «Falta $5.00», en rojo, si falta.
- Si la diferencia es de $10.00 o más (sobrante o faltante), aparece una casilla: «Confirmo la diferencia de $10.00». «Cerrar caja» queda deshabilitado hasta marcarla. Con $9.99 no aparece la casilla.
- «Notas». Opcional. Hasta 500 caracteres: «La nota no puede pasar de 500 caracteres.» En blanco no se guarda nota.
- «Cancelar» borra lo escrito y cierra. «Cerrar caja» guarda.

Éxito, título «Caja cerrada»:

- Si la diferencia es cero: «El efectivo cuadra.»
- Si no: «Diferencia $10.00» cuando sobra, o «Diferencia $-5.00» cuando faltan $5.00. El aviso usa el signo menos; el sello de la tabla dice «Falta» o «Sobra» sin el signo.

Al cerrar, la pantalla vuelve al formulario de «Fondo». El turno pasa al historial.

Si el turno ya no estaba abierto: «No hay un turno abierto.»

### La cuenta, con un ejemplo

Fondo $100.00. En el turno se cobró $80.00 en efectivo, $50.00 con tarjeta, $30.00 por transferencia y $20.00 en «Otro».

- Efectivo = $80.00
- Tarjeta = $50.00
- Transferencia = $30.00
- Otro = $20.00
- Esperado = fondo + efectivo = 100.00 + 80.00 = $180.00
- Tarjeta, transferencia y «Otro» no se suman al esperado.

Si el conteo es $180.00, la diferencia es 180.00 − 180.00 = 0. Sello verde «Cuadra». Aviso «El efectivo cuadra.»

Si el conteo es $190.00, la diferencia es 190.00 − 180.00 = +10.00. Línea «Sobra $10.00», casilla «Confirmo la diferencia de $10.00», sello ámbar «Sobra $10.00», aviso «Diferencia $10.00».

Si el conteo es $175.00, la diferencia es 175.00 − 180.00 = −5.00. Línea «Falta $5.00» (no pide casilla, porque es menos de $10.00), sello rojo «Falta $5.00», aviso «Diferencia $-5.00».

Anular un efectivo de $80.00 antes de cerrar baja el efectivo a $0.00 y el esperado a $100.00. Anularlo después de cerrado no se puede: «Ese turno ya cerró: el pago no se puede anular.»

### Historial

Título «Historial», debajo del turno o del formulario de apertura. Son los turnos ya cerrados, del más reciente al más viejo, 25 por página. El turno abierto no es una fila. Cada fila abre el detalle.

Columnas: «Turno», «Fondo», «Efectivo», «Tarjeta», «Transferencia», «Otro», «Esperado», «Contado», «Diferencia», «Cobros».

«Turno» es la apertura y el cierre en hora de El Salvador, unidos por una flecha: «20 oct, 8:00 a.m. → 20 oct, 6:00 p.m.» Los montos llevan dólar y dos decimales. «Cobros» es la cantidad de pagos no anulados. No hay columna de quién abrió ni quién cerró.

El sello de «Diferencia»:

- «Cuadra», verde, diferencia cero.
- «Sobra $10.00», ámbar, contado mayor que esperado.
- «Falta $5.00», rojo, contado menor.

Sin ningún cierre: título «Todavía no hay cierres» y mensaje en blanco. Si la página no trae cierres pero en otras sí hay: «No hay cierres en esta página» y «Volvé a la página anterior para ver los cierres.» El pie habla de «turno» / «turnos» y cuenta también el turno abierto dentro del total, aunque esa fila no se liste.

### Detalle de un turno

Se abre al tocar una fila del historial. La dirección es `/rentals/cash/{id}`. El enlace de regreso dice «Caja». El título de la ventana es «Turno de caja · Elite Service». Hace falta el mismo permiso de cobrar. Sin permiso, esta dirección no muestra el texto de «no tenés permiso»: queda en blanco. Mientras carga: «Cargando el turno». Si el identificador no es un turno: «Ese turno de caja no existe.» Si falla la carga y no hay otro mensaje: «No se pudo cargar el turno.»

Encabezado «Turno de caja». El subtítulo es el mismo rango de horas del historial. A la derecha, el sello «Cuadra», «Sobra …» o «Falta …». En un turno que siguiera abierto (la lista no enlaza el abierto, pero la dirección existe), el sello sería «Abierto», neutro, y «Contado» saldría «—».

Tarjeta «Turno»:

- «Abrió» y la hora. En la renta no se escribe el nombre.
- «Cerró» y la hora, o «—» si sigue abierto. Tampoco se escribe el nombre.

Luego «Cobrado», con las mismas cuatro tarjetas y, si hubo pagos «Otro», la lista de notas. Después «Efectivo en el cajón»: «Fondo», «Esperado» y «Contado» (o «—» si no se cerró). Si hay notas, una tarjeta «Notas» con el texto tal como se escribió, respetando los saltos de línea. Al final, la misma tabla de cobros del turno, sin título propio, 25 por página.

Los totales del detalle son del turno completo. La tabla es solo la página.

### Qué pide caja abierta

Hace falta un turno abierto de renta para registrar un pago nuevo. Da igual la forma de pago: efectivo, tarjeta, transferencia u «Otro» piden el turno. Eso cubre:

- «Cobrar» en «Quién me debe» y el mismo diálogo desde la ficha de la renta.
- El cobro que se toma al entregar el carro, al recibirlo o al extender, cuando ese paso incluye un pago.

Sin turno, el diálogo de pago muestra «Sin caja abierta» y el botón «Caja». Si el rechazo llega después de pulsar guardar (entrega o extensión), el texto es «Abra la caja para cobrar.» con un enlace «Caja». El mensaje del servidor, si se muestra crudo, es «Abrí la caja para cobrar.»

No hace falta turno abierto para:

- Ver «Quién me debe» y «Garantías» (sí hace falta el permiso de cobrar).
- Devolver una garantía desde «Garantías».
- Anotar el depósito en el contrato sin registrar un pago. Ese depósito no mueve las tarjetas del turno.
- Anular un pago viejo que no quedó atado a ningún turno. Anular un pago del turno abierto sí se puede, y las tarjetas bajan enseguida. Anular un pago de un turno ya cerrado responde «Ese turno ya cerró: el pago no se puede anular.»

El diálogo «Anular pago» no está en la caja; está en la renta. Título «Anular pago». El texto es «$80.00 · Efectivo · recibió {nombre}. Deja de sumar al pagado, pero queda escrito.» Campo «Motivo», obligatorio. «Escribí por qué se anula (al menos 3 letras).» y, si pasa de 300, «No puede pasar de 300 caracteres.» Botón «Anular pago». Éxito: «Pago anulado» y el monto. Si ya estaba anulado: «Ese pago ya estaba anulado.» Si no existe: «Ese pago no existe.»

Entregar el carro, reservar o recibir sin cobrar no piden turno. En cuanto ese paso lleva un pago, sí.

### Otros errores de la caja

- «No se pudo conectar con el servidor.»
- «El servidor respondio con un error (500).» o el estado que haya llegado, cuando la respuesta no trae mensaje propio. Un fallo interno del servidor también puede decir «Internal server error».
- «No tenés permiso para hacer esto.»
- «Tu sesión no es válida. Iniciá sesión de nuevo.»

## Clientes

Los clientes de la renta son otra lista que los clientes del lavado. Un cliente no se borra: se edita, se marca «No rentar» o se deja inactivo. El documento no tiene que ser único en la base: dos fichas pueden repetir el mismo DUI. El aviso de documento repetido existe al crear el cliente dentro de una renta nueva, no en la lista ni en el CSV.

### Cómo llegar y quién lo ve

«Clientes» no es una pestaña del riel. En el espacio de renta, se abre el menú de la persona (el botón con su nombre, al pie del riel o en la barra de abajo) y se elige «Clientes». La dirección es `/rentals/customers`. El título de la ventana es «Clientes de renta · Elite Service».

Lo ve quien tiene permiso de ver clientes de renta (`renters.read`): «Ver clientes de renta». Sin ese permiso la entrada del menú no aparece. Si se abre la dirección, dice «No tenés permiso para ver los clientes de renta.» y la misma frase de pedirle el permiso a quien administra.

Crear, editar, marcar «No rentar» e importar piden además el permiso de manejar clientes (`renters.manage`): «Crear, editar, bloquear e importar clientes de renta». Quien solo puede ver, entra a la lista y a la ficha, y no ve «Nuevo cliente», «Importar CSV», «Editar» ni el interruptor «No rentar».

El enlace de regreso, en la lista y en la ficha, dice «Hoy» y vuelve al inicio de la renta.

### La lista

Encabezado «Clientes». El subtítulo cuenta a todos, sin filtros: «1 cliente de renta» o «12 clientes de renta». Mientras esa cuenta carga, el subtítulo queda en blanco.

Con permiso de manejar:

- «Importar CSV» está siempre en el encabezado.
- «Nuevo cliente» está en el encabezado cuando ya hay al menos un cliente. Si la lista está vacía y no hay filtros, el mismo botón queda en el estado vacío, no en el encabezado.

La tabla tiene, a la izquierda, el número de fila dentro de la página (1, 2, 3…, siguiendo la página). Tocar la fila abre la ficha. Columnas:

- «Nombre», en negrita.
- «Documento». El DUI o pasaporte en monoespaciado, o «—».
- «Celular». El celular; si no hay, el teléfono fijo; si no hay ninguno, «—».
- «Estado». Sello rojo «No rentar» si está bloqueado o inactivo. Un cliente al día no lleva sello.
- «Acciones», solo con permiso de manejar: «Editar». El lector de pantalla añade « a {nombre}». «Editar» abre el diálogo y no entra a la ficha.

25 clientes por página, ordenados por nombre. El pie dice «25 clientes» o «1–25 de 80 clientes», con «Anterior», «Siguiente» y «{página} de {páginas}».

Vacío, sin búsqueda ni filtros: «Todavía no hay clientes de renta» y «Cargá el primero con «Nuevo cliente» o traelos de tu Excel con «Importar CSV».» Ahí está el botón «Nuevo cliente» si usted puede manejar clientes.

Con búsqueda o filtros y cero resultados: «Nadie coincide» y «Probá con otra búsqueda o restablecé los filtros.»

Si la lista falla, se muestra el mensaje del servidor.

### Búsqueda y filtros

El campo se llama «Buscar por nombre, documento, licencia o teléfono». El placeholder es «Ana López o 01234567-8». La búsqueda espera un instante (un cuarto de segundo) y vuelve a la página 1. No distingue mayúsculas.

Coincide si:

- todas las palabras están en el nombre (pueden ir en cualquier orden), o
- el texto completo está dentro del documento, de la licencia, del celular o del teléfono, o
- hay 3 dígitos o más: esos dígitos están en el documento, el celular o el teléfono, ignorando guiones y espacios. La licencia no entra en esta búsqueda por dígitos solos. Con 1 o 2 dígitos no se busca así.

El servidor acepta hasta 60 caracteres en la búsqueda. La pantalla no avisa antes de pasar ese largo.

El botón «Filtros» abre «Filtros avanzados», con «Restablecer». Si hay alguno distinto de «todos», el botón muestra la cantidad.

- «Actividad». Arranca en «Activos e inactivos». También «Activos» e «Inactivos».
- «No rentar». Arranca en «Con y sin bloqueo». También «No rentar» (los bloqueados) y «Se les renta» (los que no están bloqueados).

«Inactivos» mira el alta, no el bloqueo. «No rentar» mira el bloqueo. En la pantalla, las dos cosas pintan el mismo sello rojo, pero el filtro no las mezcla: un cliente inactivo y no bloqueado sale en «Inactivos» y en «Se les renta».

Cambiar la búsqueda o un filtro vuelve a la página 1.

### Nuevo cliente y Editar, desde la lista

«Nuevo cliente» abre el diálogo «Nuevo cliente». «Editar», en la lista o en la ficha, abre «Editar» con los datos guardados. «Cancelar» cierra sin guardar. En el alta el botón es «Crear»; en la edición, «Guardar».

Éxito: «Cliente creado» o «Cliente guardado», y debajo el nombre. El diálogo se cierra y la lista se actualiza.

Arriba, siempre visibles:

- «Nombre». Obligatorio. No puede quedar en blanco: «Escribí el nombre.» Tope 120: «El nombre no puede pasar de 120 caracteres.» En el alta no viene lleno.
- «DUI o pasaporte». En este diálogo es un texto libre, sin máscara y sin selector DUI/pasaporte. En el alta es obligatorio: «Escribí el DUI o el pasaporte.» En la edición se puede dejar vacío (guardar vacío borra el documento). Tope 30: «El documento no puede pasar de 30 caracteres.»
- «Celular». Texto libre, sin bandera ni prefijo de país. En el alta es obligatorio: «Escribí el celular.» En la edición se puede borrar. Tope 30: «El celular no puede pasar de 30 caracteres.»
- «Licencia». Opcional. Tope 30: «La licencia no puede pasar de 30 caracteres.»
- «Vence». Opcional. Se escribe con máscara `dd/mm/aaaa` (el placeholder es «dd/mm/aaaa»; al teclear, los dígitos se parten en día, mes y año). Vacío se guarda como sin fecha. Una fecha imposible o a medias: «Escribí la fecha como dd/mm/aaaa.» En la edición, una fecha guardada vuelve como `05/03/2026`.

El país del celular y la máscara del DUI no están en este diálogo. Están en el paso Cliente de «Nueva renta», más abajo.

### Más datos

El bloque se llama «Más datos». Viene cerrado. Al abrirlo:

- «Nacimiento». Opcional. La misma máscara `dd/mm/aaaa` y el mismo mensaje si la fecha no es un día real. En la ficha se muestra como `05/03/1990 · 36 años`.
- «País». Opcional. En un cliente nuevo viene escrito «El Salvador». Tope 60: «El país no puede pasar de 60 caracteres.» Borrarlo guarda sin país. No elige el prefijo del celular.
- «Teléfono». Opcional. El fijo. Tope 30: «El teléfono no puede pasar de 30 caracteres.»
- «Correo». Opcional. Vacío no guarda correo. Si hay texto y no es un correo: «Escribí un correo válido.» Se guarda en minúsculas.
- «Dirección». Opcional. Tope 300: «La dirección no puede pasar de 300 caracteres.»
- «Ocupación». Opcional. Tope 80: «La ocupación no puede pasar de 80 caracteres.»
- «Trabajo». Opcional. Tope 120: «El lugar de trabajo no puede pasar de 120 caracteres.»
- «Representante». Opcional. Tope 120: «El representante no puede pasar de 120 caracteres.»
- «Dirección permanente». Opcional. Tope 300: «La dirección permanente no puede pasar de 300 caracteres.»
- «Teléfono permanente». Opcional. Tope 30: «El teléfono permanente no puede pasar de 30 caracteres.»
- «No rentar». Interruptor. En un cliente nuevo arranca apagado. Al prenderlo aparece «Motivo».
- «Motivo». Obligatorio solo con «No rentar» prendido: «Escribí por qué no se le renta.» Tope 300: «El motivo no puede pasar de 300 caracteres.» Apagar el interruptor borra el motivo.
- «Notas». Opcional. Tope 1000: «La nota no puede pasar de 1000 caracteres.»

Prender «No rentar» en este diálogo bloquea y desactiva a la vez. Apagarlo lo deja activo y sin bloqueo. No hay un segundo interruptor de «activo».

### No rentar en la ficha

Con permiso de manejar, arriba de los datos hay otra fila «No rentar», aparte del diálogo.

- Apagarlo, si estaba prendido, guarda enseguida: activo, sin bloqueo y sin motivo. No hay aviso de éxito; la ficha se actualiza.
- Prenderlo con el motivo ya escrito guarda enseguida.
- Prenderlo con el motivo vacío no guarda hasta salir del campo. Si se sale con el motivo vacío: «Escribí por qué no se le renta.»
- Al salir del campo con un motivo distinto del guardado, guarda de nuevo.

El motivo viaja con el bloqueo. Quitar «No rentar» borra el motivo en el servidor aunque usted lo hubiera escrito.

Un cliente marcado así no se puede elegir para una renta nueva. El servidor, al intentar crearla, dice «{nombre} está marcado «No rentar»: {motivo}» o, si no hay motivo, «{nombre} está marcado «No rentar».» La pantalla de la renta nueva, además, no deja seguir el paso Cliente: el mensaje al intentar saltar el paso es «No rentar». Eso cubre bloqueado e inactivo. El servidor, en el alta de la renta, mira el bloqueo. La pantalla trata igual al inactivo.

### Importar CSV

«Importar CSV» abre «Importar clientes». El texto: «Guardá tu Excel como CSV y subilo, o pegá el texto. La primera fila son los encabezados; sin nombre, la fila no entra.»

- «Elegir archivo CSV». El selector solo ofrece CSV (`Archivo CSV` es el nombre accesible). Al elegir un archivo, su texto llena el cuadro.
- Al lado: «o pegalo abajo».
- «Contenido del CSV». Se puede pegar. El placeholder es:

```
Nombre;DUI;Celular
Ana López;01234567-8;7777-8888
```

El separador se deduce de la primera línea: vale punto y coma, coma o tabulador, el que más aparezca. Excel en español suele usar punto y coma. Se respetan las comillas (un nombre «Pérez, Juan» entre comillas sigue siendo una celda) y un salto de línea dentro de comillas. Se ignora la marca que a veces pone Excel al principio del archivo. Una fila totalmente vacía no cuenta.

Cuando hay filas, se lee «{entran} de {total} filas entran.» y «Columnas reconocidas: {nombres}.» Si ninguna columna se reconoce: «Columnas reconocidas: ninguna.»

La vista previa tiene «Nombre», «Documento» y «Resultado». Una fila válida lleva el sello verde «Entra». Una que no, el motivo en rojo y «—» en el nombre si no se pudo leer. El número de la izquierda es la fila del archivo: la 1 es el encabezado, así que la primera de datos es la 2. La vista muestra de 8 en 8.

Tope: 2000 filas de datos. Si hay más: «Son más de 2000 filas: partí el archivo en dos.» El botón de importar queda deshabilitado.

El botón dice «Importar 1 cliente» o «Importar {N} clientes». Está deshabilitado si ninguna fila entra o si hay más de 2000. «Cancelar» cierra.

Al terminar, el aviso es «Importación lista» y «1 cliente creado» o «{N} clientes creados». El diálogo pasa al resultado: la misma frase y, si hubo omisiones, «, 1 fila omitida.» o «, {N} filas omitidas.» Si no se omitió ninguna, cierra la frase con punto. La tabla de omisiones se titula «Por qué no entró». El botón final es «Listo».

Motivos de una fila omitida, tal cual:

- «Sin nombre.»
- «La fecha «{texto}» no se entiende.» Una fecha de nacimiento o de vencimiento que no se pudo leer. Se omite la fila entera, no solo la fecha.
- Cualquier mensaje del alta, si el nombre o un campo se pasa del tope o el correo no vale. Por ejemplo «Escribí el nombre.», «El nombre no puede pasar de 120 caracteres.», «Escribí un correo válido.»
- «Fila inválida.» si no hubo un mensaje más claro.

Fechas que sí se leen, con el día primero: `2026-03-05`, `05/03/2026` y `5-3-2026`. Quedan guardadas como `2026-03-05`. `31/02/2026` no se entiende.

Columnas que se reconocen (sin importar mayúsculas, tildes ni signos; «Fecha de nacimiento» vale igual que «fechanacimiento»):

| Dato                       | Encabezados aceptados                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| Nombre                     | Nombre, Nombres, Nombre completo, Cliente, fullname, name                                  |
| Documento                  | DUI, Documento, No documento, Pasaporte, documentid, NIT                                   |
| Licencia                   | Licencia, No licencia, Número licencia, Número de licencia, license                        |
| Vencimiento de la licencia | Vencimiento licencia, Vencimiento de licencia, Licencia vence, Vence licencia, Vencimiento |
| Celular                    | Celular, Móvil, Whatsapp, mobile, cel                                                      |
| Teléfono                   | Teléfono, Tel, phone, Teléfono fijo                                                        |
| Correo                     | email, Correo, Correo electrónico, mail, email1                                            |
| Dirección                  | Dirección, Domicilio, address                                                              |
| Nacimiento                 | Nacimiento, Fecha nacimiento, Fecha de nacimiento, birthdate                               |
| País                       | País, Nacionalidad, country                                                                |
| Notas                      | Notas, Nota, Observaciones, Comentarios                                                    |

Si el mismo dato viene en dos columnas, se queda la primera que tenga texto. Una columna con otro nombre se ignora. El CSV no marca «No rentar», no trae ocupación, trabajo, representante ni teléfonos permanentes, y no avisa si el documento ya existe: crea otra ficha.

Si el envío falla, el aviso del formulario muestra el mensaje. «El archivo no trae filas.» y «No más de 2000 filas por importación.» son los del servidor; la pantalla ya impide esos dos casos con el botón apagado y el texto de las 2000 filas.

### La ficha

Se abre al tocar la fila. Dirección `/rentals/customers/{id}`. Título de la ventana: «Cliente de renta · Elite Service». Mismo permiso de ver. Sin permiso: «No tenés permiso para ver el cliente de renta.» Mientras carga: «Cargando el cliente». Si no existe o la carga falla sin otro texto: «No se pudo cargar el cliente.» El servidor dice «Ese cliente no existe.»

El encabezado es el nombre. Debajo, el documento en monoespaciado, o «Sin documento», y el sello «No rentar» si corresponde. Con permiso de manejar, el botón «Editar» abre el mismo diálogo de la lista.

Si hay avisos, van en una tarjeta antes de los datos. El de «No rentar» va en rojo. Los otros, en ámbar.

- Bloqueado o inactivo, con motivo: «No rentar: {motivo}».
- Bloqueado o inactivo, sin motivo: «No rentar.»
- Licencia con fecha anterior a hoy: «La licencia está vencida.»
- Con fecha de nacimiento, si la edad cumplida es menor que la edad mínima de los ajustes: «Tiene {edad} años: la edad mínima es {mínima}.»

La edad cuenta los años ya cumplidos a hoy. Si el cumpleaños todavía no llega este año, resta uno. Ejemplo: nacido el 20/10/2006, el 19/10/2026 tiene 19; el 20/10/2026 tiene 20.

La edad mínima sale de «Ajustes de renta». El valor de fábrica es 21. El ajuste acepta de 16 a 99. Si los ajustes no se pueden leer, la ficha usa 21. Hace falta poder ver rentas, ver la flota o editar los ajustes para preguntar ese número; si no, también se usa 21.

En la ficha, la licencia solo avisa cuando ya venció (la fecha es anterior a hoy). No avisa «por vencer». Ese aviso de los 30 días está en el paso Cliente de una renta nueva.

La licencia que vence hoy no se trata como vencida: el día de vencimiento todavía cuenta.

Estos avisos no bloquean el botón de la ficha. Quien frena una renta nueva es el paso Cliente (bloqueo, inactivo o licencia ya vencida) y, en el servidor, el bloqueo.

Tarjetas, con «—» donde no hay dato:

- «Datos personales»: «DUI o pasaporte», «Nacimiento» (`05/03/1990 · 36 años`), «País», «Ocupación», «Lugar de trabajo», «Representante».
- «Licencia»: «Número», «Vence» (`dd/mm/aaaa`).
- «Contacto»: «Celular», «Teléfono», «Correo», «Dirección», «Dirección permanente», «Teléfono permanente».
- «Notas», solo si hay notas, con los saltos de línea guardados.

### Historial de rentas

Debajo de los datos, título «Historial de rentas». Solo se dibuja con permiso de ver rentas (`rentals.read`). Sin ese permiso la ficha no muestra el historial ni un mensaje en su lugar.

Con permiso de crear rentas (`rentals.manage`), el botón «Nueva renta» abre una renta nueva ya con este cliente. Si todavía no hay rentas, el botón está en el estado vacío. Si ya hay, está a la derecha del título.

Columnas: «Carro» (placa, si tiene, y el nombre del carro), «Sale / regresa», «Saldo», «Estado». La referencia de la fila es el número de contrato. Tocar la fila abre la renta.

«Sale» y «Regresa» usan la salida y el regreso reales si ya ocurrieron; si no, los previstos. El texto es día de semana corto, día, mes corto y hora de El Salvador, por ejemplo «vie 12 oct, 10:00 a. m.»

El saldo en rojo y negrita es un saldo a favor del negocio (mayor que cero) en una renta que no está cancelada. Cero, saldo a favor del cliente y una cancelada van en gris. El monto es `$60.00`.

Sellos de estado:

- «Reservada», azul.
- «En la calle», en el color de énfasis del sistema.
- «Atrasada», rojo. Es una renta en la calle cuya hora de regreso ya pasó.
- «Devuelta», verde.
- «Cancelada», neutro.

Vacío: «Sin rentas todavía» y «Cuando le rentes un carro, aparece acá con su estado y su saldo.» 10 rentas por página. El pie habla de «renta» / «rentas». El conteo de la ficha no incluye las canceladas en las cifras que usa la renta nueva; esta tabla sí lista lo que devuelve el historial del cliente, página a página.

### Alta y actualización dentro de Nueva renta

El diálogo «Nuevo cliente» de la lista no enmascara el DUI ni elige país del celular. Eso está en el paso «Cliente» de «Nueva renta» (pestaña «Rentas», o el botón «Nueva renta» de esta ficha). Hace falta permiso de manejar clientes para crear o actualizar ahí. Quien solo puede ver rentas busca y elige, y no ve «Cliente nuevo».

#### Buscar y elegir

Campo «Buscar cliente», placeholder «Buscar por nombre, DUI o teléfono». Sin texto, el rótulo es «Recientes» y se listan hasta 5 clientes, la renta más reciente primero (la última salida ya ocurrida). Quien nunca se llevó un carro va al final, por nombre. Con texto, el rótulo es «1 resultado» o «{N} resultados», hasta 30. Si hay resultados y todavía no eligió: «Elija un cliente para seguir». Mientras busca: «Buscando clientes». Si falla, el mensaje del servidor.

Sin nadie y sin texto: «Sin clientes» y, si puede manejar clientes, «Cliente nuevo». Con texto y sin coincidencias: «Nadie coincide con «{texto}».» y el botón «Crear cliente con «{texto}»». Si lo escrito son solo dígitos y son 8, ese botón abre el alta con el celular ya enmascarado (`71234567` → `7123-4567`). Si son otros dígitos, los pone en el DUI. Si hay letras, las pone en el nombre.

Cada tarjeta muestra iniciales, nombre, «DUI» o «Pasaporte» con el número, «Tel.» y el teléfono, y una línea de historia: «Cliente nuevo», «3 rentas» o «3 rentas, la última hace 2 semanas». Esa línea cuenta rentas no canceladas. Los plazos son días civiles: «hoy», «ayer», «hace 4 días» (menos de 7), «hace 2 semanas» (menos de 30), «hace 3 meses» (menos de 365), «hace más de un año».

El sello de la tarjeta, a la derecha:

- «No rentar», rojo, si está bloqueado o inactivo. En ese caso no se muestra el sello de la licencia.
- «Licencia vigente», verde.
- «Licencia vence 20/11», ámbar. Es el día y el mes, sin año. Sale cuando faltan de 0 a 30 días, inclusive el día en que vence.
- «Licencia vencida», rojo, si la fecha es anterior a hoy.
- Sin fecha de licencia no hay sello de licencia.

Tocar la tarjeta la elige (borde marcado y la marca «Elegido»). Tocarla otra vez la suelta. Elegir no pasa solo al paso siguiente.

Con alguien elegido, los avisos:

- El de no rentar y el de edad, con los mismos textos de la ficha. Edad en ámbar; no rentar en rojo.
- Licencia vencida, en rojo: «La licencia de {primer nombre} venció el {dd/mm/aaaa}. Pida la licencia nueva para seguir.» Si puede manejar clientes, el botón «Actualizar licencia» abre el formulario con los datos de esa persona.
- Por vencer (0 a 30 días): «La licencia de {primer nombre} vence el {dd/mm/aaaa}. Puede rentar, pero recuérdele renovarla.» No frena.

«Siguiente» del paso Cliente queda deshabilitado si no hay cliente, si está bloqueado o inactivo, o si la licencia está vencida. Al intentar saltar el paso por la barra, el mensaje es «Elija un cliente», «No rentar» o «La licencia está vencida». Ser menor que la edad mínima avisa y no deshabilita «Siguiente».

#### Cliente nuevo y Actualizar cliente

El título es «Cliente nuevo» o «Actualizar cliente». Arriba, un botón largo: «¿Ya es cliente? Búsquelo por nombre, DUI o teléfono» y, en pantalla ancha, «Volver a buscar». «Atrás», al pie, vuelve a la búsqueda. Si estaba creando, la búsqueda recupera el nombre, o si no el documento, o si no el celular.

Campos:

- «Nombre completo». Placeholder «Como aparece en el documento». Para poder guardar hacen falta al menos 3 letras. Si falta, la lista de pendientes dice «nombre».
- «Documento». A la izquierda, el tipo «DUI» o «Pasaporte» (el botón se anuncia «Tipo: DUI» o «Tipo: Pasaporte»).
  - DUI: solo dígitos, máscara `00000000-0`, placeholder «00000000-0», 9 dígitos. `012345678` queda `01234567-8`. Lo que pase de 9 dígitos se corta.
  - Pasaporte: se guarda en mayúsculas, placeholder «Número de pasaporte». Para darlo por completo hacen falta al menos 5 caracteres. El tope del alta sigue siendo 30.
- «Celular». A la izquierda, bandera y prefijo. El botón se anuncia «País: El Salvador +503» (o el país elegido). El panel busca con «Buscar país», placeholder «País, sigla o código». Se busca por nombre (sin acentos), sigla (`mx`) o código (`+52` o `52`). Sin coincidencias: «Sin coincidencias». Arriba, fijos: El Salvador (+503), Guatemala (+502), Honduras (+504) y Estados Unidos (+1). El resto va por nombre en español.
  - El Salvador es el de casa. El número se guarda sin prefijo (`7123-4567`).
  - Otro país se guarda con prefijo y un espacio: `+1 (713) 555-0142`.
  - Cambiar de país borra el número.
  - Máscaras conocidas, y el placeholder es la máscara: El Salvador, Guatemala, Honduras, Nicaragua, Costa Rica y Panamá `0000-0000` (8 dígitos); Belice `000-0000`; México `00 0000 0000`; Colombia `000 000 0000`; España `000 00 00 00`; cualquier +1 `(000) 000-0000` (10 dígitos).
  - Un país sin máscara acepta solo dígitos: mínimo 6 y máximo 15 menos los dígitos del prefijo.
  - El celular está completo cuando tiene justo los dígitos de su máscara, o queda dentro de ese rango si no hay máscara.
- «Número de licencia». Si el documento es DUI, la casilla «Es el mismo número del DUI» copia el DUI a la licencia y deshabilita el campo. Con pasaporte la casilla no está.
- «La licencia vence el». Calendario, no la máscara `dd/mm/aaaa` de la lista.

Bajo la fecha:

- «Vigente», en verde, si faltan más de 30 días.
- «Vence en 1 día. Recuérdele renovarla.» o «Vence en {N} días. Recuérdele renovarla.», en ámbar, de 0 a 30 días. El día del vencimiento dice «Vence en 0 días.»
- En el campo, si ya venció: «Ya venció. No se puede rentar con esta licencia.»

Si falta algo: «Para guardar falta: nombre, documento, celular, licencia, vencimiento.» Las palabras salen solo las que faltan, en ese orden. El botón «Guardar y seguir» permanece deshabilitado hasta que no falte nada, la licencia no esté vencida y el documento no esté repetido. También espera a que termine la revisión del documento.

Avisos en vivo:

- Nombre parecido (solo al crear, con 3 letras o más, y solo si el documento no está repetido): «¿Es {nombre}? Ya está registrado.» Botón «Usar este cliente». No impide guardar; es una pregunta.
- Mismo documento en otra ficha (los 9 dígitos del DUI, o el pasaporte sin espacios ni guiones): «Este documento ya es de {nombre}.» Botón «Usar este cliente». Esto sí impide «Guardar y seguir».

«Usar este cliente» lo elige y cierra el formulario. «Guardar y seguir» crea o actualiza, avisa «Cliente guardado» con el nombre, lo deja elegido y pasa al paso del contrato. Al actualizar solo se envían nombre, documento, celular, licencia y vencimiento. No se toca «No rentar» ni el resto de la ficha.

Si el servidor rechaza el guardado, el mensaje queda en el paso (por ejemplo «Escribí el nombre.» o un tope de caracteres).

---

## Carros

La pestaña «Carros» está en el espacio Renta, en el riel (en el teléfono, en la barra de abajo). La ruta es la lista de la flota. La ve quien tiene permiso de ver la flota (`fleet.read`). Sin ese permiso la pantalla dice «No tenés permiso para ver la flota.» y, debajo, «Si debería ser tuyo, pedile el permiso a quien administra. El riel a la izquierda (o abajo) te saca de acá.»

Arriba a la derecha, según el permiso:

- «Mandar al taller» y un número. Solo si en la página cargada hay al menos un carro con un aviso de servicio (aceite, frenos, etc.). Un aviso solo de seguro o de tarjeta no lo enciende. Lo abre quien puede ver la flota. Abre el diálogo «Lista para el taller», descrito más abajo. El otro botón, «Mandar a taller» (sin «al»), está en la ficha y cambia el estado del carro.
- «¿Cuánto dejó?». Solo con permiso de rentabilidad (`rentals.reports`). Abre el reporte de toda la flota. El regreso de esa pantalla vuelve a «Carros».
- «Nuevo carro». Solo con permiso de crear y editar carros (`fleet.manage`).

### La lista

El buscador se llama «Buscar carro» y el texto de ayuda dentro del campo es «Placa, marca o modelo». Filtra lo que ya está cargado en esa página: marca y modelo juntos, o la placa sin importar guiones ni espacios. No busca por color. No manda la búsqueda al servidor.

Los chips, en el grupo «Filtrar por estado»:

- «Todos». Cuenta todos los carros que no están retirados, aunque haya más de una página. Al tocarlo se ven los de la página actual.
- Un chip por cada estado del día que aparezca en la página cargada, en este orden, y solo si hay alguno: «Atrasado», «En renta», «Reservado», «Libre», «Taller». El número del chip es cuántos de ese estado hay en esa página, no en toda la flota. El filtro también se aplica solo a esa página.
- «Retirados», separado, solo si existe al menos un carro retirado. El número es el total de retirados. Al tocarlo la dirección lleva `?status=RETIRED` y la lista pasa a ser solo esos carros, con su propia paginación.

El orden de las tarjetas es el mismo: primero atrasados, luego en renta, reservados, libres y al final taller. Dentro de cada estado se conserva el orden en que llegaron.

Si hay más de 100 carros en la lista (activos, o retirados cuando ese chip está puesto), aparece el pie: «1–100 de 140 carros», o «140 carros» si caben todos, y los botones «Anterior» y «Siguiente» con «1 de 2». Los chips de estado y el buscador no cruzan de página: un «Libre» en la página 2 solo esconde los que no están libres en esa página.

Mientras carga hay tres recuadros vacíos. Si la carga falla, el título es «No se pudo cargar» y debajo el mensaje del servidor. Si la página no trae carros, «Nada todavía». Si la página trae carros pero el chip o el buscador no dejan ninguno, «Ningún carro coincide».

### La tarjeta

Toda la tarjeta abre la ficha de ese carro. Arriba, un dibujo del carro pintado con el color escrito. Si el navegador no puede dibujarlo, queda el ícono de un carro. En la esquina, el sello del día (un carro retirado no lo lleva):

| Sello       | Color          | Cuándo                                                                                              |
| ----------- | -------------- | --------------------------------------------------------------------------------------------------- |
| «Libre»     | verde          | Activo, sin renta en curso y sin reserva que salga hoy o que ya debió salir.                        |
| «En renta»  | azul de lavado | Hay una renta en curso y la hora de regreso todavía no pasó.                                        |
| «Atrasado»  | rojo           | La renta en curso ya debió volver, o hay una reserva cuya salida civil ya pasó y el carro no salió. |
| «Reservado» | azul           | Hay una reserva cuya salida es hoy (día civil de El Salvador).                                      |
| «Taller»    | ámbar          | El carro está en estado «En taller».                                                                |

Debajo, el nombre en cursiva: marca, modelo y año si hay año («Kia Rio 2022»). A la derecha, la placa en una pastilla, o «Sin placa».

Si hay una renta que define el día, o el carro está libre pero tiene una reserva futura, una línea dice qué pasa. La hora va en negrita. Si quien mira también puede ver rentas (`rentals.read`), al final va « · » y el nombre del cliente. Sin ese permiso el nombre no viaja y la línea no lo muestra.

- Renta en curso, el regreso es después: «Vuelve» y «hoy 5:00 p.m.», «mañana 9:00 a.m.», «el viernes» (si faltan de 2 a 6 días) o «el 12 oct» (si falta más).
- Renta en curso ya vencida: «Debió volver» y «hoy a las 5:00 p.m.», «ayer» o «hace 3 días».
- Reserva que todavía no sale: «Sale» con las mismas formas de futuro.
- Reserva que ya debió salir: «Debió salir» con las mismas formas de pasado.
- Libre sin reserva futura, o en taller: no hay línea. El taller no guarda motivo ni fecha de regreso.

Los avisos van debajo, en el orden vencido primero. Texto rojo y triángulo si ya venció; texto ámbar si está próximo. El de papeles lleva un ícono de documento; el de servicio próximo, una llave. El texto lo arma el servidor. Ejemplos, con el aviso de kilómetros en 500 y el de días en 7 (los valores de fábrica; se cambian en Ajustes, pestaña «Servicio»):

- «Se pasó: iba a los 45.000 y va en 45.300: Cambio de aceite y filtro» (vencido por kilómetros).
- «Le toca a los 45.000 km: Cambio de aceite y filtro» (próximo por kilómetros).
- «Se pasó: iba el 12 oct: Revisión general en taller» (vencido por fecha).
- «Le toca el 20 oct: Revisión general en taller» (próximo por fecha).
- «Seguro venció hace 2 días», «Seguro vence hoy», «Seguro vence en 1 día», «Seguro vence en 3 días». Igual con «Tarjeta de circulación».

Si la tarea mide kilómetros y días, manda la medida que está más apretada. Vencido por kilómetros gana sobre vencido por días. Un servicio está próximo cuando faltan esos kilómetros o menos, o esos días o menos. El umbral es el de Ajustes, no un número fijo de la pantalla.

Al pie, la tarifa diaria tal como está guardada, por ejemplo «$35.00» y «/día».

### «Nuevo carro»

Lo abre «Nuevo carro». Título «Nuevo carro». El texto de ayuda: «Con esto ya se puede rentar. Tarifas por semana, compra, seguro y vencimientos se llenan en la ficha.» Botones «Cancelar» y «Crear carro». Al guardar bien, el aviso es «Carro creado» y el nombre del carro, y la pantalla pasa a su ficha. Nace activo, sin financiamiento, con kilometraje libre y sin costos.

Campos:

- «Marca». Obligatorio. Ejemplo de relleno «Kia». Vacío: «Escribí la marca.» Más de 40 caracteres: «No puede pasar de 40 caracteres.»
- «Modelo». Obligatorio. Ejemplo «Rio». Vacío: «Escribí el modelo.» Más de 60: «No puede pasar de 60 caracteres.»
- «Placa (opcional)». Ejemplo «P123-456». Mientras se escribe se pone en mayúsculas, y si empieza con número se le antepone P. Hasta dos letras y seis caracteres; a partir del cuarto del cuerpo aparece un guion. El campo no deja pasar de 10 caracteres. Vacía se guarda como sin placa, y dos carros sin placa conviven. Si se escribe algo, menos de 2 caracteres: «Escribí la placa.» Más de 15: «La placa no puede pasar de 15 caracteres.» Si ya hay otro carro de la flota con esa misma placa (espacios no cuentan; el guion sí forma parte de lo guardado), el campo y el aviso general dicen «Ya hay un carro de la flota con la placa P123-456.» (con la placa que se mandó).
- «Año». Opcional. Ejemplo «2022». Vacío queda sin año. Tiene que ser un entero de 1950 a 2100. «Escribí un número.» «Tiene que ser un número entero.» «No puede ser menor que 1950.» «No puede pasar de 2100.»
- «Color». Opcional. Ejemplo «Gris». Más de 30: «El color no puede pasar de 30 caracteres.»
- «Tipo de vehículo». Obligatorio. Arranca en «Sedán». Opciones: «Sedán», «Camioneta», «Pick up». Si faltara: «Elegí el tipo de carro.»
- «Tarifa diaria ($)». Obligatoria. Ejemplo «0.00». Acepta coma o punto y hasta dos decimales. Se guarda con dos decimales. Cero es un monto válido. Vacío o ilegible: «Escribí un monto válido, con hasta dos decimales.» Por encima de 99999.99: «El monto no puede pasar de $99999.99.»
- «Kilometraje al recibirlo». Opcional. Ejemplo «48000». Solo entran dígitos, hasta 7. Vacío se guarda como 0. La ayuda dice: «Después lo actualizan solas la entrega y la recepción.» Si no es un entero: «Tiene que ser un número entero.» «No puede ser menor que 0.» «No puede pasar de 2000000.»

Un error que no cae en un campo se muestra en el aviso rojo del formulario, con el mensaje del servidor. Sin permiso: «No tenés permiso para hacer esto.»

### La ficha

Se entra tocando la tarjeta. El regreso dice «Carros». El título es el nombre del carro. Debajo, la placa o «Sin placa», el sello del día y, si el carro está retirado, el sello «Retirado» en gris. El sello de inventario «En taller» no se dibuja: en ese estado el sello del día ya dice «Taller». Los mismos avisos de la tarjeta se repiten aquí.

Botones de la cabecera:

- «Multa», solo con permiso de cobrar (`rentals.charge`). Ver más abajo.
- Si hay permiso de editar la flota (`fleet.manage`), la acción rápida y «Cambiar estado…». Sin ese permiso no se cambia el estado ni se editan las tarjetas.

Si el carro no carga: «No se pudo cargar el carro.» o el mensaje del servidor. Mientras carga: «Cargando el carro».

Pestañas, en «Ficha del carro»:

- «Ficha». Siempre.
- «Servicio y gastos». Siempre, con el mismo permiso de ver la flota. Sin él: «No tenés permiso para ver el servicio del carro.»
- «¿Cuánto dejó?». Solo con permiso de rentabilidad. Sin él la pestaña no está. Si se abre la ruta igual: «No tenés permiso para ver cuánto dejó el carro.»

### Estados del carro y del día

Hay dos cosas distintas.

El estado de inventario lo cambia una persona. Tres valores:

- «Activo». Ayuda: «Se puede rentar y aparece en «¿Qué hay libre?.» El sello del día puede ser libre, en renta, reservado o atrasado.
- «En taller». Ayuda: «No se ofrece mientras esté en el taller.» El sello del día pasa a «Taller» y desaparece la línea de «Vuelve» o «Sale», aunque tuviera una renta. El sistema no pide que la renta esté cerrada antes de mandarlo.
- «Retirado». Ayuda: «Sale de la flota. Su historia y sus reportes se quedan.» No tiene sello del día. Sale de «Todos» y entra en «Retirados». No se borra.

La acción rápida, de un toque, sin diálogo:

- Desde activo: «Mandar a taller». Pasa a «En taller».
- Desde taller: «Activar». Pasa a «Activo».
- Desde retirado: «Volver a la flota». Pasa a «Activo».

Al terminar, el aviso es «Estado cambiado» y el nombre del estado nuevo: «En taller», «Activo» o «Retirado». Si falla, el mensaje queda en rojo debajo de los botones.

«Cambiar estado…» abre «Cambiar estado» con el nombre del carro. Tres botones, el actual marcado con «Ahora». Tocarlo otra vez cierra el diálogo. «Cancelar» cierra. Elegir «Retirado» no lo retira todavía: abre «¿Retirar este carro?» con el texto «Deja de ofrecerse en rentas nuevas. Sus rentas, gastos y reportes se quedan, y se puede volver a la flota cuando quieras.» Botones «Cancelar» y «Retirar de la flota».

El estado del día no se elige. Lo calcula el sistema para un carro que no está retirado, en este orden: si está en taller, «Taller»; si tiene una renta en curso ya vencida, «Atrasado»; si tiene una renta en curso a tiempo, «En renta»; si tiene una reserva cuya fecha de salida ya pasó, «Atrasado»; si tiene una reserva que sale hoy, «Reservado»; si no, «Libre». Una reserva para otro día deja el carro «Libre» y agrega la línea «Sale …».

### Tarjetas de «Ficha»

Cada tarjeta tiene «Editar» solo con permiso de editar la flota. «Compra» y «Gasto fijo al mes», además, piden permiso de rentabilidad: sin él no hay «Editar» y en su lugar un candado y el texto «Solo lo ve quien tiene permiso de rentabilidad.» Quien intente guardar costos sin ese permiso recibe «Los costos del carro solo los cambia quien tiene permiso de rentabilidad.»

Cada «Editar» abre un diálogo con el título de la tarjeta, el nombre del carro, «Cancelar» y «Guardar». Al guardar: aviso «Guardado» y el título de la tarjeta. El envío lleva solo los campos de esa tarjeta. Las fechas se eligen en el calendario; si una fecha escrita no es un día real, «Escribí la fecha como dd/mm/aaaa.» Los montos aceptan coma o punto, hasta dos decimales, tope «El monto no puede pasar de $99999.99.», y vacío significa borrar el dato (queda «—» o «Sin dato», según la fila). Un entero ilegible: «Escribí un número.» «Tiene que ser un número entero.»

#### «Precio de renta»

Filas:

- «De 1 a 6 días»: la tarifa diaria y «/día». Siempre hay monto.
- «De 7 a 29 días»: el monto propio y «/día», o, si está vacío o en cero, el texto tenue «Igual».
- «30 días o más»: el monto propio, o «Igual que la de 7+» si no hay mensual y sí hay tarifa de 7 días mayor que cero, o «Igual» si tampoco hay esa.
- «Km incluidos»: «Sin límite» si no hay tope o el tope es 0. Si hay tope, el número, «km» y «/día», y debajo «Cada km de más: $0.15» (el precio guardado).

Al cobrar una renta el sistema usa una sola tarifa por día: desde 30 días la de «30 días o más» si es mayor que cero; si no, desde 7 días la de «De 7 a 29 días» si es mayor que cero; si no, la diaria. Una tarifa en cero se salta igual que una vacía. Ejemplo: diaria $35.00, de 7 días $30.00, de 30 días vacía. Una renta de 6 días sale a $35.00 por día; una de 10 días, a $30.00; una de 40 días, también a $30.00.

En el diálogo:

- «Tarifa diaria ($)». Obligatoria, mismas reglas de monto. Si quien edita ve costos y el carro tiene costo mensual, debajo aparece una de estas frases. Con tarifa $35.00 y costo mensual $120.00 (la cuenta de más abajo): «A $35.00 hay que rentarlo 4 días al mes para cubrir $120.00.» El 4 sale de 120 ÷ 35 = 3.4, redondeado hacia arriba, con mínimo 1. Sin tarifa válida, o si la división no da días: «El carro cuesta $120.00 al mes.» Sin costos, la frase no aparece.
- «Por día, 7+ días ($)». Opcional. El texto de ayuda del campo vacío es «Igual que la diaria».
- «Por día, 30+ días ($)». Opcional. Si la de 7 días tiene monto, el texto de ayuda es «Igual que la de 7+»; si no, «Igual que la diaria».
- Interruptor «Km limitado». Ayuda: «Si está apagado, el carro sale con km libre.» Apagado borra el tope y el precio del kilómetro extra.
- Con el interruptor encendido: «Km libres por día» (ejemplo «200», entero de 0 a 10000; «No puede ser menor que 0.» «No puede pasar de 10000.») y «Precio por km adicional ($)».

#### «Identificación del vehículo»

La marca y el modelo no se repiten: ya están en el título. Filas: «Placa» (pastilla o «Sin placa»), «Tipo», «Año» («Sin dato» si no hay), «Color» («Sin dato» si no hay), «Kilometraje» con el número y «km». El kilometraje no se edita aquí.

El diálogo repite marca, modelo, placa, año, color y tipo, con las mismas reglas del alta. Debajo, solo lectura: el kilometraje y «· lo actualizan la entrega y la recepción». Mandar un kilometraje en una corrección responde «El kilometraje lo actualizan la entrega y la recepción.»

#### «Notas»

Si no hay texto: «Sin notas.» Si hay, se muestra tal cual, con los saltos de línea. En el diálogo el campo se llama «Notas», con el ejemplo «Lo que haya que recordar de este carro». Opcional. Más de 1000 caracteres: «La nota no puede pasar de 1000 caracteres.» Vacío borra la nota.

#### «Seguro y circulación»

- «Seguro vence» y «Tarjeta vence». Sin fecha: «Sin fecha». Con fecha, la fecha en día/mes/año y un sello. «Al día» en verde si faltan más días que el aviso de Ajustes (de fábrica, 7). «Vence hoy» en ámbar. «Vence en 1 día» o «Vence en 5 días» en ámbar si faltan entre 1 y esos días, inclusive. «Vencido» en rojo si la fecha ya pasó.
- «Aseguradora». El nombre o «Sin dato». En el diálogo, ejemplo «Seguros del Pacífico». Más de 80: «La aseguradora no puede pasar de 80 caracteres.»
- «Póliza». El número o «Sin dato». En el diálogo, «Número de póliza», ejemplo «AU-0000-2026». Más de 40: «El número de póliza no puede pasar de 40 caracteres.»

Esos cuatro datos los ve quien ve la flota. No son el costo mensual del seguro.

#### «Compra»

Sin permiso de rentabilidad, la tarjeta está cerrada con el candado. Con permiso:

- «Precio». El monto o «Sin dato». En el diálogo, «Precio de compra ($)».
- «Fecha». La fecha o «Sin dato». En el diálogo, «Fecha de compra».
- Si no está financiado: «Pago» dice «Al contado» cuando hay precio, y «Sin dato» cuando no hay precio.
- Si está financiado: «Prima»; «Cuota» con el monto y «/mes», y si la cuota trae seguro y GPS la ayuda «Trae el seguro y el GPS»; y el avance.

El avance solo sale si hay plazo y fecha de primera cuota. Cuenta la cuota del mes de inicio. Ejemplo: primera cuota en marzo de 2026, plazo 48 meses, hoy 20 de octubre de 2026. Van 8 meses (marzo cuenta como la 1). La fila dice «Pagado» y «8 de 48 cuotas», con una barra «Cuotas pagadas», y debajo «Faltan 40 · termina en feb 2030». La última cuota es el mes de inicio más el plazo menos uno. Si hoy es anterior al inicio, pagadas queda en 0. Si ya se pasó el plazo, pagadas queda en el plazo y faltan 0. Sin plazo o sin fecha de inicio, en vez de la barra está la fila «Plazo»: «48 meses» o «Sin dato».

En el diálogo, interruptor «Financiado». Ayuda: «Prima y cuotas entran al costo del carro.» Apagado borra prima, cuota, plazo y fecha, y apaga la bandera del seguro. Encendido muestra:

- «Prima ($)».
- «Cuota mensual ($)».
- «Plazo (meses)». Ejemplo «48». Entero de 1 a 120. «No puede ser menor que 1.» «No puede pasar de 120.»
- «Primera cuota». Ayuda: «Si la dejás vacía, se toma la fecha de compra.»
- Interruptor «La cuota incluye seguro y GPS». Ayuda: «Así no se cuentan dos veces en la rentabilidad.»

#### «Gasto fijo al mes»

Sin permiso de rentabilidad, cerrada con el candado. Con permiso, si la cuota ya trae seguro y GPS, un recuadro dice «El seguro y el GPS ya van en la cuota.» y no se listan esas dos filas. Si no, filas «Seguro» y «GPS». Siempre «Otros» y «Total». Un monto vacío se muestra como «$0.00». El total es seguro + GPS + otros, o solo otros cuando van dentro de la cuota. Ejemplo: seguro $80.00, GPS $15.00, otros $25.00, total $120.00. Con la cuota que ya los trae y los mismos otros, el total mostrado es $25.00.

En el diálogo, si la cuota guardada ya los incluye, el aviso es: «La cuota ya trae el seguro y el GPS. Si alguno se paga aparte, cambialo en «Compra y financiamiento».» (el título de esa otra tarjeta en la ficha es «Compra»). En ese caso el diálogo solo muestra «Otros fijos ($)», y al guardar no toca el seguro ni el GPS que ya estaban. La ayuda de otros: «Parqueo, lavado mensual, lo que se pague cada mes.» Los tres campos son opcionales. Este diálogo mira lo ya guardado: hay que guardar «Compra» antes de que el seguro y el GPS desaparezcan de aquí.

El costo mensual que usa «hay que rentarlo N días» y la rentabilidad es: seguro mensual + GPS mensual + otros, más la cuota solo mientras el financiamiento está vigente. Si la cuota incluye seguro y GPS, esos dos suman cero aunque tengan un monto guardado. Vigente significa: hay cuota mayor que cero, y hoy cae desde la primera cuota (o, si no hay esa fecha, desde la fecha en que el carro empieza a contar) hasta esa fecha más el plazo. Sin plazo, la cuota se cuenta siempre. El carro empieza a contar en la fecha de compra; si no hay, en la primera cuota; si no hay ninguna, en la primera renta no cancelada o en el primer gasto.

### «Multa» desde el carro

«Multa» abre el diálogo «Multa». El subtítulo es el nombre del carro y, si hay placa, « · » y la placa. El detalle de cobros, saldos y caja está en la sección de acciones de la renta. Desde aquí el comportamiento es este.

Campos: «Fecha y hora» (arranca en ahora, hora de El Salvador), «Monto ($)» con ejemplo «0.00», «De qué es», y cuatro atajos que rellenan ese texto: «Exceso de velocidad», «Mal estacionado», «Semáforo en rojo», «Sin cinturón». Botones «Volver» y «Guardar». «Guardar» espera a que el sistema diga quién tenía el carro.

Según la fecha:

- Mientras busca: «Buscando…» y «Guardar» deshabilitado.
- Si esa fecha cae dentro de una renta: «Lo tenía» el nombre del cliente y, si hay número, « · N° 733», con el sello azul «Se le carga». Al guardar, el aviso es «Multa registrada» y, por ejemplo, «$25.00 a Ana Flores». Entra a la cuenta de esa renta. No cobra en la caja en este paso.
- Si no hay renta en esa fecha: «Sin renta» y el sello ámbar «Gasto «Multa»». El aviso queda «$25.00 · Gasto «Multa»». Ese gasto aparece solo en el historial del carro, como multa automática, y no se le puede corregir ni borrar desde el historial.

Mensajes: fecha vacía o ilegible, «Escribí la fecha y la hora de la multa.» Monto vacío o ilegible, «Escribí un monto válido, con hasta dos decimales.» Monto cero, «El monto tiene que ser mayor que cero.» Tope, «El monto no puede pasar de $99999.99.» Descripción vacía, «Escribí de qué es la multa.» Más de 300 caracteres, «No puede pasar de 300 caracteres.» Si en ese instante ya no se le puede cargar al cliente, «Nadie tenía rentado ese carro en esa fecha: la multa solo puede quedar como gasto del carro.»

### «Mandar al taller» (el texto)

El botón de la lista abre «Lista para el taller». Ayuda: «Lo vencido y lo próximo de cada carro, listo para mandar.» Mientras arma el texto: «Armando la lista…» Si falla, el mensaje del servidor. El texto es el de WhatsApp, con asteriscos de negrita, sin emojis. Encabezado «_Mantenimiento pendiente ·_» el nombre de la empresa, y «Fecha:» en día/mes/año. Luego, por cada carro que tenga un servicio vencido o próximo:

```
*Kia Rio 2022 · P123-456* · 45300 km
- Cambio de aceite y filtro: vencido (se pasó por 300 km, faltan 10 días)
```

Los kilómetros de esta lista van sin separador de miles. Si no hay nada: «Sin mantenimientos pendientes.» Los papeles (seguro y tarjeta) no entran en este texto.

«Cerrar» sale. «Copiar» está apagado si no hay texto. Al copiar, aviso «Lista copiada». Si el navegador no deja copiar: «No se pudo copiar. Seleccione el texto y cópielo a mano.» «Abrir WhatsApp» abre WhatsApp con el texto ya escrito; el número lo elige quien lo manda. También se apaga si no hay texto.

### «Servicio y gastos»

Pestaña del carro. Mientras carga: «Cargando el tablero». Si falla: el mensaje del servidor o «No se pudo cargar el carro.»

Arriba, «Anotar un gasto» solo con permiso de editar la flota, e «Historial · $0.00 este mes». Ese monto es la suma de gastos del mes calendario completo (del día 1 al último), no hasta hoy. Incluye lo anotado a mano, lo que salió de un servicio con costo, los lavados cobrados y las multas que quedaron como gasto del carro.

#### El tablero

La zona se llama «Tablero del carro». A la izquierda, un medidor de semicírculo. La punta izquierda dice «Recién hecho» y la derecha «Toca». La aguja va de recién hecho a «toca» según lo más urgente. Debajo, el odómetro, al menos seis dígitos con ceros a la izquierda, y «km». El lector de pantalla dice «Odómetro: 48.000 km». El kilometraje que se ve es el del carro; lo suben la entrega y la recepción, no esta pantalla.

La frase bajo el medidor:

- Sin ninguna tarea ni papel con fecha: «Todavía no hay nada anotado.»
- Si lo que manda está vencido o próximo: «Lo más urgente:» el nombre en negrita, « · » y el detalle («5.000 km de más», «quedan 1.200 km», «vence mañana», etc.).
- Si todo está al día: «Todo bien. Lo próximo es» el nombre, « · » y el detalle.

A la derecha, un testigo por cada tarea activa del plan y, siempre, «Seguro» y «Tarjeta de circulación». El nombre es el de la tarea. Debajo, el estado. Colores, repetidos en la leyenda:

- Rojo, leyenda «Vencido».
- Ámbar, leyenda «Pronto».
- Apagado, leyenda «Apagado: está bien». El texto del testigo al día es «Bien» si es una tarea.
- Borde punteado, leyenda «Sin dato».

La leyenda cierra con «Ningún testigo encendido», «1 testigo encendido» o «3 testigos encendidos».

Textos del testigo de una tarea (el detalle del medidor es el mismo, en minúscula):

- Sin último servicio, o sin kilómetros ni días en el plan: «Sin dato».
- Vencido por kilómetros, pasada la marca: «5.000 km de más». Justo en la marca: «Llegó al km».
- Vencido por días: «Venció hace 3 días», o «Vence hoy» si es hoy.
- Con kilómetros por delante: «Quedan 1.200 km».
- Con días por delante: «Toca hoy», «Toca mañana» o «Toca en 5 días».

El de un papel:

- Sin fecha: «Sin fecha».
- Al día: «Vence el 12 oct».
- Próximo (dentro de los días de aviso): «Vence hoy», «Vence mañana», «Vence en 5 días».
- Vencido: «Venció hace 2 días».

Quién puede tocar un testigo: solo quien edita la flota. Sin ese permiso se leen y no abren nada. Un testigo de tarea abre «Anotar lo que se hizo» con esa tarea ya elegida. Un testigo de papel abre «Ya se renovó».

La cuenta de una tarea: kilómetros que faltan = intervalo − (odómetro actual − odómetro del último servicio), si el último servicio anotó kilómetros. Días que faltan = intervalo − días desde la fecha del último servicio. Vencido si alguno es cero o negativo. Próximo si los kilómetros que faltan no superan el aviso en km, o los días no superan el aviso en días. Sin último servicio, «Sin dato», aunque el plan tenga intervalo. Ejemplo: aceite cada 5.000 km, último servicio a los 40.000, odómetro en 44.500, aviso de 500 km. Faltan 500, está próximo, y el aviso de la tarjeta dice «Le toca a los 45.000 km: Cambio de aceite y filtro».

#### «Anotar lo que se hizo»

Título «Anotar lo que se hizo». Botones «Cancelar» y «Anotar». Al guardar: «Servicio anotado». El servicio reinicia la cuenta de esa tarea.

- «Qué se hizo». Obligatorio. Texto de ayuda «Busque o cree un servicio». Si no hay tareas: «Todavía no hay servicios». Se puede escribir un nombre nuevo; la opción dice «Crear servicio: «Alineación»» y lo agrega al plan de toda la flota, solo con el nombre, sin kilómetros ni días (el testigo queda en «Sin dato» hasta completar el intervalo en Ajustes). Si no se elige nada: «Elegí qué se hizo.» Si la tarea se desactivó mientras tanto: «Una de las tareas no existe o está desactivada.» Si no se pudo crear: «No se pudo crear el servicio.»
- «Km». Obligatorio. Arranca con el kilometraje actual del carro. Solo dígitos. Vacío: «Escribí el kilometraje.» Con letras: «Tiene que ser un número entero.» Negativo: «No puede ser negativo.» Por encima de 2.000.000: «No puede pasar de 2.000.000.»
- «Fecha». Obligatoria. Arranca en hoy. Vacía: «Elegí la fecha.» Si es posterior a hoy, el servidor responde «La fecha del servicio no puede ser futura.»
- «Costo». Opcional. Vacío no genera gasto. Si se escribe, es un monto (mismas reglas, incluido cero). Un costo mayor que cero crea un gasto de tipo mantenimiento atado a este servicio; el historial lo muestra una sola vez, como servicio. El costo no se reparte porque esta pantalla anota una sola tarea.
- «Nota». Opcional. A la derecha, «0/1000». Al pasar de 1000 se pone en rojo y dice «La nota no puede pasar de 1000 caracteres.»

No se pide taller. El aviso general del formulario muestra el mensaje del servidor si no cayó en un campo.

#### «Ya se renovó»

Al tocar «Seguro» el título es «Seguro: ya se renovó». Al tocar «Tarjeta de circulación», «Tarjeta de circulación: ya se renovó».

- «Costo». Opcional. Si se escribe, mismas reglas de monto, y cero no vale: «El monto tiene que ser mayor que cero.» Si el mensaje de monto no se puede leer, «Revise el monto.» Vacío no crea gasto.
- «Cuándo se pagó». Obligatorio. Arranca en hoy. Vacío: «Elija la fecha.»
- «Ahora vence el». Obligatorio. Arranca un año después del vencimiento actual si ese vencimiento es hoy o después; si ya venció o no había fecha, un año después de hoy. El 29 de febrero pasa al 28. Vacío: «Elija la nueva fecha de vencimiento.» Anterior a hoy: «No puede ser antes de hoy.»

Botones «Cancelar» y «Ya se renovó». Primero guarda la fecha en el carro. Si hay costo, después anota el gasto. El del seguro queda como tipo seguro, sin texto propio, y en el historial se lee «Seguro». El de la tarjeta queda como tipo otro, con el texto «Tarjeta de circulación». Aviso al terminar: «Renovación anotada».

Si la fecha se guardó y el gasto no, el aviso es «La fecha sí quedó guardada, pero el gasto no:» y el mensaje del servidor. «Cancelar» pasa a decir «Cerrar» y el botón principal «Anotar el gasto», que reintenta solo el gasto.

#### «Anotar un gasto»

Título «Anotar gasto». No se elige categoría. Botones «Cancelar» y «Anotar». Aviso: «Gasto anotado».

- «Monto». Obligatorio, mayor que cero. Mensajes de monto de arriba, y «El monto tiene que ser mayor que cero.»
- «Qué». Opcional, hasta 300 caracteres: «No puede pasar de 300 caracteres.» El tipo lo deduce el texto, sin tildes y en minúsculas, por la palabra más larga que coincida: «mantenimiento», «combustible», «reparación», «llantas», «multa», «seguro», «gps», «lavado». Si ninguna coincide, o si «Qué» está vacío, el tipo es otro. En el historial se muestra lo escrito; si no hay texto, el nombre del tipo: «Mantenimiento», «Llantas», «Reparación», «Multa», «Combustible», «Seguro», «GPS», «Lavado» u «Otro».
- «Fecha». Arranca en hoy. El rótulo del campo es «Fecha».

Si el formulario no pasa: «Revisá los datos.» además del mensaje concreto. El error del servidor va en el aviso rojo.

#### «Historial»

Se abre como panel lateral. Título «Historial». Arriba, «Gastado este mes» o, con el otro chip, «Gastado en total», y el monto. Chips «Este mes» y «Todo», en el grupo «Qué mostrar». «Este mes» es el mes calendario entero.

Tabla con columnas «Fecha» (día/mes/año), «Qué», «Monto» y, solo si se puede editar la flota, «Acciones». Vacío: «Nada este mes» o «Nada todavía». Si falla la carga, el mensaje del servidor. «Cargar más» pide el siguiente bloque de 25 servicios y de 25 gastos.

Cada fila es un servicio o un gasto, del más nuevo al más viejo. Un servicio con costo no se duplica con su gasto. El servicio sin costo dice «Sin costo». Si tiene kilometraje, se ve al lado, por ejemplo «48.000 km». Un lavado cobrado o una multa que no se le cargó al cliente llevan el sello «Automático».

Lo que entra solo, y no se corrige ni se borra:

- Un lavado del otro negocio ya cobrado, cuya placa coincide con la del carro aunque una tenga guion y la otra no. El monto es la suma de los pagos de esa orden, si es mayor que cero. La fecha es la del cobro. El texto es «Lavado» y el folio, por ejemplo «Lavado CW-0014».
- Una multa marcada como gasto del carro (la de «Sin renta», o una que no se le cargó al cliente). El texto es el de la multa. La fecha es la de la multa.

El menú «Acciones:» y el nombre de la fila:

- En un gasto anotado a mano que no salió de un servicio: «Corregir» y «Borrar».
- En un servicio: solo «Borrar». Borrar el servicio borra también su gasto.
- En un automático: no hay menú.

«Corregir» abre «Corregir gasto» con el monto, el texto y la fecha. Botón «Corregir». Aviso «Gasto corregido». No deja cambiar el tipo a mano; al guardar, el tipo se vuelve a deducir del texto. Si el gasto viniera de un servicio, el servidor dice «Ese gasto sale de un servicio: se corrige desde el servicio.» Esta pantalla no ofrece «Corregir» en ese caso.

«Borrar» abre «¿Borrar este gasto?» o «¿Borrar este servicio?», con el nombre como subtítulo. Botones «Cancelar» y «Borrar». Avisos: «Gasto borrado» o «Servicio borrado». Si ya no existe: «Ese gasto no existe.» o «Ese servicio no existe.»

### «¿Cuánto dejó?» de toda la flota

Lo abre el botón de la lista, o la ruta de ganancias de la flota. Hace falta permiso de rentabilidad. Sin él: «No tenés permiso para ver cuánto dejó la flota.» Título «¿Cuánto dejó?». Mientras calcula: «Calculando cuánto dejó». Si falla, el mensaje en rojo.

Periodo, en el grupo «Periodo». Al entrar está «Este mes»: del día 1 al día de hoy (El Salvador), no hasta el fin de mes. Los otros botones:

- «Mes pasado»: el mes calendario anterior, completo.
- «Últimos 3 meses»: desde el día 1 de hace dos meses hasta el último día de este mes. Incluye los días que faltan de este mes.
- «Este año»: del 1 de enero al 31 de diciembre de este año. Incluye los meses que todavía no llegan, y en esos meses sí carga fijos y cuota.

Al lado, el botón del rango. Cerrado, resume las fechas y los días, por ejemplo «1 oct – 20 oct 2026 · 20 días». Al abrirlo, el panel se llama «Periodo». Atajos propios del calendario: «Hoy», «7 días» y «Este mes» (este «Este mes» del calendario es el mes completo de esa pieza, distinto del botón de arriba). Campos «Desde» y «Hasta», ejemplo «dd/mm/yyyy», la palabra «a» entre los dos, y «Aplicar». Si la inicial queda después de la final: «La fecha inicial es posterior a la final.» y «Aplicar» no sigue. Una fecha ilegible se devuelve a la que ya estaba, sin frase de error. Si el rango igual llega al servidor al revés: «El periodo termina antes de empezar.» Si abarca 3660 días o más: «El periodo es demasiado largo.» Los dos días del rango cuentan.

Tres cifras de toda la flota, no solo de la página:

- «Entró». Ingreso del periodo.
- «Se fue». Gastos + fijos + cuota.
- «Quedó». Entró menos se fue. En verde si es cero o positivo; en color de llama si es negativo, escrito como «-$40.00».

La tabla tiene columnas «Carro» (nombre, y placa o «Sin placa»), «Entró», «Se fue» y «Quedó». «Quedó» en negrita y en rojo si es negativo. Cada fila abre la pestaña «¿Cuánto dejó?» de ese carro. Vacío: «Nada todavía». Un carro retirado entra solo si en el periodo tuvo ingreso o gastos. El orden es de más a menos «Quedó». Páginas de 25, con el mismo pie «1–25 de 40 carros».

#### La cuenta

Todo se redondea al centavo al mostrarse. Los días son civiles de El Salvador.

«Entró» suma, por cada renta que no esté reservada ni cancelada, la parte del ingreso que cae en el periodo. El tramo de la renta empieza en la salida real (o la pactada si no salió) y termina en el regreso real si ya se recibió; si sigue en curso, en el regreso pactado o en este momento, el que sea después. La parte es ingreso × tiempo dentro del periodo ÷ duración del tramo. El ingreso de la renta es el total de su cuenta; si esa renta lleva el IVA incluido, se le quita antes: total ÷ (1 + IVA ÷ 100). Con IVA 13 % y total $113.00, el ingreso es $100.00.

«Se fue» = gastos con fecha dentro del periodo (anotados, lavados, multas del carro y lo que salió de un servicio) + fijos del periodo + cuota del periodo.

Los fijos son el costo mensual de arriba × los meses, con fracción, desde que el carro empieza a contar y solo dentro del periodo. Del 15 al 31 de octubre, un mes de 31 días, la fracción es 17/31. Con $310.00 al mes, ese pedazo es $170.00.

La cuota usa la misma fracción, solo dentro del plazo del financiamiento. Sin plazo, no se corta.

«Quedó» = Entró − Se fue. También se puede leer como (Entró − gastos − fijos) − cuota.

El sello de un mes, en la ficha del carro, sale de «Quedó» y de «Se fue»:

- Sin ingresos y sin costos: «Sin uso», gris.
- Si «Quedó» supera el mayor entre $10.00 y el 3 % de «Se fue»: «Ganancia», verde.
- Si «Quedó» queda por debajo de ese mismo monto en negativo: «Pérdida», rojo.
- En medio: «Cubrió su costo», ámbar.

Ejemplo: entraron $400.00, gastos $50.00, fijos $120.00, cuota $0.00. Se fue $170.00. Quedó $230.00. El margen es $10.00 (el 3 % de 170 es $5.10). 230 supera 10, así que es ganancia. Con los mismos costos y solo $180.00 de ingreso, quedó $10.00, que no supera el margen: «Cubrió su costo». Con $100.00 de ingreso, quedó −$100.00: «Pérdida».

Los días rentados que a veces se leen bajo el mes son el tiempo ocupado dentro del periodo, con un decimal. Una renta de 10 días con ingreso $350.00 que solo pisa 4 días del periodo aporta $140.00 a «Entró» y 4.0 días.

### «¿Cuánto dejó?» de un carro

Pestaña del carro, o la fila del reporte de la flota. El año se cambia con «Año anterior» y «Año siguiente». «Año siguiente» se apaga en el año en curso. «Año anterior» no se apaga; por debajo del año 2000 el servidor responde «Ese año no es válido.» Lo mismo por encima de 2100, que desde esta pantalla no se alcanza.

Mientras carga: «Cargando los meses». Si falla, el mensaje.

Las tres cifras de arriba son el año pedido cortado en hoy si el año es el actual: de enero al día de hoy, no al 31 de diciembre. Un año ya cerrado va entero. Dicen «Entró», «Se fue» y «Quedó», con el mismo color.

Debajo, la gráfica de los 12 meses. Leyenda: cuadrado verde «Quedó» y cuadrado rayado «Pérdida». El grupo se llama «Meses de 2026». Cada columna es el neto de ese mes, hacia arriba en verde y hacia abajo rayada. Un mes futuro no tiene barra. Un mes en cero muestra una raya corta. Tocar una columna, o las flechas izquierda y derecha, elige el mes. El lector dice, por ejemplo, «Octubre, quedó $230.00, ganancia», «Noviembre, todavía no empieza» o «Enero, sin uso». Debajo de cada barra, la abreviatura: «ene», «feb», «mar», «abr», «may», «jun», «jul», «ago», «sep», «oct», «nov», «dic».

El recuadro del mes tiene «Mes anterior» y «Mes siguiente» (apagados en enero y en diciembre) y el nombre: «Octubre». Si el mes no es futuro, el sello de arriba. Debajo del nombre, si hubo uso: los días, por ejemplo «1 día rentado» o «4.0 días rentados», y si es el mes en curso «hasta el 20 de octubre», unidos con « · ».

Si el mes no empieza: «Todavía no empieza.» Si no tuvo ingresos ni costos: «No tuvo movimiento.» Si tuvo movimiento, otra vez «Entró», «Se fue» y «Quedó», y un desglose solo de las líneas distintas de cero: «Gastos», «Seguro y GPS» (son los fijos, no solo el seguro) y «Cuota».

El mes en curso de esta pestaña corta hoy, igual que el botón «Este mes» de la flota. Un mes futuro va en cero y no carga fijos. Eso es distinto del botón «Este año» de la flota, que sí llega al 31 de diciembre.

El servidor también calcula, para el carro, desde cuándo cuenta, cuánto se ha desembolsado (prima más cuotas ya corridas, o el precio al contado) y qué parte de eso cubre el resultado operativo. Esas frases («Faltan datos», «Ya se pagó solo», un porcentaje) no están dibujadas en esta pestaña ni en la lista de la flota.

## Ajustes de renta

No está en el riel. En el espacio Renta, se abre el menú de la persona (el nombre, al pie del riel o en la barra de abajo) y ahí «Ajustes de renta». Hace falta el permiso de editar los ajustes (`rentals.settings`). Sin él, el ítem no aparece. Si se abre la ruta igual: «No tenés permiso para ver los ajustes de la renta.» El regreso de esta pantalla dice «Hoy».

Es una sola configuración para toda la rentadora. La primera vez que alguien la lee, nace con los valores de fábrica de abajo; no abre en blanco. Quien puede ver rentas, ver la flota o editar estos ajustes alcanza para leerlos. Escribirlos pide el permiso de ajustes.

Título «Ajustes». A la derecha, después de un guardado en esta visita, «Guardado» y la hora, por ejemplo «Guardado 9:42 a.m.» El botón «Ver hoja» abre la hoja del contrato. Mientras carga: «Cargando los ajustes». Si falla: el mensaje del servidor o «No se pudieron cargar los ajustes.»

Pestañas, en «Secciones de ajustes». Cada una lleva una marca si tiene cambios sin guardar.

- «Empresa».
- «Cobros y reglas».
- «Contrato», con el número de cláusulas.
- «Accesorios», con el número de fichas.
- «Servicio», solo si además se puede editar la flota (`fleet.manage`). El número es el de tareas activas. Sin ese permiso la pestaña no está, aunque se puedan guardar el resto de los ajustes.

En pantalla ancha, Empresa y Cobros muestran a la derecha la vista previa. En tablet y en densidad de bahía esa columna baja y se pliega. El botón de Empresa dice «Así se ve impreso». El de Cobros dice «Cómo afecta un cobro».

Al entrar a un campo, la miniatura marca en naranja la zona de la hoja que ese campo imprime: logo, nombre, NIT y NRC en la cabecera; teléfonos, correo y dirección en el contacto; arrendante; ciudad; CDW, deducible e IVA en las tarifas; los dos intereses en el pagaré. Edad, horas, margen, cláusulas y accesorios no marcan una zona del anverso. La miniatura es el frente. «Ver en grande» y tocar la miniatura abren «Ver hoja».

### Barra de guardar

No se ve hasta que algo difiere de lo último guardado. Entonces queda fija abajo, en la región «Cambios sin guardar». El texto es «1 cambio» o «3 cambios», y después de « · » hasta tres nombres de campo («Nombre, NIT, IVA…»; si hay más, puntos suspensivos). Con errores de validación pasa a rojo: «Revise 1 campo» o «Revise 2 campos», con hasta dos nombres, y «Guardar» queda deshabilitado. Al intentar guardar con errores, la pantalla salta a la pestaña del primer campo mal.

«Descartar» vuelve al último guardado, incluido el logo, y avisa «Cambios descartados» con la acción «Deshacer», que recupera lo que se estaba escribiendo.

«Guardar» manda la fila entera, no solo la pestaña abierta. Atajo Control+S en Windows y Linux, o Comando+S en Mac: guarda si hay cambios y no está guardando. Si no hay cambios, el atajo no hace nada y tampoco abre el «Guardar página» del navegador. Con cambios sin guardar, cerrar o recargar la pestaña dispara el aviso del navegador.

Al guardar bien: «Ajustes guardados» y el nombre de la empresa, y la marca «Guardado» con la hora. Si otra persona guardó mientras aquí no hay cambios, el formulario toma esos valores. Si aquí hay cambios sin guardar, no los pisa.

Un error del servidor queda en el aviso rojo de arriba del formulario. Sin permiso de escribir: «No tenés permiso para hacer esto.» Los mensajes de cada campo son los de más abajo. Una cláusula o un accesorio en blanco se tira antes de guardar; no viaja vacío.

### «Empresa»

Grupo «Quién renta»:

- «Logo». Ayuda: «PNG, JPG o WebP de hasta 5 MB.» Sin logo se ve el ícono. «Subir logo» si no hay, o «Cambiar» y «Quitar» si hay. El archivo se reduce a 1600 px y se sube al elegirlo; la hoja lo muestra enseguida, pero el id se confirma al guardar los ajustes. «Quitar» deja el logo vacío hasta que se guarda. Errores de la subida: «Elegí un archivo.» «El archivo pasa de 5 MB. Reducilo y probá de nuevo.» «Solo se aceptan imágenes JPG, PNG o WebP.» Al guardar, si ese archivo ya no está: «Ese logo no existe. Subilo de nuevo.»
- «Nombre de la empresa». Obligatorio. Ayuda: «El título grande del contrato.» Vacío: «Escribí el nombre de la empresa.» Más de 120: «No puede pasar de 120 caracteres.» De fábrica: «RIVERA'S RENT A CARS».
- «Arrendante». Obligatorio. Ayuda: «Quien firma. Reemplaza {ARRENDANTE} en el texto.» Vacío: «Escribí el nombre del arrendante.» Más de 120: «No puede pasar de 120 caracteres.» De fábrica: «JOSUE ALEXANDER RIVERA».
- «NIT y NRC». Ayuda: «NRC solo si está inscrito en IVA.» El primer campo es el NIT, ejemplo «0000-000000-000-0». El segundo se llama «NRC», con ese mismo texto de ejemplo. Los dos son opcionales. Más de 30 cada uno: «No puede pasar de 30 caracteres.» De fábrica el NIT es «0614-070624-103-3» y el NRC está vacío. No hay un formato de NIT aparte de ese largo.

Grupo «Contacto»:

- «Teléfonos». Opcional, hasta 120 caracteres. De fábrica: «7742-1900 y 6013-9922».
- «Correo». Opcional, hasta 120. No se exige que tenga forma de correo. De fábrica: «riverasimportcars@gmail.com».
- «Dirección». Opcional, hasta 300: «No puede pasar de 300 caracteres.» De fábrica: «Calle el Algodón y 75 Av. Norte, Col. Miralvalle, #2, San Salvador, San Salvador.»
- «Ciudad del contrato». Obligatoria. Ayuda: «Donde se firma: «San Salvador, __ de …».» Vacía: «Escribí la ciudad.» Más de 80: «No puede pasar de 80 caracteres.» De fábrica: «San Salvador».

### «Cobros y reglas»

Grupo «Lo que se cobra»:

- «CDW». Ayuda: «Seguro contra daños. Se cobra por día. Vacío: no se ofrece.» Unidad «$» y «/ día». Ejemplo «0.00». Opcional. Monto, o vacío para no ofrecerlo. De fábrica, vacío.
- «Deducible». Ayuda: «Lo máximo que paga el cliente si hay daño y tiene CDW.» Unidad «$». Opcional. De fábrica, vacío.
- «IVA». Ayuda: «Va incluido en el precio. Ponga 0 si no cobra IVA.» Unidad «%». Obligatorio en el sentido de que vacío se guarda como 0. «Escribí un porcentaje válido, con hasta dos decimales.» «El porcentaje no puede pasar de 100.» De fábrica, «0.00».

Grupo «Pagaré»:

- «Interés anual». Ayuda: «Lo que dice el pagaré que firma el cliente.» Unidad «%». Opcional; vacío queda sin interés. Mismas reglas de porcentaje. De fábrica, vacío.
- «Interés por atraso». Ayuda: «Se aplica si no paga a tiempo.» Igual. De fábrica, vacío.

Estos dos no se suman solos en la cuenta de una renta desde esta pantalla: quedan escritos para el pagaré. El ejemplo de al lado no los usa.

Grupo «Tiempos y reglas». Los tres primeros se mueven con «−» y «+» (el lector dice «Menos horas de gracia», «Más horas de gracia», y lo mismo para «margen entre rentas» y «edad mínima») o se escriben. El «−» se apaga en el mínimo y el «+» en el máximo.

- «Horas de gracia». Ayuda: «Tiempo extra para devolver sin cobrar otro día.» Unidad «h». Entero de 0 a 24. De fábrica, 1.
- «Margen entre rentas». Ayuda: «Tiempo para limpiar el carro antes de rentarlo otra vez.» Unidad «h». Entero de 0 a 72. De fábrica, 1. Ese margen es el que separa dos rentas del mismo carro al ofrecerlo.
- «Edad mínima». Ayuda: «Del conductor principal.» Unidad «años». Entero de 16 a 99. De fábrica, 21.
- «Primer número de contrato». Ayuda: «Desde aquí sigue la numeración.» Prefijo «N.º». Entero de 1 a 9999999. Vacío o no entero: «Escribí un número.» «Tiene que ser un número entero.» «No puede ser menor que 1.» «No puede pasar de 9999999.» De fábrica, 733. Es el número desde el que sigue la numeración de contratos nuevos; no reescribe los ya emitidos.

Para los enteros, fuera de rango: «No puede ser menor que 0.» o el mínimo que corresponda, y «No puede pasar de 24.» (o 72, o 99).

#### El ejemplo de al lado

Título «Ejemplo: 3 días a $35.00». Siempre son 3 días a $35.00 por día, más el CDW que se está escribiendo. No usa la tarifa de ningún carro.

Líneas:

- «Renta (3 × $35.00)» = «$105.00».
- «CDW» = «No se cobra» si el CDW está vacío o en cero. Si el CDW es $5.00: «CDW (3 × $5.00)» = «$15.00».
- «Total» = renta + CDW. Con CDW vacío, «$105.00». Con $5.00, «$120.00».
- «IVA» = «No se cobra» si el porcentaje es 0 o no se puede leer. Si es 13: «Incluye IVA 13%» y la parte del total que es IVA, no un cargo extra. Con total $105.00 e IVA 13 %, esa parte es $12.08, porque 105 − (105 ÷ 1.13) redondeado al centavo. El total de la línea de arriba no sube.

Debajo: «Si devuelve el carro» las horas de gracia «h» «tarde, no paga otro día. Después de devolverlo, el carro queda libre en» las horas de margen «h». Si el número de contrato se puede leer y es mayor que cero: «Numeración desde» y «N.º 0733» (el número con ceros hasta cuatro dígitos). Con el valor de fábrica el párrafo habla de 1 h de gracia, 1 h de margen y «N.º 0733».

### «Contrato»

La caja se titula «Texto del contrato» al editar y «Reverso del contrato» al verlo impreso. El grupo «Modo» tiene «Editar» y «Ver impreso». «Ver impreso» muestra el reverso con la introducción y las cláusulas numeradas, ya con el nombre del arrendante en lugar de la ficha.

«Volver al texto original» aparece en «Editar» cuando la introducción o las cláusulas no son las de fábrica. Las restaura y avisa «Texto original restaurado», con «Deshacer».

«Introducción». Obligatoria. Vacía: «Escribí la introducción del contrato.» Más de 4000 caracteres: «No puede pasar de 4000 caracteres.» El botón «+ {ARRENDANTE}» inserta esa ficha donde está el cursor. La ayuda dice: «Se cambia por el arrendante al imprimir.» De fábrica el párrafo empieza «Celebran el presente contrato de arrendamiento, el concesionario {ARRENDANTE} en esta plaza como arrendador…» y sigue hasta «EL ARRENDATARIO».

«Cláusulas», con el número al lado. Ayuda: «Separe cada cláusula con una línea en blanco. Se numeran solas.» Un salto de línea simple se queda dentro de la misma cláusula. Una línea en blanco empieza otra. Los párrafos vacíos se descartan. Hace falta al menos una: «El contrato necesita al menos una cláusula.» Cada una, vacía no viaja; si viajara sin texto, «Escribí la cláusula.» Más de 6000 caracteres en una: «No puede pasar de 6000 caracteres.» Más de 60 cláusulas: «No más de 60 cláusulas.» De fábrica hay 17, el texto del contrato de Riveras, ya escrito en el campo. No se repiten enteras en esta guía: están en la pantalla y «Volver al texto original» las devuelve.

### «Accesorios»

Campo «Nuevo accesorio», ejemplo «Agregar accesorio, p. ej. Gata», tope 80 caracteres. Enter o «Agregar» lo pone al inicio de la lista. Vacío no se agrega y no muestra error. Repetido, sin mirar mayúsculas ni tildes: «Ese accesorio ya está en la lista.»

«Ordenar A–Z» se apaga si hay menos de dos. Ordena en español, sin mirar mayúsculas.

Cada ficha es un botón con el nombre. La ayuda de abajo: «Toque un nombre para cambiarlo.» Al tocarlo se edita en el lugar; Enter o salir del campo guarda el nombre; Escape cancela. Dejarlo vacío quita la ficha y avisa «Quitado:» el nombre, con «Deshacer». Renombrarlo al de otra ficha muestra otra vez «Ese accesorio ya está en la lista.» y no cambia. La × dice «Quitar» y el nombre, quita la ficha con el mismo aviso de deshacer.

Más de 100 accesorios: «No más de 100 accesorios.» Cada uno, más de 80: «No puede pasar de 80 caracteres.» Si una ficha quedara vacía al guardar: «Escribí el accesorio.» La lista puede quedar vacía. De fábrica hay 28, en este orden: «Antena», «Copa de ruedas», «Cricos delanteros», «Cricos traseros», «Cubre llanta de repuesto», «Emblemas», «Encendedor», «Espejos exteriores», «Espejos interiores», «Extintores», «Faroles», «Llanta de repuesto», «Llave de ruedas», «Mica», «Llavero», «Loderas», «Luces delanteras», «Parlantes», «Placas», «Radio o pantalla», «Sobre alfombras», «Stops traseros», «Tapicería», «Tapón de gasolina», «Tarjeta de circulación», «Triángulos», «Vías delanteras», «Vidrios».

Salen en el contrato como el equipo que se entrega con el carro.

### «Ver hoja»

El botón de la cabecera abre «Hoja del contrato». Si la pestaña abierta es «Contrato», arranca en el reverso; si no, en el frente. El grupo «Lado» tiene «Frente» y «Reverso». «Imprimir» manda las dos caras a tamaño real, sin el recuadro naranja de la zona que se está editando. La hoja usa lo que está escrito ahora, aunque no se haya guardado. Es un contrato en blanco: sin cliente, sin carro y sin fechas de una renta. Sirve para ver cómo quedan el nombre, el logo, el CDW, el IVA, la ciudad, la introducción y las cláusulas.

### «Servicio»

Grupo «Avisos». Estos dos sí van con la barra de «Guardar», no con cada tarea.

- «Avisar antes · km». Unidad «km». Entero de 0 a 100000. De fábrica, 500. Es cuántos kilómetros antes un servicio del tablero pasa a «Pronto» y aparece el aviso ámbar en la tarjeta del carro.
- «Avisar antes · días». Unidad «días». Entero de 0 a 365. De fábrica, 7. Sirve para el mismo aviso de servicio y para el sello ámbar de «Seguro vence» y «Tarjeta vence» en la ficha, y para el testigo del papel.

Cero avisa solo cuando ya está en la marca o vencido, porque «próximo» pide que lo que falta sea menor o igual a este número.

Debajo, el título «Tareas» y la lista del plan. Es una sola lista para todos los carros. Cada alta, cambio o quitar se guarda en el momento: no espera la barra de Ajustes, y «Descartar» no los devuelve. Si la lista no carga, se ve el mensaje del servidor.

Cada fila muestra el nombre y, en una segunda línea, «Cada 5.000 km o 90 días», «Cada 10.000 km», «Cada 30 días» o «—» si no tiene intervalo. Tocar la fila la edita ahí mismo. «Quitar» la desactiva: desaparece del tablero y de esta lista, y el historial de servicios ya hechos se queda. El aviso es «Quitada:» el nombre, con «Deshacer», que la vuelve a activar. No se borra.

«Agregar tarea» abre una fila nueva. Campos: «Nombre de la tarea» con ejemplo «Nombre» (obligatorio, hasta 80; vacío «Escribí el nombre de la tarea.»; de más «No puede pasar de 80 caracteres.»), «Cada cuántos km» con «cada» y «km», y «Cada cuántos días» con «cada» y «días». Una tarea nueva puede quedar sin los dos; el testigo de los carros dirá «Sin dato» hasta que se carguen. Al editar una que ya existe, dejar los dos vacíos responde «La tarea necesita km, días o los dos.» Cada intervalo, si se escribe, es un entero mayor que cero: «Tiene que ser mayor que cero.» «Escribí un número.» «Tiene que ser un número entero.» Kilómetros, no más de 1000000: «No puede pasar de 1000000.» Días, no más de 3650: «No puede pasar de 3650.» Nombre repetido, sin mirar mayúsculas: «Ya hay una tarea «Aceite» en el plan.» y en el campo «Ya hay una tarea con ese nombre.»

Enter guarda, Escape cancela. Botones «Cancelar» y «Agregar» o «Guardar». Avisos: «Tarea agregada» o «Tarea guardada», con el nombre. Si no hubo cambio, «Guardar» solo cierra.

De fábrica, si nadie las cambió, las tareas son: «Cambio de aceite y filtro» cada 5.000 km o 90 días; «Revisión general en taller» cada 30 días; «Rotación de llantas» cada 10.000 km; «Alineación y balanceo» cada 10.000 km o 180 días; «Revisión de frenos» cada 10.000 km o 180 días; «Filtro de aire» cada 15.000 km o 365 días; «Revisión de batería» cada 180 días; «Cambio de refrigerante» cada 40.000 km o 730 días. Volver a sembrar la base no pisa un intervalo que ya se haya editado en esta pantalla.

Quien edita la flota pero no tiene el permiso de ajustes no llega a esta pestaña: el menú «Ajustes de renta» no se le muestra. Desde «Anotar lo que se hizo» sí puede crear una tarea nueva con solo el nombre.

### Quién puede hacer qué en la renta

El sistema no mira el nombre del rol. Mira estas claves. Un rol puede tener cualquier combinación.

Renta de carros:

- Ver inicio, calendario, rentas y disponibilidad (`rentals.read`). Abre «Hoy» y «Rentas». También deja ver el nombre del cliente en la tarjeta y en la ficha del carro. Sin esta clave ese nombre no sale.
- Crear, editar, entregar, recibir, extender, cambiar y cancelar rentas (`rentals.manage`). Es el permiso de armar y mover una renta. No crea carros ni abre los ajustes.
- Registrar cobros, devolver depósitos, multas y ver la caja de renta (`rentals.charge`). Abre la pestaña «Caja» y el botón «Multa» del carro.
- Ver rentabilidad e inversión recuperada (`rentals.reports`). Abre «¿Cuánto dejó?» en la lista y en el carro, y las tarjetas «Compra» y «Gasto fijo al mes». Sin él esas dos tarjetas muestran el candado y el texto «Solo lo ve quien tiene permiso de rentabilidad.»
- Editar datos de la empresa, contrato, cláusulas, accesorios y logo (`rentals.settings`). Abre «Ajustes de renta».

Flota de renta:

- Ver la flota, su mantenimiento y sus gastos (`fleet.read`). Abre «Carros», la ficha, «Servicio y gastos» y el historial en solo lectura. También «Mandar al taller» (el texto) cuando hay avisos de servicio.
- Crear y editar carros, registrar servicios, gastos y el plan (`fleet.manage`). Abre «Nuevo carro», «Editar» de cada tarjeta, los cambios de estado, «Anotar un gasto», «Anotar lo que se hizo», «Ya se renovó», corregir y borrar en el historial, y la pestaña «Servicio» de Ajustes si además puede entrar a Ajustes.

Clientes de renta:

- Ver clientes de renta (`renters.read`). En el mismo menú de la persona, dentro de Renta, muestra «Clientes».
- Crear, editar, bloquear e importar clientes de renta (`renters.manage`). Es el permiso para cambiar esa lista. Verlos no alcanza para modificarlos.

Quien solo tiene ver la flota, y ninguna clave de rentas, entra al espacio Renta directo en «Carros». Las otras pestañas del riel no se le muestran.
