'use client';

import {
  INSPECTION_ZONE_LABELS,
  fuelLabel,
  missingAccessories,
  newDamages,
  storedFileUrl,
} from '@elite/shared';
import type { RentalInspection } from '@elite/shared';

import { Card, CardSectionHeading } from '@/components/ui/card';
import { DetailField } from '@/components/ui/detail-field';
import { Stamp } from '@/components/ui/stamp';
import { rentalFileSrc } from '@/features/rental-settings/api';

/**
 * El resumen de una inspección (096): km, combustible, daños (en la de
 * regreso, los nuevos marcados), accesorios que faltaron, llantas, batería,
 * notas y las fotos en miniatura, que abren la foto entera en otra pestaña.
 */
export function InspectionSummary({
  title,
  inspection,
  compareWith,
}: {
  title: string;
  inspection: RentalInspection | null;
  /** La de salida, para marcar los daños nuevos en la de regreso. */
  compareWith?: RentalInspection | null;
}) {
  if (inspection === null) {
    return (
      <Card className="gap-3 px-card">
        <CardSectionHeading>{title}</CardSectionHeading>
        <p className="text-text-dim text-body">Todavía no se hizo.</p>
      </Card>
    );
  }

  const fresh =
    compareWith === undefined
      ? null
      : new Set(newDamages(compareWith, inspection).map((damage) => damage.zone));
  const missing = missingAccessories(inspection);
  const tires = [inspection.tires.front, inspection.tires.rear].filter(Boolean);

  return (
    <Card className="gap-3 px-card">
      <CardSectionHeading aside={`${inspection.odometerKm} km`}>{title}</CardSectionHeading>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 [[data-density=bahia]_&]:xl:grid-cols-2">
        <DetailField label="Kilometraje">
          <span className="font-mono tabular-nums">{inspection.odometerKm} km</span>
        </DetailField>
        <DetailField label="Combustible">{fuelLabel(inspection.fuelEighths)}</DetailField>
        <DetailField label="Accesorios que faltan">
          {missing.length === 0 ? 'Ninguno' : missing.join(', ')}
        </DetailField>
        {tires.length > 0 ? (
          <DetailField label="Llantas">
            {[
              inspection.tires.front ? `Delanteras: ${inspection.tires.front}` : null,
              inspection.tires.rear ? `Traseras: ${inspection.tires.rear}` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </DetailField>
        ) : null}
        {inspection.battery ? (
          <DetailField label="Batería">{inspection.battery}</DetailField>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-label text-text-faint">Daños</span>
        {inspection.damages.length === 0 ? (
          <p className="text-body">Sin daños.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {inspection.damages.map((damage) => (
              <li key={damage.zone} className="flex flex-wrap items-center gap-2 text-body">
                <span className="font-semibold">{INSPECTION_ZONE_LABELS[damage.zone]}</span>
                {damage.description === '' ? null : (
                  <span className="text-text-dim">{damage.description}</span>
                )}
                {fresh === null ? null : fresh.has(damage.zone) ? (
                  <Stamp label="Nuevo" tone="red" />
                ) : (
                  <Stamp label="Ya venía" tone="neutral" />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {inspection.notes ? (
        <p className="text-body whitespace-pre-line">{inspection.notes}</p>
      ) : null}

      {inspection.photoIds.length === 0 ? null : (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {inspection.photoIds.map((id, index) => {
            const src = rentalFileSrc(storedFileUrl(id));

            return (
              <li
                key={id}
                className="border-line bg-surface-2 aspect-square overflow-hidden rounded-control border"
              >
                <a href={src} target="_blank" rel="noopener noreferrer" className="block size-full">
                  {/* `<img>` y no `next/image`: la foto la sirve el API con sesión. */}
                  <img src={src} alt={`Foto ${index + 1}`} className="size-full object-cover" />
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
