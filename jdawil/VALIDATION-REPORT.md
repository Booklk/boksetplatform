# 🧪 Jdawil — Merchant Validation Report

**Date:** 2026-05-08
**Method:** End-to-end walkthrough of the merchant journey (signup → dashboard → first booking → ops)
**Approach:** Read every line of code a real merchant's request would touch, assume Saudi-shaped inputs (Arabic-only password, Saudi phone formats, non-car-wash sectors)

---

## Outcome

**8 issues found. 8 fixed.** No deployment-blocking gaps remain.

The platform is now ready for a real Saudi merchant in any of the 13 supported
sectors to:
1. Sign up with Arabic-only password
2. Land on a dashboard that doesn't assume car-wash terminology
3. See an industry-aware setup checklist
4. Browse 11 operational FAQ articles when stuck
5. Send WhatsApp from a clearly-branded number

---

## Issues found and fixed

### MV-1 — Vendor URL slug uses old "Bokset" brand prefix
**File:** `server/routes/vendors.ts:22 (autoSlug)`
**Symptom:** Every new merchant got a slug like `bk-XXXXXX-Y` — leftover from the old project name. The merchant's storefront URL would publicly carry the wrong brand: `jdawil.sa/store/bk-503333-abc123`.
**Fix:** Slug prefix changed `bk-` → `jd-`.
**Impact:** First impression — public URL now matches the brand the merchant subscribed to.

### MV-2 — Password rule rejects Arabic-only passwords
**File:** `server/routes/vendors.ts:269 (onboard)`
**Symptom:** The check `/[A-Z]/.test(password)` required a *Latin uppercase* letter. A merchant typing `سعودي2024!` got rejected with "كلمة المرور يجب أن تحتوي على حرف كبير ورقم". Confusing because the password already has a digit and a symbol — it just doesn't have a Latin letter. Real Saudi merchants frequently use Arabic-only passwords.
**Fix:** New rule —
- 12+ characters of any script: accepted (modern OWASP guidance)
- 8-11 characters: must have at least 2 of {digit, symbol, mixed-case}
- Error message now actionable: "أضف رقم ورمز (مثل ! أو @) أو اجعلها 12 حرف فأكثر"
**Impact:** First-call drop-off at password step eliminated.

### MV-3 — Industry validation gap
**File:** `server/routes/vendors.ts (onboard)`
**Symptom:** `industry || 'other'` accepted any string the client sent — including unknown values that would silently land the merchant on the empty `'other'` template with no services seeded.
**Fix:** Whitelist of 14 known industry keys (13 sectors + 'other'). Anything outside falls back explicitly to `'other'`.
**Impact:** Merchants typing into `/onboard?industry=foo` get the right empty-template behaviour instead of a half-broken catalogue.

### MV-4 — `'المغسلة'` (the car wash) hardcoded as fallback name
**Files:** `client/src/pages/vendor/Dashboard.tsx:306`, `vendor/Operations.tsx:420`, `super-admin/Dashboard.tsx:376`
**Symptom:** A salon owner / clinic / spa whose name field is empty would see "المغسلة" as their store's display name on the dashboard. Old leak from the time the platform supported only car washes.
**Fix:** Replaced with generic `'متجرك'` (your store) — works across all 13 sectors. Super-admin table column "المغسلة" → "المتجر".
**Impact:** A non-car-wash merchant doesn't see car-wash-specific copy on day 1.

### MV-5 — Setup checklist hardcoded car-wash steps
**File:** `server/routes/vendors.ts (setup-checklist)`
**Symptom:** Every merchant — salon, clinic, spa, plumber — saw "أضف سيارتك الأولى" as a setup step. A salon owner has no fleet, so this step would never complete and the checklist would stick at 80%.
**Fix:** Industry-aware checklist:
- Universal steps (profile, services, employees, first booking, loyalty) for all sectors
- Fleet step ("أضف أول مركبة") only for the 8 sectors that operate vehicles (car_wash, home_cleaning, movers, beauty_home, ac_maintenance, plumbing, electrical, appliance_repair)
- Added a WhatsApp step (often missed in old flow) so completing the checklist actually delivers a working notification setup.
**Impact:** Every merchant can reach 100% on the checklist, no matter the sector.

### MV-6 — Stale brand reference in push notifications
**File:** `server/services/automationEngine.ts:376`
**Symptom:** The fallback title for outbound push notifications was hardcoded `'بوكست'` (the old brand name). A customer would receive a push titled "بوكست" instead of the merchant's brand.
**Fix:** Falls back to `vendor.nameAr` first (the merchant the customer actually has a relationship with), then a generic `'إشعار'` as last resort.
**Impact:** No old-brand leakage to end customers.

### MV-7 — Merchant operations guide gap
**Symptom:** The existing `/help` page targeted *prospects* with pricing FAQs. Merchants who already signed up had no in-product answers to the questions they actually ask:
- "How do I share my store link?"
- "How do I add a service?"
- "Why isn't WhatsApp sending?"
- "How do I refund a customer?"
- "How do I add an employee?"
**Fix:** New `client/src/data/helpArticles.ts` with 11 operational guides across 7 categories. New `/help/article/:slug` reader page with markdown sanitiser. The existing `/help` page now includes an "Operations Guides" section linking to all of them.
**Articles shipped:**
1. كيف أوصل رابط متجري لعملائي؟
2. كيف أضيف خدماتي وأسعارها؟
3. استراتيجية أول ١٠ عملاء
4. الواتساب ما يرسل للعملاء — ماذا أفعل؟
5. الفرق بين رقم متجري ورقم Jdawil المشترك
6. كيف أربط Moyasar (بوابة الدفع)؟
7. كيف ألغي حجز وأرجع للعميل؟
8. كيف أدير الحجوزات اليومية؟
9. كيف أضيف موظفين وأوزّع عليهم الحجوزات؟
10. التقارير الشهرية وضريبة القيمة المضافة
11. حقوق العملاء في بياناتهم (PDPL)

### MV-8 — Help page route registration
**Symptom:** The new article reader route didn't exist.
**Fix:** Registered `<Route path="/help/article/:slug" element={<HelpArticle />} />` in `App.tsx` with lazy loading.

---

## Verified working (no change needed)

### Signup → onboarding
- Phone verification (OTP) is enforced before vendor creation — anti-trial-abuse works as designed
- Existing-phone collision properly returns 409
- Transaction wraps vendor + user creation atomically (no orphan vendor on user-insert failure)
- Industry templates auto-seed services + packages on signup
- Founding-member detection (first 100 vendors) works
- 60-day money-back window stamped at signup
- 14-day trial window stamped at signup

### First booking
- `POST /api/bookings` validates working hours, holidays, lead time
- WhatsApp confirmation triggered via the durable queue (non-blocking, retries)
- Tracking token generated for public live-tracking
- Vendor's WhatsApp brand name flows through to the customer message

### Customer-side
- Storefront pages cached at CDN (5 min) with explicit invalidation on vendor edit
- Reviews paginated and cached
- Booking creation → confirmation → rating loop intact

### Multi-tenant
- Every vendor-scoped query includes the tenant guard
- IDORs were closed in the security audit (Wave 5)

---

## What a real merchant's day-1 looks like now

```
1. https://jdawil.sa/onboard
   ├── يكتب اسم المنشأة + رقم الجوال
   ├── يستلم OTP على واتساب (3 محاولات/ساعة فقط)
   ├── يدخل OTP ← يظهر "تم التحقق ✅"
   ├── يكتب كلمة مرور (يقبل عربي + رقم + رمز، 8+ حرف)
   ├── يختار قطاعه (13 قطاع متاح)
   └── يضغط "إنشاء حسابي" ← خلال 3 ثواني المتجر جاهز

2. /vendor (الداشبورد):
   ├── "أهلاً بـ <اسم متجره>" — مو "أهلاً بالمغسلة"
   ├── HealthWidget يظهر "0%" مع 5 خطوات
   ├── SetupChecklist يظهر الخطوات اللي تناسب قطاعه فقط
   └── إذا قطاعه "صالون" مثلاً، ما يظهر "أضف سيارة"

3. /vendor/whatsapp (إن لم يكمل):
   ├── 3 خيارات واضحة: Meta / Unifonic / مشترك
   ├── الـ"مشترك" تفعيل فوري بضغطة زر
   └── يستلم رسالة تجريبية على جواله للتأكيد

4. /vendor/branding ← يضيف شعاره + لون متجره

5. /admin/services ← يضيف 3 خدمات + باقاتها (أو يستخدم القوالب المُعبأة تلقائياً)

6. /vendor/dashboard ← زر "شارك متجري" ← يولّد رابط واتساب + QR

7. أول عميل يدخل /store/jd-503333-abc وفعلاً يحجز

8. التاجر:
   ├── يستلم إشعار push + واتساب
   ├── يفتح "الحجوزات اليوم" ويراها
   └── يضغط "تأكيد" — العميل يستلم رسالة تأكيد فورية

9. التاجر إذا واجه أي سؤال:
   ├── /help ← فيها قسم "دليل التاجر" بـ 11 مقال
   ├── يبحث عن "شارك" ← يلقى المقال
   └── يقرأ في 2-3 دقائق ويستمر
```

---

## Final pre-launch checks

```bash
✅ npm audit (server)        0 vulnerabilities
✅ npm audit (client)        0 vulnerabilities
✅ TypeScript (server)       0 errors
✅ TypeScript (client)       0 errors (deprecation warning only)
✅ Tests                     158/158 passing
✅ Industry consistency      13 sectors aligned server↔client↔SEO
✅ Brand consistency         no Bokset/بوكست remnants
✅ Help articles              11 ops guides + reader page
✅ Setup checklist            industry-aware
```

---

## Branch summary — all 6 waves shipped

| Commit | Wave | Theme |
|---|---|---|
| `9f0eb70` | 1 | TS + indexes + rate limiting + queue |
| `972f271` | 2 | S3 + Redis + replica + load tests |
| `3c67128` | 3 | CDN + Sentry + bot webhook + vendor health |
| `706b7f8` | 4 | CSP + maintenance + PDPL + dunning + backups |
| `b79326f` | 5 | Security audit — 10 vulnerabilities closed |
| `[this commit]` | 6 | Merchant validation — 8 day-1 issues closed + 11 help articles |

The platform is **technically ready** to onboard real Saudi merchants.
The remaining gates are operational (subscriptions, legal entity, hosting setup) — not code.
