import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CheckCircle,
  Printer,
  MessageCircle,
  RefreshCw,
  Banknote,
  CreditCard,
  Smartphone,
  Clock,
  User,
  Phone,
  Tag,
  ChevronDown,
  ChevronUp,
  Package,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ServiceItem {
  id: number;
  name: string;
}

interface PackageItem {
  id: number;
  name: string;
  price: string;
  serviceId: number;
  serviceName?: string; // injected client-side
}

interface CartItem {
  serviceId?: number;
  name: string;
  price: number;
  qty: number;
}

interface Transaction {
  id: number;
  transactionNumber: string;
  items: CartItem[];
  subtotal: string;
  vatAmount: string;
  totalAmount: string;
  paymentMethod: string;
  customerName?: string;
  customerPhone?: string;
  createdAt: string;
  receiptHtml?: string;
}

interface Summary {
  cash: number;
  mada: number;
  stcpay: number;
  apple_pay: number;
  credit: number;
  total: number;
  transactionCount: number;
}

// ─── Payment methods ──────────────────────────────────────────────────────────

const PAYMENT_METHODS = [
  { key: 'cash',      label: 'نقدي',    icon: Banknote,    color: 'from-emerald-600 to-green-500',   shadow: 'shadow-emerald-500/30' },
  { key: 'mada',      label: 'مدى',     icon: CreditCard,  color: 'from-blue-600 to-cyan-500',       shadow: 'shadow-blue-500/30'    },
  { key: 'stcpay',    label: 'STC Pay', icon: Smartphone,  color: 'from-violet-600 to-purple-500',   shadow: 'shadow-violet-500/30'  },
  { key: 'credit',    label: 'آجل',     icon: Clock,       color: 'from-amber-600 to-orange-500',    shadow: 'shadow-amber-500/30'   },
] as const;

// ─── Receipt Modal ────────────────────────────────────────────────────────────

function ReceiptModal({
  tx,
  onClose,
  onNewSale,
}: {
  tx: Transaction;
  onClose: () => void;
  onNewSale: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.print();
    }
  };

  const handleSendWhatsapp = async () => {
    setSending(true);
    try {
      await api.post(`/pos/transactions/${tx.id}/send-receipt`);
      setSent(true);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  const paymentLabels: Record<string, string> = {
    cash: 'نقدي', mada: 'مدى', stcpay: 'STC Pay', apple_pay: 'Apple Pay', credit: 'آجل',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 80 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22 }}
        className="relative z-10 bg-[#111827] border border-white/10 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
      >
        {/* Success banner */}
        <div className="bg-gradient-to-l from-emerald-600 to-teal-500 p-5 text-center">
          <CheckCircle className="w-10 h-10 text-white mx-auto mb-1" />
          <p className="text-white font-black text-xl">تم البيع بنجاح!</p>
          <p className="text-white/80 text-sm">{tx.transactionNumber}</p>
        </div>

        {/* Receipt preview */}
        <div className="p-5 space-y-3">
          {/* Items */}
          <div className="space-y-2">
            {tx.items.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white/70">{item.name} × {item.qty}</span>
                <span className="text-white font-semibold">
                  {(item.price * item.qty).toFixed(2)} ر.س
                </span>
              </div>
            ))}
          </div>

          <div className="border-t border-white/10 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm text-white/60">
              <span>المجموع</span>
              <span>{Number(tx.subtotal).toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-sm text-white/60">
              <span>ضريبة 15%</span>
              <span>{Number(tx.vatAmount).toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-lg font-black text-white pt-1">
              <span>الإجمالي</span>
              <span>{Number(tx.totalAmount).toFixed(2)} ر.س</span>
            </div>
            <div className="flex justify-between text-sm text-white/60">
              <span>الدفع</span>
              <span>{paymentLabels[tx.paymentMethod] ?? tx.paymentMethod}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={handlePrint}
              className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-sm font-semibold transition-colors"
            >
              <Printer className="w-4 h-4" /> طباعة
            </button>
            {tx.customerPhone && (
              <button
                onClick={handleSendWhatsapp}
                disabled={sending || sent}
                className="flex-1 flex items-center justify-center gap-1.5 py-3 rounded-xl bg-emerald-600/80 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors disabled:opacity-50"
              >
                <MessageCircle className="w-4 h-4" />
                {sent ? 'تم الإرسال ✓' : sending ? '...' : 'واتساب'}
              </button>
            )}
          </div>

          <button
            onClick={() => { onNewSale(); onClose(); }}
            className="w-full py-3.5 rounded-xl bg-gradient-to-l from-blue-600 to-cyan-500 text-white font-black text-lg flex items-center justify-center gap-2"
          >
            <RefreshCw className="w-5 h-5" /> بيع جديد
          </button>
        </div>

        {/* Hidden iframe for print */}
        {tx.receiptHtml && (
          <iframe
            ref={iframeRef}
            srcDoc={tx.receiptHtml}
            title="receipt"
            className="hidden"
          />
        )}
      </motion.div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VendorPOS() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customName, setCustomName] = useState('');
  const [customPrice, setCustomPrice] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);
  const [error, setError] = useState('');

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const { data: packagesData } = useQuery<PackageItem[]>({
    queryKey: ['packages-for-pos'],
    queryFn: async () => {
      const { data } = await api.get('/services');
      const flat: PackageItem[] = [];
      for (const svc of data as Array<{ id: number; name: string; packages: PackageItem[] }>) {
        for (const pkg of svc.packages ?? []) {
          flat.push({ ...pkg, serviceName: svc.name });
        }
      }
      return flat;
    },
  });

  const { data: summaryData, refetch: refetchSummary } = useQuery<Summary>({
    queryKey: ['pos-summary'],
    queryFn: async () => {
      const { data } = await api.get('/pos/summary');
      return data;
    },
    refetchInterval: 30000,
  });

  const packages = packagesData ?? [];

  // Group packages by service
  const grouped = packages.reduce<Record<string, PackageItem[]>>((acc, pkg) => {
    const key = pkg.serviceName ?? 'أخرى';
    if (!acc[key]) acc[key] = [];
    acc[key].push(pkg);
    return acc;
  }, {});

  // ─── Cart helpers ──────────────────────────────────────────────────────────

  const addToCart = (item: Omit<CartItem, 'qty'>) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.name === item.name && c.serviceId === item.serviceId);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [...prev, { ...item, qty: 1 }];
    });
  };

  const updateQty = (idx: number, delta: number) => {
    setCart((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], qty: updated[idx].qty + delta };
      if (updated[idx].qty <= 0) updated.splice(idx, 1);
      return updated;
    });
  };

  const removeItem = (idx: number) => {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  };

  const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
  const vatAmount = Math.round(subtotal * 0.15 * 100) / 100;
  const total = subtotal + vatAmount;

  const resetForm = () => {
    setCart([]);
    setPaymentMethod('cash');
    setCustomerName('');
    setCustomerPhone('');
    setCustomName('');
    setCustomPrice('');
    setShowCustom(false);
    setError('');
  };

  // ─── Submit ────────────────────────────────────────────────────────────────

  const submitSale = useMutation({
    mutationFn: async () => {
      if (cart.length === 0) throw new Error('السلة فارغة');
      const { data } = await api.post('/pos/transaction', {
        items: cart,
        paymentMethod,
        customerName: customerName || undefined,
        customerPhone: customerPhone || undefined,
      });
      return data as Transaction;
    },
    onSuccess: (tx) => {
      setCompletedTx(tx);
      refetchSummary();
    },
    onError: (e: any) => {
      setError(e?.response?.data?.error ?? e?.message ?? 'حدث خطأ');
    },
  });

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0a1a] text-white" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 w-[500px] h-[400px] bg-emerald-600/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-0 w-[400px] h-[300px] bg-blue-600/5 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-5">

        {/* ── Top Bar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <h1 className="text-2xl font-black text-white">نقطة البيع</h1>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-white/40">
              مبيعات اليوم:
              <span className="text-emerald-400 font-bold mr-1.5">
                {(summaryData?.total ?? 0).toFixed(2)} ر.س
              </span>
            </span>
            <span className="text-white/40">
              عمليات:
              <span className="text-blue-400 font-bold mr-1.5">
                {summaryData?.transactionCount ?? 0}
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

          {/* ── Left: Service selector (3 cols) ─────────────────────────── */}
          <div className="lg:col-span-3 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h2 className="font-bold text-white flex items-center gap-2">
                <Package className="w-5 h-5 text-blue-400" />
                الخدمات والباقات
              </h2>
            </div>

            <div className="p-4 max-h-[calc(100vh-240px)] overflow-y-auto space-y-5">
              {Object.keys(grouped).length === 0 && (
                <p className="text-white/30 text-center py-8 text-sm">لا توجد باقات مضافة</p>
              )}

              {Object.entries(grouped).map(([serviceName, pkgs]) => (
                <div key={serviceName}>
                  <p className="text-white/50 text-xs font-semibold mb-2 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> {serviceName}
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {pkgs.map((pkg) => (
                      <motion.button
                        key={pkg.id}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() =>
                          addToCart({
                            serviceId: pkg.id,
                            name: pkg.name,
                            price: Number(pkg.price),
                          })
                        }
                        className="flex flex-col items-center gap-1.5 p-3 rounded-xl bg-white/5 border border-white/10 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all text-center"
                      >
                        <span className="text-white font-semibold text-sm leading-tight">{pkg.name}</span>
                        <span className="text-blue-400 font-black text-base">{Number(pkg.price).toFixed(0)} ر.س</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}

              {/* Custom item */}
              <div>
                <button
                  onClick={() => setShowCustom(!showCustom)}
                  className="flex items-center gap-1.5 text-white/50 hover:text-white/80 text-sm font-medium transition-colors"
                >
                  {showCustom ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  إضافة صنف مخصص
                </button>
                <AnimatePresence>
                  {showCustom && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          placeholder="اسم الخدمة"
                          value={customName}
                          onChange={(e) => setCustomName(e.target.value)}
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/50"
                        />
                        <input
                          type="number"
                          placeholder="السعر"
                          value={customPrice}
                          onChange={(e) => setCustomPrice(e.target.value)}
                          className="w-24 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/50"
                        />
                        <button
                          onClick={() => {
                            if (!customName || !customPrice) return;
                            addToCart({ name: customName, price: Number(customPrice) });
                            setCustomName('');
                            setCustomPrice('');
                          }}
                          className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* ── Right: Order summary (2 cols) ───────────────────────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Cart */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden flex-1">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-emerald-400" />
                  الطلب
                </h2>
                {cart.length > 0 && (
                  <button
                    onClick={() => setCart([])}
                    className="text-red-400/60 hover:text-red-400 text-xs flex items-center gap-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> مسح الكل
                  </button>
                )}
              </div>

              <div className="p-3 min-h-[160px] max-h-[280px] overflow-y-auto">
                {cart.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-white/20">
                    <ShoppingCart className="w-8 h-8 mb-2" />
                    <p className="text-sm">أضف خدمات من اليسار</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-red-400/50 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <span className="flex-1 text-white text-sm truncate">{item.name}</span>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => updateQty(idx, -1)}
                            className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center text-white text-sm font-bold">{item.qty}</span>
                          <button
                            onClick={() => updateQty(idx, 1)}
                            className="w-6 h-6 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-white font-semibold text-sm w-16 text-left">
                          {(item.price * item.qty).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="p-4 border-t border-white/10 space-y-2">
                <div className="flex justify-between text-sm text-white/60">
                  <span>المجموع</span>
                  <span>{subtotal.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-sm text-white/60">
                  <span>ضريبة 15%</span>
                  <span>{vatAmount.toFixed(2)} ر.س</span>
                </div>
                <div className="flex justify-between text-xl font-black text-white border-t border-white/10 pt-2">
                  <span>الإجمالي</span>
                  <span className="text-emerald-400">{total.toFixed(2)} ر.س</span>
                </div>
              </div>
            </div>

            {/* Customer info */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4 space-y-3">
              <h3 className="font-semibold text-white/70 text-sm">معلومات العميل (اختياري)</h3>
              {[
                { key: 'customerName', placeholder: 'الاسم', icon: User, state: customerName, setState: setCustomerName },
                { key: 'customerPhone', placeholder: 'رقم الجوال', icon: Phone, state: customerPhone, setState: setCustomerPhone },
              ].map(({ key, placeholder, icon: Icon, state, setState }) => (
                <div key={key} className="relative">
                  <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type={key === 'customerPhone' ? 'tel' : 'text'}
                    placeholder={placeholder}
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-emerald-500/50"
                  />
                </div>
              ))}
            </div>

            {/* Payment method */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
              <h3 className="font-semibold text-white/70 text-sm mb-3">طريقة الدفع</h3>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(({ key, label, icon: Icon, color, shadow }) => (
                  <motion.button
                    key={key}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setPaymentMethod(key)}
                    className={`flex items-center gap-2 py-3 px-3 rounded-xl font-bold text-sm transition-all ${
                      paymentMethod === key
                        ? `bg-gradient-to-l ${color} text-white shadow-lg ${shadow}`
                        : 'bg-white/5 border border-white/10 text-white/60 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </motion.button>
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <motion.button
              whileHover={{ scale: cart.length > 0 ? 1.02 : 1 }}
              whileTap={{ scale: cart.length > 0 ? 0.97 : 1 }}
              onClick={() => submitSale.mutate()}
              disabled={cart.length === 0 || submitSale.isPending}
              className="w-full py-4 rounded-2xl bg-gradient-to-l from-emerald-600 to-teal-500 text-white font-black text-xl shadow-lg shadow-emerald-500/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            >
              {submitSale.isPending ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/50 border-t-white rounded-full animate-spin" />
                  جاري المعالجة...
                </div>
              ) : (
                `إتمام البيع — ${total.toFixed(2)} ر.س`
              )}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Receipt modal */}
      <AnimatePresence>
        {completedTx && (
          <ReceiptModal
            tx={completedTx}
            onClose={() => setCompletedTx(null)}
            onNewSale={resetForm}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
