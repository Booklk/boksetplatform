/**
 * WhatsApp Connect — vendor-facing wizard + settings.
 *
 * Route: /vendor/whatsapp
 *
 * Three connection paths:
 *   1. Meta Cloud API — vendor's own credentials (free, requires Meta Business
 *      Verification). Saves Phone Number ID + Access Token, encrypted.
 *   2. Unifonic — Saudi BSP. Saves App SID + API Key + Sender ID, encrypted.
 *      Vendor's account is provisioned under Jdawil's partner account first.
 *   3. Shared sender — fastest path. Messages go from Jdawil's number with
 *      the vendor's name in the body. Zero setup.
 *
 * Once connected, the page shows: status badge, per-event toggles, plan +
 * usage, test message button, disconnect.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageCircle, CheckCircle2, XCircle, AlertCircle, Loader2,
  Send, Trash2, Sparkles, Shield, Zap, Users, ChevronLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

type Provider = 'meta_cloud' | 'unifonic' | 'shared' | 'none';
type Status = 'not_connected' | 'pending' | 'active' | 'failed';

interface WhatsAppStatus {
  provider: Provider;
  status: Status;
  verifiedAt: string | null;
  lastError: string | null;
  hasMetaCreds: boolean;
  hasUnifonicCreds: boolean;
  unifonicSenderId: string | null;
  notifications: Record<string, boolean>;
  plan: 'none' | 'essentials' | 'pro' | 'business';
  messagesUsed: number;
  messagesQuota: number;
  quotaResetAt: string | null;
  vendorPhone: string;
  vendorName: string;
}

const NOTIFICATION_EVENTS: { key: string; labelAr: string; descAr: string; defaultOn: boolean }[] = [
  { key: 'bookingConfirmed', labelAr: 'تأكيد الحجز', descAr: 'يصل العميل فور تأكيد حجزه', defaultOn: true },
  { key: 'appointmentReminder', labelAr: 'تذكير بالموعد', descAr: 'قبل الموعد بـ 24 ساعة', defaultOn: true },
  { key: 'employeeOnWay', labelAr: 'الموظف في الطريق', descAr: 'عند انطلاق الموظف للعميل', defaultOn: true },
  { key: 'arrived', labelAr: 'وصل الموظف', descAr: 'عند الوصول للموقع', defaultOn: true },
  { key: 'completed', labelAr: 'اكتمال الخدمة', descAr: 'بعد إنهاء الخدمة', defaultOn: true },
  { key: 'ratingRequest', labelAr: 'طلب التقييم', descAr: 'لجمع تقييمات العملاء', defaultOn: true },
  { key: 'paymentReceived', labelAr: 'استلام الدفع', descAr: 'إيصال للعميل بعد الدفع', defaultOn: true },
  { key: 'marketing', labelAr: 'رسائل تسويقية', descAr: 'العروض والحملات (تتطلب موافقة العميل)', defaultOn: false },
];

const PLANS = [
  { id: 'essentials', name: 'الأساسية', priceSar: 99, quota: 500, color: 'sky', tag: '' },
  { id: 'pro', name: 'الاحترافية', priceSar: 199, quota: 2000, color: 'emerald', tag: 'الأكثر طلباً' },
  { id: 'business', name: 'الأعمال', priceSar: 399, quota: 5000, color: 'amber', tag: 'يشمل تسويق' },
] as const;

export default function WhatsAppPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<WhatsAppStatus>({
    queryKey: ['whatsapp', 'status'],
    queryFn: async () => (await api.get('/whatsapp/status')).data,
  });

  const [showWizard, setShowWizard] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-white/40">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }
  if (!data) return null;

  const isConnected = data.status === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0b0d17] via-[#0a0c14] to-[#080910] text-white pb-24" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-xl bg-emerald-500/15">
                <MessageCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <h1 className="text-2xl font-bold">واتساب الأعمال</h1>
            </div>
            <p className="text-white/50 text-sm">
              اربط متجرك بواتساب وأرسل الإشعارات لعملائك تلقائياً
            </p>
          </div>
          <StatusBadge status={data.status} />
        </div>

        {!isConnected && !showWizard && (
          <NotConnectedHero onStart={() => setShowWizard(true)} />
        )}

        {showWizard && !isConnected && (
          <ConnectWizard onClose={() => setShowWizard(false)} onConnected={() => {
            setShowWizard(false);
            qc.invalidateQueries({ queryKey: ['whatsapp', 'status'] });
          }} />
        )}

        {isConnected && (
          <ConnectedView data={data} qc={qc} />
        )}
      </div>
    </div>
  );
}

// ─── Status Badge ──────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Status }) {
  const map: Record<Status, { label: string; color: string; icon: typeof CheckCircle2 }> = {
    active:        { label: 'متصل', color: 'emerald', icon: CheckCircle2 },
    pending:       { label: 'قيد التحقق', color: 'amber', icon: Loader2 },
    failed:        { label: 'فشل الاتصال', color: 'rose', icon: XCircle },
    not_connected: { label: 'غير متصل', color: 'slate', icon: AlertCircle },
  };
  const { label, color, icon: Icon } = map[status];
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full bg-${color}-500/15 border border-${color}-500/30 text-${color}-300 text-xs font-bold`}>
      <Icon className={`w-3.5 h-3.5 ${status === 'pending' ? 'animate-spin' : ''}`} />
      {label}
    </div>
  );
}

// ─── Not connected hero ───────────────────────────────────────────────────

function NotConnectedHero({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-white/3 to-white/3 p-8 text-center"
    >
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/20 mb-4">
        <MessageCircle className="w-8 h-8 text-emerald-400" />
      </div>
      <h2 className="text-2xl font-bold mb-2">فعّل واتساب لمتجرك</h2>
      <p className="text-white/55 text-sm max-w-xl mx-auto mb-6 leading-relaxed">
        رسائل تأكيد الحجز، تذكير الموعد، إشعار الاكتمال، وطلب التقييم —
        كلها تذهب لعميلك على واتساب باسم متجرك.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl mx-auto mb-6">
        <Stat icon={Zap} valueAr="+25%" labelAr="معدل تأكيد الحجز" />
        <Stat icon={Users} valueAr="+40%" labelAr="عملاء يعودون" />
        <Stat icon={Shield} valueAr="100%" labelAr="رسمي ومتوافق" />
      </div>
      <button
        onClick={onStart}
        className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold transition-all"
      >
        <Sparkles className="w-4 h-4" />
        ابدأ التفعيل
      </button>
    </motion.div>
  );
}

function Stat({ icon: Icon, valueAr, labelAr }: { icon: typeof Zap; valueAr: string; labelAr: string }) {
  return (
    <div className="rounded-xl bg-white/3 border border-white/8 p-4">
      <Icon className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
      <div className="text-xl font-bold">{valueAr}</div>
      <div className="text-xs text-white/45 mt-0.5">{labelAr}</div>
    </div>
  );
}

// ─── Connect Wizard ───────────────────────────────────────────────────────

type WizardStep = 'choose' | 'meta' | 'unifonic' | 'shared';

function ConnectWizard({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [step, setStep] = useState<WizardStep>('choose');

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-white/3 p-6"
    >
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-bold">
          {step === 'choose' ? 'اختر طريقة الربط' :
           step === 'meta' ? 'ربط Meta Cloud API' :
           step === 'unifonic' ? 'ربط Unifonic' : 'الرقم المشترك'}
        </h3>
        <button onClick={step === 'choose' ? onClose : () => setStep('choose')} className="text-white/45 hover:text-white text-sm flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" />
          {step === 'choose' ? 'إغلاق' : 'رجوع'}
        </button>
      </div>

      <AnimatePresence mode="wait">
        {step === 'choose' && (
          <motion.div key="choose" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <ProviderCard
              title="Meta Cloud API"
              subtitle="الأرخص — مفاتيحك من Meta مباشرة"
              priceLabel="مجاني للإعداد"
              tag="موصى به للتقنيين"
              tagColor="sky"
              points={['تحكم كامل', 'بدون وسيط', 'يتطلب Meta Business Verification']}
              onSelect={() => setStep('meta')}
            />
            <ProviderCard
              title="Unifonic"
              subtitle="أسهل — شركة سعودية تدير كل شيء"
              priceLabel="حسب الباقة"
              tag="موصى به للتجار"
              tagColor="emerald"
              points={['دعم عربي محلي', 'بدون أوراق Meta', 'فاتورة بالريال + ضريبة']}
              onSelect={() => setStep('unifonic')}
            />
            <ProviderCard
              title="رقم Jdawil المشترك"
              subtitle="الأسرع — بدون أي إعداد"
              priceLabel="مدمج بالباقة"
              tag="ابدأ خلال دقيقة"
              tagColor="violet"
              points={['تفعيل فوري', 'الرسائل من رقم Jdawil باسم متجرك في النص', 'مناسب للبداية']}
              onSelect={() => setStep('shared')}
            />
          </motion.div>
        )}

        {step === 'meta' && <MetaForm onSuccess={onConnected} />}
        {step === 'unifonic' && <UnifonicForm onSuccess={onConnected} />}
        {step === 'shared' && <SharedConfirm onSuccess={onConnected} />}
      </AnimatePresence>
    </motion.div>
  );
}

function ProviderCard({
  title, subtitle, priceLabel, tag, tagColor, points, onSelect,
}: {
  title: string; subtitle: string; priceLabel: string; tag: string; tagColor: string;
  points: string[]; onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className="w-full text-right p-5 rounded-xl border border-white/10 bg-white/3 hover:bg-white/5 hover:border-white/20 transition-all"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-bold">{title}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${tagColor}-500/15 text-${tagColor}-300 border border-${tagColor}-500/30 font-bold`}>
              {tag}
            </span>
          </div>
          <p className="text-white/50 text-sm">{subtitle}</p>
        </div>
        <span className="text-emerald-400 text-xs font-bold whitespace-nowrap">{priceLabel}</span>
      </div>
      <ul className="space-y-1 mt-3">
        {points.map((p) => (
          <li key={p} className="text-white/55 text-xs flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-white/30" />
            {p}
          </li>
        ))}
      </ul>
    </button>
  );
}

// ─── Meta form ────────────────────────────────────────────────────────────

function MetaForm({ onSuccess }: { onSuccess: () => void }) {
  const [phoneId, setPhoneId] = useState('');
  const [token, setToken] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/whatsapp/connect/meta', { phoneId, token }),
    onSuccess: () => { toast.success('تم الربط بنجاح ✅'); onSuccess(); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الربط'),
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <p className="text-white/55 text-sm leading-relaxed">
        احصل على بياناتك من <span className="text-sky-400">developers.facebook.com</span> ←
        تطبيقك ← WhatsApp ← API Setup. ستحتاج Phone Number ID و Access Token.
      </p>
      <Input label="Phone Number ID" value={phoneId} onChange={setPhoneId} placeholder="123456789012345" />
      <Input label="Access Token" value={token} onChange={setToken} placeholder="EAAxxxxxxxxxxxxxxxx" type="password" />
      <button
        onClick={() => mut.mutate()}
        disabled={!phoneId || !token || mut.isPending}
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-bold transition-all flex items-center justify-center gap-2"
      >
        {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        ربط وتجربة
      </button>
    </motion.div>
  );
}

// ─── Unifonic form ────────────────────────────────────────────────────────

function UnifonicForm({ onSuccess }: { onSuccess: () => void }) {
  const [appSid, setAppSid] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [senderId, setSenderId] = useState('');
  const mut = useMutation({
    mutationFn: () => api.post('/whatsapp/connect/unifonic', { appSid, apiKey, senderId }),
    onSuccess: () => { toast.success('تم الربط بنجاح ✅'); onSuccess(); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الربط'),
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-200/80 leading-relaxed">
        تواصل مع Unifonic أولاً عبر <span className="text-amber-300 font-bold">unifonic.com</span> لفتح حسابك تحت شراكة Jdawil.
        ستستلم App SID و API Key و Sender ID — أدخلها هنا.
      </div>
      <Input label="App SID" value={appSid} onChange={setAppSid} placeholder="HSxxxxxxxxxx" />
      <Input label="API Key" value={apiKey} onChange={setApiKey} placeholder="xxxxxxxxxxxxxxxxxxxxxxx" type="password" />
      <Input label="Sender ID" value={senderId} onChange={setSenderId} placeholder="MyStore" />
      <button
        onClick={() => mut.mutate()}
        disabled={!appSid || !apiKey || !senderId || mut.isPending}
        className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-emerald-950 font-bold transition-all flex items-center justify-center gap-2"
      >
        {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        ربط وتجربة
      </button>
    </motion.div>
  );
}

// ─── Shared confirm ───────────────────────────────────────────────────────

function SharedConfirm({ onSuccess }: { onSuccess: () => void }) {
  const mut = useMutation({
    mutationFn: () => api.post('/whatsapp/connect/shared'),
    onSuccess: () => { toast.success('تم التفعيل ✅'); onSuccess(); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل التفعيل'),
  });
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      <div className="rounded-xl bg-violet-500/10 border border-violet-500/25 p-4 text-sm text-violet-200/85 leading-relaxed space-y-2">
        <p><strong className="text-violet-200">سيستخدم متجرك رقم Jdawil المشترك</strong> — اسم متجرك يظهر بداية كل رسالة لتمييزك.</p>
        <p className="text-violet-200/65 text-xs">يمكنك الترقية لاحقاً إلى Meta Cloud أو Unifonic بدون فقدان أي بيانات.</p>
      </div>
      <button
        onClick={() => mut.mutate()}
        disabled={mut.isPending}
        className="w-full py-3 rounded-xl bg-violet-500 hover:bg-violet-400 disabled:opacity-50 text-white font-bold transition-all flex items-center justify-center gap-2"
      >
        {mut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
        تفعيل الآن
      </button>
    </motion.div>
  );
}

// ─── Connected view ───────────────────────────────────────────────────────

function ConnectedView({ data, qc }: { data: WhatsAppStatus; qc: ReturnType<typeof useQueryClient> }) {
  const testMut = useMutation({
    mutationFn: () => api.post('/whatsapp/test'),
    onSuccess: (r: any) => toast.success(`📤 أُرسلت رسالة تجريبية إلى ${r?.data?.phone ?? 'رقمك'}`),
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الإرسال'),
  });
  const disconnectMut = useMutation({
    mutationFn: () => api.post('/whatsapp/disconnect'),
    onSuccess: () => {
      toast.success('تم الفصل');
      qc.invalidateQueries({ queryKey: ['whatsapp', 'status'] });
    },
  });
  const planMut = useMutation({
    mutationFn: (plan: string) => api.post('/whatsapp/plan', { plan }),
    onSuccess: () => {
      toast.success('تم تحديث الباقة');
      qc.invalidateQueries({ queryKey: ['whatsapp', 'status'] });
    },
  });
  const notifMut = useMutation({
    mutationFn: (next: Record<string, boolean>) => api.patch('/whatsapp/notifications', next),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['whatsapp', 'status'] }),
  });

  const toggle = (key: string, defaultOn: boolean) => {
    const current = data.notifications[key];
    const isOn = current === undefined ? defaultOn : current;
    notifMut.mutate({ ...data.notifications, [key]: !isOn });
  };

  const providerLabel = data.provider === 'meta_cloud' ? 'Meta Cloud API' :
    data.provider === 'unifonic' ? 'Unifonic' :
    data.provider === 'shared' ? 'رقم Jdawil المشترك' : '—';

  return (
    <div className="space-y-5">
      {/* Provider card */}
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-white/55 text-xs mb-1">المزوّد الحالي</div>
            <div className="font-bold text-emerald-200">{providerLabel}</div>
            {data.verifiedAt && (
              <div className="text-white/40 text-xs mt-1">
                تم التحقق: {new Date(data.verifiedAt).toLocaleDateString('ar-SA')}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => testMut.mutate()}
              disabled={testMut.isPending}
              className="px-4 py-2 rounded-lg bg-white/8 hover:bg-white/15 text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              رسالة تجريبية
            </button>
            <button
              onClick={() => {
                if (confirm('هل أنت متأكد من فصل واتساب؟ ستتوقف الرسائل التلقائية للعملاء.')) {
                  disconnectMut.mutate();
                }
              }}
              disabled={disconnectMut.isPending}
              className="px-4 py-2 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 text-sm font-bold transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Trash2 className="w-4 h-4" />
              فصل
            </button>
          </div>
        </div>
      </div>

      {/* Plan + usage */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold">الباقة والاستهلاك</h3>
          {data.plan !== 'none' && (
            <div className="text-xs text-white/55">
              {data.messagesUsed} / {data.messagesQuota} رسالة هذا الشهر
            </div>
          )}
        </div>

        {data.plan !== 'none' && data.messagesQuota > 0 && (
          <div className="mb-4">
            <div className="h-2 rounded-full bg-white/8 overflow-hidden">
              <div
                className="h-full bg-gradient-to-l from-emerald-400 to-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (data.messagesUsed / data.messagesQuota) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {PLANS.map((p) => {
            const isActive = data.plan === p.id;
            return (
              <button
                key={p.id}
                onClick={() => planMut.mutate(p.id)}
                disabled={planMut.isPending}
                className={`text-right p-4 rounded-xl border transition-all ${
                  isActive
                    ? `border-${p.color}-500/40 bg-${p.color}-500/10`
                    : 'border-white/10 bg-white/3 hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">{p.name}</span>
                  {p.tag && (
                    <span className={`text-[10px] px-2 py-0.5 rounded-full bg-${p.color}-500/15 text-${p.color}-300 font-bold`}>
                      {p.tag}
                    </span>
                  )}
                </div>
                <div className="text-2xl font-bold">{p.priceSar} <span className="text-xs text-white/45">ر.س/شهر</span></div>
                <div className="text-xs text-white/55 mt-1">{p.quota.toLocaleString('ar-SA')} رسالة شهرياً</div>
                {isActive && <div className="text-xs text-emerald-300 mt-2 font-bold">✓ الباقة الحالية</div>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Per-event toggles */}
      <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
        <h3 className="font-bold mb-1">إشعارات العملاء</h3>
        <p className="text-white/45 text-xs mb-4">اختر متى يُرسل واتساب لعميلك</p>
        <div className="space-y-2">
          {NOTIFICATION_EVENTS.map((evt) => {
            const current = data.notifications[evt.key];
            const isOn = current === undefined ? evt.defaultOn : current;
            return (
              <button
                key={evt.key}
                onClick={() => toggle(evt.key, evt.defaultOn)}
                className="w-full text-right flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-white/3 transition-all"
              >
                <div className="flex-1">
                  <div className="font-semibold text-sm">{evt.labelAr}</div>
                  <div className="text-xs text-white/45 mt-0.5">{evt.descAr}</div>
                </div>
                <div className={`relative w-11 h-6 rounded-full transition-all ${isOn ? 'bg-emerald-500' : 'bg-white/15'}`}>
                  <div
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${
                      isOn ? 'right-0.5' : 'right-[22px]'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {data.lastError && (
        <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 p-4 text-sm text-rose-200">
          <strong>آخر خطأ:</strong> {data.lastError}
        </div>
      )}
    </div>
  );
}

// ─── Reusable input ───────────────────────────────────────────────────────

function Input({
  label, value, onChange, placeholder, type = 'text',
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-bold text-white/65 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-all"
        dir="ltr"
        style={{ textAlign: 'left' }}
      />
    </div>
  );
}
