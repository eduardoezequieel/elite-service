const DEFAULT_LISTEN_PORT = 3200;

function parsePort(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const port = Number(raw);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) return undefined;
  return port;
}

/**
 * Port Nest binds to.
 *
 * Render injects `PORT` and does not set `API_PORT`. Local `.env` sets both:
 * `PORT` is Next.js and `API_PORT` is Nest — if both are present, Nest must
 * not steal 3100 from the web app.
 */
export function resolveListenPort(env: { PORT?: string; API_PORT?: string }): number {
  const port = parsePort(env.PORT);
  const apiPort = parsePort(env.API_PORT);
  if (port !== undefined && apiPort === undefined) return port;
  if (apiPort !== undefined) return apiPort;
  return DEFAULT_LISTEN_PORT;
}
