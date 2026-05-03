import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Calendar, Clock } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  bookingId: number;
  currentScheduledAt: string;
  onClose: () => void;
}

/**
 * Self-service reschedule for the customer. Picks a new date+time and
 * posts /api/bookings/:id/reschedule. Server enforces 2h-future rule
 * and 2-reschedule-per-booking cap.
 */
export function RescheduleModal({ bookingId, currentScheduledAt, onClose }: Props) {
  const qc = useQueryClient();
  const initial = new Date(Math.max(Date.now() + 3 * 60 * 60 * 1000, new Date(currentScheduledAt).getTime()));
  const initialDate = initial.toISOString().slice(0, 10);
  const initialTime = initial.toTimeString().slice(0, 5);

  const [date, setDate] = useState(initialDate);
  const [time, setTime] = useState(initialTime);
  const [reason, setReason] = useState('');

  const minDate = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const submit = useMutation({
    mutationFn: async () => {
      const iso = new Date(`${date}T${time}:00`).toISOString();
      return (await api.post(`/bookings/${bookingId}/reschedule`, {
        scheduledAt: iso,
        reason: reason || undefined,
      })).data;
    },
    onSuccess: () => {
      toast.success('تم تغيير الموعد. أبلغنا التاجر.');
      qc.invalidateQueries({ queryKey: ['booking', bookingId] });
      qc.invalidateQueries({ queryKey: ['my-bookings'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر تغيير الموعد'),
  });

  return (
    <div
      dir="rtl"
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d1929] border border-white/10 rounded-2xl w-full max-w-md p-5 sm:p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-400" />
            تغيير الموعد
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10">
            <X className="w-4 h-4 mx-auto text-slate-400" />
          </button>
        </div>

        <p className="text-slate-400 text-xs mb-5 leading-relaxed">
          الموعد الحالي: {new Date(currentScheduledAt).toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' })}
          <br />
          الموعد الجديد يجب أن يكون بعد ساعتين على الأقل من الآن.
        </p>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">التاريخ الجديد</label>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500/60"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">الوقت الجديد</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500/60"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">السبب (اختياري)</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ظرف طارئ، تأخر، إلخ"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500/60 h-20 resize-none"
              maxLength={300}
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5"
          >
            إلغاء
          </button>
          <button
            onClick={() => submit.mutate()}
            disabled={submit.isPending}
            className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5" />
            {submit.isPending ? 'جاري التغيير…' : 'تأكيد الموعد الجديد'}
          </button>
        </div>
      </div>
    </div>
  );
}
