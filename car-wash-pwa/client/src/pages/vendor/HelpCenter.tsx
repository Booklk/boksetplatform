// Vendor help center — searchable FAQ, quick-start guides, contact info

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, ChevronDown, HelpCircle, BookOpen, BarChart3,
  CalendarCheck, MessageCircle, Phone, Clock,
} from 'lucide-react';

// ─── Data ────────────────────────────────────────────────────────────────────

const QUICK_START = [
  {
    title: 'كيف أضيف خدمة؟',
    icon: BookOpen,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    steps: [
      'افتح لوحة التحكم واضغط على "الخدمات" من القائمة الجانبية.',
      'اضغط على زر "أضف خدمة جديدة".',
      'أدخل اسم الخدمة، ثم أضف باقة واحدة أو أكثر (اسم، سعر، مدة).',
      'اضغط "حفظ" وبتظهر الخدمة تلقائياً لعملائك.',
    ],
  },
  {
    title: 'كيف أدير الحجوزات؟',
    icon: CalendarCheck,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    steps: [
      'من لوحة التحكم، اضغط على "التقويم" أو "الحجوزات".',
      'تقدر تشوف جميع الحجوزات حسب اليوم أو الأسبوع.',
      'اضغط على أي حجز لعرض التفاصيل، تعيين موظف، أو تغيير الحالة.',
      'بإمكانك قبول أو رفض أو إتمام الحجز من نفس الصفحة.',
    ],
  },
  {
    title: 'كيف أشوف التقارير المالية؟',
    icon: BarChart3,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    steps: [
      'روح لقسم "التحليلات" أو "المالية" من القائمة.',
      'بتلقى ملخص الإيرادات اليومي والأسبوعي والشهري.',
      'تقدر تفلتر حسب الفترة، الخدمة، أو الموظف.',
      'اضغط "تصدير" لتحميل التقرير كملف Excel.',
    ],
  },
];

const FAQ_ITEMS = [
  {
    q: 'كيف أغير أسعار الخدمات؟',
    a: 'روح لقسم "الخدمات"، اضغط على الخدمة اللي تبي تعدلها، غيّر السعر في الباقة، واضغط "حفظ". التحديث يظهر فوراً لعملائك.',
  },
  {
    q: 'كيف أضيف موظف جديد؟',
    a: 'من قسم "الموظفين"، اضغط "أضف موظف"، أدخل اسمه ورقم جواله. بيوصله رابط تسجيل الدخول تلقائياً ويقدر يبدأ يستقبل حجوزات.',
  },
  {
    q: 'كيف أتتبع المخزون؟',
    a: 'قسم "المخزون" يوريك كل المواد المتوفرة. تقدر تضيف مواد جديدة، تحدّث الكميات، وتفعّل تنبيهات لما المخزون يوشك يخلص.',
  },
  {
    q: 'كيف أرسل حملة واتساب؟',
    a: 'من قسم "الحملات"، اضغط "حملة جديدة"، اختر شريحة العملاء المستهدفة، اكتب نص الرسالة، وجدولها أو أرسلها فوراً.',
  },
  {
    q: 'كيف أصدّر القوائم المالية؟',
    a: 'من قسم "القوائم المالية"، اختر الفترة المطلوبة واضغط "تصدير". يدعم تصدير Excel وPDF مع تفاصيل الإيرادات والمصروفات.',
  },
  {
    q: 'كيف أفعّل الأتمتة التسويقية؟',
    a: 'من قسم "الأتمتة"، فعّل القوالب الجاهزة مثل: رسالة ترحيب، تذكير بالحجز، أو عرض بعد أول زيارة. كل قالب تقدر تخصصه حسب احتياجك.',
  },
  {
    q: 'كيف أعدّل بيانات مغسلتي؟',
    a: 'من "الإعدادات" > "بيانات المغسلة"، تقدر تعدل الاسم، العنوان، أوقات العمل، الشعار، واللون الرئيسي.',
  },
  {
    q: 'كيف ألغي اشتراكي؟',
    a: 'من "الإعدادات" > "الاشتراك"، اضغط "إلغاء الاشتراك". بيستمر حسابك لنهاية الفترة المدفوعة. تقدر تعيد التفعيل بأي وقت.',
  },
  {
    q: 'وش يصير بعد انتهاء الفترة التجريبية؟',
    a: 'بعد انتهاء الـ 14 يوم التجريبية، بيتحول حسابك لوضع القراءة فقط. ما بتقدر تستقبل حجوزات جديدة لين ما تفعّل اشتراك. بياناتك تظل محفوظة.',
  },
  {
    q: 'كيف أتواصل مع الدعم؟',
    a: 'تقدر ترسلنا عبر واتساب على الرقم الموجود أسفل هذي الصفحة، أو ترفع تذكرة دعم من قسم "الدعم الفني". وقت الرد خلال ساعتين في أوقات العمل.',
  },
];

const WHATSAPP_NUMBER = '+966501234567';

// ─── Accordion Item ──────────────────────────────────────────────────────────

function AccordionItem({ title, children, isOpen, onToggle }: {
  title: string;
  children: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-right hover:bg-white/5 transition-colors"
      >
        <span className="text-sm font-medium text-white">{title}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex-shrink-0 mr-3"
        >
          <ChevronDown size={18} className="text-slate-400" />
        </motion.span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 text-sm text-slate-400 leading-relaxed">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function HelpCenter() {
  const [query, setQuery] = useState('');
  const [openQuickStart, setOpenQuickStart] = useState<number | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const filteredFaq = query.trim()
    ? FAQ_ITEMS.filter(item =>
        item.q.includes(query) || item.a.includes(query),
      )
    : FAQ_ITEMS;

  const filteredQuickStart = query.trim()
    ? QUICK_START.filter(item =>
        item.title.includes(query) || item.steps.some(s => s.includes(query)),
      )
    : QUICK_START;

  return (
    <div className="min-h-screen bg-surface-1 text-white p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <HelpCircle className="text-blue-400" size={26} />
          مركز المساعدة
        </h1>
        <p className="text-slate-400 text-sm">ابحث عن إجابات لأسئلتك أو تواصل مع فريق الدعم</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="ابحث عن سؤال أو موضوع..."
          className="w-full bg-white/5 border border-white/10 rounded-xl pr-11 pl-4 py-3.5 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
        />
      </div>

      {/* Quick Start Cards */}
      {filteredQuickStart.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-bold mb-4">البداية السريعة</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {filteredQuickStart.map((card, idx) => {
              const globalIdx = QUICK_START.indexOf(card);
              const Icon = card.icon;
              const isOpen = openQuickStart === globalIdx;
              return (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className={`${card.bg} border border-white/10 rounded-2xl overflow-hidden`}
                >
                  <button
                    onClick={() => setOpenQuickStart(isOpen ? null : globalIdx)}
                    className="w-full p-5 text-right"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-xl bg-white/10`}>
                        <Icon size={20} className={card.color} />
                      </div>
                      <span className="font-semibold text-sm text-white">{card.title}</span>
                    </div>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="block"
                    >
                      <ChevronDown size={16} className="text-slate-400 mx-auto" />
                    </motion.span>
                  </button>
                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="overflow-hidden"
                      >
                        <ol className="px-5 pb-5 space-y-2 list-decimal list-inside">
                          {card.steps.map((s, i) => (
                            <li key={i} className="text-sm text-slate-300 leading-relaxed">{s}</li>
                          ))}
                        </ol>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        </section>
      )}

      {/* FAQ */}
      <section className="mb-8">
        <h2 className="text-lg font-bold mb-4">الأسئلة الشائعة</h2>
        {filteredFaq.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Search size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">ما لقينا نتائج لـ "{query}"</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredFaq.map((item, idx) => {
              const globalIdx = FAQ_ITEMS.indexOf(item);
              return (
                <motion.div
                  key={item.q}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03 }}
                >
                  <AccordionItem
                    title={item.q}
                    isOpen={openFaq === globalIdx}
                    onToggle={() => setOpenFaq(openFaq === globalIdx ? null : globalIdx)}
                  >
                    {item.a}
                  </AccordionItem>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* Contact Section */}
      <section className="bg-white/5 border border-white/10 rounded-2xl p-6">
        <h2 className="text-lg font-bold mb-4">تواصل معنا</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <a
            href={`https://wa.me/${WHATSAPP_NUMBER.replace('+', '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center gap-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 hover:bg-emerald-500/20 transition-colors"
          >
            <div className="p-3 rounded-xl bg-emerald-500/20">
              <MessageCircle size={22} className="text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">واتساب الدعم</p>
              <p className="text-xs text-slate-400 mt-0.5" dir="ltr">{WHATSAPP_NUMBER}</p>
            </div>
          </a>
          <div className="flex-1 flex items-center gap-4 bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <Clock size={22} className="text-blue-400" />
            </div>
            <div>
              <p className="font-semibold text-sm text-white">وقت الرد</p>
              <p className="text-xs text-slate-400 mt-0.5">خلال ساعتين خلال أوقات العمل</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
