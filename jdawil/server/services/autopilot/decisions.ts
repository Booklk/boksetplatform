/**
 * Autopilot decisions log — every autonomous action is recorded here so
 * the vendor can audit what the system did on their behalf.
 *
 * We use the existing audit_logs table with a dedicated action prefix
 * (`autopilot.*`) instead of creating a new table. Queries filter on the
 * prefix + vendor scope.
 *
 * Broadcasts each decision over the realtime layer so the /vendor/autopilot
 * feed updates without polling.
 */

import { db } from '../../db/index.js';
import { auditLogs } from '../../db/schema.js';
import { and, desc, eq, like } from 'drizzle-orm';
import { broadcast } from '../realtime/server.js';

export type AutopilotAction =
  | 'autopilot.assign_employee'
  | 'autopilot.reorder_inventory'
  | 'autopilot.dormant_message'
  | 'autopilot.auto_confirm';

export interface DecisionMeta extends Record<string, unknown> {
  /** Human summary shown in the feed UI. */
  summary: string;
  /** True when the decision was skipped (e.g. no eligible employee). */
  skipped?: boolean;
  reason?: string;
}

export async function recordDecision(
  vendorId: number,
  action: AutopilotAction,
  meta: DecisionMeta,
): Promise<void> {
  try {
    const [row] = await db.insert(auditLogs).values({
      vendorId,
      userId: null,
      action,
      resource: '/autopilot',
      resourceId: null,
      method: 'AUTO',
      metadata: meta,
      ip: 'autopilot',
    }).returning();
    broadcast(vendorId, 'autopilot.decision', {
      id: row.id,
      action,
      meta,
      at: new Date().toISOString(),
    });
  } catch (e) {
    console.error('[autopilot.recordDecision]', e);
  }
}

export async function listDecisions(vendorId: number, limit = 50) {
  return db.select({
    id: auditLogs.id,
    action: auditLogs.action,
    metadata: auditLogs.metadata,
    createdAt: auditLogs.createdAt,
  })
    .from(auditLogs)
    .where(and(eq(auditLogs.vendorId, vendorId), like(auditLogs.action, 'autopilot.%')))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
