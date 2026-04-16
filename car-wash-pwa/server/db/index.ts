import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;

const client = postgres(connectionString, { max: 50, idle_timeout: 30 });
export const db = drizzle(client, { schema });

export async function closeDatabase() {
  await client.end();
}

export type DB = typeof db;
