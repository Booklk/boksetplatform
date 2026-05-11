/**
 * Vendor-authored custom pages.
 *
 * Public:
 *   GET  /api/pages/terms-templates     → list of industry Terms templates
 *   GET  /api/pages/public/:slug/nav    → pages this vendor shows in nav
 *   GET  /api/pages/public/:slug/:page  → a single published page
 *
 * Vendor (auth):
 *   GET    /api/pages/mine              → all pages owned by vendor
 *   POST   /api/pages/mine              → create
 *   PUT    /api/pages/mine/:id          → update
 *   DELETE /api/pages/mine/:id          → delete
 *   POST   /api/pages/mine/terms/use    → create / replace terms from a template
 */

import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { customPages, vendors } from '../db/schema.js';
import { and, eq, asc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import {
  TERMS_TEMPLATE_LIST, TERMS_TEMPLATES, renderTermsTemplate,
  TermsIndustry,
} from '../services/termsTemplates.js';

const router = Router();

/* ─── slug helper ─────────────────────────────────────────────────────────── */

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9؀-ۿ-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'page';
}

/* ═══════════════════════════════════════════════════════════════════════════
   Public endpoints — storefront reads these
   ═══════════════════════════════════════════════════════════════════════════ */

// GET /api/pages/terms-templates — static list, shown in vendor admin
router.get('/terms-templates', (_req, res) => {
  res.json({
    templates: TERMS_TEMPLATE_LIST.map((t) => ({
      industry: t.industry,
      label: t.label,
      summary: t.summary,
    })),
  });
});

// GET /api/pages/public/:vendorSlug/nav
// Pages that should appear in the storefront navigation (showInNav=true,
// isPublished=true). Plus an always-on entry for the platform-wide
// privacy policy.
router.get('/public/:vendorSlug/nav', async (req, res) => {
  try {
    const [vendor] = await db.select({ id: vendors.id })
      .from(vendors).where(eq(vendors.slug, req.params.vendorSlug)).limit(1);
    if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });

    const rows = await db.select({
      slug: customPages.slug,
      title: customPages.title,
      kind: customPages.kind,
      sortOrder: customPages.sortOrder,
    })
      .from(customPages)
      .where(and(
        eq(customPages.vendorId, vendor.id),
        eq(customPages.isPublished, true),
        eq(customPages.showInNav, true),
      ))
      .orderBy(asc(customPages.sortOrder));

    return res.json({ pages: rows });
  } catch (e) {
    console.error('[pages/public/nav]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/pages/public/:vendorSlug/:pageSlug
router.get('/public/:vendorSlug/:pageSlug', async (req, res) => {
  try {
    const [vendor] = await db.select({ id: vendors.id, nameAr: vendors.nameAr, phone: vendors.phone })
      .from(vendors).where(eq(vendors.slug, req.params.vendorSlug)).limit(1);
    if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });

    const [page] = await db.select()
      .from(customPages)
      .where(and(
        eq(customPages.vendorId, vendor.id),
        eq(customPages.slug, req.params.pageSlug),
        eq(customPages.isPublished, true),
      ))
      .limit(1);
    if (!page) return res.status(404).json({ error: 'الصفحة غير موجودة' });

    return res.json({
      slug: page.slug,
      title: page.title,
      kind: page.kind,
      content: page.content,
      updatedAt: page.updatedAt,
    });
  } catch (e) {
    console.error('[pages/public]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   Vendor-authenticated endpoints
   ═══════════════════════════════════════════════════════════════════════════ */

router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

// GET /api/pages/mine — all pages for this vendor
router.get('/mine', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمتجر' });

    const rows = await db.select()
      .from(customPages)
      .where(eq(customPages.vendorId, vendorId))
      .orderBy(asc(customPages.sortOrder));
    return res.json({ pages: rows });
  } catch (e) {
    console.error('[pages/mine]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/pages/mine — create
const createSchema = z.object({
  title: z.string().min(1).max(200),
  slug: z.string().optional(),
  content: z.string().default(''),
  kind: z.enum(['custom', 'terms']).default('custom'),
  isPublished: z.boolean().default(true),
  showInNav: z.boolean().default(false),
  sortOrder: z.number().default(0),
});

router.post('/mine', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمتجر' });

    const data = createSchema.parse(req.body);
    let slug = data.slug?.trim() ? slugify(data.slug) : slugify(data.title);

    // Only one terms page per vendor — overwrite if already exists
    if (data.kind === 'terms') {
      const [existing] = await db.select({ id: customPages.id })
        .from(customPages)
        .where(and(eq(customPages.vendorId, vendorId), eq(customPages.kind, 'terms')))
        .limit(1);
      if (existing) {
        return res.status(409).json({
          error: 'صفحة الشروط موجودة. عدّلها أو احذفها أولاً.',
          existingId: existing.id,
        });
      }
      slug = 'terms';
    }

    // Ensure slug is unique per vendor
    let finalSlug = slug;
    for (let attempt = 1; attempt < 20; attempt++) {
      const [clash] = await db.select({ id: customPages.id })
        .from(customPages)
        .where(and(eq(customPages.vendorId, vendorId), eq(customPages.slug, finalSlug)))
        .limit(1);
      if (!clash) break;
      finalSlug = `${slug}-${attempt + 1}`;
    }

    const [created] = await db.insert(customPages).values({
      vendorId,
      kind: data.kind,
      slug: finalSlug,
      title: data.title,
      content: data.content,
      isPublished: data.isPublished,
      showInNav: data.showInNav,
      sortOrder: data.sortOrder,
    }).returning();

    return res.status(201).json(created);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[pages POST]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// PUT /api/pages/mine/:id — update
const updateSchema = createSchema.partial().extend({ slug: z.string().optional() });

router.put('/mine/:id', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمتجر' });
    const id = Number(req.params.id);

    const [existing] = await db.select().from(customPages)
      .where(and(eq(customPages.id, id), eq(customPages.vendorId, vendorId))).limit(1);
    if (!existing) return res.status(404).json({ error: 'الصفحة غير موجودة' });

    const data = updateSchema.parse(req.body);
    const next: Record<string, unknown> = { updatedAt: new Date() };
    if (data.title !== undefined) next.title = data.title;
    if (data.content !== undefined) next.content = data.content;
    if (data.isPublished !== undefined) next.isPublished = data.isPublished;
    if (data.showInNav !== undefined) next.showInNav = data.showInNav;
    if (data.sortOrder !== undefined) next.sortOrder = data.sortOrder;
    if (data.slug !== undefined && existing.kind !== 'terms') {
      const s = slugify(data.slug);
      if (s !== existing.slug) {
        const [clash] = await db.select({ id: customPages.id })
          .from(customPages)
          .where(and(eq(customPages.vendorId, vendorId), eq(customPages.slug, s)))
          .limit(1);
        if (clash) return res.status(409).json({ error: 'الـ slug مستخدم' });
        next.slug = s;
      }
    }

    const [updated] = await db.update(customPages)
      .set(next)
      .where(eq(customPages.id, id))
      .returning();
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[pages PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// DELETE /api/pages/mine/:id
router.delete('/mine/:id', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمتجر' });
    const id = Number(req.params.id);

    const result = await db.delete(customPages)
      .where(and(eq(customPages.id, id), eq(customPages.vendorId, vendorId)))
      .returning({ id: customPages.id });
    if (result.length === 0) return res.status(404).json({ error: 'الصفحة غير موجودة' });
    return res.json({ success: true });
  } catch (e) {
    console.error('[pages DELETE]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// POST /api/pages/mine/terms/use — instantiate terms from a template
const useTermsSchema = z.object({
  industry: z.enum([
    'salon', 'barber', 'beauty_home', 'spa',
    'car_wash_mobile', 'car_wash_fixed',
    'cleaning', 'movers', 'universal',
  ]),
  replace: z.boolean().default(false),
});

router.post('/mine/terms/use', async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(403).json({ error: 'مطلوب ارتباط بمتجر' });
    const { industry, replace } = useTermsSchema.parse(req.body);

    const tpl = TERMS_TEMPLATES[industry as TermsIndustry];
    if (!tpl) return res.status(400).json({ error: 'قالب غير معروف' });

    const [vendor] = await db.select({ nameAr: vendors.nameAr, phone: vendors.phone })
      .from(vendors).where(eq(vendors.id, vendorId)).limit(1);
    if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });

    const content = renderTermsTemplate(tpl, {
      vendor: vendor.nameAr,
      phone: vendor.phone ?? undefined,
    });

    const [existing] = await db.select({ id: customPages.id })
      .from(customPages)
      .where(and(eq(customPages.vendorId, vendorId), eq(customPages.kind, 'terms')))
      .limit(1);

    if (existing && !replace) {
      return res.status(409).json({
        error: 'صفحة الشروط موجودة — أرسل replace:true لاستبدالها',
        existingId: existing.id,
      });
    }

    if (existing) {
      const [updated] = await db.update(customPages)
        .set({ title: 'الشروط والأحكام', content, updatedAt: new Date(), isPublished: true })
        .where(eq(customPages.id, existing.id))
        .returning();
      return res.json(updated);
    }

    const [created] = await db.insert(customPages).values({
      vendorId,
      kind: 'terms',
      slug: 'terms',
      title: 'الشروط والأحكام',
      content,
      isPublished: true,
      showInNav: true,
    }).returning();
    return res.status(201).json(created);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[pages/terms/use]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
