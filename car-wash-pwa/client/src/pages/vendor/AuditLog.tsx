import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Shield, User, Globe, Clock, RefreshCw } from 'lucide-react';
import api from '../../lib/api';

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
    'payment.refund': 'استرجاع مبلغ',
    'employee.delete': 'حذف موظف',
    'employee.create': 'إضافة موظف',
    'employee.update': 'تعديل موظف',
    'automation.delete': 'حذف أتمتة',
    'automation.update': 'تعديل أتمتة',
    'campaign.send': 'إرسال حملة',
    'segment.delete': 'حذف شريحة',
    'financial.export': 'تصدير قائمة مالية',
    'crm.import': 'استيراد عملاء',
  };
  return map[a] ?? a;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'قبل ثواني';
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
      const { data } = await api.get<{ logs: AuditEntry[] }>(`/vendors/my/audit-logs?page=${page}`);
      return data.logs;
    },
  });

  return (
    <div className="min-h-screen bg-[#0b1220] text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
              <Shield size={22} className="text-indigo-400" />
              سجل الأنشطة
            </h1>
            <p className="text-sm text-slate-400">
              من الذي عمل إيش ومتى — تتبّع كامل للإجراءات الحساسة داخل متجرك.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold inline-flex items-center gap-2 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
            <Shield size={36} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400 font-bold text-sm">ما في أنشطة حساسة محفوظة لحد الآن.</p>
            <p className="text-slate-600 text-xs mt-1">
              الإجراءات الحساسة (حذف، استرجاع، تعديل موظفين...) تنحفظ هنا تلقائياً.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {data.map((log) => (
              <div
                key={log.id}
                className="bg-white/[0.03] border border-white/[0.06] hover:border-white/[0.10] rounded-xl p-3 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-white">{formatAction(log.action)}</span>
                      {log.method && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {log.method}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
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
                    <p className="text-[10px] text-slate-600 font-mono mt-1 truncate" dir="ltr">
                      {log.resource}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1 || isFetching}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold disabled:opacity-40"
          >
            السابق
          </button>
          <span className="text-xs text-slate-500">صفحة {page}</span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={isFetching || !data || data.length < 50}
            className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold disabled:opacity-40"
          >
            التالي
          </button>
        </div>
      </div>
    </div>
  );
}
