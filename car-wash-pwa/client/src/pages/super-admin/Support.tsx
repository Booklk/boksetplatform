import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TicketCheck, X, Send, CheckCircle2, Clock,
  MessageSquare, DollarSign, Settings, Lightbulb, Bug,
  AlertTriangle, Building2, Filter,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

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
  vendorId: number | null;
  submittedBy: number | null;
  vendorName: string | null;
  submitterName: string | null;
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

// ─── Ticket Detail Modal ──────────────────────────────────────────────────────

function TicketModal({ ticket, onClose }: { ticket: SupportTicket; onClose: () => void }) {
  const { token } = useAuth();
  const qc = useQueryClient();
  const [replyText, setReplyText] = useState(ticket.adminReply ?? '');
  const API = import.meta.env.VITE_API_URL ?? '';

  const replyMutation = useMutation({
    mutationFn: () =>
      axios.patch(`${API}/api/support/${ticket.id}/reply`, { adminReply: replyText }, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin-support-tickets'] });
      toast.success('تم إرسال الرد بنجاح');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في إرسال الرد'),
  });

  const resolveMutation = useMutation({
    mutationFn: () =>
      axios.patch(`${API}/api/support/${ticket.id}/resolve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['super-admin-support-tickets'] });
      toast.success('تم تحديد التذكرة كمحلولة');
      onClose();
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في تحديث الحالة'),
  });

  const isBusy = replyMutation.isPending || resolveMutation.isPending;
  const canResolve = ticket.status !== 'resolved' && ticket.status !== 'closed';

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
        className="bg-[#0f1628] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20">
              <CategoryIcon category={ticket.category} size={16} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-base truncate">{ticket.subject}</h2>
              <p className="text-xs text-slate-400">تذكرة #{ticket.id}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {/* Metadata badges */}
          <div className="flex flex-wrap gap-2">
            <Badge
              label={STATUS_LABELS[ticket.status] ?? ticket.status}
              colorClass={STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}
            />
            <Badge
              label={PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
              colorClass={PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium}
            />
            <Badge
              label={CATEGORY_LABELS[ticket.category] ?? ticket.category}
              colorClass="bg-slate-700/60 text-slate-300 border-slate-600/50"
            />
          </div>

          {/* Vendor + submitter info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">المغسلة</p>
              <div className="flex items-center gap-1.5">
                <Building2 size={13} className="text-slate-400 shrink-0" />
                <span className="text-sm font-medium truncate">{ticket.vendorName ?? 'غير محدد'}</span>
              </div>
            </div>
            <div className="bg-white/5 border border-white/10 rounded-xl p-3">
              <p className="text-xs text-slate-500 mb-1">المُرسِل</p>
              <p className="text-sm font-medium truncate">{ticket.submitterName ?? 'غير معروف'}</p>
            </div>
          </div>

          {/* Date */}
          <p className="text-xs text-slate-500">
            تاريخ الإنشاء: {new Date(ticket.createdAt).toLocaleDateString('ar-SA', {
              year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </p>

          {/* Description */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <p className="text-xs text-slate-400 mb-2 font-medium">الوصف</p>
            <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{ticket.description}</p>
          </div>

          {/* Existing admin reply */}
          {ticket.adminReply && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MessageSquare size={14} className="text-blue-400" />
                <p className="text-sm text-blue-300 font-medium">الرد السابق</p>
                {ticket.adminRepliedAt && (
                  <span className="text-xs text-slate-500 mr-auto">
                    {new Date(ticket.adminRepliedAt).toLocaleDateString('ar-SA')}
                  </span>
                )}
              </div>
              <p className="text-sm text-white leading-relaxed whitespace-pre-wrap">{ticket.adminReply}</p>
            </div>
          )}

          {/* Resolved notice */}
          {ticket.resolvedAt && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-500/10 border border-green-500/20 rounded-xl p-3">
              <CheckCircle2 size={16} />
              <span>تم حل التذكرة في {new Date(ticket.resolvedAt).toLocaleDateString('ar-SA')}</span>
            </div>
          )}

          {/* Reply textarea */}
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              {ticket.adminReply ? 'تحديث الرد' : 'إضافة رد'}
            </label>
            <textarea
              value={replyText}
              onChange={e => setReplyText(e.target.value)}
              placeholder="اكتب ردك هنا..."
              rows={4}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder-slate-500 resize-none focus:border-blue-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="px-6 pb-6 pt-4 border-t border-white/10 space-y-3">
          {/* Send reply */}
          <button
            onClick={() => replyMutation.mutate()}
            disabled={isBusy || replyText.trim().length < 1}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white py-3 rounded-xl text-sm font-semibold transition-colors"
          >
            <Send size={15} />
            {replyMutation.isPending ? 'جاري الإرسال...' : 'إرسال الرد'}
          </button>

          {/* Resolve + Close row */}
          <div className="flex gap-3">
            {canResolve && (
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={isBusy}
                className="flex-1 flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-medium transition-colors"
              >
                <CheckCircle2 size={15} />
                {resolveMutation.isPending ? 'جاري...' : 'تم الحل'}
              </button>
            )}
            <button
              onClick={onClose}
              className="flex-1 bg-white/10 hover:bg-white/20 text-white py-2.5 rounded-xl text-sm transition-colors"
            >
              إغلاق
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SuperAdminSupport() {
  const { token } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const API = import.meta.env.VITE_API_URL ?? '';

  const { data: tickets = [], isLoading } = useQuery<SupportTicket[]>({
    queryKey: ['super-admin-support-tickets'],
    queryFn: () =>
      axios.get(`${API}/api/support`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then(r => r.data),
    refetchInterval: 60000,
  });

  const filtered = tickets.filter(t => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  const openCount = tickets.filter(t => t.status === 'open').length;
  const inProgressCount = tickets.filter(t => t.status === 'in_progress').length;
  const resolvedCount = tickets.filter(t => t.status === 'resolved').length;
  const urgentCount = tickets.filter(t => t.priority === 'urgent' && t.status === 'open').length;

  const STATUS_TABS = [
    { key: 'all', label: 'الكل' },
    { key: 'open', label: 'مفتوح' },
    { key: 'in_progress', label: 'قيد المعالجة' },
    { key: 'resolved', label: 'تم الحل' },
    { key: 'closed', label: 'مغلق' },
  ];

  return (
    <div className="min-h-screen bg-[#040812] text-white p-4 md:p-6" dir="rtl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TicketCheck className="text-blue-400" size={26} />
          تذاكر الدعم
        </h1>
        <p className="text-slate-400 text-sm mt-1">إدارة طلبات الدعم من جميع المغسلات</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'المفتوحة', value: openCount, color: 'text-blue-400', bg: 'bg-blue-500/10' },
          { label: 'قيد المعالجة', value: inProgressCount, color: 'text-yellow-400', bg: 'bg-yellow-500/10' },
          { label: 'تم الحل', value: resolvedCount, color: 'text-green-400', bg: 'bg-green-500/10' },
          { label: 'عاجلة ومفتوحة', value: urgentCount, color: 'text-red-400', bg: 'bg-red-500/10' },
        ].map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${card.bg} border border-white/10 rounded-2xl p-4 text-center`}
          >
            <p className={`text-2xl font-bold ${card.color}`}>{card.value}</p>
            <p className="text-xs text-slate-400 mt-1">{card.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        {/* Status tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map(tab => (
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
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="flex items-center gap-2 mr-auto">
          <Filter size={14} className="text-slate-400 shrink-0" />
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="bg-[#0a0f1e] border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm focus:border-blue-500 focus:outline-none appearance-none"
          >
            <option value="all">كل الأولويات</option>
            {Object.entries(PRIORITY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 bg-white/5 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-slate-500">
          <AlertTriangle size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">لا توجد تذاكر</p>
        </div>
      ) : (
        <div className="bg-[#0f1628] border border-white/10 rounded-2xl overflow-hidden">
          {/* Table header — hidden on mobile */}
          <div className="hidden md:grid grid-cols-[3rem_1fr_1fr_1fr_1fr_6rem_5rem] gap-4 px-5 py-3 border-b border-white/10 text-xs text-slate-400 font-medium">
            <span>رقم</span>
            <span>المغسلة</span>
            <span>الموضوع</span>
            <span>الأولوية</span>
            <span>الحالة</span>
            <span>التاريخ</span>
            <span>إجراء</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-white/5">
            <AnimatePresence>
              {filtered.map((ticket, i) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-5 py-4 hover:bg-white/3 transition-colors"
                >
                  {/* Mobile layout */}
                  <div className="md:hidden space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs text-slate-500">#{ticket.id}</span>
                          <span className="text-xs text-slate-400">{ticket.vendorName ?? 'غير محدد'}</span>
                        </div>
                        <p className="font-medium text-sm truncate">{ticket.subject}</p>
                      </div>
                      <Badge
                        label={STATUS_LABELS[ticket.status] ?? ticket.status}
                        colorClass={STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-2">
                        <Badge
                          label={PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                          colorClass={PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium}
                        />
                      </div>
                      <button
                        onClick={() => setSelectedTicket(ticket)}
                        className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                      >
                        عرض
                      </button>
                    </div>
                  </div>

                  {/* Desktop layout */}
                  <div className="hidden md:grid grid-cols-[3rem_1fr_1fr_1fr_1fr_6rem_5rem] gap-4 items-center">
                    {/* ID */}
                    <span className="text-sm text-slate-400">#{ticket.id}</span>

                    {/* Vendor */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Building2 size={13} className="text-slate-500 shrink-0" />
                      <span className="text-sm truncate">{ticket.vendorName ?? 'غير محدد'}</span>
                    </div>

                    {/* Subject */}
                    <div className="flex items-center gap-1.5 min-w-0">
                      <CategoryIcon category={ticket.category} size={13} />
                      <span className="text-sm truncate">{ticket.subject}</span>
                    </div>

                    {/* Priority */}
                    <Badge
                      label={PRIORITY_LABELS[ticket.priority] ?? ticket.priority}
                      colorClass={PRIORITY_COLORS[ticket.priority] ?? PRIORITY_COLORS.medium}
                    />

                    {/* Status */}
                    <Badge
                      label={STATUS_LABELS[ticket.status] ?? ticket.status}
                      colorClass={STATUS_COLORS[ticket.status] ?? STATUS_COLORS.open}
                    />

                    {/* Date */}
                    <span className="text-xs text-slate-500">
                      {new Date(ticket.createdAt).toLocaleDateString('ar-SA')}
                    </span>

                    {/* Action */}
                    <button
                      onClick={() => setSelectedTicket(ticket)}
                      className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <MessageSquare size={12} />
                      عرض
                    </button>
                  </div>

                  {/* Urgent indicator */}
                  {ticket.priority === 'urgent' && ticket.status === 'open' && (
                    <div className="flex items-center gap-1.5 mt-2 text-red-400 text-xs">
                      <AlertTriangle size={11} />
                      <span>تذكرة عاجلة — تحتاج رداً فورياً</span>
                    </div>
                  )}

                  {/* Reply indicator */}
                  {ticket.adminReply && (
                    <div className="flex items-center gap-1.5 mt-1 text-blue-400 text-xs opacity-70">
                      <Clock size={11} />
                      <span>تم الرد</span>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* Ticket detail modal */}
      <AnimatePresence>
        {selectedTicket && (
          <TicketModal
            ticket={selectedTicket}
            onClose={() => setSelectedTicket(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
