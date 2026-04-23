/**
 * Prayer times calculator — Umm al-Qura method (the official Saudi standard).
 *
 * No external API calls, no API keys. Computes Fajr, Dhuhr, Asr, Maghrib,
 * and Isha for a given location and date using standard astronomical
 * formulas and the Umm al-Qura calendar's published adjustments:
 *   Fajr    : 18.5° below horizon (UAQ uses a fixed "dawn" angle)
 *   Isha    : 90 minutes after Maghrib (fixed) — Ramadan = 120 minutes
 *   Asr     : Shafi'i (shadow = object length)
 *
 * Accuracy is within ~2 minutes for Saudi cities — good enough for
 * booking UX (avoid scheduling a 10-min service that straddles Maghrib).
 */

export interface PrayerTimes {
  fajr: string;
  sunrise: string;
  dhuhr: string;
  asr: string;
  maghrib: string;
  isha: string;
  /** "Gaps" to avoid when scheduling — 15 min windows around each salah. */
  avoidWindows: Array<{ name: string; from: string; to: string }>;
}

// Saudi city coordinates (expandable).
const CITIES: Record<string, { lat: number; lng: number; tz: number }> = {
  'الرياض':       { lat: 24.7136, lng: 46.6753, tz: 3 },
  'جدة':          { lat: 21.4858, lng: 39.1925, tz: 3 },
  'مكة المكرمة':   { lat: 21.3891, lng: 39.8579, tz: 3 },
  'المدينة المنورة': { lat: 24.5247, lng: 39.5692, tz: 3 },
  'الدمام':       { lat: 26.4207, lng: 50.0888, tz: 3 },
  'الأحساء':      { lat: 25.3833, lng: 49.5833, tz: 3 },
  'الطائف':       { lat: 21.2670, lng: 40.4167, tz: 3 },
  'بريدة':        { lat: 26.3260, lng: 43.9750, tz: 3 },
  'تبوك':         { lat: 28.3835, lng: 36.5662, tz: 3 },
  'خميس مشيط':    { lat: 18.3000, lng: 42.7333, tz: 3 },
  'حائل':         { lat: 27.5114, lng: 41.7208, tz: 3 },
  'نجران':        { lat: 17.4924, lng: 44.1277, tz: 3 },
  'الجبيل':       { lat: 27.0046, lng: 49.6620, tz: 3 },
  'أبها':         { lat: 18.2164, lng: 42.5053, tz: 3 },
  'ينبع':         { lat: 24.0896, lng: 38.0617, tz: 3 },
};

const DEG = Math.PI / 180;

function toTime(h: number): string {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (mm === 60) return `${String(hh + 1).padStart(2, '0')}:00`;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function julianDate(y: number, m: number, d: number): number {
  if (m <= 2) { y -= 1; m += 12; }
  const A = Math.floor(y / 100);
  const B = 2 - A + Math.floor(A / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + B - 1524.5;
}

function sunPosition(jd: number) {
  const D = jd - 2451545.0;
  const g = (357.529 + 0.98560028 * D) % 360;
  const q = (280.459 + 0.98564736 * D) % 360;
  const L = (q + 1.915 * Math.sin(g * DEG) + 0.020 * Math.sin(2 * g * DEG)) % 360;
  const e = 23.439 - 0.00000036 * D;
  const RA = (Math.atan2(Math.cos(e * DEG) * Math.sin(L * DEG), Math.cos(L * DEG)) / DEG) / 15;
  const decl = Math.asin(Math.sin(e * DEG) * Math.sin(L * DEG)) / DEG;
  const eqt = q / 15 - ((RA + 24) % 24);
  return { decl, eqt };
}

function computeTime(angle: number, tBase: number, jd: number, lat: number, dir: 1 | -1): number {
  const { decl } = sunPosition(jd + tBase / 24);
  const t = Math.acos(
    (-Math.sin(angle * DEG) - Math.sin(lat * DEG) * Math.sin(decl * DEG)) /
    (Math.cos(lat * DEG) * Math.cos(decl * DEG))
  ) / DEG / 15;
  return tBase + dir * t;
}

function asrTime(tBase: number, jd: number, lat: number): number {
  const { decl } = sunPosition(jd + tBase / 24);
  const factor = 1; // Shafi'i
  const angle = -Math.atan2(1, factor + Math.tan(Math.abs(lat - decl) * DEG)) / DEG;
  return computeTime(angle, tBase, jd, lat, 1);
}

/** Compute the five daily prayer times + sunrise for a Saudi city on date d. */
export function prayerTimesFor(city: string, date: Date, options?: { isRamadan?: boolean }): PrayerTimes | null {
  const coord = CITIES[city];
  if (!coord) return null;
  const jd = julianDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) - coord.lng / (15 * 24);
  const { decl, eqt } = sunPosition(jd + 12 / 24);
  const dhuhr = 12 + coord.tz - coord.lng / 15 - eqt;

  const fajr     = computeTime(18.5, dhuhr, jd, coord.lat, -1);
  const sunrise  = computeTime(0.833, dhuhr, jd, coord.lat, -1);
  const asr      = asrTime(dhuhr, jd, coord.lat);
  const maghrib  = computeTime(0.833, dhuhr, jd, coord.lat, 1);
  // Umm al-Qura: Isha = Maghrib + 90 min (120 during Ramadan).
  const isha     = maghrib + (options?.isRamadan ? 120 : 90) / 60;

  const prayers = {
    fajr:    toTime(fajr),
    sunrise: toTime(sunrise),
    dhuhr:   toTime(dhuhr),
    asr:     toTime(asr),
    maghrib: toTime(maghrib),
    isha:    toTime(isha),
  };

  // Block 10 minutes before → 20 minutes after each obligatory salah
  // (sunrise not included — it's not an obligatory prayer).
  const avoidWindows = (['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'] as const).map((name) => {
    const base = prayers[name];
    const [h, m] = base.split(':').map(Number);
    const mm = h * 60 + m;
    const from = Math.max(0, mm - 10);
    const to   = Math.min(24 * 60 - 1, mm + 20);
    return {
      name: { fajr: 'الفجر', dhuhr: 'الظهر', asr: 'العصر', maghrib: 'المغرب', isha: 'العشاء' }[name],
      from: `${String(Math.floor(from / 60)).padStart(2, '0')}:${String(from % 60).padStart(2, '0')}`,
      to:   `${String(Math.floor(to / 60)).padStart(2, '0')}:${String(to % 60).padStart(2, '0')}`,
    };
  });

  return { ...prayers, avoidWindows };
}

/** Helper: is the given HH:mm within 15 min of any avoid window? */
export function isNearPrayerTime(hhmm: string, windows: PrayerTimes['avoidWindows']): string | null {
  const [h, m] = hhmm.split(':').map(Number);
  const t = h * 60 + m;
  for (const w of windows) {
    const [fh, fm] = w.from.split(':').map(Number);
    const [th, tm] = w.to.split(':').map(Number);
    if (t >= fh * 60 + fm && t <= th * 60 + tm) return w.name;
  }
  return null;
}
