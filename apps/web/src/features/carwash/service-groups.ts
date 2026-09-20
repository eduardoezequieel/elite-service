import type { ServiceDetail } from '@elite/shared';

/** Un rubro del catálogo con los servicios activos que cuelgan de él. */
export interface ServiceGroup {
  id: string;
  name: string;
  services: ServiceDetail[];
}

/**
 * Agrupa el catálogo por `service.category`, en el `sortOrder` del rubro (039).
 *
 * Un rubro sin servicios activos no se pinta. El agrupado sale siempre del
 * catálogo: acá no hay ningún nombre de categoría escrito a mano, porque los
 * rubros los crea el taller y cambian sin tocar el código.
 */
export function groupByCategory(services: readonly ServiceDetail[]): ServiceGroup[] {
  const groups = new Map<string, ServiceGroup & { sortOrder: number }>();

  for (const service of services) {
    if (!service.isActive) continue;

    const existing = groups.get(service.category.id);

    if (existing === undefined) {
      groups.set(service.category.id, {
        id: service.category.id,
        name: service.category.name,
        sortOrder: service.category.sortOrder,
        services: [service],
      });
    } else {
      existing.services.push(service);
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
    .map(({ id, name, services: list }) => ({ id, name, services: list }));
}

/**
 * Elige `service` soltando lo que hubiera del mismo rubro, y lo deselecciona
 * si ya estaba elegido (039 RN-2).
 */
export function toggleInCategory(
  selected: readonly string[],
  service: ServiceDetail,
  catalog: readonly ServiceDetail[],
): string[] {
  const categoryOf = new Map(catalog.map((item) => [item.id, item.category.id]));
  const rest = selected.filter(
    (id) => id !== service.id && categoryOf.get(id) !== service.category.id,
  );

  return selected.includes(service.id) ? rest : [...rest, service.id];
}

/**
 * Lo elegido en el alta o en la edición: un servicio por rubro y, aparte, el
 * precio de las líneas a las que se les hizo un descuento (030). Lo que no
 * está en `prices` cobra el precio del catálogo.
 */
export interface ServiceSelection {
  selected: string[];
  prices: Record<string, string>;
}

export const EMPTY_SELECTION: ServiceSelection = { selected: [], prices: {} };

/** El precio del servicio para ese tipo de carro: la matriz gana al base (RN-2). */
export function catalogPriceOf(service: ServiceDetail, bodyTypeId: string): string {
  return service.prices.find((row) => row.bodyTypeId === bodyTypeId)?.price ?? service.defaultPrice;
}

/** Una línea ya resuelta: qué es, de qué rubro y a cuánto se cobra. */
export interface SelectedLine {
  id: string;
  name: string;
  categoryName: string;
  /** El precio del catálogo para el tipo de carro elegido. Es el tope. */
  catalog: string;
  /** Lo que se cobra: el del catálogo, o el descontado. */
  price: string;
}

/**
 * Las líneas elegidas, **en el orden de los rubros**: un lavado y un pulido son
 * dos líneas que se suman, y el orden no depende de en qué orden se tocaron.
 */
export function selectedLines(
  services: readonly ServiceDetail[],
  selection: ServiceSelection,
  bodyTypeId: string,
): SelectedLine[] {
  return groupByCategory(services).flatMap((group) =>
    group.services
      .filter((service) => selection.selected.includes(service.id))
      .map((service) => {
        const catalog = catalogPriceOf(service, bodyTypeId);

        return {
          id: service.id,
          name: service.name,
          categoryName: group.name,
          catalog,
          price: selection.prices[service.id] ?? catalog,
        };
      }),
  );
}

/**
 * Elige un servicio: suelta el que hubiera de su mismo rubro, y si era el que
 * ya estaba elegido lo deselecciona. Lo que se suelta pierde su descuento; lo
 * que sigue elegido lo conserva.
 */
export function toggleService(
  selection: ServiceSelection,
  service: ServiceDetail,
  catalog: readonly ServiceDetail[],
): ServiceSelection {
  const selected = toggleInCategory(selection.selected, service, catalog);

  return {
    selected,
    prices: Object.fromEntries(
      Object.entries(selection.prices).filter(([id]) => selected.includes(id)),
    ),
  };
}

/**
 * Cambiar el tipo de carro mueve el catálogo: cada descuento se recorta al
 * nuevo tope (030 RN-3). El que quedó en el precio de lista deja de ser un
 * descuento y vuelve a salir del catálogo.
 */
export function clampToBodyType(
  selection: ServiceSelection,
  services: readonly ServiceDetail[],
  bodyTypeId: string,
  clamp: (value: string, catalog: string) => string,
): ServiceSelection {
  return {
    selected: selection.selected,
    prices: Object.fromEntries(
      Object.entries(selection.prices).flatMap(([serviceId, value]) => {
        const service = services.find((candidate) => candidate.id === serviceId);

        if (service === undefined) return [];

        return [[serviceId, clamp(value, catalogPriceOf(service, bodyTypeId))]];
      }),
    ),
  };
}
