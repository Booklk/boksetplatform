import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Home, Sparkles, CalendarPlus, ClipboardList, User, LayoutGrid, MessageSquare, Plus, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import api from '../lib/api';
import { haptics } from '../lib/haptics';
import { Booking } from '../types';
import { useAuth } from '../hooks/useAuth';

interface Tab {
  path: string;
  label: string;
  icon: LucideIcon;
  badge?: 'bookings' | 'unread';
  isCenter?: boolean;
}

const CUSTOMER_TABS: Tab[] = [
  { path: '/app',                label: 'الرئيسية',  icon: Home },
  { path: '/app/bookings',       label: 'حجوزاتي',   icon: ClipboardList, badge: 'bookings' },
  { path: '/app/book/1',         label: 'احجز الآن', icon: CalendarPlus, isCenter: true },
  { path: '/app/loyalty',        label: 'نقاطي',     icon: Sparkles },
  { path: '/app/profile',        label: 'حسابي',     icon: User },
];

const VENDOR_TABS: Tab[] = [
  { path: '/vendor',             label: 'الرئيسية',     icon: Home },
  { path: '/vendor/queue',       label: 'الطابور',      icon: LayoutGrid },
  { path: '/vendor/calendar',    label: 'حجز جديد',    icon: Plus, isCenter: true },
  { path: '/vendor/team-room',   label: 'غرفة الفريق',  icon: MessageSquare, badge: 'unread' },
  { path: '/vendor/settings',    label: 'الإعدادات',    icon: Settings },
];

export function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const role = user?.role;

  // Pick tabs by role. Vendors and employees see operational tabs; customers see booking tabs.
  const isVendorSide = role === 'vendor_admin' || role === 'admin' || role === 'employee';
  const TABS = isVendorSide ? VENDOR_TABS : CUSTOMER_TABS;

  // Customer-side bookings badge — only fetched for customers.
  const { data: bookings = [] } = useQuery<Booking[]>({
    queryKey: ['my-bookings-badge'],
    queryFn: () => api.get('/bookings/my').then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: !isVendorSide,
  });

  const activeBookingCount = bookings.filter(b =>
    ['pending', 'confirmed', 'on_way', 'arrived', 'in_progress'].includes(b.status)
  ).length;

  // Vendor-side team-room unread badge.
  const { data: teamUnread } = useQuery<{ count: number }>({
    queryKey: ['team-unread-badge'],
    queryFn: () => api.get('/team/unread-count').then(r => r.data),
    refetchInterval: 30_000,
    staleTime: 15_000,
    enabled: isVendorSide,
  });
  const unreadCount = teamUnread?.count ?? 0;

  const isActive = (tab: Tab) => {
    if (tab.path === '/app' || tab.path === '/vendor') return location.pathname === tab.path;
    return location.pathname.startsWith(tab.path);
  };

  function handleTabPress(tab: Tab) {
    haptics.light();
    navigate(tab.path);
  }

  return (
    <motion.nav
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22, delay: 0.15 }}
      className="fixed bottom-0 inset-x-0 z-50 md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      dir="rtl"
    >
      {/* Glassmorphism bar */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-t border-slate-700/50">
        <div className="flex items-stretch justify-around px-1 pt-2 pb-2">
          {TABS.map((tab) => {
            const active = isActive(tab);
            const badgeCount = tab.badge === 'bookings'
              ? activeBookingCount
              : tab.badge === 'unread'
              ? unreadCount
              : 0;
            const showBadge = tab.badge && badgeCount > 0;
            const Icon = tab.icon;

            /* Center floating button (احجز الآن) */
            if (tab.isCenter) {
              return (
                <button
                  key={tab.path}
                  onClick={() => handleTabPress(tab)}
                  className="flex-1 flex flex-col items-center gap-1 relative min-w-0 -mt-5 min-h-[44px]"
                  aria-label={tab.label}
                >
                  <motion.div
                    animate={active ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="w-14 h-14 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-500/40 ring-4 ring-slate-900/80"
                  >
                    <Icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                  </motion.div>
                  <span
                    className={`text-xs font-bold leading-tight truncate max-w-full transition-colors ${
                      active ? 'text-brand-400' : 'text-slate-500'
                    }`}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            }

            return (
              <button
                key={tab.path}
                onClick={() => handleTabPress(tab)}
                className="flex-1 flex flex-col items-center gap-1 py-2.5 px-1 relative min-w-0 min-h-[52px]"
                aria-label={tab.label}
              >
                {/* Animated active indicator pill */}
                <AnimatePresence>
                  {active && (
                    <motion.div
                      layoutId="bottomNavPill"
                      className="absolute inset-x-1 top-0 h-0.5 rounded-full bg-brand-500"
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: 1 }}
                      exit={{ scaleX: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </AnimatePresence>

                {/* Icon with bounce on active */}
                <motion.div
                  animate={active ? { scale: [1, 1.25, 1] } : { scale: 1 }}
                  transition={{ duration: 0.3 }}
                  className="relative"
                >
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      active ? 'text-brand-400' : 'text-slate-500'
                    }`}
                    strokeWidth={active ? 2.5 : 2}
                  />
                  {/* Badge dot */}
                  {showBadge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -left-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                    >
                      <span className="text-[9px] font-black text-white leading-none">
                        {badgeCount > 9 ? '9+' : badgeCount}
                      </span>
                    </motion.span>
                  )}
                </motion.div>

                {/* Label */}
                <span
                  className={`text-xs font-bold leading-tight truncate max-w-full transition-colors ${
                    active ? 'text-brand-400' : 'text-slate-500'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </motion.nav>
  );
}
