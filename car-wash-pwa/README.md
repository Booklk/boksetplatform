# مغسلة ساعة الرذاذ للسيارات 🚗💧

نظام حجز متكامل لمغسلة سيارات متنقلة تخدم شمال الرياض.

## المناطق المخدومة
حي الياسمين، الملقا، الصحافة، العقيق، الندى، النرجس، العارض، حطين، الوادي، الغدير، الربيع

## المميزات
- **Landing Page** عربية RTL احترافية مع الخدمات والأسعار
- **PWA** قابلة للتثبيت على الجوال
- **3 أدوار**: أدمن، موظف، عميل
- **Firebase OTP** للمصادقة
- **إشعارات واتساب** للعملاء
- **خرائط تفاعلية** لتحديد الموقع
- **تقارير مالية** (دخل، مصروفات، رواتب، صيانة)
- **إدارة مخزون** مع تنبيهات نقص المواد

## البدء السريع

### 1. تشغيل قاعدة البيانات
```bash
docker-compose up -d
```

### 2. إعداد المتغيرات البيئية للسيرفر
```bash
cp server/.env.example server/.env
# عدّل DATABASE_URL و JWT_SECRET وبيانات واتساب
```

### 3. إعداد المتغيرات البيئية للعميل
```bash
cp client/.env.example client/.env
# أضف مفاتيح Firebase
```

### 4. تثبيت الحزم
```bash
cd server && npm install
cd ../client && npm install
```

### 5. إعداد قاعدة البيانات
```bash
cd server && DATABASE_URL=postgresql://carwash:carwash_password@localhost:5432/carwash npx drizzle-kit push
DATABASE_URL=postgresql://carwash:carwash_password@localhost:5432/carwash npx tsx db/seed.ts
```

### 6. تشغيل التطوير
```bash
# في نافذة 1: السيرفر
cd server && npm run dev

# في نافذة 2: الواجهة
cd client && npm run dev
```

الموقع: http://localhost:5173

## بيانات الدخول الأولية (من الـ seed)
- **الأدمن**: 0500000001 / Admin@123
- **الموظف**: 0500000002 / Emp@123

## متغيرات البيئة

### السيرفر (server/.env)
| المتغير | الوصف |
|---------|-------|
| `DATABASE_URL` | رابط قاعدة البيانات PostgreSQL |
| `JWT_SECRET` | مفتاح سري للـ JWT (32+ حرف) |
| `PORT` | منفذ السيرفر (افتراضي: 3001) |
| `CLIENT_URL` | رابط الواجهة للـ CORS |
| `WHATSAPP_TOKEN` | Meta WhatsApp Cloud API token |
| `WHATSAPP_PHONE_ID` | رقم هاتف واتساب Business |

### العميل (client/.env)
| المتغير | الوصف |
|---------|-------|
| `VITE_FIREBASE_*` | إعدادات Firebase للـ OTP |

## هيكل المشروع
```
car-wash-pwa/
├── server/          # Express.js + TypeScript + Drizzle ORM
│   ├── db/          # Schema + migrations + seed
│   ├── routes/      # API endpoints
│   ├── services/    # WhatsApp notifications
│   └── middleware/  # Auth + role guards
├── client/          # React + Vite + TailwindCSS + PWA
│   └── src/
│       ├── pages/   # Customer, Employee, Admin, Auth, Landing
│       └── components/
└── docker-compose.yml
```
