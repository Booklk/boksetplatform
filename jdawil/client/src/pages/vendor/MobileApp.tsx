/**
 * Vendor "Mobile App Builder" — sales page + order wizard + status tracking.
 *
 * Route: /vendor/mobile-app
 *
 * Three plans (Android / iOS / Both) shown as cards with prices + features.
 * Picking one opens a wizard that collects branding (name, icon, color,
 * description, keywords, privacy URL), then sends a payment intent.
 *
 * If the vendor already has an order in progress, the page shows the order
 * status + timeline + delivered files instead of the sales pitch.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Smartphone, Apple, CheckCircle2, Sparkles, Package,
  Loader2, Download, Clock, FileText, ExternalLink, X, Upload,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

type PlanId = 'android' | 'ios' | 'both' | 'support_hour';

interface Plan {
  id: PlanId;
  nameAr: string;
  priceSar: number;
  durationDays: number;
  supportHoursIncluded: number;
  features: string[];
  category: 'one_time' | 'support';
}

interface Order {
  id: number;
  planId: PlanId;
  pricePaidSar: string;
  status: 'pending_payment' | 'paid' | 'in_production' | 'ready' | 'delivered' | 'cancelled' | 'refunded';
  appName?: string;
  iconUrl?: string;
  primaryColor?: string;
  description?: string;
  bundleId?: string;
  androidApkUrl?: string;
  iosProjectUrl?: string;
  githubRepoUrl?: string;
  manualUrl?: string;
  deliveredAt?: string;
  paidAt?: string;
  createdAt: string;
  plan?: Plan;
}

const STATUS_META: Record<Order['status'], { label: string; color: string }> = {
  pending_payment: { label: 'في انتظار الدفع', color: 'amber' },
  paid:            { label: 'تم الدفع — قيد المراجعة', color: 'sky' },
  in_production:   { label: 'قيد البناء',          color: 'sky' },
  ready:           { label: 'جاهز',                 color: 'emerald' },
  delivered:       { label: 'تم التسليم',           color: 'emerald' },
  cancelled:       { label: 'ملغي',                 color: 'slate' },
  refunded:        { label: 'مسترد',                color: 'slate' },
};

const PLAN_ICONS: Record<PlanId, React.ElementType> = {
  android: Smartphone,
  ios: Apple,
  both: Sparkles,
  support_hour: Clock,
};

export default function MobileApp() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const { data: plans = [] } = useQuery<Plan[]>({
    queryKey: ['mobile-app-plans'],
    queryFn: () => api.get('/mobile-app/plans').then((r) => r.data),
  });

  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ['my-mobile-app-orders'],
    queryFn: () => api.get('/mobile-app/orders/me').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-400" />
      </div>
    );
  }

  const activeOrder = orders.find((o) => !['cancelled', 'refunded', 'delivered'].includes(o.status));
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');

  return (
    <div className="min-h-screen bg-slate-950 p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-black flex items-center gap-2.5">
            <Smartphone size={22} className="text-orange-400" />
            حوّل متجرك إلى تطبيق
          </h1>
          <p className="text-slate-400 text-sm mt-2 leading-relaxed">
            احصل على تطبيق iOS / Android باسم متجرك وأيقونتك الخاصة — جاهز للنشر على المتاجر.
            <span className="text-orange-400 font-bold mr-1">المنصة الأولى عربياً</span> بأسعار رمزية.
          </p>
        </div>

        {/* Existing active order banner */}
        {activeOrder && <ActiveOrderCard order={activeOrder} />}

        {/* Delivered orders */}
        {deliveredOrders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-black text-white mb-3">تطبيقاتك الجاهزة</h2>
            <div className="space-y-2">
              {deliveredOrders.map((o) => <DeliveredOrderCard key={o.id} order={o} />)}
            </div>
          </div>
        )}

        {/* Plans (only if no active order) */}
        {!activeOrder && (
          <>
            <div className="mb-8">
              <h2 className="text-sm font-black text-white mb-1">اختر الخطة المناسبة</h2>
              <p className="text-xs text-slate-400">دفعة واحدة. تحصل على source code كامل + دليل النشر.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
              {plans.map((p) => (
                <PlanCard
                  key={p.id}
                  plan={p}
                  highlighted={p.id === 'both'}
                  onSelect={() => setSelectedPlan(p)}
                />
              ))}
            </div>

            {/* Trust signals */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <TrustCard title="ضمان توافق" body="نضمن بناء سليم متوافق مع iOS 15+ و Android 8+. لو لم يعمل، نُصلح مجاناً." />
              <TrustCard title="حماية + جودة" body="كود نظيف، بدون ثغرات معروفة، يمر فحص جودة قبل التسليم." />
              <TrustCard title="ساعة دعم إضافية" body="بعد نفاد الساعات المضمنة، أي ساعة إضافية بـ 300 ر.س فقط." />
            </div>

            {/* What you handle vs what we handle */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <ResponsibilityCard
                title="مسؤوليتنا"
                color="emerald"
                items={[
                  'بناء الـ source code كاملاً',
                  'تخصيص الأيقونات والألوان',
                  'توليد كل الأصول المطلوبة',
                  'دليل النشر خطوة بخطوة',
                  'ضمان جودة وأمان الكود',
                ]}
              />
              <ResponsibilityCard
                title="مسؤوليتك"
                color="amber"
                items={[
                  'حساب Apple Developer ($99/سنة)',
                  'حساب Google Play ($25 لمرة واحدة)',
                  'رفع التطبيق على المتاجر',
                  'الموافقة من Apple / Google',
                  'إدارة التقييمات والردود',
                ]}
              />
            </div>
          </>
        )}
      </div>

      {/* Wizard modal */}
      {selectedPlan && (
        <OrderWizard
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
        />
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function PlanCard({
  plan, highlighted, onSelect,
}: { plan: Plan; highlighted: boolean; onSelect: () => void }) {
  const Icon = PLAN_ICONS[plan.id];
  return (
    <div className={`rounded-2xl border ${highlighted ? 'border-orange-500/40 bg-orange-500/5' : 'border-white/8 bg-white/[0.02]'} p-5 flex flex-col`}>
      {highlighted && (
        <div className="inline-flex items-center gap-1 text-[10px] font-black text-orange-300 bg-orange-500/15 px-2 py-1 rounded-full mb-3 self-start">
          <Sparkles size={10} /> الأكثر طلباً — وفّر 1,000 ر.س
        </div>
      )}
      <div className="w-11 h-11 rounded-xl bg-orange-500/15 flex items-center justify-center mb-3">
        <Icon size={20} className="text-orange-400" />
      </div>
      <h3 className="text-base font-black text-white">{plan.nameAr}</h3>
      <div className="flex items-baseline gap-1 mt-2 mb-3">
        <span className="text-3xl font-black text-white">{plan.priceSar.toLocaleString()}</span>
        <span className="text-xs text-slate-500">ر.س / مرة واحدة</span>
      </div>
      <p className="text-[11px] text-slate-400 mb-4">التسليم خلال {plan.durationDays} أيام عمل</p>

      <ul className="space-y-1.5 mb-5 flex-1">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
            <CheckCircle2 size={12} className="text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <button
        type="button"
        onClick={onSelect}
        className={`w-full py-3 rounded-xl font-black text-sm transition-colors ${
          highlighted ? 'bg-orange-500 hover:bg-orange-400 text-white' : 'bg-white/10 hover:bg-white/15 text-white'
        }`}
      >
        ابدأ الآن
      </button>
    </div>
  );
}

function TrustCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.02] p-4">
      <h4 className="text-sm font-black text-white mb-1.5">{title}</h4>
      <p className="text-xs text-slate-400 leading-relaxed">{body}</p>
    </div>
  );
}

function ResponsibilityCard({
  title, color, items,
}: { title: string; color: 'emerald' | 'amber'; items: string[] }) {
  const c = color === 'emerald'
    ? { bg: 'bg-emerald-500/5', border: 'border-emerald-500/20', text: 'text-emerald-300', icon: CheckCircle2 }
    : { bg: 'bg-amber-500/5',   border: 'border-amber-500/20',   text: 'text-amber-300',   icon: Clock };
  const Icon = c.icon;
  return (
    <div className={`rounded-2xl border ${c.border} ${c.bg} p-5`}>
      <h4 className={`text-sm font-black ${c.text} mb-3`}>{title}</h4>
      <ul className="space-y-2">
        {items.map((i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
            <Icon size={12} className={`${c.text} flex-shrink-0 mt-0.5`} />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ActiveOrderCard({ order }: { order: Order }) {
  const meta = STATUS_META[order.status];
  return (
    <div className="rounded-2xl border border-orange-500/30 bg-orange-500/5 p-5 mb-8">
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-xs font-bold text-orange-300 mb-1">طلب نشط</p>
          <h2 className="text-lg font-black text-white">{order.appName ?? order.plan?.nameAr}</h2>
        </div>
        <span className={`text-xs font-bold px-3 py-1 rounded-full bg-${meta.color}-500/15 text-${meta.color}-300`}>
          {meta.label}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-slate-500">الباقة</p>
          <p className="text-white font-bold">{order.plan?.nameAr}</p>
        </div>
        <div>
          <p className="text-slate-500">القيمة</p>
          <p className="text-white font-bold">{parseFloat(order.pricePaidSar).toLocaleString()} ر.س</p>
        </div>
      </div>
      {order.status === 'pending_payment' && (
        <button className="mt-4 w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black">
          أكمل الدفع
        </button>
      )}

      {/* Build trigger — appears once payment lands. The button is the
          single source of truth for kicking off the Capacitor project
          generation + remote APK build. */}
      {(order.status === 'paid' || order.status === 'in_production') && <BuildButton order={order} />}

      {/* Source-ZIP download — available the moment the project ZIP
          lands in storage, even before the APK build finishes. Lets the
          vendor / our team open the project in Android Studio if they
          want to inspect anything. */}
      {(order.status === 'in_production' || order.status === 'ready' || order.status === 'delivered') && (
        <DownloadSourceButton order={order} />
      )}
    </div>
  );
}

function BuildButton({ order }: { order: Order }) {
  const qc = useQueryClient();
  const buildMut = useMutation({
    mutationFn: () => api.post(`/mobile-app/orders/${order.id}/build`),
    onSuccess: (r) => {
      toast.success(r.data?.message ?? 'تم البدء — راح يجهز خلال دقائق');
      qc.invalidateQueries({ queryKey: ['mobile-app-orders'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل بدء البناء'),
  });
  const inFlight = buildMut.isPending || order.status === 'in_production';
  return (
    <button
      onClick={() => buildMut.mutate()}
      disabled={inFlight}
      className="mt-4 w-full py-3 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-60 text-white text-sm font-black flex items-center justify-center gap-2"
    >
      {inFlight ? (
        <><Loader2 size={14} className="animate-spin" /> جاري بناء التطبيق…</>
      ) : (
        <><Sparkles size={14} /> ابدأ بناء التطبيق</>
      )}
    </button>
  );
}

function DownloadSourceButton({ order }: { order: Order }) {
  const [loading, setLoading] = useState(false);
  async function handleClick() {
    setLoading(true);
    try {
      const r = await api.get(`/mobile-app/orders/${order.id}/download`);
      window.open(r.data.url, '_blank');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'تعذّر تحميل المصدر');
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="mt-2 w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200 text-xs font-bold flex items-center justify-center gap-2"
    >
      <Download size={12} /> {loading ? 'جاري التحميل…' : 'حمّل ملف المشروع (Android Studio + Xcode)'}
    </button>
  );
}

function DeliveredOrderCard({ order }: { order: Order }) {
  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          {order.iconUrl && <img src={order.iconUrl} alt="" className="w-10 h-10 rounded-xl" />}
          <div>
            <p className="text-sm font-black text-white">{order.appName}</p>
            <p className="text-[10px] text-slate-500">{order.bundleId}</p>
          </div>
        </div>
        <span className="text-[10px] text-emerald-300">تم التسليم</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {order.androidApkUrl && (
          <a href={order.androidApkUrl} target="_blank" rel="noreferrer"
             className="text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-1.5">
            <Download size={11} /> Android APK
          </a>
        )}
        {order.iosProjectUrl && (
          <a href={order.iosProjectUrl} target="_blank" rel="noreferrer"
             className="text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-1.5">
            <Download size={11} /> iOS Project
          </a>
        )}
        {order.githubRepoUrl && (
          <a href={order.githubRepoUrl} target="_blank" rel="noreferrer"
             className="text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-1.5">
            <ExternalLink size={11} /> GitHub Repo
          </a>
        )}
        {order.manualUrl && (
          <a href={order.manualUrl} target="_blank" rel="noreferrer"
             className="text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg text-slate-300 flex items-center gap-1.5">
            <FileText size={11} /> دليل النشر
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Wizard ────────────────────────────────────────────────────────────────

function OrderWizard({ plan, onClose }: { plan: Plan; onClose: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    appName: '',
    iconUrl: '',
    primaryColor: '#FF8C00',
    description: '',
    keywords: '',
    privacyPolicyUrl: '',
  });

  const create = useMutation({
    mutationFn: () => api.post('/mobile-app/orders', { planId: plan.id, ...form }),
    onSuccess: () => {
      toast.success('تم إنشاء الطلب — تابع الدفع');
      qc.invalidateQueries({ queryKey: ['my-mobile-app-orders'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل إنشاء الطلب'),
  });

  const canSubmit = form.appName.length >= 2 && form.iconUrl.length > 5;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="bg-slate-900 border-t sm:border border-white/10 rounded-t-2xl sm:rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/8 sticky top-0 bg-slate-900">
          <div>
            <h3 className="text-base font-black text-white">{plan.nameAr}</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">{plan.priceSar.toLocaleString()} ر.س — خطوة {step} من 2</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-2"><X size={18} /></button>
        </div>

        <div className="p-5">
          {step === 1 && (
            <div className="space-y-4">
              <Field label="اسم التطبيق" required>
                <input
                  value={form.appName}
                  onChange={(e) => setForm({ ...form, appName: e.target.value })}
                  placeholder="مثلاً: مغسلة النجوم"
                  maxLength={30}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-orange-500/40"
                />
                <p className="text-[10px] text-slate-500 mt-1">حد أقصى 30 حرف — يظهر تحت أيقونة التطبيق</p>
              </Field>

              <Field label="رابط شعار التطبيق (1024×1024 PNG)" required>
                <input
                  value={form.iconUrl}
                  onChange={(e) => setForm({ ...form, iconUrl: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none focus:border-orange-500/40"
                />
                <p className="text-[10px] text-slate-500 mt-1">يجب أن يكون مربع 1024×1024 بكسل بدون شفافية. ارفعه على Imgur أو Google Drive ثم الصق الرابط.</p>
              </Field>

              <Field label="اللون الرئيسي">
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="w-12 h-10 rounded-lg bg-transparent border border-white/10 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="flex-1 bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm font-mono outline-none"
                  />
                </div>
              </Field>

              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={!form.appName || !form.iconUrl}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black disabled:opacity-50"
              >
                التالي
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <Field label="وصف التطبيق (للمتاجر)">
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={4}
                  maxLength={2000}
                  placeholder="وصف من 2-3 فقرات يظهر في صفحة التطبيق على Google Play / App Store..."
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none resize-none focus:border-orange-500/40"
                />
              </Field>

              <Field label="كلمات مفتاحية (مفصولة بفواصل)">
                <input
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                  placeholder="مغسلة، حجوزات، خدمة"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-orange-500/40"
                />
              </Field>

              <Field label="رابط سياسة الخصوصية">
                <input
                  value={form.privacyPolicyUrl}
                  onChange={(e) => setForm({ ...form, privacyPolicyUrl: e.target.value })}
                  placeholder="https://yourdomain.com/privacy"
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-orange-500/40"
                />
                <p className="text-[10px] text-slate-500 mt-1">مطلوبة من Apple و Google. اتركها فارغة وسنولّد لك واحدة افتراضية.</p>
              </Field>

              {/* Summary */}
              <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4 mt-2">
                <p className="text-xs font-bold text-orange-300 mb-2">ملخص الطلب</p>
                <ul className="text-xs text-orange-200/80 space-y-1">
                  <li>• الباقة: {plan.nameAr}</li>
                  <li>• المبلغ: {plan.priceSar.toLocaleString()} ر.س (مرة واحدة)</li>
                  <li>• التسليم خلال: {plan.durationDays} أيام عمل</li>
                  <li>• ساعات دعم مجانية: {plan.supportHoursIncluded}</li>
                </ul>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-sm font-bold"
                >
                  رجوع
                </button>
                <button
                  type="button"
                  onClick={() => create.mutate()}
                  disabled={!canSubmit || create.isPending}
                  className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-400 text-white text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {create.isPending ? <Loader2 size={14} className="animate-spin" /> : <Package size={14} />}
                  تأكيد + الدفع
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label, required, children,
}: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold text-slate-300 block mb-1.5">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}
