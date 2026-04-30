/**
 * Saudi-native helpers — prayer times + Hijri conversion. Public-ish
 * (anyone authenticated) because the output is not tenant-specific.
 */

import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { prayerTimesFor, isNearPrayerTime } from '../services/saudi/prayerTimes.js';
import { toHijri, isRamadan } from '../services/saudi/hijri.js';

const router = Router();
router.use(requireAuth);

// GET /api/saudi/prayer-times?city=الرياض&date=YYYY-MM-DD
router.get('/prayer-times', async (req: AuthRequest, res) => {
  const city = String(req.query.city ?? 'الرياض');
  const dateStr = String(req.query.date ?? '');
  const date = dateStr ? new Date(dateStr) : new Date();
  const hijri = toHijri(date);
  const times = prayerTimesFor(city, date, { isRamadan: hijri.month === 9 });
  if (!times) return res.status(404).json({ error: 'مدينة غير مدعومة' });
  res.set('Cache-Control', 'public, max-age=3600');
  return res.json({
    city,
    date: date.toISOString().slice(0, 10),
    hijri,
    isRamadan: hijri.month === 9,
    times,
  });
});

// GET /api/saudi/hijri?date=YYYY-MM-DD → Hijri equivalent
router.get('/hijri', async (req: AuthRequest, res) => {
  const dateStr = String(req.query.date ?? '');
  const date = dateStr ? new Date(dateStr) : new Date();
  const h = toHijri(date);
  res.set('Cache-Control', 'public, max-age=86400');
  return res.json({ ...h, isRamadan: isRamadan(date) });
});

// POST /api/saudi/check-booking-time
// Body: { city, time: "HH:mm", date?: "YYYY-MM-DD" }
// Returns a warning if the requested time falls inside a prayer window.
router.post('/check-booking-time', async (req: AuthRequest, res) => {
  const { city, time, date } = req.body as { city?: string; time?: string; date?: string };
  if (!city || !time) return res.status(400).json({ error: 'city و time مطلوبة' });
  const d = date ? new Date(date) : new Date();
  const h = toHijri(d);
  const times = prayerTimesFor(city, d, { isRamadan: h.month === 9 });
  if (!times) return res.json({ ok: true, warning: null });
  const near = isNearPrayerTime(time, times.avoidWindows);
  return res.json({
    ok: !near,
    warning: near ? `هذا الوقت قريب من صلاة ${near} — يُفضّل تعديله ١٥–٢٠ دقيقة` : null,
  });
});

export default router;
