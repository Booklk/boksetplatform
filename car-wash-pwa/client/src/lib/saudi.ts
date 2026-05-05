/**
 * Saudi cultural helpers — small touches that make the platform feel
 * like it was built by Saudis, for Saudis.
 *
 * - getSaudiGreeting: time + day + month aware (Friday morning, Ramadan,
 *   National Day, Eid) so the dashboard greets each visit with context.
 * - SAUDI_DIALECT: word swaps to nudge formal Modern Standard Arabic
 *   into natural Saudi spoken style.
 * - formatSaudiCurrency / formatSaudiDate: locale-correct outputs.
 */

const RAMADAN_MONTH = 9; // Hijri month — used by Intl
const NATIONAL_DAY_MONTH = 8; // 0-indexed September
const NATIONAL_DAY_DAY = 23;

export type GreetingContext =
  | { kind: 'friday_morning' }
  | { kind: 'morning' }
  | { kind: 'midday' }
  | { kind: 'evening' }
  | { kind: 'night' }
  | { kind: 'national_day' }
  | { kind: 'ramadan_morning' }
  | { kind: 'ramadan_evening' };

export function getSaudiContext(now = new Date()): GreetingContext {
  const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const hour = now.getHours();
  const month = now.getMonth();
  const date = now.getDate();

  // National Day (Sept 23)
  if (month === NATIONAL_DAY_MONTH && date === NATIONAL_DAY_DAY) {
    return { kind: 'national_day' };
  }

  // Hijri month detection — best-effort using Intl.
  let hijriMonth = -1;
  try {
    const fmt = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', { month: 'numeric' });
    hijriMonth = parseInt(fmt.format(now), 10);
  } catch {
    /* ignore — falls through to non-Ramadan flow */
  }

  if (hijriMonth === RAMADAN_MONTH) {
    return hour >= 4 && hour < 18 ? { kind: 'ramadan_morning' } : { kind: 'ramadan_evening' };
  }

  if (day === 5 && hour < 14) return { kind: 'friday_morning' };

  if (hour < 11) return { kind: 'morning' };
  if (hour < 16) return { kind: 'midday' };
  if (hour < 20) return { kind: 'evening' };
  return { kind: 'night' };
}

/**
 * Saudi-style greeting for a given user. Use the result as the
 * leading line on the dashboard, in WhatsApp, in emails — anywhere
 * we address the merchant directly.
 */
export function getSaudiGreeting(name?: string | null, now = new Date()): string {
  const ctx = getSaudiContext(now);
  const safe = (name ?? '').trim();
  const addr = safe ? `يا ${safe}` : '';

  switch (ctx.kind) {
    case 'national_day':
      return `كل عام والمملكة بخير 🇸🇦 ${addr}`.trim();
    case 'ramadan_morning':
      return `صبّحك الله بالخير ${addr} 🌙`.trim();
    case 'ramadan_evening':
      return `أفطر هنيئاً ${addr} ✨`.trim();
    case 'friday_morning':
      return `جمعة مباركة ${addr} 🤲`.trim();
    case 'morning':
      return `صباح الخير ${addr} ☀️`.trim();
    case 'midday':
      return `أهلاً ${addr || 'بك'}`.trim();
    case 'evening':
      return `مساء الخير ${addr} 🌇`.trim();
    case 'night':
      return `مسائك سعد ${addr} 🌙`.trim();
  }
}

/**
 * Saudi dialect lexicon. Replace MSA particles/verbs with the
 * spoken equivalent the merchant uses every day. Use for copywriting,
 * not for legal/contractual text (terms, invoices, ZATCA payloads
 * stay in formal Arabic).
 */
export const SAUDI_DIALECT = {
  yes: 'إيه',
  no: 'لا',
  ok: 'تمام',
  done: 'خلصنا',
  notReally: 'موب بالضبط',
  notRight: 'موب صحيح',
  notSuitable: 'موب مناسب',
  tryAgain: 'حاول مرة ثانية',
  thanks: 'تسلم',
  please: 'لو سمحت',
  problem: 'مشكلة',
  noProblem: 'مالها خاطر',
  ready: 'جاهز',
  comingSoon: 'قريب',
  // Honorifics
  brother: 'أخوي',
  sister: 'أختي',
  // CTA-style
  letsGo: 'يلا نبدأ',
  takeMe: 'ودّيني',
  showMe: 'وريني',
} as const;

/**
 * Format a SAR amount in the Saudi convention — Arabic digits, comma
 * thousands separator, "ر.س" suffix.
 */
export function fmtSar(amount: number, opts: { decimals?: number; ar?: boolean } = {}): string {
  const { decimals = 0, ar = true } = opts;
  const n = ar
    ? new Intl.NumberFormat('ar-SA', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      }).format(amount)
    : amount.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });
  return `${n} ر.س`;
}

/**
 * Saudi dual-calendar formatter — "الأحد ١٤ شعبان (٢٧ يناير)".
 * Falls back to Gregorian-only on environments missing Intl Islamic.
 */
export function fmtSaudiDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return '';
  const greg = new Intl.DateTimeFormat('ar-SA', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  }).format(date);
  try {
    const hijri = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
    }).format(date);
    return `${greg} (${hijri})`;
  } catch {
    return greg;
  }
}
