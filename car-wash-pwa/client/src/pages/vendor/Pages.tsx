/**
 * Vendor → /vendor/pages
 * Lets the vendor add arbitrary content pages to their storefront
 * (prices, FAQ, about…) plus activate a Terms & Conditions page
 * from a per-industry template.
 *
 * Privacy policy is platform-wide (served on /privacy) — no per-vendor
 * copy here by design.
 */

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Plus, Save, Trash2, Eye, EyeOff, ChevronLeft,
  ChevronRight, Sparkles, Shield, Info, X, Loader2, Check,
  ExternalLink, FileCheck,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';

interface CustomPage {
  id: number;
  kind: 'custom' | 'terms';
  slug: string;
  title: string;
  content: string;
  isPublished: boolean;
  showInNav: boolean;
  sortOrder: number;
  updatedAt: string;
}

interface TermsTemplate {
  industry: string;
  label: string;
  summary: string;
}

export default function VendorPages() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editorOpen, setEditorOpen] = useState<CustomPage | 'new' | null>(null);
  const [termsPickerOpen, setTermsPickerOpen] = useState(false);

  const { data: pagesData, isLoading } = useQuery<{ pages: CustomPage[] }>({
    queryKey: ['vendor-pages'],
    queryFn: () => api.get('/pages/mine').then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/pages/mine/${id}`),
    onSuccess: () => {
      toast.success('تم حذف الصفحة');
      qc.invalidateQueries({ queryKey: ['vendor-pages'] });
    },
    onError: () => toast.error('فشل الحذف'),
  });

  const togglePublishMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      api.put(`/pages/mine/${id}`, { isPublished }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-pages'] }),
  });

  const toggleNavMutation = useMutation({
    mutationFn: ({ id, showInNav }: { id: number; showInNav: boolean }) =>
      api.put(`/pages/mine/${id}`, { showInNav }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['vendor-pages'] }),
  });

  const pages = pagesData?.pages ?? [];
  const termsPage = pages.find((p) => p.kind === 'terms');
  const customPages = pages.filter((p) => p.kind === 'custom');
  const storeUrl = user?.vendor?.slug ? `/store/${user.vendor.slug}` : null;

  return (
    <div className="min-h-screen bg-surface-1 text-white font-arabic" dir="rtl">
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-black flex items-center gap-2">
              <FileText className="w-6 h-6 text-indigo-400" />
              صفحات المتجر
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-xl">
              أضف صفحات مخصصة في موقعك (أسعار، أسئلة شائعة، عن المتجر…) وفعّل صفحة الشروط والأحكام
              من قالب مناسب لنشاطك.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setEditorOpen('new')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors"
            >
              <Plus size={14} /> صفحة جديدة
            </button>
          </div>
        </div>

        {/* Info strip: privacy policy is platform-wide */}
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold text-blue-200">سياسة الخصوصية موحّدة للمنصة</p>
            <p className="text-blue-200/70 mt-1 leading-relaxed">
              كل المتاجر على جداول تشارك نفس سياسة الخصوصية المعتمدة، وتظهر تلقائياً على
              موقعك. ما تحتاج تضيفها — نحن نتكفّل بها.
            </p>
          </div>
        </div>

        {/* ── Terms page card ── */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-3">الشروط والأحكام</h2>
          {termsPage ? (
            <PageRow
              page={termsPage}
              onEdit={() => setEditorOpen(termsPage)}
              onDelete={() => {
                if (confirm('حذف صفحة الشروط؟')) deleteMutation.mutate(termsPage.id);
              }}
              onTogglePublish={(v) => togglePublishMutation.mutate({ id: termsPage.id, isPublished: v })}
              onToggleNav={(v) => toggleNavMutation.mutate({ id: termsPage.id, showInNav: v })}
              storeUrl={storeUrl}
              icon={<FileCheck className="w-4 h-4 text-emerald-400" />}
            />
          ) : (
            <button
              onClick={() => setTermsPickerOpen(true)}
              className="w-full rounded-xl border-2 border-dashed border-white/10 hover:border-indigo-500/40 p-6 text-slate-300 hover:text-white transition-colors group flex items-center gap-4"
            >
              <FileCheck className="w-8 h-8 text-slate-500 group-hover:text-indigo-400 transition-colors" />
              <div className="text-right flex-1">
                <p className="font-bold">لم تفعّل الشروط والأحكام بعد</p>
                <p className="text-xs text-slate-500 mt-1">
                  اختر قالباً مناسباً لنشاطك — عدّله كما تريد وانشره.
                </p>
              </div>
              <ChevronLeft className="w-5 h-5 text-slate-500 group-hover:text-indigo-400 transition-colors" />
            </button>
          )}
        </section>

        {/* ── Custom pages list ── */}
        <section>
          <h2 className="text-sm font-bold text-slate-400 mb-3">
            الصفحات المخصصة ({customPages.length})
          </h2>
          {isLoading ? (
            <div className="text-center py-8 text-slate-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : customPages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-700" />
              <p className="text-sm">لم تنشئ صفحات مخصصة بعد</p>
              <p className="text-xs text-slate-600 mt-1">
                أضف صفحة "أسعار" أو "أسئلة شائعة" أو أي صفحة أخرى تناسب متجرك.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {customPages.map((p) => (
                <PageRow
                  key={p.id}
                  page={p}
                  onEdit={() => setEditorOpen(p)}
                  onDelete={() => {
                    if (confirm(`حذف صفحة "${p.title}"؟`)) deleteMutation.mutate(p.id);
                  }}
                  onTogglePublish={(v) => togglePublishMutation.mutate({ id: p.id, isPublished: v })}
                  onToggleNav={(v) => toggleNavMutation.mutate({ id: p.id, showInNav: v })}
                  storeUrl={storeUrl}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Modals ── */}
      <AnimatePresence>
        {termsPickerOpen && (
          <TermsPickerModal
            onClose={() => setTermsPickerOpen(false)}
            onDone={() => {
              setTermsPickerOpen(false);
              qc.invalidateQueries({ queryKey: ['vendor-pages'] });
            }}
          />
        )}
        {editorOpen && (
          <PageEditor
            page={editorOpen === 'new' ? null : editorOpen}
            onClose={() => setEditorOpen(null)}
            onSaved={() => {
              setEditorOpen(null);
              qc.invalidateQueries({ queryKey: ['vendor-pages'] });
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── One row in the list ─────────────────────────────────────────────────── */

function PageRow({
  page, onEdit, onDelete, onTogglePublish, onToggleNav, storeUrl, icon,
}: {
  page: CustomPage;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: (v: boolean) => void;
  onToggleNav: (v: boolean) => void;
  storeUrl: string | null;
  icon?: React.ReactNode;
}) {
  const publicUrl = storeUrl ? `${storeUrl}/p/${page.slug}` : null;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 flex items-start gap-3">
      {icon ?? <FileText className="w-4 h-4 text-slate-500 mt-1 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-bold text-white text-sm truncate">{page.title}</p>
          {!page.isPublished && (
            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/20 rounded px-1.5 py-0.5">
              مسوّدة
            </span>
          )}
          {page.showInNav && (
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded px-1.5 py-0.5">
              في القائمة
            </span>
          )}
        </div>
        <p className="text-xs text-slate-500 mt-0.5 font-mono" dir="ltr">/p/{page.slug}</p>
      </div>

      <div className="flex items-center gap-1 flex-wrap justify-end">
        <IconBtn
          title={page.isPublished ? 'أخفِ' : 'انشر'}
          onClick={() => onTogglePublish(!page.isPublished)}
          active={page.isPublished}
        >
          {page.isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
        </IconBtn>
        <IconBtn
          title={page.showInNav ? 'إزالة من القائمة' : 'عرض في القائمة'}
          onClick={() => onToggleNav(!page.showInNav)}
          active={page.showInNav}
        >
          <Sparkles size={14} />
        </IconBtn>
        {publicUrl && page.isPublished && (
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-8 h-8 rounded-lg border border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05] flex items-center justify-center"
            title="افتح"
          >
            <ExternalLink size={13} />
          </a>
        )}
        <IconBtn title="تعديل" onClick={onEdit}><span className="text-[11px] px-1">تعديل</span></IconBtn>
        <IconBtn title="حذف" onClick={onDelete} danger><Trash2 size={14} /></IconBtn>
      </div>
    </div>
  );
}

function IconBtn({
  children, onClick, title, active = false, danger = false,
}: { children: React.ReactNode; onClick: () => void; title: string; active?: boolean; danger?: boolean }) {
  const base = 'w-8 h-8 rounded-lg border flex items-center justify-center transition-colors';
  const cls = danger
    ? 'border-red-500/20 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300'
    : active
    ? 'border-indigo-500/40 bg-indigo-500/15 text-indigo-300'
    : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/[0.05]';
  return (
    <button type="button" onClick={onClick} title={title} className={`${base} ${cls}`}>{children}</button>
  );
}

/* ─── Terms template picker modal ─────────────────────────────────────────── */

function TermsPickerModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [selected, setSelected] = useState<string | null>(null);

  const { data } = useQuery<{ templates: TermsTemplate[] }>({
    queryKey: ['terms-templates'],
    queryFn: () => api.get('/pages/terms-templates').then((r) => r.data),
  });

  const useMutation_ = useMutation({
    mutationFn: (industry: string) =>
      api.post('/pages/mine/terms/use', { industry, replace: true }).then((r) => r.data),
    onSuccess: () => {
      toast.success('تم تفعيل صفحة الشروط');
      onDone();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? 'فشل التفعيل'),
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        className="fixed inset-x-4 bottom-4 top-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:inset-x-auto sm:bottom-auto sm:w-full sm:max-w-xl z-50 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-h-[85vh] overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-black">اختر قالب الشروط المناسب لنشاطك</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-2">
          {(data?.templates ?? []).map((t) => (
            <button
              key={t.industry}
              onClick={() => setSelected(t.industry)}
              className={`w-full text-right p-4 rounded-xl border transition-colors ${
                selected === t.industry
                  ? 'border-indigo-500/50 bg-indigo-500/10'
                  : 'border-white/10 bg-white/[0.02] hover:border-white/20'
              }`}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="font-bold text-white text-sm">{t.label}</p>
                {selected === t.industry && <Check className="w-4 h-4 text-indigo-400 flex-shrink-0" />}
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{t.summary}</p>
            </button>
          ))}
        </div>

        <div className="p-5 border-t border-white/10 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5" />
            يمكنك تعديل النص بعد التفعيل
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/[0.05] text-sm"
            >
              إلغاء
            </button>
            <button
              onClick={() => selected && useMutation_.mutate(selected)}
              disabled={!selected || useMutation_.isPending}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-40 transition-colors inline-flex items-center gap-2"
            >
              {useMutation_.isPending && <Loader2 size={12} className="animate-spin" />}
              فعّل هذا القالب
            </button>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ─── Page editor modal ───────────────────────────────────────────────────── */

function PageEditor({
  page, onClose, onSaved,
}: { page: CustomPage | null; onClose: () => void; onSaved: () => void }) {
  const isNew = !page;
  const [title, setTitle] = useState(page?.title ?? '');
  const [slug, setSlug] = useState(page?.slug ?? '');
  const [content, setContent] = useState(page?.content ?? '');
  const [showInNav, setShowInNav] = useState(page?.showInNav ?? false);
  const [isPublished, setIsPublished] = useState(page?.isPublished ?? true);

  useEffect(() => {
    // Keep the form in sync if a different page is selected mid-session
    setTitle(page?.title ?? '');
    setSlug(page?.slug ?? '');
    setContent(page?.content ?? '');
    setShowInNav(page?.showInNav ?? false);
    setIsPublished(page?.isPublished ?? true);
  }, [page?.id]);

  const isTerms = page?.kind === 'terms';

  const saveMutation = useMutation({
    mutationFn: () =>
      isNew
        ? api.post('/pages/mine', { title, slug: slug || undefined, content, showInNav, isPublished })
        : api.put(`/pages/mine/${page!.id}`, { title, slug: slug || undefined, content, showInNav, isPublished }),
    onSuccess: () => {
      toast.success(isNew ? 'أُنشئت الصفحة' : 'حُفظت التعديلات');
      onSaved();
    },
    onError: (e: { response?: { data?: { error?: string } } }) =>
      toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 30 }}
        className="fixed inset-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-3xl sm:h-auto sm:max-h-[90vh] z-50 bg-slate-900 sm:border sm:border-white/10 sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-lg font-black">
            {isNew ? 'صفحة جديدة' : isTerms ? 'تعديل الشروط والأحكام' : 'تعديل الصفحة'}
          </h3>
          <button onClick={onClose}><X className="w-5 h-5 text-slate-400 hover:text-white" /></button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">العنوان</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: الأسعار، الأسئلة الشائعة، عن المتجر..."
              className="w-full bg-white/[0.04] border border-white/10 focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm outline-none"
            />
          </div>

          {!isTerms && (
            <div>
              <label className="text-xs font-bold text-slate-400 mb-1 block">الـ slug (رابط الصفحة)</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="يُولّد تلقائياً من العنوان لو تركته فاضي"
                dir="ltr"
                className="w-full bg-white/[0.04] border border-white/10 focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm outline-none font-mono"
              />
              <p className="text-[11px] text-slate-600 mt-1">سيظهر في: /store/.../p/{slug || 'generated'}</p>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-400 mb-1 block">
              المحتوى <span className="text-slate-600">(يدعم Markdown)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={14}
              placeholder="اكتب محتوى الصفحة هنا..."
              className="w-full bg-white/[0.04] border border-white/10 focus:border-indigo-500/40 rounded-xl px-4 py-3 text-sm outline-none font-mono leading-relaxed"
            />
          </div>

          <div className="flex gap-3 flex-wrap">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={isPublished}
                onChange={(e) => setIsPublished(e.target.checked)}
                className="accent-indigo-600"
              />
              منشورة
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showInNav}
                onChange={(e) => setShowInNav(e.target.checked)}
                className="accent-indigo-600"
              />
              عرض في قائمة الموقع
            </label>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-slate-300 hover:bg-white/[0.05] text-sm"
          >
            إلغاء
          </button>
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!title.trim() || saveMutation.isPending}
            className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-40 inline-flex items-center gap-2"
          >
            {saveMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={14} />}
            حفظ
          </button>
        </div>
      </motion.div>
    </>
  );
}
