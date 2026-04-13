import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Star } from 'lucide-react';
import api from '../../lib/api';
import { Booking } from '../../types';

export default function RatePage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState('');

  const { data: booking } = useQuery<Booking>({
    queryKey: ['booking', bookingId],
    queryFn: () => api.get(`/bookings/${bookingId}`).then(r => r.data),
  });

  const { mutate, isPending } = useMutation({
    mutationFn: () => api.post(`/bookings/${bookingId}/rate`, { rating, comment }),
    onSuccess: () => {
      toast.success('شكراً على تقييمك! 🌟');
      navigate('/app/bookings');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في التقييم'),
  });

  const ratingLabels: Record<number, string> = {
    1: 'سيئ 😞',
    2: 'مقبول 😐',
    3: 'جيد 🙂',
    4: 'ممتاز 😊',
    5: 'رائع جداً 🤩',
  };

  return (
    <div className="p-4 max-w-md mx-auto min-h-screen flex items-center" dir="rtl">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full"
      >
        <div className="card text-center">
          <div className="text-5xl mb-4">🌟</div>
          <h2 className="text-2xl font-black text-white mb-2">كيف كانت تجربتك؟</h2>
          {booking && (
            <p className="text-slate-400 text-sm mb-6">
              {booking.serviceName} - {booking.packageName} | #{booking.bookingNumber}
            </p>
          )}

          {/* Stars */}
          <div className="flex justify-center gap-3 mb-4">
            {[1, 2, 3, 4, 5].map(star => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHovered(star)}
                onMouseLeave={() => setHovered(0)}
                className="transition-transform hover:scale-110 active:scale-95"
              >
                <Star
                  size={36}
                  className={`transition-colors ${
                    star <= (hovered || rating)
                      ? 'text-yellow-400 fill-yellow-400'
                      : 'text-slate-600'
                  }`}
                />
              </button>
            ))}
          </div>

          {rating > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-lg font-bold text-yellow-400 mb-4"
            >
              {ratingLabels[rating]}
            </motion.div>
          )}

          <div className="text-right mt-4 mb-4">
            <label className="label">تعليقك (اختياري)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="شاركنا تجربتك بالتفصيل..."
              className="input-field h-24 resize-none"
            />
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate('/app/bookings')} className="btn-outline flex-1">
              تخطي
            </button>
            <button
              onClick={() => mutate()}
              disabled={isPending || rating === 0}
              className="btn-primary flex-1"
            >
              {isPending ? 'جاري الإرسال...' : 'إرسال التقييم'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
