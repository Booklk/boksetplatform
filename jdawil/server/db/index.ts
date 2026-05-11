import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';

const connectionString = process.env.DATABASE_URL!;
const replicaConnectionString = process.env.DATABASE_REPLICA_URL;

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
const REPLICA_POOL_MAX = Number(process.env.DB_REPLICA_POOL_MAX ?? POOL_MAX);

const client = postgres(connectionString, {
  max: POOL_MAX,
  idle_timeout: 30,
  max_lifetime: 60 * 30, // 30 minutes
  connect_timeout: 10,
  prepare: false,
});
export const db = drizzle(client, { schema });

/**
 * Read-replica connection (optional). Set DATABASE_REPLICA_URL to a hot
 * standby and route heavy analytics / reporting queries to `dbReplica`
 * instead of `db`. Falls back to the primary when the env is unset, so
 * code can call `dbReplica` unconditionally.
 *
 * Replicas are NOT consistent — never use for writes or for queries
 * where a stale read corrupts UX (e.g. immediately-after-write reads).
 */
const replicaClient = replicaConnectionString
  ? postgres(replicaConnectionString, {
      max: REPLICA_POOL_MAX,
      idle_timeout: 30,
      max_lifetime: 60 * 30,
      connect_timeout: 10,
      prepare: false,
    })
  : null;

export const dbReplica = replicaClient ? drizzle(replicaClient, { schema }) : db;
export const hasReplica = !!replicaClient;

export async function closeDatabase() {
  await client.end({ timeout: 5 });
  if (replicaClient) await replicaClient.end({ timeout: 5 });
}

export type DB = typeof db;
