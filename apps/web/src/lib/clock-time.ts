/**
 * La hora de un formulario (119): `HH:MM` en 24 h por dentro, y en 12 h con
 * AM/PM para el que la elige. Las 12 AM son `00:MM` y las 12 PM, `12:MM`.
 */
export type ClockTime = string;

export interface ClockParts {
  /** 1–12. */
  hour: number;
  minute: number;
  pm: boolean;
}

/** Los minutos que ofrece el selector: cuartos de hora. */
export const CLOCK_MINUTES = [0, 15, 30, 45] as const;

/** Las horas del reloj de 12, en el orden de la grilla. */
export const CLOCK_HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

const pad = (value: number) => String(value).padStart(2, '0');

/** `true` si es una hora real en `HH:MM`. */
export function isClockTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/u.exec(value);
  return match !== null && Number(match[1]) < 24 && Number(match[2]) < 60;
}

export function toClockParts(time: ClockTime): ClockParts {
  const hours = Number(time.slice(0, 2));
  return {
    hour: hours % 12 === 0 ? 12 : hours % 12,
    minute: Number(time.slice(3, 5)),
    pm: hours >= 12,
  };
}

export function fromClockParts({ hour, minute, pm }: ClockParts): ClockTime {
  return `${pad((hour % 12) + (pm ? 12 : 0))}:${pad(minute)}`;
}

/** «11:00 AM», «12:30 PM». */
export function clockLabel(time: ClockTime): string {
  const { hour, minute, pm } = toClockParts(time);
  return `${pad(hour)}:${pad(minute)} ${pm ? 'PM' : 'AM'}`;
}
