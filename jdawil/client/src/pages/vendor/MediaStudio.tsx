/**
 * /vendor/media-studio — rich-media customisation (Pro only).
 *
 * Three panels:
 *   1. Announcement bar — top-of-site strip (text + link + tone + schedule)
 *   2. Hero media       — image or video background with headline / CTA
 *   3. Service gallery  — per-service images (up to 12) + optional video
 *
 * Every write is Pro-gated server-side; the UI also wraps the whole page
 * in <UpgradeGate featureId="announcement_banner"> so free-plan vendors
 * see the upgrade sheet instead of an unusable form.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Megaphone, ImageIcon, Video, Upload, Trash2, Save,
  Clock, Sparkles, Link as LinkIcon, Play, Film, Layers,
} from 'lucide-react';
import api from '../../lib/api';
import {
  Button, Card, Input, Badge, PageHeader, Skeleton, EmptyState,
} from '../../components/ui';
import UpgradeGate from '../../components/UpgradeGate';
import { fadeInUp, staggerContainer, springs } from '../../design/motion';

type Tone = 'info' | 'success' | 'warn' | 'danger' | 'brand';
type HeroType = 'none' | 'image' | 'video';

interface Settings {
  announcement: {
    enabled: boolean;
    text: string;
    href: string;
    tone: Tone;
    startsAt: string | null;
    endsAt: string | null;
  };
  hero: {
    mediaType: HeroType;
    mediaUrl: string;
    posterUrl: string;
    headlineAr: string;
    subheadlineAr: string;
    ctaLabelAr: string;
    ctaHref: string;
  };
}

interface ServiceRow {
  id: number;
  name: string;
  imageUrl: string | null;
  images: string[] | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
}

const TONE_STYLE: Record<Tone, { bg: string; text: string; label: string }> = {
  info:    { bg: 'bg-sky-500',     text: 'text-white',    label: 'معلومة' },
  success: { bg: 'bg-success-500', text: 'text-white',    label: 'نجاح' },
  warn:    { bg: 'bg-warn-500',    text: 'text-ink-900',  label: 'تنبيه' },
  danger:  { bg: 'bg-danger-500',  text: 'text-white',    label: 'عاجل' },
  brand:   { bg: 'bg-primary-600', text: 'text-white',    label: 'ترويجي' },
};

export default function MediaStudio() {
  return (
    <UpgradeGate featureId="announcement_banner">
      <Inner />
    </UpgradeGate>
  );
}

function Inner() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Settings>({
    queryKey: ['storefront-settings'],
    queryFn: async () => (await api.get('/vendor-storefront/settings')).data,
  });
  const { data: servicesData } = useQuery<ServiceRow[]>({
    queryKey: ['services-for-media'],
    queryFn: async () => (await api.get('/services')).data,
  });

  const [local, setLocal] = useState<Settings | null>(null);
  useEffect(() => { if (data) setLocal(data); }, [data]);

  const save = useMutation({
    mutationFn: (patch: Partial<Settings>) =>
      api.put<Settings>('/vendor-storefront/settings', patch).then((r) => r.data),
    onSuccess: (next) => {
      qc.setQueryData(['storefront-settings'], next);
      toast.success('حفظت');
    },
    onError: (e: any) => {
      if (e?.response?.status === 402) {
        toast.error('هذه الميزة للباقة Pro — تجربة مجانية شهر كاملة متوفّرة');
      } else {
        toast.error(e?.response?.data?.error ?? 'فشل الحفظ');
      }
    },
  });

  if (isLoading || !local) {
    return (
      <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
        <div className="max-w-4xl mx-auto space-y-3">
          <Skeleton className="h-20 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
          <Skeleton className="h-56 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        <PageHeader
          icon={<Sparkles size={20} />}
          title="استوديو الميديا"
          subtitle="بانر إعلاني، هيرو فيديو، صور لكل خدمة — متجرك يبان عالمي."
          actions={<Badge tone="primary" size="md">Pro</Badge>}
        />

        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="space-y-4"
        >
          {/* Announcement */}
          <motion.div variants={fadeInUp}>
            <AnnouncementPanel
              value={local.announcement}
              onChange={(announcement) => setLocal({ ...local, announcement })}
              onSave={() => save.mutate({ announcement: local.announcement })}
              busy={save.isPending}
            />
          </motion.div>

          {/* Hero */}
          <motion.div variants={fadeInUp}>
            <HeroPanel
              value={local.hero}
              onChange={(hero) => setLocal({ ...local, hero })}
              onSave={() => save.mutate({ hero: local.hero })}
              busy={save.isPending}
            />
          </motion.div>

          {/* Service media */}
          <motion.div variants={fadeInUp}>
            <ServicesPanel services={servicesData ?? []} />
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Panel 1 — announcement bar

function AnnouncementPanel({
  value, onChange, onSave, busy,
}: {
  value: Settings['announcement'];
  onChange: (v: Settings['announcement']) => void;
  onSave: () => void;
  busy: boolean;
}) {
  return (
    <Card variant="default" padding="md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Megaphone size={16} className="text-warn-400" />
          <h3 className="font-bold text-white">البانر الإعلاني</h3>
        </div>
        <Toggle
          checked={value.enabled}
          onChange={(v) => onChange({ ...value, enabled: v })}
        />
      </div>

      {/* Live preview */}
      <div
        className={`
          rounded-xl px-4 py-2 mb-4 text-sm font-bold flex items-center justify-center
          ${TONE_STYLE[value.tone].bg} ${TONE_STYLE[value.tone].text}
          ${!value.enabled || !value.text.trim() ? 'opacity-40' : ''}
        `}
      >
        {value.text.trim() || 'معاينة — اكتب نص البانر'}
      </div>

      <div className="space-y-3">
        <Input
          label="نص البانر"
          value={value.text}
          onChange={(e) => onChange({ ...value, text: e.target.value })}
          placeholder="مثال: خصم 20% على كل الخدمات حتى نهاية الأسبوع"
          maxLength={200}
        />
        <Input
          label="رابط (اختياري)"
          dir="ltr"
          value={value.href}
          onChange={(e) => onChange({ ...value, href: e.target.value })}
          placeholder="https://… أو /store/slug/p/promo"
          leftIcon={<LinkIcon size={13} />}
        />
        <div>
          <label className="block text-xs font-bold text-ink-400 mb-2">اللون</label>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TONE_STYLE) as Tone[]).map((t) => {
              const active = value.tone === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ ...value, tone: t })}
                  className={`px-3 h-8 rounded-lg text-xs font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${TONE_STYLE[t].bg} ${TONE_STYLE[t].text} ${active ? 'ring-2 ring-white/40' : 'opacity-60 hover:opacity-100'}`}
                >
                  {TONE_STYLE[t].label}
                </button>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="يبدأ"
            type="datetime-local"
            value={value.startsAt ? value.startsAt.slice(0, 16) : ''}
            onChange={(e) => onChange({
              ...value,
              startsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
            })}
            leftIcon={<Clock size={13} />}
          />
          <Input
            label="ينتهي"
            type="datetime-local"
            value={value.endsAt ? value.endsAt.slice(0, 16) : ''}
            onChange={(e) => onChange({
              ...value,
              endsAt: e.target.value ? new Date(e.target.value).toISOString() : null,
            })}
            leftIcon={<Clock size={13} />}
          />
        </div>
        <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth>
          حفظ البانر
        </Button>
      </div>
    </Card>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Panel 2 — hero media

function HeroPanel({
  value, onChange, onSave, busy,
}: {
  value: Settings['hero'];
  onChange: (v: Settings['hero']) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const videoInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function uploadVideo(file: File | null) {
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) {
      toast.error('الفيديو أكبر من 50 ميجا');
      return;
    }
    const form = new FormData();
    form.append('video', file);
    setUploading(true);
    try {
      const { data } = await api.post<{ url: string }>(
        '/vendor-storefront/upload-video',
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      onChange({ ...value, mediaUrl: data.url, mediaType: 'video' });
      toast.success('رُفع الفيديو');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'فشل الرفع');
    } finally {
      setUploading(false);
    }
  }

  const isYoutube = /youtu\.?be/.test(value.mediaUrl);
  const isVimeo = /vimeo\.com/.test(value.mediaUrl);

  return (
    <Card variant="default" padding="md">
      <div className="flex items-center gap-2 mb-3">
        <Film size={16} className="text-primary-400" />
        <h3 className="font-bold text-white">الهيرو (الخلفية الرئيسية للموقع)</h3>
      </div>

      {/* Media type picker */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {([
          { id: 'none' as HeroType, label: 'بدون ميديا', icon: Layers },
          { id: 'image' as HeroType, label: 'صورة',       icon: ImageIcon },
          { id: 'video' as HeroType, label: 'فيديو',       icon: Video },
        ]).map((opt) => {
          const active = value.mediaType === opt.id;
          const Icon = opt.icon;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange({ ...value, mediaType: opt.id })}
              className={`p-3 rounded-xl border-2 text-xs font-bold transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary-400 ${
                active
                  ? 'border-primary-500/60 bg-primary-500/10 text-white'
                  : 'border-white/[0.06] bg-white/[0.02] text-ink-300 hover:border-white/[0.15]'
              }`}
            >
              <Icon size={18} className="mx-auto mb-1" />
              {opt.label}
            </button>
          );
        })}
      </div>

      {value.mediaType !== 'none' && (
        <div className="space-y-3 mb-4">
          {value.mediaType === 'video' && (
            <>
              <Input
                label="رابط YouTube / Vimeo / MP4"
                dir="ltr"
                value={value.mediaUrl}
                onChange={(e) => onChange({ ...value, mediaUrl: e.target.value })}
                placeholder="https://youtu.be/… أو MP4 من الاستضافة"
                leftIcon={<LinkIcon size={13} />}
              />
              <div className="flex items-center gap-2">
                <input
                  ref={videoInput}
                  type="file"
                  accept="video/mp4,video/webm,video/quicktime"
                  onChange={(e) => uploadVideo(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  loading={uploading}
                  leftIcon={<Upload size={13} />}
                  onClick={() => videoInput.current?.click()}
                >
                  أو ارفع فيديو (حد 50 ميجا)
                </Button>
              </div>
              {value.mediaUrl && !isYoutube && !isVimeo && (
                <Input
                  label="صورة بوستر (اختيارية)"
                  dir="ltr"
                  value={value.posterUrl}
                  onChange={(e) => onChange({ ...value, posterUrl: e.target.value })}
                  placeholder="/uploads/... أو رابط خارجي"
                />
              )}
            </>
          )}
          {value.mediaType === 'image' && (
            <Input
              label="رابط الصورة"
              dir="ltr"
              value={value.mediaUrl}
              onChange={(e) => onChange({ ...value, mediaUrl: e.target.value })}
              placeholder="https://… أو /uploads/..."
            />
          )}
        </div>
      )}

      {/* Headline / CTA */}
      <div className="space-y-3 mb-4">
        <Input
          label="العنوان الرئيسي"
          value={value.headlineAr}
          onChange={(e) => onChange({ ...value, headlineAr: e.target.value })}
          placeholder="صالونك الأفضل في حيّك"
          maxLength={120}
        />
        <Input
          label="العنوان الفرعي"
          value={value.subheadlineAr}
          onChange={(e) => onChange({ ...value, subheadlineAr: e.target.value })}
          placeholder="حجز خلال دقيقة · مواعيد مرنة · موظفين محترفين"
          maxLength={200}
        />
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="نص الزر"
            value={value.ctaLabelAr}
            onChange={(e) => onChange({ ...value, ctaLabelAr: e.target.value })}
            placeholder="احجز الآن"
            maxLength={60}
          />
          <Input
            label="رابط الزر"
            dir="ltr"
            value={value.ctaHref}
            onChange={(e) => onChange({ ...value, ctaHref: e.target.value })}
            placeholder="/store/slug/book"
          />
        </div>
      </div>

      {/* Preview */}
      <HeroPreview value={value} />

      <Button onClick={onSave} loading={busy} leftIcon={<Save size={14} />} fullWidth className="mt-3">
        حفظ الهيرو
      </Button>
    </Card>
  );
}

function HeroPreview({ value }: { value: Settings['hero'] }) {
  const yt = value.mediaUrl.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{6,})/);
  return (
    <div className="rounded-2xl overflow-hidden relative aspect-video bg-gradient-to-br from-ink-900 to-ink-800 border border-white/[0.08]">
      {value.mediaType === 'video' && yt && (
        <iframe
          className="absolute inset-0 w-full h-full"
          src={`https://www.youtube.com/embed/${yt[1]}?autoplay=1&mute=1&loop=1&playlist=${yt[1]}&controls=0`}
          allow="autoplay; encrypted-media"
        />
      )}
      {value.mediaType === 'video' && value.mediaUrl && !yt && (
        <video
          className="absolute inset-0 w-full h-full object-cover"
          src={value.mediaUrl}
          poster={value.posterUrl || undefined}
          autoPlay muted loop playsInline
        />
      )}
      {value.mediaType === 'image' && value.mediaUrl && (
        <img src={value.mediaUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      <div className="relative h-full p-6 flex flex-col justify-end">
        {value.headlineAr && (
          <h2 className="text-xl sm:text-3xl font-black text-white mb-1">{value.headlineAr}</h2>
        )}
        {value.subheadlineAr && (
          <p className="text-xs sm:text-sm text-white/80 mb-3 max-w-md">{value.subheadlineAr}</p>
        )}
        {value.ctaLabelAr && (
          <span className="inline-block self-start px-4 h-9 rounded-xl bg-white text-ink-900 text-xs font-black leading-[2.25rem]">
            {value.ctaLabelAr}
          </span>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Panel 3 — service gallery + video

function ServicesPanel({ services }: { services: ServiceRow[] }) {
  if (services.length === 0) {
    return (
      <Card variant="default" padding="md">
        <div className="flex items-center gap-2 mb-2">
          <ImageIcon size={16} className="text-success-400" />
          <h3 className="font-bold text-white">صور وفيديو لكل خدمة</h3>
        </div>
        <EmptyState
          compact
          icon={<ImageIcon size={18} />}
          title="ما في خدمات مضافة بعد"
          body="أضف خدمة من القائمة، وبعدين تقدر ترفع لها صور + فيديو من هنا."
        />
      </Card>
    );
  }
  return (
    <Card variant="default" padding="md">
      <div className="flex items-center gap-2 mb-3">
        <ImageIcon size={16} className="text-success-400" />
        <h3 className="font-bold text-white">صور وفيديو لكل خدمة</h3>
      </div>
      <div className="space-y-3">
        {services.map((svc) => (
          <ServiceMediaRow key={svc.id} service={svc} />
        ))}
      </div>
    </Card>
  );
}

function ServiceMediaRow({ service }: { service: ServiceRow }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [videoUrl, setVideoUrl] = useState(service.videoUrl ?? '');

  const images = service.images ?? [];

  const addImage = useMutation({
    mutationFn: () => api.post(`/vendor-storefront/services/${service.id}/images`, { url: imageUrl.trim() }),
    onSuccess: () => {
      setImageUrl('');
      qc.invalidateQueries({ queryKey: ['services-for-media'] });
      toast.success('أُضيفت الصورة');
    },
    onError: () => toast.error('فشل الإضافة'),
  });

  const removeImage = useMutation({
    mutationFn: (url: string) =>
      api.delete(`/vendor-storefront/services/${service.id}/images?url=${encodeURIComponent(url)}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services-for-media'] }),
  });

  const saveVideo = useMutation({
    mutationFn: () => api.put(`/vendor-storefront/services/${service.id}/video`, {
      videoUrl: videoUrl.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['services-for-media'] });
      toast.success('حُفظ الفيديو');
    },
    onError: () => toast.error('فشل الحفظ'),
  });

  return (
    <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full p-3 flex items-center justify-between gap-3 hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-2 min-w-0">
          <p className="font-bold text-white text-sm truncate">{service.name}</p>
          {images.length > 0 && <Badge size="sm" tone="success">{images.length} صور</Badge>}
          {service.videoUrl && <Badge size="sm" tone="primary" leftIcon={<Play size={9} />}>فيديو</Badge>}
        </div>
        <span className="text-xs text-ink-400">{expanded ? 'طيّ' : 'فتح'}</span>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={springs.gentle}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[0.06] p-3 space-y-3">
              {/* Images */}
              <div>
                <p className="text-[11px] font-bold text-ink-400 mb-2">الصور ({images.length}/12)</p>
                {images.length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
                    {images.map((url) => (
                      <div key={url} className="relative aspect-square rounded-lg overflow-hidden bg-white/[0.04] group">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button
                          onClick={() => removeImage.mutate(url)}
                          className="absolute top-1 left-1 w-6 h-6 rounded-full bg-danger-600 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="حذف"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Input
                    dir="ltr"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="/uploads/... أو https://..."
                    containerClassName="flex-1"
                  />
                  <Button
                    size="sm"
                    disabled={!imageUrl.trim() || images.length >= 12}
                    loading={addImage.isPending}
                    onClick={() => addImage.mutate()}
                  >
                    إضافة
                  </Button>
                </div>
              </div>

              {/* Video */}
              <div>
                <p className="text-[11px] font-bold text-ink-400 mb-2">فيديو</p>
                <div className="flex items-center gap-2">
                  <Input
                    dir="ltr"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="YouTube / Vimeo / MP4"
                    containerClassName="flex-1"
                  />
                  <Button
                    size="sm"
                    loading={saveVideo.isPending}
                    onClick={() => saveVideo.mutate()}
                  >
                    حفظ
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-primary-500' : 'bg-white/[0.08]'}`}
    >
      <motion.span
        animate={{ x: checked ? -16 : 0 }}
        transition={springs.snappy}
        className="absolute top-0.5 right-0.5 w-5 h-5 rounded-full bg-white shadow"
      />
    </button>
  );
}
