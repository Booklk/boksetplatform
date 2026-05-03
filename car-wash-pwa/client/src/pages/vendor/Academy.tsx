import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { GraduationCap, Play, FileText, MessageCircle, Sparkles, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

interface Course {
  id: string;
  title: string;
  body: string;
  industry: string[];
  durationMin: number;
  category: 'finance' | 'marketing' | 'operations' | 'compliance';
}

// Curated short-form courses tagged by industry. Each one is meant to
// be a 5-15 minute read or watch. Content lives on the platform CMS
// in v2; v1 ships a built-in catalogue.
const COURSES: Course[] = [
  // Marketing
  { id: 'm-001', title: 'كيف تجلب أول 100 عميل بدون إعلانات', body: 'استراتيجية واتساب + بطاقات + إحالات عميل تجلب لك قاعدة عملاء مجانية في 60 يوم.', industry: ['*'], durationMin: 8, category: 'marketing' },
  { id: 'm-002', title: 'نصوص واتساب ترفع تأكيدات الحجز ٢٥٪', body: 'قوالب رسائل مجرّبة لكل قطاع — تذكير، طلب تقييم، استرجاع عميل غائب.', industry: ['*'], durationMin: 5, category: 'marketing' },
  { id: 'm-003', title: 'الحملات الناجحة على X و Instagram للسوق السعودي', body: 'كيف تختار الإنفلونسر، كيف تقيس ROI، وكم تتوقع كنتيجة فعلية.', industry: ['salon', 'beauty_home', 'spa', 'clinic'], durationMin: 10, category: 'marketing' },

  // Finance
  { id: 'f-001', title: 'احسب هامش ربحك الحقيقي (مع كل التكاليف)', body: 'دليل خطوة بخطوة لإيجاد سعر التكلفة الفعلي — مواد + عمالة + إيجار + كهرباء + ضريبة.', industry: ['*'], durationMin: 12, category: 'finance' },
  { id: 'f-002', title: 'فاتورة زاتكا الإلكترونية: ما الذي تحتاجه فعلاً', body: 'الفرق بين Phase 1 و Phase 2، متى تكون إلزامية لك، وكيف يجهّزها لك Jdawil تلقائياً.', industry: ['*'], durationMin: 7, category: 'compliance' },
  { id: 'f-003', title: 'متى ترفع أسعارك دون أن تخسر العملاء', body: 'إشارات السوق + توقيت الرفع + كيف تشرحه للعميل — قاعدة الـ 10٪ سنوياً.', industry: ['*'], durationMin: 6, category: 'finance' },

  // Operations
  { id: 'o-001', title: 'بناء جدول موظفين يحترم رمضان والإجازات', body: 'إعدادات Jdawil لجدولة ذكية + تكامل أوقات الصلاة + معايرة الذروة.', industry: ['*'], durationMin: 8, category: 'operations' },
  { id: 'o-002', title: 'كيف تخفّض غياب العملاء (No-Show) إلى أقل من ٥٪', body: 'العربون + سلسلة التذكيرات + قائمة الانتظار. ٣ أدوات تحسم الأمر.', industry: ['salon', 'beauty_home', 'spa', 'clinic', 'professional_services'], durationMin: 6, category: 'operations' },
  { id: 'o-003', title: 'GPS وتتبع الموظفين: متى يستحق وكيف تطبّقه', body: 'حساب التكلفة الفعلية مقابل المردود — حالات تستحق الـ Pro vs Basic.', industry: ['car_wash', 'home_cleaning', 'plumbing', 'electrical', 'ac_maintenance', 'appliance_repair'], durationMin: 9, category: 'operations' },

  // Compliance
  { id: 'c-001', title: 'ZATCA Phase 2: متى تكون إلزامية لمنشأتك', body: 'قياس إيراداتك — تواريخ الالتزام + خطوات الجاهزية.', industry: ['*'], durationMin: 5, category: 'compliance' },
  { id: 'c-002', title: 'PDPL: نظام حماية البيانات الشخصية السعودي', body: 'ما يجب على عيادتك/صالونك توثيقه، ولماذا Jdawil يجمعه لك جاهز.', industry: ['clinic', 'salon', 'beauty_home', 'spa', 'professional_services'], durationMin: 8, category: 'compliance' },
  { id: 'c-003', title: 'GOSI ووزارة العمل: تجنّب الغرامات الشائعة', body: 'الخطوات اللي تنسى أصحاب المنشآت الجدد — تأمين موظفين + تجديد إقامات.', industry: ['*'], durationMin: 7, category: 'compliance' },
];

const CATEGORY_LABEL: Record<Course['category'], string> = {
  finance: 'مالية',
  marketing: 'تسويق',
  operations: 'تشغيل',
  compliance: 'امتثال',
};

const CATEGORY_COLOR: Record<Course['category'], string> = {
  finance: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  marketing: 'border-pink-500/30 bg-pink-500/5 text-pink-300',
  operations: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
  compliance: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
};

export default function VendorAcademy() {
  const { user } = useAuth();
  const industry = user?.vendor?.industry ?? null;
  const relevant = (c: Course) => c.industry.includes('*') || (industry && c.industry.includes(industry));

  const my = COURSES.filter(relevant);
  const others = COURSES.filter((c) => !relevant(c));

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-5xl mx-auto">
      <Helmet>
        <title>أكاديمية Jdawil</title>
      </Helmet>

      {/* Hero */}
      <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-bl from-indigo-500/10 to-transparent p-6 sm:p-8 mb-6 text-center">
        <GraduationCap className="w-10 h-10 text-indigo-300 mx-auto mb-3" />
        <h1 className="text-2xl sm:text-3xl font-black text-white">أكاديمية Jdawil</h1>
        <p className="text-slate-300 text-sm mt-2 max-w-md mx-auto leading-relaxed">
          دروس قصيرة من خبراء السوق السعودي — اقرأ في 5-10 دقائق وطبّق على مشروعك اليوم.
        </p>
      </div>

      {/* Most relevant for this vendor */}
      {my.length > 0 && (
        <section className="mb-6">
          <h2 className="text-white font-bold text-base mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            مختارة لقطاعك
          </h2>
          <CourseList courses={my} />
        </section>
      )}

      {/* Other */}
      {others.length > 0 && (
        <section className="mb-6">
          <h2 className="text-white font-bold text-base mb-3">دورات أخرى مفيدة</h2>
          <CourseList courses={others} />
        </section>
      )}

      {/* Footer CTA */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mt-6 text-center">
        <MessageCircle className="w-7 h-7 text-emerald-300 mx-auto mb-2" />
        <p className="text-white font-bold">لديك سؤال محدد؟</p>
        <p className="text-slate-400 text-xs mt-1">جرّب المستشار الذكي — مدرّب على بياناتك وأرقام السوق.</p>
        <a
          href="/vendor/ai-advisor"
          className="inline-block mt-3 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold"
        >
          افتح المستشار الذكي
        </a>
      </div>
    </div>
  );
}

function CourseList({ courses }: { courses: Course[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {courses.map((c, i) => (
        <motion.article
          key={c.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] hover:border-white/20 p-5 transition-colors"
        >
          <div className="flex items-center justify-between mb-2">
            <span className={`text-[10px] font-bold border rounded-full px-2 py-0.5 ${CATEGORY_COLOR[c.category]}`}>
              {CATEGORY_LABEL[c.category]}
            </span>
            <span className="text-[11px] text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> {c.durationMin} د
            </span>
          </div>
          <h3 className="text-white font-bold text-sm leading-tight mb-1.5">{c.title}</h3>
          <p className="text-slate-400 text-xs leading-relaxed">{c.body}</p>
          <button
            disabled
            className="mt-3 inline-flex items-center gap-1.5 text-xs text-indigo-300 font-bold opacity-70"
          >
            <Play className="w-3 h-3" /> قريباً — قيد التحضير
          </button>
        </motion.article>
      ))}
    </div>
  );
}
