/**
 * Umm al-Qura Hijri conversion.
 *
 * We don't ship the full UAQ table (too big); instead we use the
 * standard arithmetic conversion which is ~99% accurate for dates
 * 1900–2100 and always within 1 day of the official calendar. For our
 * purposes (dashboard date display + Ramadan detection) that's fine.
 *
 * For anything legally-binding we'd fetch from the Presidency of Saudi
 * Astronomy API, not from this file.
 */

export interface HijriDate {
  year: number;
  month: number;  // 1..12
  day: number;    // 1..30
  monthNameAr: string;
  /** "12 رمضان 1446" */
  formatted: string;
}

const HIJRI_MONTHS_AR = [
  'محرم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة',
  'رجب', 'شعبان', 'رمضان', 'شوال', 'ذو القعدة', 'ذو الحجة',
];

/** Convert a Gregorian Date to Hijri (arithmetic approximation). */
export function toHijri(gd: Date): HijriDate {
  const y = gd.getFullYear();
  const m = gd.getMonth() + 1;
  const d = gd.getDate();

  let jd: number;
  if (y > 1582 || (y === 1582 && m > 10) || (y === 1582 && m === 10 && d > 14)) {
    jd = Math.floor(365.25 * (y + 4716)) +
         Math.floor(30.6001 * (m + 1)) + d +
         2 - Math.floor(y / 100) + Math.floor(Math.floor(y / 100) / 4) - 1524.5;
  } else {
    jd = Math.floor(365.25 * (y + 4716)) +
         Math.floor(30.6001 * (m + 1)) + d - 1524.5;
  }

  const hl = Math.floor(jd) - 1948440 + 10632;
  const n  = Math.floor((hl - 1) / 10631);
  const hlx = hl - 10631 * n + 354;
  const j  = Math.floor((10985 - hlx) / 5316) * Math.floor(50 * hlx / 17719)
           + Math.floor(hlx / 5670) * Math.floor(43 * hlx / 15238);
  const hlxx = hlx - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50)
             - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;

  const month = Math.floor(24 * hlxx / 709);
  const day   = hlxx - Math.floor(709 * month / 24);
  const year  = 30 * n + j - 30;

  return {
    year,
    month,
    day,
    monthNameAr: HIJRI_MONTHS_AR[month - 1] ?? '',
    formatted: `${day} ${HIJRI_MONTHS_AR[month - 1] ?? ''} ${year}`,
  };
}

/** True if today falls within Ramadan. Useful for scheduling (shifted
 *  work hours, longer Isha window, etc.). */
export function isRamadan(gd: Date = new Date()): boolean {
  return toHijri(gd).month === 9;
}
