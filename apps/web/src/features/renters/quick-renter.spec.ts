import type { Renter } from '@elite/shared';

import {
  EMPTY_QUICK_RENTER,
  agoLabel,
  checkQuickRenter,
  composePhone,
  documentKindOf,
  draftFromRenter,
  draftFromSearch,
  duplicateDocument,
  licenseStampLabel,
  licenseStatus,
  maskDocument,
  maskDui,
  maskPhone,
  quickRenterCreate,
  quickRenterUpdate,
  rentalHistoryLine,
  similarName,
  splitPhone,
} from './quick-renter';

const TODAY = '2026-10-19';

const COMPLETE = {
  ...EMPTY_QUICK_RENTER,
  fullName: 'Juan Pérez',
  documentId: '01234567-8',
  phone: '7123-4567',
  licenseNumber: 'L-998',
  licenseExpiresAt: '2027-05-01',
};

describe('máscaras (118)', () => {
  it('DUI: 00000000-0 y nunca más de 9 dígitos', () => {
    expect(maskDui('0123')).toBe('0123');
    expect(maskDui('012345678')).toBe('01234567-8');
    expect(maskDui('01234567-89x')).toBe('01234567-8');
    expect(maskDocument('ab12345', 'PASSPORT')).toBe('AB12345');
  });

  it('celular con la máscara de su país', () => {
    expect(maskPhone('71234567', '+503')).toBe('7123-4567');
    expect(maskPhone('7123', '+502')).toBe('7123');
    expect(maskPhone('71355501429', '+1')).toBe('(713) 555-0142');
  });

  it('RN-3: el de afuera con prefijo, el de casa sin él, y de vuelta', () => {
    expect(composePhone('+503', '7123-4567')).toBe('7123-4567');
    expect(composePhone('+1', '(713) 555-0142')).toBe('+1 (713) 555-0142');
    expect(splitPhone('+1 (713) 555-0142')).toEqual({ code: '+1', phone: '(713) 555-0142' });
    expect(splitPhone('7123-4567')).toEqual({ code: '+503', phone: '7123-4567' });
    expect(splitPhone(null)).toEqual({ code: '+503', phone: '' });
  });

  it('el tipo de un documento guardado', () => {
    expect(documentKindOf('01234567-8')).toBe('DUI');
    expect(documentKindOf('012345678')).toBe('DUI');
    expect(documentKindOf('X1234567')).toBe('PASSPORT');
  });
});

describe('licencia (118)', () => {
  it('vigente, por vencer (≤ 30 días) o vencida', () => {
    expect(licenseStatus('2026-11-19', TODAY)).toBe('valid');
    expect(licenseStatus('2026-11-18', TODAY)).toBe('expiring');
    expect(licenseStatus(TODAY, TODAY)).toBe('expiring');
    expect(licenseStatus('2026-10-18', TODAY)).toBe('expired');
    expect(licenseStatus(null, TODAY)).toBeNull();
  });

  it('el sello dice el día si está por vencer', () => {
    expect(licenseStampLabel('expiring', '2026-11-02')).toBe('Licencia vence 02/11');
    expect(licenseStampLabel('expired', '2026-01-02')).toBe('Licencia vencida');
    expect(licenseStampLabel('valid', '2027-01-02')).toBe('Licencia vigente');
  });
});

describe('historial (118)', () => {
  it('cuenta rentas y dice hace cuánto fue la última', () => {
    expect(rentalHistoryLine(0, null, TODAY)).toBe('Cliente nuevo');
    expect(rentalHistoryLine(1, '2026-10-18', TODAY)).toBe('1 renta, la última ayer');
    expect(rentalHistoryLine(3, '2026-10-05', TODAY)).toBe('3 rentas, la última hace 2 semanas');
    expect(rentalHistoryLine(2, null, TODAY)).toBe('2 rentas');
    expect(agoLabel(TODAY, TODAY)).toBe('hoy');
    expect(agoLabel('2026-10-15', TODAY)).toBe('hace 4 días');
    expect(agoLabel('2026-08-19', TODAY)).toBe('hace 2 meses');
    expect(agoLabel('2025-01-01', TODAY)).toBe('hace más de un año');
  });
});

describe('alta rápida (118)', () => {
  it('lo buscado pasa a su campo', () => {
    expect(draftFromSearch('71234567')).toMatchObject({ phone: '7123-4567', documentId: '' });
    expect(draftFromSearch('012345678')).toMatchObject({ documentId: '01234567-8' });
    expect(draftFromSearch('Juan Pérez')).toMatchObject({ fullName: 'Juan Pérez' });
    expect(draftFromSearch('')).toEqual(EMPTY_QUICK_RENTER);
  });

  it('dice lo que falta y solo vale completo, vigente y sin repetido', () => {
    expect(checkQuickRenter(EMPTY_QUICK_RENTER, TODAY, false).missing).toEqual([
      'nombre',
      'documento',
      'celular',
      'licencia',
      'vencimiento',
    ]);
    expect(checkQuickRenter(COMPLETE, TODAY, false)).toEqual({
      missing: [],
      license: 'valid',
      valid: true,
    });
    expect(checkQuickRenter(COMPLETE, TODAY, true).valid).toBe(false);
    expect(
      checkQuickRenter({ ...COMPLETE, licenseExpiresAt: '2026-10-01' }, TODAY, false),
    ).toMatchObject({ license: 'expired', valid: false });
    expect(
      checkQuickRenter({ ...COMPLETE, documentKind: 'PASSPORT', documentId: 'X12' }, TODAY, false)
        .missing,
    ).toEqual(['documento']);
  });

  it('«Es el mismo número del DUI» usa el documento de licencia', () => {
    const draft = { ...COMPLETE, licenseNumber: '', licenseIsDocument: true };

    expect(checkQuickRenter(draft, TODAY, false).valid).toBe(true);
    expect(quickRenterCreate(draft)).toMatchObject({
      fullName: 'Juan Pérez',
      documentId: '01234567-8',
      licenseNumber: '01234567-8',
      mobilePhone: '7123-4567',
      licenseExpiresAt: '2027-05-01',
    });
  });

  it('actualizar no toca el bloqueo', () => {
    expect(quickRenterUpdate(COMPLETE)).not.toHaveProperty('isBlocked');
    expect(
      quickRenterCreate({ ...COMPLETE, phoneCode: '+1', phone: '(713) 555-0142' }).mobilePhone,
    ).toBe('+1 (713) 555-0142');
  });

  it('documento repetido y nombre parecido', () => {
    const others = [
      { id: 'a', fullName: 'María José Pérez', documentId: '012345678' },
      { id: 'b', fullName: 'Ana López', documentId: null },
    ];

    expect(duplicateDocument(COMPLETE, others, null)?.id).toBe('a');
    expect(duplicateDocument(COMPLETE, others, 'a')).toBeNull();
    expect(duplicateDocument({ ...COMPLETE, documentId: '0123' }, others, null)).toBeNull();
    expect(similarName({ ...COMPLETE, fullName: 'maria jose' }, others)?.id).toBe('a');
    expect(similarName({ ...COMPLETE, fullName: 'an' }, others)).toBeNull();
  });

  it('un cliente guardado vuelve al formulario', () => {
    const renter = {
      fullName: 'Ann Lee',
      documentId: 'P1234567',
      licenseNumber: 'TX-1',
      licenseExpiresAt: '2026-01-01',
      mobilePhone: '+1 (713) 555-0142',
      phone: null,
    } as Renter;

    expect(draftFromRenter(renter)).toEqual({
      fullName: 'Ann Lee',
      documentKind: 'PASSPORT',
      documentId: 'P1234567',
      phoneCode: '+1',
      phone: '(713) 555-0142',
      licenseNumber: 'TX-1',
      licenseIsDocument: false,
      licenseExpiresAt: '2026-01-01',
    });
  });
});
