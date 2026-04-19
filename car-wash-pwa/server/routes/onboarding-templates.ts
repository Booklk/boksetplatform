import { Router } from 'express';

const router = Router();

// Pre-built service templates for quick onboarding
const mobileCarWashTemplates = {
  bike: {
    services: [
      {
        name: 'غسيل خارجي للدراجة',
        packages: [
          { name: 'غسيل خارجي', price: 15, duration: 15, features: ['غسيل خارجي بالرغوة', 'تجفيف بالمايكروفايبر'] },
          { name: 'غسيل كامل', price: 25, duration: 25, features: ['غسيل خارجي + داخلي', 'تلميع الكروم', 'تجفيف كامل'] },
        ],
      },
    ],
    whatsappTemplates: [
      { name: 'تأكيد حجز', message: 'مرحباً {customer_name}! 🏍️\n\nتم تأكيد حجزك رقم #{booking_number}\n📅 الموعد: {date}\n💰 المبلغ: {amount} ر.س\n\nشكراً لثقتك! 🙏' },
      { name: 'تذكير بالحجز', message: 'مرحباً {customer_name}! 👋\n\nتذكير بموعدك غداً 🏍️\n📅 {date}\n\nنراك قريباً!' },
      { name: 'عرض خاص', message: '🔥 عرض خاص من {vendor_name}!\n\nغسلة كاملة للدراجة بـ 20 ر.س فقط بدل 25\n\n⏰ العرض ينتهي خلال 48 ساعة\n\n📱 احجز الآن: {booking_link}' },
    ],
  },
  car: {
    services: [
      {
        name: 'غسيل خارجي',
        packages: [
          { name: 'غسيل خارجي عادي', price: 40, duration: 30, features: ['غسيل خارجي بالرغوة', 'تجفيف بالمايكروفايبر', 'تلميع الإطارات'] },
          { name: 'غسيل خارجي بريميوم', price: 60, duration: 45, features: ['غسيل خارجي بالشامبو', 'إزالة الحشرات', 'تلميع الإطارات', 'معطر خارجي'] },
        ],
      },
      {
        name: 'غسيل داخلي وخارجي',
        packages: [
          { name: 'غسيل كامل', price: 80, duration: 60, features: ['غسيل خارجي كامل', 'تنظيف داخلي بالمكنسة', 'مسح التابلوه', 'تعقيم', 'معطر'] },
          { name: 'غسيل VIP', price: 120, duration: 90, features: ['غسيل خارجي بريميوم', 'تنظيف داخلي عميق', 'غسيل المقاعد', 'تعقيم بالأوزون', 'تلميع بالشمع', 'معطر فاخر'] },
        ],
      },
      {
        name: 'بوليش وتلميع',
        packages: [
          { name: 'بوليش خفيف', price: 150, duration: 120, features: ['إزالة الخدوش الخفيفة', 'تلميع كامل', 'طبقة شمع حماية'] },
          { name: 'بوليش كامل + نانو', price: 350, duration: 180, features: ['بوليش 3 مراحل', 'طبقة نانو سيراميك', 'حماية 6 أشهر', 'لمعان مرآة'] },
        ],
      },
    ],
    whatsappTemplates: [
      { name: 'تأكيد حجز', message: 'مرحباً {customer_name}! 🚗💧\n\nتم تأكيد حجزك رقم #{booking_number}\n📅 الموعد: {date}\n🏷️ الخدمة: {service_name}\n💰 المبلغ: {amount} ر.س\n📍 العنوان: {address}\n\nالموظف في طريقه إليك! 🚙' },
      { name: 'تذكير قبل يوم', message: 'أهلاً {customer_name}! 👋\n\nتذكير بموعد غسلتك غداً 🚗\n📅 {date}\n🏷️ {service_name}\n\nإذا تحتاج تغيير الموعد تواصل معنا 📱' },
      { name: 'طلب تقييم', message: 'شكراً {customer_name}! ✅\n\nتم إنجاز غسلتك بنجاح 🚗✨\n\nكيف تقيّم خدمتنا؟\n⭐⭐⭐⭐⭐\n\nقيّم من هنا: {rating_link}\n\nرأيك يهمنا! 🙏' },
      { name: 'عميل غائب 21 يوم', message: 'وحشتنا {customer_name}! 🥺\n\nمرّت 3 أسابيع على آخر غسلة لسيارتك 🚗\n\nعندنا عرض خاص لك: خصم 15% على الغسلة القادمة!\n\n📱 احجز الآن: {booking_link}\n\nالكود: COMEBACK15' },
      { name: 'اشتراك شهري', message: '💎 اشترك ووفّر مع {vendor_name}!\n\n4 غسلات/شهر بـ 250 ر.س بدل 320\n✅ توفير 22%\n✅ مواعيد ثابتة\n✅ أولوية بالحجز\n\n📱 اشترك: {subscription_link}' },
    ],
  },
  fixed: {
    services: [
      {
        name: 'غسيل سريع',
        packages: [
          { name: 'غسيل خارجي سريع', price: 30, duration: 20, features: ['غسيل خارجي', 'تجفيف', 'تلميع الإطارات'] },
        ],
      },
      {
        name: 'غسيل كامل',
        packages: [
          { name: 'غسيل كامل عادي', price: 60, duration: 45, features: ['غسيل خارجي + داخلي', 'تجفيف', 'معطر'] },
          { name: 'غسيل كامل VIP', price: 100, duration: 60, features: ['غسيل كامل', 'تلميع', 'تعقيم', 'معطر فاخر', 'تنظيف المحرك'] },
        ],
      },
    ],
    whatsappTemplates: [
      { name: 'تأكيد حجز', message: 'مرحباً {customer_name}! 🚗\n\nتم تأكيد حجزك #{booking_number}\n📅 {date}\n🏪 في {vendor_name}\n\nننتظرك! 🙏' },
    ],
  },
};

// GET /api/onboarding-templates/:type — Get pre-built templates for a wash type
router.get('/:type', (req, res) => {
  const type = req.params.type as keyof typeof mobileCarWashTemplates;
  const templates = mobileCarWashTemplates[type];

  if (!templates) {
    return res.status(404).json({ error: 'نوع غير معروف' });
  }

  return res.json(templates);
});

// GET /api/onboarding-templates — Get all template types
router.get('/', (_req, res) => {
  return res.json({
    types: [
      { key: 'bike', label: 'دراجات نارية', icon: '🏍️', serviceCount: 1, packageCount: 2 },
      { key: 'car', label: 'سيارات متنقلة', icon: '🚗', serviceCount: 3, packageCount: 6 },
      { key: 'fixed', label: 'مغسلة ثابتة', icon: '🏪', serviceCount: 2, packageCount: 3 },
    ],
  });
});

export default router;
