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
  if (isVehicle(body)) return withCostAccess(body, access);
  if (Array.isArray(body)) return body.map((item) => maskResponse(item, access));
  if (typeof body === 'object' && body !== null && 'items' in body && Array.isArray(body.items)) {
    return { ...body, items: body.items.map((item: unknown) => maskResponse(item, access)) };
  }

  return body;
}

@Injectable()
export class FleetCostsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Record<string, unknown>>();
    const access = costAccessOf(request[REQUEST_USER_KEY] as AuthenticatedUser | undefined);

    return next.handle().pipe(map((body: unknown) => maskResponse(body, access)));
  }
}
