/**
 * /api/vendor-storefront — rich media customisation for the vendor's
 * storefront. Pro-only (trial counts as Pro).
 *
 *   GET    /settings                — current announcement + hero
 *   PUT    /settings                — patch announcement + hero
 *   GET    /public/:slug            — the customer-facing read (live
 *                                      banner + hero, no auth)
 *   POST   /services/:id/images     — append a media path to a service
 *   DELETE /services/:id/images     — remove a specific path
 *   PUT    /services/:id/video      — set videoUrl + posterUrl
 *   POST   /upload-video            — multer MP4 upload (50MB)
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { z } from 'zod';
import { db } from '../db/index.js';
import { services, vendors } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import { requirePro } from '../middleware/requirePro.js';
import {
  readStorefrontSettings, writeStorefrontSettings,
  isAnnouncementLive, DEFAULT_SETTINGS, publicMerchantNumber,
  FONT_CATALOG,
} from '../services/storefrontSettings.js';

const router = Router();

// ── Public read (no auth) — the storefront pulls this on every load ──────
router.get('/public/:slug', async (req, res) => {
  const [vendor] = await db.select({
    id: vendors.id,
    settings: vendors.settings,
    plan: vendors.subscriptionPlan,
    status: vendors.subscriptionStatus,
    trialEndsAt: vendors.trialEndsAt,
  }).from(vendors).where(eq(vendors.slug, req.params.slug)).limit(1);
  if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });

  const merchantNumber = publicMerchantNumber(vendor.id);

  // Only ship Pro-gated media/brand to the public renderer when the
  // vendor still has a Pro (or trial) subscription. Downgraded vendors
  // see their own legacy settings in the studio, but customers don't.
  const inTrial = vendor.status === 'trial' && vendor.trialEndsAt && vendor.trialEndsAt > new Date();
  const isPro = vendor.plan === 'pro' || vendor.plan === 'enterprise';
  if (!isPro && !inTrial) {
    return res.json({
      announcement: null,
      hero: DEFAULT_SETTINGS.hero,
      brand: DEFAULT_SETTINGS.brand,
      merchantNumber,
    });
  }

  const s = (vendor.settings as any)?.storefront;
  const store = {
    announcement: null as null | Record<string, unknown>,
    hero: DEFAULT_SETTINGS.hero,
    brand: DEFAULT_SETTINGS.brand,
    merchantNumber,
  };
  if (s) {
    const coerced = (await readStorefrontSettings(vendor.id));
    store.hero  = coerced.hero;
    store.brand = coerced.brand;
    if (isAnnouncementLive(coerced.announcement)) {
      store.announcement = {
        text: coerced.announcement.text,
        href: coerced.announcement.href || null,
        tone: coerced.announcement.tone,
      };
    }
  }
  res.set('Cache-Control', 'public, max-age=60');
  return res.json(store);
});

// List curated Arabic fonts — safe to expose without auth (just a catalogue).
router.get('/fonts', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json({ fonts: FONT_CATALOG });
});

// ── From here on: authenticated + Pro-gated ──────────────────────────────
router.use(requireAuth);
router.use(requireRole('vendor_admin', 'admin'));

router.get('/settings', async (req: AuthRequest, res) => {
  const vendorId = req.user!.vendorId;
  if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر' });
  const settings = await readStorefrontSettings(vendorId);
  return res.json({
    ...settings,
    merchantNumber: publicMerchantNumber(vendorId),
  });
});

const settingsPatchSchema = z.object({
  announcement: z.object({
    enabled: z.boolean().optional(),
    text:    z.string().max(200).optional(),
    href:    z.string().max(500).optional(),
    tone:    z.enum(['info','success','warn','danger','brand']).optional(),
    startsAt: z.string().nullable().optional(),
    endsAt:   z.string().nullable().optional(),
  }).partial().optional(),
  hero: z.object({
    mediaType:     z.enum(['none','image','video']).optional(),
    mediaUrl:      z.string().max(500).optional(),
    posterUrl:     z.string().max(500).optional(),
    headlineAr:    z.string().max(120).optional(),
    subheadlineAr: z.string().max(200).optional(),
    ctaLabelAr:    z.string().max(60).optional(),
    ctaHref:       z.string().max(500).optional(),
  }).partial().optional(),
  brand: z.object({
    colors: z.object({
      primary:    z.string().max(40).optional(),
      accent:     z.string().max(40).optional(),
      background: z.string().max(40).optional(),
      surface:    z.string().max(40).optional(),
      text:       z.string().max(40).optional(),
    }).partial().optional(),
    fonts: z.object({
      heading: z.string().max(20).optional(),
      body:    z.string().max(20).optional(),
    }).partial().optional(),
    typographyScale: z.enum(['compact','comfortable','spacious']).optional(),
    buttonShape:     z.enum(['rounded','pill','square']).optional(),
    layout: z.object({
      heroAlignment:  z.enum(['center','start','end','full']).optional(),
      servicesLayout: z.enum(['grid','list','cards']).optional(),
      sectionsOrder:  z.array(z.string()).max(20).optional(),
    }).partial().optional(),
    identity: z.object({
      logoUrl:    z.string().max(500).optional(),
      faviconUrl: z.string().max(500).optional(),
      ogImageUrl: z.string().max(500).optional(),
    }).partial().optional(),
  }).partial().optional(),
});

router.put('/settings', requirePro, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const patch = settingsPatchSchema.parse(req.body);
    const next = await writeStorefrontSettings(vendorId, patch as any);
    return res.json(next);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[storefront/settings PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Service-level media ──────────────────────────────────────────────────

router.post('/services/:id/images', requirePro, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const url = String(req.body?.url ?? '').trim();
    if (!url) return res.status(400).json({ error: 'رابط الصورة مطلوب' });
    const [svc] = await db.select({ id: services.id, images: services.images })
      .from(services).where(and(eq(services.id, id), eq(services.vendorId, vendorId))).limit(1);
    if (!svc) return res.status(404).json({ error: 'الخدمة غير موجودة' });
    const next = [...(svc.images ?? []), url].slice(0, 12);
    await db.update(services).set({ images: next }).where(eq(services.id, id));
    return res.json({ images: next });
  } catch (e) {
    console.error('[storefront/service-images POST]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

router.delete('/services/:id/images', requirePro, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const url = String(req.query.url ?? req.body?.url ?? '');
    const [svc] = await db.select({ id: services.id, images: services.images })
      .from(services).where(and(eq(services.id, id), eq(services.vendorId, vendorId))).limit(1);
    if (!svc) return res.status(404).json({ error: 'الخدمة غير موجودة' });
    const next = (svc.images ?? []).filter((u) => u !== url);
    await db.update(services).set({ images: next }).where(eq(services.id, id));
    return res.json({ images: next });
  } catch (e) {
    console.error('[storefront/service-images DELETE]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

const videoPatchSchema = z.object({
  videoUrl:       z.string().max(500).optional(),
  videoPosterUrl: z.string().max(500).optional(),
});

router.put('/services/:id/video', requirePro, async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId!;
    const id = Number(req.params.id);
    const data = videoPatchSchema.parse(req.body);
    const [svc] = await db.select({ id: services.id })
      .from(services).where(and(eq(services.id, id), eq(services.vendorId, vendorId))).limit(1);
    if (!svc) return res.status(404).json({ error: 'الخدمة غير موجودة' });
    await db.update(services).set({
      videoUrl:       data.videoUrl       ?? null,
      videoPosterUrl: data.videoPosterUrl ?? null,
    }).where(eq(services.id, id));
    return res.json({ ok: true });
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error('[storefront/service-video PUT]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── Video upload (MP4 / WebM, up to 50 MB) ──────────────────────────────
// Small-file video: fits inline on the storefront without a CDN. For
// anything longer, vendors should paste a YouTube/Vimeo link.

const VIDEO_DIR = path.join(process.cwd(), 'uploads', 'video');
if (!fs.existsSync(VIDEO_DIR)) fs.mkdirSync(VIDEO_DIR, { recursive: true });

const videoUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, VIDEO_DIR),
    filename:    (_req, file, cb) => {
      const raw = path.extname(file.originalname).toLowerCase();
      const ext = /^\.(mp4|webm|mov|m4v)$/.test(raw) ? raw : '.mp4';
      cb(null, `${crypto.randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^video\/(mp4|webm|quicktime)$/.test(file.mimetype)) {
      cb(new Error('الفيديو يجب أن يكون MP4 أو WebM أو MOV'));
      return;
    }
    cb(null, true);
  },
});

router.post('/upload-video', requirePro, videoUpload.single('video'), async (req: AuthRequest, res) => {
  if (!req.file) return res.status(400).json({ error: 'لا يوجد ملف' });
  const base = (process.env.BASE_URL ?? '').replace(/\/$/, '');
  const rel = `/uploads/video/${req.file.filename}`;
  return res.status(201).json({ url: base ? `${base}${rel}` : rel });
});

export default router;
