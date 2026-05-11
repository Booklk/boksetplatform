import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Users, Search, Shield, UserX, UserCheck, Building2 } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'مدير منصة', vendor_admin: 'صاحب مشروع', admin: 'مدير', employee: 'موظف', customer: 'عميل',
};
const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-500/15 text-red-400', vendor_admin: 'bg-indigo-500/15 text-indigo-400',
  admin: 'bg-blue-500/15 text-blue-400', employee: 'bg-amber-500/15 text-amber-400', customer: 'bg-slate-500/15 text-slate-400',
};

export default function AdminUsers() {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-users', roleFilter],
    queryFn: () => api.get(`/super-admin/users?role=${roleFilter}&limit=100`).then(r => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (userId: number) => api.patch(`/super-admin/users/${userId}/toggle`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('تم التحديث'); },
  });

  const users = (data?.users ?? []).filter((u: any) =>
    !search || u.name?.includes(search) || u.phone?.includes(search) || u.email?.includes(search)
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-white flex items-center gap-2"><Users className="w-5 h-5 text-indigo-400" /> إدارة المستخدمين</h2>
        <span className="text-sm text-slate-500">{data?.total ?? 0} مستخدم</span>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الرقم..." className="input-field pr-10 text-sm" />
        </div>
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)}
          className="input-field w-auto text-sm bg-surface-3">
          <option value="">كل الأدوار</option>
          {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
        <table className="modern-table w-full">
          <thead><tr><th>المستخدم</th><th>الدور</th><th>المشروع</th><th>الحالة</th><th>إجراء</th></tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">جاري التحميل...</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-slate-500">لا توجد نتائج</td></tr>
            ) : users.map((u: any) => (
              <tr key={u.id}>
                <td>
                  <p className="font-bold text-white text-sm">{u.name}</p>
                  <p className="text-xs text-slate-500">{u.phone} {u.email ? `· ${u.email}` : ''}</p>
                </td>
                <td><span className={`px-2 py-0.5 rounded-full text-xs font-bold ${ROLE_COLORS[u.role] ?? ''}`}>{ROLE_LABELS[u.role] ?? u.role}</span></td>
                <td className="text-sm text-slate-400">{u.vendorName ?? '—'}</td>
                <td>{u.isActive ? <span className="text-emerald-400 text-xs font-bold">نشط</span> : <span className="text-red-400 text-xs font-bold">موقوف</span>}</td>
                <td>
                  {u.role !== 'super_admin' && (
                    <button onClick={() => toggleMutation.mutate(u.id)}
                      className="text-xs text-slate-400 hover:text-white transition-colors">
                      {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
