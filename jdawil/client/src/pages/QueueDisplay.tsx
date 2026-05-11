import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

interface VendorInfo {
  id: number;
  nameAr: string;
  logoUrl?: string;
  primaryColor?: string;
}

interface QueueStatus {
  isOpen: boolean;
  currentNumber: number;
  waitingCount: number;
  totalServed: number;
  estimatedWaitMinutes: number;
  recentCompleted: Array<{ ticketNumber: number; customerName?: string; completedAt?: string }>;
}

// ─── QR image URL (using a public QR generation API) ─────────────────────────
function qrUrl(text: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(text)}&bgcolor=111827&color=ffffff&margin=1`;
}

// ─── Arabic number formatting ─────────────────────────────────────────────────
function toArabicNumerals(n: number): string {
  return n.toLocaleString('ar-SA');
}

// ─── Scrolling ticker item ─────────────────────────────────────────────────────
function Ticker({ items }: { items: Array<{ ticketNumber: number; customerName?: string }> }) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden whitespace-nowrap">
      <motion.div
        animate={{ x: ['0%', '-50%'] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        className="inline-block"
      >
        {[...items, ...items].map((item, i) => (
          <span key={i} className="inline-block mx-8 text-sm opacity-70">
            ✓ تم خدمة #{item.ticketNumber}
            {item.customerName ? ` — ${item.customerName}` : ''}
          </span>
        ))}
      </motion.div>
    </div>
  );
}

// ─── Big Number Display ────────────────────────────────────────────────────────
function BigNumber({
  label,
  value,
  color,
  size = 'xl',
}: {
  label: string;
  value: string | number;
  color: string;
  size?: 'xl' | 'lg';
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-white/50 text-lg md:text-xl font-semibold tracking-wide">{label}</p>
      <AnimatePresence mode="wait">
        <motion.div
          key={String(value)}
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 1.2, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          className={`font-black leading-none ${color} ${
            size === 'xl'
              ? 'text-[8rem] md:text-[12rem]'
              : 'text-[5rem] md:text-[8rem]'
          }`}
        >
          {value}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QueueDisplay() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>();
  const joinUrl = `${window.location.origin}/queue/${vendorSlug}/join`;

  // Fetch vendor info
  const { data: vendorData } = useQuery<VendorInfo>({
    queryKey: ['vendor-info-display', vendorSlug],
    queryFn: async () => {
      const { data } = await api.get(`/vendors/public/${vendorSlug}`);
      return data;
    },
    staleTime: 60000,
  });

  // Fetch queue status — poll every 10s
  const { data: queueStatus } = useQuery<QueueStatus>({
    queryKey: ['queue-current-display', vendorSlug],
    queryFn: async () => {
      const { data } = await api.get('/queue/current', { params: { slug: vendorSlug } });
      return data;
    },
    refetchInterval: 10000,
  });

  const primaryColor = vendorData?.primaryColor ?? '#3b82f6';
  const vendorName = vendorData?.nameAr ?? 'مغسلة السيارات';
  const currentNumber = queueStatus?.currentNumber ?? 0;
  const waitingCount = queueStatus?.waitingCount ?? 0;
  const isOpen = queueStatus?.isOpen ?? false;

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0d1117] text-white flex flex-col"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      {/* ── Background glow ─────────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-0 right-0 w-[800px] h-[600px] rounded-full blur-[200px] opacity-15"
          style={{ background: primaryColor }}
        />
        <div
          className="absolute bottom-0 left-0 w-[600px] h-[500px] rounded-full blur-[180px] opacity-10"
          style={{ background: primaryColor }}
        />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-center gap-4 py-6 px-8 border-b border-white/10">
        {vendorData?.logoUrl && (
          <img
            src={vendorData.logoUrl}
            alt={vendorName}
            className="w-14 h-14 rounded-2xl object-cover border border-white/10"
          />
        )}
        <div className="text-center">
          <h1 className="text-3xl md:text-4xl font-black text-white">{vendorName}</h1>
          <div className="flex items-center justify-center gap-2 mt-1">
            <span
              className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-red-400'} animate-pulse`}
            />
            <span className={`text-sm ${isOpen ? 'text-emerald-400' : 'text-red-400'}`}>
              {isOpen ? 'الطابور مفتوح' : 'الطابور مغلق'}
            </span>
          </div>
        </div>
      </header>

      {/* ── Main body ───────────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-5xl">
          {/* ── Numbers row ─────────────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-24 mb-12">
            <BigNumber
              label="يُخدَم الآن"
              value={currentNumber > 0 ? toArabicNumerals(currentNumber) : '—'}
              color="text-blue-400"
              size="xl"
            />
            <div className="hidden md:block w-px h-48 bg-white/10" />
            <BigNumber
              label="في الانتظار"
              value={toArabicNumerals(waitingCount)}
              color="text-amber-400"
              size="lg"
            />
          </div>

          {/* ── QR Section ──────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-4">
            <p className="text-white/60 text-lg">رقّم نفسك — امسح الكود</p>
            <div
              className="p-4 rounded-3xl border border-white/10"
              style={{ background: '#111827' }}
            >
              <img
                src={qrUrl(joinUrl)}
                alt="QR Code"
                className="w-[180px] h-[180px] md:w-[220px] md:h-[220px] rounded-xl"
                loading="lazy"
              />
            </div>
            <p className="text-white/30 text-sm">{joinUrl}</p>
          </div>
        </div>
      </main>

      {/* ── Ticker ──────────────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 py-3 px-4 border-t border-white/10"
        style={{ background: 'rgba(0,0,0,0.5)' }}
      >
        <Ticker items={queueStatus?.recentCompleted ?? []} />
        {(!queueStatus?.recentCompleted?.length) && (
          <p className="text-center text-white/20 text-sm">لم تكتمل خدمات بعد اليوم</p>
        )}
      </footer>
    </div>
  );
}
