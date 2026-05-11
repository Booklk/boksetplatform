/**
 * /vendor/studio — Lovable-style edit workspace.
 *
 *   ┌───────────────────────┬───────────────────────────┐
 *   │ Copilot chat          │ Live storefront preview   │
 *   │ "فعّل بانر أحمر بنص …" │ (iframe of /store/:slug)  │
 *   │                       │ auto-refreshes on tool     │
 *   │                       │ success                    │
 *   └───────────────────────┴───────────────────────────┘
 *
 * The vendor types in natural Saudi Arabic; Copilot routes the request
 * to the right tool (banner / hero / hours / booking rules / deposit /
 * customer fields / service media). Each successful tool run bumps a
 * `previewNonce` which reloads the iframe — the result is instant visual
 * feedback, the same feel Lovable gives on their editor.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  Sparkles, Send, RefreshCw, Monitor, Smartphone, CornerDownLeft, Loader2,
  CheckCircle2,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Button, Card, Badge, PageHeader } from '../../components/ui';
import { springs } from '../../design/motion';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  trace?: Array<{ tool: string; args: unknown; result: ToolResult }>;
}
interface ToolResult {
  summary: string;
  data?: unknown;
  preview?: { title: string; rows: Array<{ label: string; value: string }>; executeHint: string };
}
interface ChatResp { reply: string; trace: ToolResult['preview'] extends unknown ? any[] : never; }

const SUGGESTIONS = [
  'فعّل بانر أحمر بنص "خصم 25% حتى الجمعة"',
  'خل الجمعة مغلق',
  'غيّر الهيرو لفيديو يوتيوب',
  'اطلب عربون 20% على كل حجز',
  'خل البريد الإلكتروني إلزامي',
  'زد مدة الفترة إلى 45 دقيقة',
];

export default function Studio() {
  const { user } = useAuth();
  const vendorSlug = (user as any)?.vendor?.slug as string | undefined;

  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0);
  const [device, setDevice] = useState<'mobile' | 'desktop'>('mobile');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    const nextMsgs: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMsgs);
    setLoading(true);
    try {
      const { data } = await api.post<ChatResp>('/copilot/chat', {
        messages: nextMsgs.map((m) => ({ role: m.role, content: m.content })),
      });
      setMessages((cur) => [...cur, { role: 'assistant', content: data.reply, trace: data.trace as any }]);
      // If a write tool ran successfully (non-preview), refresh the iframe.
      const hadMutation = (data.trace ?? []).some((t: any) => t?.result && !t.result.preview);
      if (hadMutation) setPreviewNonce((n) => n + 1);
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'تعذّر التواصل مع المساعد');
      setMessages((cur) => [...cur, { role: 'assistant', content: 'صار خطأ — جرّب صياغة ثانية.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [messages, loading]);

  const lastPreview = (() => {
    const last = messages[messages.length - 1];
    const trace = last?.trace ?? [];
    for (let i = trace.length - 1; i >= 0; i--) {
      if (trace[i]?.result?.preview) return trace[i].result.preview;
    }
    return null;
  })();

  const previewUrl = vendorSlug
    ? `/store/${vendorSlug}?preview=1&n=${previewNonce}`
    : '';

  return (
    <div className="min-h-screen bg-ink-950 text-white p-4 sm:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto">
        <PageHeader
          icon={<Sparkles size={20} />}
          title="استوديو التصميم الذكي"
          subtitle="قل بالعربي وش تبي — ويتطبّق على موقعك فوراً."
          actions={<Badge tone="primary" size="md">AI</Badge>}
        />

        <div className="grid lg:grid-cols-[420px,1fr] gap-4 h-[calc(100vh-160px)]">
          {/* ── Chat column ─────────────────────────────────────────── */}
          <Card variant="elevated" padding="none" className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                <Sparkles size={14} className="text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-black">جدول</p>
                <p className="text-[10px] text-ink-500">يعدّل موقعك بالعربي — حدّد وتابع</p>
              </div>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <p className="text-[11px] text-ink-500 text-center">جرّب وحدة من هذه:</p>
                  <div className="grid gap-1.5">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="text-right p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] text-xs text-ink-200 transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((m, i) => <Bubble key={i} m={m} />)}
              {loading && (
                <div className="flex items-center gap-2 text-xs text-ink-400">
                  <Loader2 size={13} className="animate-spin text-primary-400" />
                  يفكّر…
                </div>
              )}
            </div>

            {lastPreview && !loading && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springs.gentle}
                className="mx-3 mb-2 rounded-2xl border border-warn-500/30 bg-warn-500/5 p-3"
              >
                <p className="text-xs font-black text-warn-300 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={12} />
                  {lastPreview.title}
                </p>
                <div className="space-y-1 mb-3">
                  {lastPreview.rows.map((r: { label: string; value: string }) => (
                    <div key={r.label} className="flex items-center justify-between text-[11px] gap-2">
                      <span className="text-ink-500">{r.label}</span>
                      <span className="text-white font-bold truncate text-left" dir="auto">{r.value}</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => send('نفّذ.')}
                    className="flex-1 h-8 px-3 rounded-xl bg-warn-500 hover:bg-warn-400 text-ink-900 font-black text-xs"
                  >
                    تأكيد
                  </button>
                  <button
                    onClick={() => send('ألغِ.')}
                    className="h-8 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold"
                  >
                    إلغاء
                  </button>
                </div>
              </motion.div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); send(input); }}
              className="border-t border-white/[0.06] p-3 flex items-end gap-2"
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder="قل بالعربي..."
                className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-xl px-3 py-2.5 text-sm outline-none text-white placeholder:text-ink-500 max-h-32"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-11 w-11 shrink-0 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 flex items-center justify-center text-white"
              >
                <Send size={15} />
              </button>
            </form>
            <p className="px-3 pb-2 text-[10px] text-ink-600 flex items-center gap-1.5">
              <CornerDownLeft size={9} />
              Enter للإرسال · Shift+Enter لسطر جديد
            </p>
          </Card>

          {/* ── Preview column ──────────────────────────────────────── */}
          <Card variant="elevated" padding="none" className="flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/[0.06]">
              <div className="flex items-center gap-1 ms-auto">
                <button
                  onClick={() => setDevice('mobile')}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                    device === 'mobile' ? 'bg-primary-500 text-white' : 'bg-white/[0.04] text-ink-300'
                  }`}
                >
                  <Smartphone size={12} />
                  موبايل
                </button>
                <button
                  onClick={() => setDevice('desktop')}
                  className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold transition-colors ${
                    device === 'desktop' ? 'bg-primary-500 text-white' : 'bg-white/[0.04] text-ink-300'
                  }`}
                >
                  <Monitor size={12} />
                  ديسك توب
                </button>
                <button
                  onClick={() => setPreviewNonce((n) => n + 1)}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[11px] font-bold bg-white/[0.04] hover:bg-white/[0.08] text-ink-300"
                  aria-label="إعادة تحميل المعاينة"
                >
                  <RefreshCw size={12} />
                  تحديث
                </button>
              </div>
            </div>
            <div className="flex-1 p-4 bg-ink-900 overflow-hidden flex items-center justify-center">
              {!vendorSlug ? (
                <p className="text-sm text-ink-500">افتح متجرك أولاً من FastOnboard.</p>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${device}-${previewNonce}`}
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={springs.gentle}
                    className={`
                      bg-white rounded-2xl overflow-hidden shadow-2xl
                      ${device === 'mobile'
                        ? 'w-[375px] h-[92%] max-h-[780px]'
                        : 'w-full h-full'}
                    `}
                  >
                    <iframe
                      src={previewUrl}
                      title="معاينة المتجر"
                      className="w-full h-full border-0"
                    />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isUser = m.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[90%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
          isUser
            ? 'bg-primary-500/20 border border-primary-500/30 text-primary-50'
            : 'bg-white/[0.04] border border-white/[0.06] text-ink-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{m.content}</p>
        {m.trace && m.trace.length > 0 && (
          <div className="mt-1.5 pt-1.5 border-t border-white/[0.06] space-y-0.5">
            {m.trace.map((t: any, i: number) => (
              <p key={i} className="text-[9px] text-ink-500 font-mono" dir="ltr">
                ⚙ {t.tool}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
