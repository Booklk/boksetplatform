/**
 * CorporateStrip — trust strip for B2B templates.
 * Renders on /store/:slug when the vendor's template has
 * features.b2b set. Shows an "عملاء الشركات يثقون بنا" counter,
 * key differentiators, and a prominent quote-request CTA.
 *
 * Kept content-only (no logo grid) for now since the list of real
 * clients isn't data the platform collects yet — vendors can add
 * logos later via settings.corporateClients[].
 */

import { Building2, ShieldCheck, Receipt, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import { CustomTheme, RADIUS_VALUES } from '../../lib/customTheme';

export default function CorporateStrip({
  whatsappUrl,
  customTheme,
}: {
  whatsappUrl: string;
  customTheme: CustomTheme;
}) {
  const radius = RADIUS_VALUES[customTheme.radius];
  const quoteUrl = `${whatsappUrl}${whatsappUrl.includes('?') ? '&' : '?'}text=${encodeURIComponent('مرحباً، نحن شركة ونبحث عن مزوّد خدمة معتمد — نرجو التواصل لمناقشة عقد.')}`;

  const stats = [
    { icon: Building2, label: 'خدمة شركات معتمدة' },
    { icon: Receipt, label: 'فواتير ضريبية ١٥٪' },
    { icon: ShieldCheck, label: 'عقود شهرية وسنوية' },
    { icon: Users, label: 'فرق عمل مدرّبة' },
  ];

  return (
    <section className="max-w-5xl mx-auto px-5 py-10" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="p-6 sm:p-8 border"
        style={{
          background: customTheme.surface,
          borderColor: `${customTheme.accent}33`,
          borderRadius: radius,
        }}
      >
        <div className="grid md:grid-cols-[1.2fr_1fr] gap-6 items-center">
          {/* Left: headline + stats */}
          <div>
            <span
              className="inline-block px-2.5 py-1 text-[10px] font-bold tracking-widest uppercase mb-3 border"
              style={{
                color: customTheme.accent,
                borderColor: `${customTheme.accent}44`,
                borderRadius: customTheme.radius === 'pill' ? '9999px' : '4px',
              }}
            >
              للشركات والمنشآت
            </span>
            <h2 className="text-xl sm:text-2xl font-black mb-4 leading-snug" style={{ color: customTheme.text }}>
              نخدم الشركات بعقود مرنة — اطلب عرض سعر مخصّص اليوم
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {stats.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-2.5 p-3 border"
                  style={{
                    background: `${customTheme.bg}66`,
                    borderColor: `${customTheme.accent}1a`,
                    borderRadius: radius,
                  }}
                >
                  <Icon size={16} style={{ color: customTheme.accent }} className="shrink-0" />
                  <span className="text-xs font-bold" style={{ color: customTheme.text }}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: quote CTA card */}
          <div
            className="p-5 border text-center"
            style={{
              background: `${customTheme.accent}12`,
              borderColor: `${customTheme.accent}33`,
              borderRadius: radius,
            }}
          >
            <p className="text-xs font-bold opacity-80 mb-2" style={{ color: customTheme.text }}>
              عرض سعر خاص للشركات
            </p>
            <p className="text-sm mb-4 opacity-70 leading-relaxed" style={{ color: customTheme.text }}>
              أرسل تفاصيل منشأتك واستلم عرضاً مفصّلاً خلال ساعات
            </p>
            <a
              href={quoteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full py-3 font-black text-white text-sm transition-opacity hover:opacity-90"
              style={{ background: customTheme.button, borderRadius: radius }}
            >
              اطلب عرض سعر
            </a>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
