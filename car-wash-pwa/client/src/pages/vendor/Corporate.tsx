import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, ChevronDown, ChevronUp, Building2, Phone, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

interface CorpForm {
  nameAr: string;
  vatNumber: string;
  contactName: string;
  contactPhone: string;
  creditLimit: string;
  billingCycle: string;
}

const emptyForm: CorpForm = {
  nameAr: '',
  vatNumber: '',
  contactName: '',
  contactPhone: '',
  creditLimit: '',
  billingCycle: 'monthly',
};

function CompanyRow({ company, token }: { company: any; token: string | null }) {
  const [expanded, setExpanded] = useState(false);

  const { data: detailData } = useQuery({
    queryKey: ['corporate-detail', company.id],
    queryFn: async () => {
      const [membersRes, bookingsRes] = await Promise.all([
        axios.get(`/api/corporate/${company.id}/members`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`/api/corporate/${company.id}/bookings`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      return { members: membersRes.data, bookings: bookingsRes.data };
    },
    enabled: expanded && !!token,
  });

  const members: any[] = detailData?.members?.members ?? detailData?.members ?? [];
  const bookings: any[] = detailData?.bookings?.bookings ?? detailData?.bookings ?? [];

  return (
    <div className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden">
      <button
        className="w-full flex items-start gap-4 p-5 text-right hover:bg-slate-800/30 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4 text-blue-400 shrink-0" />
            <h3 className="text-white font-bold truncate">{company.nameAr}</h3>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-400">
            {company.contactName && (
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {company.contactName}
              </span>
            )}
            {company.contactPhone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {company.contactPhone}
              </span>
            )}
            {company.creditLimit !== undefined && (
              <span className="text-green-400 font-medium">
                الحد الائتماني: {Number(company.creditLimit).toLocaleString('ar-SA')} ريال
              </span>
            )}
          </div>
        </div>
        <div className="text-slate-400 shrink-0 mt-1">
          {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-slate-700/50"
          >
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Members */}
              <div>
                <h4 className="text-slate-300 font-semibold text-sm mb-3">الأعضاء</h4>
                {members.length === 0 ? (
                  <p className="text-slate-500 text-sm">لا يوجد أعضاء</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m: any) => (
                      <div key={m.id} className="flex items-center gap-2 bg-slate-800/40 rounded-xl px-3 py-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600/30 flex items-center justify-center text-blue-300 text-xs font-bold shrink-0">
                          {(m.nameAr ?? m.name ?? '؟').charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-white text-sm truncate">{m.nameAr ?? m.name ?? '—'}</p>
                          {m.phone && <p className="text-slate-500 text-xs">{m.phone}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Bookings */}
              <div>
                <h4 className="text-slate-300 font-semibold text-sm mb-3">آخر الحجوزات</h4>
                {bookings.length === 0 ? (
                  <p className="text-slate-500 text-sm">لا توجد حجوزات</p>
                ) : (
                  <div className="space-y-2">
                    {bookings.slice(0, 5).map((b: any) => (
                      <div key={b.id} className="flex items-center justify-between bg-slate-800/40 rounded-xl px-3 py-2">
                        <span className="text-slate-300 text-sm">{b.service?.nameAr ?? b.serviceName ?? `#${b.id}`}</span>
                        <div className="flex items-center gap-2">
                          {b.price && <span className="text-green-400 text-xs font-semibold">{b.price} ريال</span>}
                          {b.scheduledAt && (
                            <span className="text-slate-500 text-xs">
                              {new Date(b.scheduledAt).toLocaleDateString('ar-SA')}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function VendorCorporate() {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CorpForm>(emptyForm);

  const { data, isLoading } = useQuery({
    queryKey: ['corporate-accounts'],
    queryFn: async () => {
      const { data } = await axios.get('/api/corporate', {
        headers: { Authorization: `Bearer ${token}` },
      });
      return data;
    },
    enabled: !!token,
  });

  const companies: any[] = data?.companies ?? data ?? [];

  const createCompany = useMutation({
    mutationFn: (payload: any) =>
      axios.post('/api/corporate', payload, { headers: { Authorization: `Bearer ${token}` } }),
    onSuccess: () => {
      toast.success('تم إنشاء حساب الشركة');
      qc.invalidateQueries({ queryKey: ['corporate-accounts'] });
      setShowModal(false);
      setForm(emptyForm);
    },
    onError: () => toast.error('فشل إنشاء حساب الشركة'),
  });

  const handleSubmit = () => {
    createCompany.mutate({
      nameAr: form.nameAr,
      vatNumber: form.vatNumber,
      contactName: form.contactName,
      contactPhone: form.contactPhone,
      creditLimit: Number(form.creditLimit),
      billingCycle: form.billingCycle,
    });
  };

  return (
    <div className="min-h-screen bg-surface-1 text-white" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-xl">
              <Building2 className="w-6 h-6 text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">الحسابات المؤسسية</h1>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl transition-colors text-sm"
          >
            <Plus className="w-4 h-4" />
            حساب شركة
          </button>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-slate-900/80 border border-slate-700/50 rounded-2xl h-20 animate-pulse" />
            ))}
          </div>
        ) : companies.length === 0 ? (
          <div className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-12 text-center">
            <Building2 className="w-10 h-10 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">لا توجد حسابات مؤسسية بعد</p>
          </div>
        ) : (
          <div className="space-y-4">
            {companies.map((company) => (
              <CompanyRow key={company.id} company={company} token={token} />
            ))}
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <motion.div
              className="relative z-10 bg-slate-900 border border-slate-700/50 rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              dir="rtl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">حساب شركة جديد</h2>
                <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                {[
                  { key: 'nameAr', label: 'اسم الشركة', placeholder: 'مثال: شركة النخبة' },
                  { key: 'vatNumber', label: 'الرقم الضريبي', placeholder: '3XXXXXXXXXXXXXXX3' },
                  { key: 'contactName', label: 'اسم جهة الاتصال', placeholder: 'محمد الأحمد' },
                  { key: 'contactPhone', label: 'رقم الجوال', placeholder: '05XXXXXXXX' },
                  { key: 'creditLimit', label: 'الحد الائتماني (ريال)', placeholder: '5000', type: 'number' },
                ].map(({ key, label, placeholder, type }) => (
                  <div key={key}>
                    <label className="text-slate-400 text-sm block mb-1">{label}</label>
                    <input
                      type={type ?? 'text'}
                      className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none text-sm"
                      placeholder={placeholder}
                      value={form[key as keyof CorpForm]}
                      onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    />
                  </div>
                ))}

                <div>
                  <label className="text-slate-400 text-sm block mb-1">دورة الفوترة</label>
                  <select
                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none text-sm"
                    value={form.billingCycle}
                    onChange={(e) => setForm((f) => ({ ...f, billingCycle: e.target.value }))}
                  >
                    <option value="monthly">شهري</option>
                    <option value="quarterly">ربع سنوي</option>
                    <option value="yearly">سنوي</option>
                  </select>
                </div>

                <button
                  onClick={handleSubmit}
                  disabled={createCompany.isPending || !form.nameAr}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors mt-2"
                >
                  {createCompany.isPending ? 'جارٍ الإنشاء...' : 'إنشاء الحساب'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
