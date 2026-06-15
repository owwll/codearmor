import readline from 'readline';
import bcrypt from 'bcryptjs';
import * as queries from '../db/queries';
import { initDatabase } from '../db/schema';

// Ensure database is initialized
initDatabase();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function main() {
  try {
    const username = await ask('Enter admin username: ');
    if (!username.trim()) {
      console.error('Username cannot be empty.');
      process.exit(1);
    }

    const password = await ask('Enter admin password: ');
    if (!password) {
      console.error('Password cannot be empty.');
      process.exit(1);
    }

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    await queries.createUser({
      id: `admin_${Math.random().toString(36).substring(2, 11)}`,
      username: username.trim(),
      passwordHash,
      role: 'admin',
      plan: 'pro'
    });
    console.log('Admin user created successfully');
  } catch (err: any) {
    if (err.message && (err.message.includes('unique') || err.message.includes('UNIQUE'))) {
      console.error('Error: Username already exists.');
    } else {
      console.error('Error creating admin user:', err);
    }
  } finally {
    rl.close();
  }
}

main();
