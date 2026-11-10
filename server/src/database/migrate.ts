import fs from 'fs';
import path from 'path';
import { query } from './index';

export async function runMigrations(): Promise<void> {
  const migrationPath = path.resolve(process.cwd(), 'migrations/001_initial_schema.sql');
  if (!fs.existsSync(migrationPath)) {
    throw new Error(`Migration file not found at: ${migrationPath}`);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  await query(sql);
}

if (process.env.RUN_MIGRATIONS === 'true' || process.argv[1]?.includes('migrate')) {
  runMigrations()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
