import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Plus, Phone, Package, CheckCircle, XCircle, RefreshCw, Send } from 'lucide-react';
import api from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Supplier {
  id: number;
  nameAr: string;
  phone: string;
  email?: string | null;
  contactPerson?: string | null;
  products?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: string;
}

interface SupplierOrder {
  id: number;
  supplierId: number;
  inventoryItemId?: number | null;
  itemName: string;
  quantityRequested: string;
  unit: string;
  status: 'sent' | 'confirmed' | 'received' | 'cancelled';
  notes?: string | null;
  sentAt?: string | null;
  receivedAt?: string | null;
  whatsappSent: boolean;
  createdAt: string;
  supplier?: {
    id: number;
    nameAr: string;
    phone: string;
    contactPerson?: string | null;
  } | null;
}

interface InventoryItem {
  id: number;
  name: string;
  unit: string;
  quantity: string;
  minQuantity: string;
  supplierId?: number | null;
  autoReorderEnabled?: boolean;
}

// ─── Status badges ─────────────────────────────────────────────────────────

const statusLabels: Record<string, string> = {
  sent: 'مُرسل',
  confirmed: 'مؤكد',
  received: 'مُستلم',
  cancelled: 'ملغي',
};
const statusColors: Record<string, string> = {
  sent: 'bg-blue-500/20 text-blue-300',
  confirmed: 'bg-yellow-500/20 text-yellow-300',
  received: 'bg-green-500/20 text-green-300',
  cancelled: 'bg-red-500/20 text-red-300',
};

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VendorSuppliers() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'suppliers' | 'orders'>('suppliers');

  // ─── Auto-reorder master toggle ────────────────────────────────────────────
  const [autoReorderEnabled, setAutoReorderEnabled] = useState(false);

  useEffect(() => {
    api.get('/vendors/me').then(r => setAutoReorderEnabled(r.data?.autoReorderEnabled ?? false)).catch(() => {});
  }, []);

  const toggleAutoReorder = async () => {
    const next = !autoReorderEnabled;
    try {
      await api.patch('/suppliers/auto-reorder-toggle', { enabled: next });
      setAutoReorderEnabled(next);
      toast.success(next ? '✅ تم تفعيل الطلب التلقائي' : '⏸️ تم إيقاف الطلب التلقائي');
    } catch {
      toast.error('فشل في تغيير الإعداد');
    }
  };

  // ─── Suppliers state ───────────────────────────────────────────────────────
  const [showAddSupplier, setShowAddSupplier] = useState(false);
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [supplierForm, setSupplierForm] = useState({
    nameAr: '', phone: '', email: '', contactPerson: '', products: '', notes: '',
  });

  // ─── Orders state ──────────────────────────────────────────────────────────
  const [statusFilter, setStatusFilter] = useState('all');
  const [showOrderModal, setShowOrderModal] = useState(false);
  const [orderForm, setOrderForm] = useState({
    supplierId: '', inventoryItemId: '', itemName: '', quantityRequested: '', unit: 'وحدة', notes: '',
  });

  // ─── Queries ───────────────────────────────────────────────────────────────
  const { data: supplierList = [], isLoading: suppliersLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => api.get('/suppliers').then(r => r.data),
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery<SupplierOrder[]>({
    queryKey: ['supplier-orders', statusFilter],
    queryFn: () => api.get('/suppliers/orders', { params: { status: statusFilter } }).then(r => r.data),
    enabled: tab === 'orders',
  });

  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then(r => r.data),
  });

  // ─── Mutations ─────────────────────────────────────────────────────────────

  const toggleItemAutoReorder = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      api.patch(`/suppliers/item/${id}/auto-reorder`, { enabled }).then(r => r.data),
    onSuccess: (_data, variables) => {
      qc.setQueryData<InventoryItem[]>(['inventory'], (old = []) =>
        old.map(item => item.id === variables.id ? { ...item, autoReorderEnabled: variables.enabled } : item)
      );
      toast.success(variables.enabled ? '✅ تم تفعيل الطلب التلقائي للصنف' : '⏸️ تم إيقاف الطلب التلقائي للصنف');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل'),
  });

  const createSupplier = useMutation({
    mutationFn: (data: typeof supplierForm) => api.post('/suppliers', data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('تم إضافة المورد');
      setShowAddSupplier(false);
      resetSupplierForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الإضافة'),
  });

  const updateSupplier = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<typeof supplierForm> & { isActive?: boolean } }) =>
      api.put(`/suppliers/${id}`, data).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('تم تحديث المورد');
      setEditSupplier(null);
      resetSupplierForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في التحديث'),
  });

  const deactivateSupplier = useMutation({
    mutationFn: (id: number) => api.put(`/suppliers/${id}`, { isActive: false }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      toast.success('تم تعطيل المورد');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل'),
  });

  const createOrder = useMutation({
    mutationFn: (data: typeof orderForm) =>
      api.post('/suppliers/orders', {
        ...data,
        supplierId: Number(data.supplierId),
        inventoryItemId: data.inventoryItemId ? Number(data.inventoryItemId) : null,
        quantityRequested: data.quantityRequested,
      }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-orders'] });
      toast.success('تم إرسال الطلب عبر واتساب');
      setShowOrderModal(false);
      setOrderForm({ supplierId: '', inventoryItemId: '', itemName: '', quantityRequested: '', unit: 'وحدة', notes: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في إرسال الطلب'),
  });

  const updateOrderStatus = useMutation({
    mutationFn: ({ id, status }: { id: number; status: string }) =>
      api.put(`/suppliers/orders/${id}/status`, { status }).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['supplier-orders'] });
      qc.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('تم تحديث حالة الطلب');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل'),
  });

  const checkReorder = useMutation({
    mutationFn: () => api.post('/suppliers/check-reorder').then(r => r.data),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['supplier-orders'] });
      if (data.ordersCreated === 0) {
        toast.success('لا توجد مواد تحتاج إعادة توريد حالياً');
      } else {
        toast.success(`تم إرسال ${data.ordersCreated} طلب توريد: ${data.items.join('، ')}`);
      }
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل'),
  });

  // ─── Helpers ───────────────────────────────────────────────────────────────

  function resetSupplierForm() {
    setSupplierForm({ nameAr: '', phone: '', email: '', contactPerson: '', products: '', notes: '' });
  }

  function openEditSupplier(s: Supplier) {
    setEditSupplier(s);
    setSupplierForm({
      nameAr: s.nameAr,
      phone: s.phone,
      email: s.email ?? '',
      contactPerson: s.contactPerson ?? '',
      products: s.products ?? '',
      notes: s.notes ?? '',
    });
    setShowAddSupplier(true);
  }

  function handleInventoryChange(itemId: string) {
    const item = inventoryItems.find(i => String(i.id) === itemId);
    setOrderForm(f => ({
      ...f,
      inventoryItemId: itemId,
      itemName: item?.name ?? f.itemName,
      unit: item?.unit ?? f.unit,
    }));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-black text-white">إدارة الموردين</h1>
          <p className="text-slate-400 text-sm mt-1">إدارة الموردين وطلبات التوريد التلقائية</p>
        </div>
        {tab === 'suppliers' && (
          <button onClick={() => { setEditSupplier(null); resetSupplierForm(); setShowAddSupplier(true); }}
            className="btn-primary text-sm py-2.5 flex items-center gap-2">
            <Plus size={16} /> إضافة مورد
          </button>
        )}
        {tab === 'orders' && (
          <div className="flex gap-2">
            <button onClick={() => checkReorder.mutate()} disabled={checkReorder.isPending}
              className="btn-outline text-sm py-2.5 flex items-center gap-2">
              <RefreshCw size={15} className={checkReorder.isPending ? 'animate-spin' : ''} />
              فحص المخزون الآن
            </button>
            <button onClick={() => setShowOrderModal(true)}
              className="btn-primary text-sm py-2.5 flex items-center gap-2">
              <Send size={15} /> طلب يدوي
            </button>
          </div>
        )}
      </div>

      {/* Auto-reorder master toggle */}
      <div className={`rounded-2xl border p-5 flex items-center justify-between transition-all ${
        autoReorderEnabled
          ? 'border-emerald-500/30 bg-emerald-950/20'
          : 'border-white/10 bg-white/5'
      }`}>
        <div>
          <div className="text-white font-bold text-base flex items-center gap-2">
            <span>🤖</span> الطلب التلقائي من الموردين
          </div>
          <div className="text-slate-400 text-sm mt-1">
            {autoReorderEnabled
              ? 'مفعّل — النظام يراسل الموردين تلقائياً عند انخفاض المخزون'
              : 'موقوف — يمكنك إرسال الطلبات يدوياً'}
          </div>
        </div>
        <button
          onClick={toggleAutoReorder}
          className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
            autoReorderEnabled ? 'bg-emerald-500' : 'bg-slate-600'
          }`}
        >
          <motion.div
            animate={{ x: autoReorderEnabled ? 28 : 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            className="absolute top-1 w-5 h-5 bg-white rounded-full shadow"
          />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800/60 p-1 rounded-xl w-fit">
        {([
          { id: 'suppliers', label: 'الموردون' },
          { id: 'orders', label: 'طلبات التوريد' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-all ${tab === t.id ? 'bg-brand-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Suppliers ───────────────────────────────────────────────── */}
      {tab === 'suppliers' && (
        <>
          {/* Add/Edit Supplier Form */}
          <AnimatePresence>
            {showAddSupplier && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }} className="card border-brand-600/40 overflow-hidden">
                <h3 className="font-black text-white mb-4">
                  {editSupplier ? 'تعديل المورد' : 'إضافة مورد جديد'}
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2 md:col-span-1">
                    <label className="label">اسم المورد *</label>
                    <input value={supplierForm.nameAr}
                      onChange={e => setSupplierForm(f => ({ ...f, nameAr: e.target.value }))}
                      className="input-field" placeholder="مثال: مستودع شمس للمنظفات" />
                  </div>
                  <div className="col-span-2 md:col-span-1">
                    <label className="label">رقم الجوال / واتساب *</label>
                    <input value={supplierForm.phone}
                      onChange={e => setSupplierForm(f => ({ ...f, phone: e.target.value }))}
                      className="input-field" placeholder="05xxxxxxxx" dir="ltr" />
                  </div>
                  <div>
                    <label className="label">اسم المندوب</label>
                    <input value={supplierForm.contactPerson}
                      onChange={e => setSupplierForm(f => ({ ...f, contactPerson: e.target.value }))}
                      className="input-field" placeholder="اسم المندوب أو المسؤول" />
                  </div>
                  <div>
                    <label className="label">البريد الإلكتروني</label>
                    <input value={supplierForm.email}
                      onChange={e => setSupplierForm(f => ({ ...f, email: e.target.value }))}
                      className="input-field" placeholder="email@example.com" dir="ltr" />
                  </div>
                  <div className="col-span-2">
                    <label className="label">المنتجات التي يوردها</label>
                    <textarea value={supplierForm.products}
                      onChange={e => setSupplierForm(f => ({ ...f, products: e.target.value }))}
                      className="input-field resize-none" rows={2}
                      placeholder="مثال: شامبو، واكس، إسفنج، مناشف..." />
                  </div>
                  <div className="col-span-2">
                    <label className="label">ملاحظات</label>
                    <input value={supplierForm.notes}
                      onChange={e => setSupplierForm(f => ({ ...f, notes: e.target.value }))}
                      className="input-field" placeholder="أي ملاحظات إضافية..." />
                  </div>
                </div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => { setShowAddSupplier(false); setEditSupplier(null); resetSupplierForm(); }}
                    className="btn-outline flex-1 text-sm">إلغاء</button>
                  <button
                    disabled={createSupplier.isPending || updateSupplier.isPending || !supplierForm.nameAr || !supplierForm.phone}
                    onClick={() => {
                      if (editSupplier) {
                        updateSupplier.mutate({ id: editSupplier.id, data: supplierForm });
                      } else {
                        createSupplier.mutate(supplierForm);
                      }
                    }}
                    className="btn-primary flex-1 text-sm">
                    {(createSupplier.isPending || updateSupplier.isPending) ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Suppliers List */}
          {suppliersLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-20" />)}</div>
          ) : supplierList.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">🏪</div>
              <p className="font-semibold">لا يوجد موردون بعد</p>
              <button onClick={() => setShowAddSupplier(true)} className="btn-primary text-sm mt-4 px-6">إضافة مورد</button>
            </div>
          ) : (
            <div className="space-y-3">
              {supplierList.map((s, i) => (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className={`card ${!s.isActive ? 'opacity-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-white">{s.nameAr}</h3>
                        {!s.isActive && (
                          <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded-full">معطّل</span>
                        )}
                      </div>
                      {s.contactPerson && (
                        <p className="text-sm text-slate-400 mt-0.5">المندوب: {s.contactPerson}</p>
                      )}
                      {s.products && (
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <Package size={11} /> {s.products}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 bg-green-700/20 hover:bg-green-700/40 text-green-400 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                        <Phone size={12} /> واتساب
                      </a>
                      <button onClick={() => openEditSupplier(s)}
                        className="btn-outline text-xs py-1.5 px-3">تعديل</button>
                      {s.isActive && (
                        <button onClick={() => deactivateSupplier.mutate(s.id)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1.5 rounded-lg hover:bg-red-500/10 transition-colors">
                          تعطيل
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* Per-item auto-reorder toggles */}
          {inventoryItems.filter(item => item.supplierId).length > 0 && (
            <div className="mt-6">
              <h3 className="text-white font-bold text-sm mb-3 flex items-center gap-2">
                <Package size={14} className="text-slate-400" />
                إعدادات الطلب التلقائي لكل صنف
              </h3>
              <div className="space-y-2">
                {inventoryItems.filter(item => item.supplierId).map(item => {
                  const linkedSupplier = supplierList.find(s => s.id === item.supplierId);
                  const isEnabled = item.autoReorderEnabled !== false;
                  return (
                    <div key={item.id} className="flex items-center justify-between bg-slate-800/40 rounded-xl px-4 py-3 border border-white/5">
                      <div className="flex-1 min-w-0">
                        <span className="text-white text-sm font-semibold">{item.name}</span>
                        {linkedSupplier && (
                          <span className="text-slate-500 text-xs mr-2">← {linkedSupplier.nameAr}</span>
                        )}
                        <div className="text-slate-500 text-xs mt-0.5">
                          المخزون: {item.quantity} {item.unit} / حد إعادة الطلب: {item.minQuantity}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleItemAutoReorder.mutate({ id: item.id, enabled: !isEnabled })}
                        disabled={toggleItemAutoReorder.isPending}
                        className="flex items-center gap-1.5 text-xs font-bold shrink-0 mr-3"
                      >
                        <div className={`relative w-10 h-5 rounded-full transition-all duration-300 ${isEnabled ? 'bg-emerald-500' : 'bg-slate-600'}`}>
                          <motion.div
                            animate={{ x: isEnabled ? 20 : 2 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                            className="absolute top-0.5 w-4 h-4 bg-white rounded-full shadow"
                          />
                        </div>
                        <span className={isEnabled ? 'text-emerald-400' : 'text-slate-500'}>
                          {isEnabled ? 'تلقائي ✅' : 'موقوف ❌'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: Orders ─────────────────────────────────────────────────── */}
      {tab === 'orders' && (
        <>
          {/* Status Filter */}
          <div className="flex gap-2 flex-wrap">
            {['all', 'sent', 'confirmed', 'received', 'cancelled'].map(s => (
              <button key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all border ${
                  statusFilter === s
                    ? 'bg-brand-600 border-brand-600 text-white'
                    : 'border-slate-700 text-slate-400 hover:border-slate-500'
                }`}>
                {s === 'all' ? 'الكل' : statusLabels[s]}
              </button>
            ))}
          </div>

          {/* Orders List */}
          {ordersLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card animate-pulse h-20" />)}</div>
          ) : orders.length === 0 ? (
            <div className="card text-center py-12 text-slate-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="font-semibold">لا توجد طلبات توريد</p>
            </div>
          ) : (
            <div className="space-y-3">
              {orders.map((order, i) => (
                <motion.div key={order.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }} className="card">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-black text-white">{order.itemName}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColors[order.status]}`}>
                          {statusLabels[order.status]}
                        </span>
                        {order.whatsappSent && (
                          <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded-full">✓ واتساب مُرسل</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-sm text-slate-400">
                        <span>المورد: <span className="text-slate-300">{order.supplier?.nameAr ?? '—'}</span></span>
                        <span>الكمية: <span className="text-slate-300 font-bold">{order.quantityRequested} {order.unit}</span></span>
                        <span>التاريخ: <span className="text-slate-300">{formatDate(order.sentAt)}</span></span>
                      </div>
                      {order.notes && <p className="text-xs text-slate-500 mt-1">{order.notes}</p>}
                    </div>
                    {/* Actions */}
                    {(order.status === 'sent' || order.status === 'confirmed') && (
                      <div className="flex gap-2 shrink-0">
                        {order.status === 'sent' && (
                          <button
                            onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'confirmed' })}
                            className="flex items-center gap-1.5 bg-yellow-700/20 hover:bg-yellow-700/40 text-yellow-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                            <CheckCircle size={13} /> تأكيد
                          </button>
                        )}
                        <button
                          onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'received' })}
                          className="flex items-center gap-1.5 bg-green-700/20 hover:bg-green-700/40 text-green-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                          <CheckCircle size={13} /> تم الاستلام
                        </button>
                        <button
                          onClick={() => updateOrderStatus.mutate({ id: order.id, status: 'cancelled' })}
                          className="flex items-center gap-1.5 bg-red-700/20 hover:bg-red-700/40 text-red-300 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors">
                          <XCircle size={13} /> إلغاء
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Manual Order Modal ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showOrderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }} className="card w-full max-w-md" dir="rtl">
              <h3 className="font-black text-white mb-4">إنشاء طلب توريد يدوي</h3>
              <div className="space-y-3">
                <div>
                  <label className="label">المورد *</label>
                  <select value={orderForm.supplierId}
                    onChange={e => setOrderForm(f => ({ ...f, supplierId: e.target.value }))}
                    className="input-field">
                    <option value="">اختر المورد...</option>
                    {supplierList.filter(s => s.isActive).map(s => (
                      <option key={s.id} value={s.id}>{s.nameAr}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">الصنف من المخزون (اختياري)</label>
                  <select value={orderForm.inventoryItemId}
                    onChange={e => handleInventoryChange(e.target.value)}
                    className="input-field">
                    <option value="">اختر من المخزون...</option>
                    {inventoryItems.map(item => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">اسم الصنف *</label>
                  <input value={orderForm.itemName}
                    onChange={e => setOrderForm(f => ({ ...f, itemName: e.target.value }))}
                    className="input-field" placeholder="مثال: شامبو سيارات" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">الكمية *</label>
                    <input type="number" value={orderForm.quantityRequested}
                      onChange={e => setOrderForm(f => ({ ...f, quantityRequested: e.target.value }))}
                      className="input-field" placeholder="0" min="1" />
                  </div>
                  <div>
                    <label className="label">الوحدة</label>
                    <select value={orderForm.unit}
                      onChange={e => setOrderForm(f => ({ ...f, unit: e.target.value }))}
                      className="input-field">
                      {['وحدة', 'لتر', 'كيلو', 'قطعة', 'زجاجة', 'علبة', 'رول'].map(u => (
                        <option key={u} value={u}>{u}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">ملاحظات</label>
                  <input value={orderForm.notes}
                    onChange={e => setOrderForm(f => ({ ...f, notes: e.target.value }))}
                    className="input-field" placeholder="أي ملاحظات للمورد..." />
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowOrderModal(false)} className="btn-outline flex-1 text-sm">إلغاء</button>
                <button
                  onClick={() => createOrder.mutate(orderForm)}
                  disabled={createOrder.isPending || !orderForm.supplierId || !orderForm.itemName || !orderForm.quantityRequested}
                  className="btn-primary flex-1 text-sm flex items-center justify-center gap-2">
                  {createOrder.isPending ? 'جاري الإرسال...' : <><Send size={14} /> إرسال واتساب</>}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
