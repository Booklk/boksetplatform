# Jdawil Platform — منصة إنشاء مواقع الحجوزات

منصة SaaS متكاملة لإدارة مغاسل السيارات الثابتة والمتنقلة في المملكة العربية السعودية.

## المميزات الرئيسية

- **Multi-Tenant SaaS** — كل مشروع له لوحة تحكم مستقلة
- **حجوزات أونلاين** — العميل يحجز من جواله بثواني
- **تتبع GPS مباشر** — خريطة حية للموظفين والسيارات (WebSocket)
- **مدفوعات إلكترونية** — STC Pay، مدى، Apple Pay
- **إدارة موظفين** — رواتب، أداء، جدولة، GPS
- **إشعارات واتساب** — تأكيد الحجز، تذكير، تسويق
- **تقارير مالية** — دخل، مصروفات، أرباح، ضريبة القيمة المضافة
- **إدارة مخزون** — تنبيهات نقص + طلب توريد تلقائي
- **برامج ولاء** — نقاط، بطاقات ختم، مستويات عملاء
- **CRM متقدم** — تصنيف عملاء، أتمتة تسويقية، حملات واتساب
- **PWA** — قابلة للتثبيت على الجوال بدون متجر تطبيقات

## التقنيات المستخدمة

| المكون | التقنية |
|--------|---------|
| الواجهة | React 18 + TypeScript + Vite + TailwindCSS |
| الخادم | Express.js + TypeScript + Node.js |
| قاعدة البيانات | PostgreSQL 16 + Drizzle ORM |
| الوقت الحقيقي | WebSocket (تتبع GPS) |
| المصادقة | Firebase OTP + JWT |
| المدفوعات | Moyasar (STC Pay, Mada, Apple Pay) |
| الإشعارات | WhatsApp Cloud API + Web Push (VAPID) |

## البدء السريع

### 1. تشغيل قاعدة البيانات
```bash
docker-compose up -d
```

### 2. إعداد المتغيرات البيئية
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
# عدّل القيم حسب بيئتك
```

### 3. تثبيت الحزم
```bash
cd server && npm install
cd ../client && npm install
```

### 4. إعداد قاعدة البيانات
```bash
cd server
DATABASE_URL=postgresql://carwash:carwash_password@localhost:5432/carwash npx drizzle-kit push
DATABASE_URL=postgresql://carwash:carwash_password@localhost:5432/carwash npx tsx db/seed.ts
```

### 5. تشغيل التطوير
```bash
# من المجلد الرئيسي
npm run dev
```

الموقع: http://localhost:5173
الخادم: http://localhost:3001

## بيانات الدخول الأولية

| الدور | رقم الجوال | كلمة المرور |
|-------|-----------|------------|
| أدمن | 0500000001 | Admin@123 |
| موظف | 0500000002 | Emp@123 |

## هيكل المشروع

```
car-wash-pwa/
├── server/                # Express.js + TypeScript + Drizzle ORM
│   ├── db/                # Schema (70+ جدول) + migrations + seed
│   ├── routes/            # 60+ API endpoint
│   ├── services/          # WhatsApp + Automation Engine
│   ├── middleware/         # Auth + Domain Detection + Audit
│   ├── lib/               # Crypto + Validation + Industries
│   └── tests/             # Vitest unit tests
├── client/                # React + Vite + TailwindCSS + PWA
│   └── src/
│       ├── pages/         # 50+ صفحة (Customer, Employee, Vendor, Admin, Super Admin)
│       ├── components/    # 30+ مكون قابل لإعادة الاستخدام
│       ├── hooks/         # Custom React hooks
│       ├── lib/           # API client + utilities
│       └── store/         # Zustand state management
└── docker-compose.yml     # PostgreSQL 16
```

## أدوار المستخدمين

| الدور | الوصف |
|-------|-------|
| `super_admin` | مدير المنصة — إدارة جميع المشاريع |
| `vendor_admin` | صاحب المشروع — لوحة تحكم كاملة |
| `admin` | مدير فرع — صلاحيات إدارية |
| `employee` | موظف — تنفيذ الحجوزات |
| `customer` | عميل — حجز وتتبع الخدمات |

## المتغيرات البيئية

### السيرفر (server/.env)

| المتغير | الوصف |
|---------|-------|
| `DATABASE_URL` | رابط PostgreSQL |
| `JWT_SECRET` | مفتاح JWT (32+ حرف) |
| `PORT` | منفذ السيرفر (افتراضي: 3001) |
| `CLIENT_URL` | رابط الواجهة للـ CORS |
| `DOMAIN` | الدومين الرئيسي (jdawil.sa) |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API token |
| `WHATSAPP_PHONE_ID` | معرف هاتف واتساب Business |
| `MOYASAR_API_KEY` | مفتاح Moyasar للمدفوعات |
| `VAPID_PUBLIC_KEY` | مفتاح Web Push العام |
| `VAPID_PRIVATE_KEY` | مفتاح Web Push الخاص |

### العميل (client/.env)

| المتغير | الوصف |
|---------|-------|
| `VITE_FIREBASE_*` | إعدادات Firebase للـ OTP |
| `VITE_VAPID_PUBLIC_KEY` | مفتاح Web Push العام |
| `VITE_API_URL` | رابط API (اختياري) |
