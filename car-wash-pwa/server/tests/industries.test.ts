import { describe, it, expect } from 'vitest';
import { getIndustriesList, getIndustryLabel, INDUSTRIES } from '../lib/industries';

describe('getIndustriesList', () => {
  it('without comingSoon should only return car_wash', () => {
    const list = getIndustriesList();
    expect(list).toHaveLength(1);
    expect(list[0].key).toBe('car_wash');
    expect(list[0].comingSoon).toBe(false);
  });

  it('with comingSoon=true should return all 9 industries', () => {
    const list = getIndustriesList(true);
    expect(list).toHaveLength(9);
    const keys = list.map(i => i.key);
    expect(keys).toContain('car_wash');
    expect(keys).toContain('home_cleaning');
    expect(keys).toContain('pest_control');
    expect(keys).toContain('other');
  });
});

describe('getIndustryLabel', () => {
  it('should return Arabic name for car_wash', () => {
    expect(getIndustryLabel('car_wash')).toBe('مغاسل السيارات');
  });

  it('should return Arabic name for home_cleaning', () => {
    expect(getIndustryLabel('home_cleaning')).toBe('تنظيف منازل');
  });

  it('should return the key itself for unknown industry', () => {
    expect(getIndustryLabel('unknown_industry')).toBe('unknown_industry');
  });

  it('should return the key for empty string', () => {
    expect(getIndustryLabel('')).toBe('');
  });
});

describe('INDUSTRIES structure', () => {
  const entries = Object.entries(INDUSTRIES);

  it('should have 9 industries total', () => {
    expect(entries).toHaveLength(9);
  });

  it('each industry should have required fields: nameAr, icon, description', () => {
    for (const [key, industry] of entries) {
      expect(industry.nameAr, `${key} missing nameAr`).toBeTruthy();
      expect(industry.icon, `${key} missing icon`).toBeTruthy();
      expect(industry.description, `${key} missing description`).toBeTruthy();
    }
  });

  it('each industry should have boolean comingSoon', () => {
    for (const [key, industry] of entries) {
      expect(typeof industry.comingSoon, `${key} comingSoon not boolean`).toBe('boolean');
    }
  });

  it('only car_wash should have comingSoon=false', () => {
    const launched = entries.filter(([_, v]) => !v.comingSoon);
    expect(launched).toHaveLength(1);
    expect(launched[0][0]).toBe('car_wash');
  });
});
