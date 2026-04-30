import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Users,
  Clock,
  CheckCircle,
  XCircle,
  Play,
  Plus,
  ChevronRight,
  Hash,
  Car,
  Phone,
  User,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useIndustryFlags } from '../../hooks/useIndustryFlags';

// ─── Types ────────────────────────────────────────────────────────────────────

interface QueueSession {
  id: number;
  isOpen: boolean;
  currentNumber: number;
  totalServed: number;
  date: string;
}

interface QueueTicket {
  id: number;
  ticketNumber: number;
  customerName?: string;
  customerPhone?: string;
  vehiclePlate?: string;
  vehicleType?: string;
  status: 'waiting' | 'called' | 'in_service' | 'completed' | 'cancelled' | 'no_show';
  calledAt?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
}

interface SessionData {
  session: QueueSession;
  tickets: QueueTicket[];
  waitingCount: number;
  estimatedWaitMinutes: number;
}

interface Service {
  id: number;
  name: string;
}

// ─── Status config ────────────────────────────────────────────────────────────

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
  waiting:    { label: 'انتظار',  bg: 'bg-amber-500/20',   text: 'text-amber-300',   border: 'border-amber-500/30' },
  called:     { label: 'نودي به', bg: 'bg-blue-500/20',    text: 'text-blue-300',    border: 'border-blue-500/30'  },
  in_service: { label: 'يُخدَم',  bg: 'bg-violet-500/20',  text: 'text-violet-300',  border: 'border-violet-500/30'},
  completed:  { label: 'اكتمل',  bg: 'bg-emerald-500/20', text: 'text-emerald-300', border: 'border-emerald-500/30'},
  no_show:    { label: 'غياب',   bg: 'bg-red-500/20',     text: 'text-red-300',     border: 'border-red-500/30'   },
  cancelled:  { label: 'ملغي',   bg: 'bg-slate-500/20',   text: 'text-slate-300',   border: 'border-slate-500/30' },
};

// ─── Add Customer Modal ───────────────────────────────────────────────────────

function AddCustomerModal({
  open,
  onClose,
  services,
  onSuccess,
  showVehicleFields,
}: {
  open: boolean;
  onClose: () => void;
  services: Service[];
  onSuccess: (ticket: QueueTicket & { position: number; estimatedWaitMinutes: number }) => void;
  showVehicleFields: boolean;
}) {
  const [form, setForm] = useState({
    customerName: '',
    customerPhone: '',
    vehiclePlate: '',
    vehicleType: '',
    serviceId: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/queue/ticket', {
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
        vehiclePlate: form.vehiclePlate || undefined,
        vehicleType: form.vehicleType || undefined,
        serviceId: form.serviceId ? Number(form.serviceId) : undefined,
      });
      onSuccess(data);
      setForm({ customerName: '', customerPhone: '', vehiclePlate: '', vehicleType: '', serviceId: '' });
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 24 }}
          className="relative z-10 bg-[#111827] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl"
        >
          <h2 className="text-xl font-bold text-white mb-5">إضافة عميل جديد</h2>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {[
              { key: 'customerName', label: 'اسم العميل', placeholder: 'اختياري', icon: User, show: true },
              { key: 'customerPhone', label: 'رقم الهاتف', placeholder: 'اختياري', icon: Phone, show: true },
              { key: 'vehiclePlate', label: 'رقم اللوحة', placeholder: 'اختياري', icon: Car, show: showVehicleFields },
            ].filter((f) => f.show).map(({ key, label, placeholder, icon: Icon }) => (
              <div key={key}>
                <label className="block text-white/60 text-xs mb-1">{label}</label>
                <div className="relative">
                  <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                  <input
                    type="text"
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 pr-10 text-white placeholder-white/30 text-sm focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>
            ))}

            {showVehicleFields && (
              <div>
                <label className="block text-white/60 text-xs mb-1">نوع السيارة</label>
                <select
                  value={form.vehicleType}
                  onChange={(e) => setForm((f) => ({ ...f, vehicleType: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">اختر النوع</option>
                  {['سيدان', 'SUV', 'بيكاب', 'فان', 'هاتشباك', 'كوبيه'].map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}

            {services.length > 0 && (
              <div>
                <label className="block text-white/60 text-xs mb-1">الخدمة</label>
                <select
                  value={form.serviceId}
                  onChange={(e) => setForm((f) => ({ ...f, serviceId: e.target.value }))}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:border-blue-500/50"
                >
                  <option value="">اختر الخدمة</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-white/60 text-sm hover:bg-white/5 transition-colors"
            >
              إلغاء
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {submitting ? '...' : 'إضافة'}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

// ─── Ticket Issued Flash ──────────────────────────────────────────────────────

function TicketIssuedToast({
  ticket,
  onDismiss,
}: {
  ticket: { ticketNumber: number; position: number; estimatedWaitMinutes: number } | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!ticket) return;
    const t = setTimeout(onDismiss, 5000);
    return () => clearTimeout(t);
  }, [ticket]);

  return (
    <AnimatePresence>
      {ticket && (
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 60 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-900/90 border border-emerald-500/40 backdrop-blur-xl rounded-2xl px-8 py-5 text-center shadow-2xl"
        >
          <p className="text-emerald-300 text-sm mb-1">تم إصدار التذكرة</p>
          <p className="text-white text-5xl font-black">#{ticket.ticketNumber}</p>
          <p className="text-white/60 text-sm mt-1">
            أمامك {ticket.position - 1} عميل • انتظار ~{ticket.estimatedWaitMinutes} د
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VendorQueue() {
  const { user } = useAuth();
  const flags = useIndustryFlags();
  const qc = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTicket, setNewTicket] = useState<any>(null);
  const [calledTicket, setCalledTicket] = useState<QueueTicket | null>(null);

  const { data, isLoading, refetch } = useQuery<SessionData>({
    queryKey: ['queue-session-today'],
    queryFn: async () => {
      const { data } = await api.get('/queue/session/today');
      return data;
    },
    refetchInterval: 5000,
  });

  const { data: servicesData } = useQuery<Service[]>({
    queryKey: ['services-for-queue'],
    queryFn: async () => {
      const { data } = await api.get('/services');
      // /services returns array of services (each may have packages)
      return (data as Service[]);
    },
  });

  const services = servicesData ?? [];
  const session = data?.session;
  const tickets = data?.tickets ?? [];
  const waitingCount = data?.waitingCount ?? 0;
  const estimatedWait = data?.estimatedWaitMinutes ?? 0;

  // Derived active ticket (called or in_service)
  const activeTicket = tickets.find((t) => t.status === 'called' || t.status === 'in_service');
  const waitingTickets = tickets.filter((t) => t.status === 'waiting');

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const toggleSession = useMutation({
    mutationFn: async () => {
      if (session?.isOpen) {
        await api.post('/queue/session/close');
      } else {
        await api.post('/queue/session/open');
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue-session-today'] }),
  });

  const callNext = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/queue/next');
      return data as QueueTicket;
    },
    onSuccess: (ticket) => {
      setCalledTicket(ticket);
      setTimeout(() => setCalledTicket(null), 4000);
      qc.invalidateQueries({ queryKey: ['queue-session-today'] });
    },
  });

  const ticketAction = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: 'start' | 'complete' | 'skip' }) => {
      await api.post(`/queue/ticket/${id}/${action}`);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['queue-session-today'] }),
  });

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div dir="rtl" className="min-h-screen bg-[#0a0a1a] text-white" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-[600px] h-[400px] bg-blue-600/6 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[300px] bg-indigo-600/6 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 py-6">

        {/* ── Top Bar ──────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-black text-white">إدارة الطابور</h1>
            <p className="text-white/40 text-sm mt-0.5">
              خُدِم اليوم: {session?.totalServed ?? 0} • في الانتظار: {waitingCount}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Session Toggle */}
            <button
              onClick={() => toggleSession.mutate()}
              disabled={toggleSession.isPending}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
                session?.isOpen
                  ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                  : 'bg-slate-500/20 border border-slate-500/30 text-slate-300 hover:bg-slate-500/30'
              }`}
            >
              {session?.isOpen ? (
                <><ToggleRight className="w-5 h-5" /> الطابور مفتوح</>
              ) : (
                <><ToggleLeft className="w-5 h-5" /> افتح الطابور</>
              )}
            </button>

            {/* Add Customer */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              إضافة عميل
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── Left: Live Board ──────────────────────────────────────────── */}
            <div className="space-y-4">

              {/* Now Serving */}
              <motion.div
                layout
                className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-6 text-center"
              >
                <p className="text-white/50 text-sm mb-2">يُخدَم الآن</p>
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTicket?.ticketNumber ?? 'none'}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.7, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`text-8xl font-black leading-none mb-2 ${
                      activeTicket ? 'text-blue-400' : 'text-white/20'
                    }`}
                  >
                    {activeTicket ? `#${activeTicket.ticketNumber}` : '—'}
                  </motion.div>
                </AnimatePresence>
                {activeTicket && (
                  <div className="text-white/60 text-sm mb-1">
                    {activeTicket.customerName ?? 'عميل'}
                    {activeTicket.vehicleType && ` • ${activeTicket.vehicleType}`}
                    {activeTicket.vehiclePlate && ` • ${activeTicket.vehiclePlate}`}
                  </div>
                )}
                <p className="text-white/40 text-xs">
                  في الانتظار: {waitingCount} عميل
                  {estimatedWait > 0 && ` • متوقع ~${estimatedWait} د`}
                </p>
              </motion.div>

              {/* Call Next Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => callNext.mutate()}
                disabled={callNext.isPending || waitingTickets.length === 0 || !session?.isOpen}
                className="w-full py-5 rounded-2xl bg-gradient-to-l from-blue-600 to-cyan-500 text-white font-black text-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <Bell className={`w-7 h-7 ${callNext.isPending ? 'animate-bounce' : ''}`} />
                استدعاء التالي
              </motion.button>

              {/* Called ticket flash */}
              <AnimatePresence>
                {calledTicket && (
                  <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -12 }}
                    className="rounded-xl bg-blue-500/20 border border-blue-500/30 p-4 text-center"
                  >
                    <p className="text-blue-300 font-bold text-lg">
                      تم استدعاء #{calledTicket.ticketNumber}
                    </p>
                    {calledTicket.customerName && (
                      <p className="text-blue-200/60 text-sm">{calledTicket.customerName}</p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Active ticket actions */}
              {activeTicket && (
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                  <p className="text-white/60 text-xs mb-3 font-medium">إجراءات التذكرة الحالية #{activeTicket.ticketNumber}</p>
                  <div className="flex gap-2">
                    {activeTicket.status === 'called' && (
                      <button
                        onClick={() => ticketAction.mutate({ id: activeTicket.id, action: 'start' })}
                        disabled={ticketAction.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold transition-colors"
                      >
                        <Play className="w-4 h-4" /> بدأ الخدمة
                      </button>
                    )}
                    {(activeTicket.status === 'called' || activeTicket.status === 'in_service') && (
                      <>
                        <button
                          onClick={() => ticketAction.mutate({ id: activeTicket.id, action: 'complete' })}
                          disabled={ticketAction.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" /> أكمل الخدمة
                        </button>
                        <button
                          onClick={() => ticketAction.mutate({ id: activeTicket.id, action: 'skip' })}
                          disabled={ticketAction.isPending}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-red-600/80 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                        >
                          <XCircle className="w-4 h-4" /> غياب
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'خُدِم اليوم', value: session?.totalServed ?? 0, color: 'text-emerald-400' },
                  { label: 'في الانتظار', value: waitingCount, color: 'text-amber-400' },
                  { label: 'إجمالي التذاكر', value: tickets.length, color: 'text-blue-400' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-xl border border-white/10 bg-white/5 p-3 text-center">
                    <p className={`text-2xl font-black ${color}`}>{value}</p>
                    <p className="text-white/40 text-xs mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Right: Waiting List ───────────────────────────────────────── */}
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl overflow-hidden">
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <h2 className="font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-400" />
                  قائمة الانتظار
                </h2>
                <span className="text-white/40 text-sm">{tickets.length} تذكرة</span>
              </div>

              <div className="max-h-[600px] overflow-y-auto divide-y divide-white/5">
                {tickets.length === 0 ? (
                  <div className="py-16 text-center text-white/30">
                    <Hash className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">لا توجد تذاكر اليوم</p>
                  </div>
                ) : (
                  tickets.map((ticket, i) => {
                    const sc = statusConfig[ticket.status] ?? statusConfig.waiting;
                    return (
                      <motion.div
                        key={ticket.id}
                        initial={{ opacity: 0, x: 12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.03 }}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
                      >
                        {/* Ticket number */}
                        <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                          <span className="text-white font-black text-sm">#{ticket.ticketNumber}</span>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {ticket.customerName ?? 'عميل'}
                          </p>
                          <p className="text-white/40 text-xs truncate">
                            {[ticket.vehicleType, ticket.vehiclePlate].filter(Boolean).join(' • ') || '—'}
                          </p>
                        </div>

                        {/* Wait time */}
                        <div className="text-left hidden sm:block">
                          <p className="text-white/40 text-xs flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {Math.round((Date.now() - new Date(ticket.createdAt).getTime()) / 60000)} د
                          </p>
                        </div>

                        {/* Status */}
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold border ${sc.bg} ${sc.text} ${sc.border}`}>
                          {sc.label}
                        </span>
                      </motion.div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <AddCustomerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        services={services}
        showVehicleFields={flags.vehicleFieldsEnabled}
        onSuccess={(t) => {
          setNewTicket(t);
          qc.invalidateQueries({ queryKey: ['queue-session-today'] });
        }}
      />

      <TicketIssuedToast ticket={newTicket} onDismiss={() => setNewTicket(null)} />
    </div>
  );
}
