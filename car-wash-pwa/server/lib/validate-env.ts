/**
 * Validate required environment variables on startup.
 * Call this BEFORE any other initialization.
 *
 * Production rules are stricter than dev: anything that would silently
 * skip (OTP via WhatsApp, payment webhooks, etc.) is hard-required so
 * we fail fast at boot instead of "succeeding" while half the platform
 * is broken in subtle ways.
 */
export function validateEnv() {
  const isProd = process.env.NODE_ENV === 'production';

  const required: Array<{ key: string; label: string }> = [
    { key: 'DATABASE_URL', label: 'رابط قاعدة البيانات' },
    { key: 'JWT_SECRET', label: 'مفتاح JWT' },
  ];

  // Production-only hard requirements
  if (isProd) {
    required.push(
      { key: 'ENCRYPTION_KEY',          label: 'مفتاح التشفير (إنتاج)' },
      // OTP + password reset go via platform WhatsApp — without these,
      // signup is broken silently in dev mode but only printed to logs.
      { key: 'WHATSAPP_TOKEN',          label: 'توكن واتساب (للـ OTP)' },
      { key: 'WHATSAPP_PHONE_ID',       label: 'معرف هاتف واتساب' },
      // Platform subscription webhooks must be HMAC-verified in prod.
      // Skipping verification in prod is a SECURITY hole, not a soft warn.
      { key: 'MOYASAR_WEBHOOK_SECRET',  label: 'سر ويبهوك Moyasar (إلزامي بالإنتاج)' },
    );
  }

  const recommended: Array<{ key: string; label: string; fallback: string }> = [
    { key: 'PORT',         label: 'رقم المنفذ',     fallback: '3001' },
    { key: 'CLIENT_URL',   label: 'رابط الواجهة',   fallback: 'http://localhost:5173' },
    { key: 'BASE_URL',     label: 'رابط الباك إند', fallback: 'http://localhost:3001' },
    { key: 'DOMAIN',       label: 'الدومين',        fallback: 'jadawel.sa' },
    ...(!isProd ? [
      { key: 'ENCRYPTION_KEY',         label: 'مفتاح التشفير',           fallback: 'dev-only' },
      { key: 'WHATSAPP_TOKEN',         label: 'توكن واتساب',             fallback: 'console fallback' },
      { key: 'WHATSAPP_PHONE_ID',      label: 'معرف هاتف واتساب',        fallback: 'console fallback' },
      { key: 'MOYASAR_WEBHOOK_SECRET', label: 'سر ويبهوك Moyasar',       fallback: 'verification skipped' },
    ] : []),
    { key: 'MOYASAR_API_KEY',  label: 'مفتاح Moyasar للاشتراكات', fallback: 'platform subscriptions disabled' },
    { key: 'OPENAI_API_KEY',   label: 'مفتاح OpenAI (Copilot)',   fallback: 'AI features disabled' },
    { key: 'VAPID_PUBLIC_KEY', label: 'مفتاح Web Push العام',     fallback: 'push notifications disabled' },
    { key: 'VAPID_PRIVATE_KEY', label: 'مفتاح Web Push الخاص',    fallback: 'push notifications disabled' },
    { key: 'SENTRY_DSN',       label: 'Sentry DSN',                fallback: 'error tracking disabled' },
  ];

  const errors: string[] = [];
  const warnings: string[] = [];

  for (const v of required) {
    if (!process.env[v.key]) {
      errors.push(`❌ ${v.key} (${v.label}) — مطلوب`);
    }
  }

  // JWT_SECRET minimum length check
  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 32) {
    errors.push(`❌ JWT_SECRET — يجب أن يكون 32 حرف على الأقل (حالياً: ${jwtSecret.length})`);
  }

  // ENCRYPTION_KEY shape check in prod — must be 64 hex chars (32 bytes
  // strict). UTF-8 fallback in crypto.ts is dev-only; allowing weak keys
  // in prod silently encrypts vendor secrets with low entropy.
  if (isProd) {
    const enc = process.env.ENCRYPTION_KEY ?? '';
    if (enc && !/^[0-9a-fA-F]{64}$/.test(enc)) {
      errors.push('❌ ENCRYPTION_KEY — يجب أن يكون 64 حرف hex بالضبط في الإنتاج. ولّده بـ: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    }
    if (enc && /change_this|default|example|test/i.test(enc)) {
      errors.push('❌ ENCRYPTION_KEY — تستخدم قيمة افتراضية. غيّرها قبل الإطلاق.');
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
    console.error('\n🚫 متغيرات البيئة المطلوبة مفقودة أو غير صالحة:');
    errors.forEach(e => console.error(`   ${e}`));
    console.error('\n📄 انسخ .env.example إلى .env وعبّي القيم المطلوبة\n');
    if (isProd) {
      process.exit(1);
    }
  }

  console.log(`\n✅ فحص البيئة: ${errors.length === 0 ? 'ناجح' : `${errors.length} أخطاء`}\n`);
}
