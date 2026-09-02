'use client';

import type { CustomerMatch } from '@elite/shared';

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

/** Por qué se parece. Lo decide el backend (`on`), la web solo lo escribe. */
const REASON: Record<CustomerMatch['on'], string> = {
  phone: 'Tiene el mismo teléfono.',
  name: 'Se llama igual.',
};

/**
 * «¿Es el mismo?» — la pregunta que evita el duplicado (004 RN-2).
 *
 * Nunca bloquea: «Crear otro» siempre está, del mismo tamaño que «Usar ese» y
 * sin tinte de peligro. Dos personas pueden llamarse igual, y el sistema no
 * está para discutirlo con quien tiene al cliente enfrente.
 */
export function CustomerMatchDialog({
  match,
  onUseExisting,
  onCreateAnother,
  onOpenChange,
}: {
  /** La coincidencia a resolver, o `null` para no mostrar nada. */
  match: CustomerMatch | null;
  onUseExisting: () => void;
  onCreateAnother: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  if (match === null) return null;

  const { customer, on } = match;
  const phone = customer.phone ?? 'sin teléfono';

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>¿Es el mismo?</DialogTitle>
          <DialogDescription>
            Ya existe {customer.fullName} · {phone}. {REASON[on]}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <div className="border-line bg-surface-2 rounded-row border px-4 py-3">
            <span className="text-text block font-semibold">{customer.fullName}</span>
            <span className="text-text-faint block font-mono text-dense">{phone}</span>
          </div>

          <p className="text-text-dim text-dense">
            Si es la misma persona, el lavado se anota a su nombre y no se crea nadie. Si son dos
            personas distintas, se crea el cliente nuevo.
          </p>
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCreateAnother}>
            Crear otro
          </Button>
          <Button type="button" onClick={onUseExisting}>
            Usar ese
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
