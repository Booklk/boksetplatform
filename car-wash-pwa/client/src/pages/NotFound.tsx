import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Home, ArrowRight, Search } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-1 p-6" dir="rtl">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="text-center space-y-8 max-w-md"
      >
        {/* Animated 404 */}
        <div className="relative">
          <motion.div
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
            className="text-[120px] font-black text-slate-800 leading-none select-none"
          >
            404
          </motion.div>
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Search className="w-16 h-16 text-blue-400/60" />
            </motion.div>
          </div>
        </div>

        <div className="space-y-3">
          <h1 className="text-2xl font-bold text-white">الصفحة غ��ر موجودة</h1>
          <p className="text-slate-400 leading-relaxed">
            عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-l from-blue-700 to-blue-600 text-white font-bold hover:from-blue-600 hover:to-blue-500 transition-all"
          >
            <Home className="w-4 h-4" />
            العودة للرئيسية
          </Link>
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-slate-700 text-slate-300 font-bold hover:bg-slate-800 transition-all"
          >
            <ArrowRight className="w-4 h-4" />
            الصفحة السابقة
          </button>
        </div>
      </motion.div>
    </div>
  );
}
