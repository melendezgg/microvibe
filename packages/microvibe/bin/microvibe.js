#!/usr/bin/env node
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgDir = path.join(__dirname, '..');
const serverFile = path.join(pkgDir, 'src', 'server.tsx');
const command = process.argv[2] || 'dev';

if (command !== 'dev') {
  console.error(`Unknown command: ${command}`);
  process.exit(1);
}

const child = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsx', 'watch', serverFile],
  {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
  }
);

child.on('exit', (code) => process.exit(code ?? 0));
