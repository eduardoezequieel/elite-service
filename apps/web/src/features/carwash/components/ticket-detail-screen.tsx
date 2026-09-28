'use client';

import { PERMISSIONS } from '@elite/shared';
import type { Ticket } from '@elite/shared';
import { Phone } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import { ScreenHeader } from '@/components/app-shell/screen-header';
import { Button } from '@/components/ui/button';
import { Card, CardSectionHeading } from '@/components/ui/card';
import { PlateChip } from '@/components/ui/plate-chip';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useEmployees, useSetTicketWashers, useTicket } from '../hooks/use-tickets';
import { paymentDetailLabel } from '../cash-format';
import { jointChargeLabel } from '../ticket-payments';
import { responsibleOf } from '../responsible';
import { isOperationalStatus } from '../status-change';
import { timeOf } from '../wait';
import { washerNames } from '../washers';
import { AssigneeField } from './assignee-field';
import { ChangeTicketStatusDialog } from './change-ticket-status-dialog';
import { ChargeDialog } from './charge-dialog';
import { EditTicketDialog } from './edit-ticket-dialog';
import { LastWashNote } from './last-wash-note';
import { TicketPaymentsStamp } from './payment-method-stamp';
import { ReverseTicketDialog } from './reverse-ticket-dialog';
import { ChangePriceDialog } from './change-price-dialog';
import { AuthorizedPriceStamp, TicketLines, hasAuthorizedPrice } from './ticket-item-line';
import { TicketStatusHero } from './ticket-status-hero';
import { TicketStatusStamp } from './ticket-status-stamp';
import { TicketTimeline } from './ticket-timeline';
import { VehicleIcon } from './vehicle-icons';
import { VoidTicketDialog } from './void-ticket-dialog';
import { DetailSkeleton } from '@/components/ui/skeleton';

/**
 * El detalle de un lavado, desde la oficina.
 *
 * Las acciones disponibles salen del **estado** cruzado con los **permisos**, y
 * en ese orden: primero qué permite la regla de negocio (RN-9), después quién
 * puede hacerlo (RN-16). Un botón que el estado no admite no se muestra apagado,
 * no se muestra: apagado dice «no ahora», ausente dice «esto no va acá».
 */
export function TicketDetailScreen({ id }: { id: string }) {
  const { can } = usePermissions();
  const ticket = useTicket(id);
  const [charging, setCharging] = useState(false);

  if (ticket.isPending) {
    return <DetailSkeleton label="Cargando el lavado" />;
  }

  if (ticket.error !== null || ticket.data === undefined) {
    return (
      <p className="text-danger-text text-body" role="alert">
        {ticket.error?.message ?? 'No se pudo cargar el lavado.'}
      </p>
    );
  }

  return (
    <TicketDetail
      ticket={ticket.data}
      canManage={can(PERMISSIONS.carwash.actions.manage.key)}
      canCharge={can(PERMISSIONS.carwash.actions.charge.key)}
      // Anular y deshacer cobro se ven con solo ver el módulo (045): el
      // permiso lo pone quien autoriza dentro del diálogo, no la sesión.
      canVoid={can(PERMISSIONS.carwash.actions.read.key)}
      canReverse={can(PERMISSIONS.carwash.actions.read.key)}
      canAudit={can(PERMISSIONS.carwash.actions.audit.key)}
      // El candado del precio lo ve quien opera el lavado —cobra o lo
      // gestiona—; quien autoriza es otro y firma dentro del diálogo (060 RN-2,
      // RN-3). Nunca se decide por nombre de rol.
      canPrice={
        can(PERMISSIONS.carwash.actions.charge.key) || can(PERMISSIONS.carwash.actions.manage.key)
      }
      charging={charging}
      onCharging={setCharging}
    />
  );
}

function TicketDetail({
  ticket,
  canManage,
  canCharge,
  canVoid,
  canReverse,
  canAudit,
  canPrice,
  charging,
  onCharging,
}: {
  ticket: Ticket;
  canManage: boolean;
  canCharge: boolean;
  canVoid: boolean;
  canReverse: boolean;
  canAudit: boolean;
  canPrice: boolean;
  charging: boolean;
  onCharging: (open: boolean) => void;
}) {
  const [voiding, setVoiding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [reversing, setReversing] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  /**
   * Solo el id de la línea: el ticket se relee de la consulta en cada render,
   * así que el diálogo no se queda con la foto del precio de hace un rato
   * (convención 15).
   */
  const [pricingItemId, setPricingItemId] = useState<string | null>(null);
  const pricingItem = ticket.items.find((item) => item.id === pricingItemId) ?? null;
  const jointCharge = jointChargeLabel(ticket.charge);
  const sequence = ticket.number.slice(ticket.number.indexOf('-') + 1);
  const reference = Number(sequence);

  const responsible = responsibleOf(ticket);
  const makeAndColor = [ticket.vehicle.make, ticket.vehicle.color].filter(Boolean).join(' · ');

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        title={
          <span className="flex flex-wrap items-center gap-x-3.5 gap-y-2">
            #{reference}
            {/* El estado va pegado al número (064). El título es itálica de
                marca; los sellos vuelven a la letra de siempre. */}
            <span className="flex flex-wrap items-center gap-2 font-sans not-italic">
              <TicketStatusStamp status={ticket.status} size="lg" />
              {/* El lavado que lleva un precio firmado lo dice en la cabecera
                  (060): es lo primero que hay que ver al revisarlo al cierre. */}
              {hasAuthorizedPrice(ticket) ? <AuthorizedPriceStamp /> : null}
            </span>
          </span>
        }
        subtitle={
          <span className="flex flex-wrap gap-x-2">
            <span className="font-mono">{ticket.number}</span>
            <span aria-hidden>·</span>
            <span>Entró a las {timeOf(ticket.createdAt)}</span>
          </span>
        }
      />

      {ticket.status === 'VOID' ? (
        <p className="text-text-dim text-body">
          <span className="is-ruled-out">Este lavado</span> fue anulado.
        </p>
      ) : null}

      {/* Arriba de los datos y de los botones, igual que en pista: la nota del
          lavado anterior es lo que hay que saber antes de tocar nada (052). */}
      <LastWashNote lastWash={ticket.vehicle.lastWash} />

      {/* Dos columnas desde `xl` (064): a la izquierda lo que se lee, a la
          derecha el panel con el estado, el total y los botones. Por debajo, una
          columna con el panel primero: en tablet es lo que se viene a hacer. */}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4 max-xl:order-2">
          <Card className="gap-4 px-card">
            <div className="border-line-soft flex flex-wrap items-center gap-4 border-b pb-4">
              <PlateChip plate={ticket.vehicle.plate} size="lg" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-text text-title flex items-center gap-2">
                  <VehicleIcon
                    bodyTypeKey={ticket.bodyType.key}
                    bodyTypeName={ticket.bodyType.name}
                    className="h-4 w-8 shrink-0"
                  />
                  {ticket.bodyType.name}
                </span>
                <span className="text-text-dim text-body">
                  {makeAndColor || 'Sin marca ni color'}
                </span>
              </div>
            </div>

            {/* Rótulo arriba y valor abajo, en rejilla: en filas de ancho
                completo el valor quedaba a media pantalla de su rótulo. */}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-6 gap-y-4">
              <Fact label="Responsable" value={responsible?.fullName ?? 'Sin responsable'} />
              <Fact
                label="Teléfono"
                value={
                  responsible?.phone ? (
                    <a
                      href={`tel:${responsible.phone.replace(/\D/g, '')}`}
                      className="hover:text-flame-text min-h-touch inline-flex items-center gap-1.5"
                    >
                      <Phone aria-hidden strokeWidth={1.5} className="size-icon" />
                      {responsible.phone}
                    </a>
                  ) : (
                    '—'
                  )
                }
              />
            </div>

            {ticket.notes === null ? null : (
              <div className="bg-surface-2 border-line-soft rounded-row flex flex-col gap-1 border px-4 py-3">
                <span className="text-text-faint text-label">Nota de este lavado</span>
                <p className="text-text text-body whitespace-pre-wrap">{ticket.notes}</p>
              </div>
            )}
          </Card>

          <Card className="gap-2.5 px-card">
            <CardSectionHeading>Servicios</CardSectionHeading>
            <TicketLines
              items={ticket.items}
              // Abierto o lavando, el precio se edita en «Editar» como siempre
              // (060 RN-1). Desde listo se cierra: acá es texto y el candado pide
              // la firma de un administrador. Cobrado ya no se toca (RN-8). Vale
              // igual para el precio por unidad de un producto (065 RN-7).
              onChangePrice={
                ticket.status === 'READY' && canPrice
                  ? (item) => setPricingItemId(item.id)
                  : undefined
              }
            />
            <div className="border-line-soft mt-1 flex items-baseline justify-between border-t pt-3">
              <span className="text-text-faint text-label">Total</span>
              <span className="text-figure text-text tabular-nums">${ticket.total}</span>
            </div>
          </Card>

          {canAudit ? <TicketTimeline ticketId={ticket.id} /> : null}
        </div>

        <aside aria-label="Estado y acciones" className="xl:sticky xl:top-6">
          <Card className="gap-4 px-card">
            <TicketStatusHero ticket={ticket} />

            <div className="flex flex-col gap-0.5">
              <span className="text-text-faint text-label">Total</span>
              <span className="text-figure text-text tabular-nums">${ticket.total}</span>
            </div>

            {ticket.payments.length === 0 ? null : (
              <div className="bg-surface-2 border-line-soft rounded-row flex flex-col gap-2.5 border px-4 py-3">
                {/* Un cobro puede partirse en métodos (059): un sello por método
                    y el desglose abajo, renglón por renglón. */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-text-faint text-label">Cobro</span>
                  <TicketPaymentsStamp payments={ticket.payments} />
                </div>

                {ticket.payments.map((payment, index) => (
                  <div
                    key={`${payment.method}-${payment.paidAt}-${index}`}
                    className="flex flex-wrap items-baseline justify-between gap-2"
                  >
                    {/* «Transferencia · Agrícola ···5678 · Ref 998877», «Otro · cheque» (069). */}
                    <span className="text-text text-body min-w-0 break-words">
                      {paymentDetailLabel(payment)}
                    </span>
                    <span className="text-text font-mono tabular-nums">${payment.amount}</span>
                  </div>
                ))}

                {/* Quién cobró y a qué hora: hasta la 053 solo se veía en la
                    línea de tiempo, que pide `carwash.audit`. */}
                <div className="border-line-soft flex flex-col gap-2 border-t pt-2.5">
                  <Field label="Cobró" value={ticket.payments[0]?.recordedBy.fullName ?? '—'} />
                  <Field
                    label="Hora"
                    value={
                      ticket.payments[0] === undefined ? '—' : timeOf(ticket.payments[0].paidAt)
                    }
                  />
                  {ticket.charge === null ? null : (
                    <>
                      <Field
                        label="Cuenta"
                        value={<span className="font-mono">{ticket.charge.number}</span>}
                      />
                      {ticket.charge.cashTendered === null ? null : (
                        <Field label="Recibido" value={`$${ticket.charge.cashTendered}`} />
                      )}
                      {ticket.charge.changeGiven === null ? null : (
                        <Field label="Cambio" value={`$${ticket.charge.changeGiven}`} />
                      )}
                    </>
                  )}
                  {jointCharge === null ? null : (
                    <p className="text-text-dim text-dense">
                      {jointCharge}. El cobro de la cuenta es de ${ticket.charge?.total}.
                    </p>
                  )}
                </div>
              </div>
            )}

            <OfficeWashers ticket={ticket} canManage={canManage} />

            {/* Los mismos botones de siempre, por estado y permiso (RN-9,
                RN-16); solo cambian de sitio. Apilados en el panel, de a dos
                por fila cuando el panel ocupa todo el ancho. */}
            <div className="grid gap-2 max-xl:grid-cols-[repeat(auto-fit,minmax(180px,1fr))] empty:hidden">
              {ticket.status === 'READY' && canCharge ? (
                <Button type="button" className="w-full" onClick={() => onCharging(true)}>
                  Cobrar ${ticket.total}
                </Button>
              ) : null}

              {ticket.status === 'OPEN' && canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setEditing(true)}
                >
                  Editar
                </Button>
              ) : null}

              {isOperationalStatus(ticket.status) && canManage ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setChangingStatus(true)}
                >
                  Cambiar estado
                </Button>
              ) : null}

              {ticket.status === 'PAID' ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => window.print()}
                >
                  Imprimir recibo
                </Button>
              ) : null}
            </div>

            {/* Lo que deshace va aparte, al pie: no se toca por error al ir a
                «Cobrar» o «Editar». */}
            {(isOperationalStatus(ticket.status) && canVoid) ||
            (ticket.status === 'PAID' && canReverse) ? (
              <div className="border-line-soft border-t pt-4">
                {ticket.status === 'PAID' ? (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setReversing(true)}
                  >
                    Deshacer cobro
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    className="w-full"
                    onClick={() => setVoiding(true)}
                  >
                    Anular
                  </Button>
                )}
              </div>
            ) : null}
          </Card>
        </aside>
      </div>

      <ChargeDialog ticket={ticket} open={charging} onOpenChange={onCharging} />
      <VoidTicketDialog ticket={ticket} open={voiding} onOpenChange={setVoiding} />
      {reversing ? <ReverseTicketDialog ticket={ticket} open onOpenChange={setReversing} /> : null}
      {editing ? <EditTicketDialog ticket={ticket} open onOpenChange={setEditing} /> : null}
      {changingStatus ? (
        <ChangeTicketStatusDialog ticket={ticket} open onOpenChange={setChangingStatus} />
      ) : null}
      {pricingItem === null ? null : (
        <ChangePriceDialog
          ticket={ticket}
          item={pricingItem}
          open
          onOpenChange={(next) => {
            if (!next) setPricingItemId(null);
          }}
        />
      )}
    </div>
  );
}

function OfficeWashers({ ticket, canManage }: { ticket: Ticket; canManage: boolean }) {
  const employees = useEmployees(canManage);
  const put = useSetTicketWashers(ticket.id);
  const editable =
    canManage &&
    (ticket.status === 'OPEN' || ticket.status === 'WASHING' || ticket.status === 'READY');
  const options = [
    ...(employees.data ?? [])
      .filter((employee) => employee.isActive)
      .map((employee) => ({ id: employee.id, fullName: employee.fullName })),
    ...ticket.washers
      .filter((washer) => !(employees.data ?? []).some((employee) => employee.id === washer.id))
      .map((washer) => ({ id: washer.id, fullName: washer.fullName })),
  ];

  return (
    <div className="flex flex-col gap-2">
      {editable ? (
        <AssigneeField
          employees={options}
          value={ticket.washers[0]?.id ?? null}
          onChange={(id) => put.mutate({ employeeIds: id === null ? [] : [id] })}
          disabled={put.isPending}
        />
      ) : (
        <>
          <span className="text-text-faint text-label">A cargo de</span>
          <span className="text-text text-body">{washerNames(ticket.washers)}</span>
        </>
      )}
      {put.error ? (
        <p className="text-danger-text text-body" role="alert">
          {put.error.message}
        </p>
      ) : null}
    </div>
  );
}

/** Un dato de la rejilla del vehículo (064): el rótulo arriba, el valor abajo. */
function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-text-faint text-label">{label}</span>
      <span className="text-text text-body font-medium [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

/** Un par rótulo/valor de la ficha: el rótulo a la izquierda, el dato a la derecha. */
function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-text-faint text-label">{label}</span>
      <span className="text-text text-right text-body">{value}</span>
    </div>
  );
}
