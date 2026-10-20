import { RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';
import type { RentalSettings } from '@elite/shared';

import {
  changedFields,
  changeSummary,
  errorSummary,
  sectionHasChanges,
  sectionOf,
} from './settings-changes';
import { settingsFormValuesOf } from './settings-form';

const SAVED = settingsFormValuesOf({
  ...RENTAL_SETTINGS_DEFAULTS,
  logoUrl: null,
  updatedAt: '2026-10-01T12:00:00.000Z',
} satisfies RentalSettings);

describe('cambios de ajustes (120)', () => {
  it('sin tocar nada no hay cambios', () => {
    expect(changedFields({ ...SAVED }, SAVED)).toEqual([]);
  });

  it('lista los campos cambiados en el orden de las pestañas', () => {
    const current = {
      ...SAVED,
      accessories: [...SAVED.accessories, 'Gata'],
      vatRate: '13',
      companyName: 'Otra',
    };

    expect(changedFields(current, SAVED)).toEqual(['companyName', 'vatRate', 'accessories']);
  });

  it('una cláusula movida o editada cuenta, y los avisos de Servicio también (123)', () => {
    const clauses = [...SAVED.clauses];
    [clauses[0], clauses[1]] = [clauses[1] ?? '', clauses[0] ?? ''];

    expect(changedFields({ ...SAVED, clauses, kmAlert: '900' }, SAVED)).toEqual([
      'clauses',
      'kmAlert',
    ]);
    expect(sectionHasChanges('service', ['daysAlert'])).toBe(true);
    expect(changeSummary(['kmAlert', 'daysAlert'])).toEqual({
      title: '2 cambios',
      detail: 'Aviso en km, Aviso en días',
    });
  });

  it('el punto de la pestaña', () => {
    expect(sectionHasChanges('rules', ['vatRate'])).toBe(true);
    expect(sectionHasChanges('company', ['vatRate'])).toBe(false);
  });

  it('la pestaña de un error, también con ruta', () => {
    expect(sectionOf('clauses.3')).toBe('contract');
    expect(sectionOf('logoFileId')).toBe('company');
    expect(sectionOf('kmAlert')).toBe('service');
    expect(sectionOf('nada')).toBeNull();
  });

  it('el texto de la barra', () => {
    expect(changeSummary(['companyName'])).toEqual({ title: '1 cambio', detail: 'Nombre' });
    expect(changeSummary(['companyName', 'taxId', 'vatRate', 'clauses'])).toEqual({
      title: '4 cambios',
      detail: 'Nombre, NIT, IVA…',
    });
  });

  it('con errores dice cuántos campos revisar', () => {
    expect(errorSummary(['minDriverAge'])).toEqual({
      title: 'Revise 1 campo',
      detail: 'Edad mínima',
    });
    expect(errorSummary(['clauses', 'companyName', 'email'])).toEqual({
      title: 'Revise 3 campos',
      detail: 'Nombre, Correo…',
    });
  });
});
