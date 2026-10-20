/**
 * Cómo se lee en pantalla el mantenimiento de la flota (099). Puro: lo que
 * llega del API ya trae el estado; acá se cuenta y se rotula.
 */

function count(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

/** «Cada 5000 km o 90 días». */
export function intervalLabel(task: { intervalKm: number | null; intervalDays: number | null }) {
  const parts = [
    task.intervalKm === null ? null : `${task.intervalKm} km`,
    task.intervalDays === null ? null : count(task.intervalDays, 'día', 'días'),
  ].filter((part): part is string => part !== null);

  return parts.length === 0 ? '—' : `Cada ${parts.join(' o ')}`;
}

/** El enlace de WhatsApp con el texto ya escrito; el número lo elige quien lo manda. */
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
