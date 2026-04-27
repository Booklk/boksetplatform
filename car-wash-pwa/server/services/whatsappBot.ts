/**
 * WhatsApp Auto-Reply Bot — keyword + state machine, no LLM cost.
 *
 * Inbound message → detect intent → reply with quick replies / list / text.
 * The bot can:
 *   - greet / show menu
 *   - list services + prices
 *   - show working hours / location
 *   - run a guided booking flow (service → date → time → confirm)
 *   - hand off to the vendor when stuck or asked
 *
 * State per phone number is stored in whatsapp_sessions.context as
 * { stage, vendorId, pickedServiceId, pickedDate, pickedTime, ... }.
 */
import { db } from '../db/index.js';
import {
  vendors, services as servicesTable, packages, whatsappSessions, bookings,
  users, customers,
} from '../db/schema.js';
import { eq, and, gte, lt } from 'drizzle-orm';
import { randomBytes } from 'crypto';
import {
  sendRawWhatsAppMessage, sendInteractiveButtons, sendInteractiveList,
} from './whatsapp.js';

interface BotSettings {
  enabled?: boolean;
  greeting?: string;
  handoffKeywords?: string[];
  // Governance — vendor-controlled limits
  canBook?: boolean;
  canApplyPromo?: boolean;
  maxBookingValue?: number;
  dailyBookingLimit?: number;
  activeHours?: { start?: string; end?: string };
}

interface BotContext {
  stage?: 'idle' | 'menu' | 'selecting_service' | 'selecting_time' | 'confirming';
  pickedPackageId?: number;
  pickedPackageName?: string;
  pickedPackagePrice?: string;
  pickedDate?: string;
  pickedTime?: string;
}

const HANDOFF_DEFAULT = ['موظف', 'انسان', 'انسانه', 'شكوى', 'شخص حقيقي'];

interface VendorSlim {
  id: number;
  nameAr: string;
  slug: string;
  phone: string | null;
  city: string | null;
  address: string | null;
  settings: Record<string, unknown> | null;
}

async function loadVendor(vendorId: number): Promise<VendorSlim | null> {
  const [v] = await db.select({
    id: vendors.id, nameAr: vendors.nameAr, slug: vendors.slug,
    phone: vendors.phone, city: vendors.city, address: vendors.address,
    settings: vendors.settings,
  }).from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  return v ?? null;
}

function botSettings(v: VendorSlim): BotSettings {
  return ((v.settings ?? {}) as { bot?: BotSettings }).bot ?? {};
}

function workingHours(v: VendorSlim): { start: string; end: string; days: number[] } {
  const wh = ((v.settings ?? {}) as { workingHours?: { start?: string; end?: string; days?: number[] } }).workingHours;
  return {
    start: wh?.start ?? '09:00',
    end: wh?.end ?? '22:00',
    days: wh?.days ?? [0, 1, 2, 3, 4, 6],
  };
}

// ─── Intent detection ───────────────────────────────────────────────────────

type Intent =
  | 'greeting'
  | 'menu'
  | 'prices'
  | 'hours'
  | 'location'
  | 'book'
  | 'help'
  | 'handoff'
  | 'unknown';

function detectIntent(text: string, customHandoff: string[] = []): Intent {
  const t = text.trim().toLowerCase();

  if (/^(السلام|سلام|مرحبا|اهلا|أهلاً|هلا|hi|hello)/i.test(t)) return 'greeting';
  if (/(قائمة|قايمة|ايش عندكم|وش عندكم|الخدمات|menu)/i.test(t)) return 'menu';
  if (/(سعر|اسعار|الأسعار|كم|ريال|تكلف|كم كلفه)/i.test(t)) return 'prices';
  if (/(متى|وقت|تفتحون|دوام|ساعات|hours)/i.test(t)) return 'hours';
  if (/(موقع|عنوان|وين|اين|location|map)/i.test(t)) return 'location';
  if (/(احجز|حجز|موعد|book|appointment)/i.test(t)) return 'book';
  if (/(مساعدة|help|ساعدني)/i.test(t)) return 'help';

  const handoffWords = [...HANDOFF_DEFAULT, ...customHandoff];
  if (handoffWords.some((w) => t.includes(w))) return 'handoff';

  return 'unknown';
}

// ─── Session helpers ────────────────────────────────────────────────────────

async function getOrCreateSession(phone: string, vendorId: number): Promise<{ context: BotContext }> {
  const [existing] = await db.select().from(whatsappSessions)
    .where(eq(whatsappSessions.phone, phone)).limit(1);
  if (existing) {
    return { context: (existing.context ?? {}) as BotContext };
  }
  await db.insert(whatsappSessions).values({
    phone, vendorId, state: 'idle', context: {},
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  }).onConflictDoNothing();
  return { context: {} };
}

async function updateContext(phone: string, vendorId: number, context: BotContext): Promise<void> {
  await db.update(whatsappSessions)
    .set({
      vendorId, context: context as Record<string, unknown>, lastMessageAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    })
    .where(eq(whatsappSessions.phone, phone));
}

// ─── Reply helpers ──────────────────────────────────────────────────────────

async function sendMenu(toPhone: string, vendor: VendorSlim) {
  const greeting = botSettings(vendor).greeting
    ?? `أهلاً بك في *${vendor.nameAr}*\n\nأنا المساعد الآلي. أقدر أعطيك الأسعار، الأوقات المتاحة، وأحجز لك مباشرة.`;
  await sendInteractiveButtons(
    toPhone,
    greeting,
    [
      { id: 'menu:prices',   title: '🛒 الخدمات والأسعار' },
      { id: 'menu:book',     title: '📅 احجز موعد' },
      { id: 'menu:handoff',  title: '👤 موظف' },
    ],
    vendor.id,
  );
}

async function sendPrices(toPhone: string, vendor: VendorSlim) {
  const list = await db
    .select({
      id: packages.id, name: packages.name, price: packages.price, duration: packages.duration,
      serviceName: servicesTable.name,
    })
    .from(packages)
    .leftJoin(servicesTable, eq(packages.serviceId, servicesTable.id))
    .where(and(eq(packages.vendorId, vendor.id), eq(packages.isActive, true)))
    .limit(10);

  if (list.length === 0) {
    await sendRawWhatsAppMessage(toPhone, 'لم يتم إضافة خدمات بعد. سأبلغ التاجر للتواصل معك.', vendor.id);
    return;
  }

  const body = `أهم خدماتنا:\n\n${list
    .map((p) => `• *${p.serviceName ?? ''} — ${p.name}* — ${parseInt(String(p.price ?? '0'))} ر.س`)
    .join('\n')}`;
  await sendInteractiveButtons(
    toPhone,
    body,
    [{ id: 'menu:book', title: '📅 احجز الآن' }, { id: 'menu:handoff', title: '👤 موظف' }],
    vendor.id,
  );
}

async function sendHours(toPhone: string, vendor: VendorSlim) {
  const wh = workingHours(vendor);
  const days = ['الأحد','الاثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
  const open = wh.days.map((d) => days[d]).join('، ');
  await sendRawWhatsAppMessage(
    toPhone,
    `ساعات العمل:\n${wh.start} – ${wh.end}\nالأيام: ${open}`,
    vendor.id,
  );
}

async function sendLocation(toPhone: string, vendor: VendorSlim) {
  const txt = vendor.address
    ? `موقعنا: ${vendor.address}${vendor.city ? `، ${vendor.city}` : ''}`
    : 'لم يتم تحديد موقع للمتجر بعد. سيقوم التاجر بالتواصل معك.';
  await sendRawWhatsAppMessage(toPhone, txt, vendor.id);
}

function isWithinActiveHours(s: BotSettings): boolean {
  const ah = s.activeHours;
  if (!ah?.start || !ah?.end) return true;
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = ah.start.split(':').map(Number);
  const [eh, em] = ah.end.split(':').map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  return start <= end ? cur >= start && cur <= end : cur >= start || cur <= end;
}

async function todaysBotBookingCount(vendorId: number): Promise<number> {
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(); endOfDay.setHours(23, 59, 59, 999);
  const rows = await db.select({ id: bookings.id })
    .from(bookings)
    .where(and(
      eq(bookings.vendorId, vendorId),
      eq(bookings.utmSource, 'whatsapp_bot'),
      gte(bookings.createdAt, startOfDay),
      lt(bookings.createdAt, endOfDay),
    ));
  return rows.length;
}

async function startBookingFlow(toPhone: string, vendor: VendorSlim, context: BotContext) {
  const settings = botSettings(vendor);

  // Governance: bot is not allowed to create bookings
  if (settings.canBook === false) {
    await sendInteractiveButtons(
      toPhone,
      `نتشرف بحجزك في *${vendor.nameAr}*\n\nسأحوّل طلبك للتاجر مباشرة، سيتواصل معك بأقرب وقت لتأكيد الموعد.`,
      [{ id: 'menu:handoff', title: '✅ تابع' }, { id: 'menu:prices', title: '🛒 تصفّح' }],
      vendor.id,
    );
    await handoff(toPhone, vendor);
    return;
  }

  // Governance: outside active hours → handoff
  if (!isWithinActiveHours(settings)) {
    const ah = settings.activeHours!;
    await sendRawWhatsAppMessage(
      toPhone,
      `البوت متاح بين ${ah.start} – ${ah.end}.\nسأحوّل طلبك للتاجر، وسيتواصل معك في أقرب وقت ضمن ساعات العمل.`,
      vendor.id,
    );
    await handoff(toPhone, vendor);
    return;
  }

  // Governance: daily booking limit reached → handoff
  if (settings.dailyBookingLimit && settings.dailyBookingLimit > 0) {
    const todayCount = await todaysBotBookingCount(vendor.id);
    if (todayCount >= settings.dailyBookingLimit) {
      await sendRawWhatsAppMessage(
        toPhone,
        `وصلنا للحد اليومي للحجوزات الآلية. سأحوّل طلبك للتاجر مباشرة.`,
        vendor.id,
      );
      await handoff(toPhone, vendor);
      return;
    }
  }

  const list = await db
    .select({
      id: packages.id, name: packages.name, price: packages.price,
      serviceName: servicesTable.name,
    })
    .from(packages)
    .leftJoin(servicesTable, eq(packages.serviceId, servicesTable.id))
    .where(and(eq(packages.vendorId, vendor.id), eq(packages.isActive, true)))
    .limit(10);

  // Filter by maxBookingValue
  const filtered = settings.maxBookingValue
    ? list.filter((p) => parseFloat(String(p.price ?? '0')) <= (settings.maxBookingValue ?? Infinity))
    : list;

  if (filtered.length === 0) {
    await sendRawWhatsAppMessage(toPhone, 'لا توجد خدمات متاحة ضمن نطاق الحجز التلقائي. سأحوّل طلبك للتاجر.', vendor.id);
    await handoff(toPhone, vendor);
    return;
  }

  await sendInteractiveList(
    toPhone,
    'اختر الخدمة التي تريد حجزها:',
    'اختر',
    filtered.map((p) => ({
      id: `pkg:${p.id}`,
      title: p.name.slice(0, 24),
      description: `${p.serviceName ?? ''} — ${parseInt(String(p.price ?? '0'))} ر.س`,
    })),
    vendor.id,
    'حجز موعد',
  );

  context.stage = 'selecting_service';
  await updateContext(toPhone, vendor.id, context);
}

async function presentTimeSlots(
  toPhone: string, vendor: VendorSlim, packageId: number, context: BotContext,
) {
  const [pkg] = await db.select({
    id: packages.id, name: packages.name, price: packages.price,
    serviceName: servicesTable.name,
  })
    .from(packages)
    .leftJoin(servicesTable, eq(packages.serviceId, servicesTable.id))
    .where(eq(packages.id, packageId)).limit(1);
  if (!pkg) {
    await sendRawWhatsAppMessage(toPhone, 'الخدمة غير متاحة.', vendor.id);
    return;
  }

  // Suggest 3 simple slots: today afternoon, tomorrow morning, tomorrow afternoon
  const wh = workingHours(vendor);
  const now = new Date();
  const todayAfternoon = new Date(now);
  todayAfternoon.setHours(16, 0, 0, 0);
  const tomMorning = new Date(now); tomMorning.setDate(tomMorning.getDate() + 1); tomMorning.setHours(11, 0, 0, 0);
  const tomEvening = new Date(now); tomEvening.setDate(tomEvening.getDate() + 1); tomEvening.setHours(18, 0, 0, 0);

  const slots = [todayAfternoon, tomMorning, tomEvening].filter((d) => d > now);
  const labels = slots.map((d) => ({
    iso: d.toISOString(),
    label: d.toLocaleString('ar-SA', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
  }));

  context.pickedPackageId = pkg.id;
  context.pickedPackageName = `${pkg.serviceName ?? ''} — ${pkg.name}`;
  context.pickedPackagePrice = String(pkg.price ?? '');
  context.stage = 'selecting_time';
  await updateContext(toPhone, vendor.id, context);

  await sendInteractiveButtons(
    toPhone,
    `اخترت: *${pkg.name}*\nمتى يناسبك؟\n_(ساعات الدوام: ${wh.start} – ${wh.end})_`,
    labels.map((s, i) => ({ id: `slot:${s.iso}`, title: s.label })).slice(0, 3),
    vendor.id,
  );
}

async function confirmBooking(
  toPhone: string, vendor: VendorSlim, isoDate: string, context: BotContext,
) {
  if (!context.pickedPackageId) {
    await sendMenu(toPhone, vendor);
    return;
  }
  const when = new Date(isoDate);
  context.pickedDate = isoDate;
  context.pickedTime = when.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
  context.stage = 'confirming';
  await updateContext(toPhone, vendor.id, context);

  const dateStr = when.toLocaleDateString('ar-SA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  await sendInteractiveButtons(
    toPhone,
    `لتأكيد الحجز:\n\n📦 ${context.pickedPackageName}\n📅 ${dateStr}\n⏰ ${context.pickedTime}\n💰 ${parseInt(context.pickedPackagePrice ?? '0')} ر.س\n\nاضغط تأكيد لإتمام الحجز.`,
    [
      { id: 'confirm:yes', title: '✅ تأكيد' },
      { id: 'confirm:no',  title: '❌ إلغاء' },
    ],
    vendor.id,
  );
}

async function commitBooking(
  toPhone: string, vendor: VendorSlim, context: BotContext,
): Promise<void> {
  if (!context.pickedPackageId || !context.pickedDate) return;
  const settings = botSettings(vendor);

  // Re-check governance at commit time (settings may have changed mid-conversation)
  if (settings.canBook === false) {
    await sendRawWhatsAppMessage(toPhone, 'الحجز يحتاج تأكيد التاجر — سأحوّل المحادثة الآن.', vendor.id);
    await handoff(toPhone, vendor);
    return;
  }
  const price = parseFloat(context.pickedPackagePrice ?? '0');
  if (settings.maxBookingValue && price > settings.maxBookingValue) {
    await sendRawWhatsAppMessage(toPhone, 'هذه الخدمة تتطلب موافقة التاجر بسبب قيمتها — سأحوّل المحادثة لتأكيدها.', vendor.id);
    await handoff(toPhone, vendor);
    return;
  }
  if (settings.dailyBookingLimit && settings.dailyBookingLimit > 0) {
    const todayCount = await todaysBotBookingCount(vendor.id);
    if (todayCount >= settings.dailyBookingLimit) {
      await sendRawWhatsAppMessage(toPhone, 'وصلنا الحد اليومي — سأحوّل التأكيد للتاجر.', vendor.id);
      await handoff(toPhone, vendor);
      return;
    }
  }

  // Find or create user by phone (customer)
  const phone = '0' + toPhone.replace(/^966/, '');
  let [user] = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
  if (!user) {
    [user] = await db.insert(users).values({
      name: 'عميل واتساب', phone, role: 'customer',
    }).returning();
  }
  // Ensure customer record for this vendor
  const existing = await db.select({ id: customers.id })
    .from(customers)
    .where(and(eq(customers.userId, user.id), eq(customers.vendorId, vendor.id)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(customers).values({ userId: user.id, vendorId: vendor.id });
  }

  const bookingNumber = `RZ-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
  const trackingToken = randomBytes(24).toString('hex');

  const [booking] = await db.insert(bookings).values({
    bookingNumber,
    vendorId: vendor.id,
    customerId: user.id,
    packageId: context.pickedPackageId,
    scheduledAt: new Date(context.pickedDate),
    address: vendor.address ?? '',
    totalPrice: context.pickedPackagePrice ?? '0',
    status: 'confirmed',
    statusHistory: [{ status: 'confirmed', at: new Date().toISOString(), by: user.id }],
    trackingToken,
    notes: 'حجز عبر بوت واتساب',
    utmSource: 'whatsapp_bot',
  }).returning();

  context.stage = 'idle';
  await updateContext(toPhone, vendor.id, context);

  await sendRawWhatsAppMessage(
    toPhone,
    `✅ تم تأكيد الحجز\n\n📋 رقم الحجز: #${booking.bookingNumber}\n📦 ${context.pickedPackageName}\n📅 ${new Date(context.pickedDate).toLocaleString('ar-SA')}\n💰 ${parseInt(context.pickedPackagePrice ?? '0')} ر.س\n\nشكراً لاختيارك ${vendor.nameAr} 💙`,
    vendor.id,
  );
}

async function handoff(toPhone: string, vendor: VendorSlim) {
  await sendRawWhatsAppMessage(
    toPhone,
    `سأحوّل محادثتك للتاجر — سيتواصل معك في أقرب وقت.`,
    vendor.id,
  );
  // Notify vendor's owner phone if available
  if (vendor.phone) {
    await sendRawWhatsAppMessage(
      vendor.phone,
      `🔔 طلب تواصل من +${toPhone}\nيحتاج رد بشري — افتح المحادثة في واتساب.`,
      vendor.id,
    ).catch(() => {});
  }
}

// ─── Main entry: process incoming message ───────────────────────────────────

interface IncomingMessage {
  fromPhone: string;
  text: string;
  buttonId?: string;
  listSelection?: string;
}

export async function processIncomingMessage(
  vendorId: number,
  msg: IncomingMessage,
): Promise<void> {
  const vendor = await loadVendor(vendorId);
  if (!vendor) return;
  const settings = botSettings(vendor);
  if (settings.enabled === false) return;

  const session = await getOrCreateSession(msg.fromPhone, vendorId);
  const context = session.context;

  // Interactive replies (button or list selection) take priority
  const action = msg.buttonId ?? msg.listSelection;
  if (action) {
    if (action === 'menu:prices') return void await sendPrices(msg.fromPhone, vendor);
    if (action === 'menu:hours')  return void await sendHours(msg.fromPhone, vendor);
    if (action === 'menu:location') return void await sendLocation(msg.fromPhone, vendor);
    if (action === 'menu:book')  return void await startBookingFlow(msg.fromPhone, vendor, context);
    if (action === 'menu:handoff') return void await handoff(msg.fromPhone, vendor);
    if (action.startsWith('pkg:')) {
      const pkgId = Number(action.slice(4));
      return void await presentTimeSlots(msg.fromPhone, vendor, pkgId, context);
    }
    if (action.startsWith('slot:')) {
      const iso = action.slice(5);
      return void await confirmBooking(msg.fromPhone, vendor, iso, context);
    }
    if (action === 'confirm:yes') return void await commitBooking(msg.fromPhone, vendor, context);
    if (action === 'confirm:no') {
      context.stage = 'idle';
      await updateContext(msg.fromPhone, vendorId, context);
      return void await sendRawWhatsAppMessage(msg.fromPhone, 'تم الإلغاء. لو احتجت أي شي اكتب "قائمة".', vendorId);
    }
  }

  // Otherwise classify free text
  const intent = detectIntent(msg.text, settings.handoffKeywords);

  switch (intent) {
    case 'greeting':
    case 'menu':
      return void await sendMenu(msg.fromPhone, vendor);
    case 'prices':
      return void await sendPrices(msg.fromPhone, vendor);
    case 'hours':
      return void await sendHours(msg.fromPhone, vendor);
    case 'location':
      return void await sendLocation(msg.fromPhone, vendor);
    case 'book':
      return void await startBookingFlow(msg.fromPhone, vendor, context);
    case 'help':
      return void await sendMenu(msg.fromPhone, vendor);
    case 'handoff':
      return void await handoff(msg.fromPhone, vendor);
    default:
      return void await sendInteractiveButtons(
        msg.fromPhone,
        'لم أفهم طلبك تماماً. اختر من القائمة:',
        [
          { id: 'menu:prices', title: '🛒 الأسعار' },
          { id: 'menu:book',   title: '📅 احجز' },
          { id: 'menu:handoff',title: '👤 موظف' },
        ],
        vendorId,
      );
  }
}
