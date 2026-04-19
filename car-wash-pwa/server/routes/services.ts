import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db/index.js';
import { services, packages } from '../db/schema.js';
import { eq, asc } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

// Public: list active services with packages
router.get('/', async (_req, res) => {
  try {
    const allServices = await db.select().from(services)
      .where(eq(services.isActive, true))
      .orderBy(asc(services.sortOrder));

    const allPackages = await db.select().from(packages)
      .where(eq(packages.isActive, true))
      .orderBy(asc(packages.sortOrder));

    const result = allServices.map(s => ({
      ...s,
      packages: allPackages.filter(p => p.serviceId === s.id),
    }));

    return res.json(result);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: create service
router.post('/', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط بهذا الحساب' });

    const raw = req.body;
    // Support both nameAr/nameEn (from client) and name (direct)
    const name = raw.nameAr || raw.nameEn || raw.name;

    const data = z.object({
      name: z.string().min(2),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      sortOrder: z.number().optional(),
    }).parse({ ...raw, name });

    const [svc] = await db.insert(services).values({ ...data, vendorId }).returning();
    return res.status(201).json(svc);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: update service
router.put('/:id', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      name: z.string().min(2).optional(),
      description: z.string().optional(),
      imageUrl: z.string().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }).parse(req.body);

    const [updated] = await db.update(services).set(data).where(eq(services.id, id)).returning();
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: delete service
router.delete('/:id', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    await db.update(services).set({ isActive: false }).where(eq(services.id, id));
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: create package
router.post('/:serviceId/packages', requireAuth, requireRole('admin', 'vendor_admin'), async (req: AuthRequest, res) => {
  try {
    const serviceId = Number(req.params.serviceId);
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد متجر مرتبط' });

    const data = z.object({
      name: z.string().min(2),
      price: z.union([z.string(), z.number()]).transform(v => String(v)),
      duration: z.number(),
      features: z.array(z.string()).optional(),
      sortOrder: z.number().optional(),
    }).parse(req.body);

    const [pkg] = await db.insert(packages).values({
      serviceId,
      vendorId,
      name: data.name,
      price: data.price,
      duration: data.duration,
      features: data.features ?? [],
      sortOrder: data.sortOrder ?? 0,
    }).returning();
    return res.status(201).json(pkg);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// Admin: update package
router.put('/packages/:id', requireAuth, requireRole('admin', 'vendor_admin'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = z.object({
      name: z.string().optional(),
      price: z.string().optional(),
      duration: z.number().optional(),
      features: z.array(z.string()).optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }).parse(req.body);

    const [updated] = await db.update(packages).set(data).where(eq(packages.id, id)).returning();
    return res.json(updated);
  } catch (e: any) {
    if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

// ── GET /api/services/suggest-image?q=NAME ─────────────────────────────────
// Returns a curated Unsplash photo URL that best matches the service name.
// Photo IDs are hand-picked, royalty-free car-wash / detailing images.

const IMAGE_BANK: Record<string, string[]> = {
  exterior: [
    'photo-1596838132731-3301c3fd4317', // car wash exterior blue
    'photo-1607860108855-64acf2078ed9', // car detailing side
    'photo-1558618666-fcd25c85cd64', // car wash foam
    'photo-1592194996308-7b43878e84a6', // car being washed
  ],
  interior: [
    'photo-1503376780353-7e6692767b70', // car interior clean
    'photo-1583121274602-3e2820c69888', // car seat cleaning
    'photo-1541899481282-d53bffe3c35d', // car interior detail
  ],
  polish: [
    'photo-1626668011687-8a114cf5a34c', // car polishing
    'photo-1597007066704-67bf2068d5b2', // buffing car
    'photo-1494976388531-d1058494cdd8', // shiny car
  ],
  steam: [
    'photo-1563720223185-11003d516935', // steam cleaning car
    'photo-1621905252507-b35492cc74b4', // steam wash
  ],
  engine: [
    'photo-1486262715619-67b85e0b08d3', // engine cleaning
    'photo-1619642751034-765dfdf7c58e', // engine detail
  ],
  tint: [
    'photo-1552519507-da3b142c6e3d', // tinted car
    'photo-1549317661-bd32c8ce0db2', // car window
  ],
  default: [
    'photo-1558618666-fcd25c85cd64',
    'photo-1596838132731-3301c3fd4317',
    'photo-1607860108855-64acf2078ed9',
    'photo-1592194996308-7b43878e84a6',
    'photo-1541899481282-d53bffe3c35d',
  ],
};

const ARABIC_MAP: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['خارج', 'سطح', 'جسم', 'بودي', 'exterior'], category: 'exterior' },
  { keywords: ['داخل', 'كابين', 'مقاعد', 'سجاد', 'interior'], category: 'interior' },
  { keywords: ['تلميع', 'بولش', 'لمعة', 'polish', 'wax', 'شمع'], category: 'polish' },
  { keywords: ['بخار', 'steam'], category: 'steam' },
  { keywords: ['محرك', 'engine'], category: 'engine' },
  { keywords: ['تظليل', 'تلوين', 'زجاج', 'tint'], category: 'tint' },
];

router.get('/suggest-image', async (req, res) => {
  const q = String(req.query.q ?? '').toLowerCase();

  let category = 'default';
  for (const entry of ARABIC_MAP) {
    if (entry.keywords.some(k => q.includes(k))) {
      category = entry.category;
      break;
    }
  }

  const pool = IMAGE_BANK[category] ?? IMAGE_BANK.default;
  // Pick deterministically based on query string hash so same name → same photo
  let hash = 0;
  for (let i = 0; i < q.length; i++) hash = (hash * 31 + q.charCodeAt(i)) & 0xffff;
  const photoId = pool[hash % pool.length];

  return res.json({
    url: `https://images.unsplash.com/${photoId}?w=600&h=400&fit=crop&auto=format&q=80`,
    credit: 'Unsplash',
  });
});

export default router;
