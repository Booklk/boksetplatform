import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import toast from 'react-hot-toast';
import {
  CheckCircle, ChevronDown, ChevronUp, Store, CreditCard,
  MessageCircle, Globe, Wrench, Zap, ExternalLink, Eye, EyeOff,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';

const PRESET_COLORS = ['#1e3a8a','#0891b2','#059669','#7c3aed','#dc2626','#d97706','#db2777','#0f172a'];
const SAUDI_CITIES = ['الرياض','جدة','مكة المكرمة','المدينة المنورة','الدمام','الخبر','الطائف','بريدة','تبوك','أبها'];
const SERVICE_AREAS = ['الياسمين','الملقا','الصحافة','العقيق','الندى','النرجس','العارض','حطين','الوادي','الغدير','الربيع','المروج','الورود','الفلاح','السليمانية'];

const DEFAULT_SERVICES = [
  { name: 'غسيل خارجي سريع', price: '40', duration: 30 },
  { name: 'غسيل خارجي وداخلي', price: '80', duration: 60 },
  { name: 'غسيل شامل مع تلميع', price: '150', duration: 90 },
];

interface SetupCard {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  required: boolean;
  color: string;
}

const CARDS: SetupCard[] = [
  { id: 'info',     title: 'المعلومات الأساسية', subtitle: 'اسم مغسلتك، شعارها، لونها', icon: <Store size={20}/>, required: true, color: 'blue' },
  { id: 'payment',  title: 'بوابة الدفع الإلكتروني', subtitle: 'استقبل المدفوعات مباشرة في حسابك', icon: <CreditCard size={20}/>, required: false, color: 'green' },
  { id: 'whatsapp', title: 'واتساب للإشعارات', subtitle: 'أرسل رسائل من رقمك أنت', icon: <MessageCircle size={20}/>, required: false, color: 'emerald' },
  { id: 'areas',    title: 'منطقة الخدمة', subtitle: 'أين تقدم خدمتك؟', icon: <Globe size={20}/>, required: true, color: 'purple' },
  { id: 'services', title: 'الخدمات والأسعار', subtitle: 'حدد خدماتك وأسعارها', icon: <Wrench size={20}/>, required: true, color: 'orange' },
];

export default function VendorSetup() {
  const { user, token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };
  const [expanded, setExpanded] = useState<string>('info');
  const [done, setDone] = useState<Set<string>>(new Set());
  const [showPassword, setShowPassword] = useState(false);

  const [infoForm, setInfoForm] = useState({ nameAr: '', phone: '', city: 'الرياض', primaryColor: '#1e3a8a', logoUrl: '', descriptionAr: '' });
  const [paymentKey, setPaymentKey] = useState('');
  const [sandboxMode, setSandboxMode] = useState(true);
  const [wpPhoneId, setWpPhoneId] = useState('');
  const [wpToken, setWpToken] = useState('');
  const [selectedAreas, setSelectedAreas] = useState<string[]>([]);
  const [services, setServices] = useState(DEFAULT_SERVICES);
  const [testingWA, setTestingWA] = useState(false);

  const { data: vendor } = useQuery({
    queryKey: ['vendor-setup', user?.vendorId],
    queryFn: () => axios.get(`/api/vendors/${user?.vendorId}`, { headers }).then(r => r.data),
    enabled: !!user?.vendorId,
    onSuccess: (v: any) => {
      if (v.nameAr) setInfoForm(f => ({ ...f, nameAr: v.nameAr, phone: v.phone ?? '', primaryColor: v.primaryColor ?? '#1e3a8a', logoUrl: v.logoUrl ?? '', descriptionAr: v.descriptionAr ?? '', city: v.city ?? 'الرياض' }));
      if (v.serviceAreas?.length) setSelectedAreas(v.serviceAreas);
    },
  } as any);

  const saveMutation = useMutation({
    mutationFn: (data: any) => axios.put(`/api/vendors/${user?.vendorId}`, data, { headers }),
  });

  const paymentMutation = useMutation({
    mutationFn: (data: any) => axios.post(`/api/vendors/${user?.vendorId}/payment-config`, data, { headers }),
    onSuccess: () => { toast.success('✅ تم حفظ بوابة الدفع'); markDone('payment'); },
    onError: (e: any) => toast.error(e?.response?.data?.error ?? 'فشل الحفظ'),
  });

  function markDone(id: string) { setDone(d => new Set([...d, id])); }

  async function saveInfo() {
    try {
      await saveMutation.mutateAsync({ ...infoForm, serviceAreas: selectedAreas });
      toast.success('✅ تم حفظ المعلومات');
      markDone('info');
      setExpanded('payment');
    } catch { toast.error('فشل الحفظ'); }
  }

  async function saveAreas() {
    try {
      await saveMutation.mutateAsync({ serviceAreas: selectedAreas });
      toast.success('✅ تم حفظ مناطق الخدمة');
      markDone('areas');
      setExpanded('services');
    } catch { toast.error('فشل الحفظ'); }
  }

  async function saveServices() {
    try {
      for (const svc of services.filter(s => s.name && s.price)) {
        await axios.post('/api/services', { nameAr: svc.name, price: svc.price, duration: svc.duration }, { headers });
      }
      toast.success('✅ تم إضافة الخدمات');
      markDone('services');
    } catch { toast.error('فشل إضافة الخدمات'); }
  }

  async function testWhatsApp() {
    if (!wpPhoneId || !wpToken) return toast.error('أدخل بيانات واتساب أولاً');
    setTestingWA(true);
    try {
      await axios.post(`/api/vendors/${user?.vendorId}/test-whatsapp`, { phoneId: wpPhoneId, token: wpToken }, { headers });
      toast.success('✅ تم إرسال رسالة تجريبية على جوالك!');
      markDone('whatsapp');
    } catch (e: any) {
      toast.error(e?.response?.data?.error ?? 'فشل الاتصال');
    } finally { setTestingWA(false); }
  }

  const completedRequired = ['info','areas','services'].every(id => done.has(id));
  const totalDone = done.size;
  const progress = Math.round((totalDone / CARDS.length) * 100);

  return (
    <div className="min-h-screen bg-[#040812] p-4 pb-16" dir="rtl">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="text-center mb-8 pt-4">
          <div className="w-16 h-16 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Zap className="text-blue-400" size={28} />
          </div>
          <h1 className="text-2xl font-black text-white">إعداد مغسلتك</h1>
          <p className="text-slate-400 mt-1">أكمل الخطوات التالية لتبدأ باستقبال الحجوزات</p>

          {/* Progress */}
          <div className="mt-6 bg-slate-800 rounded-full h-2 overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-l from-blue-500 to-cyan-400 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-slate-400 text-sm mt-2">{totalDone} من {CARDS.length} خطوات مكتملة ({progress}%)</p>
        </div>

        {/* Cards */}
        <div className="space-y-3">
          {CARDS.map((card) => {
            const isOpen = expanded === card.id;
            const isDone = done.has(card.id);
            return (
              <motion.div
                key={card.id}
                layout
                className={`bg-slate-900/80 backdrop-blur border rounded-2xl overflow-hidden transition-colors ${
                  isDone ? 'border-green-500/40' : isOpen ? 'border-blue-500/50' : 'border-slate-700/50'
                }`}
              >
                {/* Card Header */}
                <button
                  onClick={() => setExpanded(isOpen ? '' : card.id)}
                  className="w-full p-5 flex items-center justify-between text-right hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${
                      isDone ? 'bg-green-500/20 text-green-400' : `bg-${card.color}-500/20 text-${card.color}-400`
                    }`}>
                      {isDone ? <CheckCircle size={20} /> : card.icon}
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-white">{card.title}</span>
                        {card.required && !isDone && <span className="text-red-400 text-xs">مطلوب</span>}
                        {isDone && <span className="text-green-400 text-xs">✅ مكتمل</span>}
                      </div>
                      <p className="text-slate-400 text-sm">{card.subtitle}</p>
                    </div>
                  </div>
                  {isOpen ? <ChevronUp size={18} className="text-slate-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-slate-400 flex-shrink-0" />}
                </button>

                {/* Card Content */}
                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-t border-slate-700/50"
                    >
                      <div className="p-5 space-y-4">

                        {/* ── BASIC INFO ── */}
                        {card.id === 'info' && (
                          <>
                            <div className="grid grid-cols-2 gap-3">
                              {[
                                { label: 'اسم المغسلة', key: 'nameAr', placeholder: 'مغسلة كريستال' },
                                { label: 'رقم الجوال', key: 'phone', placeholder: '05xxxxxxxx' },
                              ].map(({ label, key, placeholder }) => (
                                <div key={key}>
                                  <label className="block text-xs text-slate-400 mb-1">{label}</label>
                                  <input value={(infoForm as any)[key]} onChange={e => setInfoForm(f => ({ ...f, [key]: e.target.value }))}
                                    placeholder={placeholder}
                                    className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
                                </div>
                              ))}
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">المدينة</label>
                              <select value={infoForm.city} onChange={e => setInfoForm(f => ({ ...f, city: e.target.value }))}
                                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm focus:border-blue-500 focus:outline-none">
                                {SAUDI_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-2">لون المغسلة</label>
                              <div className="flex gap-2 flex-wrap">
                                {PRESET_COLORS.map(color => (
                                  <button key={color} onClick={() => setInfoForm(f => ({ ...f, primaryColor: color }))}
                                    className={`w-8 h-8 rounded-lg border-2 transition-transform hover:scale-110 ${infoForm.primaryColor === color ? 'border-white scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: color }} />
                                ))}
                                <input type="color" value={infoForm.primaryColor}
                                  onChange={e => setInfoForm(f => ({ ...f, primaryColor: e.target.value }))}
                                  className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent" title="لون مخصص" />
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">رابط الشعار (URL)</label>
                              <input value={infoForm.logoUrl} onChange={e => setInfoForm(f => ({ ...f, logoUrl: e.target.value }))}
                                placeholder="https://..."
                                className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
                              {infoForm.logoUrl && <img src={infoForm.logoUrl} alt="" className="mt-2 w-16 h-16 rounded-xl object-cover" onError={e => (e.currentTarget.style.display = 'none')} />}
                            </div>
                            <button onClick={saveInfo} disabled={!infoForm.nameAr || saveMutation.isPending}
                              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors">
                              {saveMutation.isPending ? 'جاري الحفظ...' : 'حفظ المعلومات ←'}
                            </button>
                          </>
                        )}

                        {/* ── PAYMENT ── */}
                        {card.id === 'payment' && (
                          <>
                            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 text-sm text-slate-300 space-y-1">
                              <p className="font-semibold text-blue-300 mb-2">كيف تفعّل بوابة الدفع:</p>
                              <p>١. سجّل في <a href="https://moyasar.com/en/sign-up" target="_blank" rel="noopener noreferrer" className="text-blue-400 underline">moyasar.com <ExternalLink size={11} className="inline" /></a> (مجاني، 10 دقائق)</p>
                              <p>٢. من لوحة التحكم → API Keys → انسخ Secret Key</p>
                              <p>٣. الصقه هنا — المال يروح لحسابك مباشرة ✅</p>
                            </div>
                            <div>
                              <label className="block text-xs text-slate-400 mb-1">مفتاح Moyasar (Secret Key)</label>
                              <div className="relative">
                                <input type={showPassword ? 'text' : 'password'} value={paymentKey}
                                  onChange={e => setPaymentKey(e.target.value)}
                                  placeholder="sk_live_xxxxxxxxxxxx"
                                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none pl-10" />
                                <button onClick={() => setShowPassword(s => !s)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3">
                              <div>
                                <p className="text-white text-sm font-medium">وضع الاختبار</p>
                                <p className="text-slate-400 text-xs">فعّله أثناء التجربة، أوقفه للإنتاج</p>
                              </div>
                              <button onClick={() => setSandboxMode(s => !s)}
                                className={`w-12 h-6 rounded-full transition-colors ${sandboxMode ? 'bg-yellow-500' : 'bg-slate-600'}`}>
                                <div className={`w-5 h-5 bg-white rounded-full mx-0.5 transition-transform ${sandboxMode ? 'translate-x-0' : 'translate-x-6'}`} />
                              </button>
                            </div>
                            <button onClick={() => paymentMutation.mutate({ apiKey: paymentKey, sandboxMode })}
                              disabled={!paymentKey.startsWith('sk_') || paymentMutation.isPending}
                              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors">
                              {paymentMutation.isPending ? 'جاري الحفظ...' : '✅ تفعيل بوابة الدفع'}
                            </button>
                            <button onClick={() => { markDone('payment'); setExpanded('whatsapp'); }}
                              className="w-full text-slate-400 text-sm py-1 hover:text-white transition-colors">
                              تخطي — سأستخدم الدفع النقدي فقط
                            </button>
                          </>
                        )}

                        {/* ── WHATSAPP ── */}
                        {card.id === 'whatsapp' && (
                          <>
                            <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-sm text-slate-300 space-y-1">
                              <p className="font-semibold text-green-300 mb-2">كيف ترسل من رقمك أنت:</p>
                              <p>١. اشترك في <span className="text-green-400">Meta Business → WhatsApp API</span></p>
                              <p>٢. أنشئ تطبيقاً → انسخ Phone Number ID و Token</p>
                              <p>٣. الصقهما هنا واضغط اختبر — رسالة ستصلك فوراً ✅</p>
                            </div>
                            {[
                              { label: 'Phone Number ID', val: wpPhoneId, set: setWpPhoneId, placeholder: '1234567890' },
                              { label: 'API Token', val: wpToken, set: setWpToken, placeholder: 'EAAxxxxx...' },
                            ].map(({ label, val, set, placeholder }) => (
                              <div key={label}>
                                <label className="block text-xs text-slate-400 mb-1">{label}</label>
                                <input type="password" value={val} onChange={e => set(e.target.value)} placeholder={placeholder}
                                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 focus:border-blue-500 focus:outline-none" />
                              </div>
                            ))}
                            <button onClick={testWhatsApp} disabled={testingWA || !wpPhoneId || !wpToken}
                              className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                              <MessageCircle size={18} />
                              {testingWA ? 'جاري الاختبار...' : 'اختبر الاتصال — ستصلك رسالة فورية'}
                            </button>
                            <button onClick={() => { markDone('whatsapp'); setExpanded('areas'); }}
                              className="w-full text-slate-400 text-sm py-1 hover:text-white transition-colors">
                              تخطي — سأستخدم واتساب المنصة
                            </button>
                          </>
                        )}

                        {/* ── SERVICE AREAS ── */}
                        {card.id === 'areas' && (
                          <>
                            <p className="text-slate-400 text-sm">اختر الأحياء التي تغطيها خدمتك:</p>
                            <div className="flex flex-wrap gap-2">
                              {SERVICE_AREAS.map(area => {
                                const sel = selectedAreas.includes(area);
                                return (
                                  <button key={area} onClick={() => setSelectedAreas(a => sel ? a.filter(x => x !== area) : [...a, area])}
                                    className={`px-3 py-1.5 rounded-xl text-sm transition-colors border ${
                                      sel ? 'bg-blue-600/30 border-blue-500 text-blue-300' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-blue-500/50'
                                    }`}>
                                    {area}
                                  </button>
                                );
                              })}
                            </div>
                            {selectedAreas.length > 0 && (
                              <p className="text-blue-400 text-sm">✅ تغطي {selectedAreas.length} حي</p>
                            )}
                            <button onClick={saveAreas} disabled={selectedAreas.length === 0 || saveMutation.isPending}
                              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-3 rounded-xl font-medium transition-colors">
                              حفظ مناطق الخدمة ←
                            </button>
                          </>
                        )}

                        {/* ── SERVICES ── */}
                        {card.id === 'services' && (
                          <>
                            <p className="text-slate-400 text-sm">خدماتك الافتراضية — عدّل الأسعار حسب رغبتك:</p>
                            <div className="space-y-3">
                              {services.map((svc, i) => (
                                <div key={i} className="bg-slate-800 rounded-xl p-3 flex gap-3 items-center">
                                  <input value={svc.name} onChange={e => setServices(s => s.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
                                    className="flex-1 bg-transparent text-white text-sm focus:outline-none" placeholder="اسم الخدمة" />
                                  <input type="number" value={svc.price} onChange={e => setServices(s => s.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                                    className="w-20 bg-slate-700 text-white text-sm rounded-lg px-2 py-1 text-center focus:outline-none" placeholder="السعر" />
                                  <span className="text-slate-400 text-xs">ر.س</span>
                                </div>
                              ))}
                            </div>
                            <button onClick={() => setServices(s => [...s, { name: '', price: '', duration: 60 }])}
                              className="w-full border border-dashed border-slate-600 text-slate-400 py-2 rounded-xl text-sm hover:border-blue-500 hover:text-blue-400 transition-colors">
                              + إضافة خدمة
                            </button>
                            <button onClick={saveServices}
                              className="w-full bg-orange-600 hover:bg-orange-700 text-white py-3 rounded-xl font-medium transition-colors">
                              إضافة الخدمات ←
                            </button>
                          </>
                        )}

                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>

        {/* Completion */}
        <AnimatePresence>
          {completedRequired && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-8 bg-gradient-to-l from-green-900/40 to-emerald-900/40 border border-green-500/40 rounded-2xl p-6 text-center"
            >
              <div className="text-4xl mb-3">🎉</div>
              <h2 className="text-xl font-black text-white mb-2">مغسلتك جاهزة!</h2>
              <p className="text-slate-400 text-sm mb-5">يمكنك الآن استقبال الحجوزات وإدارة فريقك</p>
              <Link to="/vendor"
                className="inline-block bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl font-bold transition-colors">
                اذهب للوحة التحكم →
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
