/**
 * /vendor/payment-gateway — the vendor activates any combination of
 * payment providers they like. Moyasar AND Tabby AND Tamara AND STC Pay
 * can all be live simultaneously; the customer picks one at checkout.
 */

import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  CreditCard, CheckCircle2, AlertCircle, Copy, ShieldCheck,
  Power, TestTube2, Save, Plus, Trash2, Star, Wallet,
  Layers,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Input, Badge, PageHeader, Skeleton, EmptyState,
} from '../../components/ui';
import { fadeInUp, scaleIn, staggerContainer, springs } from '../../design/motion';

type Kind = 'card' | 'bnpl' | 'wallet' | 'manual';

interface FieldSpec {
  key: string;
  labelAr: string;
  type: 'text' | 'password';
  helpAr?: string;
  optional?: boolean;
}

type BuyerMethod =
  | 'mada' | 'credit_card' | 'apple_pay' | 'google_pay'
  | 'stc_pay' | 'knet' | 'bnpl_4x' | 'bnpl_later'
  | 'bank_transfer' | 'cash';

const METHOD_LABEL: Record<BuyerMethod, string> = {
  mada: 'مدى', credit_card: 'بطاقات ائتمان', apple_pay: 'Apple Pay',
  google_pay: 'Google Pay', stc_pay: 'STC Pay', knet: 'KNET',
  bnpl_4x: 'تقسيط 4×', bnpl_later: 'ادفع لاحقاً',
  bank_transfer: 'تحويل بنكي', cash: 'نقد',
};

interface ProviderCatalogEntry {
  slug: string;
  labelAr: string;
  descriptionAr: string;
  supportsWebhook: boolean;
  requiredFields: FieldSpec[];
  kind: Kind;
  supportedMethods: BuyerMethod[];
}

interface ConfiguredProvider {
  slug: string;
  kind: Kind;
  enabled: boolean;
  lastVerifiedAt: string | null;
  publicKey: string;
  merchantId: string;
  sandboxMode: boolean;
  secretKeySet: boolean;
  webhookSecretSet: boolean;
  extra: Record<string, string>;
  webhookUrl: string | null;
}

interface ConfigResponse {
  defaultProvider: string | null;
  providers: ConfiguredProvider[];
}

const KIND_META: Record<Kind, { label: string; icon: any; tint: string }> = {
  card:   { label: 'بطاقات',      icon: CreditCard, tint: 'text-primary-300' },
  bnpl:   { label: 'دفع بالتقسيط', icon: Layers,     tint: 'text-warn-300' },
  wallet: { label: 'محفظة',        icon: Wallet,     tint: 'text-sky-300' },
  manual: { label: 'يدوي',         icon: CheckCircle2, tint: 'text-ink-300' },
};

export default function PaymentGateway() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | null>(null);

  const { data: providersData } = useQuery<{ providers: ProviderCatalogEntry[] }>({
    queryKey: ['payment-providers'],
    queryFn: async () => (await api.get('/payment-gateway/providers')).data,
  });
  const { data: configData, isLoading } = useQuery<ConfigResponse>({
    queryKey: ['payment-config'],
    queryFn: async () => (await api.get('/payment-gateway/config')).data,
  });

  const catalog = providersData?.providers ?? [];
  const configured = configData?.providers ?? [];
  const configuredSlugs = new Set(configured.map((p) => p.slug));
  const available = catalog.filter((p) => !configuredSlugs.has(p.slug));

  const catalogMap = useMemo(
    () => Object.fromEntries(catalog.map((p) => [p.slug, p])),
    [catalog],
  );

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={<CreditCard size={20} />}
          title="بوابات الدفع"
          subtitle="فعّل أي عدد من المزوّدين معاً — ميسر + تمارا + تابي + STC Pay. العميل يختار وقت الدفع."
        />

        {/* Configured providers */}
        {isLoading ? (
          <div className="grid gap-3 mb-6">
            {[1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : configured.length === 0 ? (
          <EmptyState
            icon={<CreditCard size={24} />}
            title="ما في بوابة دفع مفعّلة بعد"
            body="اختر مزوّد من الأسفل — الصق مفاتيحه، وخلاص."
            className="mb-6"
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid gap-3 mb-6"
          >
            {configured.map((p) => (
              <motion.div key={p.slug} variants={fadeInUp}>
                <ProviderCard
                  catalog={catalogMap[p.slug]}
                  provider={p}
                  isDefault={configData?.defaultProvider === p.slug}
                  isEditing={editing === p.slug}
                  onEdit={() => setEditing(p.slug)}
                  onCloseEdit={() => setEditing(null)}
                />
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Add provider */}
        {available.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-3 mt-8">
              <div className="h-px flex-1 bg-white/[0.06]" />
              <span className="text-xs text-ink-500 font-bold">إضافة مزوّد آخر</span>
              <div className="h-px flex-1 bg-white/[0.06]" />
            </div>
            <motion.div
              className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {available.map((p) => {
                const kindMeta = KIND_META[p.kind];
                const KindIcon = kindMeta.icon;
                return (
                  <motion.button
                    key={p.slug}
                    variants={fadeInUp}
                    type="button"
                    onClick={() => setEditing(p.slug)}
                    className="text-right p-3 rounded-xl border-2 border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15] hover:bg-white/[0.04] transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`${kindMeta.tint}`}><KindIcon size={14} /></span>
                        <p className="font-bold text-white text-sm">{p.labelAr}</p>
                      </div>
                      <Plus size={14} className="text-primary-400 shrink-0" />
                    </div>
                    <p className="text-[11px] text-ink-400 leading-relaxed mb-2">{p.descriptionAr}</p>
                    {p.supportedMethods.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {p.supportedMethods.map((m) => (
                          <span
                            key={m}
                            className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-ink-300"
                          >
                            {METHOD_LABEL[m]}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </motion.div>
          </>
        )}

        {/* Modal editor */}
        <AnimatePresence>
          {editing && catalogMap[editing] && (
            <ProviderEditor
              catalog={catalogMap[editing]}
              current={configured.find((p) => p.slug === editing) ?? null}
              onClose={() => setEditing(null)}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ['payment-config'] });
                setEditing(null);
              }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function ProviderCard({
  catalog, provider, isDefault, onEdit,
}: {
  catalog?: ProviderCatalogEntry;
  provider: ConfiguredProvider;
  isDefault: boolean;
  isEditing: boolean;
  onEdit: () => void;
  onCloseEdit: () => void;
}) {
  const qc = useQueryClient();
  const meta = KIND_META[provider.kind];
  const Icon = meta.icon;

  const toggleEnabled = useMutation({
    mutationFn: (enabled: boolean) =>
      api.post(`/payment-gateway/config/${provider.slug}/enable`, { enabled }),
    onSuccess: (_d, enabled) => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      toast.success(enabled ? 'فعّلت ✓' : 'أوقفت');
    },
  });

  const setDefault = useMutation({
    mutationFn: () => api.post('/payment-gateway/config/default', { provider: provider.slug }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      toast.success('تم جعله الافتراضي');
    },
  });

  const test = useMutation({
    mutationFn: async () => (await api.post(`/payment-gateway/config/${provider.slug}/test`)).data as { ok: boolean; message: string },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      r.ok ? toast.success(r.message) : toast.error(r.message);
    },
  });

  const remove = useMutation({
    mutationFn: () => api.delete(`/payment-gateway/config/${provider.slug}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      toast.success('أزلت المزوّد');
    },
  });

  async function copyWebhook() {
    if (!provider.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(provider.webhookUrl);
      toast.success('تم نسخ الرابط');
    } catch { toast.error('تعذّر النسخ'); }
  }

  return (
    <Card variant={provider.enabled ? 'elevated' : 'default'} padding="md">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-start gap-2 min-w-0">
          <div className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border bg-white/[0.03] ${meta.tint} border-white/[0.06]`}>
            <Icon size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-white">{catalog?.labelAr ?? provider.slug}</h3>
              <Badge size="sm" tone="neutral">{meta.label}</Badge>
              {provider.enabled ? <Badge size="sm" tone="success" dot>فعّال</Badge> : <Badge size="sm" tone="neutral">موقوف</Badge>}
              {isDefault && <Badge size="sm" tone="primary" leftIcon={<Star size={9} />}>افتراضي</Badge>}
              {provider.sandboxMode && <Badge size="sm" tone="warn">اختبار</Badge>}
            </div>
            {provider.lastVerifiedAt && (
              <p className="text-[10px] text-success-300 mt-1 inline-flex items-center gap-1">
                <ShieldCheck size={10} />
                آخر اختبار ناجح: {new Date(provider.lastVerifiedAt).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost" size="icon"
            aria-label="اختبار"
            onClick={() => test.mutate()}
            loading={test.isPending}
          >
            <TestTube2 size={14} />
          </Button>
          <Button
            variant="ghost" size="icon"
            aria-label="تعديل"
            onClick={onEdit}
          >
            <Save size={14} />
          </Button>
          <Button
            variant="ghost" size="icon"
            aria-label="حذف"
            className="text-danger-300"
            onClick={() => { if (confirm('احذف هذا المزوّد؟')) remove.mutate(); }}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      </div>

      {/* Supported methods chip row */}
      {catalog?.supportedMethods && catalog.supportedMethods.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {catalog.supportedMethods.map((m) => (
            <span
              key={m}
              className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/[0.04] border border-white/[0.06] text-ink-300"
            >
              {METHOD_LABEL[m as BuyerMethod] ?? m}
            </span>
          ))}
        </div>
      )}

      {/* Webhook url */}
      {provider.webhookUrl && catalog?.supportsWebhook && (
        <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.06] rounded-xl p-2 mb-2">
          <code className="flex-1 text-[10px] text-primary-300 font-mono truncate" dir="ltr">
            {provider.webhookUrl}
          </code>
          <Button variant="secondary" size="sm" leftIcon={<Copy size={11} />} onClick={copyWebhook}>
            نسخ الويبهوك
          </Button>
        </div>
      )}

      {/* Action row */}
      <div className="flex items-center gap-2">
        <Button
          variant={provider.enabled ? 'secondary' : 'success'}
          size="sm"
          leftIcon={<Power size={12} />}
          loading={toggleEnabled.isPending}
          onClick={() => toggleEnabled.mutate(!provider.enabled)}
        >
          {provider.enabled ? 'إيقاف' : 'تفعيل'}
        </Button>
        {!isDefault && provider.enabled && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Star size={12} />}
            loading={setDefault.isPending}
            onClick={() => setDefault.mutate()}
          >
            اجعله الافتراضي
          </Button>
        )}
      </div>
    </Card>
  );
}

// ───────────────────────────────────────────────────────────────────────────

function ProviderEditor({
  catalog, current, onClose, onSaved,
}: {
  catalog: ProviderCatalogEntry;
  current: ConfiguredProvider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({
    publicKey:  current?.publicKey  ?? '',
    merchantId: current?.merchantId ?? '',
  });
  const [sandbox, setSandbox] = useState(current?.sandboxMode ?? true);

  const save = useMutation({
    mutationFn: async () => {
      const credentials: Record<string, unknown> = { sandboxMode: sandbox };
      for (const f of catalog.requiredFields) {
        const v = values[f.key];
        if (f.type === 'password') {
          if (v && v.trim()) credentials[f.key] = v.trim();
        } else {
          credentials[f.key] = v ?? '';
        }
      }
      await api.put(`/payment-gateway/config/${catalog.slug}`, {
        enabled: current?.enabled ?? false,
        credentials,
      });
    },
    onSuccess: () => { toast.success('تم الحفظ'); onSaved(); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={() => !save.isPending && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <motion.form
        variants={scaleIn}
        initial="hidden"
        animate="visible"
        exit="exit"
        transition={springs.gentle}
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md"
        dir="rtl"
      >
        <Card variant="elevated" padding="lg" className="space-y-3">
          <h3 className="text-lg font-black">{catalog.labelAr}</h3>
          <p className="text-xs text-ink-400 leading-relaxed mb-1">
            {catalog.descriptionAr}
          </p>

          <label className="flex items-center justify-between text-[11px] text-ink-300">
            وضع الاختبار (Sandbox)
            <input
              type="checkbox"
              checked={sandbox}
              onChange={(e) => setSandbox(e.target.checked)}
              className="accent-primary-500"
            />
          </label>

          {catalog.requiredFields.length === 0 ? (
            <p className="text-xs text-ink-500">لا يحتاج مفاتيح — تسجيل يدوي للدفعات.</p>
          ) : (
            catalog.requiredFields.map((f) => {
              const isPassword = f.type === 'password';
              const saved =
                (f.key === 'secretKey' && current?.secretKeySet) ||
                (f.key === 'webhookSecret' && current?.webhookSecretSet);
              return (
                <Input
                  key={f.key}
                  type={isPassword ? 'password' : 'text'}
                  dir="ltr"
                  label={
                    <span className="flex items-center gap-2">
                      {f.labelAr}
                      {f.optional && <span className="text-ink-600 font-normal">(اختياري)</span>}
                      {saved && <Badge tone="success" size="sm">●●●● محفوظ</Badge>}
                    </span>
                  }
                  help={f.helpAr}
                  placeholder={saved ? 'اتركه فاضي للإبقاء على القيمة السابقة' : ''}
                  value={values[f.key] ?? ''}
                  onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
                />
              );
            })
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button type="submit" loading={save.isPending} fullWidth leftIcon={<Save size={14} />}>
              حفظ
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
          </div>
        </Card>
      </motion.form>
    </motion.div>
  );
}

// Kind lucide icon usage helper suppressed
void AlertCircle;
