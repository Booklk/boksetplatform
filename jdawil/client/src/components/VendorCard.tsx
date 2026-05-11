import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Star, MapPin } from 'lucide-react';

interface Vendor {
  id: number;
  nameAr: string;
  slug?: string;
  logoUrl?: string;
  coverImageUrl?: string;
  primaryColor?: string;
  serviceAreas?: string[];
  rating?: number;
  reviewCount?: number;
}

interface VendorCardProps {
  vendor: Vendor;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className="w-3.5 h-3.5"
          style={{
            color: star <= Math.round(rating) ? '#f59e0b' : '#475569',
            fill: star <= Math.round(rating) ? '#f59e0b' : 'none',
          }}
        />
      ))}
    </div>
  );
}

export default function VendorCard({ vendor }: VendorCardProps) {
  const navigate = useNavigate();
  const areas = vendor.serviceAreas ?? [];
  const visibleAreas = areas.slice(0, 3);
  const extraCount = areas.length - 3;

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 300, damping: 22 }}
      className="bg-slate-900/80 backdrop-blur border border-slate-700/50 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-xl hover:border-slate-600/60 transition-shadow"
      onClick={() => navigate(`/store/${vendor.slug ?? vendor.id}`)}
      dir="rtl"
    >
      {/* Cover Image */}
      <div className="relative h-32 bg-slate-800 overflow-hidden">
        {vendor.coverImageUrl ? (
          <img
            src={vendor.coverImageUrl}
            alt=""
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            className="w-full h-full"
            style={{ background: `linear-gradient(135deg, ${vendor.primaryColor ?? '#3b82f6'}33, ${vendor.primaryColor ?? '#3b82f6'}11)` }}
          />
        )}

        {/* Logo circle overlapping cover */}
        <div className="absolute -bottom-6 right-4">
          <div className="w-14 h-14 rounded-full border-2 border-slate-800 overflow-hidden bg-slate-700 shadow-lg">
            {vendor.logoUrl ? (
              <img src={vendor.logoUrl} alt={vendor.nameAr} className="w-full h-full object-cover" />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-white font-bold text-lg"
                style={{ backgroundColor: vendor.primaryColor ?? '#3b82f6' }}
              >
                {vendor.nameAr.charAt(0)}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="pt-8 px-4 pb-4">
        <h3 className="text-white font-bold text-base mb-2">{vendor.nameAr}</h3>

        {/* Rating */}
        {vendor.rating !== undefined && (
          <div className="flex items-center gap-2 mb-3">
            <StarRating rating={vendor.rating} />
            <span className="text-slate-400 text-xs">
              {vendor.rating.toFixed(1)}
              {vendor.reviewCount !== undefined && (
                <span className="mr-1">({vendor.reviewCount.toLocaleString('ar-SA')})</span>
              )}
            </span>
          </div>
        )}

        {/* Service Areas */}
        {areas.length > 0 && (
          <div className="flex items-center flex-wrap gap-1.5 mb-4">
            <MapPin className="w-3 h-3 text-slate-500 shrink-0" />
            {visibleAreas.map((area) => (
              <span
                key={area}
                className="bg-slate-800 text-slate-400 text-xs px-2 py-0.5 rounded-lg border border-slate-700/50"
              >
                {area}
              </span>
            ))}
            {extraCount > 0 && (
              <span className="text-slate-500 text-xs">+{extraCount}</span>
            )}
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/store/${vendor.slug ?? vendor.id}`);
          }}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          احجز الآن
        </button>
      </div>
    </motion.div>
  );
}
