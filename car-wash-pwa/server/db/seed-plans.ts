/**
 * Seed / upsert the canonical 2-plan structure into platform_plans.
 *
 * Idempotent — run it after every deploy. It adds new plans if
 * missing, and updates existing ones by slug without touching
 * vendor subscriptions. Safe to rerun.
 *
 *   npm run db:seed:plans
 *
 * or imported from `server/db/seed.ts` and called in the deploy
 * pipeline alongside drizzle-kit push.
 */

import 'dotenv/config';
import { db } from './index.js';
import { platformPlans } from './schema.js';
import { eq } from 'drizzle-orm';

interface PlanSeed {
  slug: string;
  nameAr: string;
  nameEn: string;
  description: string;
  price: string;
  billingCycle: string;
  maxEmployees: number;
  maxBranches: number;
  trialDays: number;
  isPopular: boolean;
  sortOrder: number;
  features: string[];
  featureGates: Record<string, boolean>;
}

const PLANS: PlanSeed[] = [
  {
    slug: 'free',
    nameAr: 'مجاني',
    nameEn: 'Free',
    description: 'ابدأ موقعك الإلكتروني بدون تكلفة',
    price: '0',
    billingCycle: 'monthly',
    maxEmployees: 1,
    maxBranches: 1,
    trialDays: 0,
    isPopular: false,
    sortOrder: 1,
    features: [
      '3 قوالب احترافية مختارة لنشاطك',
      'حجوزات غير محدودة',
      'طابور رقمي + معرض أعمال',
      'تغيير ألوان وشكل موقعك',
      'White-label — بدون علامة جداول',
      'دومين مخصص باسم متجرك',
      'صفحات مخصصة (أسعار، شروط، FAQ…)',
      'قوالب شروط جاهزة حسب نشاطك',
    ],
    featureGates: {
      bookings: true, store_page: true, basic_reports: true,
      basic_themes: true, queue: true,
      // Pro flags explicitly off so the UI can gate on them.
      whatsapp: false, pos: false, inventory: false,
      crm: false, loyalty: false, customer_segments: false,
      automations: false, campaigns: false, dispatch: false,
      premium_themes: false, vat_reports: false,
      google_maps: false, financial_statements: false,
      employee_management: false, unlimited_employees: false,
      payroll: false, gps_tracking: false,
      advanced_dashboard: false, ai_advisor: false,
      multi_branch: false, webhooks: false, priority_support: false,
    },
  },
  {
    slug: 'pro',
    nameAr: 'Pro',
    nameEn: 'Pro',
    description: 'كل أدوات تشغيل المتجر + 40 قالب',
    price: '99',
    billingCycle: 'monthly',
    maxEmployees: -1,
    maxBranches: 1,
    trialDays: 30,
    isPopular: true,
    sortOrder: 2,
    features: [
      'كل مميزات الباقة المجانية',
      '🎨 40 قالب احترافي (بدل 3 قوالب)',
      '💬 واتساب (إشعارات + حملات + أتمتة)',
      '🧾 نقطة بيع (POS) + كاشير',
      '📦 إدارة مخزون وموردين',
      '👤 CRM + تصنيف العملاء + برنامج الولاء',
      '🗺️ Google Maps متكامل',
      '📊 قوائم مالية متقدمة (P&L، Cashflow، VAT)',
      '👥 إدارة موظفين + رواتب + بونصات + GPS',
      '📈 لوحة تحكم متقدمة + تحليلات',
      '🤖 المستشار الذكي بالـ AI',
      'دعم فني ذو أولوية',
    ],
    featureGates: {
      bookings: true, store_page: true, basic_reports: true,
      basic_themes: true, queue: true,
      whatsapp: true, pos: true, inventory: true,
      crm: true, loyalty: true, customer_segments: true,
      automations: true, campaigns: true, dispatch: true,
      premium_themes: true, vat_reports: true,
      google_maps: true, financial_statements: true,
      employee_management: true, unlimited_employees: true,
      payroll: true, gps_tracking: true,
      advanced_dashboard: true, ai_advisor: true,
      multi_branch: false, webhooks: true, priority_support: true,
    },
  },
];

export async function seedPlatformPlans() {
  let created = 0, updated = 0;
  for (const p of PLANS) {
    const [existing] = await db.select({ id: platformPlans.id })
      .from(platformPlans).where(eq(platformPlans.slug, p.slug)).limit(1);

    if (existing) {
      await db.update(platformPlans)
        .set({
          nameAr: p.nameAr,
          nameEn: p.nameEn,
          description: p.description,
          price: p.price,
          billingCycle: p.billingCycle,
          maxEmployees: p.maxEmployees,
          maxBranches: p.maxBranches,
          trialDays: p.trialDays,
          isPopular: p.isPopular,
          isActive: true,
          sortOrder: p.sortOrder,
          features: p.features,
          featureGates: p.featureGates,
          updatedAt: new Date(),
        })
        .where(eq(platformPlans.id, existing.id));
      updated++;
      console.log(`  ↻ updated plan: ${p.slug}`);
    } else {
      await db.insert(platformPlans).values({
        slug: p.slug,
        nameAr: p.nameAr,
        nameEn: p.nameEn,
        description: p.description,
        price: p.price,
        billingCycle: p.billingCycle,
        maxEmployees: p.maxEmployees,
        maxBranches: p.maxBranches,
        trialDays: p.trialDays,
        isPopular: p.isPopular,
        isActive: true,
        sortOrder: p.sortOrder,
        features: p.features,
        featureGates: p.featureGates,
      });
      created++;
      console.log(`  + created plan: ${p.slug}`);
    }
  }

  // Retire any legacy plans that aren't in the canonical set (basic,
  // enterprise, business, etc. left over from old re-tiers) so the
  // pricing page stays clean. We don't delete — we deactivate so any
  // vendor still pointing at them keeps their historical record.
  const canonicalSlugs = PLANS.map((p) => p.slug);
  const allActive = await db.select({ id: platformPlans.id, slug: platformPlans.slug })
    .from(platformPlans).where(eq(platformPlans.isActive, true));
  let deactivated = 0;
  for (const row of allActive) {
    if (!canonicalSlugs.includes(row.slug)) {
      await db.update(platformPlans)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(platformPlans.id, row.id));
      deactivated++;
      console.log(`  - deactivated legacy plan: ${row.slug}`);
    }
  }

  console.log(`\nDone. created=${created}, updated=${updated}, deactivated=${deactivated}`);
}

// When run directly: execute the seed and exit.
// Avoid top-level await so this file stays CommonJS-friendly at build.
if (import.meta.url === `file://${process.argv[1]}`) {
  seedPlatformPlans()
    .then(() => process.exit(0))
    .catch((e) => { console.error(e); process.exit(1); });
}
