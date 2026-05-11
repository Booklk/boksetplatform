import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  ArrowRight,
  MapPin,
  Clock,
  Star,
  X,
  CheckCircle,
  AlertTriangle,
  Phone,
  Car,
  DollarSign,
  FileText,
  QrCode,
  CalendarClock,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTime, formatCurrency } from '../../lib/utils';
import { RescheduleModal } from '../../components/customer/RescheduleModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface BookingDetail {
  id: number;
  bookingNumber: string;
  status: string;
  scheduledAt: string;
  address: string;
  totalPrice: number | string;
  vehiclePlate: string;
  vehicleType: string;
  vehicleModel: string;
  vehicleColor: string;
  notes?: string;
  rating?: number;
  ratingComment?: string;
  ratedAt?: string;
  vendorReply?: string;
  cancelledAt?: string;
  cancelReason?: string;
  refundAmount?: number | string;
  packageName?: string;
  serviceName?: string;
}

interface Invoice {
  bookingNumber: string;
  date: string;
  sellerName: string;
  vatNumber: string;
  totalWithVat: number | string;
  vatAmount: number | string;
  netPrice: number | string;
  qrCode: string; // base64
}

interface CancelResult {
  refundPercent: number;
  refundAmount: number | string;
}

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:     { label: 'في الانتظار',        color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
  confirmed:   { label: 'مؤكد',               color: 'bg-blue-500/20 text-blue-400 border-blue-500/40' },
  on_way:      { label: 'الموظف في الطريق',   color: 'bg-purple-500/20 text-purple-400 border-purple-500/40' },
  arrived:     { label: 'وصل الموظف',         color: 'bg-orange-500/20 text-orange-400 border-orange-500/40' },
  in_progress: { label: 'جاري التنفيذ',       color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40' },
  completed:   { label: 'مكتمل',              color: 'bg-green-500/20 text-green-400 border-green-500/40' },
  cancelled:   { label: 'ملغي',               color: 'bg-red-500/20 text-red-400 border-red-500/40' },
};

// ─── Toast ─────────────────────────────────────────────────────────────────────

function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success' | 'error' }[]>([]);
  const show = (msg: string, type: 'success' | 'error' = 'success') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  };
  return { toasts, show };
}

function ToastContainer({ toasts }: { toasts: { id: number; msg: string; type: 'success' | 'error' }[] }) {
  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[90vw] max-w-sm pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-bold shadow-xl backdrop-blur-sm border transition-all
            ${t.type === 'success'
              ? 'bg-green-500/20 text-green-300 border-green-500/40'
              : 'bg-red-500/20 text-red-300 border-red-500/40'
            }`}
        >
          {t.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ─── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-surface-1 animate-pulse" dir="rtl">
      {/* header */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-900/80 border-b border-white/10">
        <div className="w-16 h-6 bg-white/10 rounded-lg" />
        <div className="w-24 h-5 bg-white/10 rounded-lg" />
        <div className="w-16" />
      </div>
      <div className="p-4 max-w-2xl mx-auto space-y-4 pb-10">
        {/* status badge */}
        <div className="flex justify-center pt-2">
          <div className="w-32 h-9 bg-white/10 rounded-2xl" />
        </div>
        {/* cards */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <div className="h-4 bg-white/10 rounded w-1/3" />
            <div className="h-4 bg-white/10 rounded w-full" />
            <div className="h-4 bg-white/10 rounded w-2/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Invoice Modal ─────────────────────────────────────────────────────────────

function InvoiceModal({ invoice, onClose }: { invoice: Invoice; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0d1526] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        {/* title row */}
        <div className="flex items-center justify-between">
          <h3 className="text-white font-black text-lg flex items-center gap-2">
            <FileText size={18} className="text-blue-400" />
            فاتورة ZATCA
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* QR */}
        {invoice.qrCode && (
          <div className="flex justify-center">
            <img
              src={`data:image/png;base64,${invoice.qrCode}`}
              alt="QR Code"
              className="w-44 h-44 rounded-xl border border-white/10 bg-white p-1"
            />
          </div>
        )}

        {/* details */}
        <div className="space-y-2 text-sm">
          <Row label="رقم الفاتورة" value={`#${invoice.bookingNumber}`} />
          <Row label="التاريخ" value={new Date(invoice.date).toLocaleDateString('ar-SA')} />
          <Row label="البائع" value={invoice.sellerName} />
          <Row label="الرقم الضريبي" value={invoice.vatNumber} />
          <div className="border-t border-white/10 pt-2 space-y-2">
            <Row label="السعر قبل الضريبة" value={formatCurrency(invoice.netPrice)} />
            <Row label="ضريبة القيمة المضافة" value={formatCurrency(invoice.vatAmount)} />
            <Row
              label="الإجمالي شامل الضريبة"
              value={formatCurrency(invoice.totalWithVat)}
              highlight
            />
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
        >
          إغلاق
        </button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-slate-400">{label}</span>
      <span className={highlight ? 'text-white font-black' : 'text-slate-200 font-bold'}>{value}</span>
    </div>
  );
}

// ─── Cancel Modal ──────────────────────────────────────────────────────────────

function CancelModal({
  onConfirm,
  onClose,
  isPending,
}: {
  onConfirm: (reason: string) => void;
  onClose: () => void;
  isPending: boolean;
}) {
  const [reason, setReason] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-[#0d1526] border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4"
        onClick={(e) => e.stopPropagation()}
        dir="rtl"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-white font-black text-lg flex items-center gap-2">
            <AlertTriangle size={18} className="text-red-400" />
            تأكيد الإلغاء
          </h3>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-slate-300 text-sm">
          هل أنت متأكد أنك تريد إلغاء هذا الحجز؟ تأكد من مراجعة سياسة الاسترداد أدناه.
        </p>

        <div>
          <label className="block text-slate-400 text-xs mb-1.5">سبب الإلغاء (اختياري)</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="اكتب سبب الإلغاء..."
            className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-white/30 resize-none"
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white font-bold py-2.5 rounded-xl transition-colors text-sm"
          >
            تراجع
          </button>
          <button
            onClick={() => onConfirm(reason)}
            disabled={isPending}
            className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl transition-colors text-sm flex items-center justify-center gap-2"
          >
            {isPending ? (
              <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : null}
            إلغاء الحجز
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function BookingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { token } = useAuth();
  const { toasts, show: showToast } = useToast();

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<Invoice | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showReschedule, setShowReschedule] = useState(false);
  const [cancelResult, setCancelResult] = useState<CancelResult | null>(null);

  const headers = { Authorization: `Bearer ${token}` };

  // ── Booking query ────────────────────────────────────────────────────────────
  const {
    data: booking,
    isLoading,
    refetch,
  } = useQuery<BookingDetail>({
    queryKey: ['booking', id],
    queryFn: () => axios.get(`/api/bookings/${id}`, { headers }).then((r) => r.data),
    enabled: !!id,
  });

  // ── ZATCA invoice fetch ──────────────────────────────────────────────────────
  const invoiceQuery = useQuery<Invoice>({
    queryKey: ['invoice', id],
    queryFn: () =>
      axios.get(`/api/vat-report/invoice/${id}`, { headers }).then((r) => r.data),
    enabled: false, // manual trigger
  });

  const handleShowInvoice = async () => {
    if (invoiceData) {
      setShowInvoiceModal(true);
      return;
    }
    try {
      const result = await invoiceQuery.refetch();
      if (result.data) {
        setInvoiceData(result.data);
        setShowInvoiceModal(true);
      }
    } catch {
      showToast('تعذّر تحميل الفاتورة. حاول مجدداً.', 'error');
    }
  };

  // ── Cancel mutation ──────────────────────────────────────────────────────────
  const cancelMutation = useMutation<CancelResult, Error, string>({
    mutationFn: (reason: string) =>
      axios
        .post(`/api/bookings/${id}/cancel`, { reason }, { headers })
        .then((r) => r.data),
    onSuccess: (data) => {
      setCancelResult(data);
      setShowCancelModal(false);
      showToast('تم إلغاء الحجز بنجاح', 'success');
      refetch();
    },
    onError: () => {
      showToast('تعذّر إلغاء الحجز. حاول مجدداً.', 'error');
    },
  });

  // ── Render states ────────────────────────────────────────────────────────────

  if (isLoading) return <LoadingSkeleton />;

  if (!booking) {
    return (
      <div className="min-h-screen bg-surface-1 flex items-center justify-center p-6" dir="rtl">
        <div className="text-center space-y-4">
          <AlertTriangle size={48} className="text-red-400 mx-auto" />
          <p className="text-white font-black text-lg">الحجز غير موجود</p>
          <button
            onClick={() => navigate(-1)}
            className="bg-white/10 hover:bg-white/20 text-white font-bold px-6 py-2.5 rounded-xl transition-colors"
          >
            رجوع
          </button>
        </div>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[booking.status] ?? {
    label: booking.status,
    color: 'bg-slate-700/40 text-slate-300 border-slate-600',
  };

  const canCancel = ['pending', 'confirmed'].includes(booking.status);
  const isCompleted = booking.status === 'completed';
  const isCancelled = booking.status === 'cancelled';
  const hasRating = isCompleted && !!booking.rating;

  // ── JSX ──────────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-1" dir="rtl">
      <ToastContainer toasts={toasts} />

      {/* ── Header ── */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-surface-1/90 backdrop-blur border-b border-white/10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-slate-300 hover:text-white transition-colors"
        >
          <ArrowRight size={18} />
          <span className="text-sm font-bold">رجوع</span>
        </button>
        <p className="text-white font-black text-sm">#{booking.bookingNumber}</p>
        <div className="w-16" />
      </div>

      <div className="p-4 max-w-2xl mx-auto space-y-5 pb-14">

        {/* ── Status Banner ── */}
        <div className="flex justify-center pt-2">
          <span
            className={`text-base font-black px-6 py-2 rounded-2xl border ${statusCfg.color}`}
          >
            {statusCfg.label}
          </span>
        </div>

        {/* ── Booking Info Card ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <h2 className="text-white font-black text-base flex items-center gap-2">
            <FileText size={16} className="text-blue-400" />
            تفاصيل الحجز
          </h2>

          {/* Service / Package */}
          {(booking.serviceName || booking.packageName) && (
            <InfoRow
              icon={<CheckCircle size={15} className="text-blue-400" />}
              label="الخدمة"
              value={[booking.serviceName, booking.packageName].filter(Boolean).join(' — ')}
            />
          )}

          {/* Scheduled at */}
          <InfoRow
            icon={<Clock size={15} className="text-blue-400" />}
            label="الموعد"
            value={formatDateTime(booking.scheduledAt)}
          />

          {/* Address */}
          <InfoRow
            icon={<MapPin size={15} className="text-blue-400" />}
            label="العنوان"
            value={booking.address}
          />

          {/* Vehicle */}
          <InfoRow
            icon={<Car size={15} className="text-blue-400" />}
            label="المركبة"
            value={`${booking.vehicleModel} • ${booking.vehicleType} • ${booking.vehicleColor} • ${booking.vehiclePlate}`}
          />

          {/* Notes */}
          {booking.notes && (
            <InfoRow
              icon={<Phone size={15} className="text-blue-400" />}
              label="ملاحظات"
              value={booking.notes}
            />
          )}
        </div>

        {/* ── Price Card ── */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-green-400" />
              <span className="text-slate-300 font-bold text-sm">الإجمالي</span>
            </div>
            <span className="text-white font-black text-xl">
              {formatCurrency(booking.totalPrice)}
            </span>
          </div>

          {/* ZATCA Invoice Button */}
          <button
            onClick={handleShowInvoice}
            disabled={invoiceQuery.isFetching}
            className="w-full flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 disabled:opacity-50 text-slate-200 font-bold py-2.5 rounded-xl border border-white/10 transition-colors text-sm"
          >
            {invoiceQuery.isFetching ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <QrCode size={16} />
            )}
            عرض الفاتورة / QR
          </button>
        </div>

        {/* ── Rating Section ── */}
        {hasRating && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-3">
            <h2 className="text-white font-black text-base flex items-center gap-2">
              <Star size={16} className="text-yellow-400 fill-yellow-400" />
              تقييمك
            </h2>

            {/* Stars */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  size={22}
                  className={
                    s <= (booking.rating ?? 0)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-slate-600'
                  }
                />
              ))}
              <span className="text-slate-300 font-bold text-sm mr-1">
                {booking.rating}/5
              </span>
            </div>

            {/* Comment */}
            {booking.ratingComment && (
              <p className="text-slate-300 text-sm leading-relaxed bg-white/5 rounded-xl px-4 py-3 border border-white/10">
                {booking.ratingComment}
              </p>
            )}

            {/* Vendor Reply */}
            {booking.vendorReply && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3 space-y-1">
                <p className="text-blue-400 text-xs font-bold">رد مزود الخدمة:</p>
                <p className="text-slate-200 text-sm leading-relaxed italic">
                  "{booking.vendorReply}"
                </p>
              </div>
            )}
          </div>
        )}

        {/* ── Cancellation Section (for pending/confirmed) ── */}
        {canCancel && !cancelResult && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
            <h2 className="text-white font-black text-base flex items-center gap-2">
              <AlertTriangle size={16} className="text-yellow-400" />
              سياسة الإلغاء والاسترداد
            </h2>

            <div className="space-y-2 text-sm">
              <PolicyRow
                icon="✅"
                text="إلغاء قبل 24 ساعة أو أكثر = استرداد كامل 100%"
                color="text-green-400"
              />
              <PolicyRow
                icon="⚠️"
                text="إلغاء قبل 2-24 ساعة من الموعد = استرداد 50%"
                color="text-yellow-400"
              />
              <PolicyRow
                icon="❌"
                text="إلغاء قبل أقل من ساعتين = لا يوجد استرداد"
                color="text-red-400"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={() => setShowReschedule(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black py-3 rounded-xl transition-colors"
              >
                <CalendarClock size={16} />
                تغيير الموعد
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-black py-3 rounded-xl transition-colors"
              >
                <X size={16} />
                إلغاء الحجز
              </button>
            </div>
          </div>
        )}

        {/* ── Post-cancellation refund info (shown after successful cancel in same session) ── */}
        {cancelResult && (
          <div className="bg-green-500/10 border border-green-500/20 rounded-2xl p-5 space-y-2">
            <div className="flex items-center gap-2">
              <CheckCircle size={18} className="text-green-400" />
              <p className="text-green-300 font-black">تم إلغاء الحجز بنجاح</p>
            </div>
            <p className="text-slate-300 text-sm">
              نسبة الاسترداد:{' '}
              <span className="text-white font-bold">{cancelResult.refundPercent}%</span>
            </p>
            <p className="text-slate-300 text-sm">
              مبلغ الاسترداد:{' '}
              <span className="text-white font-bold">{formatCurrency(cancelResult.refundAmount)}</span>
            </p>
          </div>
        )}

        {/* ── Cancellation Info Card (if already cancelled) ── */}
        {isCancelled && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-5 space-y-3">
            <h2 className="text-red-300 font-black text-base flex items-center gap-2">
              <X size={16} />
              معلومات الإلغاء
            </h2>

            {booking.cancelReason && (
              <div>
                <p className="text-xs text-slate-400 mb-1">سبب الإلغاء</p>
                <p className="text-slate-200 text-sm">{booking.cancelReason}</p>
              </div>
            )}

            {booking.refundAmount !== undefined && booking.refundAmount !== null && (
              <div>
                <p className="text-xs text-slate-400 mb-1">مبلغ الاسترداد</p>
                <p className="text-white font-black">{formatCurrency(booking.refundAmount)}</p>
              </div>
            )}

            {booking.cancelledAt && (
              <div>
                <p className="text-xs text-slate-400 mb-1">وقت الإلغاء</p>
                <p className="text-slate-300 text-sm">{formatDateTime(booking.cancelledAt)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Invoice Modal ── */}
      {showInvoiceModal && invoiceData && (
        <InvoiceModal invoice={invoiceData} onClose={() => setShowInvoiceModal(false)} />
      )}

      {/* ── Cancel Modal ── */}
      {showCancelModal && (
        <CancelModal
          onConfirm={(reason) => cancelMutation.mutate(reason)}
          onClose={() => setShowCancelModal(false)}
          isPending={cancelMutation.isPending}
        />
      )}

      {/* ── Reschedule Modal ── */}
      {showReschedule && booking && (
        <RescheduleModal
          bookingId={booking.id}
          currentScheduledAt={booking.scheduledAt}
          onClose={() => setShowReschedule(false)}
        />
      )}
    </div>
  );
}

// ─── Helper sub-components ─────────────────────────────────────────────────────

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs text-slate-500 mb-0.5">{label}</p>
        <p className="text-white font-bold text-sm leading-snug break-words">{value}</p>
      </div>
    </div>
  );
}

function PolicyRow({
  icon,
  text,
  color,
}: {
  icon: string;
  text: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0">{icon}</span>
      <p className={`${color} leading-snug`}>{text}</p>
    </div>
  );
}
