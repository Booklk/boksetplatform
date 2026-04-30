/**
 * Vendor Gallery manager.
 * Route: /vendor/gallery  (linked from the sidebar)
 *
 * Lets the vendor upload / remove curated gallery images that appear
 * on their /store/:slug storefront (for templates whose features.gallery
 * is on — spa, studio, salon, beauty-at-home, salon-luxury, nails,
 * brow-lash, henna, etc.). Booking "after" photos are still auto-added
 * by the public /api/photos/gallery/:slug endpoint.
 */

import { useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, Image as ImageIcon, Loader2, Plus } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface GalleryItem {
  url: string;
  caption?: string;
}

export default function VendorGallery() {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pendingCaption, setPendingCaption] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const { data, isLoading } = useQuery<{ items: GalleryItem[] }>({
    queryKey: ['vendor-gallery-mine'],
    queryFn: () => api.get('/photos/gallery/mine').then((r) => r.data),
  });

  const uploadMutation = useMutation({
    mutationFn: async ({ file, caption }: { file: File; caption: string }) => {
      const form = new FormData();
      form.append('photo', file);
      if (caption) form.append('caption', caption);
      return api.post('/photos/gallery/upload', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }).then((r) => r.data);
    },
    onSuccess: () => {
      toast.success('تمت إضافة الصورة');
      qc.invalidateQueries({ queryKey: ['vendor-gallery-mine'] });
      setPendingCaption('');
      setPendingFile(null);
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? 'فشل الرفع'),
  });

  const deleteMutation = useMutation({
    mutationFn: (url: string) =>
      api.delete('/photos/gallery', { data: { url } }).then((r) => r.data),
    onSuccess: () => {
      toast.success('تم الحذف');
      qc.invalidateQueries({ queryKey: ['vendor-gallery-mine'] });
    },
    onError: () => toast.error('فشل الحذف'),
  });

  function handleFile(f: File | null) {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      toast.error('الملف المسموح به صور فقط');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error('أقصى حجم 10 ميغابايت');
      return;
    }
    setPendingFile(f);
  }

  function submit() {
    if (!pendingFile) return;
    uploadMutation.mutate({ file: pendingFile, caption: pendingCaption });
  }

  const items = data?.items ?? [];

  return (
    <div className="min-h-screen bg-surface-1 text-white font-arabic" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2">
            <ImageIcon className="w-6 h-6 text-indigo-400" />
            معرض الأعمال
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            ارفع صور أعمالك لتظهر في صفحة متجرك للعملاء. يناسب الصالونات، السبا،
            الاستوديوهات، ومغاسل VIP.
          </p>
        </div>

        {/* Upload card */}
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5">
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            {/* File picker */}
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}
              className="w-full sm:w-48 h-32 border-2 border-dashed border-white/15 hover:border-indigo-500/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden relative bg-white/[0.02]"
            >
              {pendingFile ? (
                <img
                  src={URL.createObjectURL(pendingFile)}
                  alt="preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
              ) : (
                <>
                  <Upload className="w-6 h-6 text-slate-500 mb-2" />
                  <p className="text-xs text-slate-400 text-center px-3">اضغط أو اسحب الصورة هنا</p>
                  <p className="text-[10px] text-slate-600 mt-1">حتى 10 ميغابايت</p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              />
            </div>

            {/* Caption + submit */}
            <div className="flex-1 w-full space-y-3">
              <input
                type="text"
                value={pendingCaption}
                onChange={(e) => setPendingCaption(e.target.value)}
                placeholder="وصف مختصر للصورة (اختياري) — مثال: تسريحة عروس"
                className="w-full bg-white/[0.04] border border-white/[0.08] focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm outline-none transition-colors"
              />
              <div className="flex gap-2">
                <button
                  onClick={submit}
                  disabled={!pendingFile || uploadMutation.isPending}
                  className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-40 transition-colors"
                >
                  {uploadMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Plus size={14} />
                  )}
                  أضف للمعرض
                </button>
                {pendingFile && (
                  <button
                    onClick={() => {
                      setPendingFile(null);
                      setPendingCaption('');
                      if (fileRef.current) fileRef.current.value = '';
                    }}
                    className="px-4 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05] text-sm transition-colors"
                  >
                    إلغاء
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                الصور تظهر لعملاءك في صفحة متجرك إذا كان قالبك يدعم المعرض (سبا، استوديو، صالون، VIP).
              </p>
            </div>
          </div>
        </div>

        {/* Grid */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-slate-300">
              صور المعرض ({items.length})
            </h2>
          </div>

          {isLoading ? (
            <div className="text-center py-10 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-white/10 rounded-2xl">
              <ImageIcon className="w-10 h-10 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">لم تُضف صور بعد</p>
              <p className="text-slate-600 text-xs mt-1">
                ستظهر صور "بعد" من الحجوزات المكتملة تلقائياً في صفحة متجرك.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              <AnimatePresence initial={false}>
                {items.map((it) => (
                  <motion.div
                    key={it.url}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="relative group aspect-square rounded-xl overflow-hidden border border-white/[0.06] bg-white/[0.02]"
                  >
                    <img src={it.url} alt={it.caption ?? 'عمل'} className="w-full h-full object-cover" />
                    {it.caption && (
                      <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent">
                        <p className="text-[11px] text-white font-bold line-clamp-2">{it.caption}</p>
                      </div>
                    )}
                    <button
                      onClick={() => deleteMutation.mutate(it.url)}
                      disabled={deleteMutation.isPending}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600/80 hover:bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                      title="حذف"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
