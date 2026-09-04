'use client';

import type { Customer, VehicleBodyType, VehicleWithOwner } from '@elite/shared';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { CustomerField, EMPTY_CUSTOMER, type CustomerDraft } from './customer-field';

export interface VehicleChangesSubmission {
  bodyTypeId: string;
  make?: string;
  color?: string;
  customerId?: string | null;
  customer?: { fullName: string; phone?: string };
}

export function VehicleChangeDialog({
  open,
  vehicle,
  bodyTypes,
  customerScope,
  searchCustomers,
  isSubmitting = false,
  onOpenChange,
  onConfirmChanges,
  onWrongPlate,
}: {
  open: boolean;
  vehicle: VehicleWithOwner | null;
  bodyTypes: VehicleBodyType[];
  customerScope: string;
  searchCustomers: (query: string) => Promise<Customer[]>;
  isSubmitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmChanges: (changes: VehicleChangesSubmission) => void;
  onWrongPlate: () => void;
}) {
  if (!open || vehicle === null) return null;

  return (
    <VehicleChangeDialogContent
      vehicle={vehicle}
      bodyTypes={bodyTypes}
      customerScope={customerScope}
      searchCustomers={searchCustomers}
      isSubmitting={isSubmitting}
      onOpenChange={onOpenChange}
      onConfirmChanges={onConfirmChanges}
      onWrongPlate={onWrongPlate}
    />
  );
}

function VehicleChangeDialogContent({
  vehicle,
  bodyTypes,
  customerScope,
  searchCustomers,
  isSubmitting,
  onOpenChange,
  onConfirmChanges,
  onWrongPlate,
}: {
  vehicle: VehicleWithOwner;
  bodyTypes: VehicleBodyType[];
  customerScope: string;
  searchCustomers: (query: string) => Promise<Customer[]>;
  isSubmitting: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmChanges: (changes: VehicleChangesSubmission) => void;
  onWrongPlate: () => void;
}) {
  const [bodyTypeId, setBodyTypeId] = useState(vehicle.bodyType.id);
  const [make, setMake] = useState(vehicle.make ?? '');
  const [color, setColor] = useState(vehicle.color ?? '');
  const [customer, setCustomer] = useState<CustomerDraft>(
    vehicle.currentOwner
      ? { kind: 'chosen', customer: vehicle.currentOwner }
      : EMPTY_CUSTOMER,
  );

  const initialOwnerId = vehicle.currentOwner?.id ?? null;
  const newOwnerId = customer.kind === 'chosen' ? customer.customer.id : null;
  const isDifferentOwner =
    Boolean(vehicle.currentOwner) &&
    (customer.kind === 'new' || (customer.kind === 'chosen' && newOwnerId !== initialOwnerId));

  const savedBodyTypeName = vehicle.bodyType.name;
  const newBodyTypeName = bodyTypes.find((b) => b.id === bodyTypeId)?.name ?? savedBodyTypeName;

  function handleConfirm(): void {
    const changes: VehicleChangesSubmission = {
      bodyTypeId,
      make: make.trim() || undefined,
      color: color.trim() || undefined,
      customerId: customer.kind === 'chosen' ? customer.customer.id : null,
      customer:
        customer.kind === 'new' && customer.fullName.trim() !== ''
          ? {
              fullName: customer.fullName.trim(),
              phone: customer.phone.trim() || undefined,
            }
          : undefined,
    };

    onConfirmChanges(changes);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2 mb-1">
            <PlateChip plate={vehicle.plate} />
          </div>
          <DialogTitle>
            {isDifferentOwner ? '¿Cambió de dueño o se equivocó de placa?' : 'Modificar ficha del vehículo'}
          </DialogTitle>
          <DialogDescription>
            {isDifferentOwner
              ? `La placa está registrada a nombre de ${vehicle.currentOwner?.fullName ?? 'otro cliente'}. Confirmá si el vehículo cambió de dueño o cancelá si la placa es incorrecta.`
              : 'Verificá los valores guardados y los nuevos antes de guardar los cambios.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {/* Ficha guardada */}
          <div className="border-line bg-surface-2 rounded-row border p-3.5 text-dense">
            <span className="text-text-faint text-label block uppercase tracking-wide mb-1">
              Valor guardado en sistema
            </span>
            <div className="grid gap-1 sm:grid-cols-2 text-text">
              <div>
                <span className="text-text-dim">Tipo: </span>
                <span className="font-semibold">{savedBodyTypeName}</span>
              </div>
              <div>
                <span className="text-text-dim">Marca y color: </span>
                <span className="font-semibold">
                  {[vehicle.make, vehicle.color].filter(Boolean).join(' · ') || 'Sin especificar'}
                </span>
              </div>
              <div className="sm:col-span-2">
                <span className="text-text-dim">Dueño: </span>
                <span className="font-semibold">
                  {vehicle.currentOwner?.fullName ?? 'Sin dueño registrado'}
                </span>
              </div>
            </div>
          </div>

          {/* Formulario de nuevos valores */}
          <div className="flex flex-col gap-3.5">
            <div>
              <Label className="text-dense text-text font-semibold mb-1.5 block">
                Tipo de vehículo (nuevo)
              </Label>
              <div className="flex flex-wrap gap-2">
                {bodyTypes.map((bt) => (
                  <Button
                    key={bt.id}
                    type="button"
                    variant={bt.id === bodyTypeId ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBodyTypeId(bt.id)}
                  >
                    {bt.name}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FieldBox>
                <Label htmlFor="change-make">Marca (nueva)</Label>
                <Input
                  id="change-make"
                  value={make}
                  onChange={(e) => setMake(e.target.value)}
                  placeholder="Toyota"
                />
              </FieldBox>
              <FieldBox>
                <Label htmlFor="change-color">Color (nuevo)</Label>
                <Input
                  id="change-color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="Rojo"
                />
              </FieldBox>
            </div>

            <div className="border-line-soft border-t pt-3">
              <Label className="text-dense text-text font-semibold mb-1.5 block">
                Dueño del vehículo
              </Label>
              <CustomerField
                value={customer}
                onChange={setCustomer}
                scope={customerScope}
                searchCustomers={searchCustomers}
              />
            </div>
          </div>

          {/* Resumen del cambio */}
          <div className="border-line bg-surface rounded-row border p-3 text-dense">
            <span className="text-text-faint text-label block mb-1">
              Nuevo valor que se guardará
            </span>
            <span className="text-text font-semibold block">
              {newBodyTypeName} · {[make.trim(), color.trim()].filter(Boolean).join(' · ') || 'Sin marca/color'} ·{' '}
              {customer.kind === 'chosen'
                ? customer.customer.fullName
                : customer.kind === 'new'
                  ? customer.fullName.trim() || 'Nuevo cliente'
                  : 'Sin dueño'}
            </span>
          </div>
        </DialogBody>

        <DialogFooter className="flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onWrongPlate}
            disabled={isSubmitting}
          >
            Me equivoqué de placa
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isDifferentOwner ? 'Cambió de dueño' : 'Confirmar cambios'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
