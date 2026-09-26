import type { CashSession, CashSessionActor } from '@elite/shared';

type SessionActors = Pick<CashSession, 'openedBy' | 'closedBy'>;

/**
 * Las firmas del turno, sin repetir: quien abrió y, si es otro, quien cerró.
 *
 * Un turno puede cambiar de mano a mitad de camino —abre el del mostrador,
 * cierra el encargado—, y eso es justo lo que el historial tiene que poder
 * auditar. De acá salen las opciones del filtro «Quién», que antes miraba a uno
 * solo de los dos y escondía al otro.
 */
export function sessionActors(session: SessionActors): CashSessionActor[] {
  const { openedBy, closedBy } = session;

  if (closedBy === null || closedBy.id === openedBy.id) return [openedBy];

  return [openedBy, closedBy];
}

/** Verdadero si esa persona abrió **o** cerró el turno. */
export function matchesActor(session: SessionActors, actorId: string): boolean {
  return sessionActors(session).some((actor) => actor.id === actorId);
}
