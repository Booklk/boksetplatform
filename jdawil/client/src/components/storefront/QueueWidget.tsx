/**
 * QueueWidget — Live queue status + "take a number" CTA for storefronts
 * that declared `features.queue` (barber, salon, fixed-wash).
 *
 * Reads GET /api/queue/current?slug=... and POSTs to /api/queue/ticket.
 * Uses the vendor's CustomTheme button colour for CTAs.
 */

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { Users, Clock, Ticket, X, CheckCircle } from 'lucide-react';
import api from '../../lib/api';

interface QueueStatus {
  isOpen: boolean;
  currentNumber: number;
  waitingCount: number;
  totalServed: number;
  estimatedWaitMinutes?: number;
}

interface IssuedTicket {
  ticketNumber: number;
  position: number;
  estimatedWaitMinutes: number;
}

export default function QueueWidget({
  vendorSlug,
  accent,
  surface,
  text,
  radius,
}: {
  vendorSlug: string;
  /** Brand colour for the primary button (customTheme.button). */
  accent: string;
  /** Card background (customTheme.surface). */
  surface: string;
  /** Body text colour (customTheme.text). */
  text: string;
  /** CSS border-radius value (customTheme radius). */
  radius: string;
}) {
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [issued, setIssued] = useState<IssuedTicket | null>(null);
  const [form, setForm] = useState({ customerName: '', customerPhone: '' });

  const { data: status, isLoading } = useQuery<QueueStatus>({
    queryKey: ['queue-status', vendorSlug],
    queryFn: () => api.get(`/queue/current?slug=${encodeURIComponent(vendorSlug)}`).then((r) => r.data),
    refetchInterval: 15_000, // refresh every 15s
    enabled: !!vendorSlug,
  });

  const takeNumber = useMutation({
    mutationFn: () =>
      api
        .post('/queue/ticket', {
          vendorSlug,
          customerName: form.customerName || undefined,
          customerPhone: form.customerPhone || undefined,
        })
        .then((r) => r.data as IssuedTicket),
    onSuccess: (ticket) => {
      setIssued(ticket);
      qc.invalidateQueries({ queryKey: ['queue-status', vendorSlug] });
    },
    onError: (e: { response?: { data?: { error?: string } } }) => {
      toast.error(e?.response?.data?.error ?? 'تعذّر أخذ الرقم — حاول مرة أخرى');
    },
  });

  if (isLoading) return null;
  if (!status) return null;

  return (
    <>
      <div
        className="p-5 border"
        style={{
          background: surface,
          borderRadius: radius,
          borderColor: `${accent}33`,
          color: text,
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Ticket size={18} style={{ color: accent }} />
          <h3 className="text-base font-black">الطابور الحالي</h3>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full mr-auto"
            style={{
              background: status.isOpen ? '#10b98130' : '#ef444430',
              color: status.isOpen ? '#34d399' : '#f87171',
            }}
          >
            {status.isOpen ? '● مفتوح' : '● مغلق'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <Stat
            label="الرقم الحالي"
            value={status.currentNumber > 0 ? String(status.currentNumber) : '—'}
            accent={accent}
            text={text}
            radius={radius}
          />
          <Stat
            label="في الانتظار"
            value={String(status.waitingCount)}
            icon={<Users size={14} />}
            accent={accent}
            text={text}
            radius={radius}
          />
          <Stat
            label="وقت الانتظار"
            value={
              status.estimatedWaitMinutes
                ? `${status.estimatedWaitMinutes} د`
                : '—'
            }
            icon={<Clock size={14} />}
            accent={accent}
            text={text}
            radius={radius}
          />
        </div>

        <button
          onClick={() => {
            if (!status.isOpen) {
              toast.error('الطابور مغلق حاليًا');
              return;
            }
            setModalOpen(true);
          }}
          disabled={!status.isOpen}
          className="w-full py-3 font-black text-white text-sm transition-opacity disabled:opacity-50"
          style={{ background: accent, borderRadius: radius }}
        >
          خذ رقمك في الطابور
        </button>
        <p className="text-[11px] opacity-60 text-center mt-2">
          بدون تسجيل — اكتب رقمك واحصل على رقمك فورًا
        </p>
      </div>

      {/* ── Modal: issue a ticket ─────────────────────────────────────────── */}
      <AnimatePresence>
        {modalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
              onClick={() => {
                if (!takeNumber.isPending) {
                  setModalOpen(false);
                  setIssued(null);
                  setForm({ customerName: '', customerPhone: '' });
                }
              }}
            />
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="fixed inset-x-4 bottom-4 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-md z-50 p-6 border"
              style={{ background: surface, color: text, borderRadius: radius, borderColor: `${accent}40` }}
              dir="rtl"
            >
              {issued ? (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold opacity-60">تم بنجاح</span>
                    <button onClick={() => { setModalOpen(false); setIssued(null); setForm({ customerName: '', customerPhone: '' }); }}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="text-center py-4">
                    <div
                      className="inline-flex items-center justify-center w-16 h-16 mb-3"
                      style={{ background: `${accent}20`, borderRadius: '50%' }}
                    >
                      <CheckCircle size={32} style={{ color: accent }} />
                    </div>
                    <p className="text-xs opacity-70 mb-1">رقمك</p>
                    <p className="text-5xl font-black mb-4" style={{ color: accent }}>
                      #{issued.ticketNumber}
                    </p>
                    <div className="grid grid-cols-2 gap-2 text-center">
                      <div className="p-3 border" style={{ borderColor: `${accent}33`, borderRadius: radius }}>
                        <p className="text-[10px] opacity-60">ترتيبك</p>
                        <p className="text-lg font-black">{issued.position}</p>
                      </div>
                      <div className="p-3 border" style={{ borderColor: `${accent}33`, borderRadius: radius }}>
                        <p className="text-[10px] opacity-60">الانتظار المتوقع</p>
                        <p className="text-lg font-black">
                          {issued.estimatedWaitMinutes > 0 ? `${issued.estimatedWaitMinutes} د` : 'الآن'}
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] opacity-60 mt-4">
                      احتفظ برقمك — سيُنادى عليك عند حلول دورك
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-black">خذ رقمك</h3>
                    <button onClick={() => setModalOpen(false)}>
                      <X size={18} />
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-bold opacity-70 mb-1 block">الاسم (اختياري)</label>
                      <input
                        type="text"
                        value={form.customerName}
                        onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                        placeholder="اسمك"
                        className="w-full p-3 text-sm outline-none border"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: text,
                          borderColor: `${accent}30`,
                          borderRadius: radius,
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold opacity-70 mb-1 block">رقم الجوال (اختياري)</label>
                      <input
                        type="tel"
                        value={form.customerPhone}
                        onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))}
                        placeholder="05XXXXXXXX"
                        dir="ltr"
                        className="w-full p-3 text-sm outline-none border"
                        style={{
                          background: 'rgba(255,255,255,0.04)',
                          color: text,
                          borderColor: `${accent}30`,
                          borderRadius: radius,
                        }}
                      />
                    </div>
                    <button
                      onClick={() => takeNumber.mutate()}
                      disabled={takeNumber.isPending}
                      className="w-full py-3 font-black text-white text-sm transition-opacity disabled:opacity-50"
                      style={{ background: accent, borderRadius: radius }}
                    >
                      {takeNumber.isPending ? 'جاري التسجيل...' : 'احصل على رقمي'}
                    </button>
                    <p className="text-[11px] opacity-60 text-center">
                      بيانات اختيارية — نستخدمها فقط لإشعارك عند اقتراب دورك
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Stat({
  label,
  value,
  icon,
  accent,
  text,
  radius,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent: string;
  text: string;
  radius: string;
}) {
  return (
    <div
      className="p-3 text-center border"
      style={{ borderColor: `${accent}20`, borderRadius: radius, color: text }}
    >
      <div className="flex items-center justify-center gap-1 text-[10px] opacity-70 mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-xl font-black" style={{ color: accent }}>
        {value}
      </p>
    </div>
  );
}
