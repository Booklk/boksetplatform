// A compact checklist widget shown in Dashboard until 100% complete
// After 100%, it collapses and shows a "🎉 إعداد متجرك مكتمل" badge

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export default function SetupChecklist() {
  const [expanded, setExpanded] = useState(true);

  const { data } = useQuery({
    queryKey: ['setup-checklist'],
    queryFn: () => api.get('/vendors/setup-checklist').then(r => r.data),
    staleTime: 30000,
  });

  if (!data || data.isComplete) return null; // Hide when done

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
      className="mb-6 rounded-2xl border border-blue-500/20 bg-gradient-to-l from-blue-950/40 to-slate-900/60 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 text-right"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/20 flex items-center justify-center">
            <Zap size={16} className="text-blue-400" />
          </div>
          <div>
            <div className="text-white font-bold text-sm">إعداد متجرك</div>
            <div className="text-slate-400 text-xs">{data.completedCount} من {data.totalSteps} خطوات مكتملة</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Progress bar */}
          <div className="w-24 h-1.5 bg-slate-700 rounded-full overflow-hidden">
            <motion.div
              animate={{ width: `${data.percent}%` }}
              className="h-full bg-gradient-to-l from-blue-500 to-cyan-400 rounded-full"
            />
          </div>
          <span className="text-blue-400 font-bold text-sm">{data.percent}%</span>
          {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Steps */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4 space-y-2">
              {data.steps.map((step: any) => (
                <Link
                  key={step.id}
                  to={step.done ? '#' : step.path}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                    step.done
                      ? 'opacity-50 cursor-default'
                      : 'bg-white/5 hover:bg-white/10 cursor-pointer border border-white/5'
                  }`}
                >
                  {step.done
                    ? <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0" />
                    : <Circle size={18} className="text-slate-500 flex-shrink-0" />
                  }
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${step.done ? 'text-slate-500 line-through' : 'text-white'}`}>
                      {step.label}
                    </div>
                    {!step.done && <div className="text-xs text-slate-500">{step.desc}</div>}
                  </div>
                  {!step.done && <span className="text-blue-400 text-xs flex-shrink-0">ابدأ ←</span>}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
