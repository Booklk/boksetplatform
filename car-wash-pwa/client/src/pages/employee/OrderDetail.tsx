import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { MapPin, Phone, Car, Navigation, CheckCircle, Camera, ChevronDown, ChevronUp, CreditCard, FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../../lib/api';
import { haptics } from '../../lib/haptics';
import { Booking, BookingStatus } from '../../types';
import { formatDateTime, formatCurrency, STATUS_LABELS } from '../../lib/utils';
import StatusBadge from '../../components/StatusBadge';
import PhotoCapture from '../../components/PhotoCapture';
import LocationSharing from '../../components/LocationSharing';
import PaymentModal from '../../components/PaymentModal';

// Status flow for employee actions
const STATUS_ACTIONS: Record<string, { next: BookingStatus; label: string; icon: string; color: string }> = {
  confirmed:   { next: 'on_way',      label: 'في الطريق',        icon: '🚗', color: 'bg-purple-600 hover:bg-purple-500' },
  pending:     { next: 'on_way',      label: 'في الطريق',        icon: '🚗', color: 'bg-purple-600 hover:bg-purple-500' },
  on_way:      { next: 'arrived',     label: 'وصلت للموقع',      icon: '📍', color: 'bg-cyan-600 hover:bg-cyan-500' },
  arrived:     { next: 'in_progress', label: 'بدأت العمل',       icon: '🧹', color: 'bg-orange-600 hover:bg-orange-500' },
  in_progress: { next: 'completed',   label: 'اكتملت الخدمة',    icon: '✅', color: 'bg-green-600 hover:bg-green-500' },
};

export default function EmployeeOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showPhotos, setShowPhotos] = useState(false);
  const [showPayment, setShowPayment] = useState(false);

  const { data: booking, isLoading } = useQuery<Booking>({
    queryKey: ['booking-detail', id],
    queryFn: () => api.get(`/bookings/${id}`).then(r => r.data),
    refetchInterval: 15000,
  });

  const { mutate: updateStatus, isPending } = useMutation({
    mutationFn: (status: string) => api.post(`/bookings/${id}/status`, { status }).then(r => r.data),
    onSuccess: (updated) => {
      haptics.success();
      queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['employee-bookings'] });
      toast.success(`تم تحديث الحالة: ${STATUS_LABELS[updated.status]}`);
    },
    onError: (err: any) => {
      haptics.error();
      toast.error(err?.response?.data?.error ?? 'فشل في التحديث');
    },
  });

  function openGoogleMaps() {
    if (!booking) return;
    let url: string;
    if (booking.lat && booking.lng) {
      // Direct coordinates navigation
      url = `https://www.google.com/maps/dir/?api=1&destination=${booking.lat},${booking.lng}&travelmode=driving`;
    } else {
      // Address search
      const encoded = encodeURIComponent(booking.address + '، الرياض، المملكة العربية السعودية');
      url = `https://www.google.com/maps/dir/?api=1&destination=${encoded}&travelmode=driving`;
    }
    window.open(url, '_blank');
  }

  function callCustomer() {
    if (booking?.customerPhone) {
      window.location.href = `tel:${booking.customerPhone}`;
    }
  }

  if (isLoading) return (
    <div className="p-4 space-y-4">
      <div className="card animate-pulse h-40" />
      <div className="card animate-pulse h-32" />
    </div>
  );

  if (!booking) return (
    <div className="p-4 text-center text-slate-400 min-h-64 flex items-center justify-center">
      <div><div className="text-4xl mb-3">😕</div><p>الطلب غير موجود</p></div>
    </div>
  );

  const action = STATUS_ACTIONS[booking.status];
  const isCompleted = booking.status === 'completed' || booking.status === 'cancelled';

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4" dir="rtl">
      {/* Back */}
      <button onClick={() => navigate('/employee')} className="text-brand-400 text-sm flex items-center gap-1 hover:text-brand-300">
        ← العودة للقائمة
      </button>

      {/* Header */}
      <div className="card bg-gradient-to-l from-brand-900/40 to-slate-800">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-slate-400">رقم الطلب</p>
            <h2 className="text-xl font-black text-white">#{booking.bookingNumber}</h2>
          </div>
          <StatusBadge status={booking.status} />
        </div>
        <p className="font-bold text-white">{(booking as any).serviceName} - {(booking as any).packageName}</p>
        <p className="text-2xl font-black gradient-text mt-1">{formatCurrency(booking.totalPrice)}</p>
      </div>

      {/* Customer Info */}
      <div className="card">
        <h3 className="font-black text-white mb-3">بيانات العميل</h3>
        <div className="space-y-2 text-sm">
          <p className="text-slate-300"><span className="text-slate-400">الاسم: </span>{booking.customerName}</p>
          {booking.customerPhone && (
            <p className="text-slate-300"><span className="text-slate-400">الجوال: </span>{booking.customerPhone}</p>
          )}
        </div>
        <div className="flex gap-3 mt-4">
          {booking.customerPhone && (
            <button onClick={callCustomer} className="btn-outline flex-1 text-sm py-2 flex items-center justify-center gap-2">
              <Phone size={15} /> اتصل
            </button>
          )}
          {booking.customerPhone && (
            <a
              href={`https://wa.me/${booking.customerPhone.replace(/^0/, '966')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 bg-green-600/90 hover:bg-green-600 text-white font-bold px-4 py-2 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors"
            >
              <span>📱</span> واتساب
            </a>
          )}
        </div>
      </div>

      {/* Location - opens Google Maps */}
      <div className="card">
        <h3 className="font-black text-white mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-brand-400" /> الموقع
        </h3>
        <p className="text-slate-300 text-sm mb-4">{booking.address}</p>
        <button
          onClick={openGoogleMaps}
          className="w-full bg-gradient-to-l from-green-700 to-emerald-600 hover:from-green-600 hover:to-emerald-500 text-white font-black py-3 px-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg"
        >
          <Navigation size={18} />
          فتح في خرائط قوقل
        </button>
      </div>

      {/* Vehicle */}
      {(booking.vehicleType || booking.vehiclePlate) && (
        <div className="card">
          <h3 className="font-black text-white mb-3 flex items-center gap-2">
            <Car size={16} className="text-brand-400" /> السيارة
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {booking.vehicleType && <div><span className="text-slate-400">النوع: </span><span className="text-white font-semibold">{booking.vehicleType}</span></div>}
            {booking.vehiclePlate && <div><span className="text-slate-400">اللوحة: </span><span className="text-white font-semibold">{booking.vehiclePlate}</span></div>}
            {booking.vehicleModel && <div><span className="text-slate-400">الموديل: </span><span className="text-white font-semibold">{booking.vehicleModel}</span></div>}
            {booking.vehicleColor && <div><span className="text-slate-400">اللون: </span><span className="text-white font-semibold">{booking.vehicleColor}</span></div>}
          </div>
        </div>
      )}

      {/* Appointment time */}
      <div className="card">
        <h3 className="font-black text-white mb-2">الموعد</h3>
        <p className="text-brand-300 font-bold">{formatDateTime(booking.scheduledAt)}</p>
        {booking.notes && <p className="text-slate-400 text-sm mt-2">📝 {booking.notes}</p>}
      </div>

      {/* GPS Location Sharing */}
      <LocationSharing bookingId={booking.id} />

      {/* Photo Capture (before/after) */}
      <div className="card">
        <button
          onClick={() => setShowPhotos(v => !v)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-brand-400" />
            <h3 className="font-black text-white">صور الحجز (قبل / بعد)</h3>
          </div>
          {showPhotos ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>

        {showPhotos && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 grid gap-3">
            <PhotoCapture bookingId={booking.id} phase="before" onSuccess={() => toast.success('تم رفع صورة ما قبل الغسيل')} />
            <PhotoCapture bookingId={booking.id} phase="after" onSuccess={() => toast.success('تم رفع صورة ما بعد الغسيل')} />
            <PhotoCapture bookingId={booking.id} phase="damage" onSuccess={() => toast.success('تم توثيق الضرر')} />
          </motion.div>
        )}
      </div>

      {/* Status history */}
      {booking.statusHistory && booking.statusHistory.length > 0 && (
        <div className="card">
          <h3 className="font-black text-white mb-3">سجل الحالات</h3>
          <div className="space-y-2">
            {booking.statusHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <CheckCircle size={14} className="text-green-400 shrink-0" />
                <span className="text-slate-300">{STATUS_LABELS[h.status] ?? h.status}</span>
                <span className="text-slate-500 text-xs mr-auto">{new Date(h.at).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Button */}
      {!isCompleted && action && (
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => updateStatus(action.next)}
          disabled={isPending}
          className={`w-full ${action.color} text-white font-black py-4 px-6 rounded-2xl text-lg flex items-center justify-center gap-3 transition-all shadow-xl`}
        >
          <span className="text-2xl">{action.icon}</span>
          {isPending ? 'جاري التحديث...' : action.label}
        </motion.button>
      )}

      {/* Payment collection button — shown when in_progress or completed */}
      {(booking.status === 'in_progress' || booking.status === 'completed') && (
        <button
          onClick={() => setShowPayment(true)}
          className="w-full bg-gradient-to-l from-emerald-700 to-teal-600 hover:from-emerald-600 hover:to-teal-500 text-white font-black py-3.5 px-6 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl"
        >
          <CreditCard size={20} />
          تحصيل الدفع — {formatCurrency(booking.totalPrice)}
        </button>
      )}

      {isCompleted && (
        <div className="card bg-green-900/20 border-green-700/30 text-center py-6">
          <div className="text-4xl mb-2">✅</div>
          <p className="font-black text-green-400 text-lg">
            {booking.status === 'completed' ? 'اكتملت الخدمة بنجاح!' : 'تم إلغاء الطلب'}
          </p>
          <div className="flex gap-3 justify-center mt-4">
            <button
              onClick={() => setShowPayment(true)}
              className="flex items-center gap-2 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-emerald-600/30 transition-all"
            >
              <CreditCard size={15} />
              الدفع
            </button>
            <Link
              to={`/app/invoice/${booking.id}`}
              className="flex items-center gap-2 bg-blue-600/20 border border-blue-500/30 text-blue-400 font-semibold text-sm px-4 py-2 rounded-xl hover:bg-blue-600/30 transition-all"
            >
              <FileText size={15} />
              الفاتورة
            </Link>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPayment}
        bookingId={booking.id}
        amount={parseFloat(String(booking.totalPrice ?? 0))}
        onClose={() => setShowPayment(false)}
        onSuccess={() => {
          setShowPayment(false);
          toast.success('تم تسجيل الدفع بنجاح ✅');
          queryClient.invalidateQueries({ queryKey: ['booking-detail', id] });
        }}
      />
    </div>
  );
}
