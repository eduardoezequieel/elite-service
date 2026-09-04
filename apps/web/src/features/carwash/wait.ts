const TIME = new Intl.DateTimeFormat('es-SV', { hour: 'numeric', minute: '2-digit' });

/** Hora de entrada en la zona local. */
export function timeOf(iso: string): string {
  return TIME.format(new Date(iso));
}

/** Espera desde `iso` hasta ahora, en español corto. */
export function waitLabel(iso: string): string {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));

  if (minutes < 1) return 'recién';
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);

  return `${hours} h ${minutes % 60} min`;
}
