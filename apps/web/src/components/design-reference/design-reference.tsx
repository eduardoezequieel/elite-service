'use client';

import * as React from 'react';

import { useDensity } from '@/components/density-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Reference } from '@/components/ui/reference';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Stamp, type StampTone } from '@/components/ui/stamp';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

/**
 * Página de referencia del sistema de diseño.
 *
 * No es una pantalla de negocio: existe para verificar a ojo la paleta, la
 * escala tipográfica, las dos densidades y las primitivas, en los dos temas.
 * Vive en `/` mientras no exista la primera pantalla real (spec 002 → UI).
 *
 * Todos los datos son sintéticos.
 */

const SWATCHES: ReadonlyArray<{ token: string; name: string; role: string; className: string }> = [
  { token: '--background', name: 'Papel', role: 'Fondo de la aplicación', className: 'bg-background' },
  { token: '--card', name: 'Lámina', role: 'Superficie de contenido', className: 'bg-card' },
  { token: '--foreground', name: 'Tinta', role: 'Texto principal', className: 'bg-foreground' },
  { token: '--muted-foreground', name: 'Grafito', role: 'Texto secundario', className: 'bg-muted-foreground' },
  { token: '--border', name: 'Filete', role: 'Línea entre celdas', className: 'bg-border' },
  { token: '--rule', name: 'Regla', role: 'Separación de secciones', className: 'bg-rule' },
  { token: '--brand', name: 'Naranja Elite', role: 'Marca · nunca texto', className: 'bg-brand' },
  { token: '--primary', name: 'Naranja de Acción', role: 'Relleno accionable', className: 'bg-primary' },
];

const STAMPS: ReadonlyArray<{ tone: StampTone; label: string; use: string }> = [
  { tone: 'neutral', label: 'Recibido', use: 'En espera, neutro' },
  { tone: 'amber', label: 'En diagnóstico', use: 'En proceso, requiere atención' },
  { tone: 'green', label: 'Listo', use: 'Aprobado, pagado' },
  { tone: 'red', label: 'Vencida', use: 'Rechazado, detenido' },
  { tone: 'blue', label: 'Programada', use: 'Informativo' },
];

const TYPE_SCALE: ReadonlyArray<{ name: string; spec: string; className: string; sample: string }> = [
  { name: 'Figure', spec: '44/44 · 700 · tabular', className: 'text-figure', sample: '12' },
  { name: 'Display', spec: '34/38 · 600', className: 'text-display', sample: 'Órdenes de trabajo' },
  { name: 'Headline', spec: '26/32 · 600', className: 'text-headline', sample: 'Órdenes de trabajo' },
  { name: 'Title', spec: '20/26 · 600', className: 'text-title', sample: 'Órdenes de trabajo' },
  { name: 'Body', spec: '14/22 · 400', className: 'text-body', sample: 'El vehículo entró por ruido en el tren delantero.' },
  { name: 'Dense', spec: '13/20 · 400 · tabular', className: 'text-dense', sample: 'El vehículo entró por ruido en el tren delantero.' },
  { name: 'Label', spec: '12/16 · 600', className: 'text-label', sample: 'Placa del vehículo' },
  { name: 'Mono', spec: '13/20 · cadenas de máquina', className: 'font-mono text-dense', sample: '1HGCM82633A004352' },
];

/** Datos sintéticos: no corresponden a ningún taller real. */
const ROWS: ReadonlyArray<{
  reference: number;
  plate: string;
  vehicle: string;
  bay: string;
  tone: StampTone;
  status: string;
  urgency: 1 | 2 | 3 | 4;
}> = [
  { reference: 14, plate: 'P 482-317', vehicle: 'Toyota Hilux 2019', bay: 'Bahía 1', tone: 'amber', status: 'En diagnóstico', urgency: 3 },
  { reference: 15, plate: 'P 903-114', vehicle: 'Nissan Frontier 2021', bay: 'Bahía 2', tone: 'neutral', status: 'Recibido', urgency: 1 },
  { reference: 16, plate: 'P 226-880', vehicle: 'Kia Rio 2017', bay: '—', tone: 'red', status: 'Vencida', urgency: 4 },
  { reference: 17, plate: 'P 771-045', vehicle: 'Mazda CX-5 2022', bay: 'Bahía 3', tone: 'green', status: 'Listo', urgency: 2 },
];

/** La Regla de la Tinta Continua: la urgencia es una escala, no un chip. */
const URGENCY_BAR: Record<1 | 2 | 3 | 4, string> = {
  1: 'shadow-[inset_2px_0_0_0_var(--rule)]',
  2: 'shadow-[inset_2px_0_0_0_var(--stamp-neutral)]',
  3: 'shadow-[inset_2px_0_0_0_var(--stamp-amber)]',
  4: 'shadow-[inset_2px_0_0_0_var(--stamp-red)]',
};

const URGENCY_WEIGHT: Record<1 | 2 | 3 | 4, string> = {
  1: 'font-normal',
  2: 'font-normal',
  3: 'font-semibold',
  4: 'font-bold',
};

function Plate({
  reference,
  title,
  note,
  children,
  className,
}: {
  reference: number;
  title: string;
  note?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('bg-card border-rule rounded-lg border', className)}>
      <header className="border-border flex items-center gap-3 border-b px-plate py-3">
        <Reference value={reference} />
        <h2 className="text-title">{title}</h2>
        {note ? <p className="text-muted-foreground ml-auto text-label">{note}</p> : null}
      </header>
      <div className="p-plate">{children}</div>
    </section>
  );
}

export function DesignReference() {
  const { density, mode, setDensity } = useDensity();

  return (
    <main className="min-h-screen px-6 py-8">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-8">
        <header className="flex flex-wrap items-center gap-4">
          {/* Reservado del logo: no existe el archivo original todavía. */}
          <div
            className="border-rule text-muted-foreground flex h-8 min-w-32 items-center justify-center rounded-md border border-dashed px-3 text-label"
            title="Reservado del logo — falta el archivo original"
          >
            Logo pendiente
          </div>
          <div>
            <h1 className="text-display">Sistema de diseño</h1>
            <p className="text-muted-foreground text-body">
              El Catálogo de Piezas · referencia visual, no una pantalla de negocio
            </p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <Separator />

        <Plate reference={1} title="Paleta" note="claro y oscuro">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SWATCHES.map((swatch) => (
              <div key={swatch.token} className="flex flex-col gap-2">
                <div className={cn('border-border h-14 rounded-md border', swatch.className)} />
                <div>
                  <p className="text-dense font-semibold">{swatch.name}</p>
                  <p className="text-muted-foreground font-mono text-label font-normal">{swatch.token}</p>
                  <p className="text-muted-foreground text-label font-normal">{swatch.role}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-4 text-dense">
            El Naranja Elite marca, no habla: nunca se usa como color de texto y no pasa del 5% de
            la pantalla.
          </p>
        </Plate>

        <Plate reference={2} title="Sellos de estado" note="relleno suave">
          <div className="flex flex-col gap-3">
            {STAMPS.map((stamp) => (
              <div key={stamp.tone} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stamp tone={stamp.tone} label={stamp.label} />
                <span className="text-muted-foreground text-dense">{stamp.use}</span>
              </div>
            ))}
          </div>
          <p className="text-muted-foreground mt-4 text-dense">
            El fondo es el propio tono al 10% y el filete al 25%; el texto va en el tono pleno. El
            sello siempre lleva la palabra: el color nunca comunica solo.
          </p>
        </Plate>

        <Plate reference={3} title="Tipografía" note="Archivo · JetBrains Mono">
          <div className="flex flex-col gap-5">
            {TYPE_SCALE.map((step) => (
              <div key={step.name} className="flex flex-col gap-1">
                <p className="text-muted-foreground text-label">
                  {step.name} · {step.spec}
                </p>
                <p className={step.className}>{step.sample}</p>
              </div>
            ))}
          </div>
        </Plate>

        <Plate
          reference={4}
          title="Densidad"
          note={mode === 'auto' ? `automática · ${density}` : `fijada · ${density}`}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={mode === 'manual' && density === 'mostrador' ? 'default' : 'secondary'}
              onClick={() => setDensity('mostrador')}
            >
              Mostrador
            </Button>
            <Button
              variant={mode === 'manual' && density === 'bahia' ? 'default' : 'secondary'}
              onClick={() => setDensity('bahia')}
            >
              Bahía
            </Button>
            <Button variant="ghost" onClick={() => setDensity('auto')}>
              Automática
            </Button>
          </div>
          <p className="text-muted-foreground mt-4 text-dense">
            Mostrador: fila de 36px y control de 32px. Bahía: fila de 56px, control de 48px y
            objetivo táctil de 44px. Cambia la densidad, nunca el vocabulario.
          </p>
        </Plate>

        <Plate reference={5} title="Tabla" note="el componente central del sistema">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Ref.</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead className="hidden sm:table-cell">Vehículo</TableHead>
                <TableHead className="hidden md:table-cell">Bahía</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ROWS.map((row) => (
                <TableRow key={row.reference} className={URGENCY_BAR[row.urgency]}>
                  <TableCell>
                    <Reference value={row.reference} />
                  </TableCell>
                  <TableCell className={URGENCY_WEIGHT[row.urgency]}>{row.plate}</TableCell>
                  <TableCell className="hidden sm:table-cell">{row.vehicle}</TableCell>
                  <TableCell className="hidden md:table-cell">{row.bay}</TableCell>
                  <TableCell>
                    <Stamp tone={row.tone} label={row.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-muted-foreground mt-4 text-dense">
            Sin cebra, filete de 1px entre filas y la urgencia codificada en la barra izquierda más
            el peso de la placa. En pantalla angosta las columnas secundarias se retiran en vez de
            empujar la tabla fuera de la pantalla. Datos sintéticos.
          </p>
        </Plate>

        <Plate reference={6} title="Controles" note="botones, campos y bloqueo">
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Abrir orden</Button>
              <Button variant="secondary">Cancelar</Button>
              <Button variant="ghost">Ver detalle</Button>
              <Button variant="destructive">Eliminar</Button>
            </div>

            <div className="grid max-w-md gap-4">
              <div className="grid gap-1.5">
                <Label htmlFor="reference-plate">Placa del vehículo</Label>
                <Input id="reference-plate" placeholder="P 000-000" />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="reference-vin">VIN</Label>
                <Input id="reference-vin" className="font-mono" placeholder="1HGCM82633A004352" />
              </div>
            </div>

            <div>
              <p className="text-muted-foreground mb-2 text-label">Anulado</p>
              <div className="border-border text-muted-foreground w-fit rounded-md border px-3 py-2 text-dense">
                <span className="is-ruled-out">Bahía 3</span> fuera de servicio por mantenimiento
              </div>
              <p className="text-muted-foreground mt-2 text-dense">
                Lo anulado lleva la regla de anulación sobre el dato que dejó de valer, más el texto
                que dice por qué. Nunca se apaga bajando la opacidad, y la razón se lee limpia.
              </p>
            </div>
          </div>
        </Plate>
      </div>
    </main>
  );
}
