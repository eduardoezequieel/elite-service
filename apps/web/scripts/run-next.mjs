import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// npm scripts run under bash on macOS and cmd.exe on Windows. Bash expands
// `${PORT:-3100}`; cmd passes that text through, and Next rejects it as a port.
// Resolve the port here so both platforms share one command.

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.resolve(here, '../../../.env');

if (fs.existsSync(envPath)) {
  try {
    // Does not override a PORT already set in the environment.
    process.loadEnvFile(envPath);
  } catch {
    // A root .env Next cannot parse still starts on the default port.
  }
}

const port = process.env.PORT || '3100';
if (!/^\d+$/.test(port)) {
  console.error('PORT must be a non-negative integer.');
  process.exit(1);
}

const nextBin = require.resolve('next/dist/bin/next');
const child = spawn(process.execPath, [nextBin, ...process.argv.slice(2), '-p', port], {
  stdio: 'inherit',
});

child.on('error', () => {
  process.exit(1);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on('exit', (code) => {
  process.exit(code == null ? 1 : code);
});
