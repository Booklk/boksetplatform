import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Globe,
  CreditCard,
  Save,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  MapPin,
  Building2,
  Image,
  Eye,
  MessageCircle,
  Lock,
  ChevronDown,
  Settings,
  Link,
  Info,
  Copy,
  Wand2,
  ChevronUp,
} from 'lucide-react';
import LogoGenerator from '../../components/LogoGenerator';
import { useQuery, useMutation } from '@tanstack/react-query';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface VendorData {
  nameAr?: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  descriptionAr?: string;
  primaryColor?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  serviceAreas?: string[];
  whatsappPhoneId?: string;
  whatsappToken?: string;
  paymentProvider?: string;
  merchantId?: string;
  apiKey?: string;
  secretKey?: string;
  sandboxMode?: boolean;
  customDomain?: string;
  appIconUrl?: string;
  slug?: string;
}

const SAUDI_AREAS = [
  'الياسمين', 'الملقا', 'الصحافة', 'العقيق', 'الندى', 'النرجس', 'العارض',
  'حطين', 'الوادي', 'الغدير', 'الربيع', 'الرحمانية', 'قرطبة', 'الملك فهد', 'المروج',
];

const PAYMENT_PROVIDERS = [
  { value: 'stcpay', label: 'STC Pay' },
  { value: 'checkout', label: 'Checkout.com' },
  { value: 'moyasar', label: 'Moyasar' },
  { value: 'tabby', label: 'Tabby' },
  { value: 'tamara', label: 'Tamara' },
];

const tabs = [
  { id: 'basic', label: 'المعلومات الأساسية', icon: Building2 },
  { id: 'appearance', label: 'المظهر والهوية', icon: Palette },
  { id: 'financial', label: 'الخدمات المالية', icon: CreditCard },
  { id: 'domain', label: 'الدومين الخاص', icon: Link },
] as const;

type TabId = (typeof tabs)[number]['id'];

interface ToastState {
  msg: string;
  type: 'success' | 'error';
}

function InputField({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  icon: Icon,
  multiline = false,
  help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  icon?: React.ElementType;
  multiline?: boolean;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-white/70 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && !multiline && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Icon className="w-4 h-4 text-white/30" />
          </div>
        )}
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-purple-500/60 transition-all resize-none text-sm"
          />
        ) : (
          <input
            type={type}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 focus:outline-none focus:border-purple-500/60 transition-all text-sm ${Icon ? 'pr-10' : ''}`}
          />
        )}
      </div>
      {help && <p className="text-white/30 text-xs mt-1">{help}</p>}
    </div>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/70 text-sm font-semibold">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
          checked ? 'bg-purple-500' : 'bg-white/15'
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

export default function VendorBranding() {
  const { user } = useAuth();
  const vendorId = user?.vendorId;
  const [activeTab, setActiveTab] = useState<TabId>('basic');
  const [toast, setToast] = useState<ToastState | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const [initialized, setInitialized] = useState(false);

  // Form state
  const [form, setForm] = useState<VendorData>({});
  const [showLogoGenerator, setShowLogoGenerator] = useState(false);

  const setField = <K extends keyof VendorData>(key: K, value: VendorData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Fetch vendor data
  const { data: vendorData, isLoading } = useQuery<VendorData>({
    queryKey: ['vendor-data', vendorId],
    queryFn: async () => {
      const { data } = await api.get(`/vendors/${vendorId}`);
      return data;
    },
    enabled: !!vendorId,
  });

  // Pre-fill form when data arrives
  useEffect(() => {
    if (vendorData && !initialized) {
      setForm(vendorData);
      setInitialized(true);
    }
  }, [vendorData, initialized]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: (payload: Partial<VendorData>) => api.put(`/vendors/${vendorId}`, payload),
    onSuccess: () => showToast('تم الحفظ بنجاح'),
    onError: () => showToast('حدث خطأ أثناء الحفظ', 'error'),
  });

  // Animated tab indicator
  useEffect(() => {
    if (!tabsRef.current) return;
    const activeEl = tabsRef.current.querySelector(
      `[data-tab="${activeTab}"]`
    ) as HTMLElement | null;
    if (activeEl) {
      const parentRect = tabsRef.current.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      setIndicatorStyle({
        left: elRect.left - parentRect.left,
        width: elRect.width,
      });
    }
  }, [activeTab]);

  const toggleArea = (area: string) => {
    const current = form.serviceAreas ?? [];
    setField(
      'serviceAreas',
      current.includes(area) ? current.filter((a) => a !== area) : [...current, area]
    );
  };

  const handleSave = () => {
    if (activeTab === 'basic') {
      saveMutation.mutate({
        nameAr: form.nameAr,
        nameEn: form.nameEn,
        phone: form.phone,
        email: form.email,
        address: form.address,
        city: form.city,
        descriptionAr: form.descriptionAr,
      });
    } else if (activeTab === 'appearance') {
      saveMutation.mutate({
        primaryColor: form.primaryColor,
        logoUrl: form.logoUrl,
        coverImageUrl: form.coverImageUrl,
        serviceAreas: form.serviceAreas,
        appIconUrl: form.appIconUrl,
      });
    } else if (activeTab === 'financial') {
      saveMutation.mutate({
        whatsappPhoneId: form.whatsappPhoneId,
        whatsappToken: form.whatsappToken,
        paymentProvider: form.paymentProvider,
        merchantId: form.merchantId,
        apiKey: form.apiKey,
        secretKey: form.secretKey,
        sandboxMode: form.sandboxMode,
      });
    } else if (activeTab === 'domain') {
      saveMutation.mutate({ customDomain: form.customDomain });
    }
  };

  const isLogoValid =
    !!form.logoUrl &&
    (form.logoUrl.startsWith('http') || form.logoUrl.startsWith('/'));
  const isCoverValid =
    !!form.coverImageUrl &&
    (form.coverImageUrl.startsWith('http') || form.coverImageUrl.startsWith('/'));

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0a0a1a] text-white"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[500px] bg-purple-600/8 rounded-full blur-[130px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-blue-600/8 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-5 py-10">
        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex items-center gap-4"
        >
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 shadow-lg shadow-purple-500/30">
            <Settings className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">إعدادات المغسلة</h1>
            <p className="text-white/40 text-sm">إدارة معلومات وهوية مغسلتك</p>
          </div>
        </motion.div>

        {/* ─── Shareable Link Card ─── */}
        {(() => {
          const shareUrl = vendorData?.customDomain
            ? `https://${vendorData.customDomain}`
            : `https://bokset.sa/store/${vendorData?.slug ?? ''}`;
          return (
            <div className="mb-8 rounded-2xl border border-white/10 bg-white/5 p-6">
              <h3 className="text-white font-bold text-lg mb-4">🔗 رابط مغسلتك</h3>

              {/* Visual link card */}
              <div className="rounded-xl border border-blue-500/30 bg-gradient-to-br from-blue-950/40 to-slate-900 p-5 mb-4">
                <div className="flex items-center gap-3 mb-3">
                  {vendorData?.logoUrl ? (
                    <img src={vendorData.logoUrl} className="w-12 h-12 rounded-xl object-cover" alt={vendorData.nameAr} />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center text-2xl">🚗</div>
                  )}
                  <div>
                    <div className="text-white font-black text-lg">{vendorData?.nameAr ?? 'مغسلتي'}</div>
                    <div className="text-slate-400 text-sm">مغسلة سيارات متنقلة</div>
                  </div>
                </div>
                <div className="bg-black/30 rounded-lg px-4 py-2.5 font-mono text-blue-300 text-sm select-all">
                  {shareUrl}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 flex-wrap">
                <button
                  onClick={() => { navigator.clipboard.writeText(shareUrl); showToast('تم نسخ الرابط'); }}
                  className="flex items-center gap-2 bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all"
                >
                  <Copy size={14} /> نسخ الرابط
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`احجز غسيل سيارتك من ${vendorData?.nameAr ?? 'مغسلتنا'}: ${shareUrl}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                >
                  📤 شارك على واتساب
                </a>
                {vendorData?.slug && (
                  <a
                    href={`/store/${vendorData.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/20 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  >
                    👁️ معاينة صفحتك
                  </a>
                )}
              </div>

              {/* QR Code hint */}
              <p className="text-slate-500 text-xs mt-3">💡 ضع هذا الرابط على سيارتك — العميل يمسح ويحجز مباشرة</p>
            </div>
          );
        })()}

        {/* Tabs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative mb-8"
        >
          <div
            ref={tabsRef}
            className="relative flex bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-1.5 gap-1"
          >
            {/* Animated indicator */}
            <motion.div
              className="absolute top-1.5 h-[calc(100%-12px)] bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg shadow-purple-500/30 pointer-events-none"
              animate={{ left: indicatorStyle.left, width: indicatorStyle.width }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            />
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                data-tab={id}
                onClick={() => setActiveTab(id)}
                className={`relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === id ? 'text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.22 }}
            className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 space-y-5"
          >
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 bg-white/5 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <>
                {/* ─── Tab 1: Basic Info ─── */}
                {activeTab === 'basic' && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputField
                        label="اسم المغسلة بالعربية"
                        value={form.nameAr ?? ''}
                        onChange={(v) => setField('nameAr', v)}
                        placeholder="مغسلة النجوم"
                        icon={Building2}
                      />
                      <InputField
                        label="اسم المغسلة بالإنجليزية"
                        value={form.nameEn ?? ''}
                        onChange={(v) => setField('nameEn', v)}
                        placeholder="Al Nujoom Car Wash"
                        icon={Globe}
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <InputField
                        label="رقم الجوال"
                        value={form.phone ?? ''}
                        onChange={(v) => setField('phone', v)}
                        placeholder="05xxxxxxxx"
                        icon={Phone}
                        type="tel"
                      />
                      <InputField
                        label="البريد الإلكتروني"
                        value={form.email ?? ''}
                        onChange={(v) => setField('email', v)}
                        placeholder="info@carwash.sa"
                        icon={Mail}
                        type="email"
                      />
                    </div>
                    <InputField
                      label="العنوان"
                      value={form.address ?? ''}
                      onChange={(v) => setField('address', v)}
                      placeholder="شارع الأمير محمد بن عبدالعزيز"
                      icon={MapPin}
                    />
                    <InputField
                      label="المدينة"
                      value={form.city ?? ''}
                      onChange={(v) => setField('city', v)}
                      placeholder="الرياض"
                      icon={MapPin}
                    />
                    <InputField
                      label="وصف المغسلة"
                      value={form.descriptionAr ?? ''}
                      onChange={(v) => setField('descriptionAr', v)}
                      placeholder="نقدم خدمات غسيل السيارات المتنقلة بأعلى جودة..."
                      multiline
                    />
                  </>
                )}

                {/* ─── Tab 2: Appearance ─── */}
                {activeTab === 'appearance' && (
                  <>
                    {/* Color Picker */}
                    <div>
                      <label className="block text-sm font-semibold text-white/70 mb-2">
                        اللون الرئيسي
                      </label>
                      <div className="flex items-center gap-4">
                        <input
                          type="color"
                          value={form.primaryColor ?? '#7c3aed'}
                          onChange={(e) => setField('primaryColor', e.target.value)}
                          className="w-14 h-14 rounded-xl border-2 border-white/20 cursor-pointer bg-transparent p-1"
                        />
                        <div
                          className="flex-1 h-14 rounded-xl border transition-all"
                          style={{
                            background: `linear-gradient(135deg, ${form.primaryColor ?? '#7c3aed'}44, ${form.primaryColor ?? '#7c3aed'}22)`,
                            borderColor: `${form.primaryColor ?? '#7c3aed'}50`,
                            boxShadow: `0 0 20px ${form.primaryColor ?? '#7c3aed'}30`,
                          }}
                        />
                        <input
                          type="text"
                          value={form.primaryColor ?? '#7c3aed'}
                          onChange={(e) => setField('primaryColor', e.target.value)}
                          className="w-28 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-purple-500/60"
                        />
                      </div>
                    </div>

                    {/* Logo Generator */}
                    <div className="rounded-xl border border-white/10 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setShowLogoGenerator((v) => !v)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-l from-blue-600/20 to-purple-600/20 hover:from-blue-600/30 hover:to-purple-600/30 transition-all"
                      >
                        <div className="flex items-center gap-2">
                          <Wand2 className="w-4 h-4 text-blue-400" />
                          <span className="text-sm font-bold text-white">مولّد الشعارات</span>
                          <span className="text-xs text-blue-300/70">أنشئ شعاراً احترافياً في ثوانٍ</span>
                        </div>
                        {showLogoGenerator ? (
                          <ChevronUp className="w-4 h-4 text-white/40" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-white/40" />
                        )}
                      </button>
                      <AnimatePresence>
                        {showLogoGenerator && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <div className="p-4 border-t border-white/10">
                              <LogoGenerator
                                initialLetter={form.nameAr?.charAt(0) ?? ''}
                                onSave={(dataUrl) => {
                                  setField('logoUrl', dataUrl);
                                  setShowLogoGenerator(false);
                                }}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Logo */}
                    <div>
                      <label className="block text-sm font-semibold text-white/70 mb-2 flex items-center gap-1.5">
                        <Image className="w-4 h-4" />
                        رابط الشعار
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="url"
                          value={form.logoUrl ?? ''}
                          onChange={(e) => setField('logoUrl', e.target.value)}
                          placeholder="https://example.com/logo.png"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                        />
                        {isLogoValid && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="w-14 h-14 rounded-xl overflow-hidden border border-white/20 flex-shrink-0"
                          >
                            <img
                              src={form.logoUrl}
                              alt="معاينة الشعار"
                              className="w-full h-full object-cover"
                              onError={() => setField('logoUrl', '')}
                            />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Cover Image */}
                    <div>
                      <label className="block text-sm font-semibold text-white/70 mb-2 flex items-center gap-1.5">
                        <Eye className="w-4 h-4" />
                        رابط صورة الغلاف
                      </label>
                      <input
                        type="url"
                        value={form.coverImageUrl ?? ''}
                        onChange={(e) => setField('coverImageUrl', e.target.value)}
                        placeholder="https://example.com/cover.jpg"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                      />
                      {isCoverValid && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.96 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-3 rounded-xl overflow-hidden border border-white/10 h-32"
                        >
                          <img
                            src={form.coverImageUrl}
                            alt="معاينة الغلاف"
                            className="w-full h-full object-cover"
                            onError={() => setField('coverImageUrl', '')}
                          />
                        </motion.div>
                      )}
                    </div>

                    {/* App Icon */}
                    <div className="space-y-2">
                      <label className="block text-sm font-semibold text-white/70">أيقونة التطبيق (عند حفظ على الجوال)</label>
                      <p className="text-xs text-white/30">لما العميل يضغط "إضافة إلى الشاشة الرئيسية" يشوف هذه الأيقونة</p>
                      <input
                        type="url"
                        value={form.appIconUrl ?? ''}
                        onChange={(e) => setField('appIconUrl', e.target.value)}
                        placeholder="رابط الأيقونة (512×512 بكسل)"
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/25 text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                      />
                    </div>

                    {/* Service Areas */}
                    <div>
                      <label className="block text-sm font-semibold text-white/70 mb-3">
                        مناطق الخدمة
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {SAUDI_AREAS.map((area) => {
                          const selected = (form.serviceAreas ?? []).includes(area);
                          return (
                            <motion.button
                              key={area}
                              type="button"
                              whileTap={{ scale: 0.94 }}
                              onClick={() => toggleArea(area)}
                              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                selected
                                  ? 'bg-purple-500/30 border-purple-500/50 text-purple-200'
                                  : 'bg-white/5 border-white/10 text-white/50 hover:border-white/25 hover:text-white/70'
                              }`}
                            >
                              {area}
                            </motion.button>
                          );
                        })}
                      </div>
                      {(form.serviceAreas?.length ?? 0) > 0 && (
                        <p className="text-purple-400/70 text-xs mt-2">
                          {form.serviceAreas?.length} منطقة مختارة
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* ─── Tab 4: Custom Domain ─── */}
                {activeTab === 'domain' && (
                  <>
                    {/* Status badge */}
                    <div className="flex items-center gap-3">
                      {form.customDomain ? (
                        <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-sm font-semibold">
                          <CheckCircle className="w-4 h-4" />
                          مربوط: {form.customDomain}
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 text-sm font-semibold">
                          <XCircle className="w-4 h-4" />
                          لا يوجد دومين مخصص
                        </span>
                      )}
                    </div>

                    {/* Domain input */}
                    <div className="rounded-xl border border-white/10 bg-white/3 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-purple-500/20">
                          <Link className="w-4 h-4 text-purple-400" />
                        </div>
                        <h4 className="font-bold text-white text-sm">ربط دومين خاص بمغسلتك</h4>
                      </div>
                      <InputField
                        label="الدومين الخاص"
                        value={form.customDomain ?? ''}
                        onChange={(v) => setField('customDomain', v)}
                        placeholder="crystalwash.sa"
                        icon={Globe}
                        help="أدخل الدومين بدون https:// مثال: crystalwash.sa أو wash.mycompany.com"
                      />
                    </div>

                    {/* DNS instructions info box */}
                    <div className="rounded-xl border border-blue-500/30 bg-blue-500/8 p-5 space-y-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Info className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        <h4 className="font-bold text-blue-300 text-sm">كيفية ربط الدومين الخاص</h4>
                      </div>
                      <ol className="space-y-2 text-blue-200/80 text-sm leading-relaxed list-none">
                        <li className="flex gap-2">
                          <span className="font-bold text-blue-400 w-5 flex-shrink-0">1.</span>
                          <span>اشترِ دومين من أي مزود (GoDaddy, Namecheap, STC...)</span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-bold text-blue-400 w-5 flex-shrink-0">2.</span>
                          <span>
                            أضف DNS Record من نوع{' '}
                            <code className="bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">A</code>{' '}
                            يشير إلى:{' '}
                            <code className="bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">
                              {process.env.PLATFORM_IP ?? '[IP المنصة]'}
                            </code>
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-bold text-blue-400 w-5 flex-shrink-0">3.</span>
                          <span>
                            أو{' '}
                            <code className="bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">CNAME</code>{' '}
                            يشير إلى:{' '}
                            <code className="bg-blue-500/20 px-1.5 py-0.5 rounded text-blue-300 font-mono text-xs">app.rathath.sa</code>
                          </span>
                        </li>
                        <li className="flex gap-2">
                          <span className="font-bold text-blue-400 w-5 flex-shrink-0">4.</span>
                          <span>أدخل الدومين هنا واضغط حفظ، ثم انتظر حتى 24 ساعة للتفعيل</span>
                        </li>
                      </ol>
                    </div>
                  </>
                )}

                {/* ─── Tab 3: Financial Services ─── */}
                {activeTab === 'financial' && (
                  <>
                    {/* WhatsApp BYOC */}
                    <div className="rounded-xl border border-white/10 bg-white/3 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-emerald-500/20">
                          <MessageCircle className="w-4 h-4 text-emerald-400" />
                        </div>
                        <h4 className="font-bold text-white text-sm">واتساب Business</h4>
                      </div>
                      <p className="text-white/40 text-xs leading-relaxed">
                        اربط واتساب Business الخاص بمغسلتك لإرسال الرسائل باسمك
                      </p>
                      <InputField
                        label="معرف رقم الهاتف (Phone ID)"
                        value={form.whatsappPhoneId ?? ''}
                        onChange={(v) => setField('whatsappPhoneId', v)}
                        placeholder="123456789012345"
                        icon={Phone}
                      />
                      <InputField
                        label="رمز الوصول (Access Token)"
                        value={form.whatsappToken ?? ''}
                        onChange={(v) => setField('whatsappToken', v)}
                        placeholder="EAAxxxxxxxxxxxxxxxx"
                        type="password"
                        icon={Lock}
                      />
                    </div>

                    {/* Payment Gateway */}
                    <div className="rounded-xl border border-white/10 bg-white/3 p-5 space-y-4">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-blue-500/20">
                          <CreditCard className="w-4 h-4 text-blue-400" />
                        </div>
                        <h4 className="font-bold text-white text-sm">بوابة الدفع</h4>
                      </div>

                      {/* Provider Select */}
                      <div>
                        <label className="block text-sm font-semibold text-white/70 mb-1.5">
                          مزود الدفع
                        </label>
                        <div className="relative">
                          <select
                            value={form.paymentProvider ?? ''}
                            onChange={(e) => setField('paymentProvider', e.target.value)}
                            className="w-full appearance-none bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all"
                            style={{ direction: 'rtl' }}
                          >
                            <option value="" disabled className="bg-[#1a1a2e]">
                              اختر مزود الدفع
                            </option>
                            {PAYMENT_PROVIDERS.map((p) => (
                              <option key={p.value} value={p.value} className="bg-[#1a1a2e]">
                                {p.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
                        </div>
                      </div>

                      <InputField
                        label="معرف التاجر (Merchant ID)"
                        value={form.merchantId ?? ''}
                        onChange={(v) => setField('merchantId', v)}
                        placeholder="merchant_xxxxx"
                        icon={Building2}
                      />
                      <InputField
                        label="مفتاح API"
                        value={form.apiKey ?? ''}
                        onChange={(v) => setField('apiKey', v)}
                        placeholder="sk_live_xxxxxxxxxx"
                        type="password"
                        icon={Lock}
                      />
                      <InputField
                        label="المفتاح السري"
                        value={form.secretKey ?? ''}
                        onChange={(v) => setField('secretKey', v)}
                        placeholder="whsec_xxxxxxxxxx"
                        type="password"
                        icon={Lock}
                      />
                      <ToggleSwitch
                        checked={form.sandboxMode ?? false}
                        onChange={(v) => setField('sandboxMode', v)}
                        label="وضع الاختبار (Sandbox)"
                      />
                    </div>
                  </>
                )}
              </>
            )}

            {/* Save Button */}
            <div className="pt-2">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                type="button"
                onClick={handleSave}
                disabled={saveMutation.isPending || isLoading}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-bold text-sm shadow-lg shadow-purple-500/30 hover:from-purple-500 hover:to-indigo-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saveMutation.isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    جاري الحفظ...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    حفظ التغييرات
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold flex items-center gap-2 ${
              toast.type === 'success'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600'
                : 'bg-gradient-to-r from-red-600 to-rose-600'
            }`}
          >
            {toast.type === 'success' ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
