import { RENTAL_SETTINGS_DEFAULTS } from '@elite/shared';

import { contractMoney, paperDateParts } from '../rental-documents/print-layout';
import { settingsFormValuesOf } from './settings-form';
import { blankAgreement, previewSettings, zoneOf } from './sheet-preview';

const VALUES = settingsFormValuesOf({
  ...RENTAL_SETTINGS_DEFAULTS,
  logoUrl: null,
  updatedAt: '2026-10-01T12:00:00.000Z',
});

describe('vista previa de la hoja (120)', () => {
  it('lleva lo que se está escribiendo, sin guardar', () => {
    const settings = previewSettings(
      { ...VALUES, companyName: ' Otra ', vatRate: '13', clauses: ['Una', '  '], nrc: '' },
      '/files/logo',
      'x',
    );

    expect(settings).toMatchObject({
      companyName: 'Otra',
      vatRate: '13',
      clauses: ['Una'],
      nrc: null,
      contractStartNumber: 733,
      logoUrl: null,
    });
  });

  it('el logo sale solo si hay uno elegido', () => {
    expect(previewSettings({ ...VALUES, logoFileId: 'abc' }, '/files/abc', 'x').logoUrl).toBe(
      '/files/abc',
    );
  });

  it('un número a medio escribir no rompe la hoja', () => {
    const settings = previewSettings(
      { ...VALUES, contractStartNumber: '', vatRate: '1,', interestRate: '5' },
      null,
      'x',
    );

    expect(settings.contractStartNumber).toBe(0);
    expect(settings.vatRate).toBe('0');
    expect(settings.interestRate).toBe('5');
    expect(blankAgreement(settings).contractNumber).toBeNull();
  });

  it('el contrato en blanco lleva el CDW y el deducible, y la cuenta en cero', () => {
    const settings = previewSettings(
      { ...VALUES, defaultCdwPerDay: '8.50', defaultDeductible: 'x' },
      null,
      'x',
    );
    const agreement = blankAgreement(settings);

    expect(agreement.contractNumber).toBe(733);
    expect(agreement.cdwPerDay).toBe('8.50');
    expect(agreement.deductible).toBe('0.00');
    expect(contractMoney(agreement, settings.vatRate).totalCents).toBe(0);
  });

  it('sin fecha, el pie del pagaré queda en blanco', () => {
    expect(paperDateParts('')).toEqual({ day: '', month: '', year: '' });
  });

  it('la zona de cada campo', () => {
    expect(zoneOf('companyName')).toBe('head');
    expect(zoneOf('interestRate')).toBe('pagare');
    expect(zoneOf('graceHours')).toBeNull();
    expect(zoneOf(null)).toBeNull();
  });
});
