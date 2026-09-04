'use client';

import * as React from 'react';

import { Logo } from '@/components/brand/logo';
import { useDensity } from '@/components/density-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { FieldBox } from '@/components/ui/field-box';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlateChip } from '@/components/ui/plate-chip';
import { Reference } from '@/components/ui/reference';
import { SegmentGauge } from '@/components/ui/segment-gauge';
import { Stamp, type StampTone } from '@/components/ui/stamp';
import { StatCard } from '@/components/ui/stat-card';
import { Tabs } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/**
 * `/design` — la referencia del sistema.
 *
 * No es una pantalla de negocio y no pide sesión: existe para verificar a ojo
 * la paleta de los dos temas, la escala tipográfica, las dos densidades y todas
 * las primitivas, sin tener que abrir el taller.
 *
 * La fuente de verdad visual sigue siendo `docs/prototype/elite-service-prototipo.html`
 * y el sistema escrito en `apps/web/DESIGN.md`. Acá no se inventa nada: cada
 * bloque muestra un componente tal como lo usan las pantallas reales.
 *
 * Todos los datos son sintéticos.
 */

/* ------------------------------------------------------------------ tokens */

interface Swatch {
  token: string;
  name: string;
  use: string;
  className: string;
}

/** Los colores se leen por su clase de token: acá no hay un solo hex. */
const SWATCHES: readonly Swatch[] = [
  { token: '--bg', name: 'Fondo', use: 'El fondo de la app', className: 'bg-bg' },
  { token: '--surface', name: 'Lámina', use: 'Tarjetas y filas', className: 'bg-surface' },
  {
    token: '--surface-2',
    name: 'Lámina 2',
    use: 'Inputs, hover, seleccionables',
    className: 'bg-surface-2',
  },
  {
    token: '--surface-3',
    name: 'Lámina 3',
    use: 'Superficie elevada extra',
    className: 'bg-surface-3',
  },
  { token: '--line', name: 'Filete', use: 'Borde visible', className: 'bg-line' },
  { token: '--line-soft', name: 'Filete suave', use: 'Borde en reposo', className: 'bg-line-soft' },
  { token: '--rail', name: 'Riel', use: 'Menú lateral, azul marino siempre', className: 'bg-rail' },
  { token: '--plate-bg', name: 'Placa', use: 'Fondo del chip de placa', className: 'bg-plate-bg' },
  { token: '--text', name: 'Tinta', use: 'Texto principal', className: 'bg-text' },
  { token: '--text-dim', name: 'Acero', use: 'Texto secundario', className: 'bg-text-dim' },
  {
    token: '--text-faint',
    name: 'Acero tenue',
    use: 'Rótulos y notas',
    className: 'bg-text-faint',
  },
  { token: '--flame', name: 'Llama', use: 'Acción principal, ítem activo', className: 'bg-flame' },
  {
    token: '--flame-hot',
    name: 'Llama clara',
    use: 'Extremo claro del degradado, foco',
    className: 'bg-flame-hot',
  },
  {
    token: '--flame-deep',
    name: 'Llama honda',
    use: 'Extremo oscuro del degradado',
    className: 'bg-flame-deep',
  },
  { token: '--go', name: 'Verde', use: 'Solo «Listo» y «Cobrado»', className: 'bg-go' },
  {
    token: '--danger',
    name: 'Peligro',
    use: 'Error, destructivo, «Anulado»',
    className: 'bg-danger',
  },
  { token: '--warn', name: 'Aviso', use: 'Advertencia', className: 'bg-warn' },
  {
    token: '--gradient-action',
    name: 'Degradado de acción',
    use: 'Primario, subrayado de pestaña',
    className: 'gradient-action',
  },
];

/* --------------------------------------------------------------- tipografía */

interface TypeStep {
  name: string;
  spec: string;
  className: string;
  sample: string;
}

const TYPE_SCALE: readonly TypeStep[] = [
  {
    name: 'Display',
    spec: 'Saira itálica 800 · 38px escritorio / 30px táctil · interlínea .95',
    className: 'text-display text-text',
    sample: 'Lavados',
  },
  {
    name: 'Figure',
    spec: 'Saira itálica 700 · 30px · cifras de estadística y totales',
    className: 'text-figure text-text',
    sample: '$148.00',
  },
  {
    name: 'Headline',
    spec: 'Inter 600 · 21/27',
    className: 'text-headline text-text',
    sample: 'Cobrar el lavado',
  },
  {
    name: 'Title',
    spec: 'Inter 600 · 17/23',
    className: 'text-title text-text',
    sample: 'Permisos',
  },
  {
    name: 'Body',
    spec: 'Inter 400 · 14.5/21 · el cuerpo de la interfaz',
    className: 'text-body text-text',
    sample: 'El carro entró a la fila y espera turno de lavado.',
  },
  {
    name: 'Dense',
    spec: 'Inter 400 · 12.5/18 · notas y datos apretados',
    className: 'text-dense text-text-dim',
    sample: 'Entra a la fila como Abierto. El cobro se hace en oficina.',
  },
  {
    name: 'Label',
    spec: 'Inter 600 · 12/16 · rótulos, en caja normal',
    className: 'text-label text-text-faint',
    sample: 'Tipo de carro',
  },
  {
    name: 'Mono',
    spec: 'Mono del sistema · placas, folios y montos, con cifras tabulares',
    className: 'font-mono text-body text-text tabular-nums',
    sample: 'CW-0142 · P456-782 · $12.00',
  },
];

/* -------------------------------------------------------------------- sellos */

const STAMPS: readonly { tone: StampTone; label: string; use: string }[] = [
  { tone: 'queue', label: 'En cola', use: 'Todavía nadie lo tocó' },
  { tone: 'washing', label: 'Lavando', use: 'El único chip que late' },
  { tone: 'ready', label: 'Listo', use: 'Listo para cobrar' },
  { tone: 'paid', label: 'Cobrado', use: 'Cerrado en bien: se apaga' },
  { tone: 'void', label: 'Anulado', use: 'Se dio de baja' },
  { tone: 'neutral', label: 'Inactivo', use: 'Neutro, en espera' },
  { tone: 'amber', label: 'Pendiente', use: 'Requiere atención' },
  { tone: 'green', label: 'Activo', use: 'Aprobado, encendido' },
  { tone: 'red', label: 'Rechazado', use: 'Detenido, vencido' },
  { tone: 'blue', label: 'Programado', use: 'Informativo' },
];

/* --------------------------------------------------------------- lista demo */

interface DemoRow {
  id: string;
  plate: string;
  customer: string;
  tone: StampTone;
  status: string;
  total: string;
}

/** Datos sintéticos: no corresponden a ningún lavado real. */
const DEMO_ROWS: readonly DemoRow[] = [
  {
    id: 'a',
    plate: 'P456-782',
    customer: 'Ana Sofía Portillo',
    tone: 'washing',
    status: 'Abierto',
    total: '$12.00',
  },
  {
    id: 'b',
    plate: 'M112-904',
    customer: 'Gladys Rivera',
    tone: 'ready',
    status: 'Listo',
    total: '$18.00',
  },
  {
    id: 'c',
    plate: 'P330-118',
    customer: 'Carlos Menjívar',
    tone: 'paid',
    status: 'Cobrado',
    total: '$10.00',
  },
  {
    id: 'd',
    plate: 'C874-201',
    customer: 'Rosa Elena Cruz',
    tone: 'void',
    status: 'Anulado',
    total: '$14.00',
  },
];

type DemoTab = 'pendientes' | 'cobrar' | 'todos';

/* ------------------------------------------------------------------ armazón */

/** Una lámina numerada. Es la misma forma que usa una tarjeta del sistema. */
function Panel({
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
    <section
      className={cn('border-line-soft bg-surface shadow-elite rounded-card border', className)}
    >
      <header className="border-line-soft flex flex-wrap items-center gap-3 border-b px-card py-3.5">
        <Reference value={reference} />
        <h2 className="text-title text-text">{title}</h2>
        {note ? <p className="text-text-faint ml-auto text-label">{note}</p> : null}
      </header>
      <div className="p-card">{children}</div>
    </section>
  );
}

/** La nota al pie de una lámina: por qué la regla es así. */
function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-text-faint mt-5 text-dense">{children}</p>;
}

/** La rejilla de muestras de un tema. */
function Palette() {
  return (
    <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
      {SWATCHES.map((swatch) => (
        <div key={swatch.token} className="flex flex-col gap-2">
          <div className={cn('border-line h-12 rounded-control border', swatch.className)} />
          <div className="min-w-0">
            <p className="text-text text-dense font-semibold">{swatch.name}</p>
            <p className="text-text-faint truncate font-mono text-label font-normal">
              {swatch.token}
            </p>
            <p className="text-text-dim text-label font-normal">{swatch.use}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------- página */

export function DesignReference() {
  const { density, mode, setDensity } = useDensity();
  const { toast } = useToast();
  const [tab, setTab] = React.useState<DemoTab>('pendientes');
  const [dialogOpen, setDialogOpen] = React.useState(false);

  return (
    <main className="bg-bg text-text min-h-screen px-4 py-8 md:px-6">
      <div className="mx-auto flex max-w-[1180px] flex-col gap-5">
        <header className="flex flex-wrap items-center gap-4">
          <Logo size={30} />
          <div className="min-w-0">
            <h1 className="text-display text-text">Sistema de diseño</h1>
            <p className="text-text-dim text-body">
              La piel de Elite Service · referencia visual, no una pantalla del taller
            </p>
          </div>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </header>

        <Panel reference={1} title="Color" note="los dos temas, lado a lado">
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <p className="text-text-faint mb-3 text-label">
                Tema actual · el del conmutador de arriba
              </p>
              <Palette />
            </div>
            <div
              data-theme="light"
              className="border-line bg-bg text-text rounded-row border p-3.5"
            >
              <p className="text-text-faint mb-3 text-label">Tema claro · fijado</p>
              <Palette />
            </div>
          </div>
          <Note>
            El naranja-rojo es acción: primario, pestaña activa, ítem activo del menú y el dato que
            se sale del precio base. Nunca relleno ni decoración. El verde es solo «Listo» y
            «Cobrado», y el rojo de error no es el naranja de acción. Ningún componente escribe un
            color: todos salen de estos tokens.
          </Note>
        </Panel>

        <Panel reference={2} title="Tipografía" note="Saira · Inter · mono del sistema">
          <div className="flex flex-col gap-5">
            {TYPE_SCALE.map((step) => (
              <div key={step.name} className="flex flex-col gap-1">
                <p className="text-text-faint text-label">
                  {step.name} · {step.spec}
                </p>
                <p className={step.className}>{step.sample}</p>
              </div>
            ))}
          </div>
          <Note>
            Saira itálica es el gesto de la marca y vive solo en el título de pantalla, las cifras y
            el wordmark. Inter lleva toda la interfaz. Los datos de máquina —placas, folios, montos—
            van en la mono del sistema, con cifras tabulares para que las columnas alineen. Sin
            mayúsculas forzadas en ningún sitio salvo el logo.
          </Note>
        </Panel>

        <Panel reference={3} title="Botones" note="un solo primario">
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button>Abrir lavado</Button>
              <Button variant="secondary">Cancelar</Button>
              <Button variant="outline">Ver detalle</Button>
              <Button variant="ghost">Marcar todo</Button>
              <Button variant="link">Volver a la fila</Button>
              <Button variant="destructive">Eliminar</Button>
              <Button variant="destructiveSolid">Eliminar rol</Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button loading>Guardando</Button>
              <Button variant="secondary" loading>
                Guardando
              </Button>
              <Button disabled>Elegí un método</Button>
              <Button variant="outline" disabled>
                Sin permiso
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="xs">Extra chico</Button>
              <Button size="sm">Chico</Button>
              <Button>Normal</Button>
              <Button size="lg">Grande</Button>
            </div>
          </div>
          <Note>
            El degradado de llama es el único primario, y en una pantalla hay uno solo. Todo lo
            demás es fantasma. El rojo relleno vive únicamente dentro de un diálogo de confirmación.
            Cargando, el botón no cambia de ancho: el texto sigue reservando su sitio.
          </Note>
        </Panel>

        <Panel reference={4} title="Campos" note="reposo, foco y error">
          <div className="grid max-w-2xl gap-4 md:grid-cols-2">
            <FieldBox>
              <Label htmlFor="design-plate">Placa</Label>
              <Input id="design-plate" className="font-mono" placeholder="P000-000" />
            </FieldBox>
            <FieldBox>
              <Label htmlFor="design-price">Precio base</Label>
              <Input
                id="design-price"
                className="font-mono tabular-nums"
                inputMode="decimal"
                defaultValue="12.00"
              />
            </FieldBox>
            <div className="grid gap-1.5">
              <FieldBox>
                <Label htmlFor="design-email">Correo</Label>
                <Input
                  id="design-email"
                  type="email"
                  aria-invalid
                  aria-describedby="design-email-error"
                  defaultValue="persona@"
                />
              </FieldBox>
              <p id="design-email-error" className="text-danger-text text-dense" role="alert">
                Escribí un correo válido.
              </p>
            </div>
            <div className="grid gap-1.5">
              <FieldBox>
                <Label htmlFor="design-disabled">Correo de la cuenta</Label>
                <Input id="design-disabled" disabled defaultValue="ana@taller.sv" />
              </FieldBox>
              <p className="text-text-dim text-dense">
                El correo identifica la cuenta y no se cambia desde acá.
              </p>
            </div>
            <FieldBox className="md:col-span-2">
              <Label htmlFor="design-note">Nota</Label>
              <Textarea id="design-note" rows={3} placeholder="Rayón en la puerta del conductor…" />
            </FieldBox>
          </div>
          <Note>
            La etiqueta va adentro de la caja, encima del valor. El error se dice con palabras al
            pie y con `aria-invalid` en el control, no solo con el borde: el color nunca comunica
            solo. El anillo de foco rodea la caja, no el input de adentro.
          </Note>
        </Panel>

        <Panel reference={5} title="Chips de estado" note="punto y palabra">
          <div className="grid gap-3 sm:grid-cols-2">
            {STAMPS.map((stamp) => (
              <div key={stamp.tone} className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stamp tone={stamp.tone} label={stamp.label} />
                <span className="text-text-dim text-dense">{stamp.use}</span>
              </div>
            ))}
          </div>
          <Note>
            El fondo es el propio tono al 12%, el filete al 40% y el texto en el tono pleno. El chip
            siempre lleva la palabra escrita. «Lavando» es el único que late, y{' '}
            <code className="font-mono">prefers-reduced-motion</code> lo apaga.
          </Note>
        </Panel>

        <Panel reference={6} title="Chip de placa" note="el dato que se dice en voz alta">
          <div className="flex flex-wrap items-end gap-3">
            <PlateChip plate="P456-782" size="sm" />
            <PlateChip plate="P456-782" />
            <PlateChip plate="P456-782" size="lg" />
          </div>
          <Note>
            Mono, negrita y letra abierta, como una matrícula. `sm` donde falta sitio, `md` en una
            fila y `lg` en el título de un detalle.
          </Note>
        </Panel>

        <Panel reference={7} title="Pestañas" note="con contador real">
          <Tabs
            value={tab}
            onValueChange={setTab}
            aria-label="Ejemplo de pestañas"
            items={[
              { value: 'pendientes', label: 'Pendientes', count: 6 },
              { value: 'cobrar', label: 'Listos para cobrar', count: 2 },
              { value: 'todos', label: 'Todos', count: 18 },
            ]}
          />
          <p className="text-text-dim mt-4 text-body" id={`tabpanel-${tab}`} role="tabpanel">
            Panel de «{tab}». La pestaña solo manda el valor elegido hacia arriba; el panel lo
            dibuja la pantalla.
          </p>
        </Panel>

        <Panel reference={8} title="Estadísticas y medidor" note="el día de un vistazo">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="En cola" value="6" unit="carros" />
            <StatCard label="Listos para cobrar" value="2" unit="carros" tone="go" />
            <StatCard label="Cobrado hoy" value="$148.00" tone="go" />
            <StatCard label="Avance del día" value="11" unit="de 18">
              <SegmentGauge value={11} max={18} label="Cobrados" />
            </StatCard>
          </div>
          <Note>
            El medidor sirve solo para «X de Y»: una cuenta contra un techo real, nunca una barra de
            tiempo ni un adorno.
          </Note>
        </Panel>

        <Panel reference={9} title="Lista" note="una sola lista para todas las pantallas">
          <DataTable
            rows={[...DEMO_ROWS]}
            rowKey={(row) => row.id}
            emptyMessage="Sin filas."
            columns={[
              {
                key: 'plate',
                header: 'Placa',
                stack: 'title',
                className: 'whitespace-nowrap',
                cell: (row) => <PlateChip plate={row.plate} />,
              },
              {
                key: 'customer',
                header: 'Cliente',
                headerClassName: 'w-full',
                cell: (row) => <span className="text-text-dim">{row.customer}</span>,
              },
              {
                key: 'status',
                header: 'Estado',
                stack: 'aside',
                className: 'whitespace-nowrap',
                cell: (row) => <Stamp tone={row.tone} label={row.status} />,
              },
              {
                key: 'total',
                header: 'Total',
                align: 'right',
                className: 'whitespace-nowrap',
                cell: (row) => <span className="font-mono tabular-nums">{row.total}</span>,
              },
              {
                key: 'actions',
                header: 'Acciones',
                stack: 'actions',
                className: 'whitespace-nowrap',
                cell: (row) => (
                  <Button variant="outline" size="sm">
                    Abrir
                    <span className="sr-only"> el lavado {row.plate}</span>
                  </Button>
                ),
              },
            ]}
          />
          <Note>
            En escritorio la lista es una lámina única con cabecera y filas continuas en tabla nativa.
            Bajo 900px la misma fila se apila en tarjeta: la referencia y el chip arriba, la placa
            suelta, el resto rotulado y las acciones al pie a todo el ancho. Datos sintéticos.
          </Note>
        </Panel>

        <Panel reference={10} title="Estado vacío" note="nunca «No hay datos»">
          <EmptyState
            title="Nada pendiente"
            description="Cuando entre un carro a la fila va a aparecer acá, con su placa y su estado."
            action={<Button>Nuevo lavado</Button>}
          />
          <Note>
            Título que nombra el vacío, una frase que dice qué va a aparecer y —solo si el permiso
            lo permite— el botón que lo llena.
          </Note>
        </Panel>

        <Panel reference={11} title="Diálogo y avisos" note="confirmar lo que salió bien">
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(true)}>
              Abrir el diálogo
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: 'Lavado cobrado',
                  description: 'CW-0142 · $12.00',
                  tone: 'success',
                })
              }
            >
              Aviso de éxito
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                toast({
                  title: 'No se pudo guardar',
                  description: 'Revisá la conexión y volvé a intentar.',
                  tone: 'error',
                })
              }
            >
              Aviso de error
            </Button>
          </div>
          <Note>
            El aviso flotante confirma una mutación que salió bien. Los errores se imprimen donde
            ocurren, con <code className="font-mono">role=&quot;alert&quot;</code>, y no se duplican
            en un aviso; el tono rojo existe para los pocos casos en que el fallo no tiene dónde
            vivir en la pantalla.
          </Note>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cobrar el lavado</DialogTitle>
                <DialogDescription>
                  Elegí cómo pagó el cliente. El cobro no se puede deshacer.
                </DialogDescription>
              </DialogHeader>
              <DialogBody>
                <p className="text-figure text-text">$12.00</p>
                <p className="text-text-dim text-body">
                  Radio 14, la sombra única del sistema y, bajo 900px, sube desde abajo como una
                  hoja.
                </p>
              </DialogBody>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Cobrar en efectivo</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </Panel>

        <Panel
          reference={12}
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
          <Note>
            Mostrador: fila de 36px y control de 32px. Bahía: fila de 56px, control de 48px y
            objetivo táctil de 44px. Cambia la densidad, nunca el vocabulario: probá los bloques de
            arriba con «Bahía» puesta.
          </Note>
        </Panel>

        <Panel reference={13} title="Lo anulado" note="se marca, no se apaga">
          <div className="border-line-soft bg-surface-2 text-text-dim w-fit rounded-row border px-3.5 py-2.5 text-dense">
            <span className="is-ruled-out">Eliminar</span> lo tienen 3 usuarios
          </div>
          <Note>
            Una regla de 1px trazada sobre el dato que dejó de valer, como el renglón dado de baja
            en un catálogo impreso, más el texto que dice por qué. Nunca opacidad: lo apagado se
            confunde con lo deshabilitado.
          </Note>
        </Panel>
      </div>
    </main>
  );
}
