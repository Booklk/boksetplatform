import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;

// Pool sizing for production (5K+ vendors / 250K+ end customers).
//
//   max               — concurrent connections this Node process holds open.
//                       Tune to (postgres max_connections / app instances) × 0.8.
//                       Default 100 fits a single-process deployment against a
//                       managed Postgres with 200+ max_connections; raise via
//                       DB_POOL_MAX when running fewer instances or shrinks
//                       it when fronting more.
//   idle_timeout      — close idle connections so we don't keep dead ones from
//                       a deploy cycling.
//   max_lifetime      — periodically recycle long-lived connections so DNS
//                       changes / failovers actually take effect.
//   connect_timeout   — fail fast (not 30s default) when the DB is down so
//                       the request returns 503 instead of hanging.
//   prepare           — disable per-query prepared statements; with our query
//                       mix they hurt more than help and fight pgbouncer.
const POOL_MAX = Number(process.env.DB_POOL_MAX ?? 100);
const client = postgres(connectionString, {
  max: POOL_MAX,
  idle_timeout: 30,
  max_lifetime: 60 * 30, // 30 minutes
  connect_timeout: 10,
  prepare: false,
});
export const db = drizzle(client, { schema });

export async function closeDatabase() {
  await client.end({ timeout: 5 });
}

export type DB = typeof db;
