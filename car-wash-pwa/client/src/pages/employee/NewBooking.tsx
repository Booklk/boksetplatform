import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { Search, UserPlus } from 'lucide-react';
import api from '../../lib/api';
import { Service, Customer } from '../../types';
import { formatCurrency, VEHICLE_TYPES } from '../../lib/utils';
import { NORTH_RIYADH_NEIGHBORHOODS } from '../../lib/constants';
import MapPicker from '../../components/MapPicker';

type CustomerMode = 'search' | 'new';

export default function EmployeeNewBooking() {
  const navigate = useNavigate();
  const [customerMode, setCustomerMode] = useState<CustomerMode>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [searchResults, setSearchResults] = useState<Customer[]>([]);
  const [searching, setSearching] = useState(false);

  const [newCustomer, setNewCustomer] = useState({
    name: '',
    phone: '',
    vehicleType: '',
    vehiclePlate: '',
    vehicleColor: '',
    vehicleModel: '',
  });

  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [form, setForm] = useState({
    scheduledAt: '',
    address: '',
    lat: '',
    lng: '',
    vehicleType: '',
    vehiclePlate: '',
    notes: '',
  });

  const { data: services = [] } = useQuery<Service[]>({
    queryKey: ['services'],
    queryFn: () => api.get('/services').then(r => r.data),
  });

  async function searchCustomers(q: string) {
    if (q.length < 4) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/customers/search/phone?q=${encodeURIComponent(q)}`);
      setSearchResults(data);
    } finally {
      setSearching(false);
    }
  }

  const { mutate: createCustomer, isPending: creatingCustomer } = useMutation({
    mutationFn: () => api.post('/customers', newCustomer).then(r => r.data),
    onSuccess: (customer) => {
      toast.success('تم إنشاء العميل بنجاح');
      setSelectedCustomer({ ...newCustomer, id: customer.id, isActive: true, createdAt: new Date().toISOString() });
      setCustomerMode('search');
    },
    onError: (err: any) => {
      if (err?.response?.status === 409 && err.response.data.existingCustomer) {
        toast.success('العميل موجود مسبقاً — تم اختياره');
        setSelectedCustomer(err.response.data.existingCustomer);
        setCustomerMode('search');
      } else {
        toast.error(err?.response?.data?.error ?? 'فشل في الإنشاء');
      }
    },
  });

  const { mutate: createBooking, isPending: creatingBooking } = useMutation({
    mutationFn: () => api.post('/bookings', {
      packageId: selectedPackageId,
      customerId: selectedCustomer?.id,
      scheduledAt: form.scheduledAt,
      address: form.address,
      lat: form.lat || undefined,
      lng: form.lng || undefined,
      vehicleType: form.vehicleType || newCustomer.vehicleType || undefined,
      vehiclePlate: form.vehiclePlate || newCustomer.vehiclePlate || undefined,
      notes: form.notes || undefined,
    }).then(r => r.data),
    onSuccess: (booking) => {
      toast.success(`تم إنشاء الحجز #${booking.bookingNumber} بنجاح`);
      navigate('/employee');
    },
    onError: (err: any) => toast.error(err?.response?.data?.error ?? 'فشل في الحجز'),
  });

  const minDate = new Date();
  minDate.setMinutes(minDate.getMinutes() + 30);
  const minDateStr = minDate.toISOString().slice(0, 16);

  const allPackages = services.flatMap(s => s.packages.map(p => ({ ...p, serviceName: s.name })));
  const selectedPkg = allPackages.find(p => p.id === selectedPackageId);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCustomer) { toast.error('اختر أو أنشئ عميلاً'); return; }
    if (!selectedPackageId) { toast.error('اختر الباقة'); return; }
    if (!form.scheduledAt) { toast.error('اختر التاريخ والوقت'); return; }
    if (!form.address) { toast.error('أدخل الموقع'); return; }
    createBooking();
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5" dir="rtl">
      <button onClick={() => navigate('/employee')} className="text-brand-400 text-sm">← العودة</button>
      <h1 className="text-2xl font-black text-white">إنشاء حجز جديد</h1>

      {/* ─── STEP 1: Customer ──────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-black text-white">① العميل</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setCustomerMode('search')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${customerMode === 'search' ? 'bg-brand-700 text-white' : 'bg-slate-700 text-slate-400'}`}
            >
              <Search size={12} className="inline ml-1" />بحث
            </button>
            <button
              onClick={() => setCustomerMode('new')}
              className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-colors ${customerMode === 'new' ? 'bg-brand-700 text-white' : 'bg-slate-700 text-slate-400'}`}
            >
              <UserPlus size={12} className="inline ml-1" />جديد
            </button>
          </div>
        </div>

        {customerMode === 'search' && (
          <div className="space-y-3">
            <input
              type="text"
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); searchCustomers(e.target.value); }}
              placeholder="ابحث برقم الجوال أو الاسم..."
              className="input-field"
              dir="rtl"
            />
            {searching && <p className="text-xs text-slate-400">جاري البحث...</p>}
            {searchResults.map(c => (
              <div
                key={c.id}
                onClick={() => { setSelectedCustomer(c); setSearchResults([]); setSearchQuery(c.name); }}
                className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                  selectedCustomer?.id === c.id ? 'bg-brand-800 border border-brand-600' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <div>
                  <p className="font-bold text-white text-sm">{c.name}</p>
                  <p className="text-xs text-slate-400">{c.phone} {c.vehiclePlate && `· ${c.vehiclePlate}`}</p>
                </div>
                {selectedCustomer?.id === c.id && <span className="text-green-400">✓</span>}
              </div>
            ))}
            {selectedCustomer && (
              <div className="bg-brand-900/40 border border-brand-700/40 rounded-xl p-3">
                <p className="text-xs text-brand-300 font-bold">العميل المختار:</p>
                <p className="font-black text-white">{selectedCustomer.name}</p>
                <p className="text-sm text-slate-300">{selectedCustomer.phone}</p>
              </div>
            )}
          </div>
        )}

        {customerMode === 'new' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">الاسم *</label>
                <input type="text" value={newCustomer.name} onChange={e => setNewCustomer(f => ({ ...f, name: e.target.value }))} className="input-field" placeholder="الاسم الكامل" required />
              </div>
              <div className="col-span-2">
                <label className="label">رقم الجوال *</label>
                <input type="tel" value={newCustomer.phone} onChange={e => setNewCustomer(f => ({ ...f, phone: e.target.value }))} className="input-field" placeholder="05xxxxxxxx" dir="ltr" required />
              </div>
              <div>
                <label className="label">نوع السيارة</label>
                <select value={newCustomer.vehicleType} onChange={e => setNewCustomer(f => ({ ...f, vehicleType: e.target.value }))} className="input-field">
                  <option value="">اختر...</option>
                  {VEHICLE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="label">رقم اللوحة</label>
                <input type="text" value={newCustomer.vehiclePlate} onChange={e => setNewCustomer(f => ({ ...f, vehiclePlate: e.target.value }))} className="input-field" placeholder="أ ب ج 1234" />
              </div>
              <div>
                <label className="label">الموديل</label>
                <input type="text" value={newCustomer.vehicleModel} onChange={e => setNewCustomer(f => ({ ...f, vehicleModel: e.target.value }))} className="input-field" placeholder="كامري 2023" />
              </div>
              <div>
                <label className="label">اللون</label>
                <input type="text" value={newCustomer.vehicleColor} onChange={e => setNewCustomer(f => ({ ...f, vehicleColor: e.target.value }))} className="input-field" placeholder="أبيض" />
              </div>
            </div>
            <button
              type="button"
              onClick={() => createCustomer()}
              disabled={creatingCustomer || !newCustomer.name || !newCustomer.phone}
              className="btn-primary w-full text-sm"
            >
              {creatingCustomer ? 'جاري الإنشاء...' : 'إنشاء العميل'}
            </button>
          </div>
        )}
      </div>

      {/* ─── STEP 2: Package ──────────────────────────── */}
      <div className="card">
        <h2 className="font-black text-white mb-4">② الخدمة والباقة</h2>
        <div className="space-y-2">
          {allPackages.map(pkg => (
            <div
              key={pkg.id}
              onClick={() => setSelectedPackageId(pkg.id)}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition-colors ${
                selectedPackageId === pkg.id ? 'bg-brand-800 border border-brand-600' : 'bg-slate-700 hover:bg-slate-600'
              }`}
            >
              <div>
                <p className="text-xs text-slate-400">{(pkg as any).serviceName}</p>
                <p className="font-bold text-white text-sm">{pkg.name}</p>
              </div>
              <div className="text-right">
                <p className="font-black gradient-text">{formatCurrency(pkg.price)}</p>
                <p className="text-xs text-slate-400">{pkg.duration} دقيقة</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── STEP 3: Date + Location ──────────────────── */}
      <div className="card">
        <h2 className="font-black text-white mb-4">③ الموعد والموقع</h2>
        <div className="space-y-4">
          <div>
            <label className="label">التاريخ والوقت *</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))}
              min={minDateStr}
              className="input-field"
            />
          </div>

          <div>
            <label className="label">الحي</label>
            <select
              value=""
              onChange={e => setForm(f => ({ ...f, address: e.target.value ? `${e.target.value}, الرياض` : f.address }))}
              className="input-field"
            >
              <option value="">اختر الحي...</option>
              {NORTH_RIYADH_NEIGHBORHOODS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>

          <MapPicker
            lat={form.lat ? Number(form.lat) : undefined}
            lng={form.lng ? Number(form.lng) : undefined}
            onChange={(lat, lng, addr) => setForm(f => ({ ...f, lat: lat.toString(), lng: lng.toString(), address: addr ?? f.address }))}
          />

          <div>
            <label className="label">العنوان التفصيلي *</label>
            <input
              type="text"
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              placeholder="الحي، الشارع، رقم المنزل"
              className="input-field"
            />
          </div>

          <div>
            <label className="label">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="input-field h-16 resize-none"
              placeholder="أي تعليمات خاصة..."
            />
          </div>
        </div>
      </div>

      {/* Summary + Submit */}
      {selectedPkg && selectedCustomer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="card bg-gradient-to-l from-brand-900/40 to-slate-800"
        >
          <p className="text-sm text-slate-400 mb-1">ملخص الحجز</p>
          <p className="font-black text-white">{selectedCustomer.name}</p>
          <p className="text-slate-300 text-sm">{(selectedPkg as any).serviceName} - {selectedPkg.name}</p>
          <p className="text-2xl font-black gradient-text mt-2">{formatCurrency(selectedPkg.price)}</p>
        </motion.div>
      )}

      <button
        onClick={handleSubmit}
        disabled={creatingBooking || !selectedCustomer || !selectedPackageId || !form.scheduledAt || !form.address}
        className="btn-primary w-full text-lg py-4"
      >
        {creatingBooking ? 'جاري الإنشاء...' : 'إنشاء الحجز ✓'}
      </button>
    </div>
  );
}
