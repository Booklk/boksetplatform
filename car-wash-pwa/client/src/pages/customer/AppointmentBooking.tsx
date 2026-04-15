/**
 * AppointmentBooking — 3-step salon-style booking flow
 * Route: /store/:slug/book
 *
 * Step 1: اختر الخدمة   → service + package selection
 * Step 2: اختر الوقت    → date strip + time slots grid
 * Step 3: تأكيد الحجز   → summary, vehicle, notes, confirm
 */

import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, ChevronLeft, ChevronRight, Clock, Car,
  CheckCircle, Calendar, Loader2, StickyNote, X,
} from 'lucide-react';
import api from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { useAuth } from '../../hooks/useAuth';

// ─── Types ────────────────────────────────────────────────────────────────────

interface VendorPublic {
  id: number;
  nameAr: string;
  slug: string;
  logoUrl: string | null;
  primaryColor: string;
}

interface Package {
  id: number;
  name: string;
  price: string;
  duration: number;
  features: string[];
  isActive: boolean;
}

interface Service {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  packages: Package[];
}

interface TimeSlot {
  time: string;
  available: boolean;
  bookedCount: number;
  capacity: number;
  isBlocked: boolean;
  isPast: boolean;
}

interface BookingConfig {
  workingDays: number[];
  startTime: string;
  endTime: string;
  slotDurationMin: number;
  carsPerSlot: number;
  advanceBookingDays: number;
  isAppointmentMode: boolean;
}

interface Vehicle {
  id: number;
  label: string | null;
  type: string | null;
  plate: string | null;
  model: string | null;
  color: string | null;
  isDefault: boolean;
}

// ─── Arabic helpers ───────────────────────────────────────────────────────────

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

function toArabicNumerals(str: string | number): string {
  return String(str).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'[parseInt(d)]);
}

function formatTimeAr(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const period = h < 12 ? 'ص' : 'م';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const mm = m === 0 ? '' : `:${toArabicNumerals(String(m).padStart(2, '0'))}`;
  return `${toArabicNumerals(h12)}${mm} ${period}`;
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dateLabel(d: Date, today: Date): string {
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'اليوم';
  if (diff === 1) return 'غداً';
  if (diff === 2) return 'بعد غد';
  return AR_DAYS[d.getDay()];
}

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step, color }: { step: number; color: string }) {
  const steps = ['الخدمة', 'الوقت', 'التأكيد'];
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      {steps.map((label, idx) => {
        const num = idx + 1;
        const active = num === step;
        const done = num < step;
        return (
          <div key={num} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black transition-all duration-300"
                style={
                  active
                    ? { background: color, color: '#fff', boxShadow: `0 0 16px ${color}60` }
                    : done
                    ? { background: `${color}33`, color }
                    : { background: '#1e293b', color: '#475569' }
                }
              >
                {done ? <CheckCircle size={16} /> : toArabicNumerals(num)}
              </div>
              <span
                className="text-xs font-semibold"
                style={{ color: active ? color : done ? `${color}99` : '#475569' }}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className="w-12 h-0.5 rounded-full mb-5 transition-all duration-300"
                style={{ background: done ? color : '#1e293b' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AppointmentBooking() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);

  // Selection state
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(isoDate(new Date()));
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | undefined>();
  const [notes, setNotes] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState<{ bookingNumber: string; time: string } | null>(null);

  // Build date strip (today + advanceBookingDays)
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ─── Queries ───────────────────────────────────────────────────────────────

  const { data: vendor } = useQuery<VendorPublic>({
    queryKey: ['vendor-public', slug],
    queryFn: () => api.get(`/vendors/public/${slug}`).then((r) => r.data),
    enabled: !!slug,
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services-public', vendor?.id],
    queryFn: () => api.get(`/services?vendorId=${vendor!.id}`).then((r) => r.data),
    enabled: !!vendor?.id,
  });

  const { data: bookingConfigData } = useQuery<{ appointmentMode?: boolean; config?: BookingConfig } & BookingConfig>({
    queryKey: ['booking-config', vendor?.id],
    queryFn: () => api.get(`/appointments/config?vendorId=${vendor!.id}`).then((r) => r.data),
    enabled: !!vendor?.id,
  });

  const config: BookingConfig | null = bookingConfigData?.isAppointmentMode !== undefined
    ? (bookingConfigData as unknown as BookingConfig)
    : (bookingConfigData?.config ?? null);

  const advanceDays = config?.advanceBookingDays ?? 7;
  const dateStrip: Date[] = Array.from({ length: advanceDays }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const { data: slotsData, isFetching: slotsFetching } = useQuery<{
    slots: TimeSlot[];
    appointmentMode: boolean;
    closedDay?: boolean;
    config?: BookingConfig;
  }>({
    queryKey: ['available-slots', vendor?.id, selectedDate],
    queryFn: () =>
      api.get(`/appointments/available?vendorId=${vendor!.id}&date=${selectedDate}`).then((r) => r.data),
    enabled: !!vendor?.id && step === 2,
  });

  const { data: vehicles = [] } = useQuery<Vehicle[]>({
    queryKey: ['my-vehicles'],
    queryFn: () => api.get('/vehicles').then((r) => r.data),
    enabled: !!user && step === 3,
  });

  // Auto-select default vehicle
  useEffect(() => {
    if (vehicles.length > 0 && !selectedVehicleId) {
      const def = vehicles.find((v) => v.isDefault) ?? vehicles[0];
      setSelectedVehicleId(def.id);
    }
  }, [vehicles]);

  // ─── Booking mutation ───────────────────────────────────────────────────────

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!vendor || !selectedService || !selectedPackage || !selectedTime) throw new Error('بيانات ناقصة');
      const { data } = await api.post('/appointments/book', {
        vendorId: vendor.id,
        date: selectedDate,
        time: selectedTime,
        serviceId: selectedService.id,
        packageId: selectedPackage.id,
        vehicleId: selectedVehicleId,
        notes: notes || undefined,
      });
      return data;
    },
    onSuccess: (data) => {
      setBookingSuccess({ bookingNumber: data.booking.bookingNumber, time: selectedTime! });
    },
  });

  const color = vendor?.primaryColor ?? '#2563eb';
  const activeServices = services.filter((s) => s.isActive);

  // ─── Step 1: Service Selection ─────────────────────────────────────────────

  if (bookingSuccess) {
    return (
      <div className="min-h-screen bg-surface-1 flex flex-col items-center justify-center px-4 font-arabic" dir="rtl">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="text-center"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: [0, 1.2, 1] }}
            transition={{ duration: 0.6, times: [0, 0.7, 1] }}
            className="w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6"
            style={{ background: `${color}25`, border: `3px solid ${color}` }}
          >
            <CheckCircle size={48} style={{ color }} />
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-3xl font-black text-white mb-2"
          >
            تم الحجز!
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="text-slate-300 text-lg mb-2"
          >
            سنراك الساعة {formatTimeAr(bookingSuccess.time)}
          </motion.p>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-slate-500 text-sm mb-8"
          >
            رقم الحجز: <span className="font-mono text-slate-300">{bookingSuccess.bookingNumber}</span>
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9 }}
            className="flex flex-col gap-3"
          >
            <Link
              to="/app/bookings"
              className="px-8 py-3 rounded-xl font-bold text-white text-center"
              style={{ background: color }}
            >
              عرض حجوزاتي
            </Link>
            <Link to={`/store/${slug}`} className="text-slate-400 text-sm hover:text-white transition-colors">
              العودة للمغسلة
            </Link>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-1 font-arabic" dir="rtl">
      {/* Header */}
      <div
        className="sticky top-0 z-30 border-b border-white/8 backdrop-blur-xl"
        style={{ background: 'rgba(2,6,23,0.9)' }}
      >
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate(`/store/${slug}`))}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800/80 text-slate-300 hover:text-white transition-colors"
          >
            <ArrowRight size={18} />
          </button>
          <div className="flex-1">
            <p className="text-xs text-slate-500">احجز موعد</p>
            <p className="text-sm font-bold text-white">{vendor?.nameAr ?? '...'}</p>
          </div>
          {vendor?.logoUrl && (
            <img src={vendor.logoUrl} alt="" className="w-9 h-9 rounded-xl object-cover" />
          )}
        </div>
        <div className="max-w-2xl mx-auto px-4 pb-2">
          <StepIndicator step={step} color={color} />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {/* ── Step 1: Services ───────────────────────────────────────── */}
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-xl font-black text-white mb-5">اختر الخدمة</h2>

              {activeServices.length === 0 ? (
                <div className="text-center text-slate-400 py-16">لا توجد خدمات متاحة</div>
              ) : (
                <div className="space-y-6">
                  {activeServices.map((service) => (
                    <div key={service.id}>
                      <h3 className="text-sm font-bold text-slate-400 mb-3 flex items-center gap-2">
                        <span
                          className="w-1.5 h-4 rounded-full inline-block"
                          style={{ background: color }}
                        />
                        {service.name}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {service.packages.filter((p) => p.isActive).map((pkg) => {
                          const isSelected = selectedPackage?.id === pkg.id;
                          return (
                            <motion.button
                              key={pkg.id}
                              whileTap={{ scale: 0.97 }}
                              onClick={() => {
                                setSelectedService(service);
                                setSelectedPackage(pkg);
                                setTimeout(() => setStep(2), 180);
                              }}
                              className="text-right p-4 rounded-2xl border transition-all duration-200 relative overflow-hidden"
                              style={
                                isSelected
                                  ? {
                                      borderColor: color,
                                      background: `${color}18`,
                                      boxShadow: `0 0 20px ${color}25`,
                                    }
                                  : {
                                      borderColor: '#1e293b',
                                      background: '#0f172a',
                                    }
                              }
                            >
                              {isSelected && (
                                <div
                                  className="absolute top-3 left-3 w-5 h-5 rounded-full flex items-center justify-center"
                                  style={{ background: color }}
                                >
                                  <CheckCircle size={12} color="#fff" />
                                </div>
                              )}
                              <div className="flex justify-between items-start mb-2">
                                <span className="font-black text-white text-base">{pkg.name}</span>
                                <span className="font-black text-lg" style={{ color }}>
                                  {formatCurrency(pkg.price)}
                                </span>
                              </div>
                              <div className="flex items-center gap-1 text-slate-500 text-xs mb-3">
                                <Clock size={11} />
                                <span>{toArabicNumerals(pkg.duration)} دقيقة</span>
                              </div>
                              {pkg.features?.length > 0 && (
                                <ul className="space-y-1">
                                  {pkg.features.slice(0, 3).map((f, i) => (
                                    <li key={i} className="flex items-center gap-1.5 text-xs text-slate-400">
                                      <div className="w-1 h-1 rounded-full" style={{ background: color }} />
                                      {f}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Step 2: Date + Time ────────────────────────────────────── */}
          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
            >
              <h2 className="text-xl font-black text-white mb-5">اختر الوقت</h2>

              {/* Date strip */}
              <div className="mb-6">
                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
                  {dateStrip.map((d) => {
                    const iso = isoDate(d);
                    const isSelected = iso === selectedDate;
                    const dow = d.getDay();
                    const isWorkingDay = config?.workingDays.includes(dow) ?? true;
                    return (
                      <motion.button
                        key={iso}
                        whileTap={{ scale: 0.94 }}
                        onClick={() => {
                          setSelectedDate(iso);
                          setSelectedTime(null);
                        }}
                        disabled={!isWorkingDay}
                        className="shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl border transition-all duration-200 min-w-[60px]"
                        style={
                          isSelected
                            ? { borderColor: color, background: `${color}20` }
                            : isWorkingDay
                            ? { borderColor: '#1e293b', background: '#0f172a' }
                            : { borderColor: '#0f172a', background: 'transparent', opacity: 0.4 }
                        }
                      >
                        <span
                          className="text-[10px] font-bold"
                          style={{ color: isSelected ? color : '#64748b' }}
                        >
                          {dateLabel(d, today)}
                        </span>
                        <span
                          className="text-xl font-black"
                          style={{ color: isSelected ? color : isWorkingDay ? '#fff' : '#475569' }}
                        >
                          {toArabicNumerals(d.getDate())}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {AR_MONTHS[d.getMonth()].slice(0, 3)}
                        </span>
                        {isSelected && (
                          <div
                            className="w-1.5 h-1.5 rounded-full mt-0.5"
                            style={{ background: color }}
                          />
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              {slotsFetching ? (
                <div className="flex justify-center py-12">
                  <Loader2 size={32} className="animate-spin" style={{ color }} />
                </div>
              ) : slotsData?.closedDay ? (
                <div className="text-center py-12 text-slate-400">
                  <Calendar size={40} className="mx-auto mb-3 opacity-30" />
                  <p>المغسلة مغلقة في هذا اليوم</p>
                </div>
              ) : slotsData?.slots?.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  <Clock size={40} className="mx-auto mb-3 opacity-30" />
                  <p>لا توجد مواعيد متاحة لهذا اليوم</p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-3">
                    المواعيد المتاحة — {toArabicNumerals(slotsData?.slots?.filter((s) => s.available).length ?? 0)} موعد
                  </p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                    {slotsData?.slots?.map((slot) => {
                      const isSelected = selectedTime === slot.time;
                      return (
                        <motion.button
                          key={slot.time}
                          whileTap={slot.available ? { scale: 0.95 } : {}}
                          onClick={() => slot.available && setSelectedTime(slot.time)}
                          disabled={!slot.available}
                          className="relative rounded-xl border py-3 px-2 flex flex-col items-center gap-1 transition-all duration-200"
                          style={
                            isSelected
                              ? { borderColor: color, background: color, boxShadow: `0 4px 16px ${color}40` }
                              : slot.available
                              ? { borderColor: '#1e293b', background: '#0f172a' }
                              : { borderColor: '#0f172a', background: 'transparent', opacity: 0.4 }
                          }
                        >
                          {/* Capacity dot */}
                          {slot.available && (
                            <div
                              className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full"
                              style={{ background: isSelected ? '#fff' : '#22c55e' }}
                            />
                          )}
                          <span
                            className={`text-sm font-black ${
                              !slot.available
                                ? 'text-slate-600 line-through'
                                : isSelected
                                ? 'text-white'
                                : 'text-white'
                            }`}
                          >
                            {formatTimeAr(slot.time)}
                          </span>
                          {!slot.available && (
                            <span className="text-[9px] text-slate-600">ممتلئ</span>
                          )}
                          {slot.available && slot.capacity > 1 && (
                            <span
                              className="text-[9px]"
                              style={{ color: isSelected ? 'rgba(255,255,255,0.7)' : '#475569' }}
                            >
                              {toArabicNumerals(slot.bookedCount)}/{toArabicNumerals(slot.capacity)}
                            </span>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Next button */}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    onClick={() => selectedTime && setStep(3)}
                    disabled={!selectedTime}
                    className="w-full mt-6 py-4 rounded-2xl font-black text-base transition-all duration-200 text-white"
                    style={
                      selectedTime
                        ? { background: color, boxShadow: `0 4px 20px ${color}40` }
                        : { background: '#1e293b', color: '#475569' }
                    }
                  >
                    {selectedTime ? `التالي — ${formatTimeAr(selectedTime)}` : 'اختر وقتاً'}
                  </motion.button>
                </>
              )}
            </motion.div>
          )}

          {/* ── Step 3: Confirm ────────────────────────────────────────── */}
          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.25 }}
              className="space-y-4"
            >
              <h2 className="text-xl font-black text-white mb-5">تأكيد الحجز</h2>

              {/* Summary card */}
              <div
                className="rounded-2xl border p-5 space-y-3"
                style={{ borderColor: `${color}40`, background: `${color}0d` }}
              >
                <div className="flex items-center gap-3 mb-4">
                  {vendor?.logoUrl ? (
                    <img src={vendor.logoUrl} alt="" className="w-12 h-12 rounded-xl object-cover" />
                  ) : (
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-black"
                      style={{ background: `${color}25`, color }}
                    >
                      {vendor?.nameAr?.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-black text-white">{vendor?.nameAr}</p>
                    <p className="text-xs text-slate-400">{selectedService?.name}</p>
                  </div>
                </div>

                <SummaryRow label="الباقة" value={selectedPackage?.name ?? ''} color={color} />
                <SummaryRow
                  label="التاريخ"
                  value={(() => {
                    const d = new Date(selectedDate);
                    return `${AR_DAYS[d.getDay()]}، ${toArabicNumerals(d.getDate())} ${AR_MONTHS[d.getMonth()]}`;
                  })()}
                  color={color}
                />
                <SummaryRow label="الوقت" value={formatTimeAr(selectedTime!)} color={color} />
                <SummaryRow
                  label="المدة"
                  value={`${toArabicNumerals(selectedPackage?.duration ?? 0)} دقيقة`}
                  color={color}
                />
                <div className="pt-3 border-t border-white/8 flex justify-between items-center">
                  <span className="font-bold text-slate-300">الإجمالي</span>
                  <span className="text-2xl font-black" style={{ color }}>
                    {formatCurrency(selectedPackage?.price ?? '0')}
                  </span>
                </div>
              </div>

              {/* Vehicle selector */}
              {vehicles.length > 0 && (
                <div className="bg-slate-900/60 border border-white/8 rounded-2xl p-4">
                  <p className="text-sm font-bold text-slate-300 mb-3 flex items-center gap-2">
                    <Car size={16} style={{ color }} />
                    السيارة
                  </p>
                  <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {vehicles.map((v) => {
                      const isSel = selectedVehicleId === v.id;
                      return (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVehicleId(v.id)}
                          className="shrink-0 flex flex-col gap-0.5 px-3 py-2 rounded-xl border transition-all"
                          style={
                            isSel
                              ? { borderColor: color, background: `${color}18` }
                              : { borderColor: '#1e293b', background: '#0f172a' }
                          }
                        >
                          <span className="text-sm font-bold" style={{ color: isSel ? color : '#cbd5e1' }}>
                            {v.label ?? v.type ?? 'سيارة'}
                          </span>
                          {v.plate && <span className="text-[10px] text-slate-500">{v.plate}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="bg-slate-900/60 border border-white/8 rounded-2xl p-4">
                <label className="text-sm font-bold text-slate-300 mb-2 flex items-center gap-2">
                  <StickyNote size={16} style={{ color }} />
                  ملاحظات (اختياري)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="أي تعليمات خاصة للمغسلة..."
                  className="w-full bg-transparent text-white placeholder-slate-600 text-sm resize-none outline-none mt-1"
                />
              </div>

              {/* Error */}
              {bookMutation.isError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm">
                  {(bookMutation.error as any)?.response?.data?.error ?? 'حدث خطأ، يرجى المحاولة مرة أخرى'}
                </div>
              )}

              {/* Confirm button */}
              {!user ? (
                <div className="text-center py-4 space-y-3">
                  <p className="text-slate-400 text-sm">يجب تسجيل الدخول لإتمام الحجز</p>
                  <Link
                    to={`/login?redirect=/store/${slug}/book`}
                    className="block py-4 rounded-2xl font-black text-white text-center"
                    style={{ background: color }}
                  >
                    تسجيل الدخول
                  </Link>
                </div>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => bookMutation.mutate()}
                  disabled={bookMutation.isPending}
                  className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-2 transition-all"
                  style={{ background: color, boxShadow: `0 4px 20px ${color}40` }}
                >
                  {bookMutation.isPending ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      جاري الحجز...
                    </>
                  ) : (
                    'تأكيد الحجز'
                  )}
                </motion.button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Helper sub-component ─────────────────────────────────────────────────────

function SummaryRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-bold text-white">{value}</span>
    </div>
  );
}
