import 'dotenv/config';
import { db } from './index.js';
import { users, vendors, services, packages, inventory } from './schema.js';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';

async function seed() {
  console.log('🌱 Seeding database...');

  // Create demo vendor
  const [vendor] = await db.insert(vendors).values({
    nameAr: 'مغسلة النجوم',
    slug: 'al-nujoom',
    phone: '0500000001',
    subscriptionStatus: 'trial',
    subscriptionPlan: 'basic',
    isActive: true,
  }).returning().onConflictDoNothing();

  const vendorId = vendor?.id;
  if (!vendorId) {
    // Already seeded — get existing vendor
    const [existing] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, 'al-nujoom')).limit(1);
    if (!existing) { console.log('Seed aborted — no vendor'); process.exit(1); }
    await seedWithVendor(existing.id);
    return;
  }

  await seedWithVendor(vendorId);
}

async function seedWithVendor(vendorId: number) {
  // Super Admin (platform owner — separate login)
  const superAdminHash = await bcrypt.hash('Super@123', 12);
  await db.insert(users).values({
    name: 'مدير المنصة',
    phone: '0599999999',
    email: 'admin@jdawil.sa',
    passwordHash: superAdminHash,
    role: 'super_admin',
    vendorId: null,
  }).onConflictDoNothing();
  console.log('  ✅ Super Admin: admin@jdawil.sa / Super@123');

  // Vendor Admin user
  const adminHash = await bcrypt.hash('Admin@123', 12);
  await db.insert(users).values([
    {
      name: 'مدير النظام',
      phone: '0500000001',
      email: 'vendor@jdawil.sa',
      passwordHash: adminHash,
      role: 'admin',
      vendorId,
    },
    {
      name: 'أحمد الموظف',
      phone: '0500000002',
      passwordHash: await bcrypt.hash('Emp@123', 12),
      role: 'employee',
      vendorId,
    },
  ]).onConflictDoNothing();

  // Services
  const [svc1, svc2, svc3] = await db.insert(services).values([
    { vendorId, name: 'غسيل خارجي', description: 'تنظيف شامل للهيكل الخارجي للسيارة بأفضل المواد', sortOrder: 1 },
    { vendorId, name: 'غسيل داخلي وخارجي', description: 'تنظيف كامل للسيارة من الداخل والخارج', sortOrder: 2 },
    { vendorId, name: 'تلميع وتشميع', description: 'تلميع احترافي مع طبقة حماية من الشمع', sortOrder: 3 },
  ]).returning().onConflictDoNothing();

  if (svc1) {
    await db.insert(packages).values([
      { vendorId, serviceId: svc1.id, name: 'أساسي', price: '25.00', duration: 30, features: ['غسيل خارجي', 'تجفيف', 'تلميع زجاج'], sortOrder: 1 },
      { vendorId, serviceId: svc1.id, name: 'مميز', price: '45.00', duration: 45, features: ['غسيل خارجي', 'تجفيف', 'تلميع زجاج', 'تنظيف إطارات', 'ماء عطري'], sortOrder: 2 },
    ]).onConflictDoNothing();
  }

  if (svc2) {
    await db.insert(packages).values([
      { vendorId, serviceId: svc2.id, name: 'شامل', price: '80.00', duration: 90, features: ['غسيل خارجي', 'تنظيف داخلي', 'شفط غبار', 'تعطير', 'تلميع زجاج', 'تنظيف إطارات'], sortOrder: 1 },
      { vendorId, serviceId: svc2.id, name: 'VIP', price: '150.00', duration: 150, features: ['كل خدمات الشامل', 'تنظيف محرك', 'تلميع داخلي', 'معطر فاخر', 'حماية جلد'], sortOrder: 2 },
    ]).onConflictDoNothing();
  }

  if (svc3) {
    await db.insert(packages).values([
      { vendorId, serviceId: svc3.id, name: 'تلميع عادي', price: '60.00', duration: 60, features: ['تلميع كامل', 'طبقة شمع', 'حماية طلاء'], sortOrder: 1 },
    ]).onConflictDoNothing();
  }

  // Inventory items
  await db.insert(inventory).values([
    { vendorId, name: 'شامبو سيارات', unit: 'لتر', quantity: '20', minQuantity: '5', costPerUnit: '15' },
    { vendorId, name: 'مادة تلميع', unit: 'لتر', quantity: '10', minQuantity: '3', costPerUnit: '35' },
    { vendorId, name: 'شمع حماية', unit: 'كيلو', quantity: '8', minQuantity: '2', costPerUnit: '45' },
    { vendorId, name: 'مناشف ميكروفايبر', unit: 'قطعة', quantity: '50', minQuantity: '15', costPerUnit: '8' },
    { vendorId, name: 'معطر داخلي', unit: 'لتر', quantity: '15', minQuantity: '5', costPerUnit: '20' },
    { vendorId, name: 'منظف إطارات', unit: 'لتر', quantity: '12', minQuantity: '4', costPerUnit: '18' },
  ]).onConflictDoNothing();

  console.log('✅ Seed complete!');
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
