'use client';

import type { FleetVehicle } from '@elite/shared';
import { Car } from 'lucide-react';
import { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';
import { carPaint, carPaintToken } from '../car-paint';
import { renderCar } from '../car-render';

/**
 * El carro en 3D (115, RN-3), pintado de su color. Mientras baja three.js, o
 * si el navegador no tiene WebGL, queda el ícono: la tarjeta funciona igual.
 */
export function FleetCarImage({
  vehicle,
  className,
}: {
  vehicle: Pick<FleetVehicle, 'category' | 'color'>;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const paint = carPaint(vehicle.color);

  useEffect(() => {
    let alive = true;
    const value = getComputedStyle(document.documentElement)
      .getPropertyValue(carPaintToken(paint))
      .trim();

    if (value !== '') {
      void renderCar(vehicle.category, value).then((image) => {
        if (alive) setSrc(image);
      });
    }

    return () => {
      alive = false;
    };
  }, [vehicle.category, paint]);

  if (src === null) {
    return (
      <span className={cn('text-text-faint grid place-items-center', className)} aria-hidden>
        <Car className="size-12" strokeWidth={1} />
      </span>
    );
  }

  // `<img>` y no `next/image`: es un `data:` hecho en el navegador.
  return <img src={src} alt="" className={cn('object-contain object-bottom', className)} />;
}
