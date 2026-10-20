'use client';

import { AffixInput, SettingsGroup, SettingsRow } from './settings-row';
import type { SettingsFormApi } from './settings-form-types';

/**
 * Servicio (123): con cuántos km y días de anticipación avisa el plan. Se
 * guardan con la barra, como el resto de Ajustes. La lista de tareas
 * (`PlanTaskList`) va debajo, fuera del formulario: cada acción se guarda sola.
 */
export function ServiceAlertsPanel({ form }: { form: SettingsFormApi }) {
  const errors = form.formState.errors;

  return (
    <SettingsGroup title="Avisos">
      <SettingsRow label="Avisar antes · km" htmlFor="rs-kmAlert">
        <AffixInput
          id="rs-kmAlert"
          after="km"
          short
          mono
          inputMode="numeric"
          error={errors.kmAlert?.message}
          {...form.register('kmAlert')}
        />
      </SettingsRow>
      <SettingsRow label="Avisar antes · días" htmlFor="rs-daysAlert">
        <AffixInput
          id="rs-daysAlert"
          after="días"
          short
          mono
          inputMode="numeric"
          error={errors.daysAlert?.message}
          {...form.register('daysAlert')}
        />
      </SettingsRow>
    </SettingsGroup>
  );
}
