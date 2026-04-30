import { Link } from 'react-router-dom';
import { ShieldCheck, Check } from 'lucide-react';

const PRODUCT_LINKS = [
  { to: '/pricing', label: 'الأسعار' },
  { to: '/demo', label: 'تجربة مباشرة' },
  { to: '/onboard', label: 'سجّل منشأتك' },
  { to: '/login', label: 'دخول التاجر' },
];

const INDUSTRY_LINKS = [
  { to: '/for/car-wash', label: 'مغاسل السيارات' },
  { to: '/for/salon', label: 'الصالونات والتجميل' },
  { to: '/for/beauty-home', label: 'تجميل منزلي وسبا' },
  { to: '/for/home-cleaning', label: 'تنظيف منازل' },
  { to: '/for/ac-maintenance', label: 'صيانة المكيفات' },
  { to: '/for/plumbing', label: 'سباكة وكشف تسرّبات' },
  { to: '/for/electrical', label: 'كهرباء وتمديدات' },
  { to: '/for/freelancer', label: 'فري لانسر' },
  { to: '/for/movers', label: 'شركات نقل العفش' },
];

const RESOURCE_LINKS = [
  { to: '/blog', label: 'المدونة' },
  { to: '/privacy', label: 'سياسة الخصوصية' },
  { to: '/terms', label: 'الشروط والأحكام' },
];

export default function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-[#070b15] border-t border-white/8 text-slate-300" dir="rtl">
      {/* Trust strip */}
      <div className="border-b border-white/8">
        <div className="max-w-6xl mx-auto px-4 py-5 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-400" />
            <span>باقة مجانية دائمة</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-400" />
            <span>بدون بطاقة ائتمان</span>
          </div>
          <div className="flex items-center gap-2">
            <Check size={16} className="text-emerald-400" />
            <span>إلغاء في أي وقت</span>
          </div>
          <div className="flex items-center gap-2">
            <ShieldCheck size={16} className="text-slate-400" />
            <span>استضافة داخل السعودية</span>
          </div>
        </div>
      </div>

      {/* Main grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
                <span className="text-[#0b1220] font-black text-lg">ج</span>
              </div>
              <div className="leading-none">
                <p className="text-white font-black text-base">جداول</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Jadawel</p>
              </div>
            </Link>
            <p className="text-slate-400 text-sm leading-relaxed mt-4 max-w-sm">
              منصة سعودية لإدارة الحجوزات والمنشآت الخدمية — مصمَّمة ليشتغل صاحب المشروع براحة،
              بدون تعب تنسيق الحجوزات أو إدارة الموظفين يدوياً.
            </p>
            <Link
              to="/onboard"
              className="inline-block mt-5 px-5 py-2.5 text-sm font-black rounded-md bg-white text-[#0b1220] hover:bg-slate-100 transition-colors"
            >
              جرّبه مجاناً
            </Link>
            <p className="text-[11px] text-slate-500 mt-2">
              بزنسك صغير؟ اشترك في الباقة المجانية وابدأ بدون أي التزام مالي.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">المنصة</h4>
            <ul className="space-y-2.5">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Industries */}
          <div>
            <h4 className="text-white font-bold text-sm mb-4">قطاعات نخدمها</h4>
            <ul className="space-y-2.5">
              {INDUSTRY_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Resources */}
          <div className="col-span-2 md:col-span-1">
            <h4 className="text-white font-bold text-sm mb-4">روابط</h4>
            <ul className="space-y-2.5">
              {RESOURCE_LINKS.map((l) => (
                <li key={l.to}>
                  <Link to={l.to} className="text-sm text-slate-400 hover:text-white transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-white/8 my-10" />

        {/* Bottom row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <p>© {year} جداول — جميع الحقوق محفوظة.</p>
          <p>صُنع في المملكة العربية السعودية 🇸🇦</p>
        </div>
      </div>
    </footer>
  );
}
