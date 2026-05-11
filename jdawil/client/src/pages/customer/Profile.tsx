import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { User, Phone, Mail, Car, MapPin, MessageCircle, AlertTriangle, Trash2, ShieldCheck } from 'lucide-react';
import api from '../../lib/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../hooks/useAuth';

interface ProfileResponse {
  user: { id: number; name: string; phone: string; email: string | null; vendorId: number | null; createdAt: string };
  profiles: Array<{
    id: number;
    vendorId: number;
    vehicleType: string | null;
    vehiclePlate: string | null;
    vehicleColor: string | null;
    vehicleModel: string | null;
    address: string | null;
    notes: string | null;
    preferredLanguage: 'ar' | 'en';
    preferredContactMethod: 'whatsapp' | 'sms' | 'email' | 'push';
  }>;
}

export default function CustomerProfile() {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const { data, isLoading } = useQuery<ProfileResponse>({
    queryKey: ['customer-profile'],
    queryFn: async () => (await api.get('/customer-profile/me')).data,
  });

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (data?.user) {
      setName(data.user.name);
      setEmail(data.user.email ?? '');
    }
  }, [data?.user]);

  const updateUser = useMutation({
    mutationFn: async () =>
      (await api.patch('/customer-profile/me', { name, email: email || null })).data,
    onSuccess: () => {
      toast.success('تم حفظ التعديلات');
      qc.invalidateQueries({ queryKey: ['customer-profile'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الحفظ'),
  });

  const deleteAccount = useMutation({
    mutationFn: async () => (await api.delete('/customer-profile/me')).data,
    onSuccess: (resp) => {
      toast.success(resp?.message ?? 'تم إيقاف حسابك');
      setTimeout(() => logout(), 1500);
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر إيقاف الحساب'),
  });

  const [confirmDelete, setConfirmDelete] = useState(false);

  if (isLoading || !data) {
    return (
      <div className="p-6 text-center text-slate-400" dir="rtl">
        جاري تحميل بياناتك…
      </div>
    );
  }

  return (
    <div dir="rtl" className="p-4 sm:p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-white">حسابي</h1>
        <p className="text-slate-400 text-sm mt-1">عدّل بياناتك وقت ما تبي</p>
      </div>

      {/* User card */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5"
      >
        <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
          <User className="w-4 h-4 text-blue-400" />
          المعلومات الأساسية
        </h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">الاسم</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500/60"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Phone className="w-3 h-3" /> رقم الجوال
            </label>
            <input
              type="tel"
              value={data.user.phone}
              disabled
              dir="ltr"
              className="w-full bg-white/[0.02] border border-white/5 rounded-xl px-3 py-2.5 text-slate-500 text-sm cursor-not-allowed"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              لتغيير رقم الجوال تواصل مع الدعم.
            </p>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> البريد الإلكتروني (اختياري)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              dir="ltr"
              placeholder="you@example.com"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500/60"
            />
          </div>

          <button
            onClick={() => updateUser.mutate()}
            disabled={updateUser.isPending}
            className="w-full sm:w-auto bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm px-5 py-2.5 rounded-xl disabled:opacity-50"
          >
            {updateUser.isPending ? 'جاري الحفظ…' : 'حفظ التعديلات'}
          </button>
        </div>
      </motion.section>

      {/* Per-vendor profiles */}
      {data.profiles.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 mb-5"
        >
          <h2 className="text-white font-bold text-base mb-4 flex items-center gap-2">
            <Car className="w-4 h-4 text-purple-400" />
            بياناتك في كل متجر
          </h2>
          <p className="text-slate-400 text-xs mb-4 leading-relaxed">
            نحفظ بيانات منفصلة لكل متجر — لو تتنقل بين متاجر مختلفة، كل واحد يشوف ما يخصّه فقط.
          </p>

          <div className="space-y-3">
            {data.profiles.map((p) => (
              <ProfileCard key={p.id} profile={p} onUpdate={() => qc.invalidateQueries({ queryKey: ['customer-profile'] })} />
            ))}
          </div>
        </motion.section>
      )}

      {/* Privacy & data rights */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-5 mb-5"
      >
        <h2 className="text-emerald-200 font-bold text-base mb-2 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4" /> حقوقك في بياناتك
        </h2>
        <p className="text-slate-400 text-xs mb-3 leading-relaxed">
          متوافقون مع نظام حماية البيانات الشخصية السعودي (PDPL). تقدر تحمّل بياناتك أو تطّلع على سجل موافقاتك في أي وقت.
        </p>
        <a
          href="/app/privacy"
          className="inline-block bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 text-xs font-bold px-3.5 py-2 rounded-lg"
        >
          مركز الخصوصية والبيانات
        </a>
      </motion.section>

      {/* PDPL — delete account */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-rose-500/20 bg-rose-500/[0.03] p-5"
      >
        <h2 className="text-rose-200 font-bold text-base mb-2 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> منطقة حسّاسة
        </h2>
        <p className="text-rose-100/70 text-xs mb-4 leading-relaxed">
          إيقاف حسابك يحذف بياناتك خلال 30 يوم. خلال هذي الفترة تقدر تتراجع بالاتصال بالدعم.
        </p>
        {!confirmDelete ? (
          <button
            onClick={() => setConfirmDelete(true)}
            className="text-rose-300 text-sm hover:text-rose-200 font-bold flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            أريد إيقاف حسابي
          </button>
        ) : (
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5"
            >
              تراجع
            </button>
            <button
              onClick={() => deleteAccount.mutate()}
              disabled={deleteAccount.isPending}
              className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-bold disabled:opacity-50"
            >
              {deleteAccount.isPending ? '...' : 'تأكيد إيقاف الحساب'}
            </button>
          </div>
        )}
      </motion.section>
    </div>
  );
}

// ─── Per-vendor profile card with inline edit ───────────────────────────────
function ProfileCard({
  profile,
  onUpdate,
}: {
  profile: ProfileResponse['profiles'][number];
  onUpdate: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [vehicleType, setVehicleType] = useState(profile.vehicleType ?? '');
  const [vehiclePlate, setVehiclePlate] = useState(profile.vehiclePlate ?? '');
  const [vehicleModel, setVehicleModel] = useState(profile.vehicleModel ?? '');
  const [vehicleColor, setVehicleColor] = useState(profile.vehicleColor ?? '');
  const [address, setAddress] = useState(profile.address ?? '');
  const [contact, setContact] = useState(profile.preferredContactMethod);

  const save = useMutation({
    mutationFn: async () =>
      (await api.patch(`/customer-profile/profile/${profile.id}`, {
        vehicleType: vehicleType || null,
        vehiclePlate: vehiclePlate || null,
        vehicleModel: vehicleModel || null,
        vehicleColor: vehicleColor || null,
        address: address || null,
        preferredContactMethod: contact,
      })).data,
    onSuccess: () => {
      toast.success('تم الحفظ');
      setEditing(false);
      onUpdate();
    },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'تعذّر الحفظ'),
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-slate-400">متجر #{profile.vendorId}</div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="text-xs text-blue-400 hover:text-blue-300 font-bold"
        >
          {editing ? 'إلغاء' : 'تعديل'}
        </button>
      </div>

      {!editing ? (
        <div className="space-y-1.5 text-sm">
          {(profile.vehicleType || profile.vehiclePlate) && (
            <p className="text-white">
              <Car className="w-3.5 h-3.5 inline ml-1 text-slate-500" />
              {[profile.vehicleType, profile.vehicleModel, profile.vehicleColor].filter(Boolean).join(' • ')}
              {profile.vehiclePlate && <span className="text-slate-400"> — {profile.vehiclePlate}</span>}
            </p>
          )}
          {profile.address && (
            <p className="text-slate-300">
              <MapPin className="w-3.5 h-3.5 inline ml-1 text-slate-500" /> {profile.address}
            </p>
          )}
          <p className="text-slate-400 text-xs">
            <MessageCircle className="w-3 h-3 inline ml-1" /> القناة المفضّلة:{' '}
            {profile.preferredContactMethod === 'whatsapp' ? 'واتساب'
              : profile.preferredContactMethod === 'sms' ? 'رسائل نصية'
              : profile.preferredContactMethod === 'email' ? 'بريد'
              : 'إشعار التطبيق'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              placeholder="نوع السيارة"
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white text-xs outline-none"
            />
            <input
              type="text"
              value={vehiclePlate}
              onChange={(e) => setVehiclePlate(e.target.value)}
              placeholder="رقم اللوحة"
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white text-xs outline-none"
            />
            <input
              type="text"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
              placeholder="الموديل"
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white text-xs outline-none"
            />
            <input
              type="text"
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
              placeholder="اللون"
              className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white text-xs outline-none"
            />
          </div>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="العنوان (للخدمات المنزلية)"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-2 text-white text-xs outline-none h-16 resize-none"
          />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">القناة المفضّلة:</span>
            <select
              value={contact}
              onChange={(e) => setContact(e.target.value as any)}
              className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white text-xs"
            >
              <option value="whatsapp">واتساب</option>
              <option value="sms">رسائل نصية</option>
              <option value="email">بريد إلكتروني</option>
              <option value="push">إشعار التطبيق</option>
            </select>
          </div>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 rounded-lg disabled:opacity-50"
          >
            {save.isPending ? 'جاري الحفظ…' : 'حفظ'}
          </button>
        </div>
      )}
    </div>
  );
}
