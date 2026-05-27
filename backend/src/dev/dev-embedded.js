import { spawn } from 'node:child_process';
import process from 'node:process';
import EmbeddedPostgres from 'embedded-postgres';

const PORT = parseInt(process.env.PORT || '4000', 10);
const PG_PORT = parseInt(process.env.PG_PORT || '5432', 10);

const PG_USER = process.env.PG_USER || 'navpro';
const PG_PASSWORD = process.env.PG_PASSWORD || 'navpro_dev';
const PG_DB = process.env.PG_DB || 'navpro_db';

const databaseDir = process.env.PG_DATA_DIR || new URL('../../../.pgdata', import.meta.url).pathname;
const databaseUrl = `postgresql://${encodeURIComponent(PG_USER)}:${encodeURIComponent(PG_PASSWORD)}@localhost:${PG_PORT}/${encodeURIComponent(PG_DB)}`;

function runNode(args, extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv,
      },
    });
    child.on('exit', (code) => {
      if (code === 0) return resolve();
      reject(new Error(`Command failed: node ${args.join(' ')} (exit ${code})`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const postgres = new EmbeddedPostgres({
    databaseDir,
    user: PG_USER,
    password: PG_PASSWORD,
    port: PG_PORT,
    persistent: true,
  });

  process.on('SIGINT', async () => {
    await postgres.stop();
    process.exit(0);
  });

  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase(PG_DB);

  await runNode(['src/seed.js'], { DATABASE_URL: databaseUrl });
  await runNode(['src/index.js'], { DATABASE_URL: databaseUrl, PORT: String(PORT) });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
