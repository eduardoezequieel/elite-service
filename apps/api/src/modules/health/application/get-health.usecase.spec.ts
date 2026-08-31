import { GetHealthUseCase } from './get-health.usecase';
import type { HealthClock } from './get-health.usecase';

/** Implementación en memoria del puerto: sin base de datos y sin red. */
class FakeHealthClock implements HealthClock {
  constructor(
    private readonly fixedNow: Date,
    private readonly fixedUptime: number,
  ) {}

  now(): Date {
    return this.fixedNow;
  }

  uptimeSeconds(): number {
    return this.fixedUptime;
  }
}

describe('GetHealthUseCase', () => {
  it('returns an ok status with the injected uptime and timestamp', () => {
    const clock = new FakeHealthClock(new Date('2026-01-01T00:00:00.000Z'), 42);
    const useCase = new GetHealthUseCase(clock);

    expect(useCase.execute()).toEqual({
      status: 'ok',
      uptimeSeconds: 42,
      timestamp: '2026-01-01T00:00:00.000Z',
    });
  });

  it('reads the clock on every execution', () => {
    let uptime = 1;
    const useCase = new GetHealthUseCase({
      now: () => new Date('2026-01-01T00:00:00.000Z'),
      uptimeSeconds: () => uptime,
    });

    expect(useCase.execute().uptimeSeconds).toBe(1);
    uptime = 2;
    expect(useCase.execute().uptimeSeconds).toBe(2);
  });

  it('works with the default system clock', () => {
    const result = new GetHealthUseCase().execute();

    expect(result.status).toBe('ok');
    expect(result.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(Number.isNaN(Date.parse(result.timestamp))).toBe(false);
  });
});
