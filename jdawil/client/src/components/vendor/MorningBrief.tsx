/**
 * MorningBrief — AI-generated daily summary hero card.
 *
 * The single piece of content the vendor sees when opening the dashboard.
 * Shows: greeting, narrative paragraph, headline (up/down/flat/milestone),
 * yesterday-vs-baseline metrics, and up to 3 actionable suggestions.
 *
 * Data lives behind React Query so page refresh + real-time booking
 * events both trigger a refresh automatically.
 */

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Sparkles, TrendingUp, TrendingDown, Minus, Trophy,
  Send, ArrowLeft,
} from 'lucide-react';
import api from '../../lib/api';
import { Card, Skeleton } from '../ui';
import { fadeInUp, staggerContainer, springs } from '../../design/motion';

interface Brief {
  greeting: string;
  narrative: string;
  headline: { kind: 'up' | 'down' | 'flat' | 'milestone'; text: string };
  metrics: {
    yesterdayBookings: number;
    yesterdayRevenue: number;
    avg7dBookings: number;
    avg7dRevenue: number;
    revenueDeltaPct: number;
  };
  actions: Array<{
    kind: string;
    title: string;
    hint: string;
  }>;
  milestones: string[];
  generatedAt: string;
}

const headlineIcon = {
  up:        { Icon: TrendingUp,   tint: 'text-success-300', bg: 'bg-success-500/10', border: 'border-success-500/20' },
  down:      { Icon: TrendingDown, tint: 'text-danger-300',  bg: 'bg-danger-500/10',  border: 'border-danger-500/20' },
  flat:      { Icon: Minus,        tint: 'text-ink-300',     bg: 'bg-white/[0.04]',   border: 'border-white/[0.08]' },
  milestone: { Icon: Trophy,       tint: 'text-warn-300',    bg: 'bg-warn-500/10',    border: 'border-warn-500/20' },
};

export default function MorningBrief() {
  const { data, isLoading, isError } = useQuery<Brief>({
    queryKey: ['daily-brief'],
    queryFn: async () => (await api.get('/insights/daily')).data,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <Card variant="elevated" padding="lg" className="mb-6">
        <Skeleton className="h-4 w-32 mb-3" />
        <Skeleton className="h-5 w-3/4 mb-2" />
        <Skeleton className="h-4 w-2/3" />
      </Card>
    );
  }
  if (isError || !data) return null;

  const cfg = headlineIcon[data.headline.kind];
  const Icon = cfg.Icon;

  return (
    <motion.div
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      className="mb-6"
    >
      <Card
        variant="elevated"
        padding="lg"
        className="relative overflow-hidden bg-gradient-to-br from-white/[0.04] via-primary-500/[0.04] to-white/[0.02] border-white/[0.08]"
      >
        {/* Subtle shimmer orb */}
        <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-primary-500/10 blur-3xl pointer-events-none" />

        <div className="relative">
          <div className="flex items-center gap-2 mb-1 text-xs font-bold text-primary-300">
            <Sparkles size={12} />
            {data.greeting}
          </div>

          {/* Headline */}
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${cfg.bg} ${cfg.border} mb-3`}>
            <Icon size={13} className={cfg.tint} />
            <span className={`text-[11px] font-black ${cfg.tint}`}>
              {data.headline.text}
            </span>
          </div>

          {/* Narrative */}
          <p className="text-base sm:text-lg text-white font-bold leading-relaxed mb-4 max-w-2xl">
            {data.narrative}
          </p>

          {/* Metric strip */}
          <motion.div
            className="flex items-center gap-5 mb-5 flex-wrap"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            <motion.div variants={fadeInUp}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">حجوزات أمس</p>
              <p className="text-2xl font-black text-white tabular-nums">
                {data.metrics.yesterdayBookings}
              </p>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">إيراد أمس</p>
              <p className="text-2xl font-black text-white tabular-nums">
                {data.metrics.yesterdayRevenue.toLocaleString('ar-SA')}
                <span className="text-sm text-ink-400 font-bold"> ر.س</span>
              </p>
            </motion.div>
            <motion.div variants={fadeInUp}>
              <p className="text-[10px] font-bold uppercase tracking-wider text-ink-500">مقارنة بالمتوسط</p>
              <p className={`text-2xl font-black tabular-nums ${
                data.metrics.revenueDeltaPct >= 0 ? 'text-success-300' : 'text-danger-300'
              }`}>
                {data.metrics.revenueDeltaPct >= 0 ? '+' : ''}{data.metrics.revenueDeltaPct}%
              </p>
            </motion.div>
          </motion.div>

          {/* Actions */}
          {data.actions.length > 0 && (
            <div className="space-y-1.5">
              {data.actions.map((a, i) => (
                <motion.button
                  key={i}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: 0.1 + i * 0.05 }}
                  className="group w-full text-right flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-primary-500/30 transition-all"
                >
                  <div className="flex items-start gap-2 min-w-0">
                    <div className="shrink-0 w-8 h-8 rounded-lg bg-primary-500/10 border border-primary-500/20 flex items-center justify-center">
                      <Send size={13} className="text-primary-400" />
                    </div>
                    <div className="text-right min-w-0">
                      <p className="text-sm font-bold text-white">{a.title}</p>
                      <p className="text-[11px] text-ink-400 mt-0.5 leading-relaxed">{a.hint}</p>
                    </div>
                  </div>
                  <ArrowLeft size={14} className="text-ink-500 group-hover:text-primary-400 group-hover:-translate-x-1 transition-all shrink-0" />
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </motion.div>
  );
}
