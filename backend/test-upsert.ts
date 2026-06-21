import { db } from './src/db/schema';
import { projects } from './src/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
  console.log("Testing");
}
run();
