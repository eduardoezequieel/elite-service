import type { BillingFineRecord } from './agreement-reader';

export interface NewRentalFine {
  vehicleId: string;
  agreementId: string | null;
  occurredAt: Date;
  amount: string;
  description: string;
  chargedToCustomer: boolean;
  createdByUserId: string;
}

export interface FineFilter {
  vehicleId?: string;
  agreementId?: string;
  /** `occurredAt >= from`. */
  from?: Date;
  /** `occurredAt < to`. */
  to?: Date;
}

/** Las multas de tránsito de la flota (098). */
export interface RentalFineRepository {
  vehicleExists(vehicleId: string): Promise<boolean>;
  create(fine: NewRentalFine): Promise<BillingFineRecord>;
  /** La más reciente primero. */
  list(filter: FineFilter): Promise<BillingFineRecord[]>;
}

export const RENTAL_FINE_REPOSITORY = Symbol('rental-billing.RentalFineRepository');
