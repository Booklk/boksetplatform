import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, DollarSign, Settings, Lightbulb, Bug,
  Plus, X, Send, ChevronLeft, TicketCheck, Clock, CheckCircle2,
  XCircle, AlertTriangle,
} from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  general: 'عام',
  billing: 'الفواتير',
  technical: 'مشكلة تقنية',
  feature_request: 'طلب ميزة',
  bug: 'خطأ في النظام',
};

const PRIORITY_LABELS: Record<string, string> = {
  urgent: 'عاجل',
  high: 'مهم',
  medium: 'متوسط',
  low: 'منخفض',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'مفتوح',
  in_progress: 'قيد المعالجة',
  resolved: 'تم الحل',
  closed: 'مغلق',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  resolved: 'bg-green-500/20 text-green-300 border-green-500/30',
  closed: 'bg-slate-600/50 text-slate-400 border-slate-500/30',
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  low: 'bg-green-500/20 text-green-300 border-green-500/30',
};

const CATEGORY_COLORS: Record<string, string> = {
  general: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  billing: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  technical: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  feature_request: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
  bug: 'bg-red-500/20 text-red-300 border-red-500/30',
};

function CategoryIcon({ category, size = 16 }: { category: string; size?: number }) {
  const props = { size, className: 'shrink-0' };
  switch (category) {
    case 'billing': return <DollarSign {...props} />;
    case 'technical': return <Settings {...props} />;
    case 'feature_request': return <Lightbulb {...props} />;
    case 'bug': return <Bug {...props} />;
    default: return <MessageSquare {...props} />;
  }
}

function StatusIcon({ status, size = 16 }: { status: string; size?: number }) {
  const props = { size, className: 'shrink-0' };
  switch (status) {
    case 'open': return <TicketCheck {...props} className="shrink-0 text-blue-400" />;
    case 'in_progress': return <Clock {...props} className="shrink-0 text-yellow-400" />;
    case 'resolved': return <CheckCircle2 {...props} className="shrink-0 text-green-400" />;
    case 'closed': return <XCircle {...props} className="shrink-0 text-slate-400" />;
    default: return <TicketCheck {...props} />;
  }
}

function Badge({ label, colorClass }: { label: string; colorClass: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colorClass}`}>
      {label}
    </span>
  );
}

// ─── New Ticket Modal ─────────────────────────────────────────────────────────

function NewTicketModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    subject: '',
    category: 'general',
    priority: 'medium',
    description: '',
  });

  const { mutate: submit, isPending } = useMutation({
    mutationFn: () => api.post('/support', form).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-support-tickets'] });
      toast.success('تم إرسال التذكرة بنجاح');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في إرسال التذكرة'),
  });

  const isValid = form.subject.trim().length >= 3 && form.description.trim().length >= 10;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0f1628] border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <h2 className="font-bold text-lg flex items-center gap-2">
            <Plus size={20} className="text-blue-400" />
            تذكرة دعم جديدة
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6 space-y-4">
          {/* Subject */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">الموضوع *</label>
            <input
              value={form.subject}
              onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
              placeholder="وصف موجز للمشكلة أو الطلب"
              maxLength={255}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Category + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">الفئة</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors appearance-none"
              >
                {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1.5">الأولوية</label>
              <select
                value={form.priority}
                onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full bg-[#0a0f1e] border border-white/10 rounded-xl px-4 py-3 text-white text-sm focus:border-blue-500 focus:outline-none transition-colors appearance-none"
              >
                {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm text-slate-400 mb-1.5">الوصف التفصيلي *</label>
            <textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="اشرح المشكلة أو الطلب بالتفصيل..."
              rows={5}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none transition-colors"
            />
            <p className="text-xs text-slate-500 mt-1 text-left">{form.description.length} حرف (الحد الأدنى 10)</p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={() => submit()}
            disabled={!isValid || isPending}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <Send size={15} />
            {isPending ? 'جاري الإرسال...' : 'إرسال التذكرة'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl text-sm transition-colors"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Ticket Detail Drawer ─────────────────────────────────────────────────────

function TicketDetailDrawer({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const qc = useQueryClient();

  const { mutate: closeTicket, isPending: isClosing } = useMutation({
    mutationFn: () => api.patch(`/support/${ticket.id}/close`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-support-tickets'] });
      toast.success('تم إغلاق التذكرة');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في إغلاق التذكرة'),
  });

  const canClose = ticket.status !== 'closed';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 25 }}
        className="bg-[#0f1628] border border-white/10 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <StatusIcon status={ticket.status} size={20} />
            <span className="font-semibold text-sm">تذكرة #{ticket.id}</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Subject */}
          <div>
            <h3 className="font-bold text-lg leading-snug">{ticket.subject}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {new Date(ticket.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              label={CATEGORY_LABELS[ticket.category] ?? ticket.category}
              colorClass={CATEGORY_COLORS[ticket.category] ?? CATEGORY_COLORS.general}
            />
            <Badge
              label={PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
              colorClass={PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium}
            />
            <Badge
              label={STATUS_LABELS[ticket.status] ?? ticket.status}
              colorClass={STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}
            />
          </div>

          {/* Description */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-sm text-slate-400 mb-2 font-medium">الوصف</p>
            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Admin Reply */}
          {ticket.adminReply ? (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={15} className="text-blue-400" />
                <p className="text-sm text-blue-300 font-medium">رد فريق الدعم</p>
                {ticket.adminRepliedAt && (
                  <span className="text-xs text-slate-500 mr-auto">
                    {new Date(ticket.adminRepliedAt).toLocaleDateString('ar-SA')}
                  </span>
                )}
              </div>
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{ticket.adminReply}</p>
            </div>
          ) : (
            <div className="bg-white/3 border border-white/8 rounded-xl p-4 text-center">
              <Clock size={20} className="text-slate-500 mx-auto mb-2" />
              <p className="text-sm text-slate-500">في انتظار رد فريق الدعم</p>
            </div>
          )}

          {ticket.resolvedAt && (
            <div className="flex items-center gap-2 text-green-400 text-sm">
              <CheckCircle2 size={16} />
              <span>تم حل التذكرة في {new Date(ticket.resolvedAt).toLocaleDateString('ar-SA')}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 pt-4 border-t border-white/10 flex gap-3">
          {canClose && (
            <button
              onClick={() => closeTicket()}
              disabled={isClosing}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white py-3 rounded-xl text-sm font-medium transition-colors"
            >
              <XCircle size={15} />
              {isClosing ? 'جاري الإغلاق...' : 'إغلاق التذكرة'}
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-xl text-sm transition-colors"
          >
            <ChevronLeft size={15} className="inline ml-1" />
            رجوع
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Ticket Card ──────────────────────────────────────────────────────────────

function TicketCard({ ticket, onClick }: { ticket: SupportTicket; onClick: () => void }) {
  const preview = ticket.description.length > 100
    ? ticket.description.slice(0, 100) + '...'
    : ticket.description;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      onClick={onClick}
      className="bg-[#0f1628] border border-white/10 rounded-2xl p-5 cursor-pointer hover:border-blue-500/40 transition-all"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg ${CATEGORY_COLORS[ticket.category]?.split(' ')[0] ?? 'bg-slate-500/20'}`}>
            <CategoryIcon category={ticket.category} size={14} />
          </div>
          <h3 className="font-semibold text-sm truncate">{ticket.subject}</h3>
        </div>
        <Badge
          label={STATUS_LABELS[ticket.status] ?? ticket.status}
          colorClass={STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}
        />
      </div>

      {/* Preview */}
      <p className="text-sm text-slate-400 leading-relaxed mb-3 line-clamp-2">{preview}</p>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge
            label={CATEGORY_LABELS[ticket.category] ?? ticket.category}
            colorClass={CATEGORY_COLORS[ticket.category] ?? CATEGORY_COLORS.general}
          />
          <Badge
            label={PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
            colorClass={PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium}
          />
        </div>
        <span className="text-xs text-slate-500">
          {new Date(ticket.createdAt).toLocaleDateString('ar-SA')}
        </span>
      </div>

      {/* Admin reply indicator */}
      {ticket.adminReply && (
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2 text-blue-400 text-xs">
          <MessageSquare size={12} />
          <span>تم الرد من فريق الدعم</span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VendorSupport() {
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['vendor-support-tickets'],
    queryFn: () => api.get('/support').then(r => r.data),
  });

  const filtered = statusFilter === 'all'
    ? tickets
    : tickets.filter(t => t.status === statusFilter);

  const statusCounts = {
    all: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
  };

  const FILTER_TABS = [
    { key: 'all', label: 'الكل', count: statusCounts.all },
    { key: 'open', label: 'مفتوح', count: statusCounts.open },
    { key: 'in_progress', label: 'قيد المعالجة', count: statusCounts.in_progress },
    { key: 'resolved', label: 'تم الحل', count: statusCounts.resolved },
    { key: 'closed', label: 'مغلق', count: statusCounts.closed },
  ];

  return (
    <div className="min-h-screen bg-surface-1 text-white p-4 md:p-6" dir="rtl">
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TicketCheck className="text-blue-400" size={26} />
            الدعم الفني
          </h1>
          <p className="text-slate-400 text-sm mt-1">إدارة تذاكر الدعم والتواصل مع الفريق التقني</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">تذكرة جديدة</span>
          <span className="sm:hidden">جديد</span>
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'المفتوحة', value: statusCounts.open, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'قيد المعالجة', value: statusCounts.in_progress, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'تم الحل', value: statusCounts.resolved, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'المغلقة', value: statusCounts.closed, color: 'text-slate-400', bg: 'bg-slate-700/50' },
        ].map(card => (
          <div key={card.label} className={`${card.bg} border border-white/10 rounded-2xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1 scrollbar-none">
        {FILTER_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
              statusFilter === tab.key
                ? 'bg-blue-600 text-white'
                : 'bg-white/10 text-slate-300 hover:bg-white/15'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-xs ${statusFilter === tab.key ? 'bg-white/20' : 'bg-white/10'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tickets list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-white/5 rounded-2xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <AlertTriangle size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">لا توجد تذاكر</p>
          <p className="text-sm">
            {statusFilter === 'all'
              ? 'لم يتم إنشاء أي تذاكر دعم بعد'
              : `لا توجد تذاكر بحالة "${STATUS_LABELS[statusFilter] ?? statusFilter}"`}
          </p>
          {statusFilter === 'all' && (
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-4 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors mx-auto"
            >
              <Plus size={15} />
              إنشاء تذكرة الآن
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((ticket, i) => (
              <motion.div
                key={ticket.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <TicketCard ticket={ticket} onClick={() => setSelectedTicket(ticket)} />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showNewModal && <NewTicketModal onClose={() => setShowNewModal(false)} />}
        {selectedTicket && (
          <TicketDetailDrawer
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
