import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Lock, ArrowUpRight } from 'lucide-react';
import { useFeature } from '../hooks/useFeature';
import { FEATURE_REGISTRY } from '../lib/features';

interface Props {
  featureId: string;
  children: React.ReactNode;
}

/**
 * Wraps a page/component. If the vendor's plan doesn't include this feature,
 * shows an upgrade screen instead of the content.
 *
 * Usage:
 *   <UpgradeGate featureId="pos">
 *     <POSPage />
 *   </UpgradeGate>
 */
export default function UpgradeGate({ featureId, children }: Props) {
  const { hasFeature, isLoading, planNameAr } = useFeature(featureId);

  if (isLoading) return null;
  if (hasFeature) return <>{children}</>;

  const feature = FEATURE_REGISTRY.find(f => f.id === featureId);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-md"
      >
        <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
          <Lock className="w-8 h-8 text-indigo-400" />
        </div>

        <h2 className="text-2xl font-black text-white mb-2">
          {feature?.nameAr ?? 'هذه الميزة'} غير متاحة في باقتك
        </h2>

        <p className="text-slate-500 text-sm leading-relaxed mb-6">
          {feature?.description ?? 'هذه الميزة تحتاج ترقية باقتك.'}
          <br />
          <span className="text-slate-600">باقتك الحالية: {planNameAr}</span>
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/vendor/platform-sub"
            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <ArrowUpRight className="w-4 h-4" />
            ترقية الباقة
          </Link>
          <Link
            to="/vendor"
            className="bg-white/[0.05] border border-white/[0.08] text-slate-300 font-bold px-6 py-3 rounded-xl transition-colors"
          >
            العودة للوحة التحكم
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
