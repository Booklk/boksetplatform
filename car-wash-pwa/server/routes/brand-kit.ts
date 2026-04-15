import { Router } from 'express';
import { z } from 'zod';
import QRCode from 'qrcode';
import OpenAI from 'openai';
import { db } from '../db/index.js';
import { vendors } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { requireAuth, requireRole, AuthRequest } from '../middleware/auth.js';

const router = Router();

const DOMAIN = process.env.DOMAIN ?? 'jdawil.sa';

function getOpenAI() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('OPENAI_API_KEY غير مضبوط في بيئة الخادم');
  return new OpenAI({ apiKey: key });
}

const generateSchema = z.object({
  washName: z.string().min(2).max(80),
  location: z.string().min(2).max(100),
  services: z.array(z.string()).min(1).max(20),
  tone: z.enum(['professional', 'friendly', 'premium']).default('friendly'),
});

// POST /api/brand-kit/generate
router.post(
  '/generate',
  requireAuth,
  requireRole('vendor_admin', 'admin'),
  async (req: AuthRequest, res) => {
    try {
      const vendorId = req.user!.vendorId;
      if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة مرتبطة بالحساب' });

      const data = generateSchema.parse(req.body);

      const openai = getOpenAI();

      // 1. Generate Arabic business description with GPT-4o
      const toneMap = {
        professional: 'مهني ورسمي',
        friendly: 'ودود وقريب من العميل',
        premium: 'فاخر وراقي',
      };

      const descPrompt = `اكتب وصفاً احترافياً بالعربية لمغسلة سيارات اسمها "${data.washName}" في "${data.location}".
تقدم الخدمات التالية: ${data.services.join('، ')}.
الأسلوب المطلوب: ${toneMap[data.tone]}.
الوصف يجب أن يكون جذاباً للعملاء المحليين، 3-4 جمل فقط، بدون عناوين أو نقاط، فقرة واحدة متدفقة.`;

      const descCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: descPrompt }],
        max_tokens: 300,
        temperature: 0.8,
      });

      const description =
        descCompletion.choices[0]?.message?.content?.trim() ??
        `مغسلة ${data.washName} في ${data.location} — نقدم أفضل خدمات غسيل السيارات باحترافية عالية.`;

      // 2. Generate social post text
      const socialPrompt = `اكتب منشور إنستجرام قصير (3-4 أسطر) بالعربية لمغسلة "${data.washName}" في "${data.location}".
اجعله جذاباً مع إيموجي مناسبة، وأضف في نهايته 3-4 هاشتاق مناسبة.
الخدمات: ${data.services.slice(0, 5).join('، ')}.`;

      const socialCompletion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: socialPrompt }],
        max_tokens: 200,
        temperature: 0.9,
      });

      const socialPostText =
        socialCompletion.choices[0]?.message?.content?.trim() ??
        `✨ ${data.washName} — خدمة غسيل السيارات الأفضل في ${data.location}!\n#مغسلة_سيارات #${data.location}`;

      // 3. Generate cover image with DALL-E 3
      let coverImageUrl =
        'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80'; // fallback

      try {
        const imagePrompt = `Professional car wash business cover photo for "${data.washName}" in Saudi Arabia.
Modern car wash facility, clean water droplets, shiny cars, blue color theme,
photorealistic, wide angle shot, marketing quality image.`;

        const imageResponse = await openai.images.generate({
          model: 'dall-e-3',
          prompt: imagePrompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
        });

        coverImageUrl = imageResponse.data?.[0]?.url ?? coverImageUrl;
      } catch (imgErr) {
        console.warn('[brand-kit] DALL-E failed, using fallback:', imgErr);
      }

      // 4. Generate QR code pointing to vendor store page
      const [vendor] = await db
        .select({ slug: vendors.slug })
        .from(vendors)
        .where(eq(vendors.id, vendorId))
        .limit(1);

      const storeUrl = vendor?.slug
        ? `https://${DOMAIN}/store/${vendor.slug}`
        : `https://${DOMAIN}`;

      const qrCodeDataUrl = await QRCode.toDataURL(storeUrl, {
        width: 400,
        margin: 2,
        color: { dark: '#1e3a8a', light: '#ffffff' },
      });

      // 5. Save to DB
      const brandKit = {
        description,
        coverImageUrl,
        qrCodeDataUrl,
        socialPostText,
        generatedAt: new Date().toISOString(),
      };

      await db
        .update(vendors)
        .set({
          brandKit,
          brandKitGeneratedCount: sql`${vendors.brandKitGeneratedCount} + 1`,
        } as any)
        .where(eq(vendors.id, vendorId));

      return res.json(brandKit);
    } catch (e: any) {
      if (e?.message?.includes('OPENAI_API_KEY')) {
        return res.status(503).json({ error: 'خدمة الذكاء الاصطناعي غير متاحة حالياً — تواصل مع الدعم' });
      }
      if (e?.name === 'ZodError') return res.status(400).json({ error: e.errors[0]?.message });
      console.error('[brand-kit]', e);
      return res.status(500).json({ error: 'خطأ في توليد الهوية — حاول مرة أخرى' });
    }
  },
);

// GET /api/brand-kit/my — Get current vendor's brand kit
router.get('/my', requireAuth, requireRole('vendor_admin', 'admin'), async (req: AuthRequest, res) => {
  try {
    const vendorId = req.user!.vendorId;
    if (!vendorId) return res.status(400).json({ error: 'لا يوجد مغسلة' });

    const [vendor] = await db
      .select({ brandKit: vendors.brandKit, brandKitGeneratedCount: vendors.brandKitGeneratedCount, slug: vendors.slug })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    return res.json({
      brandKit: vendor?.brandKit ?? null,
      generatedCount: vendor?.brandKitGeneratedCount ?? 0,
      storeUrl: vendor?.slug ? `https://${DOMAIN}/store/${vendor.slug}` : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
