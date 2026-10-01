'use client';

import { PERMISSIONS, createRenterSchema } from '@elite/shared';
import { TriangleAlert, UserPlus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { FieldError, FormAlert, TextField } from '@/features/inventory/components/form-fields';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { useCreateRenter, useRenter, useRenters } from '@/features/renters/hooks/use-renters';
import { renterAlerts } from '@/features/renters/renter-alerts';
import { maskDate, todayCivil } from '@/lib/civil-date';
import { useDebouncedValue } from '@/lib/use-debounced-value';
import { civilOrNull, textOrNull } from '../form-draft';

const NEW_RENTER = '__new__';
/** Si los ajustes no llegaron, la edad mínima del prototipo. */
const DEFAULT_MIN_DRIVER_AGE = 21;

/**
 * El cliente de la renta (096): buscar por nombre, documento o teléfono, o
 * registrarlo ahí mismo sin salir del formulario. Elegido, muestra los avisos
 * antes de rentarle: no rentar, licencia vencida, menor de la edad mínima.
 */
export function CustomerField({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (customerId: string) => void;
  error?: string;
}) {
  const { can, canAny } = usePermissions();
  const canCreate = can(PERMISSIONS.renters.actions.manage.key);
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);
  const search = useDebouncedValue(query.trim());
  const renters = useRenters({ q: search === '' ? undefined : search, active: true });
  const selected = useRenter(value, value !== '');
  const settings = useRentalSettings(
    canAny(PERMISSIONS.rentals.actions.read.key, PERMISSIONS.rentals.actions.settings.key),
  );

  const options = [
    ...(renters.data ?? []).slice(0, 30).map((renter) => ({
      value: renter.id,
      label: renter.fullName,
      hint: [
        renter.documentId,
        renter.mobilePhone ?? renter.phone,
        renter.isBlocked ? 'No rentar' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    ...(canCreate
      ? [{ value: NEW_RENTER, label: 'Registrar cliente nuevo', kind: 'action' as const }]
      : []),
  ];

  const alerts =
    selected.data === undefined
      ? []
      : renterAlerts(
          selected.data,
          todayCivil(),
          settings.data?.minDriverAge ?? DEFAULT_MIN_DRIVER_AGE,
        );

  if (creating) {
    return (
      <QuickRenterForm
        initialName={query}
        onCancel={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          setQuery('');
          onChange(id);
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
      {value !== '' && selected.data !== undefined ? (
        <div className="border-line-soft bg-surface-2 flex flex-wrap items-center justify-between gap-3 rounded-row border px-4 py-3">
          <div className="min-w-0">
            <p className="text-body font-semibold">{selected.data.fullName}</p>
            <p className="text-text-dim text-dense">
              {[
                selected.data.documentId,
                selected.data.licenseNumber ? `Licencia ${selected.data.licenseNumber}` : null,
                selected.data.mobilePhone ?? selected.data.phone,
              ]
                .filter(Boolean)
                .join(' · ') || 'Sin documento ni teléfono'}
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange('')}>
            Cambiar
          </Button>
        </div>
      ) : (
        <Combobox
          mode="search"
          id="agreement-customer"
          label="Cliente"
          placeholder="Nombre, DUI o teléfono"
          options={options}
          value={value}
          query={query}
          onQueryChange={setQuery}
          filter="off"
          emptyText="Nadie coincide."
          onChange={(next) => {
            if (next === NEW_RENTER) {
              setCreating(true);
              return;
            }
            onChange(next);
          }}
          invalid={error !== undefined}
        />
      )}

      {alerts.length > 0 ? (
        <div role="alert" className="flex flex-col gap-1">
          {alerts.map((alert) => (
            <p
              key={alert.key}
              className={
                alert.key === 'blocked'
                  ? 'text-danger-text flex items-start gap-2 text-body font-semibold'
                  : 'text-warn-text flex items-start gap-2 text-body font-semibold'
              }
            >
              <TriangleAlert className="mt-0.5 size-icon shrink-0" strokeWidth={1.5} aria-hidden />
              {alert.message}
            </p>
          ))}
        </div>
      ) : null}
      <FieldError message={error} />
    </div>
  );
}

/** El alta rápida: lo justo para el contrato; el resto se completa en la ficha. */
function QuickRenterForm({
  initialName,
  onCancel,
  onCreated,
}: {
  initialName: string;
  onCancel: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateRenter();
  const [values, setValues] = useState({
    fullName: initialName,
    documentId: '',
    mobilePhone: '',
    licenseNumber: '',
    licenseExpiresAt: '',
    birthDate: '',
  });
  const [error, setError] = useState<string | null>(null);

  const set = (key: keyof typeof values) => (text: string) =>
    setValues((previous) => ({ ...previous, [key]: text }));

  function save() {
    const parsed = createRenterSchema.safeParse({
      fullName: values.fullName,
      documentId: textOrNull(values.documentId),
      mobilePhone: textOrNull(values.mobilePhone),
      licenseNumber: textOrNull(values.licenseNumber),
      licenseExpiresAt: civilOrNull(values.licenseExpiresAt),
      birthDate: civilOrNull(values.birthDate),
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Revisá los datos.');
      return;
    }

    setError(null);
    create.mutate(parsed.data, {
      onSuccess: (renter) => onCreated(renter.id),
      onError: (apiError) => setError(apiError.message),
    });
  }

  return (
    <div className="border-line bg-surface-2 flex flex-col gap-3 rounded-row border p-4 sm:col-span-2 [[data-density=bahia]_&]:col-span-1">
      <p className="text-title flex items-center gap-2">
        <UserPlus className="size-icon text-text-faint" strokeWidth={1.5} aria-hidden />
        Cliente nuevo
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 [[data-density=bahia]_&]:grid-cols-1">
        <TextField
          id="quick-renter-name"
          label="Nombre completo"
          value={values.fullName}
          onChange={(event) => set('fullName')(event.target.value)}
        />
        <TextField
          id="quick-renter-document"
          label="DUI o pasaporte"
          mono
          value={values.documentId}
          onChange={(event) => set('documentId')(event.target.value)}
        />
        <TextField
          id="quick-renter-mobile"
          label="Celular"
          inputMode="tel"
          mono
          value={values.mobilePhone}
          onChange={(event) => set('mobilePhone')(event.target.value)}
        />
        <TextField
          id="quick-renter-license"
          label="Licencia"
          mono
          value={values.licenseNumber}
          onChange={(event) => set('licenseNumber')(event.target.value)}
        />
        <TextField
          id="quick-renter-license-expires"
          label="Vence la licencia"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          mono
          value={values.licenseExpiresAt}
          onChange={(event) => set('licenseExpiresAt')(maskDate(event.target.value))}
        />
        <TextField
          id="quick-renter-birth"
          label="Nacimiento"
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          mono
          value={values.birthDate}
          onChange={(event) => set('birthDate')(maskDate(event.target.value))}
        />
      </div>
      <FormAlert message={error} />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" variant="outline" loading={create.isPending} onClick={save}>
          Registrar cliente
        </Button>
      </div>
    </div>
  );
}
