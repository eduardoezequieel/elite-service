'use client';

import { FUEL_EIGHTHS_MAX, INSPECTION_ZONE_LABELS, INSPECTION_ZONES } from '@elite/shared';
import type {
  InspectionZone,
  RentalAgreement,
  RentalInspection,
  RentalSettings,
} from '@elite/shared';
import { useLayoutEffect, useRef, useState } from 'react';

import { CarDiagram, type ZoneMark } from '@/features/rentals/components/car-diagram';
import { vehicleTitle } from '@/features/rentals/agreement-format';
import { formatMoney, toCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  damageRows,
  paperDate,
  paperTime,
  type DamageRow,
  type DocumentCopy,
} from '../print-layout';
import {
  Cell,
  PaperField,
  PaperHeader,
  PaperPage,
  PaperRow,
  PaperSection,
  SignatureLine,
} from './document-parts';

/**
 * La hoja de inspección (097, `docHoja` del prototipo): diagrama del carro con
 * las zonas marcadas y numeradas, la lista de daños, combustible, km, llantas,
 * batería, accesorios de salida y de entrada, y las firmas de los dos
 * momentos. Nada de fotos (RN-5).
 */
export function InspectionSheet({
  agreement,
  settings,
  copy,
}: {
  agreement: RentalAgreement;
  settings: RentalSettings;
  copy: DocumentCopy;
}) {
  const { vehicle } = agreement;
  const pickup = agreement.pickupInspection;
  const back = agreement.returnInspection;
  const rows = damageRows(pickup, back);
  const pickupAt = agreement.actualPickupAt ?? agreement.plannedPickupAt;
  const returnAt = agreement.actualReturnAt;
  const byZone = new Map(rows.map((row) => [row.zone, row]));
  const markOf = (zone: InspectionZone): ZoneMark => {
    const row = byZone.get(zone);
    if (row === undefined) return 'none';
    if (back === null) return 'marked';
    return row.isNew ? 'new' : 'previous';
  };
  const chargeRows: { label: string; amount: string | null }[] =
    (toCents(agreement.extraCharges) ?? 0)
      ? [
          {
            label: agreement.extraChargesNote ?? 'Combustible, daños y otros cargos',
            amount: agreement.extraCharges,
          },
        ]
      : [];
  while (chargeRows.length < 3) chargeRows.push({ label: '', amount: null });

  return (
    <PaperPage>
      <PaperHeader
        settings={settings}
        title="Hoja de inspección"
        contractNumber={agreement.contractNumber}
        copy={copy}
      />

      <PaperRow>
        <PaperField label="Placa" value={vehicle.plate} mono />
        <PaperField
          label="Vehículo"
          value={[vehicleTitle(vehicle), vehicle.color].filter(Boolean).join(' ')}
          className="flex-[2]"
        />
        <PaperField label="Cliente" value={agreement.customer.fullName} className="flex-[1.6]" />
      </PaperRow>
      <PaperRow>
        <PaperField label="Salida: fecha" value={paperDate(pickupAt)} />
        <PaperField label="Hora" value={paperTime(pickupAt)} />
        <PaperField label="Entrada: fecha" value={paperDate(returnAt)} />
        <PaperField label="Hora" value={paperTime(returnAt)} />
      </PaperRow>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4">
        <div className="flex flex-col gap-1.5">
          <PaperSection>Golpes y rayones</PaperSection>
          <NumberedCarDiagram markOf={markOf} rows={rows} />
          <p className="text-text-dim">
            {back === null
              ? 'Marcado: daño anotado al salir.'
              : 'Punteado: ya estaba al salir. Lleno y con «Nuevo»: daño nuevo al regresar.'}
          </p>
          <DamageTable rows={rows} />

          <PaperSection>Combustible y kilometraje</PaperSection>
          <FuelScale label="Salida" eighths={pickup?.fuelEighths ?? null} />
          <FuelScale label="Entrada" eighths={back?.fuelEighths ?? null} />
          <PaperRow>
            <PaperField
              label="Km inicial"
              value={pickup === null ? '' : String(pickup.odometerKm)}
              mono
            />
            <PaperField
              label="Km final"
              value={back === null ? '' : String(back.odometerKm)}
              mono
            />
          </PaperRow>

          <PaperSection>Marca de llantas y batería</PaperSection>
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Cell head />
                <Cell head>Salida</Cell>
                <Cell head>Entrada</Cell>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Cell>Delanteras</Cell>
                <Cell>{pickup?.tires.front}</Cell>
                <Cell>{back?.tires.front}</Cell>
              </tr>
              <tr>
                <Cell>Traseras</Cell>
                <Cell>{pickup?.tires.rear}</Cell>
                <Cell>{back?.tires.rear}</Cell>
              </tr>
              <tr>
                <Cell>Batería</Cell>
                <Cell>{pickup?.battery}</Cell>
                <Cell>{back?.battery}</Cell>
              </tr>
            </tbody>
          </table>
        </div>

        <AccessoryTable accessories={settings.accessories} pickup={pickup} back={back} />
      </div>

      <PaperSection>Daños al vehículo a cobrar</PaperSection>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <Cell head>Pieza dañada</Cell>
            <Cell head className="w-(--paper-amount-w) text-right">
              Monto
            </Cell>
          </tr>
        </thead>
        <tbody>
          {chargeRows.map((row, index) => (
            <tr key={index}>
              <Cell>{row.label || ' '}</Cell>
              <Cell className="text-right font-mono">
                {row.amount === null ? '' : formatMoney(row.amount)}
              </Cell>
            </tr>
          ))}
        </tbody>
      </table>
      <PaperField label="Observaciones al salir" value={pickup?.notes} />
      <PaperField label="Observaciones al regresar" value={back?.notes} />

      <div className="mt-auto grid grid-cols-2 gap-8 pt-2">
        <div className="flex flex-col gap-1">
          <div className="flex gap-4">
            <SignatureLine label="Firma del cliente" />
            <SignatureLine label="Firma del empleado" />
          </div>
          <span className="text-center font-bold">Salida</span>
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex gap-4">
            <SignatureLine label="Firma del cliente" />
            <SignatureLine label="Firma del empleado" />
          </div>
          <span className="text-center font-bold">Entrada</span>
        </div>
      </div>
    </PaperPage>
  );
}

function DamageTable({ rows }: { rows: readonly DamageRow[] }) {
  const blanks = Math.max(0, 2 - rows.length);

  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <Cell head className="w-(--paper-num-w)">
            #
          </Cell>
          <Cell head>Parte</Cell>
          <Cell head>Al salir</Cell>
          <Cell head>Al regresar</Cell>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.zone}>
            <Cell className="font-bold">{row.number}</Cell>
            <Cell>{INSPECTION_ZONE_LABELS[row.zone]}</Cell>
            <Cell>{row.atPickup}</Cell>
            <Cell className={cn(row.isNew && 'font-bold')}>
              {row.atReturn === null ? null : row.isNew && row.atReturn !== 'Nuevo' ? (
                <>Nuevo: {row.atReturn}</>
              ) : (
                row.atReturn
              )}
            </Cell>
          </tr>
        ))}
        {Array.from({ length: blanks }, (_, index) => (
          <tr key={`blank-${index}`}>
            <Cell> </Cell>
            <Cell />
            <Cell />
            <Cell />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

const FUEL_LEVELS = Array.from({ length: FUEL_EIGHTHS_MAX + 1 }, (_, index) => index);

/** E · 1/8 … 7/8 · F, con el nivel anotado encerrado y en negrita. */
function FuelScale({ label, eighths }: { label: string; eighths: number | null }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-text-dim w-(--paper-fuel-label-w) shrink-0">{label}</span>
      {FUEL_LEVELS.map((level) => {
        const on = eighths === level;

        return (
          <span
            key={level}
            className={cn(
              'flex-1 border py-0.5 text-center',
              on ? 'border-text border-2 font-bold' : 'border-line text-text-dim',
            )}
          >
            {level === 0 ? 'E' : level === FUEL_EIGHTHS_MAX ? 'F' : `${level}/8`}
          </span>
        );
      })}
    </div>
  );
}

/** Sí y No de un accesorio en una inspección; sin inspección o sin anotar, en blanco. */
function accessoryMarks(inspection: RentalInspection | null, name: string): [string, string] {
  const present = inspection?.accessories[name];
  if (present === undefined) return ['', ''];

  return present ? ['X', ''] : ['', 'X'];
}

function AccessoryTable({
  accessories,
  pickup,
  back,
}: {
  accessories: readonly string[];
  pickup: RentalInspection | null;
  back: RentalInspection | null;
}) {
  return (
    <table className="w-full self-start border-collapse">
      <thead>
        <tr>
          <Cell head className="align-bottom">
            Revisión de accesorios
          </Cell>
          <Cell head className="text-center" colSpan={2}>
            Salida
          </Cell>
          <Cell head className="text-center" colSpan={2}>
            Entrada
          </Cell>
        </tr>
        <tr>
          <Cell head />
          <Cell head className="w-(--paper-check-w) text-center">
            Sí
          </Cell>
          <Cell head className="w-(--paper-check-w) text-center">
            No
          </Cell>
          <Cell head className="w-(--paper-check-w) text-center">
            Sí
          </Cell>
          <Cell head className="w-(--paper-check-w) text-center">
            No
          </Cell>
        </tr>
      </thead>
      <tbody>
        {accessories.map((name) => {
          const [outYes, outNo] = accessoryMarks(pickup, name);
          const [backYes, backNo] = accessoryMarks(back, name);

          return (
            <tr key={name}>
              <Cell>{name}</Cell>
              <Cell className="text-center font-bold">{outYes}</Cell>
              <Cell className="text-center font-bold">{outNo}</Cell>
              <Cell className="text-center font-bold">{backYes}</Cell>
              <Cell className="text-center font-bold">{backNo}</Cell>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** El lienzo de `CarDiagram` (200 × 390). */
const DIAGRAM_VIEWBOX = '0 0 200 390';

type ZonePoint = { number: number; x: number; y: number };

/**
 * El diagrama de la 096 en solo lectura, con el número de cada daño encima de
 * su zona. Las posiciones se leen del propio SVG ya dibujado (`getBBox` de la
 * primera pieza de cada zona), así las formas viven en un solo lugar.
 */
function NumberedCarDiagram({
  markOf,
  rows,
}: {
  markOf: (zone: InspectionZone) => ZoneMark;
  rows: readonly DamageRow[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<ZonePoint[]>([]);
  const zonesKey = rows.map((row) => row.zone).join('|');

  useLayoutEffect(() => {
    const groups = Array.from(ref.current?.querySelectorAll('svg g') ?? []);
    const zones = zonesKey === '' ? [] : zonesKey.split('|');
    const next: ZonePoint[] = [];

    zones.forEach((zone, index) => {
      if (!INSPECTION_ZONES.some((known) => known === zone)) return;
      const label = INSPECTION_ZONE_LABELS[zone as InspectionZone];
      const group = groups.find((element) => {
        const text = element.getAttribute('aria-label') ?? '';
        return text === label || text.startsWith(`${label} (`);
      });
      const shape = group?.querySelector('rect');
      if (shape === null || shape === undefined) return;

      const box = shape.getBBox();
      next.push({ number: index + 1, x: box.x + box.width / 2, y: box.y + box.height / 2 });
    });

    setPoints(next);
  }, [zonesKey]);

  return (
    <div ref={ref} className="relative print:grayscale">
      <CarDiagram markOf={markOf} />
      <svg
        viewBox={DIAGRAM_VIEWBOX}
        className="pointer-events-none absolute inset-0 size-full"
        aria-hidden
      >
        {points.map((point) => (
          <g key={point.number}>
            <circle
              cx={point.x}
              cy={point.y}
              r={9}
              className="fill-surface stroke-current text-text"
              strokeWidth={1.5}
            />
            <text
              x={point.x}
              y={point.y}
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-current text-text font-bold"
              fontSize={11}
            >
              {point.number}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
