'use client';

import { formatKm } from '@elite/shared';
import {
  Battery,
  CircleDot,
  Disc3,
  Droplet,
  IdCard,
  MoveHorizontal,
  ShieldCheck,
  Thermometer,
  Wind,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { useId } from 'react';

import { cn } from '@/lib/utils';
import {
  dialCaption,
  litCount,
  needleAngle,
  odometerDigits,
  type CareLight,
  type LightIcon,
  type LightTone,
} from '../care-lights';

const ICONS: Record<LightIcon, LucideIcon> = {
  oil: Droplet,
  brakes: Disc3,
  tires: CircleDot,
  alignment: MoveHorizontal,
  air: Wind,
  battery: Battery,
  coolant: Thermometer,
  insurance: ShieldCheck,
  registration: IdCard,
  wrench: Wrench,
};

const LAMP_TONE: Record<LightTone, string> = {
  due: 'bg-danger text-white ring-4 ring-danger/25',
  soon: 'bg-warn text-bg ring-4 ring-warn/25',
  ok: 'bg-surface-2 text-text-faint',
  none: 'border-[1.5px] border-dashed border-line bg-transparent text-text-faint',
};

const STATE_TONE: Record<LightTone, string> = {
  due: 'text-danger-text font-semibold',
  soon: 'text-warn-text font-semibold',
  ok: 'text-text-faint',
  none: 'text-text-faint',
};

/**
 * El tablero del carro (122, vista «Tablero» del prototipo): el medidor con lo
 * más urgente, el odómetro y un testigo por tarea del plan y por papel. Con
 * `onPick`, cada testigo es un botón; sin él, solo se lee.
 */
export function CareDashboard({
  lights,
  focus,
  odometerKm,
  onPick,
}: {
  lights: readonly CareLight[];
  focus: CareLight | null;
  odometerKm: number;
  onPick?: (light: CareLight) => void;
}) {
  const lit = litCount(lights);

  return (
    <section
      aria-label="Tablero del carro"
      className="border-line bg-surface rounded-card border p-4 md:p-6"
    >
      <div className="grid grid-cols-1 items-center gap-7 min-[920px]:grid-cols-[360px_minmax(0,1fr)] [[data-density=bahia]_&]:grid-cols-1">
        <div className="flex flex-col items-center text-center">
          <Dial used={focus?.used ?? 0} />
          <Odometer km={odometerKm} />
          <Caption focus={focus} />
        </div>
        <ul
          aria-label="Testigos"
          className="grid grid-cols-[repeat(auto-fill,minmax(136px,1fr))] gap-2.5 min-[920px]:grid-cols-5 [[data-density=bahia]_&]:grid-cols-[repeat(auto-fill,minmax(136px,1fr))]"
        >
          {lights.map((light) => (
            <li key={light.key} className="flex">
              <Light light={light} onPick={onPick} />
            </li>
          ))}
        </ul>
      </div>
      <div className="text-text-dim text-dense mt-4 flex flex-wrap gap-x-4 gap-y-1.5">
        <LegendDot className="bg-danger" label="Vencido" />
        <LegendDot className="bg-warn" label="Pronto" />
        <LegendDot className="bg-surface-3" label="Apagado: está bien" />
        <LegendDot className="border-line border border-dashed" label="Sin dato" />
        <span>
          {lit === 0
            ? 'Ningún testigo encendido'
            : `${lit} ${lit === 1 ? 'testigo encendido' : 'testigos encendidos'}`}
        </span>
      </div>
    </section>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <i aria-hidden="true" className={cn('inline-block size-2.5 rounded-full', className)} />
      {label}
    </span>
  );
}

function Light({ light, onPick }: { light: CareLight; onPick?: (light: CareLight) => void }) {
  const Icon = ICONS[light.icon];
  const body = (
    <>
      <span
        className={cn(
          'inline-flex size-12 items-center justify-center rounded-full',
          LAMP_TONE[light.tone],
        )}
      >
        <Icon className="size-6" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <span className="text-dense text-text font-semibold [[data-density=bahia]_&]:text-body">
        {light.name}
      </span>
      <span className={cn('text-label', STATE_TONE[light.tone])}>{light.state}</span>
    </>
  );
  const frame =
    'flex min-h-28 w-full min-w-(--touch-min) flex-col items-center gap-1.5 rounded-card border border-line-soft bg-bg/40 px-1.5 pt-3.5 pb-3 text-center';

  if (onPick === undefined) {
    return <div className={frame}>{body}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        frame,
        'hover:border-line cursor-pointer transition-colors duration-(--duration-state) ease-standard',
      )}
      aria-label={`${light.name}: ${light.state}`}
      onClick={() => onPick(light)}
    >
      {body}
    </button>
  );
}

/** El medidor: arco con la llama hasta donde va lo más urgente y la aguja encima. */
function Dial({ used }: { used: number }) {
  const gradient = useId();
  const pct = Math.round(Math.max(0, Math.min(1, used)) * 1000) / 10;
  const cx = 150;
  const cy = 165;
  const ticks = Array.from({ length: 11 }, (_, index) => {
    const angle = Math.PI - (index / 10) * Math.PI;
    const outer = 104;
    const inner = index % 5 === 0 ? 90 : 96;

    return (
      <line
        key={index}
        x1={(cx + outer * Math.cos(angle)).toFixed(1)}
        y1={(cy - outer * Math.sin(angle)).toFixed(1)}
        x2={(cx + inner * Math.cos(angle)).toFixed(1)}
        y2={(cy - inner * Math.sin(angle)).toFixed(1)}
        stroke="var(--text-faint)"
        strokeWidth={index % 5 === 0 ? 2.2 : 1.4}
        strokeLinecap="round"
      />
    );
  });

  return (
    <svg viewBox="0 0 300 190" aria-hidden="true" className="block h-auto w-full max-w-[340px]">
      <defs>
        <linearGradient id={gradient} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="var(--flame-hot)" />
          <stop offset="0.6" stopColor="var(--flame)" />
          <stop offset="1" stopColor="var(--flame-deep)" />
        </linearGradient>
      </defs>
      <path
        d="M30 165 A120 120 0 0 1 270 165"
        fill="none"
        stroke="var(--line)"
        strokeWidth={14}
        strokeLinecap="round"
      />
      {pct > 0 ? (
        <path
          d="M30 165 A120 120 0 0 1 270 165"
          fill="none"
          stroke={`url(#${gradient})`}
          strokeWidth={14}
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray={`${pct} 100`}
        />
      ) : null}
      {ticks}
      <g
        className="motion-safe:transition-transform motion-safe:duration-700 ease-standard"
        style={{
          transform: `rotate(${needleAngle(used).toFixed(1)}deg)`,
          transformOrigin: '150px 165px',
        }}
      >
        <path d="M150 165 L146 160 L150 80 L154 160 Z" fill="var(--flame)" />
      </g>
      <circle
        cx={150}
        cy={165}
        r={9}
        fill="var(--surface-3)"
        stroke="var(--flame)"
        strokeWidth={3}
      />
      <text
        x={30}
        y={186}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--text-faint)"
      >
        Recién hecho
      </text>
      <text
        x={270}
        y={186}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="var(--text-faint)"
      >
        Toca
      </text>
    </svg>
  );
}

function Odometer({ km }: { km: number }) {
  return (
    <div
      role="img"
      aria-label={`Odómetro: ${formatKm(km)} km`}
      className="-mt-1 inline-flex items-end gap-[3px]"
    >
      {odometerDigits(km).map((digit, index) => (
        <b
          key={index}
          aria-hidden="true"
          className="bg-rail text-rail-text ring-line text-headline w-6 rounded-sm py-0.5 font-mono ring-1"
        >
          {digit}
        </b>
      ))}
      <span aria-hidden="true" className="text-text-dim ml-1.5 font-semibold">
        km
      </span>
    </div>
  );
}

function Caption({ focus }: { focus: CareLight | null }) {
  const caption = dialCaption(focus);

  if (caption.kind === 'empty') {
    return <p className="text-text-dim text-body mt-3">{caption.text}</p>;
  }

  return (
    <p className="text-text-dim text-body mt-3">
      {caption.lead} <b className="text-text font-semibold">{caption.name}</b> · {caption.detail}
    </p>
  );
}
