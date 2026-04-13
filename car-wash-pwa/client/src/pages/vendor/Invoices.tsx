import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  Plus,
  Eye,
  Send,
  Printer,
  CheckCircle,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  description: string;
  qty: number;
  unitPrice: string | number;
}

interface Invoice {
  id: number;
  invoiceNumber: string;
  customerName: string;
  customerPhone: string;
  items: InvoiceItem[];
  amount: string;
  vatAmount: string;
  totalAmount: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  notes?: string;
  dueDate?: string;
  sentAt?: string;
  paidAt?: string;
  createdAt: string;
}

interface InvoiceListResponse {
  data: Invoice[];
  total: number;
  page: number;
  limit: number;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  draft:   { label: 'مسودة',   bg: 'bg-slate-500/20',   text: 'text-slate-300',   dot: 'bg-slate-400' },
  sent:    { label: 'مُرسلة',  bg: 'bg-blue-500/20',    text: 'text-blue-300',    dot: 'bg-blue-400' },
  paid:    { label: 'مدفوعة',  bg: 'bg-emerald-500/20', text: 'text-emerald-300', dot: 'bg-emerald-400' },
  overdue: { label: 'متأخرة',  bg: 'bg-red-500/20',     text: 'text-red-300',     dot: 'bg-red-400' },
};

const FILTER_TABS = [
  { key: 'all',     label: 'الكل' },
  { key: 'draft',   label: 'مسودة' },
  { key: 'sent',    label: 'مُرسلة' },
  { key: 'paid',    label: 'مدفوعة' },
  { key: 'overdue', label: 'متأخرة' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
}

function fmt(n: string | number | undefined) {
  return Number(n ?? 0).toFixed(2);
}

// ─── Empty invoice form ───────────────────────────────────────────────────────

interface ItemRow {
  description: string;
  qty: number;
  unitPrice: string;
}

const emptyItem = (): ItemRow => ({ description: '', qty: 1, unitPrice: '' });

interface CreateForm {
  customerName: string;
  customerPhone: string;
  notes: string;
  dueDate: string;
  items: ItemRow[];
}

const emptyForm = (): CreateForm => ({
  customerName: '',
  customerPhone: '',
  notes: '',
  dueDate: '',
  items: [emptyItem()],
});

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

// ─── Invoice Detail Drawer ────────────────────────────────────────────────────

function InvoiceDrawer({
  invoice,
  onClose,
}: {
  invoice: Invoice;
  onClose: () => void;
}) {
  const subtotal = Number(invoice.amount);
  const vat = Number(invoice.vatAmount);
  const total = Number(invoice.totalAmount);

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      className="fixed inset-y-0 left-0 z-50 w-full max-w-lg bg-[#0d1424] border-r border-white/10 shadow-2xl overflow-y-auto"
      dir="rtl"
    >
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <h2 className="text-lg font-bold text-white">تفاصيل الفاتورة</h2>
        <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Header info */}
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">رقم الفاتورة</span>
            <span className="text-white font-mono font-bold">{invoice.invoiceNumber}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">الحالة</span>
            <StatusBadge status={invoice.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400 text-sm">التاريخ</span>
            <span className="text-white text-sm">{formatDate(invoice.createdAt)}</span>
          </div>
          {invoice.dueDate && (
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-sm">تاريخ الاستحقاق</span>
              <span className="text-white text-sm">{formatDate(invoice.dueDate)}</span>
            </div>
          )}
        </div>

        {/* Customer */}
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">بيانات العميل</h3>
          <p className="text-white font-semibold">{invoice.customerName}</p>
          <p className="text-slate-300 text-sm">{invoice.customerPhone}</p>
        </div>

        {/* Items */}
        <div>
          <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">البنود</h3>
          <div className="space-y-2">
            {(invoice.items ?? []).map((item, i) => (
              <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                <div>
                  <p className="text-white text-sm font-medium">{item.description}</p>
                  <p className="text-slate-400 text-xs">الكمية: {item.qty} × {fmt(item.unitPrice)} ر.س</p>
                </div>
                <span className="text-white font-semibold">{(Number(item.unitPrice) * item.qty).toFixed(2)} ر.س</span>
              </div>
            ))}
          </div>
        </div>

        {/* Totals */}
        <div className="bg-white/5 rounded-xl p-4 space-y-2">
          <div className="flex justify-between text-slate-300 text-sm">
            <span>المجموع قبل الضريبة</span>
            <span>{subtotal.toFixed(2)} ر.س</span>
          </div>
          <div className="flex justify-between text-slate-300 text-sm">
            <span>ضريبة القيمة المضافة (15%)</span>
            <span>{vat.toFixed(2)} ر.س</span>
          </div>
          <div className="flex justify-between text-white font-bold text-base border-t border-white/10 pt-2 mt-2">
            <span>الإجمالي المستحق</span>
            <span>{total.toFixed(2)} ر.س</span>
          </div>
        </div>

        {invoice.notes && (
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
            <p className="text-slate-400 text-xs mb-1">ملاحظات</p>
            <p className="text-white text-sm">{invoice.notes}</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Create Invoice Modal ─────────────────────────────────────────────────────

function CreateModal({
  onClose,
  onSave,
  isSaving,
}: {
  onClose: () => void;
  onSave: (form: CreateForm, sendNow: boolean) => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<CreateForm>(emptyForm());

  const subtotal = useMemo(
    () => form.items.reduce((s, it) => s + Number(it.unitPrice || 0) * it.qty, 0),
    [form.items],
  );
  const vatAmt = subtotal * 0.15;
  const totalAmt = subtotal + vatAmt;

  function updateItem(idx: number, key: keyof ItemRow, val: string | number) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [key]: val };
      return { ...f, items };
    });
  }

  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, emptyItem()] }));
  }

  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-2xl bg-[#0d1424] border border-white/10 rounded-2xl shadow-2xl overflow-y-auto max-h-[90vh]"
        dir="rtl"
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <h2 className="text-lg font-bold text-white">إنشاء فاتورة جديدة</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">اسم العميل <span className="text-red-400">*</span></label>
              <input
                value={form.customerName}
                onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                placeholder="محمد أحمد"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-sm mb-1">رقم الجوال <span className="text-red-400">*</span></label>
              <input
                value={form.customerPhone}
                onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                placeholder="05xxxxxxxx"
              />
            </div>
          </div>

          {/* Items table */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-slate-400 text-sm font-semibold">البنود</label>
              <button
                type="button"
                onClick={addItem}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                <Plus size={14} /> إضافة بند
              </button>
            </div>

            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-slate-500 text-xs px-1">
                <span className="col-span-6">الوصف</span>
                <span className="col-span-2 text-center">الكمية</span>
                <span className="col-span-3 text-left">سعر الوحدة</span>
                <span className="col-span-1" />
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <input
                    value={item.description}
                    onChange={(e) => updateItem(idx, 'description', e.target.value)}
                    className="col-span-6 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="وصف الخدمة"
                  />
                  <input
                    type="number"
                    min={1}
                    value={item.qty}
                    onChange={(e) => updateItem(idx, 'qty', Number(e.target.value))}
                    className="col-span-2 bg-white/5 border border-white/10 rounded-lg px-2 py-2 text-white text-center focus:outline-none focus:border-blue-500 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(idx, 'unitPrice', e.target.value)}
                    className="col-span-3 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm"
                    placeholder="0.00"
                  />
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length <= 1}
                    className="col-span-1 flex justify-center p-2 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Totals preview */}
          <div className="bg-white/5 rounded-xl p-4 space-y-1.5">
            <div className="flex justify-between text-slate-300 text-sm">
              <span>المجموع قبل الضريبة</span>
              <span>{subtotal.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-slate-300 text-sm">
              <span>ضريبة 15%</span>
              <span>{vatAmt.toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-white font-bold border-t border-white/10 pt-2 mt-1">
              <span>الإجمالي</span>
              <span>{totalAmt.toFixed(2)} ر.س</span>
            </div>
          </div>

          {/* Due date + notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-slate-400 text-sm mb-1">تاريخ الاستحقاق</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-blue-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-sm mb-1">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={2}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 text-sm resize-none"
              placeholder="أي ملاحظات إضافية..."
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => onSave(form, false)}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'حفظ كمسودة'}
            </button>
            <button
              type="button"
              onClick={() => onSave(form, true)}
              disabled={isSaving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'حفظ وإرسال'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorInvoices() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);
  const [drawerInvoice, setDrawerInvoice] = useState<Invoice | null>(null);

  const { data, isLoading, isError } = useQuery<InvoiceListResponse>({
    queryKey: ['vendor-invoices', activeTab, page],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (activeTab !== 'all') params.set('status', activeTab);
      const r = await api.get(`/invoices?${params.toString()}`);
      return r.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ form, sendNow }: { form: CreateForm; sendNow: boolean }) => {
      const body = {
        customerName: form.customerName,
        customerPhone: form.customerPhone,
        notes: form.notes || undefined,
        dueDate: form.dueDate || undefined,
        items: form.items.map((it) => ({
          description: it.description,
          qty: it.qty,
          unitPrice: Number(it.unitPrice),
        })),
      };
      const r = await api.post('/invoices', body);
      if (sendNow) {
        await api.post(`/invoices/${r.data.id}/send-whatsapp`);
      }
      return r.data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast.success(vars.sendNow ? 'تم إنشاء الفاتورة وإرسالها!' : 'تم حفظ الفاتورة كمسودة');
      setShowCreate(false);
    },
    onError: () => toast.error('حدث خطأ أثناء الحفظ'),
  });

  const sendWhatsAppMutation = useMutation({
    mutationFn: (id: number) => api.post(`/invoices/${id}/send-whatsapp`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast.success('تم إرسال الفاتورة عبر واتساب');
    },
    onError: () => toast.error('فشل إرسال الرسالة'),
  });

  const markPaidMutation = useMutation({
    mutationFn: (id: number) => api.put(`/invoices/${id}/status`, { status: 'paid' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-invoices'] });
      toast.success('تم تسجيل الدفع');
    },
    onError: () => toast.error('فشل تحديث الحالة'),
  });

  const invoices = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="min-h-screen bg-[#040812] text-white" dir="rtl">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
              <FileText className="text-blue-400" size={28} />
              الفواتير
            </h1>
            <p className="text-slate-400 text-sm mt-1">إدارة وإصدار فواتير العملاء</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors shadow-lg shadow-blue-500/30"
          >
            <Plus size={18} />
            إنشاء فاتورة
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-1 bg-white/5 rounded-xl p-1 mb-6 w-fit">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setPage(1); }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 size={40} className="animate-spin text-blue-500" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-24 gap-3 text-slate-400">
            <AlertCircle size={40} />
            <p>حدث خطأ أثناء تحميل الفواتير</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="flex flex-col items-center py-24 gap-3 text-slate-500">
            <FileText size={48} className="opacity-40" />
            <p className="text-lg">لا توجد فواتير</p>
            <p className="text-sm">أنشئ أول فاتورة بالضغط على الزر أعلاه</p>
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/8 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-white/5 text-slate-400 text-xs uppercase tracking-wide">
                  <th className="py-3 px-4 text-right font-semibold">رقم الفاتورة</th>
                  <th className="py-3 px-4 text-right font-semibold">العميل</th>
                  <th className="py-3 px-4 text-right font-semibold">المبلغ</th>
                  <th className="py-3 px-4 text-right font-semibold">الحالة</th>
                  <th className="py-3 px-4 text-right font-semibold">التاريخ</th>
                  <th className="py-3 px-4 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-3.5 px-4">
                      <span className="font-mono text-blue-300 font-medium">{inv.invoiceNumber}</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="text-white font-medium">{inv.customerName}</p>
                        <p className="text-slate-500 text-xs">{inv.customerPhone}</p>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className="text-white font-semibold">{fmt(inv.totalAmount)} ر.س</span>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400">
                      {formatDate(inv.createdAt)}
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        {/* View */}
                        <button
                          title="عرض"
                          onClick={() => setDrawerInvoice(inv)}
                          className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        >
                          <Eye size={16} />
                        </button>
                        {/* Send WhatsApp */}
                        <button
                          title="إرسال واتساب"
                          onClick={() => sendWhatsAppMutation.mutate(inv.id)}
                          disabled={sendWhatsAppMutation.isPending}
                          className="p-1.5 rounded-lg hover:bg-green-500/20 text-slate-400 hover:text-green-400 transition-colors disabled:opacity-40"
                        >
                          <Send size={16} />
                        </button>
                        {/* Print */}
                        <button
                          title="طباعة"
                          onClick={() => window.open(`/api/invoices/${inv.id}/pdf`, '_blank')}
                          className="p-1.5 rounded-lg hover:bg-blue-500/20 text-slate-400 hover:text-blue-400 transition-colors"
                        >
                          <Printer size={16} />
                        </button>
                        {/* Mark paid */}
                        {inv.status !== 'paid' && (
                          <button
                            title="تسجيل دفع"
                            onClick={() => markPaidMutation.mutate(inv.id)}
                            disabled={markPaidMutation.isPending}
                            className="p-1.5 rounded-lg hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-40"
                          >
                            <CheckCircle size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronRight size={18} />
            </button>
            <span className="text-slate-400 text-sm">
              صفحة {page} من {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Detail Drawer */}
      <AnimatePresence>
        {drawerInvoice && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/50"
              onClick={() => setDrawerInvoice(null)}
            />
            <InvoiceDrawer invoice={drawerInvoice} onClose={() => setDrawerInvoice(null)} />
          </>
        )}
      </AnimatePresence>

      {/* Create Modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateModal
            onClose={() => setShowCreate(false)}
            onSave={(form, sendNow) => createMutation.mutate({ form, sendNow })}
            isSaving={createMutation.isPending}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
