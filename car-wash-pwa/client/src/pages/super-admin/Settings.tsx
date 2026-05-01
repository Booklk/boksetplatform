/**
 * Super-admin platform settings — paste API credentials & platform config
 * directly from the UI. Encrypted values come back as •••••••• and editing
 * any of them sends the new value to the server.
 *
 * Route: /super-admin/settings
 */
import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon, Save, Eye, EyeOff, CheckCircle2, AlertCircle,
  Lock, Globe, CreditCard, MessageCircle, Bell, Bug, Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface SettingRow {
  key: string;
  value: string | null;
  isEncrypted: boolean;
  isSet: boolean;
  updatedAt: string | null;
}

interface FieldDef {
  key: string;
  label: string;
  description: string;
  placeholder: string;
  type: 'text' | 'password' | 'number' | 'textarea';
  testable?: boolean;
}

interface SectionDef {
  id: string;
  title: string;
  icon: typeof SettingsIcon;
  intro: string;
  fields: FieldDef[];
}

const SECTIONS: SectionDef[] = [
  {
    id: 'platform',
    title: 'إعدادات المنصة',
    icon: Globe,
    intro: 'الاسم والدومين والاتصال — تظهر في رسائل واتساب والفواتير والإيميلات.',
    fields: [
      { key: 'platform.platformName', label: 'اسم المنصة', description: 'يظهر في الرسائل والإيميلات', placeholder: 'جداول', type: 'text' },
      { key: 'platform.domain', label: 'الدومين الأساسي', description: 'مثال: jdawil.sa', placeholder: 'jdawil.sa', type: 'text' },
      { key: 'platform.trialDays', label: 'أيام التجربة المجانية', description: 'كم يوم يحصل عليها التاجر الجديد', placeholder: '14', type: 'number' },
      { key: 'platform.supportPhone', label: 'هاتف الدعم', description: 'رقم واتساب يظهر للتجار', placeholder: '0500000000', type: 'text' },
      { key: 'platform.supportEmail', label: 'إيميل الدعم', description: '', placeholder: 'support@…', type: 'text' },
    ],
  },
  {
    id: 'moyasar',
    title: 'بوابة الدفع — Moyasar',
    icon: CreditCard,
    intro: 'مفتاح Moyasar الافتراضي للمنصة. كل تاجر يقدر يضع مفتاحه الخاص بنفسه؛ هذا fallback لو ما ضاف.',
    fields: [
      { key: 'moyasar.apiKey', label: 'Moyasar Secret API Key', description: 'sk_live_… أو sk_test_…', placeholder: 'sk_live_…', type: 'password', testable: true },
    ],
  },
  {
    id: 'whatsapp',
    title: 'WhatsApp Cloud API (افتراضي)',
    icon: MessageCircle,
    intro: 'بيانات Meta WhatsApp Business الافتراضية — تستعمل للتجار اللي ما ضافوا بياناتهم.',
    fields: [
      { key: 'whatsapp.defaultToken', label: 'Permanent Token', description: 'من Meta Business Manager', placeholder: 'EAAG…', type: 'password', testable: true },
      { key: 'whatsapp.defaultPhoneId', label: 'Phone Number ID', description: 'رقم هاتف WhatsApp Business', placeholder: '1234…', type: 'password' },
    ],
  },
  {
    id: 'push',
    title: 'الإشعارات (Web Push / VAPID)',
    icon: Bell,
    intro: 'مفاتيح VAPID لإرسال إشعارات للمتصفح. ولّدها مرة واحدة عبر web-push generate-vapid-keys.',
    fields: [
      { key: 'vapid.publicKey', label: 'VAPID Public Key', description: '88 حرف بصيغة base64url', placeholder: 'BPq…', type: 'text', testable: true },
      { key: 'vapid.privateKey', label: 'VAPID Private Key', description: '43 حرف بصيغة base64url', placeholder: '••••', type: 'password' },
      { key: 'vapid.email', label: 'إيميل الاتصال', description: 'يستلم تنبيهات فشل التسليم', placeholder: 'admin@…', type: 'text' },
    ],
  },
  {
    id: 'sentry',
    title: 'تتبع الأخطاء — Sentry',
    icon: Bug,
    intro: 'DSN من Sentry لتجميع الأخطاء والـ performance. اختياري — يعمل بدونه لكن بدون مراقبة.',
    fields: [
      { key: 'sentry.dsn', label: 'Sentry DSN', description: 'https://…@…ingest.sentry.io/…', placeholder: 'https://…', type: 'text' },
    ],
  },
  {
    id: 'firebase',
    title: 'Firebase (OTP عبر SMS)',
    icon: Lock,
    intro: 'كائن JSON كامل من Firebase Console > Project Settings > Web App.',
    fields: [
      { key: 'firebase.config', label: 'Firebase Web Config (JSON)', description: 'apiKey, authDomain, projectId…', placeholder: '{"apiKey":"…",…}', type: 'textarea' },
    ],
  },
];

export default function SuperAdminSettings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [show, setShow] = useState<Record<string, boolean>>({});
  const [testing, setTesting] = useState<string | null>(null);

  const { data: rows = [], isLoading } = useQuery<SettingRow[]>({
    queryKey: ['platform-settings'],
    queryFn: () => api.get('/super-admin/settings').then(r => r.data),
  });

  const byKey = useMemo(() => Object.fromEntries(rows.map((r) => [r.key, r])), [rows]);

  // Seed draft with current (decrypted-or-placeholder) values once loaded
  useEffect(() => {
    if (rows.length === 0) return;
    setDraft((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        if (next[r.key] === undefined) next[r.key] = r.value ?? '';
      }
      return next;
    });
  }, [rows]);

  const dirtyKeys = useMemo(
    () => Object.keys(draft).filter((k) => draft[k] !== (byKey[k]?.value ?? '')),
    [draft, byKey],
  );

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string | null> = {};
      for (const k of dirtyKeys) {
        const v = draft[k];
        // empty string = clear the setting
        payload[k] = v === '' ? null : v;
      }
      return api.put('/super-admin/settings', payload);
    },
    onSuccess: () => {
      toast.success('تم حفظ الإعدادات');
      qc.invalidateQueries({ queryKey: ['platform-settings'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  const test = async (key: string) => {
    setTesting(key);
    try {
      const r = await api.post(`/super-admin/settings/test/${encodeURIComponent(key)}`);
      if (r.data.ok) toast.success('الاتصال يعمل ✓');
      else toast.error(r.data.error ?? `فشل الفحص (${r.data.status ?? '—'})`);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'فشل الفحص');
    } finally {
      setTesting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-1">
        <Loader2 size={32} className="animate-spin text-brand-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1 font-arabic" dir="rtl">
      {/* Top bar */}
      <div className="sticky top-0 z-20 bg-surface-1/95 border-b border-white/8 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SettingsIcon size={20} className="text-brand-400" />
            <h1 className="text-lg font-black text-white">إعدادات المنصة</h1>
          </div>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={dirtyKeys.length === 0 || saveMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black text-white bg-brand-600 hover:bg-brand-500 disabled:opacity-40 transition"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            حفظ {dirtyKeys.length > 0 && `(${dirtyKeys.length})`}
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        {SECTIONS.map((section) => (
          <section key={section.id} className="rounded-2xl border border-white/8 bg-white/[0.02] p-5">
            <div className="flex items-start gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 flex items-center justify-center flex-shrink-0">
                <section.icon size={16} className="text-brand-400" />
              </div>
              <div className="flex-1">
                <h2 className="text-sm font-black text-white">{section.title}</h2>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">{section.intro}</p>
              </div>
            </div>

            <div className="space-y-4 mt-5">
              {section.fields.map((field) => {
                const row = byKey[field.key];
                const value = draft[field.key] ?? '';
                const isDirty = dirtyKeys.includes(field.key);
                const isPwd = field.type === 'password' && !show[field.key];

                return (
                  <div key={field.key}>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                        {field.label}
                        {row?.isSet && (
                          <CheckCircle2 size={11} className="text-emerald-400" />
                        )}
                        {!row?.isSet && (
                          <AlertCircle size={11} className="text-amber-400" />
                        )}
                      </label>
                      {field.testable && row?.isSet && (
                        <button
                          onClick={() => test(field.key)}
                          disabled={testing === field.key}
                          className="text-[10px] font-bold text-brand-400 hover:text-brand-300 disabled:opacity-50"
                        >
                          {testing === field.key ? '... جارٍ الفحص' : 'فحص'}
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      {field.type === 'textarea' ? (
                        <textarea
                          value={value}
                          onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={4}
                          className={`w-full bg-slate-800/60 border ${isDirty ? 'border-brand-500/50' : 'border-white/10'} rounded-xl px-3 py-2.5 text-white text-sm outline-none font-mono`}
                        />
                      ) : (
                        <input
                          type={isPwd ? 'password' : field.type === 'number' ? 'number' : 'text'}
                          value={value}
                          onChange={(e) => setDraft({ ...draft, [field.key]: e.target.value })}
                          placeholder={field.placeholder}
                          className={`w-full bg-slate-800/60 border ${isDirty ? 'border-brand-500/50' : 'border-white/10'} rounded-xl px-3 ${field.type === 'password' ? 'pl-9' : ''} py-2.5 text-white text-sm outline-none ${field.type === 'password' ? 'font-mono' : ''}`}
                        />
                      )}
                      {field.type === 'password' && (
                        <button
                          type="button"
                          onClick={() => setShow({ ...show, [field.key]: !show[field.key] })}
                          className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                        >
                          {show[field.key] ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>

                    {field.description && (
                      <p className="text-[11px] text-slate-500 mt-1">{field.description}</p>
                    )}
                    {row?.updatedAt && (
                      <p className="text-[10px] text-slate-600 mt-0.5">
                        آخر تحديث: {new Date(row.updatedAt).toLocaleString('ar-SA')}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-200">
          <p className="font-bold mb-1">ملاحظة أمنية</p>
          <p className="text-amber-200/80 leading-relaxed">
            القيم الحساسة (API keys / Secrets) مخزّنة مشفّرة AES-256 بمفتاح <code className="px-1 rounded bg-black/30">ENCRYPTION_KEY</code> في
            متغيرات البيئة. تأكد أن المفتاح موجود في الإنتاج قبل حفظ أي اعتماد.
          </p>
        </div>
      </div>
    </div>
  );
}
