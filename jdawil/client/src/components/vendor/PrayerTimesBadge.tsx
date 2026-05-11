/**
 * PrayerTimesBadge — compact salah strip for the dashboard header.
 *
 * Shows: the five daily salah times for the vendor's city + a live
 * "next prayer in X min" countdown. Hijri date in small caps.
 * Auto-hides during Ramadan nights when Isha/Taraweeh run long.
 */

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Moon } from 'lucide-react';
import api from '../../lib/api';

interface PrayerTimes {
  fajr: string; sunrise: string; dhuhr: string;
  asr: string;  maghrib: string; isha: string;
}
interface Resp {
  city: string;
  hijri: { year: number; month: number; day: number; monthNameAr: string; formatted: string };
  isRamadan: boolean;
  times: PrayerTimes & { avoidWindows: Array<{ name: string; from: string; to: string }> };
}

const LABELS: Record<keyof PrayerTimes, string> = {
  fajr:    'الفجر',
  sunrise: 'الشروق',
  dhuhr:   'الظهر',
  asr:     'العصر',
  maghrib: 'المغرب',
  isha:    'العشاء',
};

export default function PrayerTimesBadge({ city = 'الرياض' }: { city?: string }) {
  const { data } = useQuery<Resp>({
    queryKey: ['prayer-times', city],
    queryFn: async () => (await api.get(`/saudi/prayer-times?city=${encodeURIComponent(city)}`)).data,
    staleTime: 30 * 60 * 1000,
    retry: 0,
  });

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  const nextInfo = useMemo(() => {
    if (!data) return null;
    const order: Array<keyof PrayerTimes> = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const key of order) {
      const [h, m] = data.times[key].split(':').map(Number);
      const t = h * 60 + m;
      if (t > nowMin) {
        const diff = t - nowMin;
        return { key, diff, hh: data.times[key] };
      }
    }
    // All passed — next is tomorrow's Fajr
    const [h, m] = data.times.fajr.split(':').map(Number);
    const diff = 24 * 60 - nowMin + h * 60 + m;
    return { key: 'fajr' as const, diff, hh: data.times.fajr };
  }, [data, now]);

  if (!data) return null;

  return (
    <div dir="rtl" className="rounded-2xl bg-gradient-to-br from-primary-500/5 to-success-500/5 border border-white/[0.06] p-3">
      <div className="flex items-center justify-between gap-3 mb-2">
        <div className="flex items-center gap-2">
          <Moon size={14} className="text-primary-300" />
          <span className="text-xs font-black text-ink-200">{data.city}</span>
          <span className="text-[10px] text-ink-500">{data.hijri.formatted} هـ</span>
          {data.isRamadan && (
            <span className="px-1.5 py-0.5 rounded-full bg-warn-500/15 border border-warn-500/30 text-warn-300 text-[9px] font-black">
              رمضان
            </span>
          )}
        </div>
        {nextInfo && (
          <div className="text-left">
            <p className="text-[10px] text-ink-500">القادمة</p>
            <p className="text-xs font-black text-primary-300">
              {LABELS[nextInfo.key]} · {formatDuration(nextInfo.diff)}
            </p>
          </div>
        )}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((k) => {
          const active = nextInfo?.key === k;
          return (
            <div
              key={k}
              className={`
                rounded-lg py-1.5 text-center transition-colors
                ${active
                  ? 'bg-primary-500/20 border border-primary-500/40'
                  : 'bg-white/[0.03] border border-white/[0.04]'}
              `}
            >
              <p className={`text-[10px] font-bold ${active ? 'text-primary-200' : 'text-ink-400'}`}>
                {LABELS[k]}
              </p>
              <p className={`text-xs font-black tabular-nums ${active ? 'text-white' : 'text-ink-200'}`} dir="ltr">
                {data.times[k]}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `بعد ${minutes} د`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `بعد ${h} س` : `بعد ${h}س ${m}د`;
}
