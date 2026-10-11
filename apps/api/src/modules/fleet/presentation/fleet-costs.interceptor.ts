import { PERMISSIONS } from '@elite/shared';
import type { FleetVehicle } from '@elite/shared';
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

import { REQUEST_USER_KEY, type AuthenticatedUser } from '../../../common/auth/authenticated-user';
import { withCostAccess, type FleetCostAccess } from '../application/fleet-costs';

/** El permiso de quien pide, como lo lee la regla de costos (103, RN-1). */
export function costAccessOf(user: AuthenticatedUser | undefined): FleetCostAccess {
  return {
    canSeeCosts: user?.permissions.includes(PERMISSIONS.rentals.actions.reports.key) ?? false,
  };
}

/** El nombre del cliente es dato de la rentadora: solo con `rentals.read` (115, RN-2). */
export function canSeeCustomersOf(user: AuthenticatedUser | undefined): boolean {
  return user?.permissions.includes(PERMISSIONS.rentals.actions.read.key) ?? false;
}

function isVehicle(value: unknown): value is FleetVehicle {
  return (
    typeof value === 'object' && value !== null && 'costsHidden' in value && 'dailyRate' in value
  );
}

/**
 * Enmascara los costos de toda respuesta de `/fleet/vehicles` (103): un carro,
 * una lista o una página (`{ items }`). Así ningún endpoint lo hace por su cuenta.
 */
export function maskResponse(body: unknown, access: FleetCostAccess): unknown {
  if (access.canSeeCosts) return body;

  return mapVehicles(body, (vehicle) => withCostAccess(vehicle, access));
}

/** Quita el nombre del cliente de la actividad a quien no ve la rentadora (115, RN-2). */
export function maskCustomers(body: unknown, canSeeCustomers: boolean): unknown {
  if (canSeeCustomers) return body;

  return mapVehicles(body, (vehicle) =>
    vehicle.activity === null
      ? vehicle
      : { ...vehicle, activity: { ...vehicle.activity, customerName: null } },
  );
}

/** Aplica `change` a cada carro de un carro, una lista o una página (`{ items }`). */
function mapVehicles(body: unknown, change: (vehicle: FleetVehicle) => FleetVehicle): unknown {
  if (isVehicle(body)) return change(body);
  if (Array.isArray(body)) return body.map((item: unknown) => mapVehicles(item, change));
  if (typeof body === 'object' && body !== null && 'items' in body && Array.isArray(body.items)) {
    return { ...body, items: body.items.map((item: unknown) => mapVehicles(item, change)) };
  }

  return body;
}

@Injectable()
export class FleetCostsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const user = request[REQUEST_USER_KEY] as AuthenticatedUser | undefined;
    const access = costAccessOf(user);
    const canSeeCustomers = canSeeCustomersOf(user);

    return next
      .handle()
      .pipe(map((body: unknown) => maskCustomers(maskResponse(body, access), canSeeCustomers)));
  }
}
