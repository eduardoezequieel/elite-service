'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Renter } from '@elite/shared';
import { Pencil, TriangleAlert } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailField } from '@/components/ui/detail-field';
import { DetailSkeleton } from '@/components/ui/skeleton';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRentalSettings } from '@/features/rental-settings/hooks/use-rental-settings';
import { RenterHistory } from '@/features/rentals/components/renter-history';
import { formatCivil, todayCivil } from '@/lib/civil-date';
import { useRenter } from '../hooks/use-renters';
import { ageOn, renterAlerts } from '../renter-alerts';
import { RenterDialog } from './renter-dialog';
import { RenterStamps } from './renter-stamps';

/** Si los ajustes no llegaron (o no son tuyos), la edad mínima del prototipo. */
const DEFAULT_MIN_DRIVER_AGE = 21;

const text = (value: string | null) => value ?? '—';
const date = (civil: string | null) => (civil === null ? '—' : formatCivil(civil));

function DetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading>{title}</CardSectionHeading>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 [[data-density=bahia]_&]:xl:grid-cols-2">
        {children}
      </div>
    </Card>
  );
}

/**
 * La ficha de un cliente de renta (095): sus datos del contrato, los avisos
 * antes de rentarle (no rentar, licencia vencida, menor de la edad mínima) y su
 * historial de rentas, que llega con la 096.
 */
export function RenterDetailScreen({ id }: { id: string }) {
  const renter = useRenter(id);

  if (renter.isPending) return <DetailSkeleton label="Cargando el cliente" />;

  if (renter.error !== null || renter.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {renter.error?.message ?? 'No se pudo cargar el cliente.'}
      </p>
    );
  }

  return <RenterDetail renter={renter.data} />;
}

function RenterDetail({ renter }: { renter: Renter }) {
  const { can, canAny } = usePermissions();
  const canManage = can(PERMISSIONS.renters.actions.manage.key);
  const canReadSettings = canAny(
    PERMISSIONS.rentals.actions.read.key,
    PERMISSIONS.rentals.actions.settings.key,
    PERMISSIONS.fleet.actions.read.key,
  );
  const settings = useRentalSettings(canReadSettings);
  const [editing, setEditing] = useState(false);
  const today = todayCivil();
  const minDriverAge = settings.data?.minDriverAge ?? DEFAULT_MIN_DRIVER_AGE;
  const alerts = renterAlerts(renter, today, minDriverAge);

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={renter.fullName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono">{renter.documentId ?? 'Sin documento'}</span>
            <RenterStamps renter={renter} />
          </span>
        }
      >
        {canManage ? (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="text-text-faint size-icon" strokeWidth={1.5} aria-hidden />
            Editar
          </Button>
        ) : null}
      </ScreenHeader>

      {alerts.length > 0 ? (
        <Card className="gap-2 px-card" role="alert">
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
        </Card>
      ) : null}

      <DetailCard title="Datos personales">
        <DetailField label="DUI o pasaporte">
          <span className="font-mono">{text(renter.documentId)}</span>
        </DetailField>
        <DetailField label="Nacimiento">
          {renter.birthDate === null
            ? '—'
            : `${formatCivil(renter.birthDate)} · ${ageOn(renter.birthDate, today)} años`}
        </DetailField>
        <DetailField label="País">{text(renter.country)}</DetailField>
        <DetailField label="Ocupación">{text(renter.occupation)}</DetailField>
        <DetailField label="Lugar de trabajo">{text(renter.workplace)}</DetailField>
        <DetailField label="Representante">{text(renter.representative)}</DetailField>
      </DetailCard>

      <DetailCard title="Licencia">
        <DetailField label="Número">
          <span className="font-mono">{text(renter.licenseNumber)}</span>
        </DetailField>
        <DetailField label="Vence">{date(renter.licenseExpiresAt)}</DetailField>
      </DetailCard>

      <DetailCard title="Contacto">
        <DetailField label="Celular">
          <span className="font-mono">{text(renter.mobilePhone)}</span>
        </DetailField>
        <DetailField label="Teléfono">
          <span className="font-mono">{text(renter.phone)}</span>
        </DetailField>
        <DetailField label="Correo">{text(renter.email)}</DetailField>
        <DetailField label="Dirección">{text(renter.address)}</DetailField>
        <DetailField label="Dirección permanente">{text(renter.permanentAddress)}</DetailField>
        <DetailField label="Teléfono permanente">
          <span className="font-mono">{text(renter.permanentPhone)}</span>
        </DetailField>
      </DetailCard>

      {renter.notes === null ? null : (
        <Card className="gap-3 px-card">
          <CardSectionHeading>Notas</CardSectionHeading>
          <p className="text-body whitespace-pre-line">{renter.notes}</p>
        </Card>
      )}

      <section aria-label="Historial" className="flex flex-col gap-3">
        <RenterHistory customerId={renter.id} />
      </section>

      {editing ? <RenterDialog renter={renter} onClose={() => setEditing(false)} /> : null}
    </div>
  );
}
