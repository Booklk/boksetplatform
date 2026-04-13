/**
 * Validate required environment variables on startup.
 * Call this BEFORE any other initialization.
 */
export function validateEnv() {
  const required: Array<{ key: string; label: string; critical: boolean }> = [
    { key: 'DATABASE_URL', label: 'رابط قاعدة البيانات', critical: true },
    { key: 'JWT_SECRET', label: 'مفتاح JWT', critical: true },
  ];

  const recommended: Array<{ key: string; label: string; fallback: string }> = [
    { key: 'PORT', label: 'رقم المنفذ', fallback: '3001' },
    { key: 'CLIENT_URL', label: 'رابط الواجهة', fallback: 'http://localhost:5173' },
    { key: 'DOMAIN', label: 'الدومين', fallback: 'washsaas.com' },
    { key: 'ENCRYPTION_KEY', label: 'مفتاح التشفير', fallback: 'dev-only' },
    { key: 'WHATSAPP_TOKEN', label: 'توكن واتساب', fallback: 'not set' },
    { key: 'WHATSAPP_PHONE_ID', label: 'معرف هاتف واتساب', fallback: 'not set' },
    { key: 'MOYASAR_API_KEY', label: 'مفتاح Moyasar', fallback: 'not set' },
  ];

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const v of required) {
    if (!process.env[v.key]) {
      errors.push(`❌ ${v.key} (${v.label}) — مطلوب`);
    }
  }

  for (const v of recommended) {
    if (!process.env[v.key]) {
      warnings.push(`⚠️  ${v.key} (${v.label}) — غير موجود، سيتم استخدام: ${v.fallback}`);
    }
  }

  if (warnings.length > 0) {
    console.log('\n🔧 متغيرات البيئة المفقودة (اختيارية):');
    warnings.forEach(w => console.log(`   ${w}`));
  }

  if (errors.length > 0) {
    console.error('\n🚫 متغيرات البيئة المطلوبة مفقودة:');
    errors.forEach(e => console.error(`   ${e}`));
    console.error('\n📄 انسخ .env.example إلى .env وعبّي القيم المطلوبة\n');
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  }

  console.log(`\n✅ فحص البيئة: ${errors.length === 0 ? 'ناجح' : `${errors.length} أخطاء`}\n`);
}
