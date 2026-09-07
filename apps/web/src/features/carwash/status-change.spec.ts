import { isOperationalStatus, statusChangeWarning } from './status-change';

describe('statusChangeWarning (037)', () => {
  it('cubre los seis saltos', () => {
    expect(statusChangeWarning('OPEN', 'WASHING')).toBe(
      'Se marca como lavando. El tiempo de lavado empieza ahora.',
    );
    expect(statusChangeWarning('OPEN', 'READY')).toBe(
      'Queda listo para cobrar. Se salta el lavado.',
    );
    expect(statusChangeWarning('WASHING', 'OPEN')).toBe(
      'Vuelve a la cola. Se pierde el tiempo de lavado.',
    );
    expect(statusChangeWarning('WASHING', 'READY')).toBe('Queda listo para cobrar.');
    expect(statusChangeWarning('READY', 'OPEN')).toBe(
      'Vuelve a la cola. Deja de poder cobrarse.',
    );
    expect(statusChangeWarning('READY', 'WASHING')).toBe(
      'Vuelve a lavando. Deja de poder cobrarse. El tiempo de lavado se reinicia.',
    );
  });

  it('no avisa el mismo estado', () => {
    expect(statusChangeWarning('OPEN', 'OPEN')).toBeNull();
    expect(statusChangeWarning('READY', 'READY')).toBeNull();
  });

  it('solo OPEN, WASHING y READY son operativos', () => {
    expect(isOperationalStatus('OPEN')).toBe(true);
    expect(isOperationalStatus('WASHING')).toBe(true);
    expect(isOperationalStatus('READY')).toBe(true);
    expect(isOperationalStatus('PAID')).toBe(false);
    expect(isOperationalStatus('VOID')).toBe(false);
  });
});
