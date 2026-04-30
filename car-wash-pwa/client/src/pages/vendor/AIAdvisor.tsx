import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Brain, Sparkles, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle, Lightbulb, ArrowUpRight, ArrowDownRight,
  Zap, Target, BarChart3, RefreshCw, ChevronLeft, Shield,
  Clock, Users, DollarSign, Activity,
} from 'lucide-react';
import api from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { Link } from 'react-router-dom';
import AIAgentChat from '../../components/vendor/AIAgentChat';

interface Insight {
  type: 'positive' | 'warning' | 'critical' | 'tip';
  title: string;
  detail: string;
}

interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  action: string;
  expectedImpact: string;
}

interface Forecast {
  nextMonthRevenue: number;
  trend: 'growing' | 'stable' | 'declining';
  trendLabel: string;
}

interface Analysis {
  healthScore: number;
  summary: string;
  insights: Insight[];
  recommendations: Recommendation[];
  forecast: Forecast;
}

interface AdvisorResponse {
  analysis: Analysis;
  data: {
    thisMonth: { totalBookings: number; revenue: number; avgRating: number; cancellationRate: string };
    lastMonth: { totalBookings: number; revenue: number };
    customers: { total: number };
    profitMargin: string | null;
  };
  generatedAt: string;
}

const insightIcons: Record<string, React.ElementType> = {
  positive: CheckCircle,
  warning: AlertTriangle,
  critical: Shield,
  tip: Lightbulb,
};

const insightColors: Record<string, string> = {
  positive: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  warning: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  critical: 'text-red-400 bg-red-500/10 border-red-500/20',
  tip: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
};

const priorityColors: Record<string, string> = {
  high: 'bg-red-500/10 text-red-400 border-red-500/20',
  medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const priorityLabels: Record<string, string> = {
  high: 'عاجل',
  medium: 'متوسط',
  low: 'اختياري',
};

function HealthScoreRing({ score }: { score: number }) {
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : score >= 40 ? '#f97316' : '#ef4444';

  return (
    <div className="relative w-36 h-36 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none" stroke={color} strokeWidth="8"
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          strokeDasharray={circumference}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, type: 'spring' }}
          className="text-3xl font-black text-white"
        >
          {score}
        </motion.span>
        <span className="text-xs text-slate-400">من 100</span>
      </div>
    </div>
  );
}

function PulsingDot() {
  return (
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
    </span>
  );
}

export default function AIAdvisor() {
  const { user } = useAuth();
  const [result, setResult] = useState<AdvisorResponse | null>(null);

  const analyzeMutation = useMutation({
    mutationFn: () => api.post('/ai-advisor/analyze').then(r => r.data),
    onSuccess: (data) => setResult(data),
  });

  const { data: quickStats } = useQuery({
    queryKey: ['ai-advisor-stats'],
    queryFn: () => api.get('/ai-advisor/quick-stats').then(r => r.data),
  });

  const analysis = result?.analysis;
  const businessData = result?.data;

  return (
    <div className="min-h-screen bg-surface-1 bg-mesh-dashboard" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 glass-premium border-b border-white/[0.06]">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/vendor" className="btn-icon">
              <ChevronLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black text-white flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" />
                المستشار الذكي
              </h1>
              <p className="text-xs text-slate-500">تحليل ذكي لأعمالك بالذكاء الاصطناعي</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PulsingDot />
            <span className="text-xs text-slate-500">AI</span>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* AI Agent Chat — industry-specialised advisor */}
        <AIAgentChat />

        {/* Quick Stats Overview */}
        {quickStats && !analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3"
          >
            {[
              { icon: BarChart3, label: 'حجوزات الشهر', value: quickStats.thisMonth?.totalBookings ?? 0, color: 'text-blue-400' },
              { icon: DollarSign, label: 'إيرادات الشهر', value: `${(quickStats.thisMonth?.revenue ?? 0).toFixed(0)} ر.س`, color: 'text-emerald-400' },
              { icon: Users, label: 'إجمالي العملاء', value: quickStats.customers?.total ?? 0, color: 'text-purple-400' },
              { icon: Activity, label: 'هامش الربح', value: quickStats.profitMargin ? `${quickStats.profitMargin}%` : 'N/A', color: 'text-amber-400' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                className="card-glass p-4"
              >
                <stat.icon className={`w-5 h-5 ${stat.color} mb-2`} />
                <div className="text-xl font-black text-white tabular-nums">{stat.value}</div>
                <div className="text-xs text-slate-500 mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        )}

        {/* Analyze CTA */}
        {!analysis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="card-glass p-8 text-center"
          >
            <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 border border-blue-500/20 flex items-center justify-center">
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Sparkles className="w-10 h-10 text-blue-400" />
              </motion.div>
            </div>
            <h2 className="text-2xl font-black text-white mb-3">حلّل أعمالك بالذكاء الاصطناعي</h2>
            <p className="text-slate-400 max-w-lg mx-auto mb-8 leading-relaxed">
              سيحلل المستشار الذكي بيانات متجرك — الإيرادات، العملاء، المخزون، الأداء — ويقدم لك
              توصيات عملية مخصصة لتنمية أعمالك.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => analyzeMutation.mutate()}
              disabled={analyzeMutation.isPending}
              className="btn-primary text-lg px-10 py-4 mx-auto flex items-center gap-3"
            >
              {analyzeMutation.isPending ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  جاري التحليل...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  ابدأ التحليل الذكي
                </>
              )}
            </motion.button>
            {analyzeMutation.isError && (
              <p className="text-red-400 text-sm mt-4">
                {(analyzeMutation.error as any)?.response?.data?.error ?? 'حدث خطأ. حاول مجدداً'}
              </p>
            )}
          </motion.div>
        )}

        {/* Analysis Results */}
        <AnimatePresence>
          {analysis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-6"
            >
              {/* Health Score + Summary */}
              <div className="grid md:grid-cols-3 gap-4">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="card-glass p-6 text-center"
                >
                  <p className="text-sm text-slate-400 mb-4">صحة العمل</p>
                  <HealthScoreRing score={analysis.healthScore ?? 0} />
                  <p className="text-sm text-slate-400 mt-3">
                    {(analysis.healthScore ?? 0) >= 80 ? 'ممتاز' : (analysis.healthScore ?? 0) >= 60 ? 'جيد' : 'يحتاج تحسين'}
                  </p>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="md:col-span-2 card-glass p-6"
                >
                  <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-blue-400" />
                    الملخص التنفيذي
                  </h3>
                  <p className="text-slate-300 leading-relaxed text-base">{analysis.summary}</p>

                  {/* Forecast */}
                  {analysis.forecast && (
                    <div className="mt-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                      <div className="flex items-center gap-3">
                        {analysis.forecast.trend === 'growing' && <ArrowUpRight className="w-5 h-5 text-emerald-400" />}
                        {analysis.forecast.trend === 'declining' && <ArrowDownRight className="w-5 h-5 text-red-400" />}
                        {analysis.forecast.trend === 'stable' && <TrendingUp className="w-5 h-5 text-blue-400" />}
                        <div>
                          <p className="text-sm text-slate-400">توقعات الشهر القادم</p>
                          <p className="text-xl font-black text-white tabular-nums">
                            {(analysis.forecast.nextMonthRevenue ?? 0).toLocaleString('ar-SA')} ر.س
                          </p>
                        </div>
                        <span className={`mr-auto text-xs px-3 py-1 rounded-full ${
                          analysis.forecast.trend === 'growing' ? 'bg-emerald-500/10 text-emerald-400' :
                          analysis.forecast.trend === 'declining' ? 'bg-red-500/10 text-red-400' :
                          'bg-blue-500/10 text-blue-400'
                        }`}>
                          {analysis.forecast.trendLabel}
                        </span>
                      </div>
                    </div>
                  )}
                </motion.div>
              </div>

              {/* Insights */}
              {analysis.insights?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="card-glass p-6"
                >
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-400" />
                    رؤى وتحليلات
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {analysis.insights.map((insight, i) => {
                      const Icon = insightIcons[insight.type] ?? Lightbulb;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.3 + i * 0.08 }}
                          className={`p-4 rounded-xl border ${insightColors[insight.type] ?? insightColors.tip}`}
                        >
                          <div className="flex items-start gap-3">
                            <Icon className="w-5 h-5 mt-0.5 shrink-0" />
                            <div>
                              <p className="font-bold text-white text-sm">{insight.title}</p>
                              <p className="text-sm text-slate-400 mt-1 leading-relaxed">{insight.detail}</p>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>
              )}

              {/* Recommendations */}
              {analysis.recommendations?.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="card-glass p-6"
                >
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-purple-400" />
                    توصيات عملية
                  </h3>
                  <div className="space-y-3">
                    {analysis.recommendations.map((rec, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <span className={`text-xs px-2.5 py-1 rounded-full border font-bold shrink-0 ${priorityColors[rec.priority] ?? priorityColors.medium}`}>
                            {priorityLabels[rec.priority] ?? rec.priority}
                          </span>
                          <div className="flex-1">
                            <p className="font-bold text-white text-sm">{rec.action}</p>
                            <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                              <ArrowUpRight className="w-3 h-3" />
                              {rec.expectedImpact}
                            </p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Re-analyze button */}
              <div className="text-center pb-6">
                <button
                  onClick={() => { setResult(null); analyzeMutation.reset(); }}
                  className="btn-ghost text-sm"
                >
                  <RefreshCw className="w-4 h-4 inline ml-1" />
                  تحليل جديد
                </button>
                {result?.generatedAt && (
                  <p className="text-xs text-slate-600 mt-2">
                    آخر تحليل: {new Date(result.generatedAt).toLocaleString('ar-SA')}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
