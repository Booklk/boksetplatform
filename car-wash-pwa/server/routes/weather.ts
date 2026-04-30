import { Router } from 'express';

const router = Router();

// GET /api/weather?lat=24.7&lng=46.7
// Proxies OpenWeatherMap so the API key stays on the server.
router.get('/', async (req, res) => {
  try {
    const lat = req.query.lat ?? '24.7';
    const lng = req.query.lng ?? '46.7';
    const apiKey = process.env.OPENWEATHER_API_KEY;

    if (!apiKey) {
      // Return a mock clear-weather response when no key is configured
      return res.json({
        weather: [{ main: 'Clear', description: 'clear sky' }],
        main: { temp: 32 },
        name: 'Riyadh',
      });
    }

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=ar&appid=${apiKey}`;
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: 'فشل في جلب بيانات الطقس' });
    }
    const data = await response.json();
    return res.json(data);
  } catch (e) {
    console.error('[weather]', e);
    return res.status(500).json({ error: 'خطأ في الخادم' });
  }
});

export default router;
