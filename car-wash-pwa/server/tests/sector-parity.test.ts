import { describe, it, expect } from 'vitest';
import { INDUSTRIES } from '../lib/industries';
import { getAgentIndustry, INDUSTRY_MARKET_DATA } from '../services/industryAgents';
import { defaultTermsForIndustry, TERMS_TEMPLATES } from '../services/termsTemplates';

/**
 * Whenever a sector is added to INDUSTRIES, the AI advisor and the
 * Terms-template registry need to know about it too. These tests fail
 * loudly when that doesn't happen, instead of vendors silently dropping
 * to 'universal' fallbacks.
 *
 * Two sectors are intentionally allowed to fall back:
 *   - 'other'        — no sector-specific data by design.
 */
const ALLOWED_FALLBACK_TO_UNIVERSAL = new Set(['other']);

describe('Sector parity — INDUSTRIES ↔ AI advisor', () => {
  for (const key of Object.keys(INDUSTRIES)) {
    it(`${key} resolves to a non-universal agent (or is allowlisted)`, () => {
      const agent = getAgentIndustry(key);
      const data = INDUSTRY_MARKET_DATA[agent];
      expect(data, `${key} → ${agent}: market data missing`).toBeTruthy();

      if (!ALLOWED_FALLBACK_TO_UNIVERSAL.has(key)) {
        expect(agent, `${key} should have a dedicated agent, not universal`).not.toBe('universal');
      }
    });
  }
});

describe('Sector parity — INDUSTRIES ↔ Terms templates', () => {
  for (const key of Object.keys(INDUSTRIES)) {
    it(`${key} resolves to a non-universal terms template (or is allowlisted)`, () => {
      const tplKey = defaultTermsForIndustry(key);
      const tpl = TERMS_TEMPLATES[tplKey];
      expect(tpl, `${key} → ${tplKey}: terms template missing`).toBeTruthy();

      if (!ALLOWED_FALLBACK_TO_UNIVERSAL.has(key)) {
        expect(tplKey, `${key} should have a dedicated terms template, not universal`).not.toBe('universal');
      }
    });
  }
});

describe('Sector parity — onboarding seed coverage', () => {
  // Freelancer ships with empty defaultServices on purpose — service is
  // 100% custom per freelancer. 'other' likewise has no defaults.
  const NO_DEFAULTS_OK = new Set(['freelancer', 'other']);

  for (const [key, industry] of Object.entries(INDUSTRIES)) {
    if (NO_DEFAULTS_OK.has(key)) continue;
    it(`${key} ships with seed services + at least one package`, () => {
      expect(industry.defaultServices.length, `${key} has no defaultServices`).toBeGreaterThan(0);
      expect(industry.defaultPackages.length, `${key} has no defaultPackages`).toBeGreaterThan(0);
    });
  }
});
