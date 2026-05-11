import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, ArrowUp, ArrowDown, RotateCcw, AlertTriangle } from 'lucide-react';
import api from '../../lib/api';
import { InventoryItem } from '../../types';
import { formatDate } from '../../lib/utils';

interface Supplier {
  id: number;
  nameAr: string;
  phone: string;
  isActive: boolean;
}

export default function AdminInventory() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [transactionFor, setTransactionFor] = useState<InventoryItem | null>(null);
  const [txnData, setTxnData] = useState({ type: 'in' as 'in' | 'out' | 'adjustment', quantity: '', notes: '' });

  const [form, setForm] = useState({
    name: '', unit: 'لتر', quantity: '0', minQuantity: '0', costPerUnit: '0', supplier: '', notes: '', supplierId: '' as string | number,
  });

  const { data: items = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });

  const { data: supplierList = [] } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const { mutate: createItem, isPending: creating } = useMutation({
    mutationFn: () => api.post('/inventory', form).then(r => r.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('تم إضافة المنتج');
      setShowAdd(false);
      setForm({ name: '', unit: 'لتر', quantity: '0', minQuantity: '0', costPerUnit: '0', supplier: '', notes: '', supplierId: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الإضافة'),
  });

  const { mutate: doTransaction, isPending: txnLoading } = useMutation({
    mutationFn: () => api.post(`/inventory/${transactionFor!.id}/transaction`, txnData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('تم تحديث الكمية');
      setTransactionFor(null);
      setTxnData({ type: 'in', quantity: '', notes: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في التحديث'),
  });

  const lowStock = items.filter(i => parseFloat(i.quantity) <= parseFloat(i.minQuantity));

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">إدارة المخزون</h1>
          {lowStock.length > 0 && (
            <p className="text-yellow-400 text-sm flex items-center gap-1 mt-1">
              <AlertTriangle size={14} /> {lowStock.length} منتج بحاجة إعادة توريد
            </p>
          )}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn-primary text-sm py-2.5 flex items-center gap-2">
          <Plus size={16} /> منتج جديد
        </button>
      </div>

      {/* Add Item */}
      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="card border-brand-600/40">
            <h3 className="font-black text-white mb-4">إضافة منتج جديد</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">اسم المنتج *</label>
                <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="مثال: شامبو سيارات" />
              </div>
              <div>
                <label className="label">وحدة القياس *</label>
                <select value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))} className="input-field">
                  {['لتر', 'كيلو', 'قطعة', 'زجاجة', 'علبة', 'رول'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div>
                <label className="label">الكمية الحالية</label>
                <input type="number" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="label">الحد الأدنى</label>
                <input type="number" value={form.minQuantity} onChange={e => setForm(f => ({ ...f, minQuantity: e.target.value }))} className="input-field" />
              </div>
              <div>
                <label className="label">سعر الوحدة (ريال)</label>
                <input type="number" value={form.costPerUnit} onChange={e => setForm(f => ({ ...f, costPerUnit: e.target.value }))} className="input-field" />
              </div>
              <div className="col-span-2">
                <label className="label">المورد (نصي)</label>
                <input type="text" value={form.supplier} onChange={e => setForm(f => ({ ...f, supplier: e.target.value }))} className="input-field" placeholder="اسم المورد" />
              </div>
              {supplierList.length > 0 && (
                <div className="col-span-2">
                  <label className="label">ربط بمورد مسجّل (للإشعار التلقائي)</label>
                  <select value={String(form.supplierId)} onChange={e => setForm(f => ({ ...f, supplierId: e.target.value ? Number(e.target.value) : '' }))} className="input-field">
                    <option value="">— بدون ربط —</option>
                    {supplierList.filter(s => s.isActive).map(s => (
                      <option key={s.id} value={s.id}>{s.nameAr}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowAdd(false)} className="btn-outline flex-1 text-sm">إلغاء</button>
              <button onClick={() => createItem()} disabled={creating || !form.name} className="btn-primary flex-1 text-sm">
                {creating ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transaction Modal */}
      <AnimatePresence>
        {transactionFor && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="card w-full max-w-md" dir="rtl">
              <h3 className="font-black text-white mb-1">تحديث الكمية</h3>
              <p className="text-slate-400 text-sm mb-4">{transactionFor.name} — الكمية الحالية: {transactionFor.quantity} {transactionFor.unit}</p>

              <div className="flex gap-2 mb-4">
                {[
                  { type: 'in' as const, label: 'إضافة', icon: <ArrowUp size={14} />, color: 'bg-green-700' },
                  { type: 'out' as const, label: 'سحب', icon: <ArrowDown size={14} />, color: 'bg-red-700' },
                  { type: 'adjustment' as const, label: 'تعديل', icon: <RotateCcw size={14} />, color: 'bg-blue-700' },
                ].map(t => (
                  <button
                    key={t.type}
                    onClick={() => setTxnData(f => ({ ...f, type: t.type }))}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl font-bold text-sm text-white transition-opacity ${t.color} ${txnData.type === t.type ? 'opacity-100' : 'opacity-40'}`}
                  >
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                <div>
                  <label className="label">الكمية ({transactionFor.unit})</label>
                  <input
                    type="number"
                    value={txnData.quantity}
                    onChange={e => setTxnData(f => ({ ...f, quantity: e.target.value }))}
                    className="input-field"
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">ملاحظات</label>
                  <input type="text" value={txnData.notes} onChange={e => setTxnData(f => ({ ...f, notes: e.target.value }))} className="input-field" placeholder="سبب التحديث..." />
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <button onClick={() => setTransactionFor(null)} className="btn-outline flex-1 text-sm">إلغاء</button>
                <button
                  onClick={() => doTransaction()}
                  disabled={txnLoading || !txnData.quantity}
                  className="btn-primary flex-1 text-sm"
                >
                  {txnLoading ? 'جاري التحديث...' : 'حفظ'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Inventory List */}
      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card animate-pulse h-16" />)}</div>
      ) : (
        <div className="space-y-3">
          {items.map((item, i) => {
            const isLow = parseFloat(item.quantity) <= parseFloat(item.minQuantity);
            return (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`card ${isLow ? 'border-yellow-600/40 bg-yellow-900/10' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-white">{item.name}</h3>
                      {isLow && <AlertTriangle size={14} className="text-yellow-400" />}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                      <span className={`font-bold ${isLow ? 'text-yellow-400' : 'text-slate-200'}`}>
                        {item.quantity} {item.unit}
                      </span>
                      <span>الحد الأدنى: {item.minQuantity}</span>
                      <span>تكلفة: {item.costPerUnit} ريال/{item.unit}</span>
                    </div>
                    {item.supplier && <p className="text-xs text-slate-500 mt-0.5">المورد: {item.supplier}</p>}
                    {isLow && (item as any).supplierId && (
                      <span className="inline-block mt-1 text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full font-bold">
                        مخزون منخفض — تم إشعار المورد
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => setTransactionFor(item)}
                    className="btn-primary text-sm py-2 px-4 shrink-0"
                  >
                    تحديث
                  </button>
                </div>
              </motion.div>
            );
          })}

          {items.length === 0 && (
            <div className="card text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📦</div>
              <p>لا توجد مواد في المخزون</p>
              <button onClick={() => setShowAdd(true)} className="btn-primary text-sm mt-4 px-6">إضافة منتج</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
