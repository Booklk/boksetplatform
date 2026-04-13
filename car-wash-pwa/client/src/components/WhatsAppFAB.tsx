import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageCircle } from 'lucide-react';

const WHATSAPP_NUMBER = '966500000000';

export default function WhatsAppFAB() {
  const [expanded, setExpanded] = useState(false);

  const options = [
    { label: 'سؤال عن الاشتراك', msg: 'مرحباً، لدي سؤال حول اشتراك Bokset' },
    { label: 'مشكلة تقنية', msg: 'مرحباً، أحتاج مساعدة تقنية في Bokset' },
    { label: 'طلب عرض', msg: 'مرحباً، أريد طلب عرض سعر لـ Bokset' },
  ];

  return (
    <div className="fixed bottom-6 left-4 z-50 flex flex-col items-start gap-2" dir="rtl">
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="flex flex-col gap-2 mb-1"
          >
            {options.map((opt) => (
              <a
                key={opt.label}
                href={`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(opt.msg)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setExpanded(false)}
                className="bg-slate-800 border border-slate-700/60 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                {opt.label}
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => setExpanded(v => !v)}
        whileTap={{ scale: 0.93 }}
        className={`w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all ${
          expanded ? 'bg-slate-700' : 'bg-[#25D366] hover:bg-[#20c05c]'
        }`}
        title="تواصل معنا على واتساب"
      >
        <AnimatePresence mode="wait">
          {expanded ? (
            <motion.span key="x" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6 text-white" />
            </motion.span>
          ) : (
            <motion.span key="wa" initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }}>
              <MessageCircle className="w-6 h-6 text-white" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </div>
  );
}
