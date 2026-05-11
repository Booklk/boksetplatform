/**
 * Wraps a page that requires a paid add-on. If the vendor doesn't have it
 * active, renders a friendly upgrade card linking to /vendor/addons instead
 * of the page contents.
 *
 * Usage:
 *   <AddonGate addonId="ai_bot">
 *     <WhatsAppBotPage />
 *   </AddonGate>
 */
import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Lock, Loader2 } from 'lucide-react';
import api from '../lib/api';

interface Addon {
  id: string;
  nameAr: string;
  descriptionAr: string;
  priceSar: number;
  features: string[];
  active: boolean;
}

interface AddonsResponse {
  active: string[];
  catalog: Addon[];
}

export function AddonGate({ addonId, children }: { addonId: string; children: ReactNode }) {
  const { data, isLoading } = useQuery<AddonsResponse>({
    queryKey: ['addons-me'],
    queryFn: () => api.get('/addons/me').then((r) => r.data),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="animate-spin text-orange-400" />
      </div>
    );
  }

  const addon = data?.catalog.find((a) => a.id === addonId);
  // GPS pro covers GPS basic
  const hasIt = data?.active.includes(addonId)
    || (addonId === 'gps_basic' && data?.active.includes('gps_pro'));

  if (hasIt) return <>{children}</>;
  if (!addon) return <>{children}</>; // unknown addon — fail open

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-12" dir="rtl">
      <div className="max-w-lg w-full">
        <div className="rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/5 to-transparent p-8 text-center">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-orange-500/15 items-center justify-center mb-4">
            <Lock size={24} className="text-orange-400" />
          </div>
          <h1 className="text-xl font-black text-white mb-2">{addon.nameAr}</h1>
          <p className="text-slate-400 text-sm leading-relaxed mb-6">{addon.descriptionAr}</p>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4 mb-6">
            <div className="text-3xl font-black text-orange-400 mb-1">
              {addon.priceSar} <span className="text-sm text-slate-500 font-normal">ر.س / شهر</span>
            </div>
            <p className="text-[11px] text-slate-500">قابل للإلغاء في أي وقت</p>
          </div>

          {addon.features.length > 0 && (
            <ul className="text-right space-y-2 mb-6">
              {addon.features.slice(0, 4).map((f) => (
                <li key={f} className="flex items-start gap-2 text-xs text-slate-300">
                  <Sparkles size={12} className="text-orange-400 flex-shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          )}

          <Link
            to="/vendor/addons"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white font-black px-6 py-3 rounded-xl text-sm transition-colors"
          >
            <Sparkles size={14} />
            فعّل الإضافة الآن
          </Link>
        </div>
      </div>
    </div>
  );
}
