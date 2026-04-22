import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Building2, Plus, MapPin, Phone, Pencil, Trash2 } from 'lucide-react';
import api from '../../lib/api';

interface Branch {
  id: number;
  nameAr: string;
  nameEn: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  isActive: boolean;
}

interface FormState {
  id?: number;
  nameAr: string;
  nameEn: string;
  city: string;
  address: string;
  phone: string;
}

const EMPTY: FormState = { nameAr: '', nameEn: '', city: '', address: '', phone: '' };

export default function Branches() {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);

  const { data: branches = [], isLoading } = useQuery<Branch[]>({
    queryKey: ['branches'],
    queryFn: async () => (await api.get('/branches')).data,
  });

  const save = useMutation({
    mutationFn: async (f: FormState) => {
      const body = {
        nameAr: f.nameAr,
        nameEn: f.nameEn || undefined,
        city: f.city || undefined,
        address: f.address || undefined,
        phone: f.phone || undefined,
      };
      if (f.id) return (await api.put(`/branches/${f.id}`, body)).data;
      return (await api.post('/branches', body)).data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      setForm(null);
      toast.success('تم الحفظ');
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الحفظ'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/branches/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branches'] });
      toast.success('تم تعطيل الفرع');
    },
    onError: () => toast.error('تعذّر الحذف'),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    if (!form.nameAr.trim()) return toast.error('اسم الفرع مطلوب');
    save.mutate(form);
  }

  return (
    <div className="min-h-screen bg-[#0b1220] text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black mb-1 flex items-center gap-2">
              <Building2 size={22} className="text-indigo-400" />
              الفروع
            </h1>
            <p className="text-sm text-slate-400">
              أضف فروع متجرك — كل حجز يروح للفرع المختار ومواعيد العمل مستقلة.
            </p>
          </div>
          <button
            onClick={() => setForm({ ...EMPTY })}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
          >
            <Plus size={15} />
            فرع جديد
          </button>
        </div>

        {isLoading ? (
          <div className="grid gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-white/[0.03] border border-white/[0.06] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : branches.filter((b) => b.isActive).length === 0 ? (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-10 text-center">
            <Building2 size={36} className="mx-auto text-slate-600 mb-3" />
            <p className="text-slate-400 font-bold text-sm mb-1">ما عندك فروع بعد</p>
            <p className="text-slate-600 text-xs">
              لو مشروعك يشتغل من موقع واحد — هذا طبيعي، تقدر تتجاهل هذي الصفحة.
            </p>
          </div>
        ) : (
          <div className="grid gap-2">
            {branches.filter((b) => b.isActive).map((b) => (
              <div
                key={b.id}
                className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 flex items-start justify-between gap-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-white mb-1">{b.nameAr}</p>
                  <div className="flex flex-wrap gap-3 text-[11px] text-slate-400">
                    {b.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={11} />
                        {b.city}
                      </span>
                    )}
                    {b.phone && (
                      <span className="inline-flex items-center gap-1 font-mono" dir="ltr">
                        <Phone size={11} />
                        {b.phone}
                      </span>
                    )}
                  </div>
                  {b.address && <p className="text-[11px] text-slate-500 mt-1">{b.address}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setForm({
                      id: b.id,
                      nameAr: b.nameAr,
                      nameEn: b.nameEn ?? '',
                      city: b.city ?? '',
                      address: b.address ?? '',
                      phone: b.phone ?? '',
                    })}
                    className="p-2 rounded-lg hover:bg-white/[0.06] text-slate-300"
                    aria-label="تعديل"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`تعطيل فرع "${b.nameAr}"؟`)) remove.mutate(b.id);
                    }}
                    className="p-2 rounded-lg hover:bg-red-500/10 text-red-300"
                    aria-label="حذف"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal */}
        {form && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !save.isPending && setForm(null)}
          >
            <form
              onSubmit={submit}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-5 space-y-3"
              dir="rtl"
            >
              <h3 className="text-lg font-black mb-2">
                {form.id ? 'تعديل الفرع' : 'فرع جديد'}
              </h3>
              <input
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                placeholder="اسم الفرع *"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/40"
                autoFocus
              />
              <input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="المدينة"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/40"
              />
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="العنوان"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/40"
              />
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="رقم الجوال"
                dir="ltr"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500/40"
              />
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={save.isPending}
                  className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition-colors disabled:opacity-50"
                >
                  {save.isPending ? '...' : 'حفظ'}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(null)}
                  className="py-2.5 px-4 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-sm"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
