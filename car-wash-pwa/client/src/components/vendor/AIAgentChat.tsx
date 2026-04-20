/**
 * AIAgentChat — industry-specialised AI financial/ops advisor chat.
 * Talks to POST /api/ai-advisor/agent/chat. Handles:
 *   - Opt-in toggle (vendor.settings.aiAdvisor.enabled)
 *   - Industry-aware suggested questions
 *   - Tool-call trail (what data the agent fetched)
 */

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Brain, Send, Sparkles, RefreshCw, Power, Database,
  Wrench, Loader2, MessageCircle, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../lib/api';

interface AgentStatus {
  enabled: boolean;
  industry: string;
  industryLabel: string;
  serverHasApiKey: boolean;
}

interface ToolCall {
  name: string;
  args: unknown;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ToolCall[];
}

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  salon: [
    'وش الباقات الأعلى مبيعاً عندي؟',
    'كيف أرفع إيرادي بدون ما أفقد زبوناتي؟',
    'مصروفاتي هذا الشهر مرتفعة، وين الخلل؟',
    'هل أسعاري مناسبة لسوق الرياض؟',
  ],
  barber: [
    'كم قصة يسوي كل حلاق في اليوم؟',
    'وش أفضل وقت أسوي فيه عرض الأربعاء؟',
    'كيف أبني نظام اشتراك شهري يزيد ولاء العملاء؟',
  ],
  car_wash: [
    'ليش نسبة الإلغاء مرتفعة؟',
    'كم الربح الفعلي بعد حسم كل التكاليف؟',
    'وش أفضل باقة أركز على بيعها؟',
  ],
  car_wash_mobile: [
    'تكلفة الوقود والمواصلات تأكل هامشي، شنو الحل؟',
    'كيف أوزّع الحجوزات بذكاء لتقليل الوقت الضايع؟',
    'هل يستحق أدخل في عقود شركات؟',
  ],
  car_wash_fixed: [
    'كيف أستغل ساعات الصباح الهادئة؟',
    'الطابور طويل بعد العصر، شنو الحل؟',
    'هل أفتح باقة VIP؟',
  ],
  cleaning: [
    'كيف أتحوّل من طلبات فردية إلى عقود شهرية؟',
    'تسعيري بالساعة أم بالمتر المربع أفضل؟',
    'مصاريف المواد عالية، كيف أقلّلها؟',
  ],
  movers: [
    'كيف أوقف التسعير من الواتساب بدون معاينة؟',
    'وش الخدمات المكمّلة اللي ترفع الـ ticket؟',
    'سياراتي فاضية وسط الأسبوع، كيف أستغلها؟',
  ],
  beauty_home: [
    'كيف أرفع أسعار مواعيد العرائس؟',
    'هل باقة "قبل العرس + يوم العرس" فكرة جيدة؟',
    'تكلفة المواصلات ما أحسبها في السعر، شنو النصيحة؟',
  ],
  spa: [
    'غرفي فاضية نص اليوم، كيف أعبّيها؟',
    'كيف أبيع منتجات للعميلة بعد الجلسة؟',
    'برنامج عضوية سنوية فكرة منطقية؟',
  ],
  universal: [
    'راجع أرقامي هذا الشهر واعطني ٣ توصيات',
    'مخزوني كيف حالته؟',
    'وش الباقات الأعلى مبيعاً؟',
  ],
};

function suggestionsFor(industry: string): string[] {
  return SUGGESTED_QUESTIONS[industry] ?? SUGGESTED_QUESTIONS.universal;
}

const TOOL_LABELS: Record<string, string> = {
  get_financial_summary: 'راجع الأرقام المالية',
  get_inventory_status: 'تفقّد المخزون',
  get_top_packages: 'قرأ أعلى الباقات',
  get_customer_metrics: 'حلّل قاعدة العملاء',
  get_employee_productivity: 'فحص أداء الموظفين',
  get_peak_pattern: 'حلّل ساعات الذروة',
};

export default function AIAgentChat() {
  const qc = useQueryClient();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [expandedToolTrail, setExpandedToolTrail] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const { data: status, isLoading: statusLoading } = useQuery<AgentStatus>({
    queryKey: ['ai-agent-status'],
    queryFn: () => api.get('/ai-advisor/agent/status').then((r) => r.data),
  });

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      api.put('/ai-advisor/agent/toggle', { enabled }).then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.enabled ? 'تم تفعيل المستشار الذكي' : 'تم إيقاف المستشار الذكي');
      qc.invalidateQueries({ queryKey: ['ai-agent-status'] });
    },
    onError: () => toast.error('فشل تحديث الإعداد'),
  });

  const sendMutation = useMutation({
    mutationFn: (userMsg: string) => {
      const convo = [...messages, { role: 'user' as const, content: userMsg, id: 'tmp' }];
      return api
        .post('/ai-advisor/agent/chat', {
          messages: convo.map((m) => ({ role: m.role, content: m.content })),
        })
        .then((r) => r.data);
    },
    onSuccess: (data: { reply: string; toolCalls: ToolCall[] }) => {
      setMessages((prev) => [
        ...prev,
        {
          id: String(Date.now()),
          role: 'assistant',
          content: data.reply,
          toolCalls: data.toolCalls,
        },
      ]);
    },
    onError: (err: { response?: { data?: { error?: string; needsEnable?: boolean } } }) => {
      const d = err?.response?.data;
      if (d?.needsEnable) {
        qc.invalidateQueries({ queryKey: ['ai-agent-status'] });
      }
      toast.error(d?.error ?? 'فشل الإرسال');
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, sendMutation.isPending]);

  function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages((prev) => [...prev, { id: String(Date.now()), role: 'user', content: trimmed }]);
    setInput('');
    sendMutation.mutate(trimmed);
  }

  if (statusLoading) {
    return (
      <div className="p-6 bg-slate-900/60 border border-white/[0.06] rounded-2xl">
        <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
      </div>
    );
  }

  /* ── Disabled state: enable CTA ────────────────────────────────────── */
  if (!status?.enabled) {
    return (
      <div className="relative overflow-hidden p-6 sm:p-8 bg-gradient-to-br from-indigo-900/30 via-slate-900 to-violet-900/30 border border-indigo-500/25 rounded-2xl">
        <div className="relative z-10 flex flex-col sm:flex-row gap-5 items-start">
          <div className="w-14 h-14 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
            <Brain className="w-7 h-7 text-indigo-300" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <h3 className="font-black text-white text-lg">المستشار الذكي — مختص بقطاعك</h3>
              <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full">
                اختياري
              </span>
            </div>
            <p className="text-slate-300 text-sm mb-3 leading-relaxed">
              مستشار مالي وأعمال متخصص في <span className="font-bold text-indigo-300">{status?.industryLabel ?? 'قطاعك'}</span>،
              يقرأ أرقامك الحقيقية (مخزون، دخل، مصاريف، عملاء، موظفين) ويعطيك توصيات عملية بلهجة سعودية.
            </p>
            <ul className="text-xs text-slate-400 space-y-1.5 mb-5">
              <li>✓ يحلل مصاريفك ويدلّك على وين تقدر توفّر</li>
              <li>✓ يقترح أفكار لزيادة المبيعات مبنية على معايير السوق السعودي</li>
              <li>✓ يقارن أدائك بقطاعك ويحدد نقاط الضعف</li>
              <li>✓ تقدر تفعّله وتوقفه في أي وقت — ما يعمل إلا لما تختار</li>
            </ul>
            <button
              onClick={() => toggleMutation.mutate(true)}
              disabled={toggleMutation.isPending}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm transition-colors disabled:opacity-50"
            >
              {toggleMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
              فعّل المستشار الذكي
            </button>
            {!status?.serverHasApiKey && (
              <p className="text-[11px] text-amber-300 mt-3 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 inline-block">
                ⚠️ السيرفر ما عنده مفتاح OpenAI حالياً — راسل الدعم لتفعيله.
              </p>
            )}
          </div>
        </div>
        <Sparkles className="absolute top-4 left-4 w-5 h-5 text-indigo-400/40" />
      </div>
    );
  }

  /* ── Enabled state: chat UI ─────────────────────────────────────────── */
  const suggestions = suggestionsFor(status.industry);

  return (
    <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-gradient-to-l from-indigo-900/20 to-transparent">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Brain className="w-4 h-4 text-indigo-300" />
          </div>
          <div>
            <p className="font-black text-white text-sm">المستشار الذكي</p>
            <p className="text-[10px] text-slate-400">متخصص: {status.industryLabel}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              title="محادثة جديدة"
            >
              <RefreshCw size={12} /> جديد
            </button>
          )}
          <button
            onClick={() => toggleMutation.mutate(false)}
            className="text-[11px] text-slate-500 hover:text-rose-400 flex items-center gap-1 transition-colors"
            title="إيقاف المستشار"
          >
            <Power size={12} /> إيقاف
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="max-h-[520px] overflow-y-auto p-5 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-4">
            <MessageCircle className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-slate-400 text-sm mb-4">اسألني أي شي عن متجرك — أنا أشوف أرقامك.</p>
            <div className="flex flex-col gap-2 max-w-md mx-auto">
              {suggestions.map((q) => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-right text-xs bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-indigo-500/30 text-slate-300 rounded-xl px-3 py-2 transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${
                  m.role === 'user'
                    ? 'bg-slate-700 text-slate-200'
                    : 'bg-indigo-500/20 border border-indigo-500/30 text-indigo-300'
                }`}
              >
                {m.role === 'user' ? 'أنت' : <Brain size={14} />}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className={`inline-block max-w-[95%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-indigo-600/20 border border-indigo-500/30 text-indigo-100 rounded-2xl rounded-tr-sm'
                      : 'bg-white/[0.04] border border-white/[0.06] text-slate-100 rounded-2xl rounded-tl-sm'
                  }`}
                >
                  {m.content}
                </div>
                {m.toolCalls && m.toolCalls.length > 0 && (
                  <div className="mt-2">
                    <button
                      onClick={() => setExpandedToolTrail(expandedToolTrail === m.id ? null : m.id)}
                      className="text-[10px] text-slate-500 hover:text-indigo-300 flex items-center gap-1 transition-colors"
                    >
                      <Database size={10} />
                      استند على {m.toolCalls.length} من بياناتك
                      <ChevronDown
                        size={10}
                        className={`transition-transform ${expandedToolTrail === m.id ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {expandedToolTrail === m.id && (
                      <ul className="mt-2 text-[10px] text-slate-400 bg-slate-800/50 rounded-lg p-2 space-y-1">
                        {m.toolCalls.map((tc, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <Wrench size={9} className="text-indigo-400" />
                            {TOOL_LABELS[tc.name] ?? tc.name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sendMutation.isPending && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <Brain size={14} className="text-indigo-300" />
            </div>
            <div className="bg-white/[0.04] border border-white/[0.06] rounded-2xl rounded-tl-sm px-4 py-2.5 inline-flex items-center gap-2">
              <Loader2 size={12} className="animate-spin text-slate-400" />
              <span className="text-xs text-slate-400">يراجع أرقامك…</span>
            </div>
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-white/[0.06] bg-slate-950/50">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="اسأل المستشار..."
            disabled={sendMutation.isPending}
            className="flex-1 bg-white/[0.04] border border-white/[0.06] focus:border-indigo-500/40 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-colors disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || sendMutation.isPending}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm disabled:opacity-40 transition-colors"
          >
            <Send size={14} />
          </button>
        </form>
      </div>
    </div>
  );
}
