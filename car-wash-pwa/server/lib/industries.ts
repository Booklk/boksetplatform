/**
 * Industry definitions for Jdawil — منصة إنشاء مواقع الحجوزات للخدمات.
 * All sectors are ACTIVE — no comingSoon restrictions.
 */

export const INDUSTRIES = {
  car_wash: {
    nameAr: 'مغاسل السيارات',
    nameEn: 'Car Wash',
    icon: 'Car',
    description: 'مغاسل سيارات متنقلة وثابتة',
    vehicleFieldsEnabled: true,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الحجز',
    defaultServices: [
      { nameAr: 'غسيل خارجي', icon: '🚿' },
      { nameAr: 'غسيل داخلي', icon: '🧹' },
      { nameAr: 'غسيل شامل', icon: '✨' },
      { nameAr: 'بوليش وتلميع', icon: '💎' },
      { nameAr: 'تنظيف محرك', icon: '⚙️' },
      { nameAr: 'حماية نانو سيراميك', icon: '🛡️' },
    ],
    defaultPackages: [
      { serviceName: 'غسيل خارجي', nameAr: 'خارجي عادي', price: 50, duration: 30, features: ['غسيل بالرغوة', 'تجفيف', 'تلميع إطارات'] },
      { serviceName: 'غسيل خارجي', nameAr: 'خارجي VIP', price: 80, duration: 45, features: ['غسيل بالرغوة', 'شمع حماية', 'تلميع إطارات', 'تنظيف جنوط'] },
      { serviceName: 'غسيل داخلي', nameAr: 'داخلي كامل', price: 80, duration: 45, features: ['مكنسة', 'مسح تابلوه', 'تنظيف مقاعد', 'تعطير'] },
      { serviceName: 'غسيل شامل', nameAr: 'شامل عادي', price: 120, duration: 60, features: ['خارجي + داخلي', 'تعطير', 'تلميع إطارات'] },
      { serviceName: 'غسيل شامل', nameAr: 'شامل VIP', price: 180, duration: 90, features: ['خارجي + داخلي', 'شمع حماية', 'تلميع كامل', 'تعطير فاخر'] },
      { serviceName: 'بوليش وتلميع', nameAr: 'بوليش خفيف', price: 150, duration: 90, features: ['إزالة خدوش خفيفة', 'تلميع', 'طبقة شمع'] },
      { serviceName: 'بوليش وتلميع', nameAr: 'بوليش كامل', price: 250, duration: 120, features: ['بوليش 3 مراحل', 'تلميع كريستالي', 'حماية شمعية'] },
      { serviceName: 'تنظيف محرك', nameAr: 'تنظيف محرك', price: 100, duration: 30, features: ['رش مذيب', 'تنظيف بالهواء', 'تلميع'] },
      { serviceName: 'حماية نانو سيراميك', nameAr: 'نانو سيراميك', price: 500, duration: 180, features: ['بوليش تحضيري', 'طبقة سيراميك', 'حماية سنة', 'لمعان مرآة'] },
    ],
    defaultInventory: [
      { nameAr: 'شامبو سيارات', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'شمع حماية', unit: 'لتر', minQuantity: 5 },
      { nameAr: 'معطر', unit: 'حبة', minQuantity: 20 },
      { nameAr: 'فوط مايكروفايبر', unit: 'حبة', minQuantity: 30 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد حجز', message: 'مرحباً {customer_name} 🚗\n\nتم تأكيد حجزك #{booking_number}\n📅 {date}\n💰 {amount} ر.س\n\nالموظف في طريقه إليك!' },
      { name: 'عميل غائب', message: 'وحشتنا {customer_name}! 🚗\n\nمرّت 3 أسابيع على آخر غسلة.\nعندنا خصم 15% — الكود: COMEBACK15\n\n📱 احجز: {booking_link}' },
    ],
  },

  home_cleaning: {
    nameAr: 'تنظيف منازل',
    nameEn: 'Home Cleaning',
    icon: 'Home',
    description: 'تنظيف شقق وفلل ومكاتب',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'صاحب المنزل',
    bookingFieldLabel: 'الزيارة',
    defaultServices: [
      { nameAr: 'تنظيف شامل', icon: '🏠' },
      { nameAr: 'تنظيف مطابخ', icon: '🍳' },
      { nameAr: 'تنظيف بعد البناء', icon: '🏗️' },
      { nameAr: 'كوي وترتيب', icon: '👔' },
      { nameAr: 'تنظيف واجهات وزجاج', icon: '🪟' },
      { nameAr: 'تعقيم وتطهير', icon: '🧴' },
    ],
    defaultPackages: [
      { serviceName: 'تنظيف شامل', nameAr: 'استوديو / غرفة', price: 150, duration: 90, features: ['تنظيف كامل', 'مطبخ', 'حمام', 'تعقيم'] },
      { serviceName: 'تنظيف شامل', nameAr: 'شقة (2-3 غرف)', price: 250, duration: 150, features: ['غرف + صالة', 'مطبخ + حمامات', 'مسح أرضيات', 'تعقيم'] },
      { serviceName: 'تنظيف شامل', nameAr: 'شقة كبيرة (4+ غرف)', price: 400, duration: 210, features: ['كامل الشقة', 'جلي + تلميع', 'ترتيب', 'تعقيم شامل'] },
      { serviceName: 'تنظيف شامل', nameAr: 'فيلا كاملة', price: 700, duration: 360, features: ['طابقين أو أكثر', 'حديقة', 'مسبح', 'تلميع رخام'] },
      { serviceName: 'تنظيف بعد البناء', nameAr: 'شقة', price: 500, duration: 240, features: ['إزالة أتربة البناء', 'جلي بلاط', 'تنظيف نوافذ', 'تلميع'] },
      { serviceName: 'تنظيف بعد البناء', nameAr: 'فيلا', price: 1200, duration: 480, features: ['إزالة مخلفات', 'جلي رخام', 'تنظيف واجهات', 'تلميع كامل'] },
    ],
    defaultInventory: [
      { nameAr: 'منظف أسطح', unit: 'لتر', minQuantity: 15 },
      { nameAr: 'معقم', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'أكياس قمامة', unit: 'رول', minQuantity: 30 },
      { nameAr: 'فوط تنظيف', unit: 'حبة', minQuantity: 50 },
      { nameAr: 'منظف زجاج', unit: 'لتر', minQuantity: 10 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد حجز', message: 'مرحباً {customer_name} 🏠\n\nتم تأكيد زيارتك #{booking_number}\n📅 {date}\n📍 {address}\n\nفريقنا في الطريق!' },
      { name: 'تذكير', message: 'تذكير: زيارة التنظيف غداً {date} 🏠\n📍 {address}\n\nإذا تحتاج تغيير الموعد تواصل معنا.' },
    ],
  },

  ac_maintenance: {
    nameAr: 'صيانة مكيفات',
    nameEn: 'AC Maintenance',
    icon: 'Wind',
    description: 'تنظيف وصيانة وتركيب مكيفات',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'طلب الصيانة',
    defaultServices: [
      { nameAr: 'تنظيف مكيف', icon: '❄️' },
      { nameAr: 'صيانة وإصلاح', icon: '🔧' },
      { nameAr: 'تركيب جديد', icon: '⚙️' },
      { nameAr: 'شحن فريون', icon: '🧊' },
      { nameAr: 'فك ونقل', icon: '📦' },
      { nameAr: 'عقد صيانة سنوي', icon: '📋' },
    ],
    defaultPackages: [
      { serviceName: 'تنظيف مكيف', nameAr: 'سبليت', price: 100, duration: 45, features: ['تنظيف فلاتر', 'غسيل المبخر', 'تعقيم', 'فحص'] },
      { serviceName: 'تنظيف مكيف', nameAr: 'دولابي', price: 150, duration: 60, features: ['تنظيف كامل', 'غسيل بالضغط', 'تعقيم', 'تشحيم'] },
      { serviceName: 'تنظيف مكيف', nameAr: 'مركزي (وحدة)', price: 200, duration: 90, features: ['تنظيف المجاري', 'غسيل فلاتر', 'فحص شامل'] },
      { serviceName: 'صيانة وإصلاح', nameAr: 'فحص + إصلاح', price: 200, duration: 90, features: ['فحص كهرباء', 'فحص غاز', 'إصلاح أعطال'] },
      { serviceName: 'شحن فريون', nameAr: 'شحن غاز', price: 250, duration: 60, features: ['فحص التسريب', 'شحن الغاز', 'اختبار التبريد'] },
    ],
    defaultInventory: [
      { nameAr: 'غاز فريون R410', unit: 'كيلو', minQuantity: 10 },
      { nameAr: 'غاز فريون R22', unit: 'كيلو', minQuantity: 5 },
      { nameAr: 'فلاتر', unit: 'حبة', minQuantity: 20 },
      { nameAr: 'منظف مكيفات', unit: 'لتر', minQuantity: 15 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name} ❄️\n\nتم تأكيد طلب الصيانة #{booking_number}\n📅 {date}\n🔧 {service_name}\n\nالفني في طريقه إليك!' },
    ],
  },

  plumbing: {
    nameAr: 'سباكة',
    nameEn: 'Plumbing',
    icon: 'Droplets',
    description: 'صيانة سباكة وكشف تسربات',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'طلب الصيانة',
    defaultServices: [
      { nameAr: 'تسليك مجاري', icon: '🔧' },
      { nameAr: 'كشف تسربات', icon: '💧' },
      { nameAr: 'تركيب أدوات صحية', icon: '🚿' },
      { nameAr: 'صيانة عامة', icon: '🔩' },
      { nameAr: 'تمديدات مياه', icon: '🏗️' },
      { nameAr: 'صيانة سخانات', icon: '🔥' },
    ],
    defaultPackages: [
      { serviceName: 'تسليك مجاري', nameAr: 'تسليك عادي', price: 150, duration: 60, features: ['تسليك بالسلك', 'تنظيف', 'فحص'] },
      { serviceName: 'تسليك مجاري', nameAr: 'تسليك بالضغط', price: 300, duration: 90, features: ['ضغط هواء', 'تنظيف عميق', 'ضمان'] },
      { serviceName: 'كشف تسربات', nameAr: 'كشف بالجهاز', price: 350, duration: 120, features: ['جهاز إلكتروني', 'تقرير مفصل', 'تحديد الموقع'] },
      { serviceName: 'صيانة عامة', nameAr: 'زيارة صيانة', price: 120, duration: 60, features: ['فحص شامل', 'إصلاحات بسيطة', 'استشارة'] },
    ],
    defaultInventory: [
      { nameAr: 'مواسير PVC', unit: 'متر', minQuantity: 30 },
      { nameAr: 'صمامات', unit: 'حبة', minQuantity: 15 },
      { nameAr: 'سيليكون', unit: 'حبة', minQuantity: 20 },
      { nameAr: 'تيفلون', unit: 'رول', minQuantity: 20 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name} 🔧\n\nتم تأكيد طلبك #{booking_number}\n📅 {date}\n\nالفني في الطريق!' },
    ],
  },

  electrical: {
    nameAr: 'كهرباء',
    nameEn: 'Electrical',
    icon: 'Zap',
    description: 'صيانة وتمديد كهرباء',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'طلب الصيانة',
    defaultServices: [
      { nameAr: 'صيانة كهرباء', icon: '⚡' },
      { nameAr: 'تمديدات جديدة', icon: '🔌' },
      { nameAr: 'تركيب إنارة', icon: '💡' },
      { nameAr: 'فحص وأمان', icon: '🛡️' },
      { nameAr: 'تركيب لوحات كهربائية', icon: '📋' },
      { nameAr: 'كاميرات مراقبة', icon: '📹' },
    ],
    defaultPackages: [
      { serviceName: 'صيانة كهرباء', nameAr: 'زيارة فحص', price: 100, duration: 60, features: ['فحص شامل', 'إصلاح بسيط', 'تقرير'] },
      { serviceName: 'صيانة كهرباء', nameAr: 'إصلاح أعطال', price: 200, duration: 90, features: ['تشخيص العطل', 'إصلاح', 'اختبار'] },
      { serviceName: 'تركيب إنارة', nameAr: 'تركيب ثريا / إضاءة', price: 150, duration: 45, features: ['تركيب', 'توصيل', 'اختبار'] },
      { serviceName: 'تمديدات جديدة', nameAr: 'تمديد نقطة كهرباء', price: 200, duration: 90, features: ['تمديد أسلاك', 'تركيب مفتاح', 'اختبار'] },
    ],
    defaultInventory: [
      { nameAr: 'أسلاك 2.5mm', unit: 'متر', minQuantity: 100 },
      { nameAr: 'مفاتيح كهرباء', unit: 'حبة', minQuantity: 20 },
      { nameAr: 'أفياش', unit: 'حبة', minQuantity: 20 },
      { nameAr: 'شريط عازل', unit: 'رول', minQuantity: 10 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name} ⚡\n\nتم تأكيد طلبك #{booking_number}\n📅 {date}\n\nالكهربائي في الطريق!' },
    ],
  },

  salon: {
    nameAr: 'صالونات وحلاقة',
    nameEn: 'Salon & Barber',
    icon: 'Scissors',
    description: 'صالونات رجالية ونسائية وحلاقين متنقلين',
    vehicleFieldsEnabled: false,
    locationRequired: false,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الموعد',
    defaultServices: [
      { nameAr: 'حلاقة رجالية', icon: '💈' },
      { nameAr: 'عناية بالشعر', icon: '💇' },
      { nameAr: 'عناية بالبشرة', icon: '✨' },
      { nameAr: 'عناية باللحية', icon: '🧔' },
      { nameAr: 'حمام مغربي', icon: '🧖' },
    ],
    defaultPackages: [
      { serviceName: 'حلاقة رجالية', nameAr: 'قص شعر', price: 30, duration: 20, features: ['قص بالمكينة أو مقص', 'تصفيف', 'غسيل'] },
      { serviceName: 'حلاقة رجالية', nameAr: 'قص + لحية', price: 50, duration: 30, features: ['قص شعر', 'تحديد لحية', 'غسيل', 'كريم مرطب'] },
      { serviceName: 'حلاقة رجالية', nameAr: 'VIP كامل', price: 100, duration: 60, features: ['قص شعر', 'لحية', 'ماسك وجه', 'مساج رأس', 'تصفيف'] },
      { serviceName: 'عناية بالشعر', nameAr: 'صبغة شعر', price: 80, duration: 45, features: ['صبغة كاملة', 'غسيل', 'تصفيف'] },
      { serviceName: 'عناية بالشعر', nameAr: 'بروتين / كيراتين', price: 200, duration: 90, features: ['بروتين برازيلي', 'غسيل', 'تصفيف', 'يدوم 3 أشهر'] },
      { serviceName: 'عناية بالبشرة', nameAr: 'تنظيف بشرة', price: 60, duration: 30, features: ['تنظيف عميق', 'ماسك', 'كريم مرطب'] },
      { serviceName: 'عناية باللحية', nameAr: 'تحديد + زيت', price: 40, duration: 20, features: ['تحديد بالموس', 'زيت لحية', 'تمشيط'] },
      { serviceName: 'حمام مغربي', nameAr: 'حمام مغربي كامل', price: 150, duration: 60, features: ['تقشير', 'صابون مغربي', 'ليفة', 'مساج', 'ترطيب'] },
    ],
    defaultInventory: [
      { nameAr: 'شفرات حلاقة', unit: 'حبة', minQuantity: 100 },
      { nameAr: 'شامبو', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'جل تصفيف', unit: 'حبة', minQuantity: 15 },
      { nameAr: 'كريم حلاقة', unit: 'حبة', minQuantity: 10 },
      { nameAr: 'صبغة شعر', unit: 'علبة', minQuantity: 10 },
      { nameAr: 'فوط', unit: 'حبة', minQuantity: 30 },
      { nameAr: 'معقم أدوات', unit: 'لتر', minQuantity: 5 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد موعد', message: 'مرحباً {customer_name} 💈\n\nموعدك مؤكد #{booking_number}\n📅 {date}\n✂️ {service_name}\n\nننتظرك!' },
      { name: 'تذكير', message: 'تذكير بموعدك غداً {date} 💈\n✂️ {service_name}\n\nإذا تبي تغيير تواصل معنا 📱' },
      { name: 'عميل غائب', message: 'وحشتنا {customer_name}! 💈\n\nصار لك فترة ما زرتنا.\nعندنا عرض خاص: خصم 20% على خدمتك القادمة!\n\nالكود: WELCOME20\n📱 احجز: {booking_link}' },
    ],
  },

  beauty_home: {
    nameAr: 'تجميل منزلي وسبا',
    nameEn: 'Home Beauty & Spa',
    icon: 'Sparkles',
    description: 'خدمات تجميل ومساج وسبا في المنزل',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميلة',
    bookingFieldLabel: 'الموعد',
    defaultServices: [
      { nameAr: 'مكياج', icon: '💄' },
      { nameAr: 'عناية بالبشرة', icon: '✨' },
      { nameAr: 'عناية بالأظافر', icon: '💅' },
      { nameAr: 'مساج واسترخاء', icon: '💆' },
      { nameAr: 'حمام مغربي', icon: '🧖' },
      { nameAr: 'شعر وتسريحات', icon: '💇‍♀️' },
    ],
    defaultPackages: [
      { serviceName: 'مكياج', nameAr: 'مكياج سهرة', price: 300, duration: 60, features: ['مكياج كامل', 'رموش', 'تثبيت', 'مناسب للمناسبات'] },
      { serviceName: 'مكياج', nameAr: 'مكياج عروس', price: 800, duration: 120, features: ['مكياج كامل', 'رموش فاخرة', 'تثبيت 12 ساعة', 'تجربة مسبقة'] },
      { serviceName: 'مكياج', nameAr: 'مكياج ناعم', price: 150, duration: 40, features: ['مكياج يومي', 'إطلالة طبيعية', 'ترطيب'] },
      { serviceName: 'عناية بالبشرة', nameAr: 'تنظيف بشرة عميق', price: 200, duration: 60, features: ['تنظيف', 'تقشير', 'ماسك', 'ترطيب'] },
      { serviceName: 'عناية بالبشرة', nameAr: 'هيدرافيشل', price: 350, duration: 45, features: ['تنظيف عميق', 'ترطيب مكثف', 'نضارة فورية'] },
      { serviceName: 'عناية بالأظافر', nameAr: 'مانيكير + بديكير', price: 120, duration: 60, features: ['تقليم', 'برد', 'طلاء', 'ترطيب'] },
      { serviceName: 'عناية بالأظافر', nameAr: 'جل أظافر', price: 180, duration: 75, features: ['إزالة قديم', 'جل جديد', 'تصميم', 'يدوم 3 أسابيع'] },
      { serviceName: 'مساج واسترخاء', nameAr: 'مساج استرخائي', price: 250, duration: 60, features: ['مساج كامل الجسم', 'زيوت عطرية', 'استرخاء'] },
      { serviceName: 'مساج واسترخاء', nameAr: 'مساج + حمام مغربي', price: 450, duration: 120, features: ['حمام مغربي كامل', 'مساج', 'تقشير', 'ترطيب'] },
      { serviceName: 'شعر وتسريحات', nameAr: 'تسريحة مناسبة', price: 200, duration: 45, features: ['غسيل', 'سشوار', 'تسريحة حسب الطلب'] },
      { serviceName: 'شعر وتسريحات', nameAr: 'صبغة + سشوار', price: 350, duration: 90, features: ['صبغة كاملة', 'غسيل', 'سشوار', 'علاج'] },
    ],
    defaultInventory: [
      { nameAr: 'مكياج أساس', unit: 'حبة', minQuantity: 10 },
      { nameAr: 'رموش صناعية', unit: 'زوج', minQuantity: 20 },
      { nameAr: 'زيوت مساج', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'صابون مغربي', unit: 'كيلو', minQuantity: 5 },
      { nameAr: 'طلاء أظافر', unit: 'حبة', minQuantity: 15 },
      { nameAr: 'كريم ترطيب', unit: 'حبة', minQuantity: 10 },
      { nameAr: 'فوط قطنية', unit: 'حبة', minQuantity: 30 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name} 💄\n\nموعدك مؤكد #{booking_number}\n📅 {date}\n💅 {service_name}\n📍 {address}\n\nالمتخصصة في طريقها إليك!' },
      { name: 'تذكير', message: 'تذكير بموعدك غداً {date} ✨\n💅 {service_name}\n\nيرجى تجهيز مكان مناسب للخدمة 🙏' },
      { name: 'عميلة غائبة', message: 'وحشتينا {customer_name}! 💕\n\nعندنا عرض خاص لك:\nمانيكير + بديكير بـ 99 ر.س بدل 120\n\n📱 احجزي: {booking_link}' },
    ],
  },

  freelancer: {
    nameAr: 'فري لانسر / خدمات حرة',
    nameEn: 'Freelancer',
    icon: 'Briefcase',
    description: 'أي مقدم خدمة مستقل — مصور، مدرب، طباخ، معلم، مصمم',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الحجز',
    defaultServices: [
      { nameAr: 'الخدمة الرئيسية', icon: '⭐' },
      { nameAr: 'استشارة', icon: '💬' },
      { nameAr: 'تدريب', icon: '🎯' },
      { nameAr: 'جلسة تصوير', icon: '📸' },
      { nameAr: 'طبخ منزلي', icon: '🍳' },
      { nameAr: 'دروس خصوصية', icon: '📚' },
    ],
    defaultPackages: [
      { serviceName: 'الخدمة الرئيسية', nameAr: 'جلسة عادية (ساعة)', price: 100, duration: 60, features: ['ساعة واحدة', 'في الموقع'] },
      { serviceName: 'الخدمة الرئيسية', nameAr: 'جلسة مطوّلة (ساعتين)', price: 180, duration: 120, features: ['ساعتين', 'في الموقع', 'مواد مشمولة'] },
      { serviceName: 'استشارة', nameAr: 'استشارة أونلاين', price: 80, duration: 30, features: ['30 دقيقة', 'عن بعد'] },
      { serviceName: 'تدريب', nameAr: 'جلسة تدريب', price: 150, duration: 60, features: ['ساعة', 'في الموقع أو أونلاين'] },
    ],
    defaultInventory: [],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name}!\n\nتم تأكيد حجزك #{booking_number}\n📅 {date}\n📍 {address}\n\nنراك قريباً!' },
    ],
  },

  other: {
    nameAr: 'خدمات أخرى',
    nameEn: 'Other Services',
    icon: 'Wrench',
    description: 'أي نوع خدمة — عرّف خدماتك بنفسك',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الطلب',
    defaultServices: [],
    defaultPackages: [],
    defaultInventory: [],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name}!\n\nتم تأكيد طلبك #{booking_number}\n📅 {date}\n\nشكراً لثقتك!' },
    ],
  },
} as const;

export type IndustryKey = keyof typeof INDUSTRIES;

export function getIndustryLabel(industry: string): string {
  return INDUSTRIES[industry as IndustryKey]?.nameAr ?? industry;
}

export function getIndustriesList(includeComingSoon = true) {
  return Object.entries(INDUSTRIES)
    .filter(([_, val]) => includeComingSoon || !val.comingSoon)
    .map(([key, val]) => ({
      key,
      ...val,
    }));
}
