import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../lib/api';

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-blue-400', POST: 'text-emerald-400', PUT: 'text-amber-400',
  PATCH: 'text-amber-400', DELETE: 'text-red-400',
};

export default function AuditLogs() {
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['admin-audit-logs', page],
    queryFn: () => api.get(`/super-admin/audit-logs?page=${page}`).then(r => r.data),
  });

  const logs = data?.logs ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 50);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-400" /> سجل العمليات
        </h2>
        <span className="text-sm text-slate-500">{total} عملية</span>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="modern-table w-full">
          <thead><tr><th>الوقت</th><th>المستخدم</th><th>الإجراء</th><th>المسار</th><th>الطريقة</th><th>IP</th></tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">جاري التحميل...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-slate-500">لا توجد سجلات</td></tr>
            ) : logs.map((log: any) => (
              <tr key={log.id}>
                <td className="text-xs text-slate-500 whitespace-nowrap">{new Date(log.createdAt).toLocaleString('ar-SA')}</td>
                <td>
                  <p className="text-sm text-white">{log.userName ?? '—'}</p>
                  <p className="text-[10px] text-slate-600">{log.vendorName ?? ''}</p>
                </td>
                <td className="text-sm text-slate-300 font-mono">{log.action}</td>
                <td className="text-xs text-slate-500 font-mono truncate max-w-[200px]">{log.resource}</td>
                <td><span className={`text-xs font-bold ${METHOD_COLORS[log.method] ?? 'text-slate-400'}`}>{log.method}</span></td>
                <td className="text-xs text-slate-600 font-mono">{log.ip ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-icon"><ChevronRight className="w-4 h-4" /></button>
          <span className="text-sm text-slate-400">صفحة {page} من {totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="btn-icon"><ChevronLeft className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
}
