/**
 * Ramadan auto-schedule — cron-friendly one-shot migration of vendor
 * working hours at the start and end of Ramadan.
 *
 * Policy:
 *   - When Ramadan begins: vendors that opted in get their hours
 *     shifted to "after Iftar" (16:00 → 02:00 next day). Their
 *     pre-Ramadan hours are stashed in `settings.hoursBeforeRamadan`
 *     so we can restore them on day 1 of Shawwal.
 *   - When Ramadan ends: restore from the stash, clear it.
 *
 * Opt-in: `vendors.settings.ramadanAutoSchedule === true`.
 *
 * Idempotent per day: we only mutate once per transition by storing
 * `settings.ramadanStateApplied = true/false`. Running the cron many
 * times a day is safe.
 */

import { db } from '../../db/index.js';
import { vendors } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { toHijri } from './hijri.js';
import { readPreferences, writePreferences } from '../vendorPreferences.js';
import type { VendorPreferences } from '../vendorPreferences.js';

export interface RamadanSettings {
  /** Opt-in toggle the vendor flips from /vendor/preferences. */
  ramadanAutoSchedule?: boolean;
  /** True when we've already applied Ramadan hours (prevents re-apply). */
  ramadanStateApplied?: boolean;
  /** Pre-Ramadan hours, stashed so we can restore at Shawwal. */
  hoursBeforeRamadan?: VendorPreferences['hours'];
}

const RAMADAN_HOURS: VendorPreferences['hours'] = {
  0: { open: '16:00', close: '02:00', closed: false },
  1: { open: '16:00', close: '02:00', closed: false },
  2: { open: '16:00', close: '02:00', closed: false },
  3: { open: '16:00', close: '02:00', closed: false },
  4: { open: '16:00', close: '02:00', closed: false },
  5: { open: '16:00', close: '02:00', closed: false },
  6: { open: '16:00', close: '02:00', closed: false },
};

/** Iterate every opted-in vendor and apply / restore Ramadan hours. */
export async function runRamadanTick(): Promise<{ applied: number; restored: number }> {
  const rows = await db.select({ id: vendors.id, settings: vendors.settings }).from(vendors);
  const isRamadan = toHijri(new Date()).month === 9;
  let applied = 0, restored = 0;

  for (const r of rows) {
    const s = (r.settings ?? {}) as Record<string, unknown> & RamadanSettings;
    if (!s.ramadanAutoSchedule) continue;

    const stateApplied = Boolean(s.ramadanStateApplied);

    // Transition 1: Ramadan just started → stash + apply
    if (isRamadan && !stateApplied) {
      const prefs = await readPreferences(r.id);
      await writePreferences(r.id, { hours: RAMADAN_HOURS });
      await db.update(vendors).set({
        settings: {
          ...s,
          hoursBeforeRamadan: prefs.hours,
          ramadanStateApplied: true,
        },
        updatedAt: new Date(),
      }).where(eq(vendors.id, r.id));
      applied++;
      continue;
    }

    // Transition 2: Ramadan just ended → restore + clear stash
    if (!isRamadan && stateApplied) {
      const stash = s.hoursBeforeRamadan;
      if (stash) {
        await writePreferences(r.id, { hours: stash });
      }
      const newSettings = { ...s };
      delete (newSettings as any).ramadanStateApplied;
      delete (newSettings as any).hoursBeforeRamadan;
      await db.update(vendors).set({
        settings: newSettings,
        updatedAt: new Date(),
      }).where(eq(vendors.id, r.id));
      restored++;
    }
  }
  return { applied, restored };
}
