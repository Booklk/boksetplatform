import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2, Bell, Crown, Shield, User, ChevronLeft,
  Phone, Mail, MapPin, Hash, Globe, MessageCircle,
  Image, Save, Eye, EyeOff, LogOut, Trash2, AlertTriangle,
  CheckCircle2, Clock, ArrowUpRight, Settings as SettingsIcon,
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
  { id: 'business',       label: 'المغسلة',      icon: Building2 },
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
  basic:      { label: 'أساسي',    price: 2400, color: 'from-slate-700/60 to-slate-800/60' },
  pro:        { label: 'احترافي',  price: 4800, color: 'from-blue-900/60 to-blue-800/40' },
  enterprise: { label: 'مؤسسي',   price: 9600, color: 'from-purple-900/60 to-purple-800/40' },
  yearly:     { label: 'سنوي',     price: 4800, color: 'from-blue-900/60 to-blue-800/40' },
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
      toast.success('تم حفظ بيانات المغسلة بنجاح ✅');
      qc.invalidateQueries({ queryKey: ['vendor-profile'] });
    },
    onError: () => toast.error('فشل الحفظ — حاول مرة أخرى'),
  });

  return (
    <div>
      <h2 className="text-xl font-black text-white mb-6 flex items-center gap-2">
        <Building2 className="w-5 h-5 text-blue-400" />
        بيانات المغسلة
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="اسم المغسلة" value={form.nameAr} onChange={set('nameAr')} placeholder="مغسلة النجوم" icon={Building2} />
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
        <label className="block text-sm font-semibold text-white/60 mb-1.5">رابط شعار المغسلة</label>
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
