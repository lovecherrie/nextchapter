import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Always target this machine's local daemon, never a saved remote Docker context.
const env = { ...process.env };
for (const name of ['DOCKER_HOST', 'DOCKER_CONTEXT', 'DOCKER_TLS', 'DOCKER_TLS_VERIFY', 'DOCKER_CERT_PATH']) delete env[name];
const container = `aepilog-reader-test-${randomUUID()}`;
function docker(args, input) {
  const result = spawnSync('docker', ['--host=unix:///var/run/docker.sock', ...args], { env, input, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || result.stdout);
  return result.stdout;
}
let started = false;
try {
  docker(['run', '--rm', '-d', '--name', container, '-e', 'POSTGRES_PASSWORD=aepilog-local-test-only', 'postgres:16-alpine']);
  started = true;
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { docker(['exec', container, 'pg_isready', '-U', 'postgres']); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!ready) throw new Error('Local PostgreSQL did not become ready');
  const migrations = readdirSync(new URL('../supabase/migrations/', import.meta.url)).filter(name => name.endsWith('.sql')).sort().map(name => `../supabase/migrations/${name}`);
  const files = ['fixtures/reader-database.sql', ...migrations, 'sql/reader-security.sql', 'sql/reader-photos.sql', 'sql/book-polls.sql', 'sql/public-top-four.sql'];
  for (const file of files) {
    const sql = readFileSync(new URL(file, import.meta.url), 'utf8');
    const output = docker(['exec', '-i', container, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], sql);
    if (file.startsWith('sql/')) process.stdout.write(output);
  }
} finally {
  if (started) docker(['rm', '-f', container]);
}
