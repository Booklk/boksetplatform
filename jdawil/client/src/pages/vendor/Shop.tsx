import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, Plus, Edit2, Trash2, Package, X, Check } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';

const CATEGORIES = [
  { value: 'general', label: 'عام', icon: '📦' },
  { value: 'care', label: 'عناية السيارة', icon: '🧴' },
  { value: 'fragrance', label: 'معطرات', icon: '🌸' },
  { value: 'accessories', label: 'إكسسوارات', icon: '🔧' },
  { value: 'cleaning', label: 'مستلزمات التنظيف', icon: '🧹' },
];

const emptyForm = { name: '', description: '', price: 0, stock: 0, category: 'general', imageUrl: '' };

export default function Shop() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);
  const [activeCategory, setActiveCategory] = useState('all');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['shop-products'],
    queryFn: () => api.get('/shop/products').then(r => r.data),
  });

  const create = useMutation({
    mutationFn: (d: typeof form) => api.post('/shop/products', d).then(r => r.data),
    onSuccess: () => { toast.success('تم إضافة المنتج ✓'); qc.invalidateQueries({ queryKey: ['shop-products'] }); closeForm(); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ'),
  });

  const update = useMutation({
    mutationFn: ({ id, d }: { id: number; d: Partial<typeof form> }) => api.put(`/shop/products/${id}`, d).then(r => r.data),
    onSuccess: () => { toast.success('تم التحديث ✓'); qc.invalidateQueries({ queryKey: ['shop-products'] }); closeForm(); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'خطأ'),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api.delete(`/shop/products/${id}`).then(r => r.data),
    onSuccess: () => { toast.success('تم الحذف'); qc.invalidateQueries({ queryKey: ['shop-products'] }); },
    onError: () => toast.error('خطأ في الحذف'),
  });

  function openEdit(p: any) {
    setEditProduct(p);
    setForm({ name: p.name, description: p.description ?? '', price: Number(p.price), stock: p.stock, category: p.category, imageUrl: p.imageUrl ?? '' });
    setShowForm(true);
  }

  function closeForm() { setShowForm(false); setEditProduct(null); setForm(emptyForm); }

  function submit() {
    if (editProduct) update.mutate({ id: editProduct.id, d: form });
    else create.mutate(form);
  }

  const filtered = activeCategory === 'all' ? products : products.filter((p: any) => p.category === activeCategory);
  const totalValue = products.filter((p: any) => p.isActive).reduce((s: number, p: any) => s + Number(p.price) * p.stock, 0);

  return (
    <div className="min-h-screen bg-[#0a0f1e] p-4 sm:p-6 lg:p-8 text-white" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-3">
              <ShoppingBag className="w-7 h-7 text-purple-400" />
              متجر المنتجات
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {products.filter((p: any) => p.isActive).length} منتج نشط · قيمة المخزون: <span className="text-purple-400 font-bold">{totalValue.toFixed(0)} ر.س</span>
            </p>
            <p className="text-slate-500 text-xs mt-0.5">المنتجات تُوصَّل مع الغسلة — العميل يختارها عند الحجز</p>
          </div>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.97 }}
            onClick={() => { closeForm(); setShowForm(true); }}
            className="flex items-center gap-2 bg-purple-500 hover:bg-purple-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm shadow-lg shadow-purple-500/20"
          >
            <Plus size={16} /> منتج جديد
          </motion.button>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          <button onClick={() => setActiveCategory('all')}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${activeCategory === 'all' ? 'bg-purple-500/30 border-purple-500/60 text-purple-300 font-bold' : 'bg-white/5 border-white/10 text-slate-400'}`}>
            الكل ({products.filter((p: any) => p.isActive).length})
          </button>
          {CATEGORIES.map(c => {
            const count = products.filter((p: any) => p.category === c.value && p.isActive).length;
            if (count === 0) return null;
            return (
              <button key={c.value} onClick={() => setActiveCategory(c.value)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-all ${activeCategory === c.value ? 'bg-purple-500/30 border-purple-500/60 text-purple-300 font-bold' : 'bg-white/5 border-white/10 text-slate-400'}`}>
                {c.icon} {c.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Product form */}
        <AnimatePresence>
          {showForm && (
            <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{editProduct ? 'تعديل المنتج' : 'إضافة منتج جديد'}</h2>
                <button onClick={closeForm}><X size={20} className="text-slate-400 hover:text-white" /></button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">اسم المنتج</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="مثال: شمع حماية سيراميك"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">السعر (ر.س)</label>
                  <input type="number" min={0} step={0.5} value={form.price} onChange={e => setForm(f => ({ ...f, price: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">الكمية في المخزون</label>
                  <input type="number" min={0} value={form.stock} onChange={e => setForm(f => ({ ...f, stock: Number(e.target.value) }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500/50 text-sm" />
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">الفئة</label>
                  <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                    className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none text-sm">
                    {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">رابط الصورة (اختياري)</label>
                  <input value={form.imageUrl} onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none text-sm" />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-slate-400 text-xs font-bold uppercase mb-1.5 block">الوصف (اختياري)</label>
                  <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    rows={2} placeholder="وصف مختصر للمنتج..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none text-sm resize-none" />
                </div>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={closeForm} className="px-5 py-2.5 rounded-xl bg-white/10 text-slate-300 text-sm font-bold">إلغاء</button>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={submit} disabled={create.isPending || update.isPending || !form.name}
                  className="flex items-center gap-2 bg-purple-500 hover:bg-purple-400 disabled:opacity-50 text-white font-bold px-6 py-2.5 rounded-xl text-sm"
                >
                  <Check size={15} />
                  {editProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Products grid */}
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-40 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
        ) : filtered.filter((p: any) => p.isActive).length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <ShoppingBag size={40} className="mx-auto mb-3 opacity-30" />
            <p>لا توجد منتجات — أضف أول منتج للمتجر</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {filtered.filter((p: any) => p.isActive).map((p: any) => (
              <motion.div key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden group"
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="w-full h-32 object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                ) : (
                  <div className="w-full h-32 bg-white/5 flex items-center justify-center">
                    <Package size={32} className="text-slate-600" />
                  </div>
                )}
                <div className="p-3">
                  <p className="text-white font-bold text-sm line-clamp-1">{p.name}</p>
                  <p className="text-slate-400 text-xs line-clamp-1 mt-0.5">{CATEGORIES.find(c => c.value === p.category)?.label}</p>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-purple-400 font-black text-sm">{Number(p.price).toFixed(0)} ر.س</span>
                    <span className={`text-xs ${p.stock <= 3 ? 'text-red-400' : 'text-slate-400'}`}>
                      {p.stock <= 0 ? 'نفد' : `${p.stock} متبقٍ`}
                    </span>
                  </div>
                  <div className="flex gap-1.5 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)} className="flex-1 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-xs flex items-center justify-center gap-1 text-slate-300">
                      <Edit2 size={11} /> تعديل
                    </button>
                    <button onClick={() => { if (confirm('حذف المنتج؟')) remove.mutate(p.id); }}
                      className="py-1 px-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-xs text-red-400">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
