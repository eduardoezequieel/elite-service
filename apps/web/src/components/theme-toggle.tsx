'use client';

import { Monitor, Moon, Sun, type LucideIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ThemeOption = 'system' | 'light' | 'dark';

interface ThemeChoice {
  value: ThemeOption;
  label: string;
  Icon: LucideIcon;
}

const THEME_CHOICES: readonly ThemeChoice[] = [
  { value: 'light', label: 'Claro', Icon: Sun },
  { value: 'dark', label: 'Oscuro', Icon: Moon },
  { value: 'system', label: 'Automático', Icon: Monitor },
];

/** Los iconos siguen la densidad: 16px en mostrador, 20px en bahía. Trazo 1.5. */
const ICON_CLASS = 'size-icon';
const ICON_STROKE_WIDTH = 1.5;

/**
 * Conmutador de tema: claro (la página impresa), oscuro (la microficha) o
 * automático (el que diga el sistema operativo).
 *
 * El tema resuelto solo se conoce en el cliente, así que hasta que el componente
 * está montado se dibuja un hueco del tamaño exacto del icono: no hay desajuste
 * de hidratación ni salto de maquetación.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const TriggerIcon = resolvedTheme === 'dark' ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cambiar tema"
          className={cn('text-text-dim size-[var(--control-h)]', className)}
        >
          {mounted ? (
            <TriggerIcon className={ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
          ) : (
            <span className={ICON_CLASS} aria-hidden />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="text-text-faint text-label">Tema</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={mounted ? (theme ?? 'system') : 'system'}
          onValueChange={setTheme}
        >
          {THEME_CHOICES.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value}>
              <Icon className={ICON_CLASS} strokeWidth={ICON_STROKE_WIDTH} aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
