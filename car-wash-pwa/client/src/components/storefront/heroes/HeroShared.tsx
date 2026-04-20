/**
 * Shared hero building blocks — feature badges, CTA row, meta row.
 * Keeps each variant file focused on its unique layout.
 */

import { MapPin, MessageCircle, Phone, Ticket } from 'lucide-react';
import { CustomTheme, RADIUS_VALUES } from '../../../lib/customTheme';
import { ThemeFeatures } from '../../../lib/storeThemes';
import { StorefrontSections } from './StorefrontHero';

export function FeatureBadges({
  features,
  accent,
}: {
  features: ThemeFeatures;
  accent: string;
}) {
  const items: { icon?: string; text: string; key: string }[] = [];
  if (features.gps) items.push({ icon: '📍', text: 'تتبّع مباشر للموظف', key: 'gps' });
  if (features.privacy) items.push({ icon: '🔒', text: 'سرّية تامّة', key: 'privacy' });
  if (features.b2b) items.push({ icon: '🏢', text: 'عقود شركات متاحة', key: 'b2b' });
  if (features.queue) items.push({ icon: '🎫', text: 'طابور رقمي', key: 'queue' });
  if (features.gallery) items.push({ icon: '📸', text: 'معرض أعمال', key: 'gallery' });
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {items.map((b) => (
        <span
          key={b.key}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border"
          style={{ background: `${accent}15`, borderColor: `${accent}40`, color: accent }}
        >
          <span>{b.icon}</span>
          {b.text}
        </span>
      ))}
    </div>
  );
}

export function HeroCTAs({
  customTheme,
  features,
  sections,
  whatsappUrl,
  callUrl,
  layout = 'horizontal',
}: {
  customTheme: CustomTheme;
  features: ThemeFeatures;
  sections: StorefrontSections;
  whatsappUrl: string;
  callUrl: string;
  /** "horizontal" = row, "stacked" = column on mobile, row on desktop */
  layout?: 'horizontal' | 'stacked';
}) {
  const radius = RADIUS_VALUES[customTheme.radius];
  const quoteWhatsapp = `${whatsappUrl}${whatsappUrl.includes('?') ? '&' : '?'}text=${encodeURIComponent('مرحباً، أرغب في طلب عرض سعر لخدمتكم — ')}`;

  const primaryStyle = { background: customTheme.button, borderRadius: radius, color: '#fff' };
  const secondaryStyle = {
    background: 'transparent',
    border: `1px solid ${customTheme.accent}55`,
    color: customTheme.accent,
    borderRadius: radius,
  };
  const ghostStyle = {
    background: `${customTheme.surface}`,
    border: `1px solid ${customTheme.text}15`,
    color: customTheme.text,
    borderRadius: radius,
  };

  return (
    <div className={`flex gap-3 flex-wrap ${layout === 'stacked' ? 'flex-col sm:flex-row' : ''}`}>
      {features.quote && (
        <a
          href={quoteWhatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-black transition-all active:scale-95 hover:opacity-90"
          style={primaryStyle}
        >
          <MessageCircle size={15} />
          اطلب عرض سعر
        </a>
      )}
      {sections.showSlots !== false && !features.quote && (
        <a
          href="#book"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-black transition-all active:scale-95 hover:opacity-90"
          style={primaryStyle}
        >
          <Ticket size={15} />
          احجز موعدك الآن
        </a>
      )}
      {sections.showWhatsApp !== false && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-all active:scale-95 hover:opacity-90"
          style={features.quote || !sections.showSlots ? secondaryStyle : ghostStyle}
        >
          <MessageCircle size={15} />
          تواصل معنا
        </a>
      )}
      {sections.showCallButton !== false && (
        <a
          href={callUrl}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold transition-all active:scale-95 hover:opacity-90"
          style={ghostStyle}
        >
          <Phone size={15} />
          اتصال
        </a>
      )}
    </div>
  );
}

export function HeroLogo({
  vendor,
  customTheme,
  size = 'md',
}: {
  vendor: { logoUrl?: string | null; nameAr: string };
  customTheme: CustomTheme;
  size?: 'sm' | 'md' | 'lg';
}) {
  const sizeClass = size === 'lg' ? 'w-24 h-24' : size === 'sm' ? 'w-14 h-14' : 'w-20 h-20';
  const textSize = size === 'lg' ? 'text-4xl' : size === 'sm' ? 'text-xl' : 'text-3xl';
  const radius = customTheme.radius === 'pill' ? '9999px'
    : customTheme.radius === 'square' ? '8px'
    : '16px';

  if (vendor.logoUrl) {
    return (
      <div
        className={`${sizeClass} overflow-hidden shrink-0 shadow-lg`}
        style={{ borderRadius: radius, border: `2px solid ${customTheme.accent}40`, background: customTheme.surface }}
      >
        <img src={vendor.logoUrl} alt={vendor.nameAr} className="w-full h-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`${sizeClass} flex items-center justify-center font-black shrink-0 shadow-lg`}
      style={{
        borderRadius: radius,
        background: customTheme.surface,
        border: `2px solid ${customTheme.accent}40`,
        color: customTheme.accent,
      }}
    >
      <span className={textSize}>{vendor.nameAr.charAt(0)}</span>
    </div>
  );
}

export function MetaRow({
  vendor,
  customTheme,
  sections,
  ratingNode,
}: {
  vendor: { city?: string | null };
  customTheme: CustomTheme;
  sections: StorefrontSections;
  ratingNode?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      {sections.showRating !== false && ratingNode}
      {vendor.city && (
        <span className="flex items-center gap-1.5 text-sm opacity-70" style={{ color: customTheme.text }}>
          <MapPin size={13} className="opacity-70" />
          {vendor.city}
        </span>
      )}
    </div>
  );
}
