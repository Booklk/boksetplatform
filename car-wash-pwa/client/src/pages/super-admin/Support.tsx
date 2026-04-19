import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TicketCheck, X, Send, CheckCircle2, Clock,
  MessageSquare, DollarSign, Settings, Lightbulb, Bug,
  AlertTriangle, Building2, Filter, Zap, StickyNote, Star,
  ChevronDown,
} from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface SupportTicket {
  id: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  adminReply: string | null;
  adminRepliedAt: string | null;
  resolvedAt: string | null;
  satisfactionRating: number | null;
  internalNote: string | null;
  createdAt: string;
  updatedAt: string;
  vendorId: number | null;
  submittedBy: number | null;
  vendorName: string | null;
  submitterName: string | null;
}

interface Reply {
  id: number;
  message: string;
  role: string;
  isInternal: boolean;
  createdAt: string;
  userName: string | null;
}

interface CannedResponse {
  id: string;
  label: string;
  text: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عام', billing: 'الفواتير', technical: 'مشكلة تقنية',
  feature_request: 'طلب ميزة', bug: 'خطأ في النظام',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجل', high: 'مهم', medium: 'متوسط', low: 'منخفض',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوح', in_progress: 'قيد المعالجة', waiting_vendor: 'بانتظار التاجر',
  resolved: 'تم الحل', closed: 'مغلق',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  waiting_vendor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
  closed: 'bg-slate-600/50 text-slate-400 border-slate-500/30',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-300 border-green-500/30',
};

function CategoryIcon({ category, size = 14 }: { category: string; size?: number }) {
  const cls = 'shrink-0';
  switch (category) {
    case 'billing': return <DollarSign size={size} className={cls} />;
    case 'technical': return <Settings size={size} className={cls} />;
    case 'feature_request': return <Lightbulb size={size} className={cls} />;
    case 'bug': return <Bug size={size} className={cls} />;
    default: return <MessageSquare size={size} className={cls} />;
  }
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}

function timeSince(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return 'الآن';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins} دقيقة`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} ساعة`;
  const days = Math.floor(hrs / 24);
  return `${days} يوم`;
}

// ─── Ticket Detail Modal ────────────────────────────────────────────────────

function TicketModal({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [showCanned, setShowCanned] = useState(false);
  const [internalNote, setInternalNote] = useState(ticket.internalNote ?? '');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: detail } = useQuery<SupportTicket & { replies: Reply[] }>({
    queryKey: ['support-ticket', ticket.id],
    queryFn: () => api.get(`/support/${ticket.id}`).then(r => r.data),
    refetchInterval: 15000,
  });

  const { data: cannedResponses = [] } = useQuery<CannedResponse[]>({
    queryKey: ['canned-responses'],
    queryFn: () => api.get('/support/canned').then(r => r.data),
    staleTime: Infinity,
  });

  const replies = detail?.replies ?? [];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  const sendReply = useMutation({
    mutationFn: () => api.post(`/support/${ticket.id}/reply`, { message: replyText, isInternal }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['support-ticket', ticket.id] });
      qc.invalidateQueries({ queryKey: ['super-admin-support-tickets'] });
      setReplyText('');
      setIsInternal(false);
      toast.success(isInternal ? 'تم إضافة ملاحظة داخلية' : 'تم إرسال الرد');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل'),
  });

  const resolve = useMutation({
    mutationFn: () => api.patch(`/support/${ticket.id}/resolve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin-support-tickets'] });
      toast.success('تم تحديد التذكرة كمحلولة');
      onClose();
    },
  });

  const saveNote = useMutation({
    mutationFn: () => api.patch(`/support/${ticket.id}/note`, { note: internalNote }),
    onSuccess: () => toast.success('تم حفظ الملاحظة'),
  });

  const isBusy = sendReply.isPending || resolve.isPending;
  const canResolve = !['resolved', 'closed'].includes(detail?.status ?? ticket.status);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0f1628] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20">
              <CategoryIcon category={ticket.category} size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-sm truncate">{ticket.subject}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">#{ticket.id}</span>
                <Badge label={STATUS_LABELS[detail?.status ?? ticket.status] ?? ticket.status}
                  colorClass={STATUS_COLORS[detail?.status ?? ticket.status] ?? STATUS_COLORS.open} />
                <Badge label={PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                  colorClass={PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium} />
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Info bar */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-white/5 text-xs text-slate-500">
          <span><Building2 size={12} className="inline ml-1" />{ticket.vendorName ?? 'غير محدد'}</span>
          <span>المُرسل: {ticket.submitterName ?? 'غير معروف'}</span>
          <span>منذ {timeSince(ticket.createdAt)}</span>
          {detail?.satisfactionRating && (
            <span className="flex items-center gap-0.5 text-amber-400">
              <Star size={11} /> {detail.satisfactionRating}/5
            </span>
          )}
        </div>

        {/* Conversation */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0">
          {/* Original description */}
          <div className="flex justify-end">
            <div className="max-w-[80%] bg-white/5 border border-white/10 rounded-2xl rounded-tr-sm px-4 py-3">
              <p className="text-xs text-slate-400 mb-1">{ticket.submitterName ?? 'التاجر'}</p>
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              <p className="text-[10px] text-slate-600 mt-1">{new Date(ticket.createdAt).toLocaleString('ar-SA')}</p>
            </div>
          </div>

          {/* Replies */}
          {replies.map(r => (
            <div key={r.id} className={`flex ${r.role === 'admin' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                r.isInternal
                  ? 'bg-amber-500/10 border border-amber-500/20 rounded-tl-sm'
                  : r.role === 'admin'
                    ? 'bg-blue-500/10 border border-blue-500/20 rounded-tl-sm'
                    : 'bg-white/5 border border-white/10 rounded-tr-sm'
              }`}>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs text-slate-400">
                    {r.isInternal ? '🔒 ملاحظة داخلية' : (r.role === 'admin' ? 'فريق الدعم' : r.userName ?? 'التاجر')}
                  </p>
                </div>
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{r.message}</p>
                <p className="text-[10px] text-slate-600 mt-1">{new Date(r.createdAt).toLocaleString('ar-SA')}</p>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Internal Note */}
        <div className="px-5 py-2 border-t border-white/5">
          <details className="group">
            <summary className="flex items-center gap-1.5 text-xs text-amber-400 cursor-pointer select-none">
              <StickyNote size={12} /> ملاحظة داخلية (لا تظهر للتاجر)
              <ChevronDown size={12} className="group-open:rotate-180 transition-transform" />
            </summary>
            <div className="mt-2 flex gap-2">
              <input
                value={internalNote}
                onChange={e => setInternalNote(e.target.value)}
                placeholder="ملاحظة للفريق..."
                className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-amber-500/40"
              />
              <button onClick={() => saveNote.mutate()}
                className="px-3 py-2 bg-amber-600/20 text-amber-400 rounded-lg text-xs font-medium hover:bg-amber-600/30">
                حفظ
              </button>
            </div>
          </details>
        </div>

        {/* Reply input */}
        <div className="px-5 py-3 border-t border-white/10 space-y-2">
          {/* Canned responses */}
          <div className="relative">
            <button onClick={() => setShowCanned(!showCanned)}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300">
              <Zap size={12} /> ردود سريعة
              <ChevronDown size={12} className={showCanned ? 'rotate-180' : ''} />
            </button>
            <AnimatePresence>
              {showCanned && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
                  className="absolute bottom-full mb-2 left-0 right-0 bg-[#0a0f1e] border border-white/10 rounded-xl p-2 max-h-48 overflow-y-auto z-10"
                >
                  {cannedResponses.map(cr => (
                    <button key={cr.id} onClick={() => { setReplyText(cr.text); setShowCanned(false); }}
                      className="w-full text-right px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-colors">
                      {cr.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex gap-2">
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder={isInternal ? 'ملاحظة داخلية...' : 'اكتب ردك...'}
              rows={2}
              className={`flex-1 bg-white/5 border rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 resize-none focus:outline-none transition-colors ${
                isInternal ? 'border-amber-500/30 focus:border-amber-500' : 'border-white/10 focus:border-blue-500'
              }`}
            />
            <div className="flex flex-col gap-1.5">
              <button onClick={() => sendReply.mutate()}
                disabled={isBusy || !replyText.trim()}
                className="flex-1 flex items-center justify-center gap-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 rounded-xl text-sm transition-colors">
                <Send size={14} />
              </button>
              {canResolve && (
                <button onClick={() => resolve.mutate()} disabled={isBusy}
                  className="flex items-center justify-center gap-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-4 py-1.5 rounded-xl text-xs transition-colors">
                  <CheckCircle2 size={12} /> حل
                </button>
              )}
            </div>
          </div>

          {/* Internal toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={isInternal} onChange={e => setIsInternal(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-white/20 bg-white/5 accent-amber-500" />
            <span className="text-xs text-slate-500">ملاحظة داخلية (لا تظهر للتاجر)</span>
          </label>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function SuperAdminSupport() {
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['super-admin-support-tickets'],
    queryFn: () => api.get('/support').then(r => r.data),
    refetchInterval: 30000,
  });

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length;

  const STATUS_TABS = [
    { key: 'all', label: 'الكل', count: tickets.length },
    { key: 'open', label: 'مفتوح', count: openCount },
    { key: 'in_progress', label: 'قيد المعالجة', count: inProgressCount },
    { key: 'resolved', label: 'تم الحل', count: resolvedCount },
    { key: 'closed', label: 'مغلق', count: tickets.filter(t => t.status === 'closed').length },
  ];

  return (
    <div className="min-h-screen bg-surface-1 text-white p-4 md:p-6" dir="rtl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TicketCheck className="text-blue-400" size={26} />
          تذاكر الدعم
        </h1>
        <p className="text-slate-400 text-sm mt-1">إدارة طلبات الدعم — محادثة مباشرة مع التجار</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'المفتوحة', value: openCount, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'قيد المعالجة', value: inProgressCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'تم الحل', value: resolvedCount, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'عاجلة', value: urgentCount, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} border border-white/10 rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
                statusFilter === tab.key ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/15'
              }`}>
              {tab.label}
              {tab.count > 0 && <span className="text-xs opacity-70">({tab.count})</span>}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 mr-auto">
          <Filter size={14} className="text-slate-400" />
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}
            className="bg-[#0a0f1e] border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm focus:border-blue-500 focus:outline-none">
            <option value="all">كل الأولويات</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>

      {/* Tickets list */}
      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">لا توجد تذاكر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => (
            <button key={ticket.id} onClick={() => setSelectedTicket(ticket)}
              className="w-full text-right bg-[#0f1628] border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    ticket.priority === 'urgent' ? 'bg-red-500 animate-pulse' :
                    ticket.priority === 'high' ? 'bg-orange-500' :
                    ticket.status === 'open' ? 'bg-blue-500' : 'bg-slate-600'
                  }`} />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{ticket.subject}</span>
                      <span className="text-xs text-slate-600">#{ticket.id}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-500">{ticket.vendorName ?? 'غير محدد'}</span>
                      <span className="text-xs text-slate-600">·</span>
                      <span className="text-xs text-slate-600">منذ {timeSince(ticket.createdAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge label={CATEGORY_LABELS[ticket.category] ?? ticket.category}
                    colorClass="bg-slate-700/60 text-slate-300 border-slate-600/50" />
                  <Badge label={STATUS_LABELS[ticket.status] ?? ticket.status}
                    colorClass={STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedTicket && (
          <TicketModal ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />
        )}
      </AnimatePresence>
    </div>
  );
}
