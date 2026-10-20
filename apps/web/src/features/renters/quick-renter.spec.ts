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
  phoneComplete,
  quickRenterCreate,
  quickRenterUpdate,
  rentalHistoryLine,
  similarName,
  splitPhone,
} from './quick-renter';
import { PHONE_COUNTRIES, flagOf, phoneCountry, searchCountries } from './phone-countries';

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
    expect(maskPhone('71234567', 'SV')).toBe('7123-4567');
    expect(maskPhone('7123', 'GT')).toBe('7123');
    expect(maskPhone('71355501429', 'US')).toBe('(713) 555-0142');
    expect(maskPhone('8095550142', 'DO')).toBe('(809) 555-0142');
  });

  it('un país sin máscara: solo dígitos, de 6 al tope de E.164', () => {
    expect(maskPhone('612 34 56 78', 'FR')).toBe('612345678');
    expect(maskPhone('1'.repeat(20), 'FR')).toBe('1'.repeat(13));
    expect(phoneComplete('12345', 'FR')).toBe(false);
    expect(phoneComplete('612345678', 'FR')).toBe(true);
    expect(phoneComplete('7123-456', 'SV')).toBe(false);
  });

  it('RN-3: el de afuera con prefijo, el de casa sin él, y de vuelta', () => {
    expect(composePhone('SV', '7123-4567')).toBe('7123-4567');
    expect(composePhone('US', '(713) 555-0142')).toBe('+1 (713) 555-0142');
    expect(composePhone('FR', '612345678')).toBe('+33 612345678');
    expect(splitPhone('+1 (713) 555-0142')).toEqual({ country: 'US', phone: '(713) 555-0142' });
    expect(splitPhone('+33 612345678')).toEqual({ country: 'FR', phone: '612345678' });
    expect(splitPhone('7123-4567')).toEqual({ country: 'SV', phone: '7123-4567' });
    expect(splitPhone(null)).toEqual({ country: 'SV', phone: '' });
  });

  it('todos los países, con nombre en español y los de siempre arriba', () => {
    expect(PHONE_COUNTRIES.length).toBeGreaterThan(200);
    expect(PHONE_COUNTRIES.slice(0, 4).map((c) => c.iso)).toEqual(['SV', 'GT', 'HN', 'US']);
    expect(phoneCountry('MX')).toMatchObject({ code: '+52', name: 'México' });
    expect(new Set(PHONE_COUNTRIES.map((c) => c.iso)).size).toBe(PHONE_COUNTRIES.length);
  });

  it('buscar país por nombre sin acentos, sigla o código', () => {
    const isos = (query: string) => searchCountries(query).map((c) => c.iso);

    expect(isos('mexico')[0]).toBe('MX');
    expect(isos('salva')).toEqual(['SV']);
    expect(isos('reino unido')[0]).toBe('GB');
    expect(isos('es')[0]).toBe('ES');
    expect(isos('+52')[0]).toBe('MX');
    expect(isos('1')[0]).toBe('US');
    expect(isos('50').slice(0, 4)).toEqual(['SV', 'GT', 'HN', 'BZ']);
    expect(isos('zzz')).toEqual([]);
    expect(searchCountries('')).toHaveLength(PHONE_COUNTRIES.length);
    expect(flagOf('sv')).toBe('🇸🇻');
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
      quickRenterCreate({ ...COMPLETE, phoneCountry: 'US', phone: '(713) 555-0142' }).mobilePhone,
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
      phoneCountry: 'US',
      phone: '(713) 555-0142',
      licenseNumber: 'TX-1',
      licenseIsDocument: false,
      licenseExpiresAt: '2026-01-01',
    });
  });

  it('un DUI guardado sin guion vuelve con la máscara y la casilla de la licencia', () => {
    const renter = {
      fullName: 'Juan Pérez',
      documentId: '012345678',
      licenseNumber: '012345678',
      licenseExpiresAt: '2027-01-01',
      mobilePhone: '71234567',
      phone: null,
    } as Renter;

    expect(draftFromRenter(renter)).toMatchObject({
      documentKind: 'DUI',
      documentId: '01234567-8',
      phoneCountry: 'SV',
      phone: '7123-4567',
      licenseIsDocument: true,
    });
  });
});
