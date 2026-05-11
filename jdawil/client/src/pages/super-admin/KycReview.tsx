/**
 * /super-admin/kyc — queue of vendors waiting for KYC review.
 *
 * Each row expands to an inline doc preview (PDF inline via <object>,
 * images via <img>) plus approve / reject controls. Reject requires a
 * reason so the vendor sees a clear explanation in their dashboard.
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ShieldCheck, FileText, CheckCircle2, XCircle,
  ChevronDown, ChevronUp, Briefcase, User, Clock,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, EmptyState, PageHeader, Skeleton, Badge,
} from '../../components/ui';
import { fadeInUp, staggerContainer, springs } from '../../design/motion';

interface PendingVendor {
  id: number;
  nameAr: string;
  slug: string;
  phone: string;
  city: string | null;
  documentType: 'cr' | 'freelance' | null;
  documentNumber: string | null;
  submittedAt: string | null;
}

function timeSince(iso: string | null): string {
  if (!iso) return '';
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 60) return `قبل ${m}د`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h}س`;
  return `قبل ${Math.floor(h / 24)} يوم`;
}

export default function KycReview() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<number | null>(null);

  const { data, isLoading } = useQuery<{ vendors: PendingVendor[] }>({
    queryKey: ['kyc-pending'],
    queryFn: async () => (await api.get('/super-admin/kyc/pending')).data,
  });

  const approve = useMutation({
    mutationFn: (vendorId: number) => api.post(`/super-admin/kyc/${vendorId}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-pending'] });
      toast.success('اعتمدت الوثيقة');
    },
    onError: () => toast.error('فشل الاعتماد'),
  });

  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      api.post(`/super-admin/kyc/${id}/reject`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-pending'] });
      toast.success('رفضت الوثيقة');
    },
    onError: () => toast.error('فشل الرفض'),
  });

  const pending = data?.vendors ?? [];

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={<ShieldCheck size={20} />}
          title="مراجعة التوثيق التجاري"
          subtitle={`${pending.length} تاجر بانتظار المراجعة`}
        />

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
          </div>
        ) : pending.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={24} />}
            title="ما في وثائق تنتظر المراجعة"
            body="كل الوثائق المقدّمة راجعتها — بتظهر هنا أول ما يرفع تاجر جديد."
          />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-2"
          >
            {pending.map((v) => (
              <motion.div key={v.id} variants={fadeInUp}>
                <Card variant="default" padding="none" className="overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpanded((cur) => cur === v.id ? null : v.id)}
                    className="w-full text-right p-4 hover:bg-white/[0.02] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className="shrink-0 w-9 h-9 rounded-xl bg-warn-500/10 border border-warn-500/20 flex items-center justify-center">
                          {v.documentType === 'cr' ? (
                            <Briefcase size={15} className="text-warn-300" />
                          ) : (
                            <User size={15} className="text-warn-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="font-bold text-white">{v.nameAr}</p>
                            <Badge tone="warn" size="sm" leftIcon={<Clock size={9} />}>
                              {timeSince(v.submittedAt)}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-ink-400">
                            {v.documentType === 'cr' ? 'سجل تجاري' : 'وثيقة عمل حر'}{' '}
                            <span dir="ltr" className="font-mono">#{v.documentNumber}</span>
                            {v.city && ` · ${v.city}`}
                            {' · '}<span dir="ltr" className="font-mono">{v.phone}</span>
                          </p>
                        </div>
                      </div>
                      {expanded === v.id
                        ? <ChevronUp size={14} className="text-ink-400" />
                        : <ChevronDown size={14} className="text-ink-400" />}
                    </div>
                  </button>

                  <AnimatePresence initial={false}>
                    {expanded === v.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={springs.gentle}
                        className="overflow-hidden"
                      >
                        <DocumentPreview vendorId={v.id} />
                        <ActionBar
                          vendorId={v.id}
                          onApprove={() => approve.mutate(v.id)}
                          onReject={(reason) => reject.mutate({ id: v.id, reason })}
                          busy={approve.isPending || reject.isPending}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}

// ─── Document preview ──────────────────────────────────────────────────────
// KYC docs are protected by requireAuth; <object>/<img> tags can't carry
// our JWT. We fetch the file as a blob via axios (Authorization header
// attached) and turn it into a blob: URL the browser can render inline.
// This avoids exposing the bearer token in query strings / server logs.

function DocumentPreview({ vendorId }: { vendorId: number }) {
  const { data } = useQuery<{ url: string; mime: string }>({
    queryKey: ['kyc-doc', vendorId],
    queryFn: async () => {
      const res = await api.get(`/vendor-kyc/document?vendorId=${vendorId}`, {
        responseType: 'blob',
      });
      const blob = res.data as Blob;
      const url = URL.createObjectURL(blob);
      return { url, mime: blob.type };
    },
    staleTime: 5 * 60_000,
  });

  return (
    <div className="border-t border-white/[0.06] p-4 bg-white/[0.02]">
      <p className="text-[11px] font-bold text-ink-400 mb-2 flex items-center gap-1.5">
        <FileText size={11} />
        معاينة الوثيقة
      </p>
      <div className="rounded-xl overflow-hidden bg-white/[0.04] border border-white/[0.06] h-80">
        {!data ? (
          <div className="w-full h-full flex items-center justify-center text-ink-500 text-xs">
            جاري التحميل…
          </div>
        ) : data.mime.startsWith('image/') ? (
          <img src={data.url} alt="وثيقة" className="w-full h-full object-contain" />
        ) : (
          <object data={data.url} type={data.mime} className="w-full h-full">
            <p className="p-4 text-xs text-ink-400">
              المتصفح لا يدعم معاينة PDF.{' '}
              <a href={data.url} target="_blank" rel="noreferrer" className="text-primary-300">
                افتح في تبويب جديد
              </a>
            </p>
          </object>
        )}
      </div>
      {data && (
        <a
          href={data.url}
          target="_blank"
          rel="noreferrer"
          className="inline-block mt-2 text-[11px] text-primary-300 hover:text-primary-200"
        >
          فتح في تبويب جديد ↗
        </a>
      )}
    </div>
  );
}

// ─── Approve / reject bar ─────────────────────────────────────────────────

function ActionBar({
  onApprove, onReject, busy,
}: {
  vendorId: number;
  onApprove: () => void;
  onReject: (reason: string) => void;
  busy: boolean;
}) {
  const [rejectMode, setRejectMode] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <div className="border-t border-white/[0.06] p-4 bg-white/[0.02]">
      {rejectMode ? (
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-ink-400">سبب الرفض (سيشاهده التاجر)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-danger-500/40 rounded-xl px-3 py-2 text-sm outline-none"
            placeholder="مثال: الوثيقة منتهية الصلاحية — يرجى رفع نسخة محدّثة"
          />
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              leftIcon={<XCircle size={14} />}
              loading={busy}
              disabled={!reason.trim()}
              onClick={() => onReject(reason.trim())}
            >
              تأكيد الرفض
            </Button>
            <Button variant="secondary" onClick={() => { setRejectMode(false); setReason(''); }}>
              إلغاء
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Button
            variant="success"
            leftIcon={<CheckCircle2 size={14} />}
            loading={busy}
            onClick={onApprove}
          >
            اعتماد
          </Button>
          <Button
            variant="secondary"
            leftIcon={<XCircle size={14} />}
            onClick={() => setRejectMode(true)}
          >
            رفض
          </Button>
        </div>
      )}
    </div>
  );
}
