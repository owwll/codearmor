import { runMigrations } from './migrations';
import { pool } from './schema';

async function main() {
  try {
    await runMigrations();
    console.log('Database setup complete.');
  } catch (err) {
    console.error('Error running setup database script:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
