import { STREAM_HEARTBEAT_MS } from '@elite/shared';

import {
  openStream,
  STREAM_RETRY_MAX_MS,
  STREAM_RETRY_MIN_MS,
  STREAM_STALE_MS,
  type StreamStatus,
} from './realtime';

type Listener = (event: { data?: string }) => void;

/**
 * Un `EventSource` de mentira: no conecta a nada, solo deja disparar `open`,
 * `message` y `error` a mano y ver cuántas veces se creó.
 */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: FakeEventSource[] = [];

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readyState = 0;
  closedByClient = false;

  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    FakeEventSource.instances.push(this);
  }

  addEventListener(type: string, listener: Listener): void {
    const list = this.listeners.get(type) ?? [];
    list.push(listener);
    this.listeners.set(type, list);
  }

  close(): void {
    this.readyState = this.CLOSED;
    this.closedByClient = true;
  }

  emit(type: string, data?: string): void {
    if (type === 'open') this.readyState = this.OPEN;
    for (const listener of this.listeners.get(type) ?? []) listener({ data });
  }
}

const ping = (): string => JSON.stringify({ type: 'ping', at: new Date().toISOString() });

describe('openStream', () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    jest.useFakeTimers();
    FakeEventSource.instances = [];
    Object.defineProperty(globalThis, 'EventSource', {
      value: FakeEventSource,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(globalThis, 'EventSource', {
      value: originalEventSource,
      configurable: true,
      writable: true,
    });
  });

  it('pega al mismo origen, bajo /api', () => {
    const close = openStream('carwash/stream', { onMessage: jest.fn() });

    expect(FakeEventSource.instances[0]?.url).toBe('/api/carwash/stream');
    close();
  });

  it('no reabre mientras el latido sigue llegando', () => {
    const onMessage = jest.fn();
    const close = openStream('carwash/stream', { onMessage });
    const first = FakeEventSource.instances[0]!;
    first.emit('open');

    for (let i = 0; i < 6; i += 1) {
      jest.advanceTimersByTime(STREAM_HEARTBEAT_MS);
      first.emit('message', ping());
    }

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(onMessage).toHaveBeenCalledTimes(6);
    close();
  });

  it('reabre el hilo que quedó abierto pero mudo y avisa que se está reconectando', () => {
    const statuses: StreamStatus[] = [];
    const onReconnect = jest.fn();
    const close = openStream('carwash/stream', {
      onMessage: jest.fn(),
      onStatus: (status) => statuses.push(status),
      onReconnect,
    });
    const first = FakeEventSource.instances[0]!;
    first.emit('open');

    jest.advanceTimersByTime(STREAM_STALE_MS + 15_000);

    expect(FakeEventSource.instances).toHaveLength(2);
    expect(first.closedByClient).toBe(true);
    expect(statuses).toEqual(['connecting', 'live', 'connecting']);
    expect(onReconnect).not.toHaveBeenCalled();

    FakeEventSource.instances[1]!.emit('open');

    expect(statuses.at(-1)).toBe('live');
    expect(onReconnect).toHaveBeenCalledTimes(1);
    close();
  });

  it('no le pisa el reintento a EventSource mientras está reconectando solo', () => {
    const close = openStream('carwash/stream', { onMessage: jest.fn() });
    const first = FakeEventSource.instances[0]!;
    first.emit('open');
    first.readyState = first.CONNECTING;
    first.emit('error');

    jest.advanceTimersByTime(STREAM_STALE_MS * 2);

    expect(FakeEventSource.instances).toHaveLength(1);
    close();
  });

  it('avisa la reconexión cuando EventSource reabre solo, pero no la primera vez', () => {
    const onReconnect = jest.fn();
    const close = openStream('floor/stream', { onMessage: jest.fn(), onReconnect });
    const first = FakeEventSource.instances[0]!;

    first.emit('open');
    expect(onReconnect).not.toHaveBeenCalled();

    first.emit('error');
    first.emit('open');
    expect(onReconnect).toHaveBeenCalledTimes(1);
    close();
  });

  it('si el servidor responde algo que no es 200, reintenta con espera creciente', () => {
    const statuses: StreamStatus[] = [];
    const close = openStream('carwash/stream', {
      onMessage: jest.fn(),
      onStatus: (status) => statuses.push(status),
    });

    const giveUp = (index: number): void => {
      const source = FakeEventSource.instances[index]!;
      source.readyState = source.CLOSED;
      source.emit('error');
    };

    // El 500 del proxy mientras el API arranca: EventSource se rinde.
    giveUp(0);
    expect(statuses.at(-1)).toBe('offline');
    expect(FakeEventSource.instances).toHaveLength(1);

    jest.advanceTimersByTime(STREAM_RETRY_MIN_MS);
    expect(FakeEventSource.instances).toHaveLength(2);

    giveUp(1);
    jest.advanceTimersByTime(STREAM_RETRY_MIN_MS);
    expect(FakeEventSource.instances).toHaveLength(2);
    jest.advanceTimersByTime(STREAM_RETRY_MIN_MS);
    expect(FakeEventSource.instances).toHaveLength(3);

    // La espera no pasa del tope.
    for (let i = 3; i < 9; i += 1) {
      giveUp(i - 1);
      jest.advanceTimersByTime(STREAM_RETRY_MAX_MS);
      expect(FakeEventSource.instances).toHaveLength(i + 1);
    }

    // Al abrir, la espera vuelve al mínimo.
    FakeEventSource.instances[8]!.emit('open');
    expect(statuses.at(-1)).toBe('live');
    giveUp(8);
    jest.advanceTimersByTime(STREAM_RETRY_MIN_MS);
    expect(FakeEventSource.instances).toHaveLength(10);

    close();
  });

  it('el cierre apaga el perro guardián y el reintento', () => {
    const statuses: StreamStatus[] = [];
    const close = openStream('carwash/stream', {
      onMessage: jest.fn(),
      onStatus: (status) => statuses.push(status),
    });
    const first = FakeEventSource.instances[0]!;
    first.readyState = first.CLOSED;
    first.emit('error');

    close();
    jest.advanceTimersByTime(STREAM_STALE_MS * 3);

    expect(FakeEventSource.instances).toHaveLength(1);
    expect(statuses.at(-1)).toBe('offline');
  });

  it('al volver la pestaña reabre de una si el hilo quedó mudo o rendido', () => {
    const domListeners = new Map<string, () => void>();
    const dom = {
      visibilityState: 'visible',
      addEventListener: (type: string, listener: () => void) => domListeners.set(type, listener),
      removeEventListener: (type: string) => domListeners.delete(type),
    };
    Object.defineProperty(globalThis, 'document', { value: dom, configurable: true });
    Object.defineProperty(globalThis, 'window', { value: dom, configurable: true });

    try {
      const close = openStream('carwash/stream', { onMessage: jest.fn() });
      const first = FakeEventSource.instances[0]!;
      first.emit('open');

      // Mudo pero sin llegar al tick del perro guardián: al volver, se reabre.
      jest.setSystemTime(Date.now() + STREAM_STALE_MS + 1);
      domListeners.get('visibilitychange')!();
      expect(FakeEventSource.instances).toHaveLength(2);

      // Rendido y esperando el reintento: al volver no se espera.
      const second = FakeEventSource.instances[1]!;
      second.readyState = second.CLOSED;
      second.emit('error');
      domListeners.get('online')!();
      expect(FakeEventSource.instances).toHaveLength(3);

      // Con la pestaña oculta no se toca nada.
      dom.visibilityState = 'hidden';
      jest.setSystemTime(Date.now() + STREAM_STALE_MS + 1);
      FakeEventSource.instances[2]!.emit('open');
      jest.setSystemTime(Date.now() + STREAM_STALE_MS + 1);
      domListeners.get('visibilitychange')!();
      expect(FakeEventSource.instances).toHaveLength(3);

      close();
      expect(domListeners.size).toBe(0);
    } finally {
      Reflect.deleteProperty(globalThis, 'document');
      Reflect.deleteProperty(globalThis, 'window');
    }
  });
});
