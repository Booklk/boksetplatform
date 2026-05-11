/**
 * Jdawil Copilot — global AI chat drawer.
 *
 * Keyboard:  Cmd/Ctrl+I    → toggle
 *            Esc           → close
 *
 * Flow: user types a request → server replies either
 *   (a) a final message with a summary / chart payload, or
 *   (b) a *preview* of a write action asking for confirmation.
 * On confirmation, we re-send the previous user message prefixed with
 * "نفّذ" — the model interprets that as "call the tool again with
 * _confirm: true" and the write actually happens.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Sparkles, Send, X, CornerDownLeft, Loader2, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { useAuth } from '../hooks/useAuth';
import { springs } from '../design/motion';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  /** Rich trace from the last assistant turn — tool calls + results. */
  trace?: Array<{ tool: string; args: unknown; result: ToolResult }>;
}

interface ToolResult {
  summary: string;
  data?: unknown;
  preview?: {
    title: string;
    rows: Array<{ label: string; value: string }>;
    executeHint: string;
  };
}

interface ChatResp {
  reply: string;
  trace: Array<{ tool: string; args: unknown; result: ToolResult }>;
}

const SEED_SUGGESTIONS = [
  'كم حجز عندي اليوم؟',
  'أعرض إيرادات آخر 30 يوم',
  'من أعلى 5 عملاء إنفاقاً؟',
  'أضف خدمة قص شعر أطفال 30 ريال 20 دقيقة',
  'عرض العملاء اللي ما زاروني من شهر',
];

export default function Copilot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [msgs]);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    setInput('');
    const nextMsgs: Msg[] = [...msgs, { role: 'user', content: text }];
    setMsgs(nextMsgs);
    setLoading(true);
    try {
      const { data } = await api.post<ChatResp>('/copilot/chat', {
        messages: nextMsgs.map((m) => ({ role: m.role, content: m.content })),
      });
      setMsgs((cur) => [...cur, { role: 'assistant', content: data.reply, trace: data.trace }]);
    } catch (e: any) {
      const err = e?.response?.data?.error ?? 'تعذّر التواصل مع المساعد';
      toast.error(err);
      setMsgs((cur) => [...cur, { role: 'assistant', content: err }]);
    } finally {
      setLoading(false);
    }
  }, [msgs, loading]);

  // Only vendor owners / admins see the Copilot trigger.
  const show = user && (user.role === 'vendor_admin' || user.role === 'admin');
  if (!show) return null;

  const last = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
  const previewToolCall = last?.trace?.find((t) => Boolean(t.result.preview));
  const preview = previewToolCall?.result.preview ?? null;

  async function confirmAction() {
    if (!previewToolCall) return;
    // The model is prompted to interpret "نفّذ" as "call again with _confirm: true".
    await send('نفّذ.');
  }

  return (
    <>
      {/* Floating trigger */}
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        transition={springs.snappy}
        className="fixed bottom-5 start-5 z-[55] h-12 px-4 rounded-full bg-gradient-to-br from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30 flex items-center gap-2 font-bold text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary-300 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-950"
        aria-label="افتح المساعد الذكي"
      >
        <Sparkles size={16} />
        <span className="hidden sm:inline">جدول</span>
        <kbd className="hidden sm:inline text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/20">⌘I</kbd>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="المساعد الذكي"
            dir="rtl"
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={springs.gentle}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl h-[85vh] sm:h-[600px] bg-ink-950 border border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
                    <Sparkles size={16} className="text-white" />
                  </div>
                  <div>
                    <p className="text-sm font-black text-white">جدول — المساعد الذكي</p>
                    <p className="text-[11px] text-ink-500">اسأل، عدّل، حلّل — بالعربي</p>
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/[0.06] text-ink-400"
                  aria-label="إغلاق"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                {msgs.length === 0 && (
                  <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-14 h-14 rounded-2xl bg-primary-500/10 border border-primary-500/20 flex items-center justify-center mb-3">
                      <Sparkles size={22} className="text-primary-400" />
                    </div>
                    <p className="text-sm font-bold text-white mb-1">وش تبي تعرف عن متجرك؟</p>
                    <p className="text-xs text-ink-500 mb-5 max-w-sm">
                      اسألني بالعربي عن أي شي — إيرادات، عملاء، موظفين. أو اطلب مني أضيف/أعدّل.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-md">
                      {SEED_SUGGESTIONS.map((s) => (
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

                {msgs.map((m, i) => (
                  <MessageRow key={i} msg={m} />
                ))}

                {loading && (
                  <div className="flex items-center gap-2 text-xs text-ink-400">
                    <Loader2 size={14} className="animate-spin text-primary-400" />
                    يفكّر…
                  </div>
                )}
              </div>

              {/* Preview confirmation bar */}
              {preview && !loading && (
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springs.gentle}
                  className="mx-5 mb-3 rounded-2xl border border-warn-500/30 bg-warn-500/5 p-3"
                >
                  <p className="text-xs font-black text-warn-300 mb-2 flex items-center gap-1.5">
                    <CheckCircle2 size={13} />
                    معاينة — {preview.title}
                  </p>
                  <div className="space-y-1 mb-3">
                    {preview.rows.map((r: { label: string; value: string }) => (
                      <div key={r.label} className="flex items-center justify-between text-[11px]">
                        <span className="text-ink-500">{r.label}</span>
                        <span className="text-white font-bold">{r.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={confirmAction}
                      className="flex-1 h-9 px-3 rounded-xl bg-warn-500 hover:bg-warn-400 text-ink-900 font-black text-xs transition-colors"
                    >
                      تأكيد التنفيذ
                    </button>
                    <button
                      onClick={() => send('ألغِ العملية.')}
                      className="h-9 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs font-bold"
                    >
                      إلغاء
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Composer */}
              <div className="border-t border-white/[0.06] p-3">
                <form
                  onSubmit={(e) => { e.preventDefault(); send(input); }}
                  className="flex items-end gap-2"
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
                    placeholder="اسأل أو اطلب أي شي…"
                    className="flex-1 resize-none bg-white/[0.04] border border-white/[0.08] focus:border-primary-500/40 rounded-xl px-3 py-2.5 text-sm outline-none text-white placeholder:text-ink-500 max-h-32"
                    disabled={loading}
                    aria-label="رسالة للمساعد"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className="h-11 w-11 shrink-0 rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-50 flex items-center justify-center text-white"
                    aria-label="إرسال"
                  >
                    <Send size={16} />
                  </button>
                </form>
                <p className="text-[10px] text-ink-600 mt-1.5 flex items-center gap-1.5">
                  <CornerDownLeft size={10} />
                  اضغط Enter للإرسال · Shift+Enter لسطر جديد
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function MessageRow({ msg }: { msg: Msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
          isUser
            ? 'bg-primary-500/20 border border-primary-500/30 text-primary-50'
            : 'bg-white/[0.04] border border-white/[0.06] text-ink-100'
        }`}
      >
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {msg.trace && msg.trace.length > 0 && (
          <div className="mt-2 pt-2 border-t border-white/[0.06] space-y-1">
            {msg.trace.map((t, i) => (
              <p key={i} className="text-[10px] text-ink-500 font-mono" dir="ltr">
                ⚙ {t.tool}
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
