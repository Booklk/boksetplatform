/**
 * Bootstrap the very first super-admin account.
 *
 * Run via:
 *   docker compose exec api node scripts/create-super-admin.js
 *
 * Reads phone + name + password interactively (or from env in CI:
 * BOOTSTRAP_PHONE, BOOTSTRAP_NAME, BOOTSTRAP_PASSWORD). Refuses to run
 * if a super_admin already exists — to bootstrap a *second* admin, log
 * in as the first and create it from the super-admin UI.
 *
 * Password rules match the runtime onboard rule: 12+ chars of any
 * script, OR 8-11 chars with 2 of {digit, symbol, mixed-case}.
 */
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import readline from 'readline';

function normalizePhone(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, '');
  if (p.startsWith('+966')) p = '0' + p.slice(4);
  else if (p.startsWith('966')) p = '0' + p.slice(3);
  if (!p.startsWith('0')) p = '0' + p;
  return p;
}

function checkPassword(pw: string): string | null {
  if (pw.length < 8) return 'كلمة المرور قصيرة — 8 حرف على الأقل';
  if (pw.length < 12) {
    const hasDigit = /\d/.test(pw);
    const hasSymbol = /[^\p{L}\p{N}]/u.test(pw);
    const hasMixedCase = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
    const score = [hasDigit, hasSymbol, hasMixedCase].filter(Boolean).length;
    if (score < 2) return 'أضف رقم ورمز (! @ # ...) أو اجعلها 12 حرف فأكثر';
  }
  return null;
}

async function prompt(q: string, opts: { mask?: boolean } = {}): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  if (opts.mask) {
    process.stdout.write(q);
    // Disable terminal echo for the duration of this read.
    const stdin = process.stdin as NodeJS.ReadStream & { setRawMode?: (v: boolean) => void };
    if (stdin.setRawMode) stdin.setRawMode(true);
    return new Promise((resolve) => {
      let value = '';
      const onData = (chunk: Buffer) => {
        const s = chunk.toString();
        if (s === '\r' || s === '\n') {
          if (stdin.setRawMode) stdin.setRawMode(false);
          stdin.removeListener('data', onData);
          process.stdout.write('\n');
          rl.close();
          resolve(value);
          return;
        }
        if (s === '') { process.exit(0); } // Ctrl-C
        if (s === '' || s === '\b') {
          value = value.slice(0, -1);
          return;
        }
        value += s;
      };
      stdin.on('data', onData);
    });
  }
  return new Promise((resolve) => rl.question(q, (a) => { rl.close(); resolve(a); }));
}

async function main() {
  // Refuse if a super_admin already exists.
  const [existing] = await db.select({ id: users.id })
    .from(users).where(eq(users.role, 'super_admin')).limit(1);
  if (existing) {
    console.log('⚠️  super_admin already exists. Bootstrap is a one-shot —');
    console.log('   create additional admins from the super-admin UI.');
    process.exit(0);
  }

  console.log('\n🛡  Creating the first super-admin for Jdawil.\n');

  const rawName     = process.env.BOOTSTRAP_NAME     || await prompt('الاسم: ');
  const rawPhone    = process.env.BOOTSTRAP_PHONE    || await prompt('رقم الجوال (05xxxxxxxx): ');
  const rawPassword = process.env.BOOTSTRAP_PASSWORD || await prompt('كلمة المرور: ', { mask: true });

  const name = rawName.trim();
  const phone = normalizePhone(rawPhone.trim());

  if (name.length < 2) { console.error('❌ الاسم قصير'); process.exit(1); }
  if (!/^05\d{8}$/.test(phone)) { console.error('❌ رقم الجوال غير صالح'); process.exit(1); }
  const pwErr = checkPassword(rawPassword);
  if (pwErr) { console.error(`❌ ${pwErr}`); process.exit(1); }

  // If a user already exists with this phone (e.g. OTP placeholder),
  // upgrade it in place. Otherwise create.
  const [placeholder] = await db.select().from(users)
    .where(and(eq(users.phone, phone))).limit(1);

  const passwordHash = await bcrypt.hash(rawPassword, 12);

  if (placeholder) {
    await db.update(users).set({
      name, passwordHash, role: 'super_admin',
      vendorId: null, isActive: true, phoneVerified: true,
      otpCode: null, otpExpiresAt: null, updatedAt: new Date(),
    }).where(eq(users.id, placeholder.id));
    console.log(`\n✅ super_admin user upgraded (id=${placeholder.id})`);
  } else {
    const [created] = await db.insert(users).values({
      name, phone, passwordHash,
      role: 'super_admin', isActive: true, phoneVerified: true,
    }).returning({ id: users.id });
    console.log(`\n✅ super_admin user created (id=${created.id})`);
  }

  console.log(`   اسم: ${name}`);
  console.log(`   جوال: ${phone}`);
  console.log(`\n   تسجيل الدخول:  ${process.env.BASE_URL ?? 'https://jdawil.sa'}/super-admin/login\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
