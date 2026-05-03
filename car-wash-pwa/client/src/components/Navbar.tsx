import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Calendar, Package, BarChart3, Users, Warehouse, LogOut,
  DollarSign, ChevronDown, Search, Map, CreditCard, Building2,
  Briefcase, FileText, Truck, Settings, Star, Clock, Zap,
  ReceiptText, ShoppingBag, TrendingUp, LayoutGrid, Radio,
  HelpCircle, Calculator, Layers, UserCheck, MapPin, Sparkles,
  Send, Gift, Bot, Target, Bell, UserCircle, Repeat, PieChart, Brain,
  MessageSquare,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'framer-motion';
import PresenceIndicator from './PresenceIndicator';
import { useVendorTheme } from '../store/vendorTheme';

// ─── Nav definitions ──────────────────────────────────────────────────────────
const customerNav = [
  { to: '/app', icon: Home, label: 'الرئيسية' },
  { to: '/app/bookings', icon: Calendar, label: 'حجوزاتي' },
  { to: '/app/notifications', icon: Bell, label: 'الإشعارات' },
  { to: '/app/profile', icon: UserCircle, label: 'حسابي' },
];

const employeeNav = [
  { to: '/employee', icon: Home, label: 'طلباتي' },
  { to: '/employee/new-booking', icon: Calendar, label: 'حجز جديد' },
];

const adminNav = [
  { to: '/admin', icon: BarChart3, label: 'لوحة التحكم' },
  { to: '/admin/bookings', icon: Calendar, label: 'الحجوزات' },
  { to: '/admin/services', icon: Package, label: 'الخدمات' },
  { to: '/admin/customers', icon: Users, label: 'العملاء' },
  { to: '/admin/employees', icon: Users, label: 'الموظفين' },
  { to: '/admin/inventory', icon: Warehouse, label: 'المخزون' },
  { to: '/admin/financials', icon: DollarSign, label: 'المالية' },
];

interface NavSection { label: string; items: { to: string; icon: React.ElementType; label: string }[] }

const vendorNavSections: NavSection[] = [
  {
    label: 'الرئيسية',
    items: [
      { to: '/vendor', icon: Home, label: 'لوحة التحكم' },
      { to: '/vendor/studio', icon: Sparkles, label: 'استوديو التصميم الذكي ✨' },
      { to: '/vendor/ai-advisor', icon: Brain, label: 'المستشار الذكي' },
      { to: '/vendor/queue', icon: LayoutGrid, label: 'طابور الخدمة' },
      { to: '/vendor/pos', icon: Zap, label: 'نقطة البيع' },
      { to: '/vendor/calendar', icon: Calendar, label: 'التقويم' },
    ],
  },
  {
    label: 'التشغيل',
    items: [
      { to: '/vendor/dispatch', icon: Truck, label: 'التوزيع والإرسال' },
      { to: '/vendor/livemap', icon: MapPin, label: 'الخريطة المباشرة' },
      { to: '/vendor/operations', icon: Radio, label: 'العمليات' },
      { to: '/vendor/schedule', icon: Clock, label: 'الجداول الزمنية' },
      { to: '/vendor/shifts', icon: UserCheck, label: 'ساعات العمل' },
    ],
  },
  {
    label: 'الموارد البشرية',
    items: [
      { to: '/vendor/team-room', icon: MessageSquare, label: 'غرفة المتجر 💬' },
      { to: '/vendor/employees', icon: Users, label: 'الموظفون' },
      { to: '/vendor/leaderboard', icon: Star, label: 'لوحة المتصدرين' },
      { to: '/vendor/payroll', icon: DollarSign, label: 'الرواتب' },
    ],
  },
  {
    label: 'المالية',
    items: [
      { to: '/vendor/roi', icon: TrendingUp, label: 'عائدك من Jdawil ✨' },
      { to: '/vendor/financial-statements', icon: FileText, label: 'القوائم المالية' },
      { to: '/vendor/expenses', icon: ReceiptText, label: 'المصروفات والدخل' },
      { to: '/vendor/profit-calculator', icon: Calculator, label: 'حاسبة الربح' },
      { to: '/vendor/invoices', icon: FileText, label: 'الفواتير' },
      { to: '/vendor/vat-report', icon: ReceiptText, label: 'تقرير الضريبة' },
      { to: '/vendor/exports', icon: ShoppingBag, label: 'تصدير البيانات' },
    ],
  },
  {
    label: 'التحليلات',
    items: [
      { to: '/vendor/advanced-analytics', icon: PieChart, label: 'تحليلات متقدمة' },
      { to: '/vendor/analytics', icon: TrendingUp, label: 'التحليلات' },
      { to: '/vendor/employee-performance', icon: UserCheck, label: 'أداء الموظفين' },
      { to: '/vendor/ratings', icon: Star, label: 'التقييمات' },
    ],
  },
  {
    label: 'التسويق والمبيعات',
    items: [
      { to: '/vendor/crm', icon: UserCircle, label: 'إدارة العملاء CRM' },
      { to: '/vendor/customer-import', icon: Users, label: 'استيراد عملاء' },
      { to: '/vendor/automations', icon: Bot, label: 'الأتمتة التسويقية' },
      { to: '/vendor/segments', icon: Target, label: 'ذكاء العملاء' },
      { to: '/vendor/campaigns', icon: Send, label: 'حملات واتساب' },
      { to: '/vendor/gift-cards', icon: Gift, label: 'بطاقات الهدايا' },
      { to: '/vendor/shop', icon: ShoppingBag, label: 'متجر المنتجات' },
      { to: '/vendor/promos', icon: Layers, label: 'العروض والخصومات' },
    ],
  },
  {
    label: 'العملاء والخدمات',
    items: [
      { to: '/vendor/services', icon: Package, label: 'الخدمات' },
      { to: '/vendor/fleet', icon: Map, label: 'الأسطول' },
      { to: '/vendor/subscriptions', icon: CreditCard, label: 'الاشتراكات' },
      { to: '/vendor/corporate', icon: Building2, label: 'حسابات الشركات' },
      { to: '/vendor/dynamic-pricing', icon: Zap, label: 'التسعير الديناميكي' },
      { to: '/vendor/time-blocks', icon: Clock, label: 'حجب أوقات الحجز' },
    ],
  },
  {
    label: 'الإعدادات',
    items: [
      { to: '/vendor/notifications', icon: Bell, label: 'مركز الإشعارات' },
      { to: '/vendor/help', icon: HelpCircle, label: 'مركز المساعدة' },
      { to: '/vendor/branding', icon: Briefcase, label: 'الهوية البصرية' },
      { to: '/vendor/store-builder', icon: Sparkles, label: 'منشئ صفحة الحجز' },
      { to: '/vendor/brand-identity', icon: Sparkles, label: 'الهوية البصرية ✨' },
      { to: '/vendor/qr', icon: FileText, label: 'رمز QR' },
      { to: '/vendor/media-studio', icon: Sparkles, label: 'استوديو الميديا ✨' },
      { to: '/vendor/preferences', icon: Settings, label: 'الإعدادات التشغيلية' },
      { to: '/vendor/gallery', icon: Sparkles, label: 'معرض الأعمال' },
      { to: '/vendor/pages', icon: FileText, label: 'صفحات المتجر' },
      { to: '/vendor/brand-kit', icon: Sparkles, label: 'هوية AI ✨' },
      { to: '/vendor/suppliers', icon: ShoppingBag, label: 'الموردون' },
      { to: '/vendor/autopilot', icon: Bot, label: 'الطيّار الآلي ⚡' },
      { to: '/vendor/platform-sub', icon: CreditCard, label: 'اشتراك المنصة' },
      { to: '/vendor/payment-gateway', icon: CreditCard, label: 'بوابة الدفع للعملاء' },
      { to: '/vendor/branches', icon: Briefcase, label: 'الفروع' },
      { to: '/vendor/mobile-app', icon: Sparkles, label: 'تطبيق متجرك' },
      { to: '/vendor/refer', icon: Gift, label: 'ادعُ تاجر واكسب' },
      { to: '/vendor/support', icon: HelpCircle, label: 'الدعم الفني' },
      { to: '/vendor/settings', icon: Settings, label: 'الإعدادات' },
    ],
  },
];

const superAdminNavSections: NavSection[] = [
  {
    label: 'الإدارة',
    items: [
      { to: '/super-admin', icon: BarChart3, label: 'لوحة التحكم' },
      { to: '/super-admin/vendors', icon: Building2, label: 'التجار' },
      { to: '/super-admin/users', icon: Users, label: 'المستخدمين' },
      { to: '/super-admin/revenue', icon: TrendingUp, label: 'الإيرادات' },
      { to: '/super-admin/mobile-app-orders', icon: Sparkles, label: 'طلبات التطبيقات' },
      { to: '/super-admin/plans', icon: CreditCard, label: 'الباقات' },
      { to: '/super-admin/support', icon: HelpCircle, label: 'الدعم' },
      { to: '/super-admin/announce', icon: Send, label: 'إعلانات' },
      { to: '/super-admin/health', icon: Radio, label: 'صحة النظام' },
      { to: '/super-admin/audit-logs', icon: FileText, label: 'سجل العمليات' },
    ],
  },
];

// ─── Sidebar section with collapsible groups ─────────────────────────────────
function SidebarSections({
  sections,
  primaryColor,
}: {
  sections: NavSection[];
  primaryColor: string;
}) {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <div className="flex-1 overflow-y-auto space-y-1 py-2 scrollbar-thin scrollbar-thumb-slate-700">
      {sections.map((section) => {
        const isCollapsed = collapsed[section.label];
        return (
          <div key={section.label}>
            <button
              onClick={() => setCollapsed(prev => ({ ...prev, [section.label]: !prev[section.label] }))}
              className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
            >
              {section.label}
              <ChevronDown
                size={12}
                className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
              />
            </button>
            {!isCollapsed && section.items.map(({ to, icon: Icon, label }) => {
              const active = location.pathname === to ||
                (to !== '/vendor' && to !== '/super-admin' && location.pathname.startsWith(to));
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex items-center gap-3 mx-2 px-3 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                    active
                      ? 'text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  style={active ? {
                    backgroundColor: `${primaryColor}25`,
                    borderLeft: `3px solid ${primaryColor}`,
                    color: primaryColor,
                  } : {}}
                >
                  <Icon size={16} />
                  <span className="truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ─── Role label helper ────────────────────────────────────────────────────────
function roleLabel(role: string) {
  const map: Record<string, string> = {
    vendor_admin: 'مالك المتجر',
    admin: 'المدير',
    employee: 'موظف',
    customer: 'عميل',
    super_admin: 'مدير المنصة',
  };
  return map[role] ?? role;
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────
export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const { vendorId, nameAr: vendorName, logoUrl: vendorLogoUrl, primaryColor } = useVendorTheme();

  const isVendorPage = vendorId !== null;

  if (!user) return null;

  const hasSidebar = user.role === 'admin' || user.role === 'vendor_admin' || user.role === 'super_admin';

  const navItems =
    user.role === 'admin' ? adminNav :
    user.role === 'employee' ? employeeNav :
    customerNav;

  const navSections =
    user.role === 'vendor_admin' ? vendorNavSections :
    user.role === 'super_admin' ? superAdminNavSections :
    user.role === 'admin' ? [{ label: 'القائمة', items: adminNav }] :
    [];

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const logoLetter = isVendorPage ? vendorName?.charAt(0) : 'W';

  return (
    <>
      {/* Desktop sidebar */}
      {hasSidebar && (
        <nav className="hidden md:flex flex-col w-64 min-h-screen bg-slate-900 border-l border-slate-700/50 fixed right-0 top-0 z-40">
          {/* Brand header */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-700/50 shrink-0">
            {isVendorPage && vendorLogoUrl ? (
              <img
                src={vendorLogoUrl}
                alt={vendorName}
                className="w-10 h-10 rounded-xl object-cover"
                style={{ border: `2px solid ${primaryColor}60` }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center text-xl font-bold text-white shrink-0"
                style={{ background: `linear-gradient(135deg, ${primaryColor ?? '#2563eb'}, ${primaryColor ?? '#2563eb'}99)` }}
              >
                {logoLetter}
              </div>
            )}
            <div className="min-w-0">
              <p className="font-black text-white text-sm truncate">
                {isVendorPage ? vendorName : 'Jdawil'}
              </p>
              <p className="text-xs text-slate-400">{roleLabel(user.role)}</p>
            </div>
          </div>

          {/* Nav sections */}
          <SidebarSections sections={navSections} primaryColor={primaryColor ?? '#2563eb'} />

          {/* Footer */}
          <div className="shrink-0 border-t border-slate-700/50 p-3 space-y-1">
            <div className="px-3 py-2 rounded-lg bg-slate-800/50">
              <p className="text-xs font-bold text-white truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.phone}</p>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-red-400 hover:bg-red-900/20 font-semibold text-sm transition-all"
            >
              <LogOut size={16} />
              تسجيل الخروج
            </button>
          </div>
        </nav>
      )}

      {/* Top header bar */}
      <header
        className={`fixed top-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-xl border-b border-slate-700/50 safe-top ${hasSidebar ? 'md:right-64' : ''}`}
      >
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left: brand mark (mobile) */}
          <div className="flex items-center gap-3">
            {isVendorPage && vendorLogoUrl ? (
              <img
                src={vendorLogoUrl}
                alt={vendorName}
                className="w-8 h-8 rounded-lg object-cover"
                style={{ border: `2px solid ${primaryColor}60` }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold text-white"
                style={{ background: `linear-gradient(135deg, ${primaryColor ?? '#2563eb'}, ${primaryColor ?? '#2563eb'}99)` }}
              >
                {logoLetter}
              </div>
            )}
            <div>
              <p className="font-black text-white text-sm leading-none">
                {isVendorPage ? vendorName : 'Jdawil'}
              </p>
              <p className="text-xs text-slate-400 leading-none">{roleLabel(user.role)}</p>
            </div>
          </div>

          {/* Right: presence + search + menu */}
          <div className="flex items-center gap-2">
            <PresenceIndicator />
            <button
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true });
                window.dispatchEvent(event);
              }}
              className="flex items-center gap-2 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-1.5 text-sm transition-all"
            >
              <Search size={14} />
              <span className="hidden sm:inline">بحث سريع</span>
              <kbd className="hidden sm:flex text-[10px] bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">⌘K</kbd>
            </button>
            <span className="text-sm text-slate-300 hidden sm:block">{user.name}</span>
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              <ChevronDown size={16} className={`text-slate-400 transition-transform ${menuOpen ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-14 left-4 right-4 bg-slate-800 border border-slate-700 rounded-xl p-2 shadow-2xl"
            >
              <div className="px-3 py-2 border-b border-slate-700 mb-2">
                <p className="text-sm font-bold text-white">{user.name}</p>
                <p className="text-xs text-slate-400">{user.phone}</p>
              </div>
              {/* Mobile sidebar links for vendor_admin */}
              {(user.role === 'vendor_admin' || user.role === 'super_admin') && (
                <div className="mb-2 max-h-64 overflow-y-auto space-y-1">
                  {(navSections as Array<{ label: string; items: Array<{ to: string; icon: any; label: string }> }>).flatMap(s => s.items).map(({ to, icon: Icon, label }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                        location.pathname === to
                          ? 'text-white bg-slate-700'
                          : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                      }`}
                    >
                      <Icon size={15} />
                      {label}
                    </Link>
                  ))}
                </div>
              )}
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-red-400 hover:bg-red-900/20 text-sm font-semibold"
              >
                <LogOut size={16} />
                تسجيل الخروج
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Mobile bottom nav (customers + employees only) */}
      {!hasSidebar && (
        <nav className="fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/50 safe-bottom md:hidden">
          <div className="flex items-center justify-around px-2 py-2">
            {navItems.slice(0, 5).map(({ to, icon: Icon, label }) => {
              const active = location.pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  className={`flex flex-col items-center gap-1 px-3 py-1 rounded-xl transition-all ${
                    active ? '' : 'text-slate-500 hover:text-slate-300'
                  }`}
                  style={active ? { color: primaryColor ?? '#2563eb' } : {}}
                >
                  <Icon size={20} />
                  <span className="text-xs font-semibold">{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </>
  );
}
