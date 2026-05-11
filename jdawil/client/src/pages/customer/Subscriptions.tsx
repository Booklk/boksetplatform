import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, PauseCircle, XCircle, AlertTriangle,
  Users, UserPlus, Phone, ChevronRight, X, Loader2,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

interface Subscription {
  id: string;
  vendorNameAr: string;
  vendorLogoUrl?: string;
  planNameAr: string;
  washesRemaining: number;
  washesIncluded: number;
  endsAt: string;
  status: 'active' | 'paused' | 'cancelled' | 'expired';
}

interface FamilyMember {
  id: number;
  name: string;
  phone: string;
  addedAt: string;
  washesUsed: number;
}

interface FamilyDetails {
  subscription: Subscription & { planWashesIncluded: number };
  members: FamilyMember[];
  maxMembers: number | null;
  isFamilyPlan: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  active: 'نشط',
  paused: 'موقوف مؤقتاً',
  cancelled: 'ملغي',
  expired: 'منتهي',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-500/20 text-green-300 border-green-500/30',
  paused: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  expired: 'bg-slate-600/50 text-slate-400 border-slate-500/30',
};

function isFamilyPlanName(name: string) {
  return name?.includes('العائلي') || name?.includes('عائلة');
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

// ─── ConfirmModal ─────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmClass,
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  confirmClass: string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-slate-900 border border-slate-700/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        dir="rtl"
      >
        <div className="flex items-center gap-3 mb-3">
          <AlertTriangle size={20} className="text-yellow-400 shrink-0" />
          <h3 className="font-black text-white">{title}</h3>
        </div>
        <p className="text-slate-400 text-sm mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 bg-slate-800 hover:bg-slate-700 text-white px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── AddMemberModal ───────────────────────────────────────────────────────────

function AddMemberModal({
  subscriptionId,
  onClose,
  token,
}: {
  subscriptionId: string;
  onClose: () => void;
  token: string;
}) {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState('');

  const addMutation = useMutation({
    mutationFn: () =>
      axios
        .post(
          '/api/subscriptions/add-member',
          { subscriptionId: Number(subscriptionId), memberPhone: phone },
          { headers: { Authorization: `Bearer ${token}` } },
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      toast.success(data.message ?? 'تمت إضافة العضو بنجاح');
      queryClient.invalidateQueries({ queryKey: ['family-details', subscriptionId] });
      onClose();
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.error ?? 'فشل إضافة العضو';
      toast.error(msg);
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.92, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#0a0a1a] border border-slate-700/60 rounded-2xl p-6 max-w-sm w-full shadow-2xl"
        dir="rtl"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <UserPlus size={18} className="text-blue-400" />
            <h3 className="font-black text-white text-lg">أضف فرداً من العائلة</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-slate-400 text-sm mb-4">
          أدخل رقم هاتف الشخص المسجّل في المنصة لإضافته إلى اشتراكك العائلي.
        </p>

        <div className="relative mb-5">
          <Phone size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="tel"
            dir="ltr"
            placeholder="05XXXXXXXX"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl px-4 py-3 pr-9 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/30 transition-all"
          />
        </div>

        <button
          disabled={!phone.trim() || addMutation.isPending}
          onClick={() => addMutation.mutate()}
          className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-3 rounded-xl font-bold transition-colors"
        >
          {addMutation.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <UserPlus size={16} />
          )}
          إضافة العضو
        </button>
      </motion.div>
    </motion.div>
  );
}

// ─── FamilySection ────────────────────────────────────────────────────────────

function FamilySection({
  subscriptionId,
  token,
}: {
  subscriptionId: string;
  token: string;
}) {
  const [showAddModal, setShowAddModal] = useState(false);

  const { data, isLoading } = useQuery<FamilyDetails>({
    queryKey: ['family-details', subscriptionId],
    queryFn: () =>
      axios
        .get(`/api/subscriptions/family/${subscriptionId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="mt-4 pt-4 border-t border-slate-700/50">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <Loader2 size={14} className="animate-spin" />
          <span>جاري تحميل بيانات العائلة...</span>
        </div>
      </div>
    );
  }

  if (!data?.isFamilyPlan) return null;

  const { members, maxMembers } = data;

  return (
    <div className="mt-4 pt-4 border-t border-slate-700/50">
      {/* Section header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users size={15} className="text-purple-400" />
          <span className="text-sm font-bold text-white">أعضاء العائلة</span>
          <span className="text-xs text-slate-500">
            ({members.length}/{maxMembers})
          </span>
        </div>
        {members.length < (maxMembers ?? 0) && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold px-3 py-1.5 rounded-xl transition-colors"
          >
            <UserPlus size={12} />
            أضف فرداً
          </button>
        )}
      </div>

      {/* Members list */}
      {members.length === 0 ? (
        <p className="text-slate-500 text-xs text-center py-3">
          لم يتم إضافة أي أعضاء بعد — اضغط "أضف فرداً" لمشاركة الاشتراك
        </p>
      ) : (
        <div className="space-y-2">
          {members.map((member) => (
            <div
              key={member.id}
              className="flex items-center justify-between bg-slate-800/50 rounded-xl px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-purple-600/30 border border-purple-500/30 flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-purple-300">
                    {member.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <p className="text-white text-sm font-bold leading-tight">{member.name}</p>
                  <p className="text-slate-500 text-xs" dir="ltr">{member.phone}</p>
                </div>
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-400 font-bold">
                  {member.washesUsed} غسلة
                </p>
                <p className="text-[10px] text-slate-600">هذا الشهر</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Capacity indicator */}
      {maxMembers && (
        <div className="mt-3 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-purple-500 transition-all duration-500"
            style={{ width: `${(members.length / maxMembers) * 100}%` }}
          />
        </div>
      )}

      <AnimatePresence>
        {showAddModal && (
          <AddMemberModal
            subscriptionId={subscriptionId}
            token={token}
            onClose={() => setShowAddModal(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerSubscriptions() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{
    type: 'pause' | 'cancel';
    subscriptionId: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'individual' | 'family'>('individual');

  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ['my-subscriptions'],
    queryFn: () =>
      axios
        .get('/api/subscriptions/my', {
          headers: { Authorization: `Bearer ${token}` },
        })
        .then((r) => r.data),
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) =>
      axios.post(
        `/api/subscriptions/${id}/pause`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    onSuccess: () => {
      toast.success('تم إيقاف الاشتراك مؤقتاً');
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      setConfirmAction(null);
    },
    onError: () => toast.error('فشل إيقاف الاشتراك'),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) =>
      axios.post(
        `/api/subscriptions/${id}/cancel`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      ),
    onSuccess: () => {
      toast.success('تم إلغاء الاشتراك');
      queryClient.invalidateQueries({ queryKey: ['my-subscriptions'] });
      setConfirmAction(null);
    },
    onError: () => toast.error('فشل إلغاء الاشتراك'),
  });

  if (isLoading) {
    return (
      <div className="p-4 space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-slate-900/80 border border-slate-700/50 rounded-2xl p-5 animate-pulse"
          >
            <div className="flex gap-3 mb-4">
              <div className="w-12 h-12 bg-slate-700 rounded-xl" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-700 rounded w-1/2" />
                <div className="h-3 bg-slate-700 rounded w-1/3" />
              </div>
            </div>
            <div className="h-3 bg-slate-700 rounded mb-2" />
            <div className="h-2 bg-slate-700 rounded" />
          </div>
        ))}
      </div>
    );
  }

  if (subscriptions.length === 0) {
    return (
      <div className="p-4 max-w-lg mx-auto flex flex-col items-center justify-center min-h-[60vh]" dir="rtl">
        <div className="text-6xl mb-4">🚿</div>
        <h2 className="text-xl font-black text-white mb-2">لا يوجد اشتراكات نشطة</h2>
        <p className="text-slate-400 text-sm mb-8 text-center">
          اشترك في إحدى المغاسل واستمتع بغسلات متعددة بسعر مخفض
        </p>
        <button
          onClick={() => navigate('/marketplace')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-colors"
        >
          تصفح المغاسل
        </button>
      </div>
    );
  }

  const individualSubs = subscriptions.filter((s) => !isFamilyPlanName(s.planNameAr));
  const familySubs = subscriptions.filter((s) => isFamilyPlanName(s.planNameAr));

  const displayedSubs = activeTab === 'family' ? familySubs : individualSubs;

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4" dir="rtl">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-black text-white">اشتراكاتي</h1>
        <span className="text-slate-400 text-sm">{subscriptions.length} اشتراك</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-2 bg-slate-900/60 border border-slate-700/50 rounded-2xl p-1">
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
            activeTab === 'individual'
              ? 'bg-blue-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          باقات فردية
          {individualSubs.length > 0 && (
            <span className="mr-1.5 text-xs opacity-70">({individualSubs.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('family')}
          className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'family'
              ? 'bg-purple-600 text-white shadow'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users size={13} />
          باقات عائلية
          {familySubs.length > 0 && (
            <span className="text-xs opacity-70">({familySubs.length})</span>
          )}
        </button>
      </div>

      {/* Family plans upsell when tab selected but no subs */}
      {activeTab === 'family' && familySubs.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-purple-900/30 to-slate-900/60 border border-purple-500/30 rounded-2xl p-6 text-center"
        >
          <Users size={36} className="text-purple-400 mx-auto mb-3" />
          <h3 className="font-black text-white mb-2">الباقات العائلية</h3>
          <p className="text-slate-400 text-sm mb-4">
            شارك الغسلات مع أفراد عائلتك — حتى 5 سيارات في باقة واحدة بسعر موحد
          </p>
          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              { name: 'الباقة العائلية', cars: 3, washes: 8, price: '249 ريال' },
              { name: 'الباقة العائلية الكبيرة', cars: 5, washes: 12, price: '349 ريال' },
            ].map((plan) => (
              <div
                key={plan.name}
                className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-3 text-right"
              >
                <p className="text-white text-xs font-black mb-1">{plan.name}</p>
                <p className="text-purple-300 text-xs">{plan.cars} سيارات · {plan.washes} غسلة/شهر</p>
                <p className="text-emerald-400 text-sm font-black mt-1">{plan.price}</p>
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/marketplace')}
            className="w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-xl font-bold transition-colors"
          >
            اشترك الآن
            <ChevronRight size={16} />
          </button>
        </motion.div>
      )}

      <AnimatePresence>
        {displayedSubs.map((sub, i) => {
          const progress =
            sub.washesIncluded > 0
              ? (sub.washesRemaining / sub.washesIncluded) * 100
              : 0;
          const days = daysUntil(sub.endsAt);
          const isActive = sub.status === 'active';
          const isFamily = isFamilyPlanName(sub.planNameAr);

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ delay: i * 0.06 }}
              className={`bg-slate-900/80 backdrop-blur border rounded-2xl p-5 ${
                isFamily ? 'border-purple-500/30' : 'border-slate-700/50'
              }`}
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                {sub.vendorLogoUrl ? (
                  <img
                    src={sub.vendorLogoUrl}
                    alt={sub.vendorNameAr}
                    className="w-12 h-12 rounded-xl object-cover border border-slate-700/50 shrink-0"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-xl bg-slate-800 border border-slate-700/50 flex items-center justify-center shrink-0">
                    {isFamily ? (
                      <Users size={20} className="text-purple-400" />
                    ) : (
                      <Building2 size={22} className="text-slate-500" />
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-white truncate">{sub.vendorNameAr}</h3>
                  <p className={`text-sm ${isFamily ? 'text-purple-300' : 'text-slate-400'}`}>
                    {sub.planNameAr}
                  </p>
                </div>
                <span
                  className={`shrink-0 text-xs font-bold px-2.5 py-1 rounded-lg border ${STATUS_COLORS[sub.status]}`}
                >
                  {STATUS_LABELS[sub.status]}
                </span>
              </div>

              {/* Wash counter */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-slate-400">الغسلات المتبقية</span>
                  <span className="font-black text-white">
                    {sub.washesRemaining}{' '}
                    <span className="text-slate-400 font-normal">
                      من {sub.washesIncluded}
                    </span>
                  </span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className={`h-full rounded-full ${
                      isFamily
                        ? 'bg-purple-500'
                        : progress > 50
                        ? 'bg-blue-500'
                        : progress > 20
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                    }`}
                  />
                </div>
              </div>

              {/* End date */}
              <div className="flex items-center justify-between text-sm mb-4">
                <span className="text-slate-400">ينتهي في</span>
                <span
                  className={`font-bold ${
                    days <= 7 && sub.status !== 'expired'
                      ? 'text-red-400'
                      : 'text-slate-300'
                  }`}
                >
                  {sub.status === 'expired'
                    ? 'منتهي'
                    : `${days} يوم متبقي`}
                </span>
              </div>

              {/* Family members section */}
              {isFamily && isActive && (
                <FamilySection subscriptionId={sub.id} token={token!} />
              )}

              {/* Actions */}
              {isActive && (
                <div className="flex gap-2 pt-3 border-t border-slate-700/50 mt-4">
                  <button
                    onClick={() =>
                      setConfirmAction({ type: 'pause', subscriptionId: sub.id })
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-yellow-300 px-3 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    <PauseCircle size={14} />
                    إيقاف مؤقت
                  </button>
                  <button
                    onClick={() =>
                      setConfirmAction({ type: 'cancel', subscriptionId: sub.id })
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-red-300 px-3 py-2 rounded-xl text-sm font-bold transition-colors"
                  >
                    <XCircle size={14} />
                    إلغاء
                  </button>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmAction && (
          <ConfirmModal
            title={
              confirmAction.type === 'pause'
                ? 'إيقاف الاشتراك مؤقتاً'
                : 'إلغاء الاشتراك'
            }
            message={
              confirmAction.type === 'pause'
                ? 'سيتم إيقاف اشتراكك مؤقتاً ويمكنك إعادة تفعيله لاحقاً.'
                : 'هل أنت متأكد من إلغاء الاشتراك؟ لا يمكن التراجع عن هذا الإجراء.'
            }
            confirmLabel={confirmAction.type === 'pause' ? 'إيقاف' : 'إلغاء الاشتراك'}
            confirmClass={
              confirmAction.type === 'pause'
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }
            onConfirm={() => {
              if (confirmAction.type === 'pause') {
                pauseMutation.mutate(confirmAction.subscriptionId);
              } else {
                cancelMutation.mutate(confirmAction.subscriptionId);
              }
            }}
            onClose={() => setConfirmAction(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
