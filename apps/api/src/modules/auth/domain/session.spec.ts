import { isTokenIssuedBeforePasswordChange, SESSION_TTL_SECONDS } from './session';

/**
 * RN-10: reemplazar una contrasena invalida las sesiones abiertas de ese
 * usuario. La regla es pura y vive en el dominio; el guard solo la consulta.
 */
describe('isTokenIssuedBeforePasswordChange', () => {
  /** Segundo entero -> `Date`, con los milisegundos que haga falta. */
  const at = (seconds: number, millis = 0): Date => new Date(seconds * 1000 + millis);

  describe('con `iatMs` (todo token que emite el sistema)', () => {
    it('rechaza el token emitido antes del cambio, aunque caigan en el mismo segundo', () => {
      expect(isTokenIssuedBeforePasswordChange(1_000, at(1_000, 500), 1_000_200)).toBe(true);
    });

    it('deja pasar el token emitido despues del cambio en el mismo segundo', () => {
      expect(isTokenIssuedBeforePasswordChange(1_000, at(1_000, 200), 1_000_500)).toBe(false);
    });

    /**
     * El caso que rompio la verificacion end-to-end. `passwordChangedAt` se
     * escribe tambien al crear el usuario, asi que quien entra enseguida tiene
     * un token del mismo segundo que su propia alta: es un login legitimo y no
     * puede caerse.
     */
    it('deja entrar a un usuario recien creado que inicia sesion en ese mismo segundo', () => {
      const creado = at(1_000, 120);

      expect(isTokenIssuedBeforePasswordChange(1_000, creado, 1_000_650)).toBe(false);
    });

    it('rechaza el token emitido en el mismo milisegundo: el cambio gana el empate', () => {
      expect(isTokenIssuedBeforePasswordChange(1_000, at(1_000, 300), 1_000_300)).toBe(false);
      expect(isTokenIssuedBeforePasswordChange(1_000, at(1_000, 301), 1_000_300)).toBe(true);
    });
  });

  describe('sin `iatMs` (tokens anteriores al claim, hasta que expiren)', () => {
    it('rechaza el token de un segundo anterior al cambio', () => {
      expect(isTokenIssuedBeforePasswordChange(1_000, at(1_001))).toBe(true);
    });

    it('deja pasar el token de un segundo posterior', () => {
      expect(isTokenIssuedBeforePasswordChange(1_002, at(1_001))).toBe(false);
    });

    it('con el empate de segundo deja pasar: sin milisegundos no hay como ordenarlos', () => {
      expect(isTokenIssuedBeforePasswordChange(1_000, at(1_000, 999))).toBe(false);
    });
  });

  it('mantiene la jornada de RN-8', () => {
    expect(SESSION_TTL_SECONDS).toBe(8 * 60 * 60);
  });
});
