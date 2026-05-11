/**
 * /vendor/kyc — only required when the vendor wants to activate a real
 * payment gateway. Accepts either السجل التجاري (commercial registration)
 * or وثيقة العمل الحر (freelance permit). Both are usually downloaded as
 * PDF from المركز السعودي للأعمال والتنافسية, so we accept PDF + images.
 *
 * States rendered:
 *   not_started / rejected  →  upload form
 *   submitted               →  "under review" banner
 *   approved                →  success + link to payment-gateway
 */

import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  ShieldCheck, FileText, Upload, CheckCircle2, Clock,
  AlertCircle, FileUp, Briefcase, User,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Input, Badge, PageHeader, Skeleton,
} from '../../components/ui';
import { fadeInUp, staggerContainer, springs } from '../../design/motion';

interface KycStatus {
  documentType:    'cr' | 'freelance' | null;
  documentNumber:  string | null;
  status:          'not_started' | 'submitted' | 'approved' | 'rejected';
  rejectionReason: string | null;
  submittedAt:     string | null;
  verifiedAt:      string | null;
  hasDocument:     boolean;
}

const DOC_TYPES: Array<{
  value: 'cr' | 'freelance';
  label: string;
  hint: string;
  icon: typeof Briefcase;
}> = [
  {
    value: 'cr',
    label: 'السجل التجاري',
    hint: 'للشركات والمؤسسات المسجّلة تجارياً',
    icon: Briefcase,
  },
  {
    value: 'freelance',
    label: 'وثيقة العمل الحر',
    hint: 'للأفراد — من المركز السعودي للأعمال والتنافسية',
    icon: User,
  },
];

export default function Kyc() {
  const qc = useQueryClient();
  const [docType, setDocType] = useState<'cr' | 'freelance'>('cr');
  const [docNumber, setDocNumber] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = useQuery<KycStatus>({
    queryKey: ['kyc-status'],
    queryFn: async () => (await api.get('/vendor-kyc/status')).data,
  });

  const submit = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error('يرجى اختيار ملف الوثيقة');
      if (!docNumber.trim()) throw new Error('رقم الوثيقة مطلوب');
      const form = new FormData();
      form.append('document', file);
      form.append('documentType', docType);
      form.append('documentNumber', docNumber.trim());
      await api.post('/vendor-kyc/submit', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['kyc-status'] });
      setFile(null);
      setDocNumber('');
      toast.success('تم رفع الوثيقة. المراجعة خلال 24 ساعة عادةً.');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? e?.message ?? 'فشل الرفع'),
  });

  function pickFile(f: File | null) {
    if (!f) { setFile(null); return; }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('الملف أكبر من 10 ميجا');
      return;
    }
    const ok = ['application/pdf', 'image/jpeg', 'image/png'].includes(f.type);
    if (!ok) {
      toast.error('الصيغة غير مدعومة — PDF أو JPG أو PNG فقط');
      return;
    }
    setFile(f);
  }

  const state = data?.status ?? 'not_started';

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-3xl mx-auto">
        <PageHeader
          icon={<ShieldCheck size={20} />}
          title="توثيق الوثيقة التجارية"
          subtitle="مطلوب فقط لتفعيل الدفع الإلكتروني — لا يؤثر على تشغيل متجرك ولا على العملاء."
        />

        {isLoading ? (
          <Skeleton className="h-40 rounded-2xl" />
        ) : state === 'approved' ? (
          <ApprovedState status={data!} />
        ) : state === 'submitted' ? (
          <SubmittedState status={data!} />
        ) : (
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="space-y-4"
          >
            {state === 'rejected' && data?.rejectionReason && (
              <motion.div variants={fadeInUp}>
                <Card
                  variant="elevated"
                  padding="md"
                  className="bg-danger-500/5 border-danger-500/30"
                >
                  <div className="flex items-start gap-2">
                    <AlertCircle size={18} className="text-danger-300 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-black text-danger-300 mb-0.5">تم رفض الوثيقة السابقة</p>
                      <p className="text-xs text-danger-200 leading-relaxed">{data.rejectionReason}</p>
                      <p className="text-[11px] text-ink-400 mt-1">ارفع وثيقة جديدة وسنراجعها خلال 24 ساعة.</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}

            {/* Document type */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" padding="md">
                <p className="text-xs font-bold text-ink-400 mb-3">نوع الوثيقة</p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {DOC_TYPES.map((opt) => {
                    const active = docType === opt.value;
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setDocType(opt.value)}
                        aria-pressed={active}
                        className={`text-right p-3 rounded-xl border-2 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                          active
                            ? 'border-primary-500/60 bg-primary-500/10'
                            : 'border-white/[0.06] bg-white/[0.02] hover:border-white/[0.15]'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Icon size={14} className={active ? 'text-primary-300' : 'text-ink-400'} />
                          <p className="font-bold text-white text-sm">{opt.label}</p>
                        </div>
                        <p className="text-[11px] text-ink-400 leading-relaxed">{opt.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </Card>
            </motion.div>

            {/* Document number */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" padding="md">
                <Input
                  label={docType === 'cr' ? 'رقم السجل التجاري' : 'رقم وثيقة العمل الحر'}
                  dir="ltr"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="مثال: 1010101010"
                  help="الرقم المكون من 10 أرقام كما يظهر في الوثيقة"
                />
              </Card>
            </motion.div>

            {/* File upload */}
            <motion.div variants={fadeInUp}>
              <Card variant="default" padding="md">
                <p className="text-xs font-bold text-ink-400 mb-2">ملف الوثيقة</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/pdf,image/jpeg,image/png"
                  onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <motion.button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  whileHover={{ y: -2 }}
                  transition={springs.snappy}
                  className="w-full p-5 rounded-xl border-2 border-dashed border-white/[0.12] hover:border-primary-500/40 bg-white/[0.02] hover:bg-primary-500/[0.04] transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                >
                  {file ? (
                    <div className="flex items-center gap-3 text-right">
                      <FileText size={28} className="text-primary-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-white truncate">{file.name}</p>
                        <p className="text-[11px] text-ink-400">
                          {(file.size / 1024).toFixed(0)} KB · {file.type}
                        </p>
                      </div>
                      <Badge tone="success" size="sm" leftIcon={<CheckCircle2 size={10} />}>جاهز</Badge>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <FileUp size={32} className="text-ink-500" />
                      <p className="text-sm font-bold text-white">اسحب الملف هنا أو اضغط للاختيار</p>
                      <p className="text-[11px] text-ink-500">
                        PDF أو JPG أو PNG · حد أقصى 10 ميجا
                      </p>
                      <p className="text-[10px] text-ink-600">
                        يُفضّل تنزيل الملف من tawakkalna/المركز السعودي للأعمال والتنافسية ورفعه كما هو
                      </p>
                    </div>
                  )}
                </motion.button>
              </Card>
            </motion.div>

            {/* Submit */}
            <motion.div variants={fadeInUp}>
              <Button
                size="lg"
                fullWidth
                leftIcon={<Upload size={15} />}
                loading={submit.isPending}
                disabled={!file || !docNumber.trim()}
                onClick={() => submit.mutate()}
              >
                رفع الوثيقة للمراجعة
              </Button>
              <p className="text-[11px] text-ink-500 text-center mt-2">
                المراجعة خلال 24 ساعة عادةً · بياناتك محفوظة بتشفير AES-256
              </p>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function SubmittedState({ status }: { status: KycStatus }) {
  return (
    <Card variant="elevated" padding="lg" className="bg-warn-500/5 border-warn-500/20">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-warn-500/15 border border-warn-500/30 flex items-center justify-center mb-3">
          <Clock size={22} className="text-warn-300" />
        </div>
        <h2 className="text-lg font-black text-white mb-1">وثيقتك تحت المراجعة</h2>
        <p className="text-sm text-ink-300 leading-relaxed max-w-md mb-4">
          استلمنا {status.documentType === 'cr' ? 'السجل التجاري' : 'وثيقة العمل الحر'} (رقم{' '}
          <span dir="ltr" className="font-mono">{status.documentNumber}</span>).
          {' '}عادةً المراجعة تتم خلال 24 ساعة. بنوصلك برسالة واتساب أول ما ننتهي.
        </p>
        {status.submittedAt && (
          <p className="text-[11px] text-ink-500">
            رُفعت: {new Date(status.submittedAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}
          </p>
        )}
      </div>
    </Card>
  );
}

function ApprovedState({ status }: { status: KycStatus }) {
  return (
    <Card variant="elevated" padding="lg" className="bg-success-500/5 border-success-500/20">
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 rounded-full bg-success-500/15 border border-success-500/30 flex items-center justify-center mb-3">
          <CheckCircle2 size={22} className="text-success-300" />
        </div>
        <h2 className="text-lg font-black text-white mb-1">الوثيقة معتمدة ✓</h2>
        <p className="text-sm text-ink-300 leading-relaxed max-w-md mb-1">
          {status.documentType === 'cr' ? 'السجل التجاري' : 'وثيقة العمل الحر'}{' '}
          <span dir="ltr" className="font-mono">{status.documentNumber}</span>
        </p>
        {status.verifiedAt && (
          <p className="text-[11px] text-ink-500 mb-4">
            تم التوثيق: {new Date(status.verifiedAt).toLocaleString('ar-SA', { dateStyle: 'medium' })}
          </p>
        )}
        <Link to="/vendor/payment-gateway">
          <Button variant="success" size="lg" leftIcon={<ShieldCheck size={15} />}>
            فعّل بوابة الدفع
          </Button>
        </Link>
      </div>
    </Card>
  );
}
