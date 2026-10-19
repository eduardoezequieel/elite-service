// Forwards the public tunnel to Next and drops Origin.
// Nest only allows a localhost Origin, so a trycloudflare.com host would 500
// every /api call. The browser still talks to the tunnel host; this hop is local.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const envPath = path.join(root, '.env');

if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // PORT falls back to 3100 when the root .env cannot be parsed.
  }
}

const targetPort = process.env.PORT || '3100';
const listenPort = 3199;
const target = { host: '127.0.0.1', port: Number(targetPort) };

function headersWithoutOrigin(incoming) {
  const headers = { ...incoming };
  delete headers.origin;
  return headers;
}

const server = http.createServer((req, res) => {
  const upstream = http.request(
    {
      ...target,
      method: req.method,
      path: req.url,
      headers: headersWithoutOrigin(req.headers),
    },
    (up) => {
      res.writeHead(up.statusCode ?? 502, up.headers);
      up.pipe(res);
    },
  );
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502);
    res.end();
  });
  req.pipe(upstream);
});

server.on('upgrade', (req, socket, head) => {
  const upstream = http.request({
    ...target,
    method: req.method,
    path: req.url,
    headers: headersWithoutOrigin(req.headers),
  });
  upstream.on('upgrade', (upRes, upSocket, upHead) => {
    const lines = [`HTTP/1.1 ${upRes.statusCode} ${upRes.statusMessage}`];
    for (const [key, value] of Object.entries(upRes.headers)) {
      const values = Array.isArray(value) ? value : [value];
      for (const item of values) {
        if (item !== undefined) lines.push(`${key}: ${item}`);
      }
    }
    socket.write(`${lines.join('\r\n')}\r\n\r\n`);
    if (upHead.length) socket.write(upHead);
    if (head.length) upSocket.write(head);
    upSocket.pipe(socket);
    socket.pipe(upSocket);
    upSocket.on('error', () => socket.destroy());
    socket.on('error', () => upSocket.destroy());
  });
  upstream.on('error', () => socket.destroy());
  upstream.end();
});

server.listen(listenPort, '127.0.0.1', () => {
  console.log(`bridge http://127.0.0.1:${listenPort} -> :${targetPort}`);
});
