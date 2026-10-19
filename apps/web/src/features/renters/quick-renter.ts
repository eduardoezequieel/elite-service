import { createRenterSchema, updateRenterSchema } from '@elite/shared';
import type { CreateRenterInput, Renter, RenterListItem, UpdateRenterInput } from '@elite/shared';

import { foldText } from '@/features/inventory/delivery';
import { parseCivil, type CivilDate } from '@/lib/civil-date';

/**
 * El cliente en la nueva renta (118): buscar, crear o actualizar sin salir del
 * asistente. Todo puro: máscaras, licencia, repetidos y lo que falta para
 * guardar. El tipo de documento y el país del celular son solo de pantalla:
 * el contrato guarda el documento tal cual y el celular de afuera con su
 * prefijo (RN-3).
 */

/** Los países del celular, con su máscara (`0` = un dígito). El primero es el de casa. */
export const PHONE_COUNTRIES = [
  { code: '+503', iso: 'SV', mask: '0000-0000' },
  { code: '+502', iso: 'GT', mask: '0000-0000' },
  { code: '+504', iso: 'HN', mask: '0000-0000' },
  { code: '+1', iso: 'US', mask: '(000) 000-0000' },
] as const;

export type PhoneCode = (typeof PHONE_COUNTRIES)[number]['code'];

const HOME_CODE: PhoneCode = '+503';

export type DocumentKind = 'DUI' | 'PASSPORT';

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  DUI: 'DUI',
  PASSPORT: 'Pasaporte',
};

/** Dígitos del DUI y mínimo de un pasaporte. */
export const DUI_DIGITS = 9;
export const PASSPORT_MIN = 5;
/** Desde cuántos días antes de vencer se avisa (≤ 30). */
export const LICENSE_WARNING_DAYS = 30;

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/** `'012345678'` → `'01234567-8'`; corta en 9 dígitos. */
export function maskDui(value: string): string {
  const digits = onlyDigits(value).slice(0, DUI_DIGITS);

  return digits.length > 8 ? `${digits.slice(0, 8)}-${digits.slice(8)}` : digits;
}

function countryOf(code: string) {
  return PHONE_COUNTRIES.find((country) => country.code === code) ?? PHONE_COUNTRIES[0];
}

/** Cuántos dígitos lleva el celular de ese país. */
export function phoneDigits(code: PhoneCode): number {
  return countryOf(code).mask.replace(/[^0]/g, '').length;
}

/** El celular con la máscara de su país: `'71234567'` → `'7123-4567'`. */
export function maskPhone(value: string, code: PhoneCode): string {
  const digits = onlyDigits(value);
  let out = '';
  let index = 0;

  for (const char of countryOf(code).mask) {
    if (index >= digits.length) break;
    if (char === '0') {
      out += digits[index];
      index += 1;
    } else {
      out += char;
    }
  }

  return out;
}

/** RN-3: el de casa sin prefijo; el de afuera, `'+1 (713) 555-0142'`. */
export function composePhone(code: PhoneCode, phone: string): string {
  const number = phone.trim();

  return code === HOME_CODE ? number : `${code} ${number}`;
}

/** El celular guardado, separado en país y número. Un prefijo que no conocemos queda en el número. */
export function splitPhone(stored: string | null): { code: PhoneCode; phone: string } {
  const text = (stored ?? '').trim();
  const match = /^(\+\d{1,3})\s+(.*)$/.exec(text);
  const country = match === null ? undefined : PHONE_COUNTRIES.find((c) => c.code === match[1]);

  if (match === null || country === undefined) return { code: HOME_CODE, phone: text };

  return { code: country.code, phone: maskPhone(match[2] ?? '', country.code) };
}

/** Un documento guardado que parece DUI (`00000000-0`), o pasaporte si no. */
export function documentKindOf(documentId: string | null): DocumentKind {
  if (documentId === null || documentId.trim() === '') return 'DUI';

  return /^\d{8}-?\d$/.test(documentId.trim()) ? 'DUI' : 'PASSPORT';
}

/** Lo que se teclea en el documento, según su tipo. */
export function maskDocument(value: string, kind: DocumentKind): string {
  return kind === 'DUI' ? maskDui(value) : value.toUpperCase();
}

function dayCount(from: CivilDate, to: CivilDate): number {
  return Math.round((parseCivil(to).getTime() - parseCivil(from).getTime()) / 86_400_000);
}

export type LicenseStatus = 'valid' | 'expiring' | 'expired';

/** Vigente, por vencer (≤ 30 días) o vencida. Sin fecha, `null`. */
export function licenseStatus(expiresAt: CivilDate | null, today: CivilDate): LicenseStatus | null {
  if (expiresAt === null || expiresAt === '') return null;

  const days = dayCount(today, expiresAt);
  if (days < 0) return 'expired';

  return days <= LICENSE_WARNING_DAYS ? 'expiring' : 'valid';
}

/** Días que le quedan a la licencia (negativo si ya venció). */
export function licenseDaysLeft(expiresAt: CivilDate, today: CivilDate): number {
  return dayCount(today, expiresAt);
}

/** `'2026-11-02'` → `'02/11/2026'`. */
export function dmy(civil: CivilDate): string {
  return `${civil.slice(8, 10)}/${civil.slice(5, 7)}/${civil.slice(0, 4)}`;
}

/** El sello de la licencia en la tarjeta. */
export function licenseStampLabel(status: LicenseStatus, expiresAt: CivilDate): string {
  if (status === 'expired') return 'Licencia vencida';
  if (status === 'expiring') return `Licencia vence ${dmy(expiresAt).slice(0, 5)}`;

  return 'Licencia vigente';
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

/** «hace 2 semanas», contado en días civiles. */
export function agoLabel(day: CivilDate, today: CivilDate): string {
  const days = dayCount(day, today);

  if (days <= 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 7) return `hace ${days} días`;
  if (days < 30) return `hace ${plural(Math.floor(days / 7), 'semana', 'semanas')}`;
  if (days < 365) return `hace ${plural(Math.floor(days / 30), 'mes', 'meses')}`;

  return 'hace más de un año';
}

/** «3 rentas, la última hace 2 semanas» o «Cliente nuevo». `lastDay` es el día civil de la última salida. */
export function rentalHistoryLine(
  rentalsCount: number,
  lastDay: CivilDate | null,
  today: CivilDate,
): string {
  if (rentalsCount === 0) return 'Cliente nuevo';

  const count = plural(rentalsCount, 'renta', 'rentas');

  return lastDay === null ? count : `${count}, la última ${agoLabel(lastDay, today)}`;
}

/** Lo que se escribe en el alta o la actualización rápida. */
export interface QuickRenterDraft {
  fullName: string;
  documentKind: DocumentKind;
  documentId: string;
  phoneCode: PhoneCode;
  phone: string;
  licenseNumber: string;
  /** «Es el mismo número del DUI»: la licencia es el documento. */
  licenseIsDocument: boolean;
  /** `YYYY-MM-DD` o `''`. */
  licenseExpiresAt: CivilDate;
}

export const EMPTY_QUICK_RENTER: QuickRenterDraft = {
  fullName: '',
  documentKind: 'DUI',
  documentId: '',
  phoneCode: HOME_CODE,
  phone: '',
  licenseNumber: '',
  licenseIsDocument: false,
  licenseExpiresAt: '',
};

/**
 * Lo escrito en la búsqueda pasa al campo que corresponde: 8 dígitos son un
 * celular, otros dígitos un documento y el texto, el nombre.
 */
export function draftFromSearch(query: string): QuickRenterDraft {
  const text = query.trim();
  const digits = onlyDigits(text);

  if (text !== '' && digits.length > 0 && digits.length === text.replace(/[\s-]/g, '').length) {
    return digits.length === 8
      ? { ...EMPTY_QUICK_RENTER, phone: maskPhone(digits, HOME_CODE) }
      : { ...EMPTY_QUICK_RENTER, documentId: maskDui(digits) };
  }

  return { ...EMPTY_QUICK_RENTER, fullName: text };
}

/** Un cliente ya registrado, para actualizarlo (la licencia vencida, casi siempre). */
export function draftFromRenter(renter: Renter): QuickRenterDraft {
  const documentKind = documentKindOf(renter.documentId);
  const documentId = renter.documentId ?? '';
  const { code, phone } = splitPhone(renter.mobilePhone ?? renter.phone);
  const licenseNumber = renter.licenseNumber ?? '';

  return {
    fullName: renter.fullName,
    documentKind,
    documentId,
    phoneCode: code,
    phone,
    licenseNumber,
    licenseIsDocument:
      documentKind === 'DUI' && licenseNumber !== '' && licenseNumber === documentId,
    licenseExpiresAt: renter.licenseExpiresAt ?? '',
  };
}

/** El número de licencia que vale: el del DUI si está marcada la casilla. */
export function draftLicense(draft: QuickRenterDraft): string {
  return draft.documentKind === 'DUI' && draft.licenseIsDocument
    ? draft.documentId
    : draft.licenseNumber;
}

/** `true` si el documento está completo para su tipo. */
export function documentComplete(draft: QuickRenterDraft): boolean {
  return draft.documentKind === 'DUI'
    ? onlyDigits(draft.documentId).length === DUI_DIGITS
    : draft.documentId.trim().length >= PASSPORT_MIN;
}

type Candidate = Pick<RenterListItem, 'id' | 'fullName' | 'documentId'>;

function documentKey(value: string | null): string {
  const text = (value ?? '').trim().toUpperCase();
  const digits = onlyDigits(text);

  return /^\d{8}-?\d$/.test(text) ? digits : text.replace(/[\s-]/g, '');
}

/** El cliente que ya tiene ese documento (otro que el que se edita), o `null`. */
export function duplicateDocument<T extends Candidate>(
  draft: QuickRenterDraft,
  candidates: readonly T[],
  editingId: string | null,
): T | null {
  if (!documentComplete(draft)) return null;
  const key = documentKey(draft.documentId);

  return (
    candidates.find(
      (candidate) => candidate.id !== editingId && documentKey(candidate.documentId) === key,
    ) ?? null
  );
}

/** Un nombre parecido ya registrado (solo al crear y sin documento repetido), o `null`. */
export function similarName<T extends Candidate>(
  draft: QuickRenterDraft,
  candidates: readonly T[],
): T | null {
  const name = foldText(draft.fullName.trim());
  if (name.length < 3) return null;

  return candidates.find((candidate) => foldText(candidate.fullName).includes(name)) ?? null;
}

export interface QuickRenterCheck {
  /** Lo que falta, en palabras: «nombre», «documento», «celular», «licencia», «vencimiento». */
  missing: string[];
  license: LicenseStatus | null;
  /** Todo completo, licencia no vencida y sin documento repetido. */
  valid: boolean;
}

export function checkQuickRenter(
  draft: QuickRenterDraft,
  today: CivilDate,
  duplicate: boolean,
): QuickRenterCheck {
  const missing: string[] = [];

  if (draft.fullName.trim().length < 3) missing.push('nombre');
  if (!documentComplete(draft)) missing.push('documento');
  if (onlyDigits(draft.phone).length !== phoneDigits(draft.phoneCode)) missing.push('celular');
  if (draftLicense(draft).trim() === '') missing.push('licencia');
  if (draft.licenseExpiresAt === '') missing.push('vencimiento');

  const license = licenseStatus(draft.licenseExpiresAt, today);

  return { missing, license, valid: missing.length === 0 && license !== 'expired' && !duplicate };
}

function quickRenterFields(draft: QuickRenterDraft) {
  return {
    fullName: draft.fullName.trim(),
    documentId: draft.documentId.trim(),
    mobilePhone: composePhone(draft.phoneCode, draft.phone),
    licenseNumber: draftLicense(draft).trim(),
    licenseExpiresAt: draft.licenseExpiresAt,
  };
}

/** El cuerpo del alta: los cinco datos del contrato. */
export function quickRenterCreate(draft: QuickRenterDraft): CreateRenterInput {
  return createRenterSchema.parse(quickRenterFields(draft));
}

/** El cuerpo de la actualización: solo esos cinco; bloqueo y lo demás no se tocan. */
export function quickRenterUpdate(draft: QuickRenterDraft): UpdateRenterInput {
  return updateRenterSchema.parse(quickRenterFields(draft));
}
