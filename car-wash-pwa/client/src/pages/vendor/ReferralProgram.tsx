import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Share2, Copy, Gift, Users, CheckCircle2, Clock, TrendingUp, MessageCircle } from 'lucide-react';
import api from '../../lib/api';

interface ReferralRow {
  id: number;
  code: string;
  status: 'pending' | 'registered' | 'converted' | 'rewarded' | 'expired';
  rewardType: string | null;
  rewardGranted: boolean;
  referredVendorName: string | null;
  convertedAt: string | null;
  rewardedAt: string | null;
  createdAt: string;
}

interface ReferralData {
  referrals: ReferralRow[];
  stats: {
    total: number;
    registered: number;
    converted: number;
    rewardsEarned: number;
    pendingReward: number;
  };
}

interface GenResp {
  code: string;
  link: string;
  whatsappMessage: string;
}

const statusConfig: Record<string, { label: string; tint: string; icon: any }> = {
  pending:    { label: 'لم يسجل بعد',    tint: 'text-slate-400',  icon: Clock },
  registered: { label: 'في فترة التجربة', tint: 'text-blue-300',   icon: Users },
  converted:  { label: 'اشترك — بانتظار المكافأة', tint: 'text-amber-300', icon: CheckCircle2 },
  rewarded:   { label: 'تمت المكافأة ✅',  tint: 'text-emerald-300', icon: Gift },
  expired:    { label: 'انتهت',           tint: 'text-red-300',    icon: Clock },
};

export default function ReferralProgram() {
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery<ReferralData>({
    queryKey: ['my-referrals'],
    queryFn: async () => (await api.get('/vendor-referral/my-referrals')).data,
  });

  const generate = useMutation({
    mutationFn: () => api.post<GenResp>('/vendor-referral/generate').then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-referrals'] });
      toast.success('تم إنشاء كود الإحالة');
    },
    onError: () => toast.error('تعذّر إنشاء الكود — حاول مرة ثانية'),
  });

  const latest = data?.referrals?.find((r) => r.status === 'pending');

  async function copyLink(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('تم نسخ الرابط');
    } catch {
      toast.error('تعذّر النسخ');
    }
  }

  function shareWhatsApp(msg: string) {
    const url = `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  }

  const shareLink = latest ? `${window.location.origin}/onboard?ref=${latest.code}` : '';
  const shareMsg = latest
    ? `جرّب جداول — أنشئ موقع حجوزات لمشروعك!\n\nأنا أستخدمه وفعلاً سهّل شغلي.\nسجّل مجاناً من هنا:\n${shareLink}\n\nكود الإحالة: ${latest.code}`
    : '';

  return (
    <div className="min-h-screen bg-[#0b1220] text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
            <Gift size={22} className="text-amber-400" />
            برنامج الإحالات
          </h1>
          <p className="text-sm text-slate-400">
            كل تاجر تحيله ويشترك — لك شهر مجاني على بكستك. مافي حد للمكافآت.
          </p>
        </div>

        {/* Stats grid */}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'إجمالي الإحالات',   value: data.stats.total,         icon: Users,          tint: 'text-slate-300' },
              { label: 'في التجربة',        value: data.stats.registered,    icon: Clock,          tint: 'text-blue-300' },
              { label: 'اشتركوا',           value: data.stats.converted,     icon: TrendingUp,     tint: 'text-amber-300' },
              { label: 'مكافآت مستلمة',    value: data.stats.rewardsEarned, icon: Gift,           tint: 'text-emerald-300' },
            ].map((s) => (
              <div key={s.label} className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs text-slate-400">{s.label}</p>
                  <s.icon size={14} className={s.tint} />
                </div>
                <p className={`text-2xl font-black ${s.tint}`}>{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Share card */}
        <div className="bg-gradient-to-br from-indigo-500/10 to-amber-500/10 border border-white/10 rounded-2xl p-5 mb-6">
          <h2 className="text-lg font-black text-white mb-1">رابط الإحالة الخاص بك</h2>
          <p className="text-xs text-slate-400 mb-4">
            شاركه مع تجار تعرفهم — هم يحصلون على 7 أيام تجربة إضافية، وأنت على شهر مجاني بمجرد اشتراكهم.
          </p>

          {latest ? (
            <>
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 mb-3">
                <code className="flex-1 text-xs text-indigo-300 truncate font-mono" dir="ltr">{shareLink}</code>
                <button
                  onClick={() => copyLink(shareLink)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-bold text-indigo-300 inline-flex items-center gap-1.5 transition-colors"
                >
                  <Copy size={12} />
                  {copied ? 'تم' : 'نسخ'}
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => shareWhatsApp(shareMsg)}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-bold text-sm inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <MessageCircle size={14} />
                  مشاركة عبر واتساب
                </button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <button
                    onClick={() => (navigator as any).share({ title: 'جداول', text: shareMsg, url: shareLink })}
                    className="px-4 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-sm font-bold inline-flex items-center gap-2 transition-colors"
                  >
                    <Share2 size={14} />
                    مشاركة
                  </button>
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => generate.mutate()}
              disabled={generate.isPending}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-colors disabled:opacity-50"
            >
              {generate.isPending ? '...' : 'أنشئ كود الإحالة الآن'}
            </button>
          )}
        </div>

        {/* Referrals list */}
        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="font-bold">الإحالات السابقة</h3>
          </div>
          {isLoading ? (
            <div className="p-6 space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 bg-white/[0.03] rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !data || data.referrals.length === 0 ? (
            <div className="p-10 text-center text-slate-500 text-sm">
              ما في إحالات بعد — شارك كودك وابدأ.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {data.referrals.map((r) => {
                const cfg = statusConfig[r.status] ?? statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <div key={r.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {r.referredVendorName ?? 'لم يُستخدم بعد'}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono" dir="ltr">{r.code}</p>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${cfg.tint}`}>
                      <Icon size={13} />
                      {cfg.label}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
