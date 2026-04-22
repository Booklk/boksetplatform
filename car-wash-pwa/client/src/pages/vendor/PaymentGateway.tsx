import { useEffect, useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  CreditCard, CheckCircle2, AlertCircle, Copy, ShieldCheck,
  Power, TestTube2, Save,
} from 'lucide-react';
import api from '../../lib/api';

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

  // Seed form state from saved config once it loads.
  useEffect(() => {
    if (!stored) return;
    if (stored.provider && !providerSlug) setProviderSlug(stored.provider);
    setValues((v) => ({
      ...v,
      publicKey:  stored.credentials.publicKey  || v.publicKey  || '',
      merchantId: stored.credentials.merchantId || v.merchantId || '',
    }));
    setSandbox(stored.credentials.sandboxMode ?? true);
  }, [stored]);  // eslint-disable-line react-hooks/exhaustive-deps

  const provider = useMemo(
    () => providers.find((p) => p.slug === providerSlug) ?? null,
    [providers, providerSlug],
  );

  const save = useMutation({
    mutationFn: async () => {
      if (!provider) throw new Error('اختر مزوّد الدفع');
      // Only send secret fields if the user actually typed something —
      // empty strings preserve the saved value server-side.
      const credentials: Record<string, unknown> = {
        sandboxMode: sandbox,
      };
      for (const f of provider.requiredFields) {
        const v = values[f.key];
        if (f.type === 'password') {
          if (v && v.trim()) credentials[f.key] = v.trim();
        } else {
          credentials[f.key] = v ?? '';
        }
      }
      await api.put('/payment-gateway/config', {
        provider: provider.slug,
        credentials,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payment-config'] });
      // Clear the just-entered secrets so "●●●●" reflects reality.
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
    <div className="min-h-screen bg-[#0b1220] text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
            <CreditCard size={22} className="text-indigo-400" />
            بوابة الدفع
          </h1>
          <p className="text-sm text-slate-400">
            اختر مزوّد الدفع اللي تستخدمه، الصق مفاتيح API، واستخدم رابط الويبهوك اللي نعطيك — من غير ما تحتاج مبرمج.
          </p>
        </div>

        {/* Provider picker */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-4">
          <label className="block text-xs font-bold text-slate-400 mb-2">
            المزوّد
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {providers.map((p) => {
              const active = p.slug === providerSlug;
              return (
                <button
                  key={p.slug}
                  type="button"
                  onClick={() => setProviderSlug(p.slug)}
                  className={`text-right p-3 rounded-xl border-2 transition-all ${
                    active
                      ? 'border-indigo-500/60 bg-indigo-500/10'
                      : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                  }`}
                >
                  <p className="font-bold text-white text-sm">{p.labelAr}</p>
                  <p className="text-[11px] text-slate-400 mt-0.5 leading-relaxed">
                    {p.descriptionAr}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Credentials */}
        {provider && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-sm font-black">المفاتيح والبيانات</h3>
              <label className="inline-flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={sandbox}
                  onChange={(e) => setSandbox(e.target.checked)}
                  className="accent-indigo-500"
                />
                وضع الاختبار (Sandbox)
              </label>
            </div>

            {provider.requiredFields.length === 0 ? (
              <p className="text-xs text-slate-500">
                لا تحتاج أي مفاتيح — التسجيل اليدوي للدفعات من لوحة التحكم.
              </p>
            ) : (
              provider.requiredFields.map((f) => {
                const isPassword = f.type === 'password';
                const saved =
                  (f.key === 'secretKey' && stored?.credentials.secretKeySet) ||
                  (f.key === 'webhookSecret' && stored?.credentials.webhookSecretSet);
                return (
                  <div key={f.key}>
                    <label className="block text-xs font-bold text-slate-400 mb-1">
                      {f.labelAr}
                      {f.optional && <span className="text-slate-600"> (اختياري)</span>}
                      {saved && (
                        <span className="text-emerald-400 mr-2 font-mono">●●●● محفوظ</span>
                      )}
                    </label>
                    <input
                      type={isPassword ? 'password' : 'text'}
                      value={values[f.key] ?? ''}
                      onChange={(e) =>
                        setValues((v) => ({ ...v, [f.key]: e.target.value }))
                      }
                      placeholder={saved ? 'اتركه فاضي للإبقاء على القيمة السابقة' : ''}
                      dir="ltr"
                      className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
                    />
                    {f.helpAr && (
                      <p className="text-[10px] text-slate-500 mt-1">{f.helpAr}</p>
                    )}
                  </div>
                );
              })
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending || !providerSlug}
                className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-colors disabled:opacity-50"
              >
                <Save size={14} />
                {save.isPending ? '...' : 'حفظ المفاتيح'}
              </button>
              <button
                onClick={() => test.mutate()}
                disabled={test.isPending || !stored?.provider}
                className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-bold transition-colors disabled:opacity-50"
              >
                <TestTube2 size={14} />
                اختبار الاتصال
              </button>
            </div>

            {stored?.lastVerifiedAt && (
              <div className="flex items-center gap-2 text-[11px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-2">
                <ShieldCheck size={12} />
                آخر اختبار ناجح:{' '}
                {new Date(stored.lastVerifiedAt).toLocaleString('ar-SA')}
              </div>
            )}
          </div>
        )}

        {/* Webhook URL + Enable */}
        {provider?.supportsWebhook && configData?.webhookUrl && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 mb-4">
            <h3 className="text-sm font-black mb-1">رابط الويبهوك</h3>
            <p className="text-xs text-slate-400 mb-3 leading-relaxed">
              الصق هذا الرابط في لوحة تحكم <strong>{provider.labelAr}</strong> تحت Webhooks. يخليك تستقبل تحديثات الدفع لحظياً بدون ما تحتاج تفتح متجرك كل مرة.
            </p>
            <div className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-xl p-2.5">
              <code
                className="flex-1 text-[11px] text-indigo-300 font-mono truncate"
                dir="ltr"
              >
                {configData.webhookUrl}
              </code>
              <button
                onClick={copyWebhook}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-[11px] font-bold text-indigo-300"
              >
                <Copy size={11} />
                نسخ
              </button>
            </div>
          </div>
        )}

        {/* Enable / disable */}
        {stored?.provider && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black mb-0.5 flex items-center gap-2">
                {stored.enabled ? (
                  <>
                    <CheckCircle2 size={15} className="text-emerald-400" />
                    البوابة مفعّلة
                  </>
                ) : (
                  <>
                    <AlertCircle size={15} className="text-amber-400" />
                    البوابة موقوفة
                  </>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                {stored.enabled
                  ? 'العملاء يقدرون يدفعون مباشرة من صفحة الحجز.'
                  : 'المدفوعات الإلكترونية معطّلة — فعّلها لما تتأكد من الإعدادات.'}
              </p>
            </div>
            <button
              onClick={() => toggleEnabled.mutate(!stored.enabled)}
              disabled={toggleEnabled.isPending}
              className={`inline-flex items-center gap-2 py-2 px-4 rounded-xl text-sm font-bold transition-colors ${
                stored.enabled
                  ? 'bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300'
                  : 'bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300'
              } disabled:opacity-50`}
            >
              <Power size={14} />
              {stored.enabled ? 'إيقاف' : 'تفعيل'}
            </button>
          </div>
        )}

        {isLoading && !stored && (
          <div className="h-24 bg-white/[0.03] border border-white/[0.06] rounded-2xl animate-pulse" />
        )}
      </div>
    </div>
  );
}
