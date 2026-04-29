import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import {
  CalendarPlus, Wrench, Users, BarChart2, Settings, Download,
  Calendar, Clock, TrendingUp, Star, Gift, CheckCircle, AlertCircle,
  MapPin, Hash, ListOrdered, ShoppingCart, CalendarClock, Rocket,
  ChevronLeft, ChevronDown, X, Package, ArrowUpRight, ArrowDownRight, Plus,
  Minus, RefreshCw, AlertTriangle, DollarSign, FileText, Zap,
  Send, Activity, QrCode, Truck,
} from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import SetupChecklist from '../../components/SetupChecklist';
import SmartInsights from '../../components/SmartInsights';
import TrialBanner from '../../components/TrialBanner';
import MilestoneCelebration from '../../components/MilestoneCelebration';
import PushPrompt from '../../components/PushPrompt';
import { SetupWizardModal } from '../../components/SetupWizardModal';
import { BookingUsageBanner } from '../../components/BookingUsageBanner';

interface DashboardStats {
  totalBookings?: number;
  todayBookings?: number;
  completedToday?: number;
  pendingCount?: number;
  totalIncome?: number;
  monthIncome?: number;
  prevMonthIncome?: number;
  monthGrowth?: number | null;
  weekIncome?: number;
  monthExpenses?: number;
  monthProfit?: number;
  avgRating?: number;
  totalCustomers?: number;
  lowStockCount?: number;
  lowStockItems?: InventoryItem[];
}

// Keep backward compat alias
type Summary = DashboardStats;

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: string;
  minQuantity: string;
  costPerUnit: string;
  supplier?: string;
}

interface TopService {
  serviceName?: string;
  packageName?: string;
  bookingCount: number;
  totalRevenue: string;
}

interface WeekDay {
  day: string;
  income: string;
  expense: string;
}

interface Booking {
  id: number;
  bookingNumber?: string;
  address?: string;
  scheduledAt?: string;
  status?: string;
  customerName?: string;
  employeeName?: string;
}

interface LoyaltyProgram {
  programType?: 'punch_card' | 'points' | null;
  isActive?: boolean;
  punchesRequired?: number;
  currentPunches?: number;
  pointsBalance?: number;
}

interface DailySummary {
  date: string;
  bookings: { total: number; completed: number; cancelled: number; pending: number; inProgress: number };
  revenue: { today: number; currency: string };
  avgRating: number | null;
  topEmployee: { name: string; completions: number } | null;
  vehiclesUsed: number;
  newCustomers: number;
  tomorrowBookings: number;
  message: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } },
};

interface QuickAction {
  label: string;
  icon: typeof CalendarPlus;
  to: string;
  gradient: string;
  shadow: string;
}

interface ActionGroup {
  key: string;
  title: string;
  icon: typeof CalendarPlus;
  iconColor: string;
  actions: QuickAction[];
}

const actionGroups: ActionGroup[] = [
  {
    key: 'operations',
    title: 'العمليات',
    icon: Activity,
    iconColor: 'text-blue-400',
    actions: [
      { label: 'إضافة حجز', icon: CalendarPlus, to: '/employee/new-booking', gradient: 'from-violet-500 to-purple-600', shadow: 'shadow-purple-500/30' },
      { label: 'الجدول الزمني', icon: CalendarClock, to: '/vendor/schedule', gradient: 'from-cyan-500 to-sky-600', shadow: 'shadow-cyan-500/30' },
      { label: 'طابور', icon: ListOrdered, to: '/vendor/queue', gradient: 'from-sky-500 to-blue-600', shadow: 'shadow-sky-500/30' },
      { label: 'الكاشير', icon: ShoppingCart, to: '/vendor/pos', gradient: 'from-teal-500 to-emerald-600', shadow: 'shadow-teal-500/30' },
      { label: 'التوزيع الذكي', icon: Zap, to: '/vendor/dispatch', gradient: 'from-blue-500 to-indigo-600', shadow: 'shadow-blue-500/30' },
      { label: 'الخدمات', icon: Wrench, to: '/admin/services', gradient: 'from-blue-500 to-cyan-600', shadow: 'shadow-blue-500/30' },
    ],
  },
  {
    key: 'marketing',
    title: 'التسويق',
    icon: Rocket,
    iconColor: 'text-purple-400',
    actions: [
      { label: 'التقييمات', icon: Star, to: '/vendor/ratings', gradient: 'from-yellow-500 to-orange-500', shadow: 'shadow-yellow-500/30' },
      { label: 'تصدير', icon: Download, to: '/vendor/exports', gradient: 'from-indigo-500 to-blue-600', shadow: 'shadow-indigo-500/30' },
    ],
  },
  {
    key: 'finance',
    title: 'المالية',
    icon: DollarSign,
    iconColor: 'text-emerald-400',
    actions: [
      { label: 'التقارير', icon: BarChart2, to: '/admin/financials', gradient: 'from-amber-500 to-orange-600', shadow: 'shadow-amber-500/30' },
      { label: 'المصروفات', icon: DollarSign, to: '/vendor/expenses', gradient: 'from-rose-500 to-pink-600', shadow: 'shadow-rose-500/30' },
      { label: 'الفواتير', icon: FileText, to: '/vendor/invoices', gradient: 'from-violet-500 to-indigo-600', shadow: 'shadow-violet-500/30' },
      { label: 'الرواتب', icon: DollarSign, to: '/vendor/payroll', gradient: 'from-green-500 to-emerald-600', shadow: 'shadow-green-500/30' },
      { label: 'ضريبة VAT', icon: FileText, to: '/vendor/vat-report', gradient: 'from-orange-500 to-amber-600', shadow: 'shadow-orange-500/30' },
      { label: 'حاسبة الربح', icon: BarChart2, to: '/vendor/profit-calculator', gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30' },
    ],
  },
  {
    key: 'settings',
    title: 'الإعدادات',
    icon: Settings,
    iconColor: 'text-pink-400',
    actions: [
      { label: 'الموظفون', icon: Users, to: '/admin/employees', gradient: 'from-emerald-500 to-teal-600', shadow: 'shadow-emerald-500/30' },
      { label: 'الإعدادات', icon: Settings, to: '/vendor/settings', gradient: 'from-pink-500 to-rose-600', shadow: 'shadow-pink-500/30' },
    ],
  },
];

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pending: { label: 'معلق', bg: 'bg-amber-500/20', text: 'text-amber-300' },
  confirmed: { label: 'مؤكد', bg: 'bg-blue-500/20', text: 'text-blue-300' },
  in_progress: { label: 'جاري', bg: 'bg-violet-500/20', text: 'text-violet-300' },
  completed: { label: 'مكتمل', bg: 'bg-emerald-500/20', text: 'text-emerald-300' },
  cancelled: { label: 'ملغي', bg: 'bg-red-500/20', text: 'text-red-300' },
};

function timeAgo(date: string) {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  if (seconds < 3600) return `منذ ${Math.floor(seconds / 60)} دقيقة`;
  if (seconds < 86400) return `منذ ${Math.floor(seconds / 3600)} ساعة`;
  return `منذ ${Math.floor(seconds / 86400)} يوم`;
}

function formatTime(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('ar-SA', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/* ── QR Code card — shows store QR + download button ── */
function QRCard({ slug, vendorName }: { slug: string; vendorName: string }) {
  const [qrData, setQrData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const storeUrl = `${window.location.origin}/store/${slug}`;

  async function loadQR() {
    if (qrData) return;
    setLoading(true);
    try {
      const { data } = await api.get('/vendors/qr?format=dataurl');
      setQrData(data.dataUrl);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }

  function download() {
    if (!qrData) return;
    const a = document.createElement('a');
    a.href = qrData;
    a.download = `${slug}-qr.png`;
    a.click();
  }

  function copyLink() {
    navigator.clipboard.writeText(storeUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
      className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
    >
      <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
        <QrCode className="w-5 h-5 text-cyan-400" />
        باركود صفحة الحجز
      </h3>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* QR preview */}
        <div
          className="w-32 h-32 rounded-xl bg-white flex items-center justify-center flex-shrink-0 cursor-pointer border-2 border-white/20 hover:border-cyan-500/50 transition-colors overflow-hidden"
          onClick={loadQR}
        >
          {loading && <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />}
          {!loading && !qrData && (
            <div className="flex flex-col items-center gap-1 text-slate-400">
              <QrCode size={28} />
              <span className="text-xs">اضغط للعرض</span>
            </div>
          )}
          {qrData && <img src={qrData} alt="QR" className="w-full h-full object-contain" />}
        </div>

        {/* Actions */}
        <div className="flex-1 space-y-2.5">
          <p className="text-slate-400 text-sm">
            شارك هذا الباركود مع عملائك — يفتح صفحة حجزك مباشرة
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => { loadQR(); setTimeout(download, 500); }}
              className="flex items-center gap-1.5 text-xs bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 px-3 py-2 rounded-lg font-bold transition-all"
            >
              <Download size={14} />
              تحميل PNG
            </button>
            <button
              onClick={copyLink}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/15 border border-white/10 text-slate-300 px-3 py-2 rounded-lg font-bold transition-all"
            >
              {copied ? <CheckCircle size={14} className="text-emerald-400" /> : <FileText size={14} />}
              {copied ? 'تم النسخ!' : 'نسخ رابط المتجر'}
            </button>
          </div>
          <p className="text-slate-600 text-xs break-all">{storeUrl}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function VendorDashboard() {
  const { user } = useAuth();
  const vendorId = user?.vendorId;
  const vendorName = user?.vendor?.nameAr ?? user?.name ?? 'المغسلة';

  const { data: myVendor } = useQuery({
    queryKey: ['my-vendor'],
    queryFn: () => api.get('/vendors/me').then(r => r.data),
    enabled: !!vendorId,
    staleTime: 5 * 60_000,
  });
  const [setupBannerDismissed, setSetupBannerDismissed] = useState(
    () => localStorage.getItem('setup-banner-dismissed') === '1'
  );

  function dismissSetupBanner() {
    localStorage.setItem('setup-banner-dismissed', '1');
    setSetupBannerDismissed(true);
  }

  // Setup wizard for new vendors who haven't completed onboarding
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  useEffect(() => {
    if (myVendor && !myVendor.setupCompletedAt) {
      // Check if vendor has at least 1 service
      api.get('/services').then(r => {
        if (!r.data || r.data.length === 0) {
          setShowSetupWizard(true);
        }
      }).catch(() => {});
    }
  }, [myVendor]);

  // Show setup banner if vendor has no payment config set yet
  const showSetupBanner = !setupBannerDismissed && !user?.vendor?.paymentConfig;

  const qc = useQueryClient();

  const { data: summary, isLoading: summaryLoading } = useQuery<DashboardStats>({
    queryKey: ['vendor-dashboard', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/reports/dashboard');
      return data;
    },
    enabled: !!vendorId,
    refetchInterval: 60_000,
  });

  const { data: weekData = [] } = useQuery<WeekDay[]>({
    queryKey: ['vendor-week-revenue', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/reports/revenue/week');
      return data;
    },
    enabled: !!vendorId,
  });

  const { data: topServices = [] } = useQuery<TopService[]>({
    queryKey: ['vendor-top-services', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/reports/top-services');
      return data;
    },
    enabled: !!vendorId,
  });

  const { data: inventoryItems = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ['vendor-inventory', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/inventory');
      return data;
    },
    enabled: !!vendorId,
  });

  // Inventory quick-adjust mutation
  const adjustMutation = useMutation({
    mutationFn: ({ id, type, qty }: { id: number; type: 'in' | 'out'; qty: number }) =>
      api.post(`/inventory/${id}/transaction`, { type, quantity: qty.toString() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-inventory'] });
      qc.invalidateQueries({ queryKey: ['vendor-dashboard'] });
    },
  });

  // Collapsible action group state — first group open by default
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ operations: true });
  const toggleGroup = (key: string) =>
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));

  // Add item modal state
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ name: '', unit: 'لتر', quantity: '', minQuantity: '', costPerUnit: '' });
  const addMutation = useMutation({
    mutationFn: (item: typeof newItem) => api.post('/inventory', item),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-inventory'] });
      setShowAddItem(false);
      setNewItem({ name: '', unit: 'لتر', quantity: '', minQuantity: '', costPerUnit: '' });
    },
  });

  // Week chart max value
  const weekMax = useMemo(() => Math.max(...weekData.map(d => parseFloat(d.income ?? '0')), 1), [weekData]);

  // Build 7-day labels
  const last7Days = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const label = ['أحد', 'اثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'][d.getDay()];
      const found = weekData.find(w => w.day === key);
      days.push({ key, label, income: parseFloat(found?.income ?? '0'), expense: parseFloat(found?.expense ?? '0') });
    }
    return days;
  }, [weekData]);

  const lowStock = inventoryItems.filter(i => parseFloat(i.quantity) <= parseFloat(i.minQuantity));

  const { data: pendingBookingsData, isLoading: bookingsLoading } = useQuery<{
    bookings: Booking[];
  }>({
    queryKey: ['pending-bookings-preview', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/bookings', { params: { limit: 5, status: 'pending' } });
      return data;
    },
    enabled: !!vendorId,
  });

  const { data: loyaltyProgram } = useQuery<LoyaltyProgram>({
    queryKey: ['loyalty-program', vendorId],
    queryFn: async () => {
      const { data } = await api.get('/loyalty/program');
      return data;
    },
    enabled: !!vendorId,
  });

  const pendingBookings = pendingBookingsData?.bookings ?? [];

  // Daily summary query
  const { data: dailySummary } = useQuery<DailySummary>({
    queryKey: ['daily-summary', vendorId],
    queryFn: () => api.get('/summary/daily').then(r => r.data),
    enabled: !!vendorId,
    refetchInterval: 5 * 60 * 1000, // every 5 minutes
  });

  const { data: activityData } = useQuery({
    queryKey: ['vendor-activity'],
    queryFn: () => api.get('/vendors/activity?limit=10').then(r => r.data),
    staleTime: 60000,
    enabled: !!vendorId,
  });

  // Send summary to WhatsApp mutation
  const sendSummaryMutation = useMutation({
    mutationFn: () => api.post('/summary/send-whatsapp'),
    onSuccess: () => {
      toast.success('✅ تم إرسال الملخص على واتساب');
    },
    onError: () => {
      toast.error('فشل إرسال الملخص — تحقق من إعدادات واتساب');
    },
  });

  // CHANGE 1 – AI Daily Insight
  const insightMsg = useMemo(() => {
    if (!summary) return null;
    const growth = summary.monthGrowth;
    if (growth === null || growth === undefined) return { emoji: '🚀', text: 'مرحباً! ابدأ باستقبال أول حجز لتفعيل التحليلات', color: 'from-blue-900/60 to-blue-950/60', border: 'border-blue-500/20' };
    if (growth > 20) return { emoji: '🔥', text: `رائع! دخلك هذا الشهر أعلى بـ ${growth.toFixed(0)}% من الشهر الماضي — استمر!`, color: 'from-emerald-900/60 to-teal-950/60', border: 'border-emerald-500/20' };
    if (growth > 0) return { emoji: '📈', text: `ممتاز! نمو ${growth.toFixed(0)}% هذا الشهر — الزخم في صالحك`, color: 'from-blue-900/60 to-cyan-950/60', border: 'border-blue-500/20' };
    if (growth < -10) return { emoji: '⚠️', text: `دخلك انخفض ${Math.abs(growth).toFixed(0)}% — راجع جدولك وفعّل العروض`, color: 'from-red-900/60 to-rose-950/60', border: 'border-red-500/20' };
    return { emoji: '💡', text: 'أداء مستقر — فعّل برنامج الولاء لزيادة العملاء المتكررين', color: 'from-amber-900/60 to-yellow-950/60', border: 'border-amber-500/20' };
  }, [summary]);

  const statCards = [
    {
      label: 'حجوزات اليوم',
      value: summary?.todayBookings,
      sub: summary?.completedToday !== undefined ? `${summary.completedToday} مكتمل` : undefined,
      icon: Calendar,
      gradient: 'from-purple-500 to-indigo-600',
      glow: 'shadow-purple-500/30',
      border: 'border-purple-500/30',
      loading: summaryLoading,
      detailLink: '/admin/bookings',
      trend: summary?.todayBookings !== undefined && summary.pendingCount !== undefined
        ? (summary.pendingCount > 0 ? 'up' : 'neutral')
        : undefined,
      trendLabel: summary?.pendingCount !== undefined ? `${summary.pendingCount} معلق` : undefined,
      isLive: false,
    },
    {
      label: 'الإيرادات هذا الشهر',
      value: summary?.monthIncome !== undefined
        ? summary.monthIncome.toLocaleString('ar-SA') + ' ر.س'
        : undefined,
      sub: summary?.monthGrowth != null
        ? `${summary.monthGrowth > 0 ? '+' : ''}${summary.monthGrowth.toFixed(0)}٪ vs الشهر الماضي`
        : undefined,
      subColor: summary?.monthGrowth != null ? (summary.monthGrowth >= 0 ? 'text-emerald-400' : 'text-red-400') : undefined,
      icon: TrendingUp,
      gradient: 'from-emerald-500 to-teal-600',
      glow: 'shadow-emerald-500/30',
      border: 'border-emerald-500/30',
      loading: summaryLoading,
      detailLink: '/vendor/analytics',
      trend: summary?.monthGrowth != null ? (summary.monthGrowth > 0 ? 'up' : summary.monthGrowth < 0 ? 'down' : 'neutral') : undefined,
      trendLabel: summary?.monthGrowth != null
        ? `${summary.monthGrowth > 0 ? '+' : ''}${summary.monthGrowth.toFixed(0)}%`
        : undefined,
      isLive: true,
      badge: summary?.monthGrowth != null
        ? { text: `${summary.monthGrowth > 0 ? '+' : ''}${summary.monthGrowth.toFixed(0)}%`, positive: summary.monthGrowth >= 0 }
        : undefined,
      extraLabel: 'الشهر الحالي',
    },
    {
      label: 'صافي الربح هذا الشهر',
      value: summary?.monthProfit !== undefined
        ? summary.monthProfit.toLocaleString('ar-SA') + ' ر.س'
        : undefined,
      sub: summary?.monthExpenses !== undefined
        ? `مصروفات: ${summary.monthExpenses.toLocaleString('ar-SA')} ر.س`
        : undefined,
      icon: BarChart2,
      gradient: 'from-blue-500 to-cyan-500',
      glow: 'shadow-blue-500/30',
      border: 'border-blue-500/30',
      loading: summaryLoading,
      detailLink: '/admin/financials',
      trend: summary?.monthProfit !== undefined
        ? (summary.monthProfit > 0 ? 'up' : summary.monthProfit < 0 ? 'down' : 'neutral')
        : undefined,
      trendLabel: undefined,
      isLive: false,
    },
    {
      label: 'التقييم',
      value: summary?.avgRating ? (
        <span className="flex items-center gap-1">
          {summary.avgRating.toFixed(1)}
          <Star className="w-5 h-5 text-amber-400 fill-amber-400" />
        </span>
      ) : undefined,
      sub: summary?.totalCustomers !== undefined ? `${summary.totalCustomers} عميل` : undefined,
      icon: Star,
      gradient: 'from-amber-400 to-yellow-500',
      glow: 'shadow-amber-400/30',
      border: 'border-amber-400/30',
      loading: summaryLoading,
      detailLink: '/vendor/ratings',
      trend: summary?.avgRating !== undefined
        ? (summary.avgRating >= 4 ? 'up' : summary.avgRating < 3 ? 'down' : 'neutral')
        : undefined,
      trendLabel: undefined,
      isLive: false,
    },
  ];

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0a1a] text-white"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      <SetupWizardModal
        isOpen={showSetupWizard}
        onClose={() => setShowSetupWizard(false)}
        vendorSlug={myVendor?.slug ?? ''}
        vendorId={user?.vendorId ?? 0}
      />

      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[700px] h-[500px] bg-purple-600/8 rounded-full blur-[140px]" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[400px] bg-blue-600/8 rounded-full blur-[100px]" />
        <div className="absolute top-1/3 left-1/3 w-[300px] h-[300px] bg-indigo-600/5 rounded-full blur-[80px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-5 py-10">
        {/* Milestone confetti (silent — fires toast when thresholds crossed) */}
        <MilestoneCelebration
          monthIncome={summary?.monthIncome}
          totalBookings={summary?.totalBookings}
        />

        {/* Trial countdown banner */}
        <TrialBanner />

        {/* Free-plan booking usage (renders nothing for paid plans) */}
        <BookingUsageBanner />

        {/* Vendor Brand Greeting */}
        <div className="flex items-center gap-3 mb-6">
          {myVendor?.logoUrl && (
            <img src={myVendor.logoUrl} alt={myVendor.nameAr} className="w-10 h-10 rounded-xl object-cover border border-white/10" />
          )}
          <div>
            <h1 className="text-white font-black text-xl">
              {new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'} يا {myVendor?.nameAr ?? vendorName}
            </h1>
            <p className="text-slate-400 text-sm">لوحة تحكم المغسلة</p>
          </div>
        </div>

        {/* Operations Center Banner */}
        <Link to="/vendor/operations" className="block mb-4 bg-gradient-to-l from-blue-600 to-cyan-500 rounded-2xl p-4 text-white shadow-lg shadow-blue-500/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-black text-lg">مركز العمليات اليومية</div>
              <div className="text-blue-100 text-sm">شاهد كل ما يحدث الآن في مغسلتك</div>
            </div>
            <Activity size={32} className="opacity-80" />
          </div>
        </Link>

        {/* AI Daily Insight Banner */}
        {insightMsg && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
            className={`mb-4 rounded-2xl border ${insightMsg.border} bg-gradient-to-l ${insightMsg.color} backdrop-blur-sm p-4 flex items-center gap-3`}
          >
            <span className="text-2xl">{insightMsg.emoji}</span>
            <p className="text-white font-semibold text-sm flex-1">{insightMsg.text}</p>
            <span className="text-xs text-slate-500 flex-shrink-0">رؤية ذكية</span>
          </motion.div>
        )}

        {/* Push notification opt-in */}
        <PushPrompt />

        {/* Smart Insights — personalized growth cards */}
        <SmartInsights />

        {/* Setup Banner */}
        {showSetupBanner && (
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative mb-6 rounded-2xl overflow-hidden border border-blue-500/40 bg-gradient-to-l from-blue-900/60 to-indigo-900/60 backdrop-blur-xl shadow-xl shadow-blue-500/20"
          >
            <div className="absolute inset-0 bg-gradient-to-l from-blue-600/10 to-purple-600/10" />
            <div className="relative z-10 flex items-center gap-5 p-5">
              <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-blue-500/40">
                <Rocket size={22} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white text-base">أكمل إعداد مغسلتك</p>
                <p className="text-blue-200/70 text-sm mt-0.5">
                  أضف مفتاح الدفع وبيانات واتساب وخدماتك — يستغرق ٣ دقائق فقط
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Link to="/vendor/setup">
                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.97 }}
                    className="flex items-center gap-1.5 bg-white text-blue-700 font-bold text-sm px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all"
                  >
                    إعداد الآن
                    <ChevronLeft size={15} />
                  </motion.button>
                </Link>
                <button
                  onClick={dismissSetupBanner}
                  className="p-1.5 rounded-lg text-blue-300/60 hover:text-blue-200 hover:bg-white/10 transition-all"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Setup Checklist */}
        <SetupChecklist />

        {/* Hero Header */}
        <motion.div
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: 'spring' }}
          className="relative mb-10 rounded-3xl overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-bl from-purple-600/40 via-indigo-600/30 to-blue-600/20 backdrop-blur-sm" />
          <div className="absolute inset-0 border border-white/10 rounded-3xl" />
          {/* Decorative circles */}
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-purple-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl" />
          <div className="relative z-10 p-8 flex items-center justify-between">
            <div>
              <p className="text-white/60 text-sm mb-1">أهلاً وسهلاً</p>
              <h1 className="text-3xl font-black text-white leading-tight">
                مرحباً بك في لوحة تحكم
              </h1>
              <h2 className="text-2xl font-bold bg-gradient-to-l from-purple-300 to-blue-300 bg-clip-text text-transparent mt-1">
                {vendorName}
              </h2>
              <p className="text-white/50 text-sm mt-2">
                {new Date().toLocaleDateString('ar-SA', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              {myVendor?.isFoundingMember && (
                <div className="mt-3 inline-flex items-center gap-2 bg-amber-500/20 border border-amber-500/30 rounded-full px-3 py-1.5">
                  <span>🏅</span>
                  <span className="text-amber-400 text-xs font-bold">عضو مؤسس — سعرك محفوظ للأبد</span>
                </div>
              )}
            </div>
            <div className="hidden md:flex items-center justify-center w-24 h-24 rounded-2xl bg-white/10 border border-white/20 backdrop-blur-sm">
              {user?.vendor?.logoUrl ? (
                <img
                  src={user.vendor.logoUrl}
                  alt={vendorName}
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <span className="text-4xl font-black text-white/60">
                  {vendorName.charAt(0)}
                </span>
              )}
            </div>
          </div>
        </motion.div>

        {/* Stats Row */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          {statCards.map(({ label, value, sub, subColor, icon: Icon, gradient, glow, border, loading, detailLink, trend, trendLabel, isLive, badge, extraLabel }) => (
            <motion.div
              key={label}
              variants={itemVariants}
              whileHover={{ scale: 1.03, y: -2 }}
              className={`relative rounded-2xl border ${border} bg-white/5 backdrop-blur-xl shadow-xl ${glow} p-5 overflow-hidden`}
            >
              <div className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${gradient} opacity-20 blur-xl`} />
              <div className="relative z-10">
                {/* Icon row with live dot and trend */}
                <div className="flex items-center justify-between mb-3">
                  <div className={`inline-flex p-2 rounded-xl bg-gradient-to-br ${gradient}`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isLive && (
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                    )}
                    {trend === 'up' && (
                      <span className="flex items-center gap-0.5 text-emerald-400">
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        {trendLabel && <span className="text-[10px] font-bold">{trendLabel}</span>}
                      </span>
                    )}
                    {trend === 'down' && (
                      <span className="flex items-center gap-0.5 text-red-400">
                        <ArrowDownRight className="w-3.5 h-3.5" />
                        {trendLabel && <span className="text-[10px] font-bold">{trendLabel}</span>}
                      </span>
                    )}
                  </div>
                </div>

                {extraLabel && (
                  <p className="text-[10px] text-white/40 font-medium mb-0.5">{extraLabel}</p>
                )}

                {loading ? (
                  <div className="h-7 w-20 bg-white/10 rounded-lg animate-pulse mb-1" />
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-xl font-black text-white leading-none">{value ?? '—'}</p>
                    {badge && (
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.positive ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
                        {badge.text}
                      </span>
                    )}
                  </div>
                )}
                <p className="text-white/50 text-xs font-medium">{label}</p>
                {sub && !loading && (
                  <p className={`text-xs mt-1 font-semibold ${subColor ?? 'text-white/30'}`}>{sub}</p>
                )}
                {detailLink && (
                  <Link to={detailLink} className="mt-2 inline-flex items-center gap-0.5 text-[10px] text-white/25 hover:text-white/60 transition-colors">
                    المزيد <ChevronLeft className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Revenue Chart + Top Services ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Weekly Revenue Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-emerald-400 to-blue-500" />
                  الإيرادات — آخر ٧ أيام
                </h3>
                <p className="text-white/40 text-xs mt-0.5">
                  هذا الأسبوع: {(summary?.weekIncome ?? 0).toLocaleString('ar-SA')} ر.س
                </p>
              </div>
              <Link to="/vendor/analytics" className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1">
                تفاصيل أكثر <ChevronLeft size={13} />
              </Link>
            </div>

            {/* Bar chart */}
            <div className="flex items-end justify-between gap-2 h-36">
              {last7Days.map((d, i) => {
                const pct = weekMax > 0 ? (d.income / weekMax) * 100 : 0;
                const isToday = i === 6;
                return (
                  <div key={d.key} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <div className="relative w-full flex flex-col items-center justify-end" style={{ height: '100px' }}>
                      {/* Expense ghost bar */}
                      {d.expense > 0 && (
                        <div
                          className="absolute bottom-0 w-full rounded-t-lg bg-red-500/20 border border-red-500/20"
                          style={{ height: `${Math.max(4, (d.expense / weekMax) * 100)}px` }}
                        />
                      )}
                      {/* Income bar */}
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${Math.max(pct > 0 ? 6 : 2, pct)}%` }}
                        transition={{ duration: 0.7, delay: i * 0.07, type: 'spring' }}
                        className={`w-full rounded-t-lg ${isToday ? 'bg-gradient-to-t from-emerald-600 to-emerald-400' : 'bg-gradient-to-t from-blue-600/60 to-blue-400/60'} relative group-hover:brightness-125 transition-all`}
                        style={{ minHeight: '3px' }}
                      >
                        {d.income > 0 && (
                          <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] text-white/60 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 px-1 py-0.5 rounded">
                            {d.income.toLocaleString('ar-SA')}
                          </div>
                        )}
                      </motion.div>
                    </div>
                    <span className={`text-[10px] font-medium ${isToday ? 'text-emerald-400' : 'text-white/30'}`}>{d.label}</span>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-blue-500/60" /><span className="text-[10px] text-white/40">دخل</span></div>
              <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-sm bg-red-500/30" /><span className="text-[10px] text-white/40">مصروف</span></div>
              <div className="mr-auto flex gap-4 text-[10px] text-white/40">
                <span>الشهر: <span className="text-emerald-400 font-bold">{(summary?.monthIncome ?? 0).toLocaleString('ar-SA')} ر.س</span></span>
                <span>مصاريف: <span className="text-red-400 font-bold">{(summary?.monthExpenses ?? 0).toLocaleString('ar-SA')} ر.س</span></span>
              </div>
            </div>
          </motion.div>

          {/* Top Services */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
          >
            <h3 className="text-base font-bold text-white mb-5 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
              أكثر الخدمات طلباً
            </h3>
            {topServices.length === 0 ? (
              <div className="text-center py-8 text-white/20">
                <BarChart2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">لا توجد بيانات بعد</p>
              </div>
            ) : (
              <div className="space-y-3">
                {topServices.slice(0, 4).map((s, i) => {
                  const maxCount = topServices[0]?.bookingCount ?? 1;
                  const pct = Math.round((s.bookingCount / maxCount) * 100);
                  const colors = ['from-amber-500 to-orange-500', 'from-blue-500 to-cyan-500', 'from-purple-500 to-pink-500', 'from-emerald-500 to-teal-500'];
                  return (
                    <div key={i}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-white/80 font-medium truncate max-w-[130px]">
                          {s.serviceName ?? s.packageName ?? 'خدمة'}
                        </span>
                        <span className="text-xs text-white/40">{s.bookingCount} حجز</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.8, delay: i * 0.1 }}
                          className={`h-full rounded-full bg-gradient-to-l ${colors[i]}`}
                        />
                      </div>
                      <p className="text-[10px] text-white/30 mt-0.5">{parseFloat(s.totalRevenue).toLocaleString('ar-SA')} ر.س</p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>
        </div>

        {/* ── Inventory Management ──────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl mb-6 overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-cyan-400" />
              إدارة المخزون
              {lowStock.length > 0 && (
                <span className="flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-400/10 border border-amber-400/20 px-2 py-0.5 rounded-full">
                  <AlertTriangle size={10} />
                  {lowStock.length} تحتاج تعبئة
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <Link to="/admin/inventory" className="text-xs text-white/40 hover:text-white transition-colors">عرض الكل</Link>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowAddItem(true)}
                className="flex items-center gap-1.5 text-xs font-bold bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 text-cyan-400 px-3 py-1.5 rounded-xl transition-all"
              >
                <Plus size={13} />
                إضافة صنف
              </motion.button>
            </div>
          </div>

          {inventoryLoading ? (
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-xl animate-pulse" />)}
            </div>
          ) : inventoryItems.length === 0 ? (
            <div className="py-10 text-center text-white/20">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا يوجد مخزون مضاف بعد</p>
              <button onClick={() => setShowAddItem(true)} className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2">
                أضف أول صنف
              </button>
            </div>
          ) : (
            <div className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {inventoryItems.slice(0, 8).map(item => {
                const qty = parseFloat(item.quantity);
                const min = parseFloat(item.minQuantity);
                const isLow = qty <= min;
                const pct = min > 0 ? Math.min(100, (qty / (min * 2)) * 100) : 50;
                return (
                  <motion.div
                    key={item.id}
                    whileHover={{ scale: 1.02, y: -2 }}
                    className={`relative rounded-xl border p-4 transition-all ${isLow ? 'border-amber-500/40 bg-amber-500/5' : 'border-white/10 bg-white/[0.03]'}`}
                  >
                    {isLow && (
                      <div className="absolute top-2 left-2">
                        <AlertTriangle size={12} className="text-amber-400" />
                      </div>
                    )}
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-bold text-white truncate">{item.name}</p>
                      {isLow && (
                        <button
                          onClick={() => {
                            toast.success(`تم إرسال طلب تعبئة لـ ${item.name}`);
                          }}
                          className="flex-shrink-0 flex items-center gap-1 text-[10px] font-bold bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-md transition-all"
                        >
                          <Truck size={10} />
                          تعبئة
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mb-3">{item.supplier ?? item.unit}</p>

                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mb-2">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className={`text-sm font-black ${isLow ? 'text-amber-400' : 'text-white'}`}>
                        {qty} <span className="text-xs font-normal text-white/40">{item.unit}</span>
                      </span>
                      {/* Quick adjust buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => adjustMutation.mutate({ id: item.id, type: 'out', qty: 1 })}
                          className="w-6 h-6 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center text-red-400 transition-all"
                        >
                          <Minus size={10} />
                        </button>
                        <button
                          onClick={() => adjustMutation.mutate({ id: item.id, type: 'in', qty: 1 })}
                          className="w-6 h-6 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 flex items-center justify-center text-emerald-400 transition-all"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/25 mt-1">حد أدنى: {min} {item.unit}</p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* Add Inventory Modal */}
        <AnimatePresence>
          {showAddItem && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
              onClick={e => { if (e.target === e.currentTarget) setShowAddItem(false); }}
            >
              <motion.div
                initial={{ opacity: 0, y: 60, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 40 }}
                className="w-full max-w-md rounded-3xl border border-white/15 bg-[#0d1525] backdrop-blur-2xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-lg font-bold text-white">إضافة صنف للمخزون</h4>
                  <button onClick={() => setShowAddItem(false)} className="p-2 rounded-xl text-white/40 hover:text-white hover:bg-white/10">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'اسم الصنف', key: 'name', placeholder: 'مثال: شامبو السيارات' },
                    { label: 'الوحدة', key: 'unit', placeholder: 'لتر / كيلو / قطعة' },
                    { label: 'الكمية الحالية', key: 'quantity', placeholder: '10' },
                    { label: 'حد التنبيه (أدنى)', key: 'minQuantity', placeholder: '2' },
                    { label: 'التكلفة للوحدة (ر.س)', key: 'costPerUnit', placeholder: '15' },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="text-xs text-white/50 mb-1 block">{f.label}</label>
                      <input
                        type={['quantity', 'minQuantity', 'costPerUnit'].includes(f.key) ? 'number' : 'text'}
                        placeholder={f.placeholder}
                        value={(newItem as any)[f.key]}
                        onChange={e => setNewItem(p => ({ ...p, [f.key]: e.target.value }))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-white/20 focus:outline-none focus:border-cyan-500/50"
                      />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 mt-6">
                  <button onClick={() => setShowAddItem(false)} className="flex-1 py-3 rounded-xl bg-white/5 text-white/60 text-sm font-medium hover:bg-white/10">إلغاء</button>
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => newItem.name && addMutation.mutate(newItem)}
                    disabled={!newItem.name || addMutation.isPending}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-l from-cyan-600 to-blue-600 text-white font-bold text-sm disabled:opacity-50"
                  >
                    {addMutation.isPending ? <RefreshCw size={16} className="animate-spin mx-auto" /> : 'حفظ'}
                  </motion.button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Actions + Side panels */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Quick Actions — Grouped & Collapsible */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="lg:col-span-2 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
          >
            <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-purple-400 to-blue-500" />
              الإجراءات السريعة
            </h3>
            <div className="space-y-3">
              {actionGroups.map(group => {
                const isOpen = !!expandedGroups[group.key];
                const GroupIcon = group.icon;
                return (
                  <div key={group.key} className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                    <button
                      onClick={() => toggleGroup(group.key)}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
                    >
                      <span className="flex items-center gap-2 text-sm font-bold text-white">
                        <GroupIcon className={`w-4 h-4 ${group.iconColor}`} />
                        {group.title}
                        <span className="text-[10px] text-white/30 font-normal">({group.actions.length})</span>
                      </span>
                      <ChevronDown
                        className={`w-4 h-4 text-white/40 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {isOpen && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 px-4 pb-4">
                            {group.actions.map(({ label, icon: Icon, to, gradient, shadow }) => (
                              <Link key={label} to={to}>
                                <motion.div
                                  whileHover={{ scale: 1.06, y: -3 }}
                                  whileTap={{ scale: 0.96 }}
                                  className={`flex flex-col items-center gap-2 p-3 rounded-xl bg-gradient-to-br ${gradient} shadow-lg ${shadow} cursor-pointer transition-all`}
                                >
                                  <Icon className="w-5 h-5 text-white" />
                                  <span className="text-white text-[11px] font-bold text-center leading-tight">{label}</span>
                                </motion.div>
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Loyalty Program Card */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6"
          >
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Gift className="w-5 h-5 text-purple-400" />
              برنامج الولاء
            </h3>

            {loyaltyProgram?.isActive && loyaltyProgram.programType === 'punch_card' && (
              <div>
                <p className="text-white/60 text-sm mb-3">بطاقة مخرَّمة</p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {Array.from({ length: loyaltyProgram.punchesRequired ?? 10 }).map((_, i) => (
                    <div
                      key={i}
                      className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                        i < (loyaltyProgram.currentPunches ?? 0)
                          ? 'bg-purple-500 border-purple-400 text-white'
                          : 'border-white/20 text-white/20'
                      }`}
                    >
                      {i < (loyaltyProgram.currentPunches ?? 0) ? '✓' : i + 1}
                    </div>
                  ))}
                </div>
                <p className="text-white/50 text-xs">
                  {loyaltyProgram.currentPunches ?? 0} / {loyaltyProgram.punchesRequired ?? 10} ختمة
                </p>
              </div>
            )}

            {loyaltyProgram?.isActive && loyaltyProgram.programType === 'points' && (
              <div>
                <p className="text-white/60 text-sm mb-2">رصيد النقاط</p>
                <p className="text-4xl font-black text-white">
                  {(loyaltyProgram.pointsBalance ?? 0).toLocaleString('ar-SA')}
                </p>
                <p className="text-purple-300 text-xs mt-1">نقطة مكتسبة</p>
              </div>
            )}

            {(!loyaltyProgram?.isActive || !loyaltyProgram?.programType) && (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <Gift className="w-6 h-6 text-white/30" />
                </div>
                <p className="text-white/50 text-sm mb-3">لا يوجد برنامج ولاء مفعّل</p>
                <Link
                  to="/vendor/loyalty"
                  className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors underline underline-offset-2"
                >
                  تفعيل البرنامج الآن
                </Link>
              </div>
            )}
          </motion.div>
        </div>

        {/* Store QR Code Card */}
        {myVendor?.slug && (
          <QRCard slug={myVendor.slug} vendorName={vendorName} />
        )}

        {/* Today's Schedule / Pending Bookings */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
        >
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              جدول اليوم
            </h3>
            <Link
              to="/admin/bookings"
              className="text-sm text-purple-400 hover:text-purple-300 transition-colors font-medium"
            >
              عرض الكل ←
            </Link>
          </div>

          {bookingsLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : pendingBookings.length === 0 ? (
            <div className="py-12 text-center text-white/30">
              <CheckCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا توجد حجوزات معلقة</p>
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {pendingBookings.map((booking, i) => {
                const statusKey = booking.status ?? 'pending';
                const status = statusConfig[statusKey] ?? statusConfig.pending;
                const timelineBorder =
                  statusKey === 'in_progress' ? 'border-r-emerald-500' :
                  statusKey === 'completed' ? 'border-r-slate-500' :
                  'border-r-blue-500';
                return (
                  <motion.div
                    key={booking.id}
                    initial={{ opacity: 0, x: 16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.55 + i * 0.06 }}
                    className={`flex items-center gap-4 px-5 py-4 hover:bg-white/5 transition-colors border-r-4 ${timelineBorder}`}
                  >
                    {/* Time block */}
                    <div className="flex-shrink-0 text-center min-w-[44px]">
                      {booking.scheduledAt ? (
                        <>
                          <Clock className="w-3.5 h-3.5 text-white/40 mx-auto mb-0.5" />
                          <p className="text-white font-bold text-sm leading-none">{formatTime(booking.scheduledAt)}</p>
                          <p className="text-white/30 text-[9px] mt-0.5 hidden sm:block">{formatDate(booking.scheduledAt)}</p>
                        </>
                      ) : (
                        <Hash className="w-4 h-4 text-amber-400 mx-auto" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm">
                        {booking.bookingNumber ?? `#${booking.id}`}
                      </p>
                      {booking.customerName && (
                        <p className="text-white/60 text-xs mt-0.5 truncate">{booking.customerName}</p>
                      )}
                      {booking.employeeName && (
                        <p className="text-purple-300/70 text-xs flex items-center gap-1 mt-0.5 truncate">
                          <Users className="w-3 h-3 flex-shrink-0" />
                          {booking.employeeName}
                        </p>
                      )}
                      {booking.address && (
                        <p className="text-white/35 text-xs flex items-center gap-1 mt-0.5 truncate">
                          <MapPin className="w-3 h-3 flex-shrink-0" />
                          {booking.address}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.text}`}>
                        {status.label}
                      </span>
                      {statusKey === 'pending' && (
                        <Link
                          to={`/admin/bookings/${booking.id}`}
                          className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 border border-blue-500/20 transition-all"
                        >
                          ابدأ
                        </Link>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* ── Daily Summary Card ────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.55 }}
          className="mt-6 rounded-2xl border border-purple-500/30 bg-gradient-to-bl from-purple-900/30 via-[#0a0a1a] to-blue-900/30 backdrop-blur-xl overflow-hidden shadow-xl shadow-purple-500/10"
        >
          {/* Header */}
          <div className="p-5 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-purple-400 to-blue-500" />
              ملخص اليوم 📊
            </h3>
            <span className="text-xs text-white/30">{dailySummary?.date ?? '—'}</span>
          </div>

          <div className="p-5">
            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {/* Bookings */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-xl font-black text-white leading-none">
                  {dailySummary ? `${dailySummary.bookings.completed}/${dailySummary.bookings.total}` : '—'}
                </p>
                <p className="text-[10px] text-white/40 mt-1">حجوزات مكتملة</p>
              </div>
              {/* Revenue */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-xl font-black text-emerald-400 leading-none">
                  {dailySummary ? dailySummary.revenue.today.toFixed(0) : '—'}
                </p>
                <p className="text-[10px] text-white/40 mt-1">ر.س اليوم</p>
              </div>
              {/* Rating */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-center">
                <p className="text-xl font-black text-amber-400 leading-none flex items-center justify-center gap-1">
                  {dailySummary?.avgRating != null ? dailySummary.avgRating.toFixed(1) : '—'}
                  {dailySummary?.avgRating != null && <Star className="w-4 h-4 fill-amber-400" />}
                </p>
                <p className="text-[10px] text-white/40 mt-1">متوسط التقييم</p>
              </div>
            </div>

            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2 mb-5">
              {dailySummary?.topEmployee && (
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-amber-500/10 border border-amber-500/20 text-amber-300 px-3 py-1.5 rounded-full">
                  🏆 أفضل موظف: {dailySummary.topEmployee.name} ({dailySummary.topEmployee.completions} غسلة)
                </span>
              )}
              <span className="flex items-center gap-1.5 text-xs font-semibold bg-blue-500/10 border border-blue-500/20 text-blue-300 px-3 py-1.5 rounded-full">
                📅 غداً: {dailySummary?.tomorrowBookings ?? '—'} حجز
              </span>
              {(dailySummary?.vehiclesUsed ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-purple-500/10 border border-purple-500/20 text-purple-300 px-3 py-1.5 rounded-full">
                  🚗 سيارات عملت: {dailySummary!.vehiclesUsed}
                </span>
              )}
              {(dailySummary?.newCustomers ?? 0) > 0 && (
                <span className="flex items-center gap-1.5 text-xs font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-full">
                  👤 عملاء جدد: {dailySummary!.newCustomers}
                </span>
              )}
            </div>

            {/* Send WhatsApp button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => sendSummaryMutation.mutate()}
              disabled={sendSummaryMutation.isPending}
              className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-l from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-purple-500/20 transition-all disabled:opacity-60"
            >
              {sendSummaryMutation.isPending ? (
                <RefreshCw size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
              📤 أرسل الملخص على واتساب
            </motion.button>
          </div>
        </motion.div>

        {/* ── Activity Feed ─────────────────────────────────────────────────── */}
        {activityData?.activities && activityData.activities.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-6 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden"
          >
            <div className="p-5 border-b border-white/10">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <div className="w-1.5 h-5 rounded-full bg-gradient-to-b from-cyan-400 to-blue-500" />
                آخر النشاطات
              </h3>
            </div>
            <div className="divide-y divide-white/5">
              {activityData.activities.map((item: any) => (
                <div key={`${item.type}-${item.id}`} className="flex items-center gap-3 px-5 py-3">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${item.type === 'booking' ? 'bg-blue-400' : 'bg-purple-400'}`} />
                  <p className="flex-1 text-sm text-white/80 truncate">{item.description}</p>
                  <span className="text-xs text-white/30 flex-shrink-0">{timeAgo(item.createdAt)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Mobile Quick Actions floating bar */}
        <div className="fixed bottom-20 left-0 right-0 px-4 pb-2 z-40 flex justify-center pointer-events-none md:hidden">
          <motion.div
            initial={{ y: 100 }} animate={{ y: 0 }} transition={{ delay: 0.5 }}
            className="flex items-center gap-3 bg-slate-900/95 backdrop-blur-lg border border-white/10 rounded-2xl px-4 py-3 shadow-2xl pointer-events-auto"
          >
            <Link to="/vendor/bookings" className="flex flex-col items-center gap-1 text-xs text-blue-400">
              <CalendarPlus size={20} />
              <span>حجز جديد</span>
            </Link>
            <div className="w-px h-8 bg-white/10" />
            <Link to="/vendor/pos" className="flex flex-col items-center gap-1 text-xs text-emerald-400">
              <ShoppingCart size={20} />
              <span>كاشير</span>
            </Link>
            <div className="w-px h-8 bg-white/10" />
            <Link to="/vendor/employees" className="flex flex-col items-center gap-1 text-xs text-purple-400">
              <Users size={20} />
              <span>الموظفين</span>
            </Link>
            <div className="w-px h-8 bg-white/10" />
            <Link to="/vendor/reports" className="flex flex-col items-center gap-1 text-xs text-amber-400">
              <BarChart2 size={20} />
              <span>التقارير</span>
            </Link>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
