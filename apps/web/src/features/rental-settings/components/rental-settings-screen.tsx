'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { PERMISSIONS } from '@elite/shared';
import type { RentalSettings } from '@elite/shared';
import { Building2, Check, Coins, FileText, ListChecks, Wrench } from 'lucide-react';
import { useEffect, useRef, useState, type FocusEvent } from 'react';
import { useForm } from 'react-hook-form';
import type { z } from 'zod';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { Tabs, type TabItem } from '@/components/ui/tabs';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { PlanTaskList } from '@/features/fleet-maintenance/components/plan-task-list';
import { usePlanTasks } from '@/features/fleet-maintenance/hooks/use-fleet-maintenance';
import { activeTasks } from '@/features/fleet-maintenance/plan-task-draft';
import { FormAlert } from '@/features/inventory/components/form-fields';
import type { ApiError } from '@/lib/api';
import { timeLabel } from '@/lib/civil-date';
import { useRentalSettings, useSaveRentalSettings } from '../hooks/use-rental-settings';
import { useStackedLayout } from '../hooks/use-stacked-layout';
import {
  changedFields,
  changeSummary,
  errorSummary,
  sectionHasChanges,
  sectionOf,
  type SettingsSection,
} from '../settings-changes';
import {
  rentalSettingsFormSchema,
  settingsFormValuesOf,
  type RentalSettingsFormValues,
} from '../settings-form';
import { previewSettings, zoneOf } from '../sheet-preview';
import { AccessoriesPanel } from './accessories-panel';
import { CompanyPanel } from './company-panel';
import { ContractPanel } from './contract-panel';
import { ChargeExampleCard, RulesPanel } from './rules-panel';
import { SaveBar } from './save-bar';
import { ServiceAlertsPanel } from './service-panel';
import type { NotifyUndo } from './settings-form-types';
import { MiniSheet, PreviewAside, SheetDialog, SheetStyles, type SheetSide } from './sheet-preview';

/**
 * Ajustes de la rentadora (095, rehecha en la 120): Empresa, Cobros y reglas,
 * Contrato y Accesorios, con la hoja del contrato al lado, y una barra de
 * guardar que solo aparece con cambios. Con `fleet.manage`, una quinta pestaña
 * Servicio (123): los avisos del plan van con la barra; las tareas, solas.
 */
export function RentalSettingsScreen() {
  const settings = useRentalSettings();

  if (settings.isPending) return <DetailSkeleton label="Cargando los ajustes" />;

  if (settings.error !== null || settings.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {settings.error?.message ?? 'No se pudieron cargar los ajustes.'}
      </p>
    );
  }

  return <SettingsForm settings={settings.data} />;
}

function SettingsForm({ settings }: { settings: RentalSettings }) {
  const { can } = usePermissions();
  const canEdit = can(PERMISSIONS.rentals.actions.settings.key);
  const canPlan = can(PERMISSIONS.fleet.actions.manage.key);
  const plan = usePlanTasks(canPlan);
  const save = useSaveRentalSettings();
  const { toast } = useToast();
  const stacked = useStackedLayout();

  const [baseline, setBaseline] = useState(settings);
  const [saved, setSaved] = useState(() => settingsFormValuesOf(settings));
  const [logoUrl, setLogoUrl] = useState(settings.logoUrl);
  const [tab, setTab] = useState<SettingsSection>('company');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSide, setSheetSide] = useState<SheetSide>('front');
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const form = useForm<
    RentalSettingsFormValues,
    unknown,
    z.output<typeof rentalSettingsFormSchema>
  >({
    resolver: zodResolver(rentalSettingsFormSchema),
    defaultValues: saved,
    mode: 'onChange',
  });

  const values = form.watch();
  const changed = canEdit ? changedFields(values, saved) : [];
  const hasChanges = changed.length > 0;
  const errorFields = Object.keys(form.formState.errors);
  const hasErrors = errorFields.length > 0;
  const preview = previewSettings(values, logoUrl, baseline.updatedAt);
  const zone = zoneOf(focusedField);

  function adopt(next: RentalSettings): void {
    const nextValues = settingsFormValuesOf(next);
    setBaseline(next);
    setSaved(nextValues);
    setLogoUrl(next.logoUrl);
    form.reset(nextValues);
  }

  // Lo que llega de afuera (otra pestaña, otro equipo) entra solo si no hay
  // nada escrito: nunca pisa lo que alguien está editando.
  useEffect(() => {
    if (settings.updatedAt === baseline.updatedAt) return;
    if (changedFields(form.getValues(), saved).length > 0) return;
    adopt(settings);
    // `adopt` solo usa setters y `form`, que no cambian.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, baseline.updatedAt, saved, form]);

  function onApiError(error: ApiError): void {
    if (typeof error.details === 'object' && error.details !== null) {
      for (const [name, message] of Object.entries(error.details as Record<string, unknown>)) {
        if (typeof message === 'string') {
          form.setError(name.split('.')[0] as keyof RentalSettingsFormValues, { message });
        }
      }
    }
    setFormError(error.message);
  }

  const submit = form.handleSubmit(
    (input) => {
      setFormError(null);
      save.mutate(input, {
        onSuccess: (next) => {
          adopt(next);
          setSavedAt(timeLabel(new Date().toISOString()));
          toast({ title: 'Ajustes guardados', description: next.companyName });
        },
        onError: onApiError,
      });
    },
    (errors) => {
      const first = Object.keys(errors)[0];
      const section = first === undefined ? null : sectionOf(first);
      if (section !== null && (section !== 'service' || canPlan)) setTab(section);
    },
  );

  // Ctrl/Cmd+S guarda. Sin cambios igual se come el atajo: nada de «Guardar página».
  const submitRef = useRef(submit);
  submitRef.current = submit;
  const canSaveNow = canEdit && hasChanges && !save.isPending;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      if (canSaveNow) void submitRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSaveNow]);

  useEffect(() => {
    if (!hasChanges) return;
    const onLeave = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
  }, [hasChanges]);

  const notifyUndo: NotifyUndo = (title, undo) =>
    toast({ title, action: { label: 'Deshacer', onClick: undo } });

  function discard(): void {
    const snapshot = structuredClone(form.getValues());
    const snapshotLogo = logoUrl;
    form.reset(saved);
    setLogoUrl(baseline.logoUrl);
    setFormError(null);
    notifyUndo('Cambios descartados', () => {
      form.reset(snapshot, { keepDefaultValues: true });
      setLogoUrl(snapshotLogo);
    });
  }

  function openSheet(side: SheetSide): void {
    setSheetSide(side);
    setSheetOpen(true);
  }

  // Al entrar a un campo se marca su parte en la hoja.
  function onFocus(event: FocusEvent<HTMLFormElement>): void {
    const row = event.target.closest('[data-field]');
    setFocusedField(row?.getAttribute('data-field') ?? null);
  }

  const tabs: TabItem<SettingsSection>[] = [
    { value: 'company', label: 'Empresa', icon: Building2 },
    { value: 'rules', label: 'Cobros y reglas', icon: Coins },
    { value: 'contract', label: 'Contrato', icon: FileText, count: values.clauses.length },
    {
      value: 'accessories',
      label: 'Accesorios',
      icon: ListChecks,
      count: values.accessories.length,
    },
    ...(canPlan
      ? [
          {
            value: 'service' as const,
            label: 'Servicio',
            icon: Wrench,
            count: plan.data === undefined ? undefined : activeTasks(plan.data).length,
          },
        ]
      : []),
  ];
  const items = tabs.map((item) => ({ ...item, marked: sectionHasChanges(item.value, changed) }));

  const mini = <MiniSheet settings={preview} zone={zone} onOpen={() => openSheet('front')} />;

  const summary = hasErrors ? errorSummary(errorFields) : changeSummary(changed);

  return (
    <div className={hasChanges ? 'flex flex-col gap-5 pb-28' : 'flex flex-col gap-5'}>
      <SheetStyles />
      <ScreenHeader title="Ajustes">
        {savedAt === null ? null : (
          <span className="text-text-faint text-dense inline-flex items-center gap-1.5 font-semibold">
            <Check className="text-go-text size-icon" strokeWidth={1.5} aria-hidden />
            Guardado {savedAt}
          </span>
        )}
        <Button
          type="button"
          variant="outline"
          onClick={() => openSheet(tab === 'contract' ? 'back' : 'front')}
        >
          <FileText className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
          Ver hoja
        </Button>
      </ScreenHeader>

      <Tabs
        aria-label="Secciones de ajustes"
        value={tab}
        onValueChange={setTab}
        items={items}
        className="max-xl:[&_[role=tab]]:min-h-14 [[data-density=bahia]_&_[role=tab]]:min-h-14 [[data-density=bahia]_&_[role=tab]]:px-4.5"
      />

      <div
        role="tabpanel"
        id={`tabpanel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        className="flex min-w-0 flex-col gap-7"
      >
        <form
          id="rental-settings-form"
          noValidate
          onSubmit={submit}
          onFocus={onFocus}
          className="flex flex-col gap-4"
        >
          <FormAlert message={formError} />

          <fieldset disabled={!canEdit} className="flex min-w-0 flex-col">
            {tab === 'company' ? (
              <CompanyPanel
                form={form}
                canEdit={canEdit}
                logoUrl={logoUrl}
                onLogoChange={setLogoUrl}
                aside={
                  <PreviewAside caption="Así se ve impreso" defaultOpen={!stacked}>
                    {mini}
                  </PreviewAside>
                }
              />
            ) : null}
            {tab === 'rules' ? (
              <RulesPanel
                form={form}
                aside={
                  <PreviewAside caption="Cómo afecta un cobro" defaultOpen={!stacked}>
                    <ChargeExampleCard values={values} />
                    {mini}
                  </PreviewAside>
                }
              />
            ) : null}
            {tab === 'contract' ? (
              <ContractPanel
                form={form}
                preview={preview}
                canEdit={canEdit}
                notifyUndo={notifyUndo}
              />
            ) : null}
            {tab === 'accessories' ? (
              <AccessoriesPanel form={form} canEdit={canEdit} notifyUndo={notifyUndo} />
            ) : null}
            {tab === 'service' ? <ServiceAlertsPanel form={form} /> : null}
          </fieldset>

          {tab === 'service' ? null : (
            <>
              <input type="hidden" {...form.register('kmAlert')} />
              <input type="hidden" {...form.register('daysAlert')} />
            </>
          )}
        </form>
        {tab === 'service' ? (
          <section aria-label="Tareas" className="flex flex-col gap-2.5">
            <h2 className="text-body [[data-density=bahia]_&]:text-title font-bold">Tareas</h2>
            <PlanTaskList />
          </section>
        ) : null}
      </div>

      {hasChanges ? (
        <SaveBar
          summary={summary}
          hasErrors={hasErrors}
          saving={save.isPending}
          onDiscard={discard}
        />
      ) : null}

      <SheetDialog
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        side={sheetSide}
        onSideChange={setSheetSide}
        settings={preview}
      />
    </div>
  );
}
