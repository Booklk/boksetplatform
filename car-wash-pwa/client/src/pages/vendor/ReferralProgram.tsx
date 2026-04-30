import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Share2, Copy, Gift, Users, CheckCircle2, Clock, TrendingUp, MessageCircle,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, EmptyState, PageHeader, Stat, Skeleton,
} from '../../components/ui';
import { fadeInUp, staggerContainer } from '../../design/motion';

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
  pending:    { label: 'لم يسجل بعد',              tint: 'text-ink-400',     icon: Clock },
  registered: { label: 'في فترة التجربة',          tint: 'text-primary-300', icon: Users },
  converted:  { label: 'اشترك — بانتظار المكافأة',  tint: 'text-warn-300',    icon: CheckCircle2 },
  rewarded:   { label: 'تمت المكافأة ✓',            tint: 'text-success-300', icon: Gift },
  expired:    { label: 'انتهت',                     tint: 'text-danger-300',  icon: Clock },
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
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={<Gift size={20} />}
          title="برنامج الإحالات"
          subtitle="كل تاجر تحيله ويشترك — لك شهر مجاني على اشتراكك. بدون حد."
        />

        {/* Stats */}
        {data && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeInUp}>
              <Stat label="إجمالي الإحالات" value={data.stats.total}         icon={<Users size={14} />} />
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Stat label="في التجربة"      value={data.stats.registered}    icon={<Clock size={14} />} />
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Stat label="اشتركوا"         value={data.stats.converted}     icon={<TrendingUp size={14} />} />
            </motion.div>
            <motion.div variants={fadeInUp}>
              <Stat label="مكافآت مستلمة"  value={data.stats.rewardsEarned} icon={<Gift size={14} />} />
            </motion.div>
          </motion.div>
        )}

        {/* Share card */}
        <Card
          variant="elevated"
          padding="lg"
          className="mb-6 bg-gradient-to-br from-primary-500/10 to-warn-500/10 border-white/10"
        >
          <h2 className="text-lg font-black text-white mb-1">رابط الإحالة الخاص بك</h2>
          <p className="text-xs text-ink-400 mb-4 leading-relaxed">
            شاركه مع تجار تعرفهم — هم يحصلون على 7 أيام تجربة إضافية، وأنت على شهر مجاني بمجرد اشتراكهم.
          </p>

          {latest ? (
            <>
              <div className="flex items-center gap-2 bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 mb-3">
                <code className="flex-1 text-xs text-primary-300 truncate font-mono" dir="ltr">
                  {shareLink}
                </code>
                <Button
                  variant="secondary"
                  size="sm"
                  leftIcon={<Copy size={12} />}
                  onClick={() => copyLink(shareLink)}
                >
                  {copied ? 'تم' : 'نسخ'}
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="success"
                  fullWidth
                  leftIcon={<MessageCircle size={14} />}
                  onClick={() => shareWhatsApp(shareMsg)}
                >
                  مشاركة عبر واتساب
                </Button>
                {typeof navigator !== 'undefined' && 'share' in navigator && (
                  <Button
                    variant="secondary"
                    leftIcon={<Share2 size={14} />}
                    onClick={() => (navigator as any).share({ title: 'جداول', text: shareMsg, url: shareLink })}
                  >
                    مشاركة
                  </Button>
                )}
              </div>
            </>
          ) : (
            <Button
              onClick={() => generate.mutate()}
              loading={generate.isPending}
              fullWidth
              size="lg"
            >
              أنشئ كود الإحالة الآن
            </Button>
          )}
        </Card>

        {/* History */}
        <Card variant="default" padding="none">
          <div className="p-4 border-b border-white/[0.06]">
            <h3 className="font-bold">الإحالات السابقة</h3>
          </div>
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : !data || data.referrals.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                icon={<Gift size={18} />}
                title="ما في إحالات بعد"
                body="شارك كودك مع تاجر تعرفه — الكل يستفيد."
              />
            </div>
          ) : (
            <motion.ul
              className="divide-y divide-white/[0.04]"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              {data.referrals.map((r) => {
                const cfg = statusConfig[r.status] ?? statusConfig.pending;
                const Icon = cfg.icon;
                return (
                  <motion.li
                    key={r.id}
                    variants={fadeInUp}
                    className="p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-sm truncate">
                        {r.referredVendorName ?? 'لم يُستخدم بعد'}
                      </p>
                      <p className="text-[11px] text-ink-500 font-mono" dir="ltr">{r.code}</p>
                    </div>
                    <div className={`inline-flex items-center gap-1.5 text-xs font-bold ${cfg.tint}`}>
                      <Icon size={13} />
                      {cfg.label}
                    </div>
                  </motion.li>
                );
              })}
            </motion.ul>
          )}
        </Card>
      </div>
    </div>
  );
}
