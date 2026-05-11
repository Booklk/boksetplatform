import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Building2, Plus, MapPin, Phone, Pencil, Trash2 } from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Input, EmptyState, PageHeader, SkeletonCard,
} from '../../components/ui';
import { fadeInUp, scaleIn, staggerContainer } from '../../design/motion';

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

  const activeBranches = branches.filter((b) => b.isActive);

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={<Building2 size={20} />}
          title="الفروع"
          subtitle="أضف فروع متجرك — كل حجز يروح للفرع المختار ومواعيد العمل مستقلة."
          actions={
            <Button
              onClick={() => setForm({ ...EMPTY })}
              leftIcon={<Plus size={15} />}
            >
              فرع جديد
            </Button>
          }
        />

        {isLoading ? (
          <div className="grid gap-2" aria-live="polite" aria-busy="true">
            {[1, 2, 3].map((i) => <SkeletonCard key={i} />)}
          </div>
        ) : activeBranches.length === 0 ? (
          <EmptyState
            icon={<Building2 size={24} />}
            title="ما عندك فروع بعد"
            body="لو مشروعك يشتغل من موقع واحد — هذا طبيعي، تقدر تتجاهل هذي الصفحة. أضف فرع لما تتوسّع."
            action={
              <Button onClick={() => setForm({ ...EMPTY })} leftIcon={<Plus size={14} />}>
                إضافة أول فرع
              </Button>
            }
          />
        ) : (
          <motion.div
            className="grid gap-2"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {activeBranches.map((b) => (
              <motion.div key={b.id} variants={fadeInUp}>
                <Card variant="interactive" padding="md" animateHover>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white mb-1">{b.nameAr}</p>
                      <div className="flex flex-wrap gap-3 text-[11px] text-ink-400">
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
                      {b.address && (
                        <p className="text-[11px] text-ink-500 mt-1">{b.address}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`تعديل ${b.nameAr}`}
                        onClick={() =>
                          setForm({
                            id: b.id,
                            nameAr: b.nameAr,
                            nameEn: b.nameEn ?? '',
                            city: b.city ?? '',
                            address: b.address ?? '',
                            phone: b.phone ?? '',
                          })
                        }
                      >
                        <Pencil size={14} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`حذف ${b.nameAr}`}
                        className="text-danger-300 hover:bg-danger-500/10"
                        onClick={() => {
                          if (confirm(`تعطيل فرع "${b.nameAr}"؟`)) remove.mutate(b.id);
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Modal */}
        <AnimatePresence>
          {form && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => !save.isPending && setForm(null)}
              role="dialog"
              aria-modal="true"
              aria-labelledby="branch-modal-title"
            >
              <motion.form
                variants={scaleIn}
                initial="hidden"
                animate="visible"
                exit="exit"
                onSubmit={submit}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md"
                dir="rtl"
              >
                <Card variant="elevated" padding="lg" className="space-y-3">
                  <h3 id="branch-modal-title" className="text-lg font-black mb-1">
                    {form.id ? 'تعديل الفرع' : 'فرع جديد'}
                  </h3>
                  <Input
                    label="اسم الفرع *"
                    value={form.nameAr}
                    onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                    autoFocus
                  />
                  <Input
                    label="المدينة"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                  />
                  <Input
                    label="العنوان"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                  <Input
                    label="رقم الجوال"
                    type="tel"
                    dir="ltr"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                  <div className="flex items-center gap-2 pt-2">
                    <Button type="submit" loading={save.isPending} fullWidth>
                      حفظ
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => setForm(null)}>
                      إلغاء
                    </Button>
                  </div>
                </Card>
              </motion.form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
