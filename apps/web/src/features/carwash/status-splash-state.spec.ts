import {
  createSplashController,
  SPLASH_LEAVE_MS,
  SPLASH_VISIBLE_MS,
  type SplashEntry,
} from './status-splash-state';

describe('createSplashController', () => {
  let seen: (SplashEntry | null)[];
  let controller: ReturnType<typeof createSplashController>;

  beforeEach(() => {
    jest.useFakeTimers();
    seen = [];
    controller = createSplashController((entry) => seen.push(entry));
  });

  afterEach(() => {
    controller.dispose();
    jest.useRealTimers();
  });

  const last = () => seen[seen.length - 1];

  it('se muestra al instante con el estado y el rótulo', () => {
    controller.show('READY', '#12 · P123-456');

    expect(last()).toMatchObject({ status: 'READY', caption: '#12 · P123-456', leaving: false });
  });

  it('empieza a irse a los 1200 ms y desaparece al terminar el fundido', () => {
    controller.show('WASHING', '#3 · P1');

    jest.advanceTimersByTime(SPLASH_VISIBLE_MS - 1);
    expect(last()?.leaving).toBe(false);

    jest.advanceTimersByTime(1);
    expect(last()?.leaving).toBe(true);

    jest.advanceTimersByTime(SPLASH_LEAVE_MS);
    expect(last()).toBeNull();
  });

  it('la nueva reemplaza a la anterior y reinicia el reloj', () => {
    controller.show('WASHING', '#3 · P1');
    const first = last();

    jest.advanceTimersByTime(1000);
    controller.show('READY', '#3 · P1');

    expect(last()?.id).not.toBe(first?.id);
    expect(last()?.status).toBe('READY');

    jest.advanceTimersByTime(1000);
    expect(last()?.leaving).toBe(false);

    jest.advanceTimersByTime(SPLASH_VISIBLE_MS - 1000 + SPLASH_LEAVE_MS);
    expect(last()).toBeNull();
  });

  it('dispose corta el reloj', () => {
    controller.show('OPEN', '#1 · P1');
    const count = seen.length;

    controller.dispose();
    jest.advanceTimersByTime(SPLASH_VISIBLE_MS + SPLASH_LEAVE_MS);

    expect(seen).toHaveLength(count);
  });
});
