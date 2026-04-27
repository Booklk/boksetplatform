import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Bell, Crown, Shield, User, ChevronLeft,
  Phone, Mail, MapPin, Hash, Globe, MessageCircle,
  Image, Save, Eye, EyeOff, LogOut, Trash2, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, Settings as SettingsIcon,
  Plug, CreditCard, Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorProfile {
  id: number;
  nameAr?: string;
  nameEn?: string;
  slug?: string;
  phone?: string;
  email?: string;
  city?: string;
  address?: string;
  logoUrl?: string;
  googleReviewLink?: string;
  subscriptionStatus?: string;
  subscriptionPlan?: string;
  subscriptionEndDate?: string;
  trialEndsAt?: string;
  settings?: Record<string, unknown>;
}

interface NotificationPrefs {
  newBookingWhatsapp: boolean;
  cancellationAlert: boolean;
  morningSchedule: boolean;
  eveningSummary: boolean;
  maintenanceAlerts: boolean;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'business',       label: 'المتجر',      icon: Building2 },
  { id: 'bot',            label: 'بوت واتساب',   icon: MessageCircle },
  { id: 'integrations',   label: 'التكاملات',   icon: Plug },
  { id: 'tracking',       label: 'التتبع والإعلانات', icon: SettingsIcon },
  { id: 'notifications',  label: 'الإشعارات',    icon: Bell },
  { id: 'plan',           label: 'باقتي',        icon: Crown },
  { id: 'security',       label: 'الأمان',       icon: Shield },
  { id: 'account',        label: 'الحساب',       icon: User },
] as const;

type TabId = (typeof TABS)[number]['id'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOTIF_LS_KEY = 'vendor_notif_prefs';

const DEFAULT_NOTIF: NotificationPrefs = {
  newBookingWhatsapp: true,
  cancellationAlert: true,
  morningSchedule: true,
  eveningSummary: false,
  maintenanceAlerts: false,
};

function loadNotifPrefs(): NotificationPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_LS_KEY);
    if (raw) return { ...DEFAULT_NOTIF, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return DEFAULT_NOTIF;
}

const PLAN_INFO: Record<string, { label: string; price: number; color: string }> = {
  free:       { label: 'مجاني',    price: 0,    color: 'from-slate-700/60 to-slate-800/60' },
  pro:        { label: 'Pro',      price: 999,  color: 'from-blue-900/60 to-blue-800/40' },
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  active:    { label: 'نشط',     color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  trial:     { label: 'تجريبي',  color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30' },
  expired:   { label: 'منتهي',   color: 'bg-red-500/20 text-red-300 border-red-500/30' },
  suspended: { label: 'موقوف',   color: 'bg-slate-700/40 text-slate-400 border-slate-600/30' },
};

function daysUntil(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

// ─── Reusable Input ───────────────────────────────────────────────────────────

function Field({
  label, value, onChange, placeholder, type = 'text', icon: Icon, readOnly,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
  readOnly?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-white/60 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-4 h-4 text-white/25" />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          readOnly={readOnly}
          className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20
            focus:outline-none focus:border-blue-500/60 transition-all text-sm
            ${Icon ? 'pr-10' : ''}
            ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
        />
      </div>
    </div>
  );
}

// ─── Toggle Switch ────────────────────────────────────────────────────────────

function Toggle({
  label, description, checked, onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-4 border-b border-white/6 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-white font-semibold text-sm">{label}</p>
        {description && <p className="text-white/40 text-xs mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-blue-500' : 'bg-white/15'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform ${
            checked ? '-translate-x-6' : '-translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

// ─── Save Button ──────────────────────────────────────────────────────────────

function SaveBtn({ loading, onClick }: { loading?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-6 flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold px-6 py-3 rounded-xl transition-all shadow-lg shadow-blue-500/20"
    >
      {loading ? (
        <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      ) : (
        <Save className="w-4 h-4" />
      )}
      حفظ التغييرات
    </button>
  );
}

// ─── Tab: Business Profile ─────────────────────────────────────────────────────

function BusinessTab({ vendor }: { vendor?: VendorProfile }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const vendorId = user?.vendorId;

  const [form, setForm] = useState({
    nameAr: '',
    phone: '',
    email: '',
    city: '',
    address: '',
    crNumber: '',
    vatNumber: '',
    websiteUrl: '',
    whatsappUrl: '',
    logoUrl: '',
    googleReviewLink: '',
  });

  // Populate form from vendor data
  useEffect(() => {
    if (!vendor) return;
    const s = (vendor.settings ?? {}) as Record<string, string>;
    setForm({
      nameAr:           vendor.nameAr ?? '',
      phone:            vendor.phone ?? '',
      email:            vendor.email ?? '',
      city:             vendor.city ?? '',
      address:          vendor.address ?? '',
      crNumber:         s.crNumber ?? '',
      vatNumber:        s.vatNumber ?? '',
      websiteUrl:       s.websiteUrl ?? '',
      whatsappUrl:      s.whatsappUrl ?? '',
      logoUrl:          vendor.logoUrl ?? '',
      googleReviewLink: vendor.googleReviewLink ?? '',
    });
  }, [vendor]);

  const set = (key: keyof typeof form) => (v: string) =>
    setForm((p) => ({ ...p, [key]: v }));

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/vendors/${vendorId}`, {
        nameAr:           form.nameAr,
        phone:            form.phone,
        email:            form.email,
        city:             form.city,
        address:          form.address,
        logoUrl:          form.logoUrl,
        googleReviewLink: form.googleReviewLink || null,
        settings: {
          ...(vendor?.settings ?? {}),
          crNumber:    form.crNumber,
          vatNumber:   form.vatNumber,
          websiteUrl:  form.websiteUrl,
          whatsappUrl: form.whatsappUrl,
        },
      }),
    onSuccess: () => {
      toast.success('تم حفظ بيانات المتجر بنجاح ✅');
      qc.invalidateQueries({ queryKey: ['vendor-profile'] });
    },
    onError: () => toast.error('فشل الحفظ — حاول مرة أخرى'),
  });

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-400" />
        بيانات المتجر
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="اسم المتجر" value={form.nameAr} onChange={set('nameAr')} placeholder="متجر النجوم" icon={Building2} />
        <Field label="رقم الجوال" value={form.phone} onChange={set('phone')} placeholder="0500000000" icon={Phone} type="tel" />
        <Field label="البريد الإلكتروني" value={form.email} onChange={set('email')} placeholder="info@example.com" icon={Mail} type="email" />
        <Field label="المدينة" value={form.city} onChange={set('city')} placeholder="الرياض" icon={MapPin} />
        <div className="md:col-span-2">
          <Field label="العنوان" value={form.address} onChange={set('address')} placeholder="حي الياسمين، شارع الأمير محمد" icon={MapPin} />
        </div>
        <Field label="رقم السجل التجاري" value={form.crNumber} onChange={set('crNumber')} placeholder="1010XXXXXX" icon={Hash} />
        <Field label="رقم ضريبة القيمة المضافة" value={form.vatNumber} onChange={set('vatNumber')} placeholder="300XXXXXXXXX" icon={Hash} />
        <Field label="رابط الموقع" value={form.websiteUrl} onChange={set('websiteUrl')} placeholder="https://example.com" icon={Globe} />
        <Field label="رابط واتساب" value={form.whatsappUrl} onChange={set('whatsappUrl')} placeholder="https://wa.me/966XXXXXXXXX" icon={MessageCircle} />
      </div>

      {/* Logo section */}
      <div className="mt-5">
        <label className="block text-sm font-semibold text-white/60 mb-1.5">رابط شعار المتجر</label>
        <div className="flex items-center gap-3">
          {form.logoUrl && (
            <img src={form.logoUrl} alt="شعار" className="w-14 h-14 rounded-xl object-cover border border-white/10" />
          )}
          <input
            type="url"
            value={form.logoUrl}
            onChange={(e) => set('logoUrl')(e.target.value)}
            placeholder="https://... رابط الشعار"
            className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all text-sm"
          />
        </div>
        <p className="text-white/30 text-xs mt-1 flex items-center gap-1">
          <Image className="w-3 h-3" />
          ارفع الصورة إلى أي خدمة استضافة (Cloudinary، imgbb) ثم الصق الرابط هنا
        </p>
      </div>

      {/* Google Review Link */}
      <div className="mt-5">
        <label className="block text-sm font-semibold text-white/60 mb-1.5">رابط تقييم Google</label>
        <input
          type="url"
          value={form.googleReviewLink}
          onChange={(e) => set('googleReviewLink')(e.target.value)}
          placeholder="https://g.page/r/...../review"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all text-sm"
        />
        <p className="text-white/30 text-xs mt-1">
          احصل عليه من Google Business Profile → شارك رابط التقييم
        </p>
      </div>

      <SaveBtn loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} />
    </div>
  );
}

// ─── Tab: Notifications ───────────────────────────────────────────────────────

function NotificationsTab({ vendor }: { vendor?: VendorProfile }) {
  const vendorId = useAuth((s) => s.user?.vendorId);
  const [prefs, setPrefs] = useState<NotificationPrefs>(loadNotifPrefs);

  // Load from vendor settings if available
  useEffect(() => {
    const serverPrefs = (vendor?.settings as Record<string, unknown> | undefined)?.notificationPrefs;
    if (serverPrefs && typeof serverPrefs === 'object') {
      setPrefs((p) => ({ ...p, ...(serverPrefs as Partial<NotificationPrefs>) }));
    }
  }, [vendor]);

  const toggle = (key: keyof NotificationPrefs) => (v: boolean) => {
    setPrefs((p) => {
      const next = { ...p, [key]: v };
      localStorage.setItem(NOTIF_LS_KEY, JSON.stringify(next));
      return next;
    });
  };

  const saveMutation = useMutation({
    mutationFn: () => api.post('/vendors/notification-preferences', prefs),
    onSuccess: () => toast.success('تم حفظ إعدادات الإشعارات ✅'),
    onError: () => toast.error('فشل الحفظ'),
  });

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
        <Bell className="w-5 h-5 text-blue-400" />
        إعدادات الإشعارات
      </h2>

      <div className="bg-white/5 border border-white/10 rounded-2xl px-5">
        <Toggle
          label="إشعارات الحجوزات الجديدة"
          description="استلم رسالة واتساب فور وصول حجز جديد"
          checked={prefs.newBookingWhatsapp}
          onChange={toggle('newBookingWhatsapp')}
        />
        <Toggle
          label="إشعارات الإلغاء"
          description="تنبيه عند إلغاء أي حجز"
          checked={prefs.cancellationAlert}
          onChange={toggle('cancellationAlert')}
        />
        <Toggle
          label="إشعار صباحي بجدول اليوم"
          description="ملخص الحجوزات يصلك الساعة 8 صباحاً"
          checked={prefs.morningSchedule}
          onChange={toggle('morningSchedule')}
        />
        <Toggle
          label="ملخص مسائي"
          description="تقرير إيرادات اليوم الساعة 9 مساءً"
          checked={prefs.eveningSummary}
          onChange={toggle('eveningSummary')}
        />
        <Toggle
          label="تنبيهات صيانة السيارات"
          description="تذكير عند اقتراب موعد صيانة مركبات الأسطول"
          checked={prefs.maintenanceAlerts}
          onChange={toggle('maintenanceAlerts')}
        />
      </div>

      <SaveBtn loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} />
    </div>
  );
}

// ─── Tab: My Plan ─────────────────────────────────────────────────────────────

function PlanTab({ vendor }: { vendor?: VendorProfile }) {
  const plan = vendor?.subscriptionPlan ?? 'pro';
  const planInfo = PLAN_INFO[plan] ?? PLAN_INFO.pro;
  const status = vendor?.subscriptionStatus ?? 'trial';
  const statusInfo = STATUS_LABEL[status] ?? STATUS_LABEL.trial;
  const trialDays = daysUntil(vendor?.trialEndsAt);
  const endDays = daysUntil(vendor?.subscriptionEndDate);

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
        <Crown className="w-5 h-5 text-yellow-400" />
        باقتي الحالية
      </h2>

      {/* Plan card */}
      <div className={`relative rounded-2xl border border-white/10 bg-gradient-to-br ${planInfo.color} backdrop-blur-xl p-6 mb-5 overflow-hidden`}>
        <div className="absolute top-0 left-0 w-32 h-32 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-3">
            <div>
              <p className="text-white/50 text-sm font-semibold">الباقة الحالية</p>
              <h3 className="text-2xl font-black text-white mt-0.5">{planInfo.label}</h3>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-bold border ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>
          <p className="text-3xl font-black text-white mb-1">
            {planInfo.price.toLocaleString('ar-SA')} <span className="text-lg font-semibold text-white/60">ر.س / سنة</span>
          </p>
        </div>
      </div>

      {/* Trial / expiry info */}
      {status === 'trial' && trialDays !== null && (
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-5">
          <Clock className="w-5 h-5 text-yellow-400 flex-shrink-0" />
          <div>
            <p className="text-yellow-300 font-bold text-sm">أنت في الفترة التجريبية المجانية</p>
            <p className="text-yellow-300/70 text-xs mt-0.5">
              تنتهي بعد <span className="font-bold text-yellow-300">{trialDays} يوم</span>
              {vendor?.trialEndsAt && (
                <> — {new Date(vendor.trialEndsAt).toLocaleDateString('ar-SA', { day: 'numeric', month: 'long' })}</>
              )}
            </p>
          </div>
        </div>
      )}

      {status === 'active' && endDays !== null && endDays <= 30 && (
        <div className="flex items-center gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-5">
          <Clock className="w-5 h-5 text-blue-400 flex-shrink-0" />
          <p className="text-blue-300 text-sm font-semibold">
            تنتهي باقتك بعد <span className="font-bold">{endDays} يوم</span>
          </p>
        </div>
      )}

      <Link to="/vendor/platform-sub">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 bg-gradient-to-l from-yellow-500 to-amber-400 text-slate-900 font-black px-6 py-3 rounded-xl shadow-lg shadow-yellow-500/20 transition-all"
        >
          <Crown className="w-4 h-4" />
          ترقية الباقة
          <ArrowUpRight className="w-4 h-4" />
        </motion.button>
      </Link>
    </div>
  );
}

// ─── Tab: Security ────────────────────────────────────────────────────────────

function SecurityTab() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [oldPw, setOldPw]       = useState('');
  const [newPw, setNewPw]       = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showOld, setShowOld]   = useState(false);
  const [showNew, setShowNew]   = useState(false);

  const changePwMutation = useMutation({
    mutationFn: () => api.post('/auth/change-password', { oldPassword: oldPw, newPassword: newPw }),
    onSuccess: () => {
      toast.success('تم تغيير كلمة المرور بنجاح ✅');
      setOldPw(''); setNewPw(''); setConfirmPw('');
    },
    onError: (err: any) =>
      toast.error(err?.response?.data?.error ?? 'فشل تغيير كلمة المرور'),
  });

  function handleChangePassword() {
    if (!oldPw || !newPw || !confirmPw) {
      toast.error('يرجى ملء جميع الحقول');
      return;
    }
    if (newPw !== confirmPw) {
      toast.error('كلمة المرور الجديدة وتأكيدها غير متطابقتين');
      return;
    }
    if (newPw.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    changePwMutation.mutate();
  }

  function handleLogoutAll() {
    logout();
    navigate('/login');
    toast.success('تم تسجيل الخروج من جميع الأجهزة');
  }

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
        <Shield className="w-5 h-5 text-blue-400" />
        الأمان وكلمة المرور
      </h2>

      {/* Change password */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
        <h3 className="text-white font-bold mb-4">تغيير كلمة المرور</h3>
        <div className="space-y-4">
          {/* Old password */}
          <div>
            <label className="block text-sm font-semibold text-white/60 mb-1.5">كلمة المرور الحالية</label>
            <div className="relative">
              <input
                type={showOld ? 'text' : 'password'}
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowOld((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showOld ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-semibold text-white/60 mb-1.5">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowNew((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-semibold text-white/60 mb-1.5">تأكيد كلمة المرور الجديدة</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="••••••••"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-blue-500/60 transition-all text-sm"
            />
          </div>

          {newPw && confirmPw && newPw !== confirmPw && (
            <p className="text-red-400 text-xs flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> كلمتا المرور غير متطابقتين
            </p>
          )}
          {newPw && confirmPw && newPw === confirmPw && (
            <p className="text-emerald-400 text-xs flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> كلمتا المرور متطابقتان
            </p>
          )}
        </div>

        <SaveBtn loading={changePwMutation.isPending} onClick={handleChangePassword} />
      </div>

      {/* Logout all devices */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
        <h3 className="text-white font-bold mb-1">تسجيل الخروج من كل الأجهزة</h3>
        <p className="text-white/40 text-sm mb-4">
          سيتم إلغاء جميع جلسات تسجيل الدخول الحالية على جميع الأجهزة
        </p>
        <button
          type="button"
          onClick={handleLogoutAll}
          className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold px-5 py-2.5 rounded-xl transition-all text-sm"
        >
          <LogOut className="w-4 h-4" />
          تسجيل الخروج من كل الأجهزة
        </button>
      </div>
    </div>
  );
}

// ─── Tab: Account ─────────────────────────────────────────────────────────────

function AccountTab({ vendor }: { vendor?: VendorProfile }) {
  const { user, logout } = useAuth();
  const qc = useQueryClient();
  const vendorId = user?.vendorId;
  const navigate = useNavigate();
  const [ownerName, setOwnerName]   = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    if (!vendor) return;
    const s = (vendor.settings ?? {}) as Record<string, string>;
    setOwnerName(s.ownerName ?? user?.name ?? '');
    setOwnerPhone(s.ownerPhone ?? user?.phone ?? '');
  }, [vendor, user]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.put(`/vendors/${vendorId}`, {
        settings: {
          ...(vendor?.settings ?? {}),
          ownerName,
          ownerPhone,
        },
      }),
    onSuccess: () => {
      toast.success('تم حفظ بيانات الحساب ✅');
      qc.invalidateQueries({ queryKey: ['vendor-profile'] });
    },
    onError: () => toast.error('فشل الحفظ'),
  });

  const DELETE_PHRASE = 'حذف حسابي';

  function handleDelete() {
    if (deleteConfirm !== DELETE_PHRASE) {
      toast.error(`اكتب "${DELETE_PHRASE}" للتأكيد`);
      return;
    }
    // In production this would call DELETE /api/vendors/:id
    toast.error('ميزة الحذف تتطلب مراجعة يدوية — تواصل مع الدعم');
    setShowDeleteModal(false);
  }

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
        <User className="w-5 h-5 text-blue-400" />
        بيانات الحساب
      </h2>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-5">
        <h3 className="text-white font-bold mb-4">بيانات المالك</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="اسم المالك" value={ownerName} onChange={setOwnerName} placeholder="محمد العمري" icon={User} />
          <Field label="رقم جوال المالك" value={ownerPhone} onChange={setOwnerPhone} placeholder="0500000000" icon={Phone} type="tel" />
        </div>
        <SaveBtn loading={saveMutation.isPending} onClick={() => saveMutation.mutate()} />
      </div>

      {/* Danger zone */}
      <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <h3 className="text-red-400 font-bold">منطقة الخطر</h3>
        </div>
        <p className="text-white/40 text-sm mb-4">
          حذف الحساب نهائي ولا يمكن التراجع عنه. ستُفقد جميع البيانات.
        </p>
        <button
          type="button"
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-bold px-5 py-2.5 rounded-xl transition-all text-sm"
        >
          <Trash2 className="w-4 h-4" />
          حذف الحساب نهائياً
        </button>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0e1120] border border-red-500/30 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                </div>
                <h3 className="text-white font-black text-lg">تأكيد الحذف</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                لتأكيد الحذف، اكتب <span className="text-red-400 font-bold">"{DELETE_PHRASE}"</span> في الحقل أدناه:
              </p>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder={DELETE_PHRASE}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/20 focus:outline-none focus:border-red-500/60 transition-all text-sm mb-4"
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white font-semibold px-4 py-2.5 rounded-xl transition-all text-sm"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold px-4 py-2.5 rounded-xl transition-all text-sm"
                >
                  حذف الحساب
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Tab: Integrations (WhatsApp + Payment Gateway) ───────────────────────────

interface IntegrationStatus {
  whatsapp: { configured: boolean; usingPlatform: boolean };
  payment: { configured: boolean; provider: string | null; sandboxMode: boolean | null; usingPlatform: boolean };
}

function IntegrationsTab({ vendorId }: { vendorId?: number }) {
  const qc = useQueryClient();
  const [waToken, setWaToken] = useState('');
  const [waPhoneId, setWaPhoneId] = useState('');
  const [waShow, setWaShow] = useState(false);
  const [moyasarKey, setMoyasarKey] = useState('');
  const [moyasarShow, setMoyasarShow] = useState(false);
  const [sandboxMode, setSandboxMode] = useState(true);

  const { data: status, isLoading } = useQuery<IntegrationStatus>({
    queryKey: ['vendor-integrations'],
    queryFn: () => api.get('/vendors/me/integrations').then((r) => r.data),
    enabled: !!vendorId,
  });

  const saveWhatsApp = useMutation({
    mutationFn: () =>
      api.post(`/vendors/${vendorId}/test-whatsapp`, { token: waToken, phoneId: waPhoneId }),
    onSuccess: () => {
      toast.success('تم حفظ بيانات واتساب — تأكد من رسالة الاختبار على جوالك');
      setWaToken(''); setWaPhoneId('');
      qc.invalidateQueries({ queryKey: ['vendor-integrations'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل حفظ بيانات واتساب'),
  });

  const saveMoyasar = useMutation({
    mutationFn: () =>
      api.post(`/vendors/${vendorId}/payment-config`, { apiKey: moyasarKey, sandboxMode }),
    onSuccess: () => {
      toast.success('تم حفظ مفتاح Moyasar');
      setMoyasarKey('');
      qc.invalidateQueries({ queryKey: ['vendor-integrations'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل حفظ المفتاح'),
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-brand-400" /></div>;
  }

  const StatusBadge = ({ ok, fallback, label }: { ok: boolean; fallback: boolean; label: string }) => (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full ${
      ok ? 'bg-emerald-500/20 text-emerald-300' : fallback ? 'bg-blue-500/20 text-blue-300' : 'bg-amber-500/20 text-amber-300'
    }`}>
      <CheckCircle2 size={10} />
      {ok ? `مفعّل — ${label}` : fallback ? 'يستخدم إعداد المنصة' : 'غير مهيأ'}
    </span>
  );

  return (
    <div className="space-y-6">
      {/* WhatsApp */}
      <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <MessageCircle size={18} className="text-emerald-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">واتساب الأعمال (Cloud API)</h3>
              <p className="text-xs text-slate-400 mt-0.5">يستخدم لإرسال تأكيدات الحجز والتذكيرات</p>
            </div>
          </div>
          {status && (
            <StatusBadge
              ok={status.whatsapp.configured}
              fallback={status.whatsapp.usingPlatform}
              label="حسابك"
            />
          )}
        </div>

        <div className="space-y-3 mt-5">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Permanent Token</label>
            <div className="relative">
              <input
                type={waShow ? 'text' : 'password'}
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
                placeholder="EAAG…"
                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 pl-9 py-2.5 text-white text-sm outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setWaShow(!waShow)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
              >
                {waShow ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Phone Number ID</label>
            <input
              type="text"
              value={waPhoneId}
              onChange={(e) => setWaPhoneId(e.target.value)}
              placeholder="1234567890"
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none font-mono"
            />
          </div>
          <button
            onClick={() => saveWhatsApp.mutate()}
            disabled={!waToken || !waPhoneId || saveWhatsApp.isPending}
            className="w-full py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {saveWhatsApp.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ واختبار
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            احصل على هذه البيانات من{' '}
            <a href="https://business.facebook.com" target="_blank" rel="noreferrer" className="text-brand-400 underline">
              Meta Business Manager
            </a>
            {' '}→ WhatsApp → API setup. سيتم إرسال رسالة اختبار على رقم جوّال الحساب.
          </p>
        </div>
      </section>

      {/* Moyasar */}
      <section className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <div className="flex items-start justify-between mb-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
              <CreditCard size={18} className="text-violet-400" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">بوابة الدفع — Moyasar</h3>
              <p className="text-xs text-slate-400 mt-0.5">STC Pay، مدى، Apple Pay، فيزا</p>
            </div>
          </div>
          {status && (
            <StatusBadge
              ok={status.payment.configured}
              fallback={status.payment.usingPlatform}
              label={status.payment.sandboxMode ? 'تجريبي' : 'حقيقي'}
            />
          )}
        </div>

        <div className="space-y-3 mt-5">
          <div>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">Secret API Key</label>
            <div className="relative">
              <input
                type={moyasarShow ? 'text' : 'password'}
                value={moyasarKey}
                onChange={(e) => setMoyasarKey(e.target.value)}
                placeholder="sk_live_… أو sk_test_…"
                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 pl-9 py-2.5 text-white text-sm outline-none font-mono"
              />
              <button
                type="button"
                onClick={() => setMoyasarShow(!moyasarShow)}
                className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
              >
                {moyasarShow ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input
              type="checkbox"
              checked={sandboxMode}
              onChange={(e) => setSandboxMode(e.target.checked)}
              className="accent-violet-500"
            />
            وضع تجريبي (sandbox) — مفاتيح <code className="px-1 rounded bg-slate-800">sk_test_</code>
          </label>
          <button
            onClick={() => saveMoyasar.mutate()}
            disabled={!moyasarKey || saveMoyasar.isPending}
            className="w-full py-2.5 rounded-xl text-xs font-black text-white bg-violet-600 hover:bg-violet-500 disabled:opacity-40 transition flex items-center justify-center gap-2"
          >
            {saveMoyasar.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ المفتاح
          </button>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            احصل على المفتاح من{' '}
            <a href="https://dashboard.moyasar.com" target="_blank" rel="noreferrer" className="text-brand-400 underline">
              dashboard.moyasar.com
            </a>
            {' '}→ Settings → API. المفتاح مشفّر AES-256 ولا يظهر بعد الحفظ.
          </p>
        </div>
      </section>

      <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 text-xs text-blue-200">
        <p className="font-bold mb-1">ما الفرق بين الإعداد الخاص بي وإعداد المنصة؟</p>
        <p className="text-blue-200/80 leading-relaxed">
          إذا تركت الحقول فارغة، سيستخدم متجرك الإعداد الافتراضي للمنصة (موجود لدى الإدارة).
          أضف بياناتك الخاصة لتستلم رسائل واتساب من رقمك التجاري ولتحصل المدفوعات في حسابك مباشرة.
        </p>
      </div>
    </div>
  );
}

// ─── Tab: Tracking & Ads (Google Ads, GA4, GTM, Meta, TikTok, Snap) ──────────

interface TrackingIds {
  ga4MeasurementId?: string;
  googleAdsId?: string;
  googleAdsConversion?: string;
  gtmContainerId?: string;
  metaPixelId?: string;
  tiktokPixelId?: string;
  snapPixelId?: string;
}

// ─── Tab: WhatsApp Auto-Reply Bot ─────────────────────────────────────────────

interface BotSettings {
  enabled?: boolean;
  greeting?: string;
  handoffKeywords?: string[];
  verifyToken?: string;
  aiEnabled?: boolean;
  // Governance — vendor controls what the bot is allowed to do
  canBook?: boolean;
  canApplyPromo?: boolean;
  maxBookingValue?: number;
  activeHours?: { start?: string; end?: string };
  dailyBookingLimit?: number;
  requireConfirmAbove?: number;
}

function BotTab({ vendor }: { vendor?: VendorProfile }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<BotSettings>({});
  const [keywordsInput, setKeywordsInput] = useState('');

  const { data, isLoading } = useQuery<BotSettings>({
    queryKey: ['bot-settings'],
    queryFn: () => api.get('/whatsapp-bot/settings').then((r) => r.data),
  });

  useEffect(() => {
    if (data) {
      setDraft(data);
      setKeywordsInput((data.handoffKeywords ?? []).join('، '));
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => api.put('/whatsapp-bot/settings', {
      ...draft,
      handoffKeywords: keywordsInput.split(/[،,\n]+/).map((s) => s.trim()).filter(Boolean),
    }),
    onSuccess: () => {
      toast.success('تم حفظ إعدادات البوت');
      qc.invalidateQueries({ queryKey: ['bot-settings'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  const webhookUrl = vendor?.id
    ? `${window.location.origin}/api/whatsapp-bot/webhook/${vendor.id}`
    : '';

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-orange-400" /></div>;
  }

  const enabled = draft.enabled ?? false;

  return (
    <div className="space-y-6" dir="rtl">
      {/* Status banner */}
      <div className={`rounded-2xl border p-5 ${enabled ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/8 bg-white/[0.02]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${enabled ? 'bg-emerald-500/20' : 'bg-white/5'}`}>
              <MessageCircle size={20} className={enabled ? 'text-emerald-400' : 'text-slate-500'} />
            </div>
            <div>
              <p className="text-sm font-black text-white">بوت واتساب التلقائي</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {enabled ? 'مفعّل — يرد على عملائك ٢٤ ساعة' : 'غير مفعّل'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, enabled: !enabled })}
            className={`w-12 h-7 rounded-full relative transition-colors ${enabled ? 'bg-emerald-500' : 'bg-white/15'}`}
          >
            <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow transition-all ${enabled ? 'right-0.5' : 'right-[calc(100%-1.625rem)]'}`} />
          </button>
        </div>
      </div>

      {/* What it does */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="text-sm font-black text-white mb-3">ماذا يفعل البوت؟</h3>
        <ul className="space-y-2 text-xs text-slate-300">
          {[
            'يرحّب بعملائك الجدد ويميّز العميل المتكرر باسمه',
            'يعرض الأسعار والخدمات بأزرار جاهزة (لا يكتب العميل)',
            'يجيب على ساعات العمل والموقع تلقائياً',
            'يأخذ حجزاً كاملاً: خدمة → موعد → تأكيد → ينشئ في النظام',
            'يحوّل المحادثة لك عند طلب موظف أو شكوى',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2">
              <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Governance — what the bot is allowed to do */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="text-sm font-black text-white mb-1">صلاحيات البوت</h3>
        <p className="text-[11px] text-slate-400 mb-4">حدّد ما يستطيع البوت أن يفعله بالنيابة عنك. القيود تطبّق فوراً.</p>

        <div className="space-y-3">
          {/* canBook */}
          <div className="flex items-start justify-between gap-3 py-2.5 border-b border-white/5">
            <div className="flex-1">
              <p className="text-sm font-bold text-white">إنشاء الحجوزات</p>
              <p className="text-[11px] text-slate-400 mt-0.5">يقدر البوت يحجز للعميل بدون موافقتك. لو معطّل، البوت يطلب من العميل الانتظار حتى ترد عليه.</p>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, canBook: !(draft.canBook ?? false) })}
              className={`flex-shrink-0 w-11 h-6 rounded-full relative transition-colors ${draft.canBook ? 'bg-emerald-500' : 'bg-white/15'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${draft.canBook ? 'right-0.5' : 'right-[calc(100%-1.375rem)]'}`} />
            </button>
          </div>

          {/* canApplyPromo */}
          <div className="flex items-start justify-between gap-3 py-2.5 border-b border-white/5">
            <div className="flex-1">
              <p className="text-sm font-bold text-white">تطبيق أكواد الخصم</p>
              <p className="text-[11px] text-slate-400 mt-0.5">يقدر يقترح/يطبّق أكواد الخصم النشطة لجذب العميل.</p>
            </div>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, canApplyPromo: !(draft.canApplyPromo ?? false) })}
              className={`flex-shrink-0 w-11 h-6 rounded-full relative transition-colors ${draft.canApplyPromo ? 'bg-emerald-500' : 'bg-white/15'}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${draft.canApplyPromo ? 'right-0.5' : 'right-[calc(100%-1.375rem)]'}`} />
            </button>
          </div>

          {/* maxBookingValue */}
          <div className="py-2.5 border-b border-white/5">
            <label className="text-sm font-bold text-white block mb-1">الحد الأعلى لقيمة الحجز التلقائي (ر.س)</label>
            <p className="text-[11px] text-slate-400 mb-2">حجوزات أعلى من هذا المبلغ تتطلب موافقتك أولاً.</p>
            <input
              type="number"
              min={0}
              value={draft.maxBookingValue ?? ''}
              onChange={(e) => setDraft({ ...draft, maxBookingValue: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="مثلاً: 500"
              className="w-32 bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-orange-500/40"
            />
          </div>

          {/* dailyBookingLimit */}
          <div className="py-2.5 border-b border-white/5">
            <label className="text-sm font-bold text-white block mb-1">حد الحجوزات اليومي للبوت</label>
            <p className="text-[11px] text-slate-400 mb-2">بعد هذا العدد يتوقف البوت ويحوّل الحجوزات الجديدة لك.</p>
            <input
              type="number"
              min={0}
              value={draft.dailyBookingLimit ?? ''}
              onChange={(e) => setDraft({ ...draft, dailyBookingLimit: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="مثلاً: 30"
              className="w-32 bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono outline-none focus:border-orange-500/40"
            />
          </div>

          {/* activeHours */}
          <div className="py-2.5">
            <label className="text-sm font-bold text-white block mb-1">ساعات نشاط البوت</label>
            <p className="text-[11px] text-slate-400 mb-2">خارج هذه الساعات يحوّل البوت المحادثة لك مباشرة.</p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={draft.activeHours?.start ?? ''}
                onChange={(e) => setDraft({ ...draft, activeHours: { ...(draft.activeHours ?? {}), start: e.target.value } })}
                className="bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500/40"
              />
              <span className="text-slate-500 text-xs">إلى</span>
              <input
                type="time"
                value={draft.activeHours?.end ?? ''}
                onChange={(e) => setDraft({ ...draft, activeHours: { ...(draft.activeHours ?? {}), end: e.target.value } })}
                className="bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-orange-500/40"
              />
              <span className="text-[11px] text-slate-500">اتركها فارغة = ٢٤ ساعة</span>
            </div>
          </div>
        </div>
      </div>

      {/* Greeting */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">رسالة الترحيب</label>
          <textarea
            value={draft.greeting ?? ''}
            onChange={(e) => setDraft({ ...draft, greeting: e.target.value })}
            rows={4}
            placeholder={`أهلاً بك في ${vendor?.nameAr ?? 'متجرنا'}!\nأقدر أعطيك الأسعار والمواعيد المتاحة.`}
            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none focus:border-orange-500/40"
          />
          <p className="text-[11px] text-slate-500 mt-1">اتركها فارغة لاستخدام الترحيب الافتراضي</p>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">كلمات تحويل المحادثة لك</label>
          <input
            type="text"
            value={keywordsInput}
            onChange={(e) => setKeywordsInput(e.target.value)}
            placeholder="موظف، شكوى، انسان"
            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-orange-500/40"
          />
          <p className="text-[11px] text-slate-500 mt-1">افصلها بفاصلة. عند ذكر العميل لأي منها يحوّل البوت المحادثة لك فوراً</p>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-300 block mb-1.5">Verify Token (لإعداد Meta)</label>
          <input
            type="text"
            value={draft.verifyToken ?? ''}
            onChange={(e) => setDraft({ ...draft, verifyToken: e.target.value })}
            placeholder="أنشئ كلمة عشوائية 8+ حروف"
            className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-orange-500/40"
          />
          <p className="text-[11px] text-slate-500 mt-1">انسخها وألصقها في Meta App → Webhooks → Verify Token</p>
        </div>

        <button
          type="button"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="w-full py-3 rounded-xl font-black text-white bg-orange-500 hover:bg-orange-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {save.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          حفظ
        </button>
      </div>

      {/* Webhook setup guide */}
      <div className="rounded-2xl border border-orange-500/20 bg-orange-500/5 p-5">
        <h3 className="text-sm font-black text-white mb-3">إعداد Meta App (مرة واحدة)</h3>
        <ol className="space-y-2 text-xs text-slate-300 list-decimal pr-5">
          <li>افتح <a href="https://developers.facebook.com/apps" target="_blank" rel="noreferrer" className="text-orange-400 underline">developers.facebook.com/apps</a></li>
          <li>اختر تطبيقك → WhatsApp → Configuration → Webhook</li>
          <li>الصق هذا الرابط في حقل Callback URL:</li>
        </ol>
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-3 mt-3 mb-3 flex items-center gap-2">
          <code className="flex-1 text-xs text-orange-300 font-mono truncate">{webhookUrl}</code>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(webhookUrl).catch(() => {})}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-white"
          >
            نسخ
          </button>
        </div>
        <ol className="space-y-2 text-xs text-slate-300 list-decimal pr-5" start={4}>
          <li>الصق Verify Token الذي حفظته أعلاه</li>
          <li>اشترك في حدث <code className="px-1 rounded bg-slate-800">messages</code> فقط</li>
          <li>عد هنا وفعّل البوت من الأعلى</li>
        </ol>
      </div>
    </div>
  );
}

function TrackingTab({ vendor }: { vendor?: VendorProfile }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<TrackingIds>({});

  const { data, isLoading } = useQuery<TrackingIds>({
    queryKey: ['vendor-tracking'],
    queryFn: () => api.get('/vendors/me/tracking').then((r) => r.data),
  });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/vendors/me/tracking', draft),
    onSuccess: () => {
      toast.success('تم حفظ معرّفات التتبع');
      qc.invalidateQueries({ queryKey: ['vendor-tracking'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  const storeUrl = vendor?.slug
    ? `${window.location.origin}/store/${vendor.slug}`
    : window.location.origin;
  const adUrlExample = `${storeUrl}?utm_source=google&utm_medium=cpc&utm_campaign=summer_sale`;

  const fields: Array<{ key: keyof TrackingIds; label: string; placeholder: string; help: string }> = [
    { key: 'gtmContainerId',     label: 'Google Tag Manager', placeholder: 'GTM-XXXXXXX', help: 'يدير كل الـ pixels من حاوية واحدة (موصى به للمتقدمين).' },
    { key: 'ga4MeasurementId',   label: 'Google Analytics 4', placeholder: 'G-XXXXXXXXXX', help: 'لتحليل الزيارات والتحويلات في GA4.' },
    { key: 'googleAdsId',        label: 'Google Ads Conversion ID', placeholder: 'AW-1234567890', help: 'لقياس تحويلات حملات Google Ads. خذها من Conversions → Tag setup.' },
    { key: 'googleAdsConversion',label: 'Google Ads Conversion Label', placeholder: 'abcDeFgH1jk', help: 'الـ Conversion Label (الجزء بعد الـ /). تطلق على كل حجز ناجح.' },
    { key: 'metaPixelId',        label: 'Meta Pixel (Facebook/Instagram)', placeholder: '123456789012345', help: 'Pixel ID من Meta Events Manager.' },
    { key: 'tiktokPixelId',      label: 'TikTok Pixel', placeholder: 'C4XXXXXXXXXXXXXXXX', help: 'من TikTok Ads Manager → Events → Web Events.' },
    { key: 'snapPixelId',        label: 'Snap Pixel', placeholder: 'XXXXXXXX-XXXX-XXXX-XXXX', help: 'من Snapchat Ads Manager → Events Manager.' },
  ];

  if (isLoading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="animate-spin text-orange-400" /></div>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Intro */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="text-sm font-black text-white mb-2">قِس نتائج إعلاناتك</h3>
        <p className="text-xs text-slate-400 leading-relaxed">
          ألصق معرّفات التتبع الخاصة بمتجرك. ستطلق المنصة الأحداث القياسية تلقائياً على صفحة متجرك العامة وصفحة الحجز:{' '}
          <code className="px-1 rounded bg-slate-800 text-orange-300">view_item</code>،{' '}
          <code className="px-1 rounded bg-slate-800 text-orange-300">begin_checkout</code>،{' '}
          <code className="px-1 rounded bg-slate-800 text-orange-300">purchase</code> — تشتغل عبر Google Ads، GA4، Meta، TikTok، وSnap.
        </p>
      </div>

      {/* Fields */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5 space-y-4">
        {fields.map((f) => (
          <div key={f.key}>
            <label className="text-xs font-bold text-slate-300 block mb-1.5">{f.label}</label>
            <input
              type="text"
              value={draft[f.key] ?? ''}
              onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
              placeholder={f.placeholder}
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-orange-500/40"
            />
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{f.help}</p>
          </div>
        ))}

        <button
          type="button"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="w-full py-3 rounded-xl font-black text-white bg-orange-500 hover:bg-orange-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
        >
          {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          حفظ
        </button>
      </div>

      {/* Ready-made ad URLs */}
      <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
        <h3 className="text-sm font-black text-white mb-2">روابط جاهزة لإعلاناتك</h3>
        <p className="text-xs text-slate-400 mb-4 leading-relaxed">
          استخدم هذه الروابط في إعلانات Google Ads / Meta / TikTok ليحسب النظام مصدر كل حجز ويربطه بحملتك.
        </p>

        <div className="space-y-3">
          <UrlExample label="رابط متجرك الأساسي" url={storeUrl} />
          <UrlExample label="مثال: حملة Google Ads صيف" url={adUrlExample} />
          <UrlExample label="مثال: حملة Instagram عودة العملاء" url={`${storeUrl}?utm_source=instagram&utm_medium=paid_social&utm_campaign=winback`} />
        </div>

        <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
          غيّر <code className="px-1 rounded bg-slate-800">utm_campaign</code> لكل حملة لتعرف أيهم يجلب أكثر حجوزات. ستجد التقرير في{' '}
          <Link to="/vendor/advanced-analytics" className="text-orange-400 underline">التحليلات المتقدمة</Link>.
        </p>
      </div>
    </div>
  );
}

function UrlExample({ label, url }: { label: string; url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="bg-slate-900/40 border border-white/8 rounded-xl p-3">
      <p className="text-[11px] text-slate-500 mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 text-xs text-orange-300 truncate font-mono">{url}</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(url).catch(() => {});
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-[10px] font-bold text-white flex items-center gap-1"
        >
          {copied ? <CheckCircle2 size={11} /> : <SettingsIcon size={11} />}
          {copied ? 'تم' : 'نسخ'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Settings Page ────────────────────────────────────────────────────────

export default function VendorSettings() {
  const [activeTab, setActiveTab] = useState<TabId>('business');
  const { user } = useAuth();
  const vendorId = user?.vendorId;

  const { data: vendor, isLoading } = useQuery<VendorProfile>({
    queryKey: ['vendor-profile'],
    queryFn: () => api.get('/vendors/me').then((r) => r.data),
    enabled: !!vendorId,
  });

  const tabContent: Record<TabId, React.ReactNode> = {
    business:      <BusinessTab vendor={vendor} />,
    bot:           <BotTab vendor={vendor} />,
    integrations:  <IntegrationsTab vendorId={vendorId} />,
    tracking:      <TrackingTab vendor={vendor} />,
    notifications: <NotificationsTab vendor={vendor} />,
    plan:          <PlanTab vendor={vendor} />,
    security:      <SecurityTab />,
    account:       <AccountTab vendor={vendor} />,
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0a1a] text-white"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-blue-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-purple-600/6 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to="/vendor" className="p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
            <ChevronLeft className="w-5 h-5 text-white/60 rotate-180" />
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white flex items-center gap-2">
              <SettingsIcon className="w-6 h-6 text-blue-400" />
              الإعدادات
            </h1>
            <p className="text-white/40 text-sm mt-0.5">إدارة جميع إعدادات مغسلتك في مكان واحد</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ── Sidebar / Tab List ─────────────────────────────────────── */}
          <aside className="lg:w-56 flex-shrink-0">
            {/* Mobile: horizontal scroll */}
            <div className="lg:hidden flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-all flex-shrink-0 ${
                    activeTab === id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Desktop: vertical pills */}
            <nav className="hidden lg:flex flex-col gap-1.5">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold text-right transition-all ${
                    activeTab === id
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                      : 'text-white/50 hover:bg-white/5 hover:text-white/80'
                  }`}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {label}
                </button>
              ))}
            </nav>
          </aside>

          {/* ── Tab Content ────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">
            <div className="bg-white/5 border border-white/8 rounded-2xl p-6 backdrop-blur-sm">
              {isLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-blue-500/40 border-t-blue-500 rounded-full animate-spin" />
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.18 }}
                  >
                    {tabContent[activeTab]}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
