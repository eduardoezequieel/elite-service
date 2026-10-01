import { calendarDays, slotPlacement, whatsappHref } from './agreement-format';

describe('formato de rentas (096)', () => {
  it('WhatsApp con un celular de 8 dígitos le antepone 503; sin teléfono, deja elegir', () => {
    expect(whatsappHref('7742-1900', 'Hola')).toBe('https://wa.me/50377421900?text=Hola');
    expect(whatsappHref(null, 'Hola mundo')).toBe('https://wa.me/?text=Hola%20mundo');
  });

  it('la barra cae en sus columnas y marca lo que sigue afuera', () => {
    const days = calendarDays('2026-10-10', 7);
    expect(days[6]).toBe('2026-10-16');

    expect(
      slotPlacement({ start: '2026-10-11T16:00:00.000Z', end: '2026-10-13T16:00:00.000Z' }, days),
    ).toEqual({ index: 1, span: 3, continuesBefore: false, continuesAfter: false });

    expect(
      slotPlacement({ start: '2026-10-01T16:00:00.000Z', end: '2026-10-30T16:00:00.000Z' }, days),
    ).toEqual({ index: 0, span: 7, continuesBefore: true, continuesAfter: true });
  });

  it('una renta fuera del rango no se dibuja', () => {
    const days = calendarDays('2026-10-10', 7);
    expect(
      slotPlacement({ start: '2026-10-20T16:00:00.000Z', end: '2026-10-22T16:00:00.000Z' }, days),
    ).toBeNull();
  });
});
