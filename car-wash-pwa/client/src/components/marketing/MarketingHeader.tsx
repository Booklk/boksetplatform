import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';

const NAV = [
  { to: '/', label: 'الرئيسية', exact: true },
  { to: '/blog', label: 'المدونة' },
  { to: '/pricing', label: 'الأسعار' },
  { to: '/demo', label: 'تجربة' },
];

export default function MarketingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors ${
        scrolled
          ? 'bg-[#0b1220]/92 backdrop-blur-md border-white/8'
          : 'bg-[#0b1220] border-transparent'
      }`}
      dir="rtl"
    >
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center">
            <span className="text-[#0b1220] font-black text-lg">ج</span>
          </div>
          <div className="leading-none">
            <p className="text-white font-black text-base">جداول</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Jadawel</p>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.exact}
              className={({ isActive }) =>
                `px-3 py-2 text-sm font-semibold rounded-md transition-colors ${
                  isActive
                    ? 'text-white bg-white/6'
                    : 'text-slate-300 hover:text-white hover:bg-white/4'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Desktop CTAs */}
        <div className="hidden md:flex items-center gap-2">
          <Link
            to="/login"
            className="px-3 py-2 text-sm font-semibold text-slate-300 hover:text-white transition-colors"
          >
            تسجيل الدخول
          </Link>
          <Link
            to="/onboard"
            className="px-4 py-2 text-sm font-black rounded-md bg-white text-[#0b1220] hover:bg-slate-100 transition-colors"
          >
            ابدأ مجاناً
          </Link>
        </div>

        {/* Mobile toggle */}
        <button
          aria-label={open ? 'إغلاق القائمة' : 'فتح القائمة'}
          onClick={() => setOpen((v) => !v)}
          className="md:hidden p-2 rounded-md text-slate-300 hover:text-white hover:bg-white/6 transition-colors"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden border-t border-white/8 bg-[#0b1220]">
          <nav className="px-4 py-3 flex flex-col">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.exact}
                className={({ isActive }) =>
                  `px-3 py-2.5 text-sm font-semibold rounded-md transition-colors ${
                    isActive
                      ? 'text-white bg-white/6'
                      : 'text-slate-300 hover:text-white hover:bg-white/4'
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
            <div className="h-px bg-white/8 my-2" />
            <Link
              to="/login"
              className="px-3 py-2.5 text-sm font-semibold text-slate-300 hover:text-white"
            >
              تسجيل الدخول
            </Link>
            <Link
              to="/onboard"
              className="mt-2 px-4 py-3 text-sm font-black rounded-md bg-white text-[#0b1220] text-center"
            >
              ابدأ مجاناً
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
