import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Upload, ChevronDown, ChevronUp, CheckCircle, Wand2 } from 'lucide-react';
import api from '../../lib/api';
import { Service } from '../../types';
import { formatCurrency } from '../../lib/utils';

export default function AdminServices() {
  const queryClient = useQueryClient();
  const [expandedService, setExpandedService] = useState<number | null>(null);
  const [showAddService, setShowAddService] = useState(false);
  const [showAddPackage, setShowAddPackage] = useState<number | null>(null);
  const [editService, setEditService] = useState<Service | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [newService, setNewService] = useState({ name: '', description: '', imageUrl: '' });
  const [newPackage, setNewPackage] = useState({ name: '', price: '', duration: 30, features: '' });

  const { data: services = [], isLoading } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  const { mutate: createService, isPending: creatingService } = useMutation({
    mutationFn: () => api.post('/services', newService).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('تم إضافة الخدمة');
      setShowAddService(false);
      setNewService({ name: '', description: '', imageUrl: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الإضافة'),
  });

  const { mutate: updateService } = useMutation({
    mutationFn: (data: { id: number; body: any }) => api.put(`/services/${data.id}`, data.body).then(r => r.data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services'] }); toast.success('تم التحديث'); setEditService(null); },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في التحديث'),
  });

  const { mutate: deleteService } = useMutation({
    mutationFn: (id: number) => api.delete(`/services/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['services'] }); toast.success('تم الحذف'); },
    onError: () => toast.error('فشل في الحذف'),
  });

  const { mutate: createPackage, isPending: creatingPackage } = useMutation({
    mutationFn: (serviceId: number) => api.post(`/services/${serviceId}/packages`, {
      name: newPackage.name,
      price: newPackage.price,
      duration: newPackage.duration,
      features: newPackage.features.split('\n').map(f => f.trim()).filter(Boolean),
    }).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
      toast.success('تم إضافة الباقة');
      setShowAddPackage(null);
      setNewPackage({ name: '', price: '', duration: 30, features: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الإضافة'),
  });

  async function generateImage(name: string, onDone: (url: string) => void) {
    if (!name.trim()) { toast.error('أدخل اسم الخدمة أولاً'); return; }
    setGenerating(true);
    try {
      const { data } = await api.get(`/services/suggest-image?q=${encodeURIComponent(name)}`);
      onDone(data.url);
      toast.success('تم توليد الصورة ✨');
    } catch {
      toast.error('فشل في توليد الصورة');
    } finally {
      setGenerating(false);
    }
  }

  async function uploadImage(file: File, onDone: (url: string) => void) {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/uploads/image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      onDone(data.url);
      toast.success('تم رفع الصورة');
    } catch {
      toast.error('فشل في رفع الصورة');
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return <div className="p-4 text-center text-slate-400">جاري التحميل...</div>;

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-white">الخدمات والباقات</h1>
        <button onClick={() => setShowAddService(true)} className="btn-primary text-sm py-2.5 flex items-center gap-2">
          <Plus size={16} /> خدمة جديدة
        </button>
      </div>

      {/* Add Service Form */}
      <AnimatePresence>
        {showAddService && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="card border-brand-600/40"
          >
            <h3 className="font-black text-white mb-4">إضافة خدمة جديدة</h3>
            <div className="space-y-3">
              <div>
                <label className="label">اسم الخدمة *</label>
                <input type="text" value={newService.name} onChange={e => setNewService(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="مثال: غسيل خارجي" />
              </div>
              <div>
                <label className="label">الوصف</label>
                <textarea value={newService.description} onChange={e => setNewService(f => ({ ...f, description: e.target.value }))} className="input-field h-20 resize-none" placeholder="وصف الخدمة..." />
              </div>
              <div>
                <label className="label">صورة الخدمة</label>
                <div className="flex gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="service-image"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) uploadImage(file, (url) => setNewService(f => ({ ...f, imageUrl: url })));
                    }}
                  />
                  <label
                    htmlFor="service-image"
                    className={`btn-outline cursor-pointer flex items-center gap-2 text-sm py-2 ${uploading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <Upload size={14} /> {uploading ? 'جاري الرفع...' : 'رفع صورة'}
                  </label>
                  <button
                    type="button"
                    onClick={() => generateImage(newService.name, (url) => setNewService(f => ({ ...f, imageUrl: url })))}
                    disabled={generating || !newService.name}
                    className="flex items-center gap-2 text-sm py-2 px-3 rounded-xl bg-violet-600/20 border border-violet-500/30 text-violet-300 hover:bg-violet-600/30 transition-all disabled:opacity-40"
                  >
                    <Wand2 size={14} className={generating ? 'animate-spin' : ''} />
                    {generating ? 'جاري التوليد...' : 'توليد تلقائي ✨'}
                  </button>
                  {newService.imageUrl && (
                    <img src={newService.imageUrl} alt="" className="h-10 w-16 object-cover rounded-lg" />
                  )}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowAddService(false)} className="btn-outline flex-1 text-sm">إلغاء</button>
                <button onClick={() => createService()} disabled={creatingService || !newService.name} className="btn-primary flex-1 text-sm">
                  {creatingService ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Services List */}
      <div className="space-y-4">
        {services.map(svc => (
          <div key={svc.id} className="card">
            {/* Service Header */}
            <div className="flex items-start gap-4 mb-3">
              {svc.imageUrl && (
                <img src={svc.imageUrl} alt={svc.name} className="w-20 h-14 object-cover rounded-xl shrink-0" />
              )}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-black text-white text-lg">{svc.name}</h3>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditService(svc)} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-400 hover:text-white transition-colors">
                      <Edit size={14} />
                    </button>
                    <button
                      onClick={() => { if (confirm('هل أنت متأكد من حذف هذه الخدمة؟')) deleteService(svc.id); }}
                      className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 text-red-400 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                    <button onClick={() => setExpandedService(expandedService === svc.id ? null : svc.id)} className="p-2 rounded-lg bg-slate-700 text-slate-400">
                      {expandedService === svc.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>
                {svc.description && <p className="text-slate-400 text-sm mt-1">{svc.description}</p>}
                <p className="text-xs text-slate-500 mt-1">{svc.packages.length} باقة</p>
              </div>
            </div>

            {/* Edit Service inline */}
            <AnimatePresence>
              {editService?.id === svc.id && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="bg-slate-700/40 rounded-xl p-4 mb-3 space-y-3">
                  <div>
                    <label className="label text-xs">اسم الخدمة</label>
                    <input type="text" value={editService.name} onChange={e => setEditService(s => s ? { ...s, name: e.target.value } : s)} className="input-field text-sm py-2" />
                  </div>
                  <div>
                    <label className="label text-xs">الوصف</label>
                    <textarea value={editService.description ?? ''} onChange={e => setEditService(s => s ? { ...s, description: e.target.value } : s)} className="input-field h-16 resize-none text-sm py-2" />
                  </div>
                  <div>
                    <label className="label text-xs">صورة</label>
                    <div className="flex gap-3 items-center">
                      <input type="file" accept="image/*" id={`edit-img-${svc.id}`} className="hidden"
                        onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f, url => setEditService(s => s ? { ...s, imageUrl: url } : s)); }}
                      />
                      <label htmlFor={`edit-img-${svc.id}`} className="btn-outline text-xs py-1.5 px-3 cursor-pointer">رفع صورة</label>
                      {editService.imageUrl && <img src={editService.imageUrl} alt="" className="h-10 w-16 object-cover rounded-lg" />}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setEditService(null)} className="btn-outline flex-1 text-sm py-2">إلغاء</button>
                    <button
                      onClick={() => updateService({ id: editService.id, body: { name: editService.name, description: editService.description, imageUrl: editService.imageUrl } })}
                      className="btn-primary flex-1 text-sm py-2"
                    >حفظ</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Packages */}
            <AnimatePresence>
              {expandedService === svc.id && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="border-t border-slate-700 pt-4"
                >
                  <div className="space-y-3 mb-4">
                    {svc.packages.map(pkg => (
                      <div key={pkg.id} className="bg-slate-700/40 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-bold text-white">{pkg.name}</h4>
                          <div className="flex items-center gap-2">
                            <span className="font-black gradient-text">{formatCurrency(pkg.price)}</span>
                            <span className="text-xs text-slate-400">{pkg.duration} د</span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {pkg.features.map(f => (
                            <span key={f} className="flex items-center gap-1 text-xs text-slate-300 bg-slate-600/50 rounded-lg px-2 py-1">
                              <CheckCircle size={10} className="text-green-400" /> {f}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Package */}
                  {showAddPackage === svc.id ? (
                    <div className="bg-slate-700/40 rounded-xl p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="label text-xs">اسم الباقة *</label>
                          <input type="text" value={newPackage.name} onChange={e => setNewPackage(f => ({ ...f, name: e.target.value }))} className="input-field text-sm py-2" placeholder="مثال: VIP" />
                        </div>
                        <div>
                          <label className="label text-xs">السعر (ريال) *</label>
                          <input type="number" value={newPackage.price} onChange={e => setNewPackage(f => ({ ...f, price: e.target.value }))} className="input-field text-sm py-2" placeholder="0" />
                        </div>
                        <div>
                          <label className="label text-xs">المدة (دقيقة)</label>
                          <input type="number" value={newPackage.duration} onChange={e => setNewPackage(f => ({ ...f, duration: Number(e.target.value) }))} className="input-field text-sm py-2" />
                        </div>
                      </div>
                      <div>
                        <label className="label text-xs">المميزات (كل ميزة في سطر)</label>
                        <textarea value={newPackage.features} onChange={e => setNewPackage(f => ({ ...f, features: e.target.value }))} className="input-field h-20 resize-none text-sm" placeholder="غسيل خارجي&#10;تجفيف&#10;تلميع زجاج" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => setShowAddPackage(null)} className="btn-outline flex-1 text-sm py-2">إلغاء</button>
                        <button
                          onClick={() => createPackage(svc.id)}
                          disabled={creatingPackage || !newPackage.name || !newPackage.price}
                          className="btn-primary flex-1 text-sm py-2"
                        >
                          {creatingPackage ? 'جاري الحفظ...' : 'حفظ الباقة'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowAddPackage(svc.id)}
                      className="w-full py-3 border-2 border-dashed border-slate-600 rounded-xl text-slate-400 hover:border-brand-600 hover:text-brand-400 transition-colors text-sm font-semibold flex items-center justify-center gap-2"
                    >
                      <Plus size={14} /> إضافة باقة
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {services.length === 0 && (
          <div className="card text-center py-16 text-slate-400">
            <div className="text-4xl mb-3">🧹</div>
            <p>لا توجد خدمات بعد</p>
            <button onClick={() => setShowAddService(true)} className="btn-primary text-sm mt-4 px-6">إضافة أول خدمة</button>
          </div>
        )}
      </div>
    </div>
  );
}
