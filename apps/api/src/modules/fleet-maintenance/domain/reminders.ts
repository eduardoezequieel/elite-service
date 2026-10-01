import { VEHICLE_DOCUMENT_LABELS, fleetVehicleName } from '@elite/shared';
import type { MaintenanceTaskStatus, VehicleMaintenanceStatus } from '@elite/shared';

/**
 * Lo que sale del estado de la flota hacia afuera (099): el texto para el
 * taller por WhatsApp y el calendario `.ics` de recordatorios. Puro: recibe el
 * estado ya calculado y la fecha.
 */

const PENDING = new Set(['DUE', 'SOON']);

function isPending(task: MaintenanceTaskStatus): boolean {
  return PENDING.has(task.status);
}

/** «Toyota Yaris 2022 · P53DBC». */
function vehicleLabel(status: VehicleMaintenanceStatus): string {
  const name = fleetVehicleName(status.vehicle);

  return status.vehicle.plate === null ? name : `${name} · ${status.vehicle.plate}`;
}

function plural(value: number, one: string, many: string): string {
  return `${value} ${value === 1 ? one : many}`;
}

function remaining(value: number): string {
  return value === 1 ? 'falta' : 'faltan';
}

/** «se pasó por 300 km, faltan 50 días». */
export function taskDetail(task: Pick<MaintenanceTaskStatus, 'kmLeft' | 'daysLeft'>): string {
  const parts: string[] = [];

  if (task.kmLeft !== null) {
    parts.push(
      task.kmLeft < 0
        ? `se pasó por ${-task.kmLeft} km`
        : task.kmLeft === 0
          ? 'llegó a los km'
          : `${remaining(task.kmLeft)} ${task.kmLeft} km`,
    );
  }
  if (task.daysLeft !== null) {
    parts.push(
      task.daysLeft < 0
        ? `se pasó por ${plural(-task.daysLeft, 'día', 'días')}`
        : task.daysLeft === 0
          ? 'le toca hoy'
          : `${remaining(task.daysLeft)} ${plural(task.daysLeft, 'día', 'días')}`,
    );
  }

  return parts.join(', ');
}

/** `YYYY-MM-DD` → `dd/mm/aaaa`. */
function civilLabel(civil: string): string {
  const [year, month, day] = civil.split('-');

  return `${day}/${month}/${year}`;
}

/**
 * El texto para mandarle al taller (099): por carro, las tareas vencidas y
 * próximas. En el formato de WhatsApp (`*negrita*`), sin emoji, listo para
 * `wa.me/?text=`.
 */
export function maintenanceWhatsappText(
  statuses: readonly VehicleMaintenanceStatus[],
  context: { companyName: string; today: string },
): string {
  const blocks = statuses
    .map((status) => ({ status, tasks: status.tasks.filter(isPending) }))
    .filter(({ tasks }) => tasks.length > 0)
    .map(({ status, tasks }) =>
      [
        `*${vehicleLabel(status)}* · ${status.vehicle.odometerKm} km`,
        ...tasks.map(
          (task) =>
            `- ${task.task.name}: ${task.status === 'DUE' ? 'vencido' : 'próximo'} (${taskDetail(task)})`,
        ),
      ].join('\n'),
    );

  const header = [
    `*Mantenimiento pendiente · ${context.companyName}*`,
    `Fecha: ${civilLabel(context.today)}`,
  ];

  return [
    ...header,
    '',
    blocks.length === 0 ? 'Sin mantenimientos pendientes.' : blocks.join('\n\n'),
  ].join('\n');
}

// ===================== Calendario =====================

function addDays(civil: string, days: number): string {
  const date = new Date(`${civil}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);

  return date.toISOString().slice(0, 10);
}

/**
 * El día del recordatorio de una tarea: hoy si ya venció; si no, cuando se le
 * acaban los días, o cuando se le acabarían los km al ritmo de sus rentas; lo
 * que llegue primero.
 */
export function reminderDate(
  task: Pick<MaintenanceTaskStatus, 'status' | 'kmLeft' | 'daysLeft'>,
  kmPerDay: number,
  today: string,
): string {
  if (task.status === 'DUE') return today;

  const candidates = [
    task.daysLeft,
    task.kmLeft !== null && kmPerDay > 0 ? Math.floor(task.kmLeft / kmPerDay) : null,
  ].filter((days): days is number => days !== null);

  return candidates.length === 0 ? today : addDays(today, Math.max(0, Math.min(...candidates)));
}

/** Escapa un texto de iCalendar (RFC 5545 §3.3.11). */
function icsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

const encoder = new TextEncoder();

/** Dobla una línea a 75 octetos, como pide el RFC 5545 §3.1. */
function fold(line: string): string {
  const chunks: string[] = [];
  let current = '';
  let bytes = 0;

  for (const char of line) {
    const size = encoder.encode(char).length;
    const limit = chunks.length === 0 ? 75 : 74;

    if (bytes + size > limit) {
      chunks.push(current);
      current = '';
      bytes = 0;
    }
    current += char;
    bytes += size;
  }
  chunks.push(current);

  return chunks.join('\r\n ');
}

function icsDate(civil: string): string {
  return civil.replace(/-/g, '');
}

function icsStamp(instant: Date): string {
  return instant
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

interface CalendarEvent {
  uid: string;
  date: string;
  summary: string;
  description: string;
}

/**
 * El calendario de recordatorios (099): un evento de día entero por tarea
 * vencida o próxima y por documento por vencer, con un aviso a las 8 de la
 * mañana de ese día.
 */
export function remindersCalendar(
  statuses: readonly VehicleMaintenanceStatus[],
  context: { companyName: string; today: string; now: Date },
): string {
  const events: CalendarEvent[] = statuses.flatMap((status) => [
    ...status.tasks.filter(isPending).map((task) => ({
      uid: `task-${status.vehicle.id}-${task.task.id}@elite-service`,
      date: reminderDate(task, status.kmPerDay, context.today),
      summary: `${task.task.name} · ${vehicleLabel(status)}`,
      description: `${task.status === 'DUE' ? 'Vencido' : 'Próximo'}: ${taskDetail(task)}.`,
    })),
    ...status.documents.map((document) => ({
      uid: `document-${status.vehicle.id}-${document.kind}@elite-service`,
      date: document.expiresAt < context.today ? context.today : document.expiresAt,
      summary: `Vence ${VEHICLE_DOCUMENT_LABELS[document.kind].toLowerCase()} · ${vehicleLabel(status)}`,
      description:
        document.status === 'DUE'
          ? `Venció el ${civilLabel(document.expiresAt)}.`
          : `Vence el ${civilLabel(document.expiresAt)}.`,
    })),
  ]);

  const stamp = icsStamp(context.now);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Elite Service//Mantenimiento de la flota//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(`Mantenimiento · ${context.companyName}`)}`,
    ...events.flatMap((event) => [
      'BEGIN:VEVENT',
      `UID:${event.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${icsDate(event.date)}`,
      `DTEND;VALUE=DATE:${icsDate(addDays(event.date, 1))}`,
      `SUMMARY:${icsText(event.summary)}`,
      `DESCRIPTION:${icsText(event.description)}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:PT8H',
      `DESCRIPTION:${icsText(event.summary)}`,
      'END:VALARM',
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ];

  return `${lines.map(fold).join('\r\n')}\r\n`;
}
