/**
 * Autopilot — vendor-configurable automation rules.
 *
 * Stored inside vendors.settings.autopilot. Each sub-system has:
 *   - enabled : master switch
 *   - plus a small bag of rules tuned for that system
 *
 * Defaults are conservative: everything is OFF on creation. The vendor
 * opts in explicitly from /vendor/autopilot, and any action Autopilot
 * takes is written to the decisions feed so trust is earned not demanded.
 */

import { db } from '../../db/index.js';
import { vendors } from '../../db/schema.js';
import { eq } from 'drizzle-orm';

export interface AutopilotConfig {
  assignEmployee: {
    enabled: boolean;
    strategy: 'round_robin' | 'least_loaded' | 'highest_rated';
    /** Only auto-assign when the booking is at least this many minutes away. */
    minLeadMinutes: number;
  };
  reorderInventory: {
    enabled: boolean;
    /** Multiplier of (minQuantity) that's ordered when we hit threshold.
     *  e.g. 2 → order 2× the min stock to comfortably back above the threshold. */
    reorderFactor: number;
    notifyOwnerOnReorder: boolean;
  };
  dormantRemarket: {
    enabled: boolean;
    dormantDays: number;              // look-back threshold, default 30
    /** Max WhatsApp messages to send per daily run. */
    dailyLimit: number;
  };
  autoConfirm: {
    enabled: boolean;
    /** Only auto-confirm for customers with ≥ N completed bookings. */
    minCompletedBookings: number;
    /** Refuse auto-confirm if the scheduled time falls inside a prayer window. */
    respectPrayerTimes: boolean;
  };
}

export const DEFAULT_CONFIG: AutopilotConfig = {
  assignEmployee:   { enabled: false, strategy: 'least_loaded', minLeadMinutes: 30 },
  reorderInventory: { enabled: false, reorderFactor: 2, notifyOwnerOnReorder: true },
  dormantRemarket:  { enabled: false, dormantDays: 30, dailyLimit: 20 },
  autoConfirm:      { enabled: false, minCompletedBookings: 2, respectPrayerTimes: true },
};

function coerce(raw: unknown): AutopilotConfig {
  const c = (raw && typeof raw === 'object') ? (raw as any) : {};
  return {
    assignEmployee: {
      enabled:        Boolean(c.assignEmployee?.enabled),
      strategy:       ['round_robin','least_loaded','highest_rated'].includes(c.assignEmployee?.strategy)
                         ? c.assignEmployee.strategy : DEFAULT_CONFIG.assignEmployee.strategy,
      minLeadMinutes: Number.isFinite(c.assignEmployee?.minLeadMinutes)
                         ? Math.max(0, Math.min(720, Number(c.assignEmployee.minLeadMinutes)))
                         : DEFAULT_CONFIG.assignEmployee.minLeadMinutes,
    },
    reorderInventory: {
      enabled:              Boolean(c.reorderInventory?.enabled),
      reorderFactor:        Number.isFinite(c.reorderInventory?.reorderFactor)
                               ? Math.max(1, Math.min(10, Number(c.reorderInventory.reorderFactor)))
                               : DEFAULT_CONFIG.reorderInventory.reorderFactor,
      notifyOwnerOnReorder: c.reorderInventory?.notifyOwnerOnReorder !== false,
    },
    dormantRemarket: {
      enabled:     Boolean(c.dormantRemarket?.enabled),
      dormantDays: Number.isFinite(c.dormantRemarket?.dormantDays)
                      ? Math.max(7, Math.min(365, Number(c.dormantRemarket.dormantDays)))
                      : DEFAULT_CONFIG.dormantRemarket.dormantDays,
      dailyLimit:  Number.isFinite(c.dormantRemarket?.dailyLimit)
                      ? Math.max(1, Math.min(500, Number(c.dormantRemarket.dailyLimit)))
                      : DEFAULT_CONFIG.dormantRemarket.dailyLimit,
    },
    autoConfirm: {
      enabled:              Boolean(c.autoConfirm?.enabled),
      minCompletedBookings: Number.isFinite(c.autoConfirm?.minCompletedBookings)
                               ? Math.max(0, Math.min(50, Number(c.autoConfirm.minCompletedBookings)))
                               : DEFAULT_CONFIG.autoConfirm.minCompletedBookings,
      respectPrayerTimes:   c.autoConfirm?.respectPrayerTimes !== false,
    },
  };
}

export async function getAutopilotConfig(vendorId: number): Promise<AutopilotConfig> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const raw = ((row?.settings ?? {}) as any)?.autopilot;
  return coerce(raw);
}

export async function saveAutopilotConfig(vendorId: number, patch: Partial<AutopilotConfig>): Promise<AutopilotConfig> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const current = coerce(settings.autopilot);
  const merged: AutopilotConfig = {
    assignEmployee:   { ...current.assignEmployee,   ...(patch.assignEmployee   ?? {}) },
    reorderInventory: { ...current.reorderInventory, ...(patch.reorderInventory ?? {}) },
    dormantRemarket:  { ...current.dormantRemarket,  ...(patch.dormantRemarket  ?? {}) },
    autoConfirm:      { ...current.autoConfirm,      ...(patch.autoConfirm      ?? {}) },
  };
  const next = coerce(merged);
  await db.update(vendors)
    .set({ settings: { ...settings, autopilot: next }, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
  return next;
}

/** Iterate every vendor that has at least one autopilot feature enabled.
 *  Used by the cron ticker so we don't scan every vendor unnecessarily. */
export async function* activeAutopilotVendors(): AsyncGenerator<{ vendorId: number; config: AutopilotConfig }> {
  const rows = await db.select({ id: vendors.id, settings: vendors.settings }).from(vendors);
  for (const r of rows) {
    const raw = ((r.settings ?? {}) as any)?.autopilot;
    if (!raw) continue;
    const cfg = coerce(raw);
    if (
      cfg.assignEmployee.enabled   ||
      cfg.reorderInventory.enabled ||
      cfg.dormantRemarket.enabled  ||
      cfg.autoConfirm.enabled
    ) {
      yield { vendorId: r.id, config: cfg };
    }
  }
}
