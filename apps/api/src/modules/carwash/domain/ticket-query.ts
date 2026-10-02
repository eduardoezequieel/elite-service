/**
 * Que tickets pide cada consulta (004).
 *
 * Hay dos preguntas distintas con la misma ruta:
 *
 * - **La fila**: que hay hoy en el taller. Se recorta al dia.
 * - **El historial de un cliente**: que le hicimos a esta persona. No se
 *   recorta por dia —si su ultimo lavado fue en marzo, el recorte lo dejaria
 *   vacio y la ficha mentiria—.
 *
 * Desde la 102 ninguna de las dos lleva tope propio: la lista de oficina
 * pagina con `?page&pageSize`, y la ficha del cliente pide su pagina.
 *
 * La decision vive aca, pura, y no dentro del `where` de Prisma: es una regla
 * de producto, y ahi adentro no se puede leer ni probar.
 */

export interface TicketQueryPlan {
  /** `true` si la consulta se recorta a un dia. */
  byDay: boolean;
  /** El dia pedido (`YYYY-MM-DD`). Sin el, y con `byDay`, es hoy. */
  date?: string;
}

export function planTicketQuery(filter: { date?: string; customerId?: string }): TicketQueryPlan {
  // Pedir el historial de un cliente manda sobre el dia: quien pregunta por
  // una persona pregunta por su historia, aunque de paso haya mandado fecha.
  if (filter.customerId !== undefined) {
    return { byDay: false };
  }

  return { byDay: true, date: filter.date };
}
