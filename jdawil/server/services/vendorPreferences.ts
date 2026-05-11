/**
 * Vendor operational preferences — stored inside vendors.settings.preferences.
 *
 * Everything here is read by the booking-create path, the storefront
 * public endpoint, and the vendor's own preferences editor. One typed
 * accessor, one coerce pass, so nobody else parses the jsonb directly.
 *
 * Shape (v1):
 *   hours:        7-day open/close map (Sunday = 0 ... Saturday = 6)
 *   holidays:     ISO date strings (YYYY-MM-DD) when the shop is closed
 *   booking:      lead time, cancel window, slot granularity, capacity,
 *                 whether new bookings need manual approval
 *   deposit:      optional deposit required to confirm a booking
 *   fields:       which customer fields are hidden / optional / required
 */

import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export interface DayHours {
  open: string;       // "HH:mm" — ignored when closed
  close: string;      // "HH:mm" — may be < open (e.g. 22:00 → 02:00 crosses midnight)
  closed: boolean;
}

export interface VendorPreferences {
  hours: Record<0 | 1 | 2 | 3 | 4 | 5 | 6, DayHours>;
  holidays: string[];                     // YYYY-MM-DD
  booking: {
    minLeadMinutes: number;               // cannot book sooner than this
    maxLeadDays: number;                  // cannot book further than this
    cancelDeadlineHours: number;          // hours before appointment
    slotDurationMinutes: 15 | 30 | 45 | 60;
    maxConcurrent: number;                // capacity per slot
    autoAccept: boolean;                  // false = requires vendor approval
  };
  deposit: {
    required: boolean;
    type: 'percentage' | 'fixed';
    amount: number;                       // % when type=percentage, SAR when fixed
  };
  fields: {
    email:        'hidden' | 'optional' | 'required';
    vehiclePlate: 'hidden' | 'optional' | 'required';
    vehicleType:  'hidden' | 'optional' | 'required';
    address:      'hidden' | 'optional' | 'required';
    notes:        'hidden' | 'optional' | 'required';
  };
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function dayOr(raw: unknown, open: string, close: string): DayHours {
  const r = (raw && typeof raw === 'object') ? (raw as any) : {};
  return {
    open:   HH_MM.test(r.open)  ? r.open  : open,
    close:  HH_MM.test(r.close) ? r.close : close,
    closed: Boolean(r.closed),
  };
}

export const DEFAULT_PREFERENCES: VendorPreferences = {
  hours: {
    0: { open: '08:00', close: '22:00', closed: false }, // Sun
    1: { open: '08:00', close: '22:00', closed: false }, // Mon
    2: { open: '08:00', close: '22:00', closed: false }, // Tue
    3: { open: '08:00', close: '22:00', closed: false }, // Wed
    4: { open: '08:00', close: '22:00', closed: false }, // Thu
    5: { open: '14:00', close: '22:00', closed: false }, // Fri
    6: { open: '08:00', close: '22:00', closed: false }, // Sat
  },
  holidays: [],
  booking: {
    minLeadMinutes: 60,
    maxLeadDays: 30,
    cancelDeadlineHours: 4,
    slotDurationMinutes: 30,
    maxConcurrent: 3,
    autoAccept: true,
  },
  deposit: {
    required: false,
    type: 'percentage',
    amount: 20,
  },
  fields: {
    email:        'optional',
    vehiclePlate: 'hidden',
    vehicleType:  'hidden',
    address:      'required',
    notes:        'optional',
  },
};

function coerceFieldMode(v: unknown, fallback: 'hidden' | 'optional' | 'required') {
  return ['hidden', 'optional', 'required'].includes(v as string) ? (v as any) : fallback;
}

export function coerce(raw: unknown): VendorPreferences {
  const r = (raw && typeof raw === 'object') ? (raw as any) : {};
  const h = r.hours ?? {};
  const b = r.booking ?? {};
  const d = r.deposit ?? {};
  const f = r.fields ?? {};
  const slot = Number(b.slotDurationMinutes);
  const deposit: VendorPreferences['deposit'] = {
    required: Boolean(d.required),
    type: d.type === 'fixed' ? 'fixed' : 'percentage',
    amount: 0,
  };
  const amt = Number(d.amount);
  // Percentage deposit: clamp 0..100. Fixed deposit: clamp 0..100,000 SAR.
  deposit.amount = !Number.isFinite(amt) ? 0
    : deposit.type === 'percentage'
      ? Math.max(0, Math.min(100, Math.round(amt)))
      : Math.max(0, Math.min(100_000, Math.round(amt)));

  return {
    hours: {
      0: dayOr(h[0], DEFAULT_PREFERENCES.hours[0].open, DEFAULT_PREFERENCES.hours[0].close),
      1: dayOr(h[1], DEFAULT_PREFERENCES.hours[1].open, DEFAULT_PREFERENCES.hours[1].close),
      2: dayOr(h[2], DEFAULT_PREFERENCES.hours[2].open, DEFAULT_PREFERENCES.hours[2].close),
      3: dayOr(h[3], DEFAULT_PREFERENCES.hours[3].open, DEFAULT_PREFERENCES.hours[3].close),
      4: dayOr(h[4], DEFAULT_PREFERENCES.hours[4].open, DEFAULT_PREFERENCES.hours[4].close),
      5: dayOr(h[5], DEFAULT_PREFERENCES.hours[5].open, DEFAULT_PREFERENCES.hours[5].close),
      6: dayOr(h[6], DEFAULT_PREFERENCES.hours[6].open, DEFAULT_PREFERENCES.hours[6].close),
    },
    holidays: Array.isArray(r.holidays)
      ? r.holidays.filter((s: unknown): s is string =>
          typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)
        ).slice(0, 200)
      : [],
    booking: {
      minLeadMinutes:      Number.isFinite(Number(b.minLeadMinutes))      ? Math.max(0, Math.min(20160, Number(b.minLeadMinutes)))      : 60,
      maxLeadDays:         Number.isFinite(Number(b.maxLeadDays))         ? Math.max(1, Math.min(365, Number(b.maxLeadDays)))          : 30,
      cancelDeadlineHours: Number.isFinite(Number(b.cancelDeadlineHours)) ? Math.max(0, Math.min(168, Number(b.cancelDeadlineHours))) : 4,
      slotDurationMinutes: [15, 30, 45, 60].includes(slot) ? (slot as 15 | 30 | 45 | 60) : 30,
      maxConcurrent:       Number.isFinite(Number(b.maxConcurrent))       ? Math.max(1, Math.min(50, Number(b.maxConcurrent)))         : 3,
      autoAccept:          b.autoAccept !== false,
    },
    deposit,
    fields: {
      email:        coerceFieldMode(f.email,        DEFAULT_PREFERENCES.fields.email),
      vehiclePlate: coerceFieldMode(f.vehiclePlate, DEFAULT_PREFERENCES.fields.vehiclePlate),
      vehicleType:  coerceFieldMode(f.vehicleType,  DEFAULT_PREFERENCES.fields.vehicleType),
      address:      coerceFieldMode(f.address,      DEFAULT_PREFERENCES.fields.address),
      notes:        coerceFieldMode(f.notes,        DEFAULT_PREFERENCES.fields.notes),
    },
  };
}

export async function readPreferences(vendorId: number): Promise<VendorPreferences> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const raw = ((row?.settings ?? {}) as any)?.preferences;
  return coerce(raw);
}

export async function writePreferences(vendorId: number, patch: Partial<VendorPreferences>): Promise<VendorPreferences> {
  const [row] = await db.select({ settings: vendors.settings })
    .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  const settings = (row?.settings ?? {}) as Record<string, unknown>;
  const current  = coerce(settings.preferences);
  const next     = coerce({
    hours:    { ...current.hours,    ...(patch.hours    ?? {}) },
    holidays: patch.holidays ?? current.holidays,
    booking:  { ...current.booking,  ...(patch.booking  ?? {}) },
    deposit:  { ...current.deposit,  ...(patch.deposit  ?? {}) },
    fields:   { ...current.fields,   ...(patch.fields   ?? {}) },
  });
  await db.update(vendors)
    .set({ settings: { ...settings, preferences: next }, updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
  return next;
}

// ── Booking-time helpers ──────────────────────────────────────────────────

/** Is the vendor currently open at the given Date? */
export function isOpenAt(prefs: VendorPreferences, when: Date): boolean {
  const iso = when.toISOString().slice(0, 10);
  if (prefs.holidays.includes(iso)) return false;
  const day = when.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const h = prefs.hours[day];
  if (h.closed) return false;
  const hhmm = `${String(when.getHours()).padStart(2, '0')}:${String(when.getMinutes()).padStart(2, '0')}`;
  // Wrap-over-midnight support (e.g. close=02:00 means next-day 02:00).
  if (h.close > h.open) {
    return hhmm >= h.open && hhmm <= h.close;
  }
  return hhmm >= h.open || hhmm <= h.close;
}

/** Validate a requested booking time against the vendor's rules. */
export function validateBookingTime(
  prefs: VendorPreferences,
  scheduledAt: Date,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  // Past / same-second guard
  if (scheduledAt.getTime() <= now.getTime()) {
    return { ok: false, reason: 'الوقت المطلوب في الماضي' };
  }
  const leadMs = (scheduledAt.getTime() - now.getTime());
  if (leadMs < prefs.booking.minLeadMinutes * 60_000) {
    return { ok: false, reason: `يجب الحجز قبل الموعد بـ ${prefs.booking.minLeadMinutes} دقيقة على الأقل` };
  }
  const maxLeadMs = prefs.booking.maxLeadDays * 24 * 3600_000;
  if (leadMs > maxLeadMs) {
    return { ok: false, reason: `لا يمكن الحجز أبعد من ${prefs.booking.maxLeadDays} يوم` };
  }
  if (!isOpenAt(prefs, scheduledAt)) {
    return { ok: false, reason: 'الوقت خارج ساعات العمل أو في يوم عطلة' };
  }
  return { ok: true };
}
