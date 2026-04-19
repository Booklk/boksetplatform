import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, CalendarPlus, Users, BarChart2, Settings,
  Zap, Package, MapPin, CreditCard, FileText,
  ChevronRight, Home, Star, ShoppingCart,
  HelpCircle,
} from 'lucide-react';
import api from '../lib/api';

// Static navigation commands (always available)
const VENDOR_COMMANDS = [
  { id: 'nav-dashboard', label: 'لوحة التحكم', icon: Home, path: '/vendor/dashboard', group: 'تنقل' },
  { id: 'nav-operations', label: 'العمليات اليومية', icon: Zap, path: '/vendor/operations', group: 'تنقل' },
  { id: 'nav-bookings', label: 'الحجوزات', icon: CalendarPlus, path: '/admin/bookings', group: 'تنقل' },
  { id: 'nav-dispatch', label: 'التوزيع الذكي', icon: MapPin, path: '/vendor/dispatch', group: 'تنقل' },
  { id: 'nav-employees', label: 'الموظفون', icon: Users, path: '/vendor/employees', group: 'تنقل' },
  { id: 'nav-fleet', label: 'الأسطول', icon: '🚗', path: '/vendor/fleet', group: 'تنقل', isEmoji: true },
  { id: 'nav-analytics', label: 'التحليلات', icon: BarChart2, path: '/vendor/analytics', group: 'تنقل' },
  { id: 'nav-payroll', label: 'الرواتب والمكافآت', icon: CreditCard, path: '/vendor/payroll', group: 'تنقل' },
  { id: 'nav-inventory', label: 'المخزون', icon: Package, path: '/admin/inventory', group: 'تنقل' },
  { id: 'nav-reports', label: 'التقارير', icon: FileText, path: '/admin/reports', group: 'تنقل' },
  { id: 'nav-settings', label: 'الإعدادات', icon: Settings, path: '/vendor/setup', group: 'تنقل' },
  { id: 'nav-pos', label: 'نقطة البيع (كاشير)', icon: ShoppingCart, path: '/vendor/pos', group: 'تنقل' },
  { id: 'nav-ratings', label: 'التقييمات', icon: Star, path: '/vendor/ratings', group: 'تنقل' },
  { id: 'nav-support', label: 'الدعم الفني', icon: HelpCircle, path: '/vendor/support', group: 'تنقل' },
  { id: 'nav-livemap', label: 'الخريطة المباشرة', icon: MapPin, path: '/vendor/livemap', group: 'تنقل' },
  { id: 'nav-vatreport', label: 'تقرير الضريبة (VAT)', icon: FileText, path: '/vendor/vat-report', group: 'تنقل' },
  { id: 'nav-expenses', label: 'المصروفات والإيرادات', icon: CreditCard, path: '/vendor/expenses', group: 'المالية' },
  { id: 'nav-profit-calc', label: 'حاسبة الربح الحقيقي', icon: BarChart2, path: '/vendor/profit-calculator', group: 'المالية' },
  { id: 'nav-invoices', label: 'الفواتير', icon: FileText, path: '/vendor/invoices', group: 'المالية' },
  { id: 'nav-suppliers', label: 'الموردون', icon: Package, path: '/vendor/suppliers', group: 'المخزون' },
];

interface SearchResult {
  id: string;
  label: string;
  subtitle?: string;
  group: string;
  icon?: any;
  isEmoji?: boolean;
  path?: string;
  action?: () => void;
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Open/close with Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setSelectedIdx(0);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Search logic
  useEffect(() => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    const q = query.toLowerCase();
    const navResults = VENDOR_COMMANDS
      .filter(c => c.label.includes(query) || c.label.toLowerCase().includes(q))
      .slice(0, 5);

    setSearchResults(navResults);
    setSelectedIdx(0);

    // Also search bookings/customers from API (debounced)
    if (query.length >= 2) {
      setIsSearching(true);
      const timer = setTimeout(async () => {
        try {
          const [bookingsRes, customersRes] = await Promise.all([
            api.get(`/bookings?search=${encodeURIComponent(query)}&limit=3`).catch(() => ({ data: [] })),
            api.get(`/customers?search=${encodeURIComponent(query)}&limit=3`).catch(() => ({ data: [] })),
          ]);

          const bookingResults: SearchResult[] = (bookingsRes.data?.bookings || bookingsRes.data || [])
            .slice(0, 3)
            .map((b: any) => ({
              id: `booking-${b.id}`,
              label: `حجز #${b.bookingNumber || b.id}`,
              subtitle: `${b.customerName || ''} — ${b.status || ''}`,
              group: 'حجوزات',
              icon: CalendarPlus,
              path: `/admin/bookings`,
            }));

          const customerResults: SearchResult[] = (customersRes.data?.customers || customersRes.data || [])
            .slice(0, 3)
            .map((c: any) => ({
              id: `customer-${c.id}`,
              label: c.name || c.nameAr || 'عميل',
              subtitle: c.phone || '',
              group: 'عملاء',
              icon: Users,
              path: `/admin/customers`,
            }));

          setSearchResults([...navResults, ...bookingResults, ...customerResults]);
        } finally {
          setIsSearching(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [query]);

  // Keyboard navigation
  const allResults = query ? searchResults : VENDOR_COMMANDS.slice(0, 8);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, allResults.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && allResults[selectedIdx]) {
        const item = allResults[selectedIdx];
        if ('path' in item && item.path) { navigate(item.path); setOpen(false); }
        if ('action' in item && item.action) { item.action(); setOpen(false); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, allResults, selectedIdx, navigate]);

  // Group results
  const grouped = allResults.reduce((acc, item) => {
    if (!acc[item.group]) acc[item.group] = [];
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  const handleSelect = (item: SearchResult) => {
    if (item.path) navigate(item.path);
    if (item.action) item.action();
    setOpen(false);
    setQuery('');
  };

  let flatIdx = 0;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[15%] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 px-4"
          >
            <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-4 py-4 border-b border-white/[0.06]">
                <Search size={18} className="text-slate-400 flex-shrink-0" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={e => { setQuery(e.target.value); setSelectedIdx(0); }}
                  placeholder="ابحث عن أي شيء... (حجز، موظف، صفحة)"
                  className="flex-1 bg-transparent text-white placeholder-slate-500 outline-none text-base"
                  dir="rtl"
                />
                {isSearching && <div className="w-4 h-4 border-2 border-blue-400/40 border-t-blue-400 rounded-full animate-spin" />}
                <kbd className="hidden sm:flex items-center gap-1 text-[10px] text-slate-500 bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5">ESC</kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto py-2" dir="rtl">
                {Object.entries(grouped).map(([group, items]) => (
                  <div key={group}>
                    <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{group}</div>
                    {items.map((item) => {
                      const currentIdx = flatIdx++;
                      const isSelected = currentIdx === selectedIdx;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors ${isSelected ? 'bg-blue-600/20 text-white' : 'text-slate-300 hover:bg-white/5'}`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-blue-600/30' : 'bg-white/5'}`}>
                            {item.isEmoji ? (
                              <span className="text-base">{item.icon as string}</span>
                            ) : item.icon ? (
                              <item.icon size={15} className={isSelected ? 'text-blue-400' : 'text-slate-400'} />
                            ) : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium truncate">{item.label}</div>
                            {item.subtitle && <div className="text-xs text-slate-500 truncate">{item.subtitle}</div>}
                          </div>
                          <ChevronRight size={14} className={`flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-600'}`} />
                        </button>
                      );
                    })}
                  </div>
                ))}

                {query && allResults.length === 0 && !isSearching && (
                  <div className="text-center py-8 text-slate-500 text-sm">لا توجد نتائج لـ "{query}"</div>
                )}
              </div>

              {/* Footer shortcuts */}
              <div className="flex items-center gap-4 px-4 py-2.5 border-t border-white/[0.06] text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 rounded px-1">↑↓</kbd> للتنقل</span>
                <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 rounded px-1">↵</kbd> فتح</span>
                <span className="flex items-center gap-1"><kbd className="bg-slate-800 border border-slate-700 rounded px-1">ESC</kbd> إغلاق</span>
                <span className="mr-auto">Jdawil</span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
