import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { bookingPhotos, bookings, vendors } from '../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', 'uploads', 'photos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `photo-${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('يُسمح بالصور فقط'));
    }
    cb(null, true);
  },
});

// POST /api/photos/booking/:id — Employee: upload before/after/damage photo
router.post('/booking/:id', requireAuth, requireRole('employee', 'admin', 'vendor_admin'), upload.single('photo'), async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const { phase, notes } = z.object({
      phase: z.enum(['before', 'after', 'damage']),
      notes: z.string().optional(),
    }).parse(req.body);

    if (!req.file) return res.status(400).json({ error: 'الصورة مطلوبة' });

    // Verify booking belongs to this vendor
    const [booking] = await db.select().from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.vendorId, req.user!.vendorId!)))
      .limit(1);
    if (!booking) return res.status(404).json({ error: 'الحجز غير موجود' });

    const photoUrl = `/uploads/photos/${req.file.filename}`;
    const [photo] = await db.insert(bookingPhotos).values({
      bookingId,
      phase,
      photoUrl,
      uploadedBy: req.user!.id,
      notes,
    }).returning();

    return res.status(201).json(photo);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/photos/booking/:id — Get photos for a booking
router.get('/booking/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    const photos = await db.select().from(bookingPhotos).where(eq(bookingPhotos.bookingId, bookingId));
    return res.json(photos);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// GET /api/photos/gallery/:slug — Public: storefront gallery.
// Returns the most recent "after" photos across completed bookings for
// the vendor, plus any vendor-curated URLs in vendors.settings.gallery[].
router.get('/gallery/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const limit = Math.min(Number(req.query.limit ?? 12), 24);

    const [vendor] = await db
      .select({ id: vendors.id, settings: vendors.settings })
      .from(vendors)
      .where(eq(vendors.slug, slug))
      .limit(1);

    if (!vendor) return res.status(404).json({ error: 'المتجر غير موجود' });

    // 1. Vendor-curated URLs (array of { url, caption? } in settings.gallery)
    const curated = ((vendor.settings as Record<string, unknown>)?.gallery as
      Array<{ url: string; caption?: string }> | undefined) ?? [];

    // 2. Recent "after" photos from completed bookings
    const recent = await db
      .select({
        photoUrl: bookingPhotos.photoUrl,
        createdAt: bookingPhotos.createdAt,
      })
      .from(bookingPhotos)
      .innerJoin(bookings, eq(bookingPhotos.bookingId, bookings.id))
      .where(and(
        eq(bookings.vendorId, vendor.id),
        eq(bookingPhotos.phase, 'after'),
        eq(bookings.status, 'completed'),
      ))
      .orderBy(desc(bookingPhotos.createdAt))
      .limit(limit);

    const items = [
      ...curated.map((g) => ({ url: g.url, caption: g.caption ?? null, source: 'curated' as const })),
      ...recent.map((p) => ({ url: p.photoUrl, caption: null, source: 'booking' as const })),
    ].slice(0, limit);

    return res.json({ items });
  } catch (e) {
    console.error('[photos/gallery]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
