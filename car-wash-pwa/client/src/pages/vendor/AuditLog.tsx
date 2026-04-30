import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Shield, User, Globe, Clock, RefreshCw } from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Badge, EmptyState, PageHeader, Skeleton,
} from '../../components/ui';
import { fadeInUp, staggerContainer } from '../../design/motion';

interface AuditEntry {
  id: number;
  action: string;
  resource: string;
  method: string | null;
  ip: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  userName: string | null;
  userRole: string | null;
}

function formatAction(a: string): string {
  const map: Record<string, string> = {
    'payment.refund':     'استرجاع مبلغ',
    'employee.delete':    'حذف موظف',
    'employee.create':    'إضافة موظف',
    'employee.update':    'تعديل موظف',
    'automation.delete':  'حذف أتمتة',
    'automation.update':  'تعديل أتمتة',
    'campaign.send':      'إرسال حملة',
    'segment.delete':     'حذف شريحة',
    'financial.export':   'تصدير قائمة مالية',
    'crm.import':         'استيراد عملاء',
    'super_admin.impersonate': 'دخول باسم التاجر (دعم)',
  };
  return map[a] ?? a;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'قبل ثواني';
  if (m < 60) return `قبل ${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `قبل ${h} ساعة`;
  const d = Math.floor(h / 24);
  return `قبل ${d} يوم`;
}

export default function AuditLog() {
  const [page, setPage] = useState(1);
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['my-audit-logs', page],
    queryFn: async () => {
      const res = await api.get<{ logs: AuditEntry[] }>(`/vendors/my/audit-logs?page=${page}`);
      return res.data.logs;
    },
  });

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={<Shield size={20} />}
          title="سجل الأنشطة"
          subtitle="من الذي عمل إيش ومتى — تتبّع كامل للإجراءات الحساسة داخل متجرك."
          actions={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => refetch()}
              loading={isFetching}
              leftIcon={<RefreshCw size={13} />}
            >
              تحديث
            </Button>
          }
        />

        {isLoading ? (
          <div className="grid gap-2" aria-live="polite" aria-busy="true">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Shield size={24} />}
            title="ما في أنشطة حساسة محفوظة لحد الآن"
            body="الإجراءات الحساسة (حذف، استرجاع، تعديل موظفين، إرسال حملات) تنحفظ هنا تلقائياً."
          />
        ) : (
          <motion.div
            className="space-y-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {data.map((log) => (
              <motion.div key={log.id} variants={fadeInUp}>
                <Card variant="interactive" padding="sm" animateHover>
                  <div className="flex items-start gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-bold text-white">{formatAction(log.action)}</span>
                    {log.method && (
                      <Badge tone="primary" size="sm">{log.method}</Badge>
                    )}
                    {(log.metadata as any)?.impersonation && (
                      <Badge tone="warn" size="sm">دعم منتحل</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-ink-400">
                    <span className="inline-flex items-center gap-1">
                      <User size={11} />
                      {log.userName ?? 'غير معروف'}
                      {log.userRole ? ` · ${log.userRole}` : ''}
                    </span>
                    {log.ip && (
                      <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                        <Globe size={11} />
                        {log.ip}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <Clock size={11} />
                      {timeAgo(log.createdAt)}
                    </span>
                  </div>
                  <p className="text-[10px] text-ink-600 font-mono mt-1 truncate" dir="ltr">
                    {log.resource}
                  </p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Pagination */}
        <nav className="flex items-center justify-between mt-6" aria-label="الصفحات">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
          >
            السابق
          </Button>
          <span className="text-xs text-ink-500">صفحة {page}</span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching || !data || data.length < 50}
          >
            التالي
          </Button>
        </nav>
      </div>
    </div>
  );
}
