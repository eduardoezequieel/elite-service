import { fuelLabel } from '@elite/shared';
import type { RentalAgreement, RentalSettings, Renter } from '@elite/shared';

import { PAYMENT_METHOD_LABELS, vehicleTitle } from '@/features/rentals/agreement-format';
import { formatCents, formatMoney, toCents } from '@/lib/money';
import { cn } from '@/lib/utils';
import {
  COPY_LABELS,
  contractIntro,
  contractMoney,
  formatContractNumber,
  paperDate,
  paperDateParts,
  paperTime,
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
 * El contrato de arrendamiento (097): anverso con los datos de la renta y
 * reverso con la introducción y las cláusulas de los ajustes (RN-1). El orden
 * de los campos es el del talonario (`docContrato` del prototipo).
 */

interface ContractProps {
  agreement: RentalAgreement;
  settings: RentalSettings;
  /** La ficha completa del cliente, si se pudo leer; si no, lo que trae la renta. */
  renter: Renter | null;
  copy: DocumentCopy;
}

/** Un monto que puede faltar: `"0.00"` y `null` se leen «—». */
function amountOrDash(amount: string | null | undefined): string {
  const cents = amount === null || amount === undefined ? null : toCents(amount);

  return cents === null || cents === 0 ? '—' : formatMoney(amount ?? '');
}

/** Una línea en blanco para escribir a mano dentro de un párrafo. */
function Blank({ value, wide = false }: { value?: string | number | null; wide?: boolean }) {
  return (
    <span
      className={cn(
        'border-text inline-block border-b text-center font-semibold',
        wide ? 'min-w-(--paper-blank-wide)' : 'min-w-(--paper-blank)',
      )}
    >
      {value === null || value === undefined || value === '' ? ' ' : value}
    </span>
  );
}

function Box({ checked }: { checked: boolean }) {
  return (
    <span className="border-text inline-flex size-3.5 items-center justify-center border font-bold">
      {checked ? 'X' : ''}
    </span>
  );
}

export function ContractFront({ agreement, settings, renter, copy }: ContractProps) {
  const customer = agreement.customer;
  const { vehicle } = agreement;
  const driver = agreement.additionalDriver;
  const pickupAt = agreement.actualPickupAt ?? agreement.plannedPickupAt;
  const money = contractMoney(agreement, settings.vatRate);
  const days = agreement.billableDays;
  const pickupKm = agreement.pickupOdometerKm ?? vehicle.odometerKm;
  const freeKm = vehicle.freeKmPerDay;
  const dated = paperDateParts(pickupAt);
  const phones = [customer.mobilePhone, customer.phone].filter(Boolean).join(' / ');
  const notes = [
    agreement.notes,
    ...agreement.extensions.map(
      (extension) =>
        `Prórroga acordada el ${paperDate(extension.createdAt)}: nuevo regreso ${paperDate(
          extension.newReturnAt,
        )} ${paperTime(extension.newReturnAt)}.`,
    ),
  ]
    .filter(Boolean)
    .join(' ');
  const hasVat = money.vatCents > 0;

  return (
    <PaperPage>
      <PaperHeader
        settings={settings}
        title="Contrato de arrendamiento"
        contractNumber={agreement.contractNumber}
        copy={copy}
      />

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col">
          <PaperSection>Arrendatario</PaperSection>
          <PaperField label="Nombre o razón social" value={renter?.fullName ?? customer.fullName} />
          <PaperField label="Representante legal" value={renter?.representative} />
          <PaperRow>
            <PaperField label="DUI / Pasaporte" value={customer.documentId} mono />
            <PaperField label="País" value={renter?.country} />
          </PaperRow>
          <PaperRow>
            <PaperField label="Licencia N°" value={customer.licenseNumber} mono />
            <PaperField label="Vence" value={paperDate(customer.licenseExpiresAt)} />
          </PaperRow>
          <PaperField label="Fecha de nacimiento" value={paperDate(customer.birthDate)} />
          <PaperField label="Dirección local" value={renter?.address} />
          <PaperField label="Tels." value={phones} />
          <PaperField label="Dirección permanente" value={renter?.permanentAddress} />
          <PaperField label="Tels." value={renter?.permanentPhone} />
          <PaperField label="Correo electrónico" value={renter?.email} />
          <PaperField label="Lugar de trabajo" value={renter?.workplace} />
          <PaperField label="Profesión u oficio" value={renter?.occupation} />
        </div>

        <div className="flex flex-col">
          <PaperSection>Vehículo</PaperSection>
          <PaperField label="Marca, modelo y año" value={vehicleTitle(vehicle)} />
          <PaperRow>
            <PaperField label="Placa" value={vehicle.plate} mono />
            <PaperField label="Color" value={vehicle.color} />
          </PaperRow>
          <PaperRow>
            <PaperField label="Sale" value={paperDate(pickupAt)} />
            <PaperField label="Hora" value={paperTime(pickupAt)} />
          </PaperRow>
          <PaperField label="Lugar de salida" value={agreement.pickupLocation} />
          <PaperRow>
            <PaperField label="Regresa" value={paperDate(agreement.plannedReturnAt)} />
            <PaperField label="Hora" value={paperTime(agreement.plannedReturnAt)} />
          </PaperRow>
          <PaperField label="Lugar de devolución" value={agreement.returnLocation} />
          <PaperRow>
            <PaperField label="Km al salir" value={String(pickupKm)} mono />
            <PaperField
              label="Tanque"
              value={
                agreement.pickupInspection === null
                  ? ''
                  : fuelLabel(agreement.pickupInspection.fuelEighths)
              }
            />
          </PaperRow>

          <PaperSection>Garantía</PaperSection>
          <PaperRow>
            <PaperField label="Depósito" value={amountOrDash(agreement.deposit)} mono />
            <PaperField
              label="Forma"
              value={
                agreement.depositMethod === null
                  ? ''
                  : PAYMENT_METHOD_LABELS[agreement.depositMethod]
              }
            />
          </PaperRow>
          <PaperRow>
            <PaperField
              label="Tarjeta N°"
              value={agreement.cardLast4 ? `**** ${agreement.cardLast4}` : ''}
              mono
            />
            <PaperField label="Autorización" value={agreement.authorizationCode} mono />
          </PaperRow>
          <PaperRow>
            <PaperField label="Fecha" value={paperDate(agreement.authorizationDate)} />
            <PaperField
              label="Monto"
              value={
                agreement.authorizationAmount === null
                  ? ''
                  : formatMoney(agreement.authorizationAmount)
              }
              mono
            />
          </PaperRow>
        </div>
      </div>

      <div className="flex flex-col">
        <PaperSection>Conductor adicional</PaperSection>
        <PaperRow>
          <PaperField label="Nombre" value={driver?.name} className="flex-[2]" />
          <PaperField label="Licencia N°" value={driver?.licenseNumber} mono />
          <PaperField label="Vence" value={paperDate(driver?.licenseExpiresAt)} />
        </PaperRow>
        <PaperRow>
          <PaperField label="Fecha de nacimiento" value={paperDate(driver?.birthDate)} />
          <PaperField label="País" value={driver?.country} />
        </PaperRow>
        <PaperField label="Observaciones" value={notes} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <table className="w-full border-collapse tabular-nums">
          <tbody>
            <MoneyRow label="Tarifa diaria" value={formatMoney(agreement.dailyRate)} />
            <MoneyRow label="Días" value={String(days)} />
            <MoneyRow label="CDW por día" value={amountOrDash(agreement.cdwPerDay)} />
            <MoneyRow label="Deducible" value={amountOrDash(agreement.deductible)} />
            <MoneyRow
              label="Km libres por día"
              value={freeKm === null || freeKm === 0 ? 'Ilimitado' : String(freeKm)}
            />
            {freeKm === null || freeKm === 0 ? null : (
              <MoneyRow label="Km adicional" value={amountOrDash(vehicle.extraKmPrice)} />
            )}
            <MoneyRow label="Pagado" value={formatCents(money.paidCents)} />
            <MoneyRow label="Pendiente" value={formatCents(money.pendingCents)} strong />
          </tbody>
        </table>
        <table className="w-full border-collapse tabular-nums">
          <tbody>
            <MoneyRow
              label={`Renta (${days} ${days === 1 ? 'día' : 'días'} × ${formatMoney(agreement.dailyRate)})`}
              value={formatCents(money.rentalCents)}
            />
            <MoneyRow
              label={`CDW (${days} × ${formatMoney(agreement.cdwPerDay)})`}
              value={formatCents(money.cdwCents)}
            />
            <MoneyRow
              label={agreement.extraChargesNote ?? 'Combustible, daños y otros cargos'}
              value={formatCents(money.otherChargesCents)}
            />
            {money.discountCents > 0 ? (
              <MoneyRow label="Descuento" value={`-${formatCents(money.discountCents)}`} />
            ) : null}
            {hasVat ? (
              <>
                <MoneyRow label="Sub-total" value={formatCents(money.subtotalCents)} />
                <MoneyRow
                  label={`IVA ${Number(settings.vatRate)}%`}
                  value={formatCents(money.vatCents)}
                />
              </>
            ) : null}
            <MoneyRow label="Total" value={formatCents(money.totalCents)} strong />
          </tbody>
        </table>
      </div>

      <div className="border-line flex items-start gap-4 border p-2">
        <p className="flex-1 text-justify">
          Cobertura de seguros por vuelco y colisión, por día o por fracción, con un deducible de{' '}
          <b>{toCents(agreement.deductible) ? formatMoney(agreement.deductible) : '$ ________'}</b>.
          Esta cobertura es válida bajo las condiciones descritas en la cláusula 10 y no es válida
          bajo las condiciones descritas en la cláusula 6. El deducible por pérdida total o robo es
          del 25% sobre el valor del vehículo.
        </p>
        <div className="flex shrink-0 flex-col gap-2">
          <span className="flex items-center gap-1.5">
            <Box checked={agreement.coverage === 'ACCEPTED'} /> Acepta · Firma ____________
          </span>
          <span className="flex items-center gap-1.5">
            <Box checked={agreement.coverage === 'DECLINED'} /> Declina · Firma ____________
          </span>
        </div>
      </div>

      <p className="text-justify leading-relaxed">
        He leído los términos y condiciones en el anverso y reverso de este contrato y estoy de
        acuerdo en todas sus partes. Por este pagaré sin protesto me (nos) obligo (amos)
        incondicionalmente a pagar a <b>{settings.lessorName}</b> del domicilio de {settings.city}{' '}
        el día <Blank /> de <Blank wide /> de <Blank /> la cantidad de <Blank wide /> más interés
        anual de <Blank value={settings.interestRate ? Number(settings.interestRate) : null} />%
        sobre el vencimiento. Pagaremos además intereses moratorios de{' '}
        <Blank value={settings.lateInterestRate ? Number(settings.lateInterestRate) : null} />%
        anual sobre el principal adeudado a partir de la fecha del vencimiento.
        <br />
        {settings.city}, <Blank value={dated.day} /> de <Blank value={dated.month} wide /> de{' '}
        <Blank value={dated.year} />.
      </p>

      <div className="mt-auto flex gap-10 pt-2">
        <SignatureLine label="Arrendatario" name={customer.fullName} />
        <SignatureLine label="Arrendante" name={settings.lessorName} />
      </div>
    </PaperPage>
  );
}

function MoneyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <tr className={strong ? 'font-bold' : undefined}>
      <Cell>{label}</Cell>
      <Cell className="text-right font-mono whitespace-nowrap">{value}</Cell>
    </tr>
  );
}

export function ContractBack({
  agreement,
  settings,
  copy,
}: Pick<ContractProps, 'agreement' | 'settings' | 'copy'>) {
  const number = formatContractNumber(agreement.contractNumber);

  return (
    <PaperPage className="text-(length:--paper-small)">
      <h2 className="text-center text-(length:--paper-text) font-bold">Términos y condiciones</h2>
      <p className="text-justify">{contractIntro(settings.contractIntro, settings.lessorName)}</p>
      <ol className="list-decimal columns-2 gap-4 pl-4 text-justify">
        {settings.clauses.map((clause, index) => (
          <li key={index} className="mb-1 break-inside-avoid-column whitespace-pre-line">
            {clause}
          </li>
        ))}
      </ol>
      <p className="mt-auto text-right">
        Contrato N° {number === '' ? '______' : number} · {COPY_LABELS[copy]}
      </p>
    </PaperPage>
  );
}
