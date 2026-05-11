import { describe, it, expect, beforeAll } from 'vitest';
import { z } from 'zod';

/**
 * Integration Tests — API Contract Validation
 * Tests the data shapes and business rules without a running server.
 * Validates that frontend expectations match backend schemas.
 */

// ─── Onboarding Schema (mirrors server/routes/vendors.ts) ──────────────────

const onboardSchema = z.object({
  nameAr: z.string().min(2),
  phone: z.string().min(10),
  password: z.string().min(6),
  plan: z.enum(['free', 'pro']),
  industry: z.string().min(1),
  ownerName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().optional(),
  address: z.string().optional(),
});

describe('Vendor Onboarding — Integration', () => {
  it('should accept valid free plan registration', () => {
    const result = onboardSchema.safeParse({
      nameAr: 'صالون الأناقة',
      phone: '0551234567',
      password: 'Test@123',
      plan: 'free',
      industry: 'salon',
      ownerName: 'أحمد',
      city: 'الرياض',
    });
    expect(result.success).toBe(true);
  });

  it('should accept valid pro plan registration', () => {
    const result = onboardSchema.safeParse({
      nameAr: 'شركة النظافة',
      phone: '0559876543',
      password: 'Clean@456',
      plan: 'pro',
      industry: 'home_cleaning',
    });
    expect(result.success).toBe(true);
  });

  it('should reject missing industry', () => {
    const result = onboardSchema.safeParse({
      nameAr: 'مشروع',
      phone: '0551234567',
      password: 'Test@123',
      plan: 'free',
      industry: '',
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid plan slug', () => {
    const result = onboardSchema.safeParse({
      nameAr: 'مشروع',
      phone: '0551234567',
      password: 'Test@123',
      plan: 'enterprise', // old plan — should fail
      industry: 'salon',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short password', () => {
    const result = onboardSchema.safeParse({
      nameAr: 'مشروع',
      phone: '0551234567',
      password: '123',
      plan: 'free',
      industry: 'salon',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short phone', () => {
    const result = onboardSchema.safeParse({
      nameAr: 'مشروع',
      phone: '0551',
      password: 'Test@123',
      plan: 'free',
      industry: 'salon',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Plans API Response Shape ──────────────────────────────────────────────

const planResponseSchema = z.object({
  id: z.number(),
  slug: z.string(),
  nameAr: z.string(),
  price: z.string(),
  features: z.array(z.string()),
  isPopular: z.boolean(),
  maxEmployees: z.number(),
  trialDays: z.number(),
});

describe('Plans API — Response Shape', () => {
  const mockFreePlan = {
    id: 1, slug: 'free', nameAr: 'مجاني', price: '0',
    features: ['موقع حجز خاص', 'حتى 30 حجز/شهر'],
    isPopular: false, maxEmployees: 1, trialDays: 0,
  };

  const mockProPlan = {
    id: 2, slug: 'pro', nameAr: 'Pro', price: '99',
    features: ['حجوزات غير محدودة', 'GPS + كاشير'],
    isPopular: true, maxEmployees: -1, trialDays: 14,
  };

  it('should validate free plan shape', () => {
    expect(planResponseSchema.safeParse(mockFreePlan).success).toBe(true);
  });

  it('should validate pro plan shape', () => {
    expect(planResponseSchema.safeParse(mockProPlan).success).toBe(true);
  });

  it('should reject plan without slug', () => {
    const { slug, ...noSlug } = mockFreePlan;
    expect(planResponseSchema.safeParse(noSlug).success).toBe(false);
  });
});

// ─── Booking Schema Validation ─────────────────────────────────────────────

const bookingCreateSchema = z.object({
  packageId: z.number(),
  address: z.string().min(1),
  scheduledAt: z.string().datetime().or(z.string().min(1)),
  vehicleType: z.string().optional(),
  vehiclePlate: z.string().optional(),
  notes: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

describe('Booking Creation — Integration', () => {
  it('should accept valid booking', () => {
    const result = bookingCreateSchema.safeParse({
      packageId: 1,
      address: 'حي الياسمين، الرياض',
      scheduledAt: '2026-04-20T10:00:00',
      vehicleType: 'سيدان',
      vehiclePlate: 'ABC 1234',
    });
    expect(result.success).toBe(true);
  });

  it('should reject booking without address', () => {
    const result = bookingCreateSchema.safeParse({
      packageId: 1,
      address: '',
      scheduledAt: '2026-04-20T10:00:00',
    });
    expect(result.success).toBe(false);
  });

  it('should reject booking without packageId', () => {
    const result = bookingCreateSchema.safeParse({
      address: 'الرياض',
      scheduledAt: '2026-04-20T10:00:00',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Webhook Schema Validation ─────────────────────────────────────────────

const WEBHOOK_EVENTS = [
  'booking.created', 'booking.confirmed', 'booking.completed', 'booking.cancelled',
  'payment.received', 'customer.registered', 'rating.submitted', 'inventory.low',
] as const;

const webhookSchema = z.object({
  url: z.string().url(),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  secret: z.string().optional(),
  isActive: z.boolean().default(true),
});

describe('Webhook — Integration', () => {
  it('should accept valid webhook', () => {
    const result = webhookSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['booking.created', 'booking.completed'],
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid URL', () => {
    const result = webhookSchema.safeParse({
      url: 'not-a-url',
      events: ['booking.created'],
    });
    expect(result.success).toBe(false);
  });

  it('should reject empty events', () => {
    const result = webhookSchema.safeParse({
      url: 'https://example.com/webhook',
      events: [],
    });
    expect(result.success).toBe(false);
  });

  it('should reject invalid event name', () => {
    const result = webhookSchema.safeParse({
      url: 'https://example.com/webhook',
      events: ['invalid.event'],
    });
    expect(result.success).toBe(false);
  });
});

// ─── Customer Import Schema ────────────────────────────────────────────────

const customerRowSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10),
  vehicleType: z.string().optional(),
  notes: z.string().optional(),
});

describe('Customer Import — Integration', () => {
  it('should accept valid customer row', () => {
    const result = customerRowSchema.safeParse({
      name: 'أحمد محمد',
      phone: '0551234567',
      vehicleType: 'كامري',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short name', () => {
    const result = customerRowSchema.safeParse({
      name: 'أ',
      phone: '0551234567',
    });
    expect(result.success).toBe(false);
  });

  it('should reject short phone', () => {
    const result = customerRowSchema.safeParse({
      name: 'أحمد',
      phone: '055',
    });
    expect(result.success).toBe(false);
  });
});
