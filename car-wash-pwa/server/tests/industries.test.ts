import { describe, it, expect } from 'vitest';
import { getIndustriesList, getIndustryLabel, INDUSTRIES } from '../lib/industries';

describe('getIndustriesList', () => {
  it('should return all active industries (9 sectors)', () => {
    const list = getIndustriesList();
    expect(list.length).toBeGreaterThanOrEqual(9);
    const keys = list.map(i => i.key);
    expect(keys).toContain('car_wash');
    expect(keys).toContain('home_cleaning');
    expect(keys).toContain('salon');
    expect(keys).toContain('beauty_home');
    expect(keys).toContain('freelancer');
    expect(keys).toContain('other');
  });

  it('all industries should be active (comingSoon=false)', () => {
    const list = getIndustriesList();
    for (const industry of list) {
      expect(industry.comingSoon).toBe(false);
    }
  });
});

describe('getIndustryLabel', () => {
  it('should return Arabic name for car_wash', () => {
    expect(getIndustryLabel('car_wash')).toBe('مغاسل السيارات');
  });

  it('should return Arabic name for salon', () => {
    expect(getIndustryLabel('salon')).toBe('صالونات وحلاقة');
  });

  it('should return Arabic name for beauty_home', () => {
    expect(getIndustryLabel('beauty_home')).toBe('تجميل منزلي وسبا');
  });

  it('should return the key itself for unknown industry', () => {
    expect(getIndustryLabel('unknown_industry')).toBe('unknown_industry');
  });
});

describe('INDUSTRIES structure', () => {
  const entries = Object.entries(INDUSTRIES);

  it('should have at least 9 industries', () => {
    expect(entries.length).toBeGreaterThanOrEqual(9);
  });

  it('each industry should have required fields', () => {
    for (const [key, industry] of entries) {
      expect(industry.nameAr, `${key} missing nameAr`).toBeTruthy();
      expect(industry.icon, `${key} missing icon`).toBeTruthy();
      expect(industry.description, `${key} missing description`).toBeTruthy();
      expect(typeof industry.comingSoon).toBe('boolean');
      expect(typeof industry.vehicleFieldsEnabled).toBe('boolean');
      expect(typeof industry.locationRequired).toBe('boolean');
    }
  });

  it('each industry should have default services', () => {
    for (const [key, industry] of entries) {
      if (key === 'other') continue; // other has no defaults
      expect(industry.defaultServices.length, `${key} has no services`).toBeGreaterThan(0);
    }
  });

  it('each industry should have WhatsApp templates', () => {
    for (const [key, industry] of entries) {
      expect((industry as any).whatsappTemplates?.length, `${key} has no WhatsApp templates`).toBeGreaterThan(0);
    }
  });
});
