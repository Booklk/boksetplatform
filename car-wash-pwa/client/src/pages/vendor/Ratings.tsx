import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, MessageSquare, Send, X, CheckCircle } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import axios from 'axios';

const API = import.meta.env.VITE_API_URL ?? '';

interface RatedBooking {
  id: number;
  bookingNumber: string;
  rating: number;
  ratingComment: string | null;
  ratedAt: string;
  vendorReply: string | null;
  vendorRepliedAt: string | null;
  customerName: string;
  packageName: string;
  serviceName: string;
}

function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} className={i <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
      ))}
    </div>
  );
}

function ReplyModal({ booking, onClose }: { booking: RatedBooking; onClose: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [text, setText] = useState(booking.vendorReply ?? '');

  const replyMut = useMutation({
    mutationFn: () => axios.post(`${API}/api/bookings/${booking.id}/reply`, { reply: text }, {
      headers: { Authorization: `Bearer ${token}` },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rated-bookings'] });
      onClose();
    },
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-[#0f1628] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold flex items-center gap-2">
            <MessageSquare size={18} className="text-blue-400" />
            رد على التقييم
          </h3>
          <button onClick={onClose}><X size={18} className="text-slate-400 hover:text-white" /></button>
        </div>

        {/* Customer review */}
        <div className="bg-white/5 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{booking.customerName}</span>
            <Stars rating={booking.rating} />
          </div>
          {booking.ratingComment && (
            <p className="text-sm text-slate-300">{booking.ratingComment}</p>
          )}
          <p className="text-xs text-slate-500 mt-2">
            {new Date(booking.ratedAt).toLocaleDateString('ar-SA')}
          </p>
        </div>

        <div className="mb-4">
          <label className="block text-sm text-slate-400 mb-2">ردك (500 حرف كحد أقصى)</label>
          <textarea value={text} onChange={e => setText(e.target.value)} maxLength={500}
            placeholder="اكتب ردك هنا..."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm h-28 resize-none focus:border-blue-500 focus:outline-none" />
          <p className="text-xs text-slate-500 mt-1 text-left">{text.length}/500</p>
        </div>

        <div className="flex gap-3">
          <button onClick={() => replyMut.mutate()} disabled={replyMut.isPending || text.trim().length < 1}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
            <Send size={15} />
            {replyMut.isPending ? 'جاري الإرسال...' : 'إرسال الرد'}
          </button>
          <button onClick={onClose} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-colors">
            إلغاء
          </button>
        </div>
        {replyMut.isError && <p className="text-red-400 text-xs mt-2 text-center">حدث خطأ، حاول مرة أخرى</p>}
      </motion.div>
    </motion.div>
  );
}

export default function Ratings() {
  const { token } = useAuth();
  const [selected, setSelected] = useState<RatedBooking | null>(null);
  const [filterRating, setFilterRating] = useState<number | null>(null);

  const { data: bookings = [], isLoading } = useQuery<RatedBooking[]>({
    queryKey: ['rated-bookings'],
    queryFn: () => axios.get(`${API}/api/bookings`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => (r.data as any[]).filter((b: any) => b.rating != null).map((b: any) => ({
      id: b.id,
      bookingNumber: b.bookingNumber,
      rating: b.rating,
      ratingComment: b.ratingComment,
      ratedAt: b.ratedAt ?? b.createdAt,
      vendorReply: b.vendorReply,
      vendorRepliedAt: b.vendorRepliedAt,
      customerName: b.customerName ?? 'عميل',
      packageName: b.packageName ?? '',
      serviceName: b.serviceName ?? '',
    }))),
  });

  const filtered = filterRating ? bookings.filter(b => b.rating === filterRating) : bookings;
  const avgRating = bookings.length ? (bookings.reduce((s, b) => s + b.rating, 0) / bookings.length) : 0;
  const repliedCount = bookings.filter(b => b.vendorReply).length;

  return (
    <div className="min-h-screen bg-surface-1 text-white p-4 md:p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Star className="text-yellow-400" size={28} />
          التقييمات
        </h1>
        <p className="text-slate-400 text-sm mt-1">اعرض تقييمات العملاء وردّ عليها</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-yellow-400">{avgRating.toFixed(1)}</p>
          <Stars rating={Math.round(avgRating)} size={14} />
          <p className="text-xs text-slate-400 mt-1">متوسط التقييم</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold">{bookings.length}</p>
          <p className="text-xs text-slate-400 mt-2">إجمالي التقييمات</p>
        </div>
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
          <p className="text-3xl font-bold text-green-400">{repliedCount}</p>
          <p className="text-xs text-slate-400 mt-2">تم الرد عليها</p>
        </div>
      </div>

      {/* Filter by stars */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <span className="text-sm text-slate-400">تصفية:</span>
        <button onClick={() => setFilterRating(null)}
          className={`px-3 py-1 rounded-full text-sm transition-colors ${!filterRating ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300'}`}>
          الكل
        </button>
        {[5,4,3,2,1].map(star => (
          <button key={star} onClick={() => setFilterRating(filterRating === star ? null : star)}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-colors ${filterRating === star ? 'bg-yellow-500/30 text-yellow-300 border border-yellow-500/50' : 'bg-white/10 text-slate-300'}`}>
            {star} <Star size={12} className="fill-yellow-400 text-yellow-400" />
          </button>
        ))}
      </div>

      {/* Reviews list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="h-28 bg-white/5 rounded-2xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <Star size={48} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد تقييمات بعد</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(b => (
            <motion.div key={b.id} layout
              className="bg-white/5 border border-white/10 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="font-medium">{b.customerName}</span>
                    <Stars rating={b.rating} size={14} />
                    <span className="text-xs text-slate-500 mr-auto">
                      #{b.bookingNumber} • {b.serviceName}
                    </span>
                  </div>
                  {b.ratingComment && (
                    <p className="text-sm text-slate-300 mb-3">"{b.ratingComment}"</p>
                  )}
                  {b.vendorReply && (
                    <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 mt-2">
                      <div className="flex items-center gap-1 mb-1">
                        <CheckCircle size={13} className="text-blue-400" />
                        <span className="text-xs text-blue-400">ردك</span>
                      </div>
                      <p className="text-sm text-slate-200">{b.vendorReply}</p>
                    </div>
                  )}
                </div>
                <button onClick={() => setSelected(b)}
                  className={`flex-shrink-0 flex items-center gap-1.5 text-xs px-3 py-2 rounded-xl transition-colors ${
                    b.vendorReply
                      ? 'bg-white/5 hover:bg-white/10 text-slate-400'
                      : 'bg-blue-600/80 hover:bg-blue-600 text-white'
                  }`}>
                  <MessageSquare size={13} />
                  {b.vendorReply ? 'تعديل الرد' : 'رد'}
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selected && <ReplyModal booking={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
    </div>
  );
}
