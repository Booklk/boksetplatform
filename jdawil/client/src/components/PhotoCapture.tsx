import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Upload, X, CheckCircle, Loader2 } from 'lucide-react';
import api from '../lib/api';

interface PhotoCaptureProps {
  bookingId: number;
  phase: 'before' | 'after' | 'damage';
  onSuccess?: (photo: { photoUrl: string; phase: string }) => void;
}

const phaseLabels = {
  before: { label: 'قبل الغسيل', color: 'from-orange-500 to-amber-500', emoji: '🚗' },
  after: { label: 'بعد الغسيل', color: 'from-emerald-500 to-teal-500', emoji: '✨' },
  damage: { label: 'توثيق ضرر', color: 'from-red-500 to-rose-500', emoji: '⚠️' },
};

export default function PhotoCapture({ bookingId, phase, onSuccess }: PhotoCaptureProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const info = phaseLabels[phase];

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);
    setDone(false);
    setError(null);
  }

  async function handleUpload() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append('photo', file);
    form.append('phase', phase);
    if (notes) form.append('notes', notes);

    try {
      const { data } = await api.post(`/photos/booking/${bookingId}`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setDone(true);
      onSuccess?.(data);
    } catch (e: any) {
      setError(e.response?.data?.error ?? 'فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  }

  function reset() {
    setPreview(null);
    setDone(false);
    setError(null);
    setNotes('');
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
      {/* Header */}
      <div className={`bg-gradient-to-r ${info.color} p-3 flex items-center gap-2`}>
        <span className="text-xl">{info.emoji}</span>
        <span className="font-bold text-white text-sm">{info.label}</span>
      </div>

      <div className="p-4 space-y-3">
        <AnimatePresence mode="wait">
          {done ? (
            <motion.div key="done" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center gap-2 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <p className="text-emerald-400 font-semibold text-sm">تم الرفع بنجاح</p>
              <button onClick={reset} className="text-xs text-slate-400 underline">رفع صورة أخرى</button>
            </motion.div>
          ) : preview ? (
            <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
              <div className="relative rounded-xl overflow-hidden aspect-video">
                <img src={preview} alt="معاينة" className="w-full h-full object-cover" />
                <button onClick={reset}
                  className="absolute top-2 left-2 w-7 h-7 bg-black/60 rounded-full flex items-center justify-center hover:bg-black/80">
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="ملاحظات (اختياري)..."
                rows={2}
                className="w-full bg-white/5 border border-white/10 rounded-xl p-2 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-brand-500"
              />
              {error && <p className="text-red-400 text-xs">{error}</p>}
              <button onClick={handleUpload} disabled={uploading}
                className={`w-full py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 bg-gradient-to-r ${info.color} text-white disabled:opacity-50`}>
                {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الرفع...</> : <><Upload className="w-4 h-4" /> رفع الصورة</>}
              </button>
            </motion.div>
          ) : (
            <motion.div key="capture" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <input ref={fileRef} type="file" accept="image/*" capture="environment"
                onChange={handleFile} className="hidden" id={`photo-${phase}`} />
              <label htmlFor={`photo-${phase}`}
                className="flex flex-col items-center gap-3 py-6 border-2 border-dashed border-white/20 rounded-xl cursor-pointer hover:border-white/40 hover:bg-white/5 transition-all">
                <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${info.color} flex items-center justify-center`}>
                  <Camera className="w-6 h-6 text-white" />
                </div>
                <div className="text-center">
                  <p className="text-white font-semibold text-sm">التقط صورة</p>
                  <p className="text-slate-500 text-xs mt-0.5">أو اختر من المعرض</p>
                </div>
              </label>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
