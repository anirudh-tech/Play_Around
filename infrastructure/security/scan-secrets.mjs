#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const pattern =
  '(AKIA[0-9A-Z]{16}|sk_live_[0-9a-zA-Z]{10,}|-----BEGIN (RSA |OPENSSH )?PRIVATE KEY-----|xox[baprs]-[0-9A-Za-z-]{10,})';

const result = spawnSync(
  'rg',
  ['-n', '--hidden', '-g', '!**/node_modules/**', '-g', '!**/.next/**', '-g', '!**/dist/**', '-g', '!**/.expo/**', pattern, '.'],
  { cwd: root, encoding: 'utf8' },
);

if (result.status === 0 && result.stdout.trim()) {
  console.error('Possible secrets found:\n' + result.stdout);
  process.exit(1);
}

if (result.status === 2) {
  console.error(result.stderr || 'ripgrep failed');
  process.exit(2);
}

console.log('Secret scan: no high-confidence credential patterns.');
