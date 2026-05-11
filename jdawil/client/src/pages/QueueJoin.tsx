import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { Car, User, Phone, Hash, Clock, ChevronLeft } from 'lucide-react';
import api from '../lib/api';
import { getIndustryFlags, getLabels } from '../lib/labels';

interface VendorInfo {
  id: number;
  nameAr: string;
  logoUrl?: string;
  primaryColor?: string;
  industry?: string;
}

interface IssuedTicket {
  id: number;
  ticketNumber: number;
  position: number;
  estimatedWaitMinutes: number;
  customerPhone?: string;
}

const VEHICLE_TYPES = [
  { label: 'سيدان',     emoji: '🚗' },
  { label: 'SUV',       emoji: '🚙' },
  { label: 'بيكاب',    emoji: '🛻' },
  { label: 'فان',       emoji: '🚐' },
  { label: 'هاتشباك',  emoji: '🚘' },
  { label: 'كوبيه',    emoji: '🏎️' },
];

// ─── Step 1: Vehicle type selection ──────────────────────────────────────────
function StepVehicle({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (v: string) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-5 text-center">نوع سيارتك</h2>
      <div className="grid grid-cols-3 gap-3">
        {VEHICLE_TYPES.map(({ label, emoji }) => (
          <motion.button
            key={label}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelect(label)}
            className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all ${
              selected === label
                ? 'border-blue-500 bg-blue-500/20 text-white'
                : 'border-white/10 bg-white/5 text-white/70 hover:border-white/20'
            }`}
          >
            <span className="text-3xl">{emoji}</span>
            <span className="text-sm font-semibold">{label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Customer info ────────────────────────────────────────────────────
function StepInfo({
  form,
  onChange,
  showVehiclePlate,
}: {
  form: { vehiclePlate: string; customerName: string; customerPhone: string };
  onChange: (key: string, value: string) => void;
  showVehiclePlate: boolean;
}) {
  const fields = [
    ...(showVehiclePlate
      ? [{ key: 'vehiclePlate', label: 'رقم اللوحة', placeholder: 'مثال: أ ب ج 1234', icon: Car }]
      : []),
    { key: 'customerName', label: 'اسمك', placeholder: 'اسمك الكريم', icon: User },
    { key: 'customerPhone',label: 'رقم الجوال', placeholder: '05xxxxxxxx', icon: Phone },
  ];
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-5 text-center">معلوماتك (اختيارية)</h2>
      <div className="space-y-4">
        {fields.map(({ key, label, placeholder, icon: Icon }) => (
          <div key={key}>
            <label className="block text-white/60 text-sm mb-1.5">{label}</label>
            <div className="relative">
              <Icon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input
                type={key === 'customerPhone' ? 'tel' : 'text'}
                placeholder={placeholder}
                value={(form as any)[key]}
                onChange={(e) => onChange(key, e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-10 text-white placeholder-white/30 focus:outline-none focus:border-blue-500/60 transition-colors"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 3: Success ──────────────────────────────────────────────────────────
function StepSuccess({
  ticket,
  vendorName,
  onReset,
}: {
  ticket: IssuedTicket;
  vendorName: string;
  onReset: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-emerald-500/20 border border-emerald-500/30 mx-auto">
        <span className="text-4xl">🎟️</span>
      </div>

      <div>
        <p className="text-white/60 text-lg">رقمك هو</p>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.1 }}
          className="text-[7rem] font-black text-blue-400 leading-none"
        >
          {ticket.ticketNumber}
        </motion.div>
      </div>

      {ticket.position > 1 && (
        <div className="space-y-1">
          <p className="text-white/70 text-lg">
            أمامك{' '}
            <span className="text-amber-400 font-bold">{ticket.position - 1}</span>{' '}
            {ticket.position - 1 === 1 ? 'عميل' : 'عملاء'}
          </p>
          {ticket.estimatedWaitMinutes > 0 && (
            <p className="text-white/40 flex items-center justify-center gap-1.5 text-base">
              <Clock className="w-4 h-4" />
              وقت الانتظار المتوقع: ~{ticket.estimatedWaitMinutes} دقيقة
            </p>
          )}
        </div>
      )}

      {ticket.position === 1 && (
        <p className="text-emerald-400 font-semibold text-lg">أنت التالي مباشرة! 🎉</p>
      )}

      {ticket.customerPhone && (
        <div className="rounded-xl bg-blue-500/10 border border-blue-500/20 p-4 text-sm text-blue-300">
          سنُرسل لك إشعارًا على واتساب عند حضور دورك
        </div>
      )}

      <button
        onClick={onReset}
        className="mt-4 text-white/30 text-sm hover:text-white/60 transition-colors"
      >
        ← تذكرة جديدة
      </button>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function QueueJoin() {
  const { vendorSlug } = useParams<{ vendorSlug: string }>();

  const [step, setStep] = useState<'vehicle' | 'info' | 'success'>('vehicle');
  const [vehicleType, setVehicleType] = useState('');
  const [form, setForm] = useState({ vehiclePlate: '', customerName: '', customerPhone: '' });
  const [issuedTicket, setIssuedTicket] = useState<IssuedTicket | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Vendor info
  const { data: vendor, isLoading: vendorLoading } = useQuery<VendorInfo>({
    queryKey: ['vendor-info-join', vendorSlug],
    queryFn: async () => {
      const { data } = await api.get(`/vendors/public/${vendorSlug}`);
      return data;
    },
    staleTime: 60000,
  });

  const primaryColor = vendor?.primaryColor ?? '#3b82f6';
  const labels = getLabels(vendor?.industry);
  const vendorName = vendor?.nameAr ?? labels.businessName;
  const flags = getIndustryFlags(vendor?.industry);

  // Skip the vehicle step entirely for industries that don't use vehicles.
  useEffect(() => {
    if (!flags.vehicleFieldsEnabled && step === 'vehicle') setStep('info');
  }, [flags.vehicleFieldsEnabled, step]);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError('');
    try {
      const { data } = await api.post('/queue/ticket', {
        vendorSlug,
        vehicleType: vehicleType || undefined,
        vehiclePlate: form.vehiclePlate || undefined,
        customerName: form.customerName || undefined,
        customerPhone: form.customerPhone || undefined,
      });
      setIssuedTicket({ ...data, customerPhone: form.customerPhone || undefined });
      setStep('success');
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'حدث خطأ، يرجى المحاولة مرة أخرى');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(flags.vehicleFieldsEnabled ? 'vehicle' : 'info');
    setVehicleType('');
    setForm({ vehiclePlate: '', customerName: '', customerPhone: '' });
    setIssuedTicket(null);
    setError('');
  };

  if (vendorLoading) {
    return (
      <div className="min-h-screen bg-[#0d1117] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#0d1117] text-white flex flex-col"
      style={{ fontFamily: "'Cairo', 'Segoe UI', sans-serif" }}
    >
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div
          className="absolute top-0 right-0 w-[500px] h-[400px] rounded-full blur-[150px] opacity-12"
          style={{ background: primaryColor }}
        />
      </div>

      {/* Header */}
      <header className="relative z-10 flex items-center gap-3 px-5 py-5 border-b border-white/10">
        {vendor?.logoUrl ? (
          <img src={vendor.logoUrl} alt={vendorName} className="w-10 h-10 rounded-xl object-cover" />
        ) : (
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-lg"
            style={{ background: primaryColor }}
          >
            {vendorName.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="font-bold text-white text-lg leading-none">{vendorName}</h1>
          <p className="text-white/40 text-xs">خذ رقمك في الطابور</p>
        </div>
      </header>

      {/* Body */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm text-center">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            {step === 'vehicle' && (
              <motion.div
                key="vehicle"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
              >
                <StepVehicle selected={vehicleType} onSelect={(v) => setVehicleType(v)} />
                <button
                  onClick={() => setStep('info')}
                  className="mt-6 w-full py-3.5 rounded-2xl font-bold text-white transition-all text-lg flex items-center justify-center gap-2"
                  style={{ background: primaryColor }}
                >
                  التالي <ChevronLeft className="w-5 h-5" />
                </button>
                <p className="text-center text-white/30 text-sm mt-3">
                  يمكنك تخطي هذه الخطوة
                </p>
                <button
                  onClick={() => setStep('info')}
                  className="block mx-auto text-white/30 text-sm hover:text-white/50 transition-colors mt-1"
                >
                  تخطي ←
                </button>
              </motion.div>
            )}

            {step === 'info' && (
              <motion.div
                key="info"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
              >
                <StepInfo
                  form={form}
                  onChange={(k, v) => setForm((f) => ({ ...f, [k]: v }))}
                  showVehiclePlate={flags.vehicleFieldsEnabled}
                />
                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full py-4 rounded-2xl font-black text-white text-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    style={{ background: primaryColor }}
                  >
                    {isSubmitting ? (
                      <div className="w-6 h-6 border-3 border-white/50 border-t-white rounded-full animate-spin" />
                    ) : (
                      <><Hash className="w-6 h-6" /> احصل على رقمك</>
                    )}
                  </button>
                  {flags.vehicleFieldsEnabled && (
                    <button
                      onClick={() => setStep('vehicle')}
                      className="w-full py-2 text-white/40 text-sm hover:text-white/60 transition-colors"
                    >
                      ← رجوع
                    </button>
                  )}
                </div>
              </motion.div>
            )}

            {step === 'success' && issuedTicket && (
              <motion.div
                key="success"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
              >
                <StepSuccess
                  ticket={issuedTicket}
                  vendorName={vendorName}
                  onReset={handleReset}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
