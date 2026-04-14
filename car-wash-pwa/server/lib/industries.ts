/**
 * Industry definitions for Bokset — منصة إنشاء مواقع الحجوزات للخدمات.
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
    ],
    defaultPackages: [
      { serviceName: 'غسيل خارجي', nameAr: 'خارجي عادي', price: 50, duration: 30, features: ['غسيل بالرغوة', 'تجفيف', 'تلميع إطارات'] },
      { serviceName: 'غسيل خارجي', nameAr: 'خارجي VIP', price: 80, duration: 45, features: ['غسيل بالرغوة', 'شمع حماية', 'تلميع إطارات', 'تنظيف جنوط'] },
      { serviceName: 'غسيل شامل', nameAr: 'شامل عادي', price: 120, duration: 60, features: ['خارجي + داخلي', 'تعطير', 'تلميع إطارات'] },
      { serviceName: 'غسيل شامل', nameAr: 'شامل VIP', price: 180, duration: 90, features: ['خارجي + داخلي', 'شمع حماية', 'تلميع كامل', 'تعطير فاخر'] },
      { serviceName: 'بوليش وتلميع', nameAr: 'بوليش كامل', price: 250, duration: 120, features: ['بوليش 3 مراحل', 'تلميع كريستالي', 'حماية شمعية'] },
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

  pest_control: {
    nameAr: 'مكافحة حشرات',
    nameEn: 'Pest Control',
    icon: 'Bug',
    description: 'رش حشرات وتعقيم منازل',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الزيارة',
    defaultServices: [
      { nameAr: 'رش حشرات', icon: '🪲' },
      { nameAr: 'مكافحة قوارض', icon: '🐀' },
      { nameAr: 'تعقيم شامل', icon: '🧴' },
      { nameAr: 'رش وقائي', icon: '🛡️' },
    ],
    defaultPackages: [
      { serviceName: 'رش حشرات', nameAr: 'شقة', price: 200, duration: 60, features: ['رش جميع الغرف', 'مبيد آمن', 'ضمان شهر'] },
      { serviceName: 'رش حشرات', nameAr: 'فيلا', price: 450, duration: 120, features: ['رش كامل + حديقة', 'مبيد مركّز', 'ضمان شهرين'] },
      { serviceName: 'تعقيم شامل', nameAr: 'تعقيم شقة', price: 300, duration: 90, features: ['تعقيم بالبخار', 'مضاد بكتيريا', 'شهادة تعقيم'] },
      { serviceName: 'رش وقائي', nameAr: 'عقد شهري', price: 150, duration: 45, features: ['رش وقائي شهري', 'فحص دوري', 'ضمان مستمر'] },
    ],
    defaultInventory: [
      { nameAr: 'مبيد حشري', unit: 'لتر', minQuantity: 25 },
      { nameAr: 'طعوم قوارض', unit: 'حبة', minQuantity: 40 },
      { nameAr: 'مادة تعقيم', unit: 'لتر', minQuantity: 15 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name} 🛡️\n\nتم تأكيد زيارة الرش #{booking_number}\n📅 {date}\n📍 {address}\n\nيرجى إخلاء المكان قبل الموعد بنص ساعة.' },
    ],
  },

  carpet_cleaning: {
    nameAr: 'غسيل سجاد وكنب',
    nameEn: 'Carpet & Upholstery',
    icon: 'Layers',
    description: 'غسيل سجاد وموكيت وكنب ومجالس',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الطلب',
    defaultServices: [
      { nameAr: 'غسيل سجاد', icon: '🧹' },
      { nameAr: 'غسيل كنب', icon: '🛋️' },
      { nameAr: 'غسيل مجالس', icon: '🪑' },
      { nameAr: 'غسيل موكيت', icon: '🏠' },
    ],
    defaultPackages: [
      { serviceName: 'غسيل سجاد', nameAr: 'سجادة صغيرة (2×3)', price: 40, duration: 15, features: ['غسيل بالبخار', 'تجفيف', 'تعطير'] },
      { serviceName: 'غسيل سجاد', nameAr: 'سجادة كبيرة (3×4)', price: 70, duration: 20, features: ['غسيل بالبخار', 'إزالة بقع', 'تعطير'] },
      { serviceName: 'غسيل كنب', nameAr: 'كنب 3 مقاعد', price: 150, duration: 45, features: ['غسيل بالبخار', 'تعقيم', 'تجفيف سريع'] },
      { serviceName: 'غسيل كنب', nameAr: 'كنب 7 مقاعد', price: 280, duration: 75, features: ['غسيل + تعقيم', 'إزالة بقع', 'تعطير فاخر'] },
      { serviceName: 'غسيل مجالس', nameAr: 'مجلس كامل', price: 400, duration: 120, features: ['غسيل كل المقاعد', 'بخار + تعقيم', 'تعطير'] },
    ],
    defaultInventory: [
      { nameAr: 'شامبو سجاد', unit: 'لتر', minQuantity: 25 },
      { nameAr: 'مزيل بقع', unit: 'لتر', minQuantity: 10 },
      { nameAr: 'معطر أقمشة', unit: 'لتر', minQuantity: 15 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name} 🛋️\n\nتم تأكيد طلبك #{booking_number}\n📅 {date}\n\nفريقنا في الطريق!' },
    ],
  },

  landscaping: {
    nameAr: 'تنسيق حدائق',
    nameEn: 'Landscaping',
    icon: 'Flower2',
    description: 'تنسيق وصيانة حدائق ومسطحات',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'صاحب المنزل',
    bookingFieldLabel: 'الزيارة',
    defaultServices: [
      { nameAr: 'قص وتشذيب', icon: '✂️' },
      { nameAr: 'زراعة وتنسيق', icon: '🌱' },
      { nameAr: 'شبكة ري', icon: '💧' },
      { nameAr: 'صيانة دورية', icon: '🌿' },
    ],
    defaultPackages: [
      { serviceName: 'قص وتشذيب', nameAr: 'حديقة صغيرة', price: 150, duration: 60, features: ['قص نجيل', 'تشذيب أشجار', 'تنظيف'] },
      { serviceName: 'قص وتشذيب', nameAr: 'حديقة كبيرة / فيلا', price: 350, duration: 150, features: ['قص + تشذيب', 'تسميد', 'تنظيف كامل'] },
      { serviceName: 'زراعة وتنسيق', nameAr: 'تنسيق جديد', price: 800, duration: 300, features: ['تصميم', 'زراعة', 'نظام ري', 'إنارة'] },
      { serviceName: 'صيانة دورية', nameAr: 'عقد شهري', price: 200, duration: 90, features: ['زيارة أسبوعية', 'قص + سقي', 'تسميد شهري'] },
    ],
    defaultInventory: [
      { nameAr: 'سماد NPK', unit: 'كيلو', minQuantity: 25 },
      { nameAr: 'تربة زراعية', unit: 'كيس', minQuantity: 15 },
      { nameAr: 'بذور نجيل', unit: 'كيلو', minQuantity: 5 },
    ],
    whatsappTemplates: [
      { name: 'تأكيد', message: 'مرحباً {customer_name} 🌿\n\nتم تأكيد زيارتك #{booking_number}\n📅 {date}\n\nفريق الحدائق في الطريق!' },
    ],
  },

  freelancer: {
    nameAr: 'فري لانسر / خدمات حرة',
    nameEn: 'Freelancer',
    icon: 'Briefcase',
    description: 'أي مقدم خدمة مستقل — حلاق، مصور، مدرب، طباخ',
    vehicleFieldsEnabled: false,
    locationRequired: true,
    comingSoon: false,
    customerFieldLabel: 'العميل',
    bookingFieldLabel: 'الحجز',
    defaultServices: [
      { nameAr: 'الخدمة الرئيسية', icon: '⭐' },
    ],
    defaultPackages: [
      { serviceName: 'الخدمة الرئيسية', nameAr: 'جلسة عادية', price: 100, duration: 60, features: ['ساعة واحدة', 'في الموقع'] },
      { serviceName: 'الخدمة الرئيسية', nameAr: 'جلسة مطوّلة', price: 180, duration: 120, features: ['ساعتين', 'في الموقع', 'مواد مشمولة'] },
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
