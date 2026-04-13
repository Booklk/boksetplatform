import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wand2, Download, Copy, Check, RefreshCw, Sparkles,
  Image as ImageIcon, QrCode, FileText, AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

const SERVICES = [
  'غسيل خارجي', 'غسيل داخلي', 'بولش', 'تلميع', 'نانو سيراميك',
  'تعطير', 'إزالة الشمع', 'ضغط مياه', 'غسيل محركات', 'غسيل سجاد',
];

const TONES = [
  { value: 'friendly', label: '😊 ودود وقريب' },
  { value: 'professional', label: '💼 مهني ورسمي' },
  { value: 'premium', label: '👑 فاخر وراقٍ' },
] as const;

interface BrandKit {
  description: string;
  coverImageUrl: string;
  qrCodeDataUrl: string;
  socialPostText: string;
  generatedAt: string;
}

export default function BrandKit() {
  const { user } = useAuth();

  // Form state
  const [washName, setWashName] = useState('');
  const [location, setLocation] = useState('');
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [tone, setTone] = useState<'professional' | 'friendly' | 'premium'>('friendly');

  // Generation state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [kit, setKit] = useState<BrandKit | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);

  // Copy states
  const [copiedDesc, setCopiedDesc] = useState(false);
  const [copiedSocial, setCopiedSocial] = useState(false);

  // Load existing kit on mount
  useEffect(() => {
    api.get('/brand-kit/my')
      .then(r => {
        if (r.data.brandKit) setKit(r.data.brandKit);
        setGeneratedCount(r.data.generatedCount ?? 0);
      })
      .catch(() => {});

    // Prefill vendor name
    if (user?.vendor?.nameAr) setWashName(user.vendor.nameAr);
  }, [user]);

  function toggleService(s: string) {
    setSelectedServices(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    );
  }

  async function generate() {
    if (!washName.trim()) { setError('أدخل اسم المغسلة'); return; }
    if (!location.trim()) { setError('أدخل المدينة أو الحي'); return; }
    if (selectedServices.length === 0) { setError('اختر خدمة واحدة على الأقل'); return; }

    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/brand-kit/generate', {
        washName: washName.trim(),
        location: location.trim(),
        services: selectedServices,
        tone,
      });
      setKit(data);
      setGeneratedCount(c => c + 1);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'حدث خطأ — حاول مرة أخرى');
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, setCopied: (v: boolean) => void) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function downloadQR() {
    if (!kit?.qrCodeDataUrl) return;
    const a = document.createElement('a');
    a.href = kit.qrCodeDataUrl;
    a.download = `${washName || 'qrcode'}.png`;
    a.click();
  }

  return (
    <div className="min-h-screen bg-[#0a0f1e] p-4 sm:p-6 lg:p-8" dir="rtl">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Sparkles size={20} className="text-purple-400" />
            </div>
            <h1 className="text-2xl font-black text-white">هوية المغسلة بالذكاء الاصطناعي</h1>
          </div>
          <p className="text-slate-400 text-sm">
            أدخل معلومات مغسلتك وسيولّد لك الذكاء الاصطناعي وصفاً احترافياً، صورة غلاف، QR code، وقالب منشور
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── FORM ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5"
          >
            <h2 className="text-white font-bold text-lg flex items-center gap-2">
              <Wand2 size={18} className="text-purple-400" />
              معلومات المغسلة
            </h2>

            {/* Wash name */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1.5 block">اسم المغسلة</label>
              <input
                value={washName}
                onChange={e => setWashName(e.target.value)}
                placeholder="مثال: مغسلة النجم"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 text-sm"
              />
            </div>

            {/* Location */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-1.5 block">المدينة أو الحي</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="مثال: الرياض — حي النخيل"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 text-sm"
              />
            </div>

            {/* Services */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-2 block">
                الخدمات ({selectedServices.length} مختارة)
              </label>
              <div className="flex flex-wrap gap-2">
                {SERVICES.map(s => (
                  <button
                    key={s}
                    onClick={() => toggleService(s)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      selectedServices.includes(s)
                        ? 'bg-purple-500/30 border-purple-500/60 text-purple-300 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wide mb-2 block">أسلوب الوصف</label>
              <div className="grid grid-cols-3 gap-2">
                {TONES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className={`text-xs px-2 py-2 rounded-xl border transition-all text-center ${
                      tone === t.value
                        ? 'bg-purple-500/30 border-purple-500/60 text-purple-300 font-bold'
                        : 'bg-white/5 border-white/10 text-slate-400 hover:border-white/20'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3"
                >
                  <AlertCircle size={16} />
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Generate button */}
            <motion.button
              onClick={generate}
              disabled={loading}
              whileHover={{ scale: loading ? 1 : 1.02 }}
              whileTap={{ scale: loading ? 1 : 0.98 }}
              className="w-full py-3.5 rounded-xl bg-gradient-to-l from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black text-sm shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  جاري التوليد... (قد يستغرق 15 ثانية)
                </>
              ) : (
                <>
                  <Sparkles size={16} />
                  {kit ? 'ولّد مرة أخرى' : 'ولّد هويتي الآن'}
                </>
              )}
            </motion.button>

            {generatedCount > 0 && (
              <p className="text-slate-500 text-xs text-center">
                تم التوليد {generatedCount} {generatedCount === 1 ? 'مرة' : 'مرات'}
              </p>
            )}
          </motion.div>

          {/* ── RESULTS ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            {!kit && !loading && (
              <div className="bg-white/3 border border-white/10 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center text-center">
                <Sparkles size={40} className="text-slate-600 mb-3" />
                <p className="text-slate-500 text-sm">النتائج ستظهر هنا بعد التوليد</p>
              </div>
            )}

            {loading && (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-12 flex flex-col items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                >
                  <Sparkles size={40} className="text-purple-400" />
                </motion.div>
                <p className="text-slate-400 text-sm mt-4">الذكاء الاصطناعي يبني هويتك...</p>
                <p className="text-slate-600 text-xs mt-1">قد يستغرق ذلك 10-15 ثانية</p>
              </div>
            )}

            <AnimatePresence>
              {kit && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  {/* Description */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-bold text-sm flex items-center gap-2">
                        <FileText size={16} className="text-blue-400" />
                        الوصف الاحترافي
                      </span>
                      <button
                        onClick={() => copyText(kit.description, setCopiedDesc)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {copiedDesc ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copiedDesc ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{kit.description}</p>
                  </div>

                  {/* Social Post */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-bold text-sm flex items-center gap-2">
                        <FileText size={16} className="text-pink-400" />
                        منشور إنستجرام جاهز
                      </span>
                      <button
                        onClick={() => copyText(kit.socialPostText, setCopiedSocial)}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        {copiedSocial ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                        {copiedSocial ? 'تم النسخ' : 'نسخ'}
                      </button>
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-line">{kit.socialPostText}</p>
                  </div>

                  {/* Cover Image */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-bold text-sm flex items-center gap-2">
                        <ImageIcon size={16} className="text-emerald-400" />
                        صورة الغلاف
                      </span>
                      <a
                        href={kit.coverImageUrl}
                        download="cover.jpg"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        <Download size={14} />
                        فتح
                      </a>
                    </div>
                    <img
                      src={kit.coverImageUrl}
                      alt="غلاف المغسلة"
                      className="w-full rounded-xl object-cover"
                      style={{ maxHeight: 200 }}
                      onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'; }}
                    />
                  </div>

                  {/* QR Code */}
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-white font-bold text-sm flex items-center gap-2">
                        <QrCode size={16} className="text-amber-400" />
                        رمز QR — رابط متجرك
                      </span>
                      <button
                        onClick={downloadQR}
                        className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                      >
                        <Download size={14} />
                        تحميل PNG
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <img
                        src={kit.qrCodeDataUrl}
                        alt="QR Code"
                        className="w-40 h-40 rounded-xl bg-white p-2"
                      />
                    </div>
                    <p className="text-slate-500 text-xs text-center mt-2">امسح الكود لفتح صفحة مغسلتك مباشرة</p>
                  </div>

                  <p className="text-slate-600 text-xs text-center">
                    تم التوليد في {new Date(kit.generatedAt).toLocaleString('ar-SA')}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
