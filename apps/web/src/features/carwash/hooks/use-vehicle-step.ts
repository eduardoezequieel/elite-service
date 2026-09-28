'use client';

import type { Customer, CustomerMatch, VehicleWithOwner } from '@elite/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';

import { updateVehicle } from '../api';
import type { VehicleChangesSubmission } from '../components/vehicle-change-dialog';
import { draftFromCustomer } from '../customer-draft';
import {
  knownVehiclePatch,
  newVehiclePatch,
  searchAgainPatch,
  stepAfterCustomerVehicles,
  updatedVehiclePatch,
  type TicketFormInput,
  type TicketFormOutput,
  type VehicleStep,
} from '../ticket-draft';
import { customerVehiclesQuery, type ListCustomerVehicles } from './use-customer-vehicles';
import { formatPlate } from './use-vehicle-search';

/**
 * «El carro» del alta como flujo (026, 040, 082): en qué paso está y qué hace
 * cada toque. Elegir un carro es siempre una acción —la sugerencia, la lista de
 * carros de un cliente, el `409` del alta—, nunca un efecto sobre lo que llega
 * del servidor. Cada paso escribe sus campos en el formulario del alta.
 */
export function useVehicleStep({
  form,
  scope,
  listCustomerVehicles,
  matchCustomer,
}: {
  form: UseFormReturn<TicketFormInput, unknown, TicketFormOutput>;
  scope: string;
  listCustomerVehicles?: ListCustomerVehicles;
  matchCustomer: (fullName: string, phone?: string) => Promise<CustomerMatch | null>;
}) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<VehicleStep>({ kind: 'search' });
  /** Lo tecleado en la caja única, antes de elegir nada. */
  const [query, setQuery] = useState('');
  const [isUpdatingVehicle, setIsUpdatingVehicle] = useState(false);
  /** El cliente cuyos carros se están pidiendo: si se eligió otra cosa, la respuesta sobra. */
  const resolvingRef = useRef<string | null>(null);
  const selectedVehicle = step.kind === 'known' ? step.vehicle : null;

  /** Cambia varios campos a la vez, sin tocar los que no vienen. */
  function patch(next: Partial<TicketFormInput>): void {
    form.reset({ ...form.getValues(), ...next }, { keepDefaultValues: true });
  }

  function selectVehicle(vehicle: VehicleWithOwner): void {
    resolvingRef.current = null;
    setStep({ kind: 'known', vehicle });
    patch(knownVehiclePatch(vehicle));
  }

  /** Anotar un carro que el sistema no conoce. */
  function startNewVehicle(typed: string): void {
    resolvingRef.current = null;
    setStep({ kind: 'new' });
    patch(newVehiclePatch(formatPlate(typed)));
  }

  /** Volver a la caja única: se deshace la elección del carro, no el servicio. */
  function backToSearch(): void {
    resolvingRef.current = null;
    setStep({ kind: 'search' });
    setQuery('');
    patch(searchAgainPatch());
  }

  /**
   * Elegido un cliente, se piden sus carros y se resuelve solo cuando no hay
   * dudas (026): uno se preselecciona, ninguno pasa a carro nuevo y con varios
   * se pregunta cuál trajo.
   */
  async function pickCustomer(chosen: Customer): Promise<void> {
    form.setValue('customer', draftFromCustomer(chosen));
    setStep({ kind: 'choosing', customer: chosen });

    if (listCustomerVehicles === undefined) return;

    resolvingRef.current = chosen.id;
    let vehicles: readonly VehicleWithOwner[] = [];

    try {
      vehicles = await queryClient.fetchQuery(
        customerVehiclesQuery(scope, chosen.id, listCustomerVehicles),
      );
    } catch {
      // Sin la lista de sus carros se sigue como carro nuevo: nunca bloquea (026).
    }

    if (resolvingRef.current !== chosen.id) return;

    const next = stepAfterCustomerVehicles(chosen, vehicles);

    if (next.kind === 'known') selectVehicle(next.vehicle);
    else if (next.kind === 'new') startNewVehicle('');
  }

  /**
   * «Cambios del carro»: ficha y dueño corregidos. `true` si se guardó; si
   * falla, el diálogo se queda abierto con lo escrito.
   */
  async function confirmChanges(changes: VehicleChangesSubmission): Promise<boolean> {
    if (!selectedVehicle) return false;

    setIsUpdatingVehicle(true);
    try {
      let ownerId = changes.customerId;

      if (changes.customer && changes.customer.fullName) {
        const matched = await matchCustomer(changes.customer.fullName, changes.customer.phone);
        if (matched?.customer) ownerId = matched.customer.id;
      }

      const updated = await updateVehicle(selectedVehicle.id, {
        bodyTypeId: changes.bodyTypeId,
        make: changes.make,
        color: changes.color,
        customerId: ownerId ?? undefined,
      });

      setStep({ kind: 'known', vehicle: updated });
      patch(updatedVehiclePatch(updated));

      return true;
    } catch {
      return false;
    } finally {
      setIsUpdatingVehicle(false);
    }
  }

  return {
    step,
    query,
    setQuery,
    selectedVehicle,
    isUpdatingVehicle,
    selectVehicle,
    startNewVehicle,
    backToSearch,
    pickCustomer,
    confirmChanges,
  };
}
