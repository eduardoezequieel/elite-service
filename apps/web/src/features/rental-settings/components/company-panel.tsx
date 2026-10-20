'use client';

import type { ReactNode } from 'react';

import { Textarea } from '@/components/ui/textarea';
import { FieldError } from '@/features/inventory/components/form-fields';
import { LogoField } from './logo-field';
import { AffixInput, SettingsGroup, SettingsRow } from './settings-row';
import type { SettingsFormApi } from './settings-form-types';
import { EDIT } from './settings-form-types';

/** Empresa (120): quién renta y el contacto, con la hoja al lado. */
export function CompanyPanel({
  form,
  canEdit,
  logoUrl,
  onLogoChange,
  aside,
}: {
  form: SettingsFormApi;
  canEdit: boolean;
  logoUrl: string | null;
  onLogoChange: (url: string | null) => void;
  aside: ReactNode;
}) {
  const errors = form.formState.errors;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_21rem] xl:gap-8 [[data-density=bahia]_&]:grid-cols-1">
      <div className="flex min-w-0 flex-col gap-7">
        <SettingsGroup title="Quién renta">
          <SettingsRow label="Logo" hint="PNG, JPG o WebP de hasta 5 MB." field="logoFileId">
            <LogoField
              logoUrl={form.watch('logoFileId') === null ? null : logoUrl}
              disabled={!canEdit}
              onChange={(fileId, url) => {
                form.setValue('logoFileId', fileId, EDIT);
                onLogoChange(url);
              }}
            />
          </SettingsRow>
          <SettingsRow
            label="Nombre de la empresa"
            hint="El título grande del contrato."
            htmlFor="rs-companyName"
            field="companyName"
          >
            <AffixInput
              id="rs-companyName"
              error={errors.companyName?.message}
              {...form.register('companyName')}
            />
          </SettingsRow>
          <SettingsRow
            label="Arrendante"
            hint="Quien firma. Reemplaza {ARRENDANTE} en el texto."
            htmlFor="rs-lessorName"
            field="lessorName"
          >
            <AffixInput
              id="rs-lessorName"
              error={errors.lessorName?.message}
              {...form.register('lessorName')}
            />
          </SettingsRow>
          <SettingsRow
            label="NIT y NRC"
            hint="NRC solo si está inscrito en IVA."
            htmlFor="rs-taxId"
            field="taxId"
          >
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              <div className="flex min-w-0 flex-col gap-1.5">
                <AffixInput
                  id="rs-taxId"
                  mono
                  placeholder="0000-000000-000-0"
                  error={errors.taxId?.message}
                  {...form.register('taxId')}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5" data-field="nrc">
                <AffixInput
                  id="rs-nrc"
                  mono
                  aria-label="NRC"
                  placeholder="NRC"
                  error={errors.nrc?.message}
                  {...form.register('nrc')}
                />
              </div>
            </div>
          </SettingsRow>
        </SettingsGroup>

        <SettingsGroup title="Contacto">
          <SettingsRow label="Teléfonos" htmlFor="rs-phones" field="phones">
            <AffixInput
              id="rs-phones"
              inputMode="tel"
              error={errors.phones?.message}
              {...form.register('phones')}
            />
          </SettingsRow>
          <SettingsRow label="Correo" htmlFor="rs-email" field="email">
            <AffixInput
              id="rs-email"
              inputMode="email"
              error={errors.email?.message}
              {...form.register('email')}
            />
          </SettingsRow>
          <SettingsRow label="Dirección" htmlFor="rs-address" field="address">
            <Textarea
              id="rs-address"
              rows={2}
              className="min-h-0"
              aria-invalid={errors.address ? true : undefined}
              {...form.register('address')}
            />
            <FieldError message={errors.address?.message} />
          </SettingsRow>
          <SettingsRow
            label="Ciudad del contrato"
            hint="Donde se firma: «San Salvador, __ de …»."
            htmlFor="rs-city"
            field="city"
          >
            <AffixInput
              id="rs-city"
              short
              error={errors.city?.message}
              {...form.register('city')}
            />
          </SettingsRow>
        </SettingsGroup>
      </div>
      {aside}
    </div>
  );
}
