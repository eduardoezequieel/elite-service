'use client';

import type { Renter, RenterListItem } from '@elite/shared';
import { Check, Plus, Search, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePickerField } from '@/components/ui/date-picker-field';
import { ListSkeleton } from '@/components/ui/skeleton';
import { Stamp } from '@/components/ui/stamp';
import { TextField } from '@/features/inventory/components/form-fields';
import { foldText, initialsOf } from '@/features/inventory/delivery';
import { useRenters } from '@/features/renters/hooks/use-renters';
import {
  DOCUMENT_KIND_LABELS,
  PHONE_COUNTRIES,
  checkQuickRenter,
  dmy,
  documentComplete,
  documentKindOf,
  duplicateDocument,
  licenseDaysLeft,
  licenseStampLabel,
  licenseStatus,
  maskDocument,
  maskPhone,
  rentalHistoryLine,
  similarName,
  type DocumentKind,
  type LicenseStatus,
  type PhoneCode,
  type QuickRenterCheck,
  type QuickRenterDraft,
} from '@/features/renters/quick-renter';
import { renterAlerts } from '@/features/renters/renter-alerts';
import type { CivilDate } from '@/lib/civil-date';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { cn } from '@/lib/utils';

import { instantToCivil } from '../datetime';
import { ChoiceField } from './rental-fields';
import { SearchBox } from './new-rental-car-step';

/** Cuántos «Recientes» y cuántos resultados se piden. */
const RECENT_COUNT = 5;
const RESULTS_PAGE = 30;

/** El alta o la actualización abierta en el paso Cliente. */
export interface ClientFormState {
  draft: QuickRenterDraft;
  /** El cliente que se actualiza, o `null` si es nuevo. */
  editingId: string | null;
}

/** Los avisos en vivo del formulario, contra `GET /renters?q=`. */
export interface QuickRenterMatches {
  duplicate: RenterListItem | null;
  nameMatch: RenterListItem | null;
  /** Todavía se está mirando si el documento está repetido. */
  checking: boolean;
}

export function useQuickRenterMatches(form: ClientFormState | null): QuickRenterMatches {
  const draft = form?.draft ?? null;
  const editingId = form?.editingId ?? null;
  const documentQuery = draft !== null && documentComplete(draft) ? draft.documentId.trim() : '';
  const nameQuery =
    draft !== null && editingId === null && foldText(draft.fullName.trim()).length >= 3
      ? draft.fullName.trim()
      : '';
  const documentSearch = useDebouncedValue(documentQuery);
  const nameSearch = useDebouncedValue(nameQuery);
  const byDocument = useRenters({ q: documentSearch, pageSize: 10 }, documentSearch !== '');
  const byName = useRenters({ q: nameSearch, pageSize: 10 }, nameSearch !== '');

  const duplicate =
    draft === null || documentQuery === ''
      ? null
      : duplicateDocument(draft, byDocument.data?.items ?? [], editingId);
  const nameMatch =
    draft === null || duplicate !== null || nameQuery === ''
      ? null
      : similarName(draft, byName.data?.items ?? []);

  return {
    duplicate,
    nameMatch,
    checking: documentQuery !== '' && (documentSearch !== documentQuery || byDocument.isFetching),
  };
}

/**
 * Paso 2 · Cliente (118), según el prototipo «Paso 2 Cliente»: buscar y
 * elegir, o crear y guardar sin salir. Elegir no avanza solo.
 */
export function NewRentalClientStep(props: {
  today: CivilDate;
  minDriverAge: number;
  query: string;
  onQuery: (query: string) => void;
  customerId: string;
  chosen: Renter | undefined;
  onChoose: (customerId: string) => void;
  canManage: boolean;
  onNew: () => void;
  onEditChosen: () => void;
  form: ClientFormState | null;
  onDraft: (draft: QuickRenterDraft) => void;
  onBackToSearch: () => void;
  onUse: (customerId: string) => void;
  matches: QuickRenterMatches;
  check: QuickRenterCheck | null;
}) {
  if (props.form !== null && props.check !== null) {
    return (
      <ClientForm
        today={props.today}
        form={props.form}
        onDraft={props.onDraft}
        onBackToSearch={props.onBackToSearch}
        onUse={props.onUse}
        matches={props.matches}
        check={props.check}
      />
    );
  }

  return <ClientSearch {...props} />;
}

function ClientSearch({
  today,
  minDriverAge,
  query,
  onQuery,
  customerId,
  chosen,
  onChoose,
  canManage,
  onNew,
  onEditChosen,
}: {
  today: CivilDate;
  minDriverAge: number;
  query: string;
  onQuery: (query: string) => void;
  customerId: string;
  chosen: Renter | undefined;
  onChoose: (customerId: string) => void;
  canManage: boolean;
  onNew: () => void;
  onEditChosen: () => void;
}) {
  const search = useDebouncedValue(query.trim());
  const renters = useRenters(
    search === ''
      ? { sort: 'recent', pageSize: RECENT_COUNT }
      : { q: search, pageSize: RESULTS_PAGE },
  );
  const items = renters.data?.items ?? [];
  const typed = query.trim();
  const pinned =
    chosen !== undefined && chosen.id === customerId && !items.some((item) => item.id === chosen.id)
      ? chosen
      : null;

  return (
    <>
      <SearchBox
        id="new-rental-client-search"
        label="Buscar cliente"
        value={query}
        onChange={onQuery}
        placeholder="Buscar por nombre, DUI o teléfono"
      />

      <div className="flex flex-col gap-2">
        {renters.isPending ? (
          <ListSkeleton rows={3} label="Buscando clientes" />
        ) : renters.error !== null ? (
          <p className="text-danger-text text-body" role="alert">
            {renters.error.message}
          </p>
        ) : (
          <>
            <div className="text-text-dim flex flex-wrap justify-between gap-x-3 text-dense font-semibold">
              <span>
                {search === ''
                  ? 'Recientes'
                  : `${renters.data.total} ${renters.data.total === 1 ? 'resultado' : 'resultados'}`}
              </span>
              {customerId === '' && items.length > 0 ? (
                <span className="font-medium">Elija un cliente para seguir</span>
              ) : null}
            </div>

            {items.length === 0 && pinned === null ? (
              <div className="border-line text-text-dim flex flex-col items-center gap-3.5 rounded-control border border-dashed px-5 py-7 text-center">
                <p>{typed === '' ? 'Sin clientes' : `Nadie coincide con «${typed}».`}</p>
                {canManage ? (
                  <Button type="button" variant="outline" onClick={onNew}>
                    <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
                    {typed === '' ? 'Cliente nuevo' : `Crear cliente con «${typed}»`}
                  </Button>
                ) : null}
              </div>
            ) : (
              <>
                {pinned === null ? null : (
                  <RenterCard renter={pinned} today={today} picked onPick={() => onChoose('')} />
                )}
                {items.map((renter) => (
                  <RenterCard
                    key={renter.id}
                    renter={renter}
                    today={today}
                    picked={renter.id === customerId}
                    onPick={() => onChoose(renter.id === customerId ? '' : renter.id)}
                  />
                ))}
                {canManage ? (
                  <button
                    type="button"
                    onClick={onNew}
                    className="border-line text-text hover:border-flame flex min-h-[max(var(--control-h),var(--touch-min))] items-center justify-center gap-2 rounded-control border border-dashed font-semibold transition-colors duration-(--duration-state) ease-standard"
                  >
                    <Plus className="size-icon" strokeWidth={1.5} aria-hidden />
                    Cliente nuevo
                  </button>
                ) : null}
              </>
            )}
          </>
        )}

        {chosen !== undefined && chosen.id === customerId ? (
          <ChosenAlerts
            renter={chosen}
            today={today}
            minDriverAge={minDriverAge}
            canManage={canManage}
            onEdit={onEditChosen}
          />
        ) : null}
      </div>
    </>
  );
}

const LICENSE_TONES: Record<LicenseStatus, 'green' | 'amber' | 'red'> = {
  valid: 'green',
  expiring: 'amber',
  expired: 'red',
};

/** La tarjeta del cliente: iniciales, nombre, documento, teléfono, rentas y licencia. */
function RenterCard({
  renter,
  today,
  picked,
  onPick,
}: {
  renter: Renter | RenterListItem;
  today: CivilDate;
  picked: boolean;
  onPick: () => void;
}) {
  const status = licenseStatus(renter.licenseExpiresAt, today);
  const phone = renter.mobilePhone ?? renter.phone;
  const history =
    'rentalsCount' in renter
      ? rentalHistoryLine(
          renter.rentalsCount,
          renter.lastRentalAt === null ? null : instantToCivil(renter.lastRentalAt),
          today,
        )
      : null;
  const noRent = renter.isBlocked || !renter.isActive;

  return (
    <button
      type="button"
      aria-pressed={picked}
      onClick={onPick}
      className={cn(
        'border-line bg-surface-2 flex w-full items-center gap-3.5 rounded-control border-(length:--selectable-border) px-4 py-3.5 text-left',
        'transition-[border-color,background-color] duration-(--duration-state) ease-standard hover:border-flame/55',
        picked && 'border-flame bg-surface-3',
      )}
    >
      <span
        aria-hidden
        className="bg-surface-3 text-text-dim grid size-10 shrink-0 place-items-center rounded-full text-body font-bold [[data-density=bahia]_&]:size-12"
      >
        {initialsOf(renter.fullName)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-title font-semibold">{renter.fullName}</span>
        <span className="text-text-dim mt-0.5 flex flex-wrap gap-x-3.5 gap-y-0.5 text-dense">
          {renter.documentId === null ? null : (
            <span>
              <span className="text-text-faint">
                {DOCUMENT_KIND_LABELS[documentKindOf(renter.documentId)]}
              </span>{' '}
              <span className="font-mono tabular-nums">{renter.documentId}</span>
            </span>
          )}
          {phone === null ? null : (
            <span>
              <span className="text-text-faint">Tel.</span>{' '}
              <span className="font-mono tabular-nums">{phone}</span>
            </span>
          )}
        </span>
        {history === null ? null : (
          <span className="text-text-faint mt-0.5 block text-dense">{history}</span>
        )}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-2">
        {noRent ? (
          <Stamp tone="red" label="No rentar" />
        ) : status === null || renter.licenseExpiresAt === null ? null : (
          <Stamp
            tone={LICENSE_TONES[status]}
            label={licenseStampLabel(status, renter.licenseExpiresAt)}
          />
        )}
        {picked ? (
          <span className="bg-flame text-primary-foreground grid size-5.5 place-items-center rounded-full">
            <Check className="size-3.5" strokeWidth={3} aria-hidden />
            <span className="sr-only">Elegido</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

/** Un aviso con su tono: rojo frena, ámbar avisa, azul pregunta. */
function Notice({
  tone,
  children,
  action,
  alert = false,
}: {
  tone: 'red' | 'amber' | 'info';
  children: ReactNode;
  action?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div
      role={alert ? 'alert' : undefined}
      className={cn(
        'tint flex flex-wrap items-center gap-x-3.5 gap-y-2.5 rounded-control border px-4 py-3 leading-normal',
        tone === 'red' && 'text-danger-text',
        tone === 'amber' && 'text-warn-text',
        tone === 'info' && 'text-info-text',
      )}
    >
      <span className="min-w-0 flex-[1_1_220px] text-body">{children}</span>
      {action}
    </div>
  );
}

/** Los avisos del elegido: no rentar, licencia vencida o por vencer, edad. */
function ChosenAlerts({
  renter,
  today,
  minDriverAge,
  canManage,
  onEdit,
}: {
  renter: Renter;
  today: CivilDate;
  minDriverAge: number;
  canManage: boolean;
  onEdit: () => void;
}) {
  const first = renter.fullName.trim().split(/\s+/)[0] ?? renter.fullName;
  const status = licenseStatus(renter.licenseExpiresAt, today);
  const others = renterAlerts(renter, today, minDriverAge).filter(
    (alert) => alert.key === 'blocked' || alert.key === 'underage',
  );

  return (
    <>
      {others.map((alert) => (
        <Notice key={alert.key} tone={alert.key === 'blocked' ? 'red' : 'amber'} alert>
          {alert.message}
        </Notice>
      ))}
      {status === 'expired' && renter.licenseExpiresAt !== null ? (
        <Notice
          tone="red"
          alert
          action={
            canManage ? (
              <Button type="button" variant="outline" size="sm" onClick={onEdit}>
                Actualizar licencia
              </Button>
            ) : undefined
          }
        >
          La licencia de {first} venció el {dmy(renter.licenseExpiresAt)}. Pida la licencia nueva
          para seguir.
        </Notice>
      ) : null}
      {status === 'expiring' && renter.licenseExpiresAt !== null ? (
        <Notice tone="amber">
          La licencia de {first} vence el {dmy(renter.licenseExpiresAt)}. Puede rentar, pero
          recuérdele renovarla.
        </Notice>
      ) : null}
    </>
  );
}

const DOCUMENT_OPTIONS = (Object.keys(DOCUMENT_KIND_LABELS) as DocumentKind[]).map((kind) => ({
  value: kind,
  label: DOCUMENT_KIND_LABELS[kind],
}));

const COUNTRY_OPTIONS = PHONE_COUNTRIES.map((country) => ({
  value: country.code,
  label: `${country.iso} ${country.code}`,
}));

/** Crear o actualizar: lo justo para el contrato, con los avisos en vivo. */
function ClientForm({
  today,
  form,
  onDraft,
  onBackToSearch,
  onUse,
  matches,
  check,
}: {
  today: CivilDate;
  form: ClientFormState;
  onDraft: (draft: QuickRenterDraft) => void;
  onBackToSearch: () => void;
  onUse: (customerId: string) => void;
  matches: QuickRenterMatches;
  check: QuickRenterCheck;
}) {
  const { draft } = form;
  const isDui = draft.documentKind === 'DUI';
  const patch = (changes: Partial<QuickRenterDraft>) => onDraft({ ...draft, ...changes });
  const days = draft.licenseExpiresAt === '' ? 0 : licenseDaysLeft(draft.licenseExpiresAt, today);

  return (
    <>
      <button
        type="button"
        onClick={onBackToSearch}
        className="border-line bg-surface-2 text-text-dim hover:border-flame flex min-h-13 w-full items-center gap-3 rounded-control border py-1.5 pr-2 pl-4 text-left transition-colors duration-(--duration-state) ease-standard"
      >
        <Search className="size-icon shrink-0" strokeWidth={1.5} aria-hidden />
        <span className="min-w-0 flex-1">¿Ya es cliente? Búsquelo por nombre, DUI o teléfono</span>
        <span className="border-line bg-surface text-text hidden shrink-0 rounded-control border px-3 py-1.5 text-dense font-semibold sm:inline">
          Volver a buscar
        </span>
      </button>

      <h2 className="text-title">
        {form.editingId === null ? 'Cliente nuevo' : 'Actualizar cliente'}
      </h2>

      <TextField
        id="new-rental-renter-name"
        label="Nombre completo"
        placeholder="Como aparece en el documento"
        value={draft.fullName}
        onChange={(event) => patch({ fullName: event.target.value })}
      />
      {matches.nameMatch === null ? null : (
        <Notice
          tone="info"
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => matches.nameMatch && onUse(matches.nameMatch.id)}
            >
              Usar este cliente
            </Button>
          }
        >
          ¿Es {matches.nameMatch.fullName}? Ya está registrado.
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <div className="flex min-w-0 gap-2">
          <ChoiceField
            id="new-rental-renter-kind"
            label="Tipo"
            className="w-32 shrink-0"
            options={DOCUMENT_OPTIONS}
            value={draft.documentKind}
            onChange={(value) => {
              const kind = value as DocumentKind;
              patch({
                documentKind: kind,
                documentId: maskDocument(draft.documentId, kind),
                licenseIsDocument: kind === 'DUI' ? draft.licenseIsDocument : false,
              });
            }}
          />
          <TextField
            id="new-rental-renter-document"
            label="Documento"
            className="min-w-0 flex-1"
            mono
            inputMode={isDui ? 'numeric' : 'text'}
            placeholder={isDui ? '00000000-0' : 'Número de pasaporte'}
            value={draft.documentId}
            onChange={(event) =>
              patch({ documentId: maskDocument(event.target.value, draft.documentKind) })
            }
          />
        </div>
        <div className="flex min-w-0 gap-2">
          <ChoiceField
            id="new-rental-renter-country"
            label="País"
            className="w-32 shrink-0"
            options={COUNTRY_OPTIONS}
            value={draft.phoneCode}
            onChange={(value) => patch({ phoneCode: value as PhoneCode, phone: '' })}
          />
          <TextField
            id="new-rental-renter-phone"
            label="Celular"
            className="min-w-0 flex-1"
            mono
            type="tel"
            inputMode="tel"
            placeholder={PHONE_COUNTRIES.find((c) => c.code === draft.phoneCode)?.mask}
            value={draft.phone}
            onChange={(event) => patch({ phone: maskPhone(event.target.value, draft.phoneCode) })}
          />
        </div>
      </div>

      {matches.duplicate === null ? null : (
        <Notice
          tone="amber"
          alert
          action={
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => matches.duplicate && onUse(matches.duplicate.id)}
            >
              Usar este cliente
            </Button>
          }
        >
          Este documento ya es de {matches.duplicate.fullName}.
        </Notice>
      )}

      <div className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <div className="flex flex-col gap-1">
          <TextField
            id="new-rental-renter-license"
            label="Número de licencia"
            mono
            disabled={isDui && draft.licenseIsDocument}
            value={isDui && draft.licenseIsDocument ? draft.documentId : draft.licenseNumber}
            onChange={(event) => patch({ licenseNumber: event.target.value })}
          />
          {isDui ? (
            <label
              htmlFor="new-rental-renter-same"
              className="text-text-dim flex min-h-(--touch-min) cursor-pointer items-center gap-2.5 text-dense"
            >
              <Checkbox
                id="new-rental-renter-same"
                checked={draft.licenseIsDocument}
                onCheckedChange={(checked) => patch({ licenseIsDocument: checked === true })}
              />
              Es el mismo número del DUI
            </label>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <DatePickerField
            id="new-rental-renter-license-expires"
            label="La licencia vence el"
            value={draft.licenseExpiresAt}
            onChange={(date) => patch({ licenseExpiresAt: date })}
            error={
              check.license === 'expired'
                ? 'Ya venció. No se puede rentar con esta licencia.'
                : undefined
            }
          />
          {check.license === 'valid' ? (
            <p className="text-go-text text-dense">Vigente</p>
          ) : check.license === 'expiring' ? (
            <p className="text-warn-text text-dense">
              Vence en {days} {days === 1 ? 'día' : 'días'}. Recuérdele renovarla.
            </p>
          ) : null}
        </div>
      </div>

      {check.missing.length === 0 ? null : (
        <p className="border-line-soft text-text-dim flex items-center gap-2 border-t pt-3 text-dense">
          <TriangleAlert className="size-icon shrink-0" strokeWidth={1.5} aria-hidden />
          Para guardar falta: {check.missing.join(', ')}.
        </p>
      )}
    </>
  );
}

/** El chequeo del formulario con el repetido ya resuelto. */
export function quickRenterCheckOf(
  form: ClientFormState | null,
  today: CivilDate,
  matches: QuickRenterMatches,
): QuickRenterCheck | null {
  if (form === null) return null;

  return checkQuickRenter(form.draft, today, matches.duplicate !== null);
}
