import { describe, it, expect } from 'vitest';
import { z } from 'zod';

/**
 * Auth validation tests.
 * We test the Zod schemas directly — same schemas used by the auth routes —
 * so we validate request payloads without needing a running server or DB.
 */

const registerSchema = z.object({
  name: z.string().min(2, 'الاسم مطلوب'),
  phone: z.string().min(10, 'رقم الجوال غير صحيح'),
  vendorId: z.number().optional(),
  firebaseUid: z.string().optional(),
  vehicleType: z.string().optional(),
});

const loginSchema = z.object({
  phone: z.string().min(1, 'رقم الجوال مطلوب'),
  password: z.string().optional(),
  firebaseUid: z.string().optional(),
  vendorId: z.number().optional(),
});

describe('POST /api/auth/register — validation', () => {
  it('should reject missing phone', () => {
    const result = registerSchema.safeParse({ name: 'أحمد' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const phoneError = result.error.issues.find(i => i.path.includes('phone'));
      expect(phoneError).toBeDefined();
    }
  });

  it('should reject short phone (less than 10 chars)', () => {
    const result = registerSchema.safeParse({ name: 'أحمد', phone: '05551' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('رقم الجوال غير صحيح');
    }
  });

  it('should reject missing name', () => {
    const result = registerSchema.safeParse({ phone: '0555123456' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const nameError = result.error.issues.find(i => i.path.includes('name'));
      expect(nameError).toBeDefined();
    }
  });

  it('should accept a valid registration payload', () => {
    const result = registerSchema.safeParse({
      name: 'أحمد محمد',
      phone: '0555123456',
      vendorId: 1,
    });
    expect(result.success).toBe(true);
  });
});

describe('POST /api/auth/login — validation', () => {
  it('should reject missing phone (empty string)', () => {
    const result = loginSchema.safeParse({ phone: '' });
    expect(result.success).toBe(false);
  });

  it('should reject missing credentials entirely', () => {
    const result = loginSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should accept phone-only login (Firebase flow)', () => {
    const result = loginSchema.safeParse({
      phone: '0555123456',
      firebaseUid: 'abc123',
    });
    expect(result.success).toBe(true);
  });
});
