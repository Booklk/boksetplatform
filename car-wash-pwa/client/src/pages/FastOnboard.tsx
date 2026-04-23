/**
 * FastOnboard — ~3-minute "sign up + pick a template + pick colours + done"
 * flow at /start.
 *
 * Replaces the old /onboard (3 steps) → /vendor/wizard (7 steps) chain for
 * new vendors. Uses the existing POST /api/vendors/onboard endpoint plus
 * a PUT /api/vendors/my follow-up to persist the chosen template + custom
 * theme. Services, logo, advanced settings are intentionally skipped —
 * vendor can fill them from the dashboard whenever they want.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ArrowLeft, ArrowRight, CheckCircle, Loader2, Sparkles, Copy, Share2,
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import MarketingLayout from '../components/marketing/MarketingLayout';
import { Button, Input, Card } from '../components/ui';
import {
  STORE_THEMES, getFreeTemplateIds, StoreTheme,
} from '../lib/storeThemes';
import {
  PALETTE_PRESETS, paletteToTheme, TEMPLATE_DEFAULT_PALETTE,
  DEFAULT_CUSTOM_THEME, CustomTheme, RADIUS_VALUES,
} from '../lib/customTheme';

/* ─── Industry options (same as the old VendorOnboarding) ────────────── */
const INDUSTRIES = [
  { id: 'car_wash',      label: 'مغسلة سيارات',               icon: '🚗' },
  { id: 'salon',         label: 'صالون / حلاق',                icon: '💈' },
  { id: 'beauty_home',   label: 'تجميل منزلي / سبا / مساج',    icon: '💄' },
  { id: 'spa',           label: 'مركز سبا',                    icon: '🌿' },
  { id: 'cleaning',      label: 'شركة تنظيف',                  icon: '🧹' },
  { id: 'home_cleaning', label: 'تنظيف منازل',                 icon: '🏠' },
  { id: 'movers',        label: 'نقل عفش',                     icon: '📦' },
  { id: 'other',         label: 'نشاط آخر',                    icon: '⭐' },
];

/* ─── Saudi cities ───────────────────────────────────────────────────── */
const CITIES = [
  'الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام',
  'الأحساء', 'الطائف', 'بريدة', 'تبوك', 'خميس مشيط',
  'حائل', 'نجران', 'الجبيل', 'أبها', 'ينبع',
];

type Step = 0 | 1 | 2 | 3;

interface AccountForm {
  ownerName: string;
  nameAr: string;
  phone: string;
  email: string;
  city: string;
  industry: string;
  password: string;
}

interface OnboardResp {
  token: string;
  user: { id: number; role: string; vendorId: number };
  vendor: { id: number; slug: string; nameAr: string };
}

/* ═══════════════════════════════════════════════════════════════════════ */

export default function FastOnboard() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [form, setForm] = useState<AccountForm>({
    ownerName: '', nameAr: '', phone: '', email: '',
    city: '', industry: '', password: '',
  });
  const [vendorSlug, setVendorSlug] = useState<string>('');
  const [selectedThemeId, setSelectedThemeId] = useState<string>('');
  const [customTheme, setCustomTheme] = useState<CustomTheme>(DEFAULT_CUSTOM_THEME);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);

  // OTP verification state — step 0 cannot finish until the phone is proven.
  const [otpOpen, setOtpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerifying, setOtpVerifying] = useState(false);
  const [verifyToken, setVerifyToken] = useState<string>('');

  // Templates the free plan can choose from, seeded from the industry
  // picked in step 0. Updated whenever the vendor changes their industry.
  const freeTemplateIds = useMemo(() => getFreeTemplateIds(form.industry), [form.industry]);
  const freeTemplates = useMemo<StoreTheme[]>(
    () => freeTemplateIds.map((id) => STORE_THEMES.find((t) => t.id === id)).filter(Boolean) as StoreTheme[],
    [freeTemplateIds],
  );

  // Seed a first template + its palette as soon as we know the industry.
  useEffect(() => {
    if (!form.industry || selectedThemeId) return;
    const first = freeTemplateIds[0];
    if (first) {
      setSelectedThemeId(first);
      const presetId = TEMPLATE_DEFAULT_PALETTE[first];
      const preset = PALETTE_PRESETS.find((p) => p.id === presetId);
      if (preset) {
        setCustomTheme(paletteToTheme(preset, 'rounded'));
        setActivePresetId(preset.id);
      }
    }
  }, [form.industry, freeTemplateIds, selectedThemeId]);

  /* ─── Mutations ───────────────────────────────────────────────────── */

  const registerMutation = useMutation({
    mutationFn: (payload: AccountForm & { verifyToken?: string }) => api.post<OnboardResp>('/vendors/onboard', {
      nameAr: payload.nameAr,
      phone: payload.phone,
      email: payload.email || undefined,
      city: payload.city,
      ownerName: payload.ownerName,
      password: payload.password,
      industry: payload.industry,
      plan: 'free',
      verifyToken: payload.verifyToken,
    }).then((r) => r.data),
    onSuccess: (res) => {
      login(res.token, res.user as any);
      setVendorSlug(res.vendor.slug);
      setStep(1);
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e?.response?.data?.error ?? 'تعذّر إنشاء الحساب');
    },
  });

  const persistThemeMutation = useMutation({
    mutationFn: () => api.put('/vendors/my', {
      primaryColor: customTheme.button,
      settings: { storeTheme: selectedThemeId, customTheme },
    }),
    onSuccess: () => setStep(3),
    onError: () => toast.error('تعذّر حفظ التصميم — جرّب مرة ثانية'),
  });

  /* ─── Actions ─────────────────────────────────────────────────────── */

  async function submitAccount() {
    // Basic validation, concise Arabic errors matching the backend style.
    if (!form.ownerName.trim()) return toast.error('اسمك الكامل مطلوب');
    if (!form.nameAr.trim()) return toast.error('اسم متجرك مطلوب');
    if (!/^(05\d{8}|\+?9665\d{8})$/.test(form.phone.replace(/\s/g, '')))
      return toast.error('رقم الجوال غير صحيح — 05XXXXXXXX');
    if (!form.city) return toast.error('اختر مدينتك');
    if (!form.industry) return toast.error('اختر نشاطك');
    if (form.password.length < 8) return toast.error('كلمة المرور ٨ أحرف أو أكثر');
    if (!/[A-Z]/.test(form.password) || !/[0-9]/.test(form.password))
      return toast.error('كلمة المرور تحتاج حرف كبير ورقم واحد على الأقل');

    // Already verified? Straight to register.
    if (verifyToken) {
      registerMutation.mutate({ ...form, verifyToken });
      return;
    }

    // Otherwise send OTP via WhatsApp and open the verify modal.
    setOtpSending(true);
    try {
      await api.post('/auth/send-otp', { phone: form.phone, purpose: 'signup' });
      setOtpOpen(true);
      toast.success('أرسلنا رمز تحقق على واتساب');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'تعذر إرسال رمز التحقق');
    } finally {
      setOtpSending(false);
    }
  }

  // When the server applies progressive backoff on wrong OTP codes, it
  // includes a `retryAfter` seconds field in the 429 response. We surface
  // it as a live countdown so the user isn't staring at a button that
  // silently refuses to work.
  const [retrySec, setRetrySec] = useState(0);
  useEffect(() => {
    if (retrySec <= 0) return;
    const t = window.setInterval(() => setRetrySec((n) => (n <= 1 ? 0 : n - 1)), 1000);
    return () => window.clearInterval(t);
  }, [retrySec]);

  async function verifyOtp() {
    if (otpCode.length !== 6) return toast.error('الرمز 6 أرقام');
    if (retrySec > 0) return toast.error(`انتظر ${retrySec} ثانية`);
    setOtpVerifying(true);
    try {
      const { data } = await api.post<{ verifyToken: string }>('/auth/verify-otp', {
        phone: form.phone,
        code: otpCode,
      });
      setVerifyToken(data.verifyToken);
      setOtpOpen(false);
      toast.success('تم التحقق من رقمك');
      registerMutation.mutate({ ...form, verifyToken: data.verifyToken });
    } catch (e: any) {
      const after = Number(e?.response?.data?.retryAfter);
      if (Number.isFinite(after) && after > 0) {
        setRetrySec(Math.ceil(after));
      }
      toast.error(e?.response?.data?.error ?? 'الرمز غير صحيح');
    } finally {
      setOtpVerifying(false);
    }
  }

  async function resendOtp() {
    setOtpSending(true);
    try {
      await api.post('/auth/send-otp', { phone: form.phone, purpose: 'signup' });
      toast.success('أعدنا إرسال الرمز');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'تعذر إعادة الإرسال');
    } finally {
      setOtpSending(false);
    }
  }

  function applyPreset(presetId: string) {
    const preset = PALETTE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setCustomTheme(paletteToTheme(preset, customTheme.radius));
    setActivePresetId(preset.id);
  }

  /* ─── Render ──────────────────────────────────────────────────────── */

  return (
    <MarketingLayout>
      <div className="max-w-3xl mx-auto px-4 py-10" dir="rtl">
        {/* Progress bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-bold text-white/50">الخطوة {step + 1} من 4</span>
            <span className="font-bold text-indigo-400">{Math.round(((step + 1) / 4) * 100)}٪</span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${((step + 1) / 4) * 100}%` }}
              className="h-full bg-gradient-to-l from-indigo-500 to-blue-400"
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
            />
          </div>
        </div>

        <AnimatePresence mode="wait">
          {/* ═══ STEP 0: Account ═══════════════════════════════════════ */}
          {step === 0 && (
            <motion.div
              key="step0"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div className="text-center mb-6">
                <h1 className="text-3xl sm:text-4xl font-black text-white mb-2">متجرك جاهز في 3 دقائق</h1>
                <p className="text-slate-400 text-sm">ابدأ موقعك الإلكتروني بدون بطاقة ائتمان، بدون التزام</p>
              </div>

              <div className="bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 space-y-4">
                <Field label="اسمك الكامل *" value={form.ownerName} onChange={(v) => setForm({ ...form, ownerName: v })} placeholder="مثال: محمد أحمد" />
                <Field label="اسم متجرك *" value={form.nameAr} onChange={(v) => setForm({ ...form, nameAr: v })} placeholder="مثال: صالون الخليج" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="رقم الجوال *" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} placeholder="05XXXXXXXX" dir="ltr" />
                  <Field label="البريد الإلكتروني" value={form.email} onChange={(v) => setForm({ ...form, email: v })} placeholder="name@example.com" dir="ltr" />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">المدينة *</label>
                  <select
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm outline-none"
                  >
                    <option value="">اختر مدينتك</option>
                    {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1.5">نشاطك *</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind.id}
                        type="button"
                        onClick={() => {
                          setForm({ ...form, industry: ind.id });
                          setSelectedThemeId(''); // re-seed in effect
                        }}
                        className={`text-right p-2.5 rounded-xl border-2 transition-all ${
                          form.industry === ind.id
                            ? 'border-indigo-500/50 bg-indigo-500/10'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                        }`}
                      >
                        <div className="text-2xl mb-0.5">{ind.icon}</div>
                        <p className="text-[11px] font-bold text-white">{ind.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Field
                  label="كلمة المرور *"
                  type="password"
                  value={form.password}
                  onChange={(v) => setForm({ ...form, password: v })}
                  placeholder="8 أحرف + حرف كبير + رقم"
                  dir="ltr"
                />
                <p className="text-[11px] text-slate-500">
                  🔒 كلمة المرور لحماية حسابك — تحتاج 8 أحرف على الأقل، فيها حرف كبير ورقم.
                </p>
              </div>

              <Button
                size="lg"
                fullWidth
                loading={registerMutation.isPending || otpSending}
                onClick={submitAccount}
                rightIcon={<ArrowLeft size={16} />}
              >
                {verifyToken ? 'التالي — اختيار قالبك' : 'التحقق من رقم جوالي'}
              </Button>
              <p className="text-[11px] text-slate-500 text-center">
                بنرسل لك رمز تحقق بواتساب للتأكد من رقمك — خطوة واحدة بس.
              </p>
            </motion.div>
          )}

          {/* ═══ STEP 1: Template picker ═══════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div className="text-center mb-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">اختر قالب موقعك</h2>
                <p className="text-slate-400 text-sm">3 قوالب مختارة لنشاطك — تقدر تغيّره لاحقاً في أي وقت</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {freeTemplates.map((theme) => {
                  const selected = selectedThemeId === theme.id;
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => {
                        setSelectedThemeId(theme.id);
                        const presetId = TEMPLATE_DEFAULT_PALETTE[theme.id];
                        const preset = PALETTE_PRESETS.find((p) => p.id === presetId);
                        if (preset) {
                          setCustomTheme(paletteToTheme(preset, customTheme.radius));
                          setActivePresetId(preset.id);
                        }
                      }}
                      className={`text-right rounded-2xl border-2 overflow-hidden transition-all ${
                        selected
                          ? 'border-indigo-500 shadow-lg shadow-indigo-500/20 ring-1 ring-indigo-500/30'
                          : 'border-white/[0.08] hover:border-white/[0.2]'
                      }`}
                    >
                      <div className={`h-24 bg-gradient-to-br ${theme.gradient} relative`}>
                        <div className="absolute bottom-2 inset-x-2 flex gap-1">
                          <div className="flex-1 h-6 rounded bg-white/10 border border-white/10" />
                          <div className="flex-1 h-6 rounded bg-white/10 border border-white/10" />
                        </div>
                        <div className="absolute top-2 left-2 h-4 w-12 rounded-full" style={{ background: theme.accent, opacity: 0.85 }} />
                        {selected && (
                          <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center">
                            <CheckCircle className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="p-3 bg-surface-2">
                        <p className="text-sm font-bold text-white">{theme.name}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5 line-clamp-2">{theme.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 font-bold text-sm transition-colors hover:bg-white/[0.08]"
                >
                  <ArrowRight size={14} className="inline ml-1" /> رجوع
                </button>
                <button
                  onClick={() => setStep(2)}
                  disabled={!selectedThemeId}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-colors disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  التالي — ألوانك
                  <ArrowLeft size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: Colour palette ═══════════════════════════════ */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-5"
            >
              <div className="text-center mb-2">
                <h2 className="text-2xl sm:text-3xl font-black text-white mb-2">اختر ألوان موقعك</h2>
                <p className="text-slate-400 text-sm">تقدر تعدّل الألوان بتفصيل أكثر لاحقاً من لوحة التحكم</p>
              </div>

              {/* Palette presets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PALETTE_PRESETS.map((preset) => {
                  const active = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset.id)}
                      className={`relative p-3 rounded-xl border-2 transition-all text-right ${
                        active ? 'border-white shadow-lg' : 'border-white/[0.08] hover:border-white/[0.2]'
                      }`}
                      style={{ background: preset.palette.surface }}
                    >
                      <div className="flex gap-1 mb-2">
                        <span className="w-4 h-4 rounded-full" style={{ background: preset.palette.button }} />
                        <span className="w-4 h-4 rounded-full" style={{ background: preset.palette.accent }} />
                        <span className="w-4 h-4 rounded-full" style={{ background: preset.palette.bg, border: '1px solid rgba(255,255,255,0.1)' }} />
                      </div>
                      <p className="text-xs font-bold truncate" style={{ color: preset.palette.text }}>{preset.name}</p>
                      {active && (
                        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white flex items-center justify-center">
                          <CheckCircle className="w-3.5 h-3.5 text-slate-900" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Live preview */}
              <div
                className="p-5 rounded-2xl border"
                style={{
                  background: customTheme.bg,
                  borderColor: `${customTheme.text}15`,
                  color: customTheme.text,
                }}
              >
                <p className="text-[10px] opacity-60 mb-3">معاينة مباشرة</p>
                <div
                  className="p-4 mb-3"
                  style={{
                    background: customTheme.surface,
                    borderRadius: RADIUS_VALUES[customTheme.radius],
                  }}
                >
                  <p className="text-base font-bold mb-1">{form.nameAr || 'اسم متجرك'}</p>
                  <p className="text-xs opacity-70 mb-3">الخدمات متاحة — احجز موعدك بسهولة</p>
                  <button
                    className="px-5 py-2 text-sm font-bold text-white"
                    style={{ background: customTheme.button, borderRadius: RADIUS_VALUES[customTheme.radius] }}
                  >
                    احجز الآن
                  </button>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08] text-slate-300 font-bold text-sm hover:bg-white/[0.08]"
                >
                  <ArrowRight size={14} className="inline ml-1" /> رجوع
                </button>
                <button
                  onClick={() => persistThemeMutation.mutate()}
                  disabled={persistThemeMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {persistThemeMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                  نشر موقعي
                  <Sparkles size={14} />
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 3: Done ═══════════════════════════════════════════ */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-10"
            >
              <motion.div
                initial={{ scale: 0.6 }}
                animate={{ scale: 1 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center"
              >
                <CheckCircle className="w-10 h-10 text-emerald-400" />
              </motion.div>
              <h2 className="text-3xl font-black text-white mb-2">مبروك! متجرك منشور</h2>
              <p className="text-slate-400 text-sm mb-8">شارك الرابط مع عملائك وابدأ استقبال الحجوزات</p>

              <div className="bg-white/[0.04] border border-white/[0.08] rounded-xl p-4 mb-6 text-center max-w-md mx-auto">
                <p className="text-xs text-slate-500 mb-1">رابط متجرك</p>
                <p className="text-indigo-300 font-mono text-sm break-all" dir="ltr">
                  {typeof window !== 'undefined' ? `${window.location.origin}/store/${vendorSlug}` : `/store/${vendorSlug}`}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-center max-w-md mx-auto">
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/store/${vendorSlug}`;
                    navigator.clipboard.writeText(url);
                    toast.success('تم النسخ!');
                  }}
                  className="flex-1 py-3 rounded-xl bg-white/[0.05] border border-white/[0.1] text-white font-bold text-sm hover:bg-white/[0.08] inline-flex items-center justify-center gap-2"
                >
                  <Copy size={14} /> نسخ الرابط
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`احجز معي الآن: ${window.location.origin}/store/${vendorSlug}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2"
                >
                  <Share2 size={14} /> شارك على واتساب
                </a>
              </div>

              <div className="mt-10">
                <button
                  onClick={() => navigate('/vendor')}
                  className="inline-flex items-center gap-2 text-indigo-300 hover:text-white text-sm font-bold"
                >
                  الذهاب للوحة التحكم
                  <ArrowLeft size={14} />
                </button>
              </div>

              <p className="text-[11px] text-slate-600 mt-8">
                أضف خدماتك وأسعارها من لوحة التحكم — في أي وقت.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Login link on the first step */}
        {step === 0 && (
          <p className="text-center text-sm text-slate-500 mt-6">
            عندك حساب؟{' '}
            <Link to="/login" className="text-indigo-400 hover:text-white font-bold">
              تسجيل الدخول
            </Link>
          </p>
        )}

        {/* OTP verify modal */}
        <AnimatePresence>
          {otpOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => !otpVerifying && setOtpOpen(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-sm bg-slate-900 border border-white/10 rounded-2xl p-6"
                dir="rtl"
              >
                <h3 className="text-xl font-black text-white mb-1 text-center">تحقق من رقمك</h3>
                <p className="text-center text-slate-400 text-sm mb-5">
                  أرسلنا رمزاً من 6 أرقام على واتساب إلى{' '}
                  <span dir="ltr" className="text-white font-bold">{form.phone}</span>
                </p>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="------"
                  dir="ltr"
                  className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/40 rounded-xl px-4 py-3 text-2xl text-center tracking-[0.5em] font-mono text-white outline-none mb-4"
                  autoFocus
                />
                <Button
                  onClick={verifyOtp}
                  disabled={otpCode.length !== 6 || retrySec > 0}
                  loading={otpVerifying}
                  fullWidth
                >
                  {retrySec > 0 ? `انتظر ${retrySec} ثانية` : 'تأكيد وإنشاء المتجر'}
                </Button>
                <div className="flex items-center justify-between mt-4 text-[11px]">
                  <button
                    onClick={resendOtp}
                    disabled={otpSending}
                    className="text-slate-400 hover:text-indigo-300 disabled:opacity-50"
                  >
                    ما وصلني — إعادة الإرسال
                  </button>
                  <button
                    onClick={() => setOtpOpen(false)}
                    className="text-slate-500 hover:text-white"
                  >
                    إغلاق
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </MarketingLayout>
  );
}

/* ─── Small reusable field ─────────────────────────────────────────────── */

function Field({
  label, value, onChange, placeholder, type = 'text', dir,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  dir?: 'ltr' | 'rtl';
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-slate-400 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm outline-none"
      />
    </div>
  );
}
