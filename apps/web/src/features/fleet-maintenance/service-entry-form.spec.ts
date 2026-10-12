import { MAINTENANCE_NOTE_MAX_LENGTH, maintenanceNoteLimitMessage } from '@elite/shared';

import { serviceEntryFormSchema, type ServiceEntryValues } from './service-entry-form';

const VEHICLE = '00000000-0000-4000-8000-000000000001';
const TASK = '00000000-0000-4000-8000-000000000002';

const VALID: ServiceEntryValues = {
  what: TASK,
  odometerKm: '40000',
  performedAt: '2026-10-01',
  cost: '',
  notes: '',
};

function issues(patch: Partial<ServiceEntryValues>) {
  const parsed = serviceEntryFormSchema(VEHICLE).safeParse({ ...VALID, ...patch });
  if (parsed.success) return {};

  const messages: Record<string, string> = {};
  for (const issue of parsed.error.issues) {
    const field = String(issue.path[0] ?? 'root');
    if (messages[field] === undefined) messages[field] = issue.message;
  }
  return messages;
}

describe('serviceEntryFormSchema', () => {
  it('arma el servicio con el km entero y la nota vacía en null', () => {
    expect(serviceEntryFormSchema(VEHICLE).parse(VALID)).toMatchObject({
      vehicleId: VEHICLE,
      taskIds: [TASK],
      performedAt: '2026-10-01',
      odometerKm: 40000,
      cost: null,
      notes: null,
    });
  });

  it('el km vacío, con letras o pasado de tope cae en el campo', () => {
    expect(issues({ odometerKm: '' }).odometerKm).toBe('Escribí el kilometraje.');
    expect(issues({ odometerKm: '12a' }).odometerKm).toBe('Tiene que ser un número entero.');
    expect(issues({ odometerKm: '2000001' }).odometerKm).toMatch(/No puede pasar de/);
    expect(issues({ odometerKm: '0' }).odometerKm).toBeUndefined();
  });

  it('la fecha vacía y el servicio sin elegir caen en su campo', () => {
    expect(issues({ performedAt: '' }).performedAt).toBe('Elegí la fecha.');
    expect(issues({ what: '' }).what).toBe('Elegí qué se hizo.');
  });

  it('la nota pasa de 1000 caracteres y el costo ilegible caen en su campo', () => {
    expect(issues({ notes: 'a'.repeat(MAINTENANCE_NOTE_MAX_LENGTH + 1) }).notes).toBe(
      maintenanceNoteLimitMessage(),
    );
    expect(issues({ notes: 'a'.repeat(MAINTENANCE_NOTE_MAX_LENGTH) }).notes).toBeUndefined();
    expect(issues({ cost: 'abc' }).cost).toBe('Escribí un monto válido, con hasta dos decimales.');
  });
});
