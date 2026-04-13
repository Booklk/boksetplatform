import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Lock, Trophy } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../../hooks/useAuth';

// ─── Achievement definitions ─────────────────────────────────────────────────

interface AchievementDef {
  id: string;
  emoji: string;
  title: string;
  description: string;
  points: number;
  category: 'starter' | 'enthusiast' | 'vip' | 'special';
  requirement: number; // for display purposes (e.g., booking count)
  requirementLabel: string;
}

const ACHIEVEMENT_DEFS: AchievementDef[] = [
  // Starter
  {
    id: 'first_wash',
    emoji: '🚗',
    title: 'أول غسلة',
    description: 'أكمل حجزك الأول',
    points: 25,
    category: 'starter',
    requirement: 1,
    requirementLabel: 'حجز واحد',
  },
  {
    id: 'five_star',
    emoji: '⭐',
    title: 'النجمة الخماسية',
    description: 'أعطِ تقييم 5 نجوم',
    points: 10,
    category: 'starter',
    requirement: 1,
    requirementLabel: 'تقييم 5 نجوم',
  },
  {
    id: 'regular',
    emoji: '📍',
    title: 'عميل منتظم',
    description: 'احجز 3 مرات',
    points: 50,
    category: 'starter',
    requirement: 3,
    requirementLabel: '3 حجوزات',
  },
  // Enthusiast
  {
    id: 'ten_bookings',
    emoji: '🔟',
    title: 'العشرة الكبار',
    description: '10 حجوزات مكتملة',
    points: 100,
    category: 'enthusiast',
    requirement: 10,
    requirementLabel: '10 حجوزات',
  },
  {
    id: 'schedule_king',
    emoji: '📅',
    title: 'ملك الجدولة',
    description: 'احجز 4 أسابيع متتالية',
    points: 75,
    category: 'enthusiast',
    requirement: 4,
    requirementLabel: '4 أسابيع متتالية',
  },
  {
    id: 'rain_wash',
    emoji: '🌧️',
    title: 'غسيل المطر',
    description: 'احجز بعد يوم غبار',
    points: 30,
    category: 'enthusiast',
    requirement: 1,
    requirementLabel: 'حجز بعد الغبار',
  },
  // VIP
  {
    id: 'gold',
    emoji: '💎',
    title: 'عميل ذهبي',
    description: '25 حجزاً مكتملاً',
    points: 200,
    category: 'vip',
    requirement: 25,
    requirementLabel: '25 حجزاً',
  },
  {
    id: 'legend',
    emoji: '🏆',
    title: 'أسطورة النظافة',
    description: '50 حجزاً مكتملاً',
    points: 500,
    category: 'vip',
    requirement: 50,
    requirementLabel: '50 حجزاً',
  },
  {
    id: 'vip',
    emoji: '👑',
    title: 'VIP',
    description: '100 حجز مكتمل',
    points: 1000,
    category: 'vip',
    requirement: 100,
    requirementLabel: '100 حجز',
  },
  // Special
  {
    id: 'birthday',
    emoji: '🎂',
    title: 'عيد الغسيل',
    description: 'احجز في عيد ميلادك',
    points: 50,
    category: 'special',
    requirement: 1,
    requirementLabel: 'حجز في عيد ميلادك',
  },
  {
    id: 'ambassador',
    emoji: '🤝',
    title: 'السفير',
    description: 'دعوة صديق',
    points: 75,
    category: 'special',
    requirement: 1,
    requirementLabel: 'دعوة صديق واحد',
  },
  {
    id: 'lightning',
    emoji: '⚡',
    title: 'البرق',
    description: 'احجز وأكمل في نفس اليوم',
    points: 25,
    category: 'special',
    requirement: 1,
    requirementLabel: 'إتمام في نفس اليوم',
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  starter: '🌱 البداية',
  enthusiast: '🔥 المتحمس',
  vip: '💎 VIP',
  special: '✨ خاصة',
};

// XP level thresholds
function getLevel(xp: number): { level: number; nextLevelXp: number; prevLevelXp: number; label: string } {
  const thresholds = [0, 50, 150, 300, 500, 800, 1200, 1800, 2600, 3600, 5000];
  const labels = ['مبتدئ', 'ناشئ', 'منتظم', 'متحمس', 'محترف', 'خبير', 'متميز', 'نجم', 'أسطورة', 'VIP', 'أسطورة VIP'];
  let level = 1;
  for (let i = 1; i < thresholds.length; i++) {
    if (xp >= thresholds[i]) level = i + 1;
    else break;
  }
  level = Math.min(level, 10);
  return {
    level,
    prevLevelXp: thresholds[level - 1],
    nextLevelXp: thresholds[level] ?? thresholds[thresholds.length - 1],
    label: labels[level - 1],
  };
}

// ─── Server response type ─────────────────────────────────────────────────────

interface AchievementStatus {
  id: string;
  unlocked: boolean;
  unlockedAt?: string;
  progress: number; // 0-100
  currentCount: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function Achievements() {
  const { token } = useAuth();
  const headers = { Authorization: `Bearer ${token}` };

  const { data: statuses = [], isLoading } = useQuery<AchievementStatus[]>({
    queryKey: ['achievements-my'],
    queryFn: () =>
      axios
        .get('/api/achievements/my', { headers })
        .then((r) => r.data)
        .catch(() => {
          // Fallback: derive from booking count
          return [];
        }),
  });

  // Merge defs with statuses
  const achievements = ACHIEVEMENT_DEFS.map((def) => {
    const status = statuses.find((s) => s.id === def.id);
    return { ...def, status };
  });

  const unlockedCount = achievements.filter((a) => a.status?.unlocked).length;
  const totalXp = achievements
    .filter((a) => a.status?.unlocked)
    .reduce((sum, a) => sum + a.points, 0);

  const { level, label: levelLabel, nextLevelXp, prevLevelXp } = getLevel(totalXp);
  const levelProgress =
    nextLevelXp === prevLevelXp
      ? 100
      : Math.round(((totalXp - prevLevelXp) / (nextLevelXp - prevLevelXp)) * 100);

  const categories = ['starter', 'enthusiast', 'vip', 'special'] as const;

  return (
    <div className="min-h-screen bg-[#040812] p-4 max-w-2xl mx-auto" dir="rtl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3 mb-1">
          <Trophy size={28} className="text-yellow-400" />
          <h1 className="text-2xl font-black text-white">إنجازاتي</h1>
        </div>
        <p className="text-slate-400 text-sm">
          {unlockedCount} / {ACHIEVEMENT_DEFS.length} إنجاز مكتمل
        </p>
      </motion.div>

      {/* XP & Level card */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl bg-gradient-to-l from-amber-900/40 to-yellow-900/20 border border-amber-700/30 p-4 mb-6"
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-amber-300 font-bold">المستوى {level}</p>
            <p className="text-white font-black text-xl">{levelLabel}</p>
          </div>
          <div className="text-center">
            <p className="text-3xl font-black text-yellow-300">{totalXp}</p>
            <p className="text-xs text-amber-400">نقطة XP</p>
          </div>
        </div>

        {/* Progress bar to next level */}
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-amber-400/70">
            <span>{prevLevelXp} XP</span>
            <span>المستوى {level + 1} — {nextLevelXp} XP</span>
          </div>
          <div className="h-2 bg-amber-900/40 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${levelProgress}%` }}
              transition={{ delay: 0.3, duration: 0.8, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-yellow-500 to-amber-400 rounded-full"
            />
          </div>
        </div>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-3 gap-3">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="aspect-square rounded-2xl bg-slate-800/60 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Achievement categories */}
      {!isLoading &&
        categories.map((cat) => {
          const catAchievements = achievements.filter((a) => a.category === cat);
          return (
            <div key={cat} className="mb-6">
              <h2 className="text-sm font-black text-slate-400 mb-3">
                {CATEGORY_LABELS[cat]}
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {catAchievements.map((ach, i) => {
                  const unlocked = ach.status?.unlocked ?? false;
                  const progressPct = ach.status?.progress ?? 0;
                  const currentCount = ach.status?.currentCount ?? 0;

                  return (
                    <motion.div
                      key={ach.id}
                      initial={{ opacity: 0, scale: 0.85 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.08 + i * 0.04 }}
                      className={`relative rounded-2xl p-3 flex flex-col items-center text-center border transition-all ${
                        unlocked
                          ? 'bg-gradient-to-b from-amber-900/50 to-yellow-900/30 border-yellow-500/50 shadow-[0_0_18px_rgba(234,179,8,0.15)]'
                          : 'bg-slate-800/60 border-slate-700/40'
                      }`}
                    >
                      {/* Sparkle animation for unlocked */}
                      {unlocked && (
                        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
                          {[...Array(3)].map((_, si) => (
                            <motion.div
                              key={si}
                              className="absolute w-0.5 h-0.5 bg-yellow-300 rounded-full"
                              style={{
                                top: `${20 + si * 25}%`,
                                left: `${15 + si * 30}%`,
                              }}
                              animate={{ opacity: [0, 1, 0], scale: [0, 2, 0] }}
                              transition={{
                                duration: 2,
                                repeat: Infinity,
                                delay: si * 0.7,
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* Emoji */}
                      <div
                        className={`text-3xl mb-1.5 ${
                          unlocked ? '' : 'grayscale opacity-40'
                        }`}
                      >
                        {ach.emoji}
                      </div>

                      {/* Title */}
                      <p
                        className={`text-xs font-black leading-tight mb-1 ${
                          unlocked ? 'text-yellow-200' : 'text-slate-500'
                        }`}
                      >
                        {ach.title}
                      </p>

                      {/* Points */}
                      <p
                        className={`text-xs font-bold ${
                          unlocked ? 'text-amber-400' : 'text-slate-600'
                        }`}
                      >
                        {ach.points} XP
                      </p>

                      {/* Progress bar (locked) */}
                      {!unlocked && ach.requirement > 1 && (
                        <div className="w-full mt-2 space-y-1">
                          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand-600 rounded-full transition-all"
                              style={{ width: `${Math.min(progressPct, 100)}%` }}
                            />
                          </div>
                          <p className="text-slate-600 text-[10px]">
                            {currentCount}/{ach.requirement}
                          </p>
                        </div>
                      )}

                      {/* Unlock date */}
                      {unlocked && ach.status?.unlockedAt && (
                        <p className="text-amber-600/70 text-[10px] mt-1">
                          {new Date(ach.status.unlockedAt).toLocaleDateString('ar-SA', {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </p>
                      )}

                      {/* Lock icon overlay */}
                      {!unlocked && (
                        <div className="absolute top-2 left-2">
                          <Lock size={10} className="text-slate-600" />
                        </div>
                      )}

                      {/* Pulse for just-unlocked */}
                      {unlocked && (
                        <motion.div
                          className="absolute inset-0 rounded-2xl border border-yellow-400/30"
                          animate={{ opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2.5, repeat: Infinity }}
                        />
                      )}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          );
        })}
    </div>
  );
}
