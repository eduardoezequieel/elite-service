/**
 * Que tickets pide cada consulta (004).
 *
 * Hay dos preguntas distintas con la misma ruta:
 *
 * - **La fila**: que hay hoy en el taller. Se recorta al dia y no tiene tope,
 *   porque un dia entero cabe en una pantalla.
 * - **El historial de un cliente**: que le hicimos a esta persona. No se
 *   recorta por dia —si su ultimo lavado fue en marzo, el recorte lo dejaria
 *   vacio y la ficha mentiria— y si se limita a los ultimos, porque un cliente
 *   fiel tiene cientos y nadie los lee.
 *
 * La decision vive aca, pura, y no dentro del `where` de Prisma: es una regla
 * de producto, y ahi adentro no se puede leer ni probar.
 */

/** Cuantos lavados muestra la ficha de un cliente. */
export const CUSTOMER_HISTORY_LIMIT = 20;

export interface TicketQueryPlan {
  /** `true` si la consulta se recorta a un dia. */
  byDay: boolean;
  /** El dia pedido (`YYYY-MM-DD`). Sin el, y con `byDay`, es hoy. */
  date?: string;
  /** Tope de filas, o `null` cuando no hay. */
  limit: number | null;
}

export function planTicketQuery(filter: { date?: string; customerId?: string }): TicketQueryPlan {
  // Pedir el historial de un cliente manda sobre el dia: quien pregunta por
  // una persona pregunta por su historia, aunque de paso haya mandado fecha.
  if (filter.customerId !== undefined) {
    return { byDay: false, limit: CUSTOMER_HISTORY_LIMIT };
  }

  return { byDay: true, date: filter.date, limit: null };
}
