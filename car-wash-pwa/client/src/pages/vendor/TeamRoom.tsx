import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Send, Pin, Trash2, Plus, Check, Clock, AlertCircle, Users, MessageSquare, ListChecks, X } from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import toast from 'react-hot-toast';

interface Member {
  id: number;
  name: string;
  phone: string;
  role: string;
}
interface Message {
  id: number;
  authorId: number;
  authorName: string | null;
  body: string;
  pinned: boolean;
  createdAt: string;
}
interface Task {
  id: number;
  title: string;
  description: string | null;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'normal' | 'high' | 'urgent';
  dueAt: string | null;
  assigneeId: number | null;
  assigneeName: string | null;
  createdById: number;
}

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  low: 'منخفض', normal: 'عادي', high: 'مرتفع', urgent: 'عاجل',
};
const PRIORITY_COLOR: Record<Task['priority'], string> = {
  low: 'text-slate-400',
  normal: 'text-blue-300',
  high: 'text-amber-300',
  urgent: 'text-rose-300',
};

export default function VendorTeamRoom() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'chat' | 'tasks'>('chat');
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Data ────────────────────────────────────────────────────────────────
  const { data: members = [] } = useQuery<Member[]>({
    queryKey: ['team-members'],
    queryFn: async () => (await api.get('/team/members')).data,
    staleTime: 5 * 60 * 1000,
  });
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['team-messages'],
    queryFn: async () => (await api.get('/team/messages?limit=80')).data,
    refetchInterval: 5_000,
  });
  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ['team-tasks'],
    queryFn: async () => (await api.get('/team/tasks')).data,
  });

  // Auto-scroll on new messages.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  // Update read cursor on visit.
  useEffect(() => {
    if (messages.length === 0 || tab !== 'chat') return;
    const last = messages[messages.length - 1];
    api.post('/team/read', { lastReadMessageId: last.id }).catch(() => {});
  }, [messages.length, tab]);

  // ─── Mutations ───────────────────────────────────────────────────────────
  const sendMessage = useMutation({
    mutationFn: async (body: string) =>
      (await api.post('/team/messages', { body })).data,
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['team-messages'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر إرسال الرسالة'),
  });

  const deleteMessage = useMutation({
    mutationFn: async (id: number) => api.delete(`/team/messages/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-messages'] }),
  });

  const togglePin = useMutation({
    mutationFn: async ({ id, pinned }: { id: number; pinned: boolean }) =>
      api.patch(`/team/messages/${id}/pin`, { pinned }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-messages'] }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Task> & { id: number }) =>
      (await api.patch(`/team/tasks/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-tasks'] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: number) => api.delete(`/team/tasks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team-tasks'] }),
  });

  const isAdmin = user?.role === 'vendor_admin' || user?.role === 'admin';
  const pinnedMessages = messages.filter((m) => m.pinned);

  return (
    <div dir="rtl" className="min-h-[calc(100vh-72px)] bg-[#0b1220] text-white flex flex-col">
      {/* Header */}
      <header className="border-b border-white/8 bg-[#0d1929] px-4 sm:px-6 py-4 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0 w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-300">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-white font-black text-lg leading-tight truncate">
                غرفة المتجر
              </h1>
              <p className="text-xs text-slate-400 truncate">
                {members.length} شخص في الفريق
              </p>
            </div>
          </div>

          {/* Tab pills */}
          <div className="flex bg-white/5 rounded-xl p-1">
            <button
              onClick={() => setTab('chat')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'chat' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">المحادثة</span>
            </button>
            <button
              onClick={() => setTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                tab === 'tasks' ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">المهام</span>
              <span className="text-[10px] bg-white/15 px-1.5 rounded-full">
                {tasks.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length}
              </span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 max-w-5xl w-full mx-auto px-3 sm:px-6 pb-3">
        {tab === 'chat' && (
          <div className="flex flex-col h-[calc(100vh-160px)]">
            {/* Pinned bar */}
            {pinnedMessages.length > 0 && (
              <div className="border-b border-white/8 py-3">
                {pinnedMessages.map((m) => (
                  <div key={m.id} className="flex items-start gap-2 text-xs text-amber-200 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2 mb-1">
                    <Pin className="w-3 h-3 mt-0.5 shrink-0" />
                    <p className="leading-relaxed">
                      <span className="font-bold">{m.authorName}: </span>
                      {m.body}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 space-y-2.5">
              {messages.length === 0 ? (
                <div className="text-center py-16 text-slate-500">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
                  <p className="font-bold text-slate-300">لا توجد رسائل بعد</p>
                  <p className="text-xs mt-1">ابدأ المحادثة مع فريقك</p>
                </div>
              ) : (
                messages.map((m) => {
                  const mine = m.authorId === user?.id;
                  const canDelete = mine || isAdmin;
                  return (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${mine ? 'justify-start' : 'justify-end'}`}
                    >
                      <div className={`group max-w-[85%] sm:max-w-[70%] rounded-2xl px-4 py-2.5 ${
                        mine ? 'bg-indigo-500/15 border border-indigo-500/30' : 'bg-white/[0.04] border border-white/10'
                      }`}>
                        {!mine && (
                          <p className="text-[11px] font-bold text-slate-400 mb-0.5">{m.authorName}</p>
                        )}
                        <p className="text-sm text-white whitespace-pre-wrap leading-relaxed break-words">
                          {m.body}
                        </p>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <span className="text-[10px] text-slate-500">
                            {new Date(m.createdAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            {isAdmin && (
                              <button
                                onClick={() => togglePin.mutate({ id: m.id, pinned: !m.pinned })}
                                className="text-slate-500 hover:text-amber-300"
                                title={m.pinned ? 'إلغاء التثبيت' : 'تثبيت'}
                              >
                                <Pin className="w-3 h-3" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => deleteMessage.mutate(m.id)}
                                className="text-slate-500 hover:text-rose-300"
                                title="حذف"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Composer */}
            <div className="border-t border-white/8 pt-3 pb-[max(env(safe-area-inset-bottom),12px)]">
              <div className="flex items-end gap-2">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      if (draft.trim()) sendMessage.mutate(draft.trim());
                    }
                  }}
                  placeholder="اكتب رسالة لفريقك…"
                  rows={1}
                  className="flex-1 bg-white/[0.04] border border-white/10 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-indigo-500/60 resize-none max-h-32"
                />
                <button
                  onClick={() => draft.trim() && sendMessage.mutate(draft.trim())}
                  disabled={!draft.trim() || sendMessage.isPending}
                  className="shrink-0 w-11 h-11 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-40 flex items-center justify-center text-white transition-colors"
                  aria-label="إرسال"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'tasks' && (
          <TasksView
            tasks={tasks}
            members={members}
            isAdmin={isAdmin}
            currentUserId={user?.id ?? 0}
            onUpdate={(id, data) => updateTask.mutate({ id, ...data })}
            onDelete={(id) => deleteTask.mutate(id)}
          />
        )}
      </div>
    </div>
  );
}

// ─── Tasks View ─────────────────────────────────────────────────────────────
function TasksView({
  tasks,
  members,
  isAdmin,
  currentUserId,
  onUpdate,
  onDelete,
}: {
  tasks: Task[];
  members: Member[];
  isAdmin: boolean;
  currentUserId: number;
  onUpdate: (id: number, data: Partial<Task>) => void;
  onDelete: (id: number) => void;
}) {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState<'all' | 'open' | 'mine' | 'done'>('all');

  const filtered = tasks.filter((t) => {
    if (filter === 'open') return t.status !== 'done' && t.status !== 'cancelled';
    if (filter === 'done') return t.status === 'done';
    if (filter === 'mine') return t.assigneeId === currentUserId;
    return true;
  });

  const createTask = useMutation({
    mutationFn: async (data: { title: string; description?: string; assigneeId?: number; priority?: Task['priority']; dueAt?: string }) =>
      (await api.post('/team/tasks', data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-tasks'] });
      setShowNew(false);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر إضافة المهمة'),
  });

  return (
    <div className="py-4 space-y-4">
      {/* Filters + add */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex bg-white/5 rounded-xl p-1 text-xs">
          {(['all', 'open', 'mine', 'done'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-colors ${
                filter === f ? 'bg-indigo-500 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {f === 'all' ? 'الكل' : f === 'open' ? 'مفتوحة' : f === 'mine' ? 'لي' : 'مُكتملة'}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNew(true)}
          className="flex items-center gap-1.5 bg-indigo-500 hover:bg-indigo-400 text-white text-xs font-bold px-3.5 py-2 rounded-xl"
        >
          <Plus className="w-3.5 h-3.5" /> مهمة جديدة
        </button>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-500">
          <ListChecks className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-bold text-slate-300">ما فيه مهام بهذا الفلتر</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const canEdit = isAdmin || t.createdById === currentUserId || t.assigneeId === currentUserId;
            const canDelete = isAdmin || t.createdById === currentUserId;
            const overdue = t.dueAt && new Date(t.dueAt) < new Date() && t.status !== 'done';
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-4 ${
                  t.status === 'done' ? 'border-emerald-500/20 bg-emerald-500/[0.02] opacity-70' :
                  t.status === 'cancelled' ? 'border-white/5 bg-white/[0.01] opacity-50' :
                  overdue ? 'border-rose-500/30 bg-rose-500/[0.04]' :
                  'border-white/10 bg-white/[0.03]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => canEdit && onUpdate(t.id, { status: t.status === 'done' ? 'open' : 'done' })}
                    disabled={!canEdit}
                    className={`shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      t.status === 'done' ? 'bg-emerald-500 border-emerald-500' : 'border-white/20 hover:border-white/40'
                    } disabled:opacity-50`}
                  >
                    {t.status === 'done' && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className={`text-white font-bold text-sm leading-tight ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>
                        {t.title}
                      </h3>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className={`text-[10px] font-bold ${PRIORITY_COLOR[t.priority]}`}>
                          {PRIORITY_LABEL[t.priority]}
                        </span>
                        {canDelete && (
                          <button
                            onClick={() => onDelete(t.id)}
                            className="text-slate-500 hover:text-rose-300"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                    {t.description && (
                      <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">{t.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-500">
                      {t.assigneeName ? (
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {t.assigneeName}
                        </span>
                      ) : (
                        <span className="text-slate-600">غير معيّنة</span>
                      )}
                      {t.dueAt && (
                        <span className={`flex items-center gap-1 ${overdue ? 'text-rose-400 font-bold' : ''}`}>
                          {overdue ? <AlertCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                          {new Date(t.dueAt).toLocaleDateString('ar-SA')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* New task modal */}
      {showNew && (
        <NewTaskModal
          members={members}
          onClose={() => setShowNew(false)}
          onSubmit={(data) => createTask.mutate(data)}
          isSubmitting={createTask.isPending}
        />
      )}
    </div>
  );
}

function NewTaskModal({
  members,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  members: Member[];
  onClose: () => void;
  onSubmit: (data: { title: string; description?: string; assigneeId?: number; priority?: Task['priority']; dueAt?: string }) => void;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | ''>('');
  const [priority, setPriority] = useState<Task['priority']>('normal');
  const [dueAt, setDueAt] = useState('');

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0d1929] border border-white/10 rounded-2xl w-full max-w-md p-5"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-black text-lg">مهمة جديدة</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-white/10">
            <X className="w-4 h-4 mx-auto text-slate-400" />
          </button>
        </div>

        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان المهمة"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm mb-3 outline-none focus:border-indigo-500/60"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="وصف اختياري"
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm h-20 mb-3 outline-none focus:border-indigo-500/60 resize-none"
        />

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div>
            <label className="text-xs text-slate-400 block mb-1">المكلَّف</label>
            <select
              value={assigneeId}
              onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : '')}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-sm"
            >
              <option value="">— غير معيّنة —</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">الأولوية</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Task['priority'])}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-sm"
            >
              <option value="low">منخفض</option>
              <option value="normal">عادي</option>
              <option value="high">مرتفع</option>
              <option value="urgent">عاجل</option>
            </select>
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs text-slate-400 block mb-1">تاريخ الاستحقاق (اختياري)</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-2 py-2 text-white text-sm"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5"
          >
            إلغاء
          </button>
          <button
            onClick={() => title.trim() && onSubmit({
              title: title.trim(),
              description: description.trim() || undefined,
              assigneeId: assigneeId === '' ? undefined : Number(assigneeId),
              priority,
              dueAt: dueAt ? new Date(dueAt).toISOString() : undefined,
            })}
            disabled={!title.trim() || isSubmitting}
            className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white text-sm font-bold disabled:opacity-50"
          >
            {isSubmitting ? '...' : 'إنشاء'}
          </button>
        </div>
      </div>
    </div>
  );
}
