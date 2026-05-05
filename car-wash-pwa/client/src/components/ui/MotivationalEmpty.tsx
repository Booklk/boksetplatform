import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export interface EmptyAction {
  label: string;
  /** Either an external href, a router link, or an onClick handler. */
  to?: string;
  href?: string;
  onClick?: () => void;
  primary?: boolean;
  icon?: LucideIcon;
}

interface Props {
  icon?: LucideIcon;
  title: string;
  /** One-line subtitle explaining why this is actually OK / opportunity. */
  body?: string | ReactNode;
  /** Up to 3 actions — first one styled as primary if `primary` set. */
  actions?: EmptyAction[];
  /** Optional accent color for the icon halo (Tailwind text-... shade). */
  accent?: 'emerald' | 'blue' | 'amber' | 'purple' | 'rose';
}

const ACCENTS: Record<NonNullable<Props['accent']>, string> = {
  emerald: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
  blue: 'text-blue-300 bg-blue-500/10 border-blue-500/30',
  amber: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  purple: 'text-purple-300 bg-purple-500/10 border-purple-500/30',
  rose: 'text-rose-300 bg-rose-500/10 border-rose-500/30',
};

/**
 * Motivational empty state — replaces the boring "No data" block with
 * a CTA-driven panel that turns the void into an opportunity.
 *
 * Convention: every empty state in the app should answer two
 * questions: "what's empty?" and "what should I do next?".
 */
export function MotivationalEmpty({
  icon: Icon,
  title,
  body,
  actions,
  accent = 'emerald',
}: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
      className="text-center py-12 sm:py-16 px-4"
      dir="rtl"
    >
      {Icon && (
        <div className={`inline-flex w-16 h-16 rounded-3xl items-center justify-center mb-5 border ${ACCENTS[accent]}`}>
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-white font-black text-lg sm:text-xl mb-2 max-w-md mx-auto leading-tight">
        {title}
      </h3>
      {body && (
        <div className="text-slate-400 text-sm leading-relaxed max-w-md mx-auto mb-6">
          {body}
        </div>
      )}
      {actions && actions.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-2 justify-center max-w-md mx-auto">
          {actions.map((a, i) => {
            const cls = a.primary
              ? 'bg-emerald-500 hover:bg-emerald-400 text-white font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5'
              : 'bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 font-bold px-5 py-2.5 rounded-xl text-sm flex items-center justify-center gap-1.5';
            const inner = (
              <>
                {a.icon && <a.icon className="w-3.5 h-3.5" />}
                {a.label}
              </>
            );
            if (a.to) return <Link key={i} to={a.to} className={cls}>{inner}</Link>;
            if (a.href) return <a key={i} href={a.href} target="_blank" rel="noreferrer" className={cls}>{inner}</a>;
            return <button key={i} onClick={a.onClick} className={cls}>{inner}</button>;
          })}
        </div>
      )}
    </motion.div>
  );
}
