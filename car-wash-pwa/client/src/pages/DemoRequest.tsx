import { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { motion } from 'framer-motion';
import { useMutation } from '@tanstack/react-query';
import { Calendar, Phone, MessageCircle, CheckCircle2, Sparkles, ShieldCheck, Clock } from 'lucide-react';
import api from '../lib/api';
import MarketingLayout from '../components/marketing/MarketingLayout';
import { readAttribution } from '../lib/attribution';

const INDUSTRIES = [
  { id: 'car_wash', label: 'مغسلة سيارات' },
  { id: 'salon', label: 'صالون / حلاق' },
  { id: 'clinic', label: 'عيادة' },
  { id: 'spa', label: 'مركز سبا' },
  { id: 'beauty_home', label: 'تجميل منزلي' },
  { id: 'home_cleaning', label: 'تنظيف منازل' },
  { id: 'appliance_repair', label: 'صيانة أجهزة' },
  { id: 'ac_maintenance', label: 'صيانة مكيفات' },
  { id: 'plumbing', label: 'سباكة' },
  { id: 'electrical', label: 'كهرباء' },
  { id: 'professional_services', label: 'استشارات / محاماة' },
  { id: 'freelancer', label: 'فري لانسر' },
  { id: 'other', label: 'أخرى' },
];

const TIME_OPTIONS = [
  '8 صباحاً - 12 ظهراً',
  '12 ظهراً - 4 عصراً',
  '4 عصراً - 8 مساءً',
  '8 مساءً - 11 ليلاً',
];

export default function DemoRequest() {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [industry, setIndustry] = useState('');
  const [bestTime, setBestTime] = useState('');
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      const a = readAttribution();
      return (await api.post('/leads', {
        channel: 'demo',
        name: name.trim(),
        phone: phone.trim(),
        industry: industry || undefined,
        bestTimeToCall: bestTime || undefined,
        message: message.trim() || undefined,
        utm: a ? {
          source: a.utm.utm_source,
          medium: a.utm.utm_medium,
          campaign: a.utm.utm_campaign,
          term: a.utm.utm_term,
          content: a.utm.utm_content,
        } : undefined,
      })).data;
    },
    onSuccess: () => setSubmitted(true),
  });

  return (
    <MarketingLayout>
      <Helmet>
        <title>اطلب جلسة Demo — Jdawil</title>
        <meta name="description" content="جلسة 15 دقيقة عبر واتساب — نشرح لك كيف يصير Jdawil النظام الوحيد لإدارة مشروعك. مجاني، بدون التزام." />
        <meta property="og:title" content="اطلب جلسة Demo — Jdawil" />
        <meta property="og:description" content="جلسة 15 دقيقة + إعداد متجرك خلال الجلسة." />
        <link rel="canonical" href="https://jdawil.sa/demo-request" />
      </Helmet>

      <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white pt-12 pb-20 px-4">
        <div className="max-w-3xl mx-auto">
          {!submitted ? (
            <>
              <div className="text-center mb-10">
                <span className="inline-flex items-center gap-1 bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-3 py-1 text-xs font-bold mb-4">
                  <Sparkles className="w-3.5 h-3.5" /> 15 دقيقة + إعداد متجرك
                </span>
                <h1 className="text-3xl sm:text-5xl font-black mb-4 leading-tight">
                  اطلب جلسة Demo —<br />نخليك جاهز لاستقبال أول حجز
                </h1>
                <p className="text-slate-400 max-w-xl mx-auto leading-relaxed">
                  مكالمة قصيرة عبر واتساب، نتعرّف على نشاطك، ونعدّ لك متجرك الإلكتروني خلال الجلسة نفسها.
                  بدون التزام، بدون بطاقة ائتمانية.
                </p>
              </div>

              <motion.form
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onSubmit={(e) => { e.preventDefault(); name && phone && submit.mutate(); }}
                className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-7"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">اسمك *</label>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="أبو فهد"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5">جوالك *</label>
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05xxxxxxxx"
                      dir="ltr"
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500/60"
                    />
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1.5">نشاطك</label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm"
                  >
                    <option value="">اختر القطاع</option>
                    {INDUSTRIES.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
                  </select>
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1.5">أفضل وقت للاتصال</label>
                  <div className="grid grid-cols-2 gap-2">
                    {TIME_OPTIONS.map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setBestTime(t)}
                        className={`p-2.5 rounded-xl border-2 text-xs font-bold transition-colors ${
                          bestTime === t
                            ? 'border-emerald-500 bg-emerald-500/10 text-white'
                            : 'border-white/10 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3">
                  <label className="block text-xs text-slate-400 mb-1.5">سؤال محدد (اختياري)</label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    maxLength={1000}
                    rows={3}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-emerald-500/60 resize-none"
                    placeholder="مثلاً: عندي 3 موظفين متنقلين، كيف يشتغل GPS؟"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!name || !phone || submit.isPending}
                  className="w-full mt-5 bg-gradient-to-l from-emerald-500 to-emerald-400 hover:opacity-90 text-white font-black py-3.5 rounded-xl text-base disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Calendar className="w-4 h-4" />
                  {submit.isPending ? 'جاري الإرسال…' : 'احجز جلستي مجاناً'}
                </button>

                <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 mt-4 text-[11px] text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> 15 دقيقة فقط</span>
                  <span className="flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> بياناتك سرّية</span>
                  <span className="flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-emerald-400" /> بدون التزام</span>
                </div>
              </motion.form>

              {/* Alternative: direct WhatsApp */}
              <div className="text-center mt-8">
                <p className="text-slate-500 text-sm mb-3">أو تواصل مباشرة:</p>
                <a
                  href="https://wa.me/966500000000?text=مرحباً،%20أبي%20جلسة%20Demo"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-5 py-3 rounded-xl"
                >
                  <MessageCircle className="w-4 h-4" />
                  واتساب فريق المبيعات
                </a>
              </div>
            </>
          ) : (
            // Success state
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-12"
            >
              <div className="inline-flex w-20 h-20 rounded-3xl bg-emerald-500/15 border border-emerald-500/30 items-center justify-center mb-6">
                <CheckCircle2 className="w-10 h-10 text-emerald-300" />
              </div>
              <h2 className="text-3xl sm:text-4xl font-black mb-3">استلمنا طلبك! 🎉</h2>
              <p className="text-slate-300 text-base sm:text-lg max-w-md mx-auto leading-relaxed mb-2">
                سنتواصل معك على <span className="font-bold text-white">{phone}</span>
                {bestTime && <> في وقت <span className="font-bold text-white">{bestTime}</span></>}.
              </p>
              <p className="text-slate-500 text-sm mb-8">عادة نرد خلال ساعتين عمل.</p>
              <a
                href="/onboard"
                className="inline-flex items-center gap-2 bg-white text-[#0b1220] font-bold px-5 py-3 rounded-xl"
              >
                ابدأ بنفسك الآن — لا تنتظر
                <Sparkles className="w-4 h-4" />
              </a>
            </motion.div>
          )}
        </div>
      </div>
    </MarketingLayout>
  );
}
