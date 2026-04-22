import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  CreditCard, CheckCircle2, AlertCircle, Copy, ShieldCheck,
  Power, TestTube2, Save,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Input, Badge, PageHeader, Skeleton,
} from '../../components/ui';
import { fadeInUp, staggerContainer } from '../../design/motion';

interface FieldSpec {
  key: string;
  labelAr: string;
  type: 'text' | 'password';
  helpAr?: string;
  optional?: boolean;
}

interface Provider {
  slug: string;
  labelAr: string;
  descriptionAr: string;
  supportsWebhook: boolean;
  requiredFields: FieldSpec[];
}

interface ConfigResponse {
  config: null | {
    provider: string | null;
    enabled: boolean;
    lastVerifiedAt: string | null;
    credentials: {
      publicKey: string;
      merchantId: string;
      sandboxMode: boolean;
      secretKeySet: boolean;
      webhookSecretSet: boolean;
      extra: Record<string, string>;
    };
  };
  webhookUrl: string | null;
}

export default function PaymentGateway() {
  const qc = useQueryClient();

  const { data: providersData } = useQuery<{ providers: Provider[] }>({
    queryKey: ['payment-providers'],
    queryFn: async () => (await api.get('/payment-gateway/providers')).data,
  });
  const { data: configData, isLoading } = useQuery<ConfigResponse>({
    queryKey: ['payment-config'],
    queryFn: async () => (await api.get('/payment-gateway/config')).data,
  });

  const providers = providersData?.providers ?? [];
  const stored = configData?.config ?? null;

  const [providerSlug, setProviderSlug] = useState<string>('');
  const [values, setValues] = useState<Record<string, string>>({});
  const [sandbox, setSandbox] = useState(true);

  useEffect(() => {
    if (!stored) return;
    if (stored.provider && !providerSlug) setProviderSlug(stored.provider);
    setValues((v) => ({
      ...v,
      publicKey:  stored.credentials.publicKey  || v.publicKey  || '',
      merchantId: stored.credentials.merchantId || v.merchantId || '',
    }));
    setSandbox(stored.credentials.sandboxMode ?? true);
  }, [stored]); // eslint-disable-line react-hooks/exhaustive-deps

  const provider = useMemo(
    () => providers.find((p) => p.slug === providerSlug) ?? null,
    [providers, providerSlug],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!provider) throw new Error('اختر مزوّد الدفع');
      const credentials: Record<string, unknown> = { sandboxMode: sandbox };
      for (const f of provider.requiredFields) {
        const v = values[f.key];
        if (f.type === 'password') {
          if (v && v.trim()) credentials[f.key] = v.trim();
        } else {
          credentials[f.key] = v ?? '';
        }
      }
      await api.put('/payment-gateway/config', { provider: provider.slug, credentials });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      setValues((v) => {
        const next = { ...v };
        for (const f of provider?.requiredFields ?? []) {
          if (f.type === 'password') delete next[f.key];
        }
        return next;
      });
      toast.success('تم الحفظ');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? e?.message ?? 'فشل الحفظ'),
  });

  const test = useMutation({
    mutationFn: async () => (await api.post('/payment-gateway/test')).data as { ok: boolean; message: string },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      r.ok ? toast.success(r.message) : toast.error(r.message);
    },
    onError: () => toast.error('فشل الاختبار'),
  });

  const toggleEnabled = useMutation({
    mutationFn: async (enabled: boolean) =>
      (await api.post('/payment-gateway/enable', { enabled })).data,
    onSuccess: (_data, enabled) => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      toast.success(enabled ? 'تم التفعيل ✓' : 'تم الإيقاف');
    },
  });

  async function copyWebhook() {
    if (!configData?.webhookUrl) return;
    try {
      await navigator.clipboard.writeText(configData.webhookUrl);
      toast.success('تم نسخ الرابط');
    } catch {
      toast.error('تعذّر النسخ');
    }
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <PageHeader
          icon={<CreditCard size={20} />}
          title="بوابة الدفع"
          subtitle="اختر مزوّد الدفع، الصق مفاتيح API، واستخدم رابط الويبهوك اللي نعطيك — من غير ما تحتاج مبرمج."
        />

        {/* Provider picker */}
        <Card variant="default" padding="md" className="mb-4">
          <label className="block text-xs font-bold text-ink-400 mb-3">المزوّد</label>
          <motion.div
            className="grid grid-cols-1 sm:grid-cols-2 gap-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {providers.map((p) => {
              const active = p.slug === providerSlug;
              return (
                <motion.button
                  key={p.slug}
                  variants={fadeInUp}
                  type="button"
                  onClick={() => setProviderSlug(p.slug)}
                  className={`text-right p-3 rounded-xl border-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                    active
                      ? 'border-primary-500/60 bg-primary-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                  }`}
                  aria-pressed={active}
                >
                  <p className="font-bold text-white text-sm">{p.labelAr}</p>
                  <p className="text-[11px] text-ink-400 mt-0.5 leading-relaxed">
                    {p.descriptionAr}
                  </p>
                </motion.button>
              );
            })}
          </motion.div>
        </Card>

        {/* Credentials */}
        {provider && (
          <Card variant="default" padding="md" className="mb-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black">المفاتيح والبيانات</h3>
              <label className="inline-flex items-center gap-2 text-[11px] text-ink-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandbox}
                  onChange={(e) => setSandbox(e.target.checked)}
                  className="accent-primary-500"
                />
                وضع الاختبار (Sandbox)
              </label>
            </div>

            {provider.requiredFields.length === 0 ? (
              <p className="text-xs text-ink-500">
                لا تحتاج أي مفاتيح — التسجيل اليدوي للدفعات من لوحة التحكم.
              </p>
            ) : (
              provider.requiredFields.map((f) => {
                const isPassword = f.type === 'password';
                const saved =
                  (f.key === 'secretKey' && stored?.credentials.secretKeySet) ||
                  (f.key === 'webhookSecret' && stored?.credentials.webhookSecretSet);
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
                    onChange={(e) =>
                      setValues((v) => ({ ...v, [f.key]: e.target.value }))
                    }
                  />
                );
              })
            )}

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => save.mutate()}
                loading={save.isPending}
                disabled={!providerSlug}
                leftIcon={<Save size={14} />}
                fullWidth
              >
                حفظ المفاتيح
              </Button>
              <Button
                variant="secondary"
                onClick={() => test.mutate()}
                loading={test.isPending}
                disabled={!stored?.provider}
                leftIcon={<TestTube2 size={14} />}
              >
                اختبار الاتصال
              </Button>
            </div>

            {stored?.lastVerifiedAt && (
              <div className="flex items-center gap-2 text-[11px] text-success-300 bg-success-500/10 border border-success-500/20 rounded-lg px-3 py-2">
                <ShieldCheck size={12} />
                آخر اختبار ناجح: {new Date(stored.lastVerifiedAt).toLocaleString('ar-SA')}
              </div>
            )}
          </Card>
        )}

        {/* Webhook URL */}
        {provider?.supportsWebhook && configData?.webhookUrl && (
          <Card variant="default" padding="md" className="mb-4">
            <h3 className="text-sm font-black mb-1">رابط الويبهوك</h3>
            <p className="text-xs text-ink-400 mb-3 leading-relaxed">
              الصق هذا الرابط في لوحة تحكم <strong>{provider.labelAr}</strong> تحت Webhooks.
            </p>
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5">
              <code className="flex-1 text-[11px] text-primary-300 font-mono truncate" dir="ltr">
                {configData.webhookUrl}
              </code>
              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Copy size={11} />}
                onClick={copyWebhook}
              >
                نسخ
              </Button>
            </div>
          </Card>
        )}

        {/* Enable / disable */}
        {stored?.provider && (
          <Card variant="default" padding="md" className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black mb-0.5 flex items-center gap-2">
                {stored.enabled ? (
                  <>
                    <CheckCircle2 size={15} className="text-success-400" />
                    البوابة مفعّلة
                  </>
                ) : (
                  <>
                    <AlertCircle size={15} className="text-warn-400" />
                    البوابة موقوفة
                  </>
                )}
              </h3>
              <p className="text-[11px] text-ink-400">
                {stored.enabled
                  ? 'العملاء يقدرون يدفعون مباشرة من صفحة الحجز.'
                  : 'المدفوعات الإلكترونية معطّلة — فعّلها لما تتأكد من الإعدادات.'}
              </p>
            </div>
            <Button
              variant={stored.enabled ? 'secondary' : 'success'}
              onClick={() => toggleEnabled.mutate(!stored.enabled)}
              loading={toggleEnabled.isPending}
              leftIcon={<Power size={14} />}
            >
              {stored.enabled ? 'إيقاف' : 'تفعيل'}
            </Button>
          </Card>
        )}

        {isLoading && !stored && <Skeleton className="h-24 rounded-2xl" />}
      </div>
    </div>
  );
}
