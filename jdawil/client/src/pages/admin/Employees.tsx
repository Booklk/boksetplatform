import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, ToggleLeft, ToggleRight, Key } from 'lucide-react';
import api from '../../lib/api';
import { Employee } from '../../types';
import { formatDate } from '../../lib/utils';

export default function AdminEmployees() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [resetPasswordFor, setResetPasswordFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({ name: '', phone: '', password: '' });

  const { data: employees = [], isLoading } = useQuery<Employee[]>({
    queryKey: ['employees'],
    queryFn: () => api.get('/employees').then(r => r.data),
  });

  const { mutate: createEmployee, isPending: creating } = useMutation({
    mutationFn: () => api.post('/employees', form).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('تم إضافة الموظف');
      setShowAdd(false);
      setForm({ name: '', phone: '', password: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الإضافة'),
  });

  const { mutate: toggleActive } = useMutation({
    mutationFn: (id: number) => api.patch(`/employees/${id}/toggle`).then(r => r.data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success(data.isActive ? 'تم تفعيل الموظف' : 'تم إيقاف الموظف');
    },
    onError: () => toast.error('فشل في التحديث'),
  });

  const { mutate: resetPassword, isPending: resetting } = useMutation({
    mutationFn: (id: number) => api.patch(`/employees/${id}/password`, { password: newPassword }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast.success('تم تغيير كلمة المرور');
      setResetPasswordFor(null);
      setNewPassword('');
    },
    onError: () => toast.error('فشل في تغيير كلمة المرور'),
  });

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">الموظفين</h1>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm py-2.5 flex items-center gap-2">
          <Plus size={16} /> موظف جديد
        </button>
      </div>

      {/* Add Employee */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="card border-brand-600/40">
            <h3 className="font-black text-white mb-4">إضافة موظف جديد</h3>
            <div className="space-y-3">
              <div>
                <label className="label">الاسم *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="الاسم الكامل" />
              </div>
              <div>
                <label className="label">رقم الجوال *</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="05xxxxxxxx" dir="ltr" />
              </div>
              <div>
                <label className="label">كلمة المرور *</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} className="input-field" placeholder="6 أحرف على الأقل" />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAdd(false)} className="btn-outline flex-1 text-sm">إلغاء</button>
                <button
                  onClick={() => createEmployee()}
                  disabled={creating || !form.name || !form.phone || form.password.length < 6}
                  className="btn-primary flex-1 text-sm"
                >
                  {creating ? 'جاري الحفظ...' : 'إضافة'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-20" />)}</div>
      ) : (
        <div className="space-y-3">
          {employees.map((emp, i) => (
            <motion.div key={emp.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-white">{emp.name}</h3>
                    <span className={`badge text-xs ${emp.isActive ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                      {emp.isActive ? 'نشط' : 'موقوف'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-400">{emp.phone}</p>
                  <p className="text-xs text-slate-500">{formatDate(emp.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setResetPasswordFor(emp.id)}
                    title="تغيير كلمة المرور"
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-yellow-400 transition-colors"
                  >
                    <Key size={16} />
                  </button>
                  <button
                    onClick={() => { if (confirm(`هل تريد ${emp.isActive ? 'إيقاف' : 'تفعيل'} ${emp.name}؟`)) toggleActive(emp.id); }}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-brand-400 transition-colors"
                  >
                    {emp.isActive ? <ToggleRight size={20} className="text-green-400" /> : <ToggleLeft size={20} />}
                  </button>
                </div>
              </div>

              {/* Reset password inline */}
              <AnimatePresence>
                {resetPasswordFor === emp.id && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-4 flex gap-2">
                    <input
                      type="password"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="كلمة المرور الجديدة"
                      className="input-field text-sm py-2 flex-1"
                    />
                    <button
                      onClick={() => resetPassword(emp.id)}
                      disabled={resetting || newPassword.length < 6}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      حفظ
                    </button>
                    <button onClick={() => { setResetPasswordFor(null); setNewPassword(''); }} className="btn-outline text-sm py-2 px-3">إلغاء</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}

          {employees.length === 0 && (
            <div className="card text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">👷</div>
              <p>لا يوجد موظفون</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary text-sm mt-4 px-6">إضافة موظف</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
