import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, DollarSign, Settings, Lightbulb, Bug,
  Plus, X, Send, TicketCheck, Clock, CheckCircle2,
  XCircle, Star,
} from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

interface SupportTicket {
  id: number; subject: string; category: string; priority: string; status: string;
  description: string; adminReply: string | null; adminRepliedAt: string | null;
  resolvedAt: string | null; satisfactionRating: number | null;
  createdAt: string; updatedAt: string;
}

interface Reply {
  id: number; message: string; role: string; isInternal: boolean;
  createdAt: string; userName: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عام', billing: 'الفواتير', technical: 'مشكلة تقنية',
  feature_request: 'طلب ميزة', bug: 'خطأ في النظام',
};
const PRIORITY_LABELS: Record<string, string> = { urgent: 'عاجل', high: 'مهم', medium: 'متوسط', low: 'منخفض' };
const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوح', in_progress: 'قيد المعالجة', waiting_vendor: 'بانتظار ردك',
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

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>{label}</span>;
}

function timeSince(date: string): string {
  const s = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (s < 60) return 'الآن';
  const m = Math.floor(s / 60); if (m < 60) return `${m} دقيقة`;
  const h = Math.floor(m / 60); if (h < 24) return `${h} ساعة`;
  return `${Math.floor(h / 24)} يوم`;
}

// ─── New Ticket Modal ───────────────────────────────────────────────────────

function NewTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ subject: '', category: 'general', priority: 'medium', description: '' });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => api.post('/support', form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['vendor-support-tickets'] }); toast.success('تم إرسال التذكرة'); onClose(); },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل'),
  });

  const isValid = form.subject.trim().length >= 3 && form.description.trim().length >= 10;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-[#0f1628] border border-white/10 rounded-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-bold text-lg flex items-center gap-2"><Plus size={20} className="text-blue-400" /> تذكرة جديدة</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">الموضوع *</label>
            <input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="وصف موجز..." maxLength={255}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">الفئة</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none">
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">الأولوية</label>
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none">
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">الوصف *</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="اشرح المشكلة بالتفصيل..." rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none" />
            <p className="text-xs text-slate-500 mt-1 text-left">{form.description.length} / 10+</p>
          </div>
        </div>
        <div className="px-6 pb-6 flex gap-3">
          <button onClick={() => submit()} disabled={!isValid || isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-bold transition-colors">
            <Send size={15} /> {isPending ? 'جاري الإرسال...' : 'إرسال'}
          </button>
          <button onClick={onClose} className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl text-sm">إلغاء</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Ticket Chat Drawer ─────────────────────────────────────────────────────

function TicketChat({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState('');
  const [rating, setRating] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: detail } = useQuery<SupportTicket & { replies: Reply[] }>({
    queryKey: ['vendor-ticket', ticket.id],
    queryFn: () => api.get(`/support/${ticket.id}`).then(r => r.data),
    refetchInterval: 15000,
  });

  const replies = detail?.replies ?? [];
  const currentStatus = detail?.status ?? ticket.status;
  const isResolved = currentStatus === 'resolved' || currentStatus === 'closed';
  const canRate = isResolved && !detail?.satisfactionRating;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies.length]);

  const sendReply = useMutation({
    mutationFn: () => api.post(`/support/${ticket.id}/reply`, { message: replyText }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-ticket', ticket.id] });
      qc.invalidateQueries({ queryKey: ['vendor-support-tickets'] });
      setReplyText('');
      toast.success('تم إرسال الرد');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل'),
  });

  const closeTicket = useMutation({
    mutationFn: () => api.patch(`/support/${ticket.id}/close`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-support-tickets'] });
      toast.success('تم إغلاق التذكرة');
      onClose();
    },
  });

  const rateTicket = useMutation({
    mutationFn: (r: number) => api.patch(`/support/${ticket.id}/rate`, { rating: r }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-ticket', ticket.id] });
      toast.success('شكراً لتقييمك!');
    },
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
        className="bg-[#0f1628] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="min-w-0">
            <h2 className="font-bold text-sm truncate">{ticket.subject}</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-slate-500">#{ticket.id}</span>
              <Badge label={STATUS_LABELS[currentStatus] ?? currentStatus}
                colorClass={STATUS_COLORS[currentStatus] ?? STATUS_COLORS.open} />
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white"><X size={18} /></button>
        </div>

        {/* Chat */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
          {/* Original message */}
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-indigo-500/10 border border-indigo-500/20 rounded-2xl rounded-tr-sm px-4 py-3">
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
              <p className="text-[10px] text-slate-600 mt-1">{new Date(ticket.createdAt).toLocaleString('ar-SA')}</p>
            </div>
          </div>

          {/* Replies */}
          {replies.map(r => (
            <div key={r.id} className={`flex ${r.role === 'admin' ? 'justify-start' : 'justify-end'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                r.role === 'admin'
                  ? 'bg-blue-500/10 border border-blue-500/20 rounded-tl-sm'
                  : 'bg-indigo-500/10 border border-indigo-500/20 rounded-tr-sm'
              }`}>
                <p className="text-xs text-slate-400 mb-1">{r.role === 'admin' ? 'فريق الدعم' : 'أنت'}</p>
                <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{r.message}</p>
                <p className="text-[10px] text-slate-600 mt-1">{new Date(r.createdAt).toLocaleString('ar-SA')}</p>
              </div>
            </div>
          ))}

          {/* Resolved notice + rating */}
          {isResolved && (
            <div className="text-center space-y-3 py-3">
              <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                <CheckCircle2 size={16} />
                <span>تم حل التذكرة</span>
              </div>
              {canRate && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-400">كيف تقيّم تجربة الدعم؟</p>
                  <div className="flex justify-center gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => { setRating(s); rateTicket.mutate(s); }}
                        className={`p-1 transition-colors ${s <= rating ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400/50'}`}>
                        <Star size={24} fill={s <= rating ? 'currentColor' : 'none'} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {detail?.satisfactionRating && (
                <div className="flex justify-center gap-0.5">
                  {[1,2,3,4,5].map(s => (
                    <Star key={s} size={16} className={s <= detail.satisfactionRating! ? 'text-amber-400' : 'text-slate-700'}
                      fill={s <= detail.satisfactionRating! ? 'currentColor' : 'none'} />
                  ))}
                </div>
              )}
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Reply input */}
        {currentStatus !== 'closed' && (
          <div className="px-4 py-3 border-t border-white/10">
            <div className="flex gap-2">
              <textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                placeholder="اكتب ردك..." rows={2}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500" />
              <div className="flex flex-col gap-1.5">
                <button onClick={() => sendReply.mutate()} disabled={sendReply.isPending || !replyText.trim()}
                  className="flex-1 flex items-center justify-center bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white px-4 rounded-xl transition-colors">
                  <Send size={14} />
                </button>
                {currentStatus !== 'resolved' && (
                  <button onClick={() => closeTicket.mutate()} disabled={closeTicket.isPending}
                    className="flex items-center justify-center bg-slate-700 hover:bg-slate-600 text-white px-4 py-1.5 rounded-xl text-xs transition-colors">
                    <XCircle size={12} className="ml-1" /> إغلاق
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── Main ───────────────────────────────────────────────────────────────────

export default function VendorSupport() {
  const [showNew, setShowNew] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['vendor-support-tickets'],
    queryFn: () => api.get('/support').then(r => r.data),
    refetchInterval: 30000,
  });

  const filtered = tickets.filter(t => statusFilter === 'all' || t.status === statusFilter);

  const openCount = tickets.filter(t => t.status === 'open' || t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;

  return (
    <div className="min-h-screen bg-surface-1 text-white p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TicketCheck className="text-blue-400" size={26} /> الدعم الفني
          </h1>
          <p className="text-slate-400 text-sm mt-1">تواصل مع فريق الدعم مباشرة</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-colors">
          <Plus size={16} /> تذكرة جديدة
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'مفتوحة', value: openCount, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'تم حلها', value: resolvedCount, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'الكل', value: tickets.length, color: 'text-slate-400', bg: 'bg-slate-500/10' },
        ].map(c => (
          <div key={c.label} className={`${c.bg} border border-white/10 rounded-xl p-3 text-center`}>
            <p className={`text-xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {[
          { key: 'all', label: 'الكل' },
          { key: 'open', label: 'مفتوح' },
          { key: 'in_progress', label: 'قيد المعالجة' },
          { key: 'resolved', label: 'تم الحل' },
          { key: 'closed', label: 'مغلق' },
        ].map(tab => (
          <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
            className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              statusFilter === tab.key ? 'bg-blue-600 text-white' : 'bg-white/10 text-slate-300'
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tickets */}
      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <MessageSquare size={48} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">لا توجد تذاكر</p>
          <button onClick={() => setShowNew(true)} className="mt-3 text-blue-400 text-sm hover:underline">أنشئ تذكرة جديدة</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(ticket => (
            <button key={ticket.id} onClick={() => setSelectedTicket(ticket)}
              className="w-full text-right bg-[#0f1628] border border-white/10 rounded-xl px-4 py-3 hover:bg-white/[0.03] transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${
                    ticket.status === 'open' ? 'bg-blue-500' :
                    ticket.status === 'in_progress' ? 'bg-yellow-500 animate-pulse' :
                    ticket.status === 'resolved' ? 'bg-green-500' : 'bg-slate-600'
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{ticket.subject}</p>
                    <p className="text-xs text-slate-500 mt-0.5">منذ {timeSince(ticket.createdAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {ticket.adminReply && <Clock size={12} className="text-blue-400" />}
                  <Badge label={STATUS_LABELS[ticket.status] ?? ticket.status}
                    colorClass={STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open} />
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showNew && <NewTicketModal onClose={() => setShowNew(false)} />}
        {selectedTicket && <TicketChat ticket={selectedTicket} onClose={() => setSelectedTicket(null)} />}
      </AnimatePresence>
    </div>
  );
}
