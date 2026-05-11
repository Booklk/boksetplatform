import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { MapPin, Calendar, Clock, Car, Check, ChevronRight, ChevronLeft, Shield, MessageCircle, Sparkles, Info } from 'lucide-react';
import api from '../../lib/api';
import { Service } from '../../types';
import { formatCurrency, VEHICLE_TYPES } from '../../lib/utils';
import { NORTH_RIYADH_NEIGHBORHOODS } from '../../lib/constants';
import MapPicker from '../../components/MapPicker';
import { useVendorTheme } from '../../store/vendorTheme';

export default function BookingPage() {
  const { packageId } = useParams<{ packageId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const vendorIdParam = searchParams.get('vendorId');

  const { applyToBrowser, resetTheme, setTheme } = useVendorTheme();

  // Fetch vendor and apply theme when vendorId param is present
  const { data: vendorData } = useQuery({
    queryKey: ['vendor-by-id', vendorIdParam],
    queryFn: () => api.get(`/vendors/public-by-id/${vendorIdParam}`).then((r) => r.data),
    enabled: !!vendorIdParam && !isNaN(Number(vendorIdParam)),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (vendorData) {
      setTheme({
        vendorId: vendorData.id,
        slug: vendorData.slug,
        nameAr: vendorData.nameAr,
        primaryColor: vendorData.primaryColor ?? '#1e3a8a',
        logoUrl: vendorData.logoUrl,
        coverImageUrl: vendorData.coverImageUrl,
        isActive: vendorData.isActive ?? true,
      });
      applyToBrowser(vendorData.primaryColor ?? '#1e3a8a', vendorData.nameAr, vendorData.slug);
      document.title = vendorData.nameAr ?? 'احجز الآن';
    }
    return () => { resetTheme(); document.title = 'احجز الآن'; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorData?.id]);

  const [form, setForm] = useState({
    scheduledAt: '',
    address: '',
    lat: '',
    lng: '',
    vehicleType: '',
    vehiclePlate: '',
    vehicleColor: '',
    vehicleModel: '',
    notes: '',
    neighborhood: '',
  });

  const [mapOpen, setMapOpen] = useState(false);
  const [step, setStep] = useState<'details' | 'location' | 'confirm'>('details');

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  const selectedPackage = services.flatMap(s => s.packages).find(p => p.id === Number(packageId));
  const selectedService = services.find(s => s.packages.some(p => p.id === Number(packageId)));

  const { mutate: createBooking, isPending } = useMutation({
    mutationFn: (data: any) => api.post('/bookings', data).then(r => r.data),
    onSuccess: (booking) => {
      const vendorName = vendorData?.nameAr;
      // Server surfaces a deposit requirement inline on booking create
      // when the vendor has prefs.deposit.required = true. Route the
      // customer straight to the payment picker instead of leaving the
      // booking in a limbo state they can't pay out of.
      if (booking?.deposit?.required && booking?.id && booking?.vendorId) {
        toast.success('تم إنشاء الحجز — أكمل دفع العربون للتأكيد');
        const qs = new URLSearchParams({
          bookingId: String(booking.id),
          vendorId:  String(booking.vendorId),
          amount:    String(booking.deposit.amountSar ?? ''),
        });
        navigate(`/app/bookings/${booking.id}/deposit?${qs.toString()}`);
        return;
      }
      toast.success(vendorName ? `شكراً على ثقتك بـ ${vendorName}! تم استلام حجزك` : 'تم الحجز بنجاح! سيتواصل معك فريقنا قريباً');
      navigate('/app/bookings');
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.error ?? 'فشل في الحجز');
    },
  });

  function handleSubmit() {
    if (!form.scheduledAt) { toast.error('اختر التاريخ والوقت'); return; }
    if (!form.address) { toast.error('حدد موقعك'); return; }

    createBooking({
      packageId: Number(packageId),
      scheduledAt: form.scheduledAt,
      address: form.address,
      lat: form.lat || undefined,
      lng: form.lng || undefined,
      vehicleType: form.vehicleType || undefined,
      vehiclePlate: form.vehiclePlate || undefined,
      vehicleColor: form.vehicleColor || undefined,
      vehicleModel: form.vehicleModel || undefined,
      notes: form.notes || undefined,
    });
  }

  if (!selectedPackage) return (
    <div className="p-4 text-center text-slate-400 min-h-64 flex items-center justify-center">
      <div>
        <div className="text-4xl mb-3">😕</div>
        <p>الباقة غير موجودة</p>
      </div>
    </div>
  );

  const minDate = new Date();
  minDate.setHours(minDate.getHours() + 2);
  const minDateStr = minDate.toISOString().slice(0, 16);

  return (
    <div className="p-4 max-w-lg mx-auto" dir="rtl">
      {/* Selected Package Summary */}
      <div className="card bg-gradient-to-l from-brand-900/40 to-slate-800/60 border-brand-700/30 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">{selectedService?.name}</p>
            <h2 className="text-xl font-black text-white">{selectedPackage.name}</h2>
            <div className="flex items-center gap-2 text-slate-400 text-sm mt-1">
              <Clock size={13} />
              {selectedPackage.duration} دقيقة
            </div>
          </div>
          <div className="text-2xl font-black gradient-text">{formatCurrency(selectedPackage.price)}</div>
        </div>
      </div>

      {/* Steps Progress */}
      <div className="flex items-center gap-1 mb-6">
        {[
          { key: 'details', label: 'التفاصيل', icon: Car },
          { key: 'location', label: 'الموقع', icon: MapPin },
          { key: 'confirm', label: 'تأكيد', icon: Check },
        ].map((s, i) => {
          const steps = ['details', 'location', 'confirm'];
          const currentIdx = steps.indexOf(step);
          const isCompleted = currentIdx > i;
          const isCurrent = step === s.key;
          const StepIcon = s.icon;
          return (
            <div key={s.key} className="flex-1 flex flex-col items-center gap-1.5">
              <div className="flex items-center w-full">
                {i > 0 && (
                  <div className={`flex-1 h-0.5 rounded transition-colors duration-500 ${isCompleted ? 'bg-green-500' : 'bg-slate-700'}`} />
                )}
                <motion.div
                  animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5 }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 shrink-0 ${
                    isCompleted ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' :
                    isCurrent ? 'text-white shadow-lg ring-2 ring-white/20' :
                    'bg-slate-800 text-slate-500 border border-slate-700'
                  }`}
                  style={isCurrent ? { backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)' } : {}}
                >
                  {isCompleted ? <Check size={18} /> : <StepIcon size={16} />}
                </motion.div>
                {i < 2 && (
                  <div className={`flex-1 h-0.5 rounded transition-colors duration-500 ${currentIdx > i ? 'bg-green-500' : 'bg-slate-700'}`} />
                )}
              </div>
              <span className={`text-xs font-medium transition-colors ${isCurrent ? 'text-white' : isCompleted ? 'text-green-400' : 'text-slate-500'}`}>{s.label}</span>
            </div>
          );
        })}
      </div>

      {/* Step: Details */}
      <AnimatePresence mode="wait">
      {step === 'details' && (
        <motion.div key="details" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-5">
          {/* Quick time slots */}
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-3">
              <Calendar size={18} className="text-brand-400" /> متى تبي الموعد؟
            </h3>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {(() => {
                const slots = [];
                const now = new Date();
                // Today's remaining slots
                for (let h = Math.max(now.getHours() + 3, 8); h <= 20; h += 2) {
                  const d = new Date(); d.setHours(h, 0, 0, 0);
                  if (d > now) slots.push({ date: d, label: h < 12 ? `${h} ص` : h === 12 ? '12 م' : `${h - 12} م`, sub: 'اليوم' });
                }
                // Tomorrow slots
                for (let h = 8; h <= 20; h += 3) {
                  const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, 0, 0, 0);
                  slots.push({ date: d, label: h < 12 ? `${h} ص` : h === 12 ? '12 م' : `${h - 12} م`, sub: 'بكرة' });
                }
                return slots.slice(0, 6).map((slot, i) => {
                  const val = slot.date.toISOString().slice(0, 16);
                  const isSelected = form.scheduledAt === val;
                  return (
                    <motion.button key={i} whileTap={{ scale: 0.95 }}
                      onClick={() => setForm(f => ({ ...f, scheduledAt: val }))}
                      className={`p-3 rounded-xl border text-center transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-500/20 text-white ring-1 ring-brand-400/50'
                          : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <p className="font-bold text-sm">{slot.label}</p>
                      <p className="text-xs text-slate-400">{slot.sub}</p>
                    </motion.button>
                  );
                });
              })()}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-2">
              <div className="flex-1 h-px bg-slate-700" />
              <span>أو اختر موعد ثاني</span>
              <div className="flex-1 h-px bg-slate-700" />
            </div>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              min={minDateStr}
              className="input-field text-sm"
              required
            />
            <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
              <Info size={12} /> الحجز يكون قبل الموعد بساعتين على الأقل
            </p>
          </div>

          {/* Vehicle info */}
          <div>
            <h3 className="text-lg font-black text-white flex items-center gap-2 mb-1">
              <Car size={18} className="text-brand-400" /> بيانات السيارة
            </h3>
            <p className="text-xs text-slate-500 mb-3">اختياري — يساعدنا نجهز لك أفضل</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">نوع السيارة</label>
                <select
                  value={form.vehicleType}
                  onChange={e => setForm(f => ({ ...f, vehicleType: e.target.value }))}
                  className="input-field"
                >
                  <option value="">اختر...</option>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">رقم اللوحة</label>
                <input type="text" value={form.vehiclePlate}
                  onChange={e => setForm(f => ({ ...f, vehiclePlate: e.target.value }))}
                  placeholder="أ ب ج 1234" className="input-field" />
              </div>
              <div>
                <label className="label">الموديل</label>
                <input type="text" value={form.vehicleModel}
                  onChange={e => setForm(f => ({ ...f, vehicleModel: e.target.value }))}
                  placeholder="كامري 2023" className="input-field" />
              </div>
              <div>
                <label className="label">اللون</label>
                <input type="text" value={form.vehicleColor}
                  onChange={e => setForm(f => ({ ...f, vehicleColor: e.target.value }))}
                  placeholder="أبيض" className="input-field" />
              </div>
            </div>
          </div>

          <div>
            <label className="label">ملاحظات إضافية</label>
            <textarea value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="مثال: السيارة بالمواقف الخارجية، الباب مفتوح..."
              className="input-field h-20 resize-none" maxLength={500} />
            {form.notes.length > 0 && <p className="text-xs text-slate-500 text-left mt-1">{form.notes.length}/500</p>}
          </div>

          <motion.button whileTap={{ scale: 0.97 }}
            onClick={() => { if (!form.scheduledAt) { toast.error('اختر التاريخ والوقت'); return; } setStep('location'); }}
            className="w-full text-white font-bold px-6 py-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
            style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(var(--color-primary-rgb), 0.4)' }}
          >
            التالي: تحديد الموقع <ChevronLeft size={18} />
          </motion.button>
        </motion.div>
      )}

      {/* Step: Location */}
      {step === 'location' && (
        <motion.div key="location" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <MapPin size={18} className="text-brand-400" /> وين مكانك؟
          </h3>

          {/* Neighborhood quick select — pills style */}
          <div>
            <label className="label mb-2">اختر الحي</label>
            <div className="flex flex-wrap gap-2">
              {NORTH_RIYADH_NEIGHBORHOODS.slice(0, 12).map(n => (
                <motion.button key={n} whileTap={{ scale: 0.95 }}
                  onClick={() => setForm(f => ({ ...f, neighborhood: n, address: `${n}, الرياض` }))}
                  className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                    form.neighborhood === n
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/50 font-medium'
                      : 'bg-slate-800/50 text-slate-400 border border-slate-700 hover:border-slate-600'
                  }`}
                >{n}</motion.button>
              ))}
            </div>
          </div>

          {/* Map picker */}
          <div className="rounded-2xl overflow-hidden border border-slate-700/50">
            <MapPicker
              lat={form.lat ? Number(form.lat) : undefined}
              lng={form.lng ? Number(form.lng) : undefined}
              onChange={(lat, lng, addr) => {
                setForm(f => ({ ...f, lat: lat.toString(), lng: lng.toString(), address: addr ?? f.address }));
              }}
            />
          </div>

          <div>
            <label className="label">العنوان التفصيلي *</label>
            <input type="text" value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="حي الياسمين، شارع الأمير محمد، فيلا رقم 12"
              className="input-field" required />
            {form.address && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-green-400 mt-1 flex items-center gap-1">
                <Check size={12} /> تم تحديد الموقع
              </motion.p>
            )}
          </div>

          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep('details')} className="btn-outline flex-1 flex items-center justify-center gap-1">
              <ChevronRight size={16} /> رجوع
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => { if (!form.address) { toast.error('أدخل العنوان'); return; } setStep('confirm'); }}
              className="flex-1 text-white font-bold px-6 py-3.5 rounded-2xl transition-all duration-200 flex items-center justify-center gap-2"
              style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(var(--color-primary-rgb), 0.4)' }}
            >
              التالي: التأكيد <ChevronLeft size={18} />
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* Step: Confirm */}
      {step === 'confirm' && (
        <motion.div key="confirm" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-4">
          <h3 className="text-lg font-black text-white flex items-center gap-2">
            <Sparkles size={18} className="text-brand-400" /> راجع وأكّد
          </h3>

          <div className="card space-y-3 border-slate-700/50">
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-sm">الخدمة</span>
              <div className="text-left">
                <span className="font-bold text-white block">{selectedPackage.name}</span>
                <span className="text-xs text-slate-500">{selectedService?.name}</span>
              </div>
            </div>
            <div className="h-px bg-slate-700/50" />
            <div className="flex justify-between items-center">
              <span className="text-slate-400 text-sm flex items-center gap-1"><Calendar size={13} /> الموعد</span>
              <span className="font-bold text-white text-sm">
                {new Date(form.scheduledAt).toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}
                {' '}
                {new Date(form.scheduledAt).toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <div className="h-px bg-slate-700/50" />
            <div className="flex justify-between items-start">
              <span className="text-slate-400 text-sm flex items-center gap-1"><MapPin size={13} /> الموقع</span>
              <span className="font-medium text-white text-left max-w-[200px] text-sm">{form.address}</span>
            </div>
            {(form.vehiclePlate || form.vehicleModel) && (
              <>
                <div className="h-px bg-slate-700/50" />
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm flex items-center gap-1"><Car size={13} /> السيارة</span>
                  <span className="font-medium text-white text-sm">{[form.vehicleModel, form.vehiclePlate, form.vehicleColor].filter(Boolean).join(' · ')}</span>
                </div>
              </>
            )}
            <div className="border-t-2 border-slate-600/50 pt-3 flex justify-between items-center">
              <span className="font-black text-white text-lg">الإجمالي</span>
              <span className="font-black text-2xl" style={{ color: 'var(--color-primary)' }}>{formatCurrency(selectedPackage.price)}</span>
            </div>
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: MessageCircle, text: 'تأكيد واتساب', color: 'text-green-400' },
              { icon: Shield, text: 'دفع آمن', color: 'text-blue-400' },
              { icon: Clock, text: `${selectedPackage.duration} دقيقة`, color: 'text-amber-400' },
            ].map((t, i) => (
              <div key={i} className="bg-slate-800/40 rounded-xl p-2.5 text-center border border-slate-700/30">
                <t.icon size={16} className={`${t.color} mx-auto mb-1`} />
                <p className="text-xs text-slate-300">{t.text}</p>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => setStep('location')} className="btn-outline flex-1 flex items-center justify-center gap-1">
              <ChevronRight size={16} /> رجوع
            </motion.button>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={handleSubmit}
              disabled={isPending}
              className="flex-1 text-white font-bold px-6 py-3.5 rounded-2xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden"
              style={{ backgroundColor: 'var(--color-primary)', boxShadow: '0 4px 20px rgba(var(--color-primary-rgb), 0.4)' }}
            >
              {isPending ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full" />
                  جاري الحجز...
                </span>
              ) : 'تأكيد الحجز'}
            </motion.button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </div>
  );
}
