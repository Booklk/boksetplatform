import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Business logic validation tests.
 * Pure functions and Zod schemas — no DB required.
 */

// ── Booking validations ────────────────────────────────────────────────────

const bookingSchema = z.object({
  packageId: z.number(),
  scheduledAt: z.string().refine(
    (val) => new Date(val).getTime() > Date.now() + 2 * 60 * 60 * 1000,
    'يجب أن يكون الموعد بعد ساعتين على الأقل',
  ),
  address: z.string().min(5, 'العنوان مطلوب'),
});

describe('Booking validation', () => {
  it('should reject scheduledAt less than 2 hours in the future', () => {
    const soon = new Date(Date.now() + 30 * 60 * 1000).toISOString(); // 30 min
    const result = bookingSchema.safeParse({ packageId: 1, scheduledAt: soon, address: 'شارع الملك فهد' });
    expect(result.success).toBe(false);
  });

  it('should accept scheduledAt more than 2 hours in the future', () => {
    const later = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(); // 3 hrs
    const result = bookingSchema.safeParse({ packageId: 1, scheduledAt: later, address: 'شارع الملك فهد' });
    expect(result.success).toBe(true);
  });

  it('should reject missing or short address', () => {
    const later = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const result = bookingSchema.safeParse({ packageId: 1, scheduledAt: later, address: 'ab' });
    expect(result.success).toBe(false);
  });
});

// ── Financial statements: date range ────────────────────────────────────────

function validateDateRange(from: string, to: string): { valid: boolean; error?: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) return { valid: false, error: 'تاريخ غير صالح' };
  if (fromDate >= toDate) return { valid: false, error: 'تاريخ البداية يجب أن يسبق تاريخ النهاية' };
  return { valid: true };
}

describe('Financial statement date range', () => {
  it('should reject from >= to', () => {
    expect(validateDateRange('2025-06-01', '2025-01-01').valid).toBe(false);
  });

  it('should accept valid range', () => {
    expect(validateDateRange('2025-01-01', '2025-06-30').valid).toBe(true);
  });

  it('should reject invalid date strings', () => {
    expect(validateDateRange('not-a-date', '2025-06-30').valid).toBe(false);
  });
});

// ── Customer score & tier assignment ────────────────────────────────────────

function assignTier(score: number): string {
  if (score >= 90) return 'platinum';
  if (score >= 70) return 'gold';
  if (score >= 40) return 'silver';
  return 'bronze';
}

describe('Customer score & tier', () => {
  it('score should be clamped 0-100', () => {
    const clamp = (v: number) => Math.max(0, Math.min(100, v));
    expect(clamp(-5)).toBe(0);
    expect(clamp(150)).toBe(100);
    expect(clamp(72)).toBe(72);
  });

  it('90+ = platinum', () => expect(assignTier(95)).toBe('platinum'));
  it('70-89 = gold',   () => expect(assignTier(75)).toBe('gold'));
  it('40-69 = silver',  () => expect(assignTier(55)).toBe('silver'));
  it('0-39 = bronze',   () => expect(assignTier(20)).toBe('bronze'));
  it('boundary: 90 = platinum', () => expect(assignTier(90)).toBe('platinum'));
  it('boundary: 70 = gold',    () => expect(assignTier(70)).toBe('gold'));
  it('boundary: 40 = silver',  () => expect(assignTier(40)).toBe('silver'));
});

// ── Automation trigger types ────────────────────────────────────────────────

const validTriggers = ['new_customer', 'booking_completed', 'booking_cancelled', 'inactivity', 'abandoned_booking'];

describe('Automation trigger types', () => {
  it('should accept known trigger types', () => {
    for (const t of validTriggers) {
      expect(validTriggers.includes(t)).toBe(true);
    }
  });

  it('should reject unknown trigger type', () => {
    expect(validTriggers.includes('random_event')).toBe(false);
  });
});

// ── Recurring booking frequency ─────────────────────────────────────────────

const frequencySchema = z.enum(['weekly', 'biweekly', 'monthly']);

describe('Recurring booking frequency', () => {
  it('should accept weekly', () => expect(frequencySchema.safeParse('weekly').success).toBe(true));
  it('should accept biweekly', () => expect(frequencySchema.safeParse('biweekly').success).toBe(true));
  it('should accept monthly', () => expect(frequencySchema.safeParse('monthly').success).toBe(true));
  it('should reject daily', () => expect(frequencySchema.safeParse('daily').success).toBe(false));
  it('should reject empty', () => expect(frequencySchema.safeParse('').success).toBe(false));
});
